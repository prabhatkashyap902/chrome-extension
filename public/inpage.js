// Inpage script - uses IIFE bundles (window.solanaWeb3 and window.anchor)
(function() {
  console.log("[TTC Inpage] Script loaded");
  
  let rpcId = 0;
  const pendingRpcCalls = {};
  
  // Helper function to derive Associated Token Address manually (without spl-token library)
  async function getAssociatedTokenAddressManual(mint, owner, programId) {
    const { PublicKey } = window.solanaWeb3;
    
    const SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID = new PublicKey(
      'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'
    );
    const TOKEN_PROGRAM_ID = new PublicKey(
      'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
    );
    
    const [address] = PublicKey.findProgramAddressSync(
      [
        owner.toBuffer(),
        TOKEN_PROGRAM_ID.toBuffer(),
        mint.toBuffer(),
      ],
      SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID
    );
    
    return address;
  }
  
  // Make RPC call via content script (to bypass CSP)
  function solanaRpc(method, params = []) {
    return new Promise((resolve, reject) => {
      const requestId = ++rpcId;
      pendingRpcCalls[requestId] = { resolve, reject };
      
      window.postMessage({
        source: "TTC_INPAGE",
        type: "RPC_REQUEST",
        requestId,
        payload: {
          jsonrpc: "2.0",
          id: requestId,
          method,
          params
        }
      }, "*");
      
      setTimeout(() => {
        if (pendingRpcCalls[requestId]) {
          delete pendingRpcCalls[requestId];
          reject(new Error("RPC timeout"));
        }
      }, 30000);
    });
  }
  
  // Listen for messages
  window.addEventListener("message", async (event) => {
    if (event.source !== window) return;
    if (!event.data || !event.data.source) return;
    
    // Handle RPC responses
    if (event.data.source === "TTC_CONTENT" && event.data.type === "RPC_RESPONSE") {
      const pending = pendingRpcCalls[event.data.requestId];
      if (pending) {
        delete pendingRpcCalls[event.data.requestId];
        if (event.data.response.success) {
          pending.resolve(event.data.response.data);
        } else {
          pending.reject(new Error(event.data.response.error));
        }
      }
      return;
    }
    
    // Handle CONNECT_WALLET request
    if (event.data.source === "TTC_CONTENT" && event.data.type === "CONNECT_WALLET") {
      await connectWallet(event.data.walletType);
      return;
    }
    
    // Handle DISCONNECT_WALLET request
    if (event.data.source === "TTC_CONTENT" && event.data.type === "DISCONNECT_WALLET") {
      await disconnectWallet(event.data.walletType);
      return;
    }
    
    // Handle CREATE_TOKEN request
    if (event.data.source === "TTC_CONTENT" && event.data.type === "CREATE_TOKEN") {
      await createToken(event.data.payload);
    }
    
    // Handle ESTIMATE_TOKENS request
    if (event.data.source === "TTC_CONTENT" && event.data.type === "ESTIMATE_TOKENS") {
      await estimateTokensForSol(event.data.payload);
    }
    
    // ✅ Handle ESTIMATE_SOL_FROM_TOKENS request (for KOL phase)
    if (event.data.source === "TTC_CONTENT" && event.data.type === "ESTIMATE_SOL_FROM_TOKENS") {
      await estimateSolFromTokens(event.data.payload);
    }
    
    // Handle BUY_SELL_TOKEN request
    if (event.data.source === "TTC_CONTENT" && event.data.type === "BUY_SELL_TOKEN") {
      await buySellToken(event.data.payload);
    }
    
    // Handle GET_TOKEN_BALANCE request
    if (event.data.source === "TTC_CONTENT" && event.data.type === "GET_TOKEN_BALANCE") {
      await getTokenBalance(event.data.payload);
    }
    
    // Handle GET_ALLOCATIONS request
    if (event.data.source === "TTC_CONTENT" && event.data.type === "GET_ALLOCATIONS") {
      await getAllocations(event.data.payload);
    }
    
    // Handle GET_SOL_BALANCE request
    if (event.data.source === "TTC_CONTENT" && event.data.type === "GET_SOL_BALANCE") {
      await getSolBalance(event.data.payload);
    }
  });
  
  async function connectWallet(walletType) {
    try {
      console.log(`[TTC Inpage] 🔌 Connecting to ${walletType}...`);
      
      let provider = null;
      
      if (walletType === "phantom") {
        provider = window.phantom?.solana || window.solana;
      } else if (walletType === "backpack") {
        provider = window.backpack;
      } else if (walletType === "solflare") {
        provider = window.solflare;
      }
      
      if (!provider) {
        throw new Error(`${walletType.charAt(0).toUpperCase() + walletType.slice(1)} wallet not found. Please install it.`);
      }
      
      // Connect to wallet
      const result = await provider.connect();
      const walletAddress = result.publicKey.toString();
      
      console.log(`[TTC Inpage] ✅ ${walletType} connected:`, walletAddress);
      
      // Send success message
      window.postMessage({
        source: "TTC_INPAGE",
        type: "WALLET_CONNECTED",
        walletAddress: walletAddress
      }, "*");
      
    } catch (error) {
      console.error("[TTC Inpage] ❌ Wallet connection error:", error);
      window.postMessage({
        source: "TTC_INPAGE",
        type: "WALLET_ERROR",
        error: error.message || "Failed to connect wallet"
      }, "*");
    }
  }
  
  async function disconnectWallet(walletType) {
    try {
      console.log(`[TTC Inpage] 🔌 Disconnecting from ${walletType}...`);
      
      let provider = null;
      
      if (walletType === "phantom") {
        provider = window.phantom?.solana || window.solana;
      } else if (walletType === "backpack") {
        provider = window.backpack;
      } else if (walletType === "solflare") {
        provider = window.solflare;
      }
      
      if (!provider) {
        throw new Error(`${walletType.charAt(0).toUpperCase() + walletType.slice(1)} wallet not found. Please install it.`);
      }
      
      // Disconnect from wallet
      await provider.disconnect();
      
      console.log(`[TTC Inpage] ✅ ${walletType} disconnected`);
      
      // Send success message
      window.postMessage({
        source: "TTC_INPAGE",
        type: "WALLET_DISCONNECTED"
      }, "*");
      
    } catch (error) {
      console.error("[TTC Inpage] ❌ Wallet disconnection error:", error);
      window.postMessage({
        source: "TTC_INPAGE",
        type: "WALLET_ERROR",
        error: error.message || "Failed to disconnect wallet"
      }, "*");
    }
  }
  
  async function createToken(payload) {
    try {
      console.log("[TTC Inpage] 🚀 Starting token creation...");
      console.log("[TTC Inpage] Token Name:", payload.tokenName);
      console.log("[TTC Inpage] Token Symbol:", payload.tokenSymbol);
      
      // Wait for IIFE bundles to be loaded
      if (!window.solanaWeb3) {
        console.log("[TTC Inpage] Waiting for Solana web3.js to load...");
        await new Promise((resolve) => {
          const checkInterval = setInterval(() => {
            if (window.solanaWeb3) {
              clearInterval(checkInterval);
              resolve();
            }
          }, 100);
          setTimeout(() => {
            clearInterval(checkInterval);
            if (!window.solanaWeb3) {
              throw new Error("Solana web3.js failed to load");
            }
          }, 5000);
        });
      }
      
      console.log("[TTC Inpage] ✅ Solana web3.js is available");
      
      // Get web3.js from global window object (injected by IIFE)
      const { 
        PublicKey, 
        Transaction, 
        SystemProgram, 
        Keypair,
        LAMPORTS_PER_SOL
      } = window.solanaWeb3;
      
      // Check for wallet - try to detect which one is connected
      let provider = null;
      let walletName = "";
      
      if (window.phantom?.solana?.isConnected) {
        provider = window.phantom.solana;
        walletName = "Phantom";
      } else if (window.solana?.isPhantom && window.solana?.isConnected) {
        provider = window.solana;
        walletName = "Phantom";
      } else if (window.backpack?.isConnected) {
        provider = window.backpack;
        walletName = "Backpack";
      } else if (window.solflare?.isConnected) {
        provider = window.solflare;
        walletName = "Solflare";
      } else if (window.phantom?.solana) {
        provider = window.phantom.solana;
        walletName = "Phantom";
      } else if (window.solana) {
        provider = window.solana;
        walletName = "Phantom";
      } else if (window.backpack) {
        provider = window.backpack;
        walletName = "Backpack";
      } else if (window.solflare) {
        provider = window.solflare;
        walletName = "Solflare";
      }
      
      if (!provider) {
        throw new Error("No Solana wallet found. Please install Phantom, Backpack, or Solflare.");
      }
      
      console.log(`[TTC Inpage] ${walletName} wallet found, connecting...`);
      
      // Connect to wallet
      let publicKey;
      if (!provider.isConnected) {
        const result = await provider.connect();
        publicKey = result.publicKey;
      } else {
        publicKey = provider.publicKey;
      }
      
      const walletPubkey = publicKey.toString();
      console.log("[TTC Inpage] ✅ Connected to wallet:", walletPubkey);
      
      // Validate program ID
      if (!payload.programId || payload.programId === "YOUR_PROGRAM_ID_HERE") {
        throw new Error("⚠️ Program ID not configured!");
      }
      
      // Constants
      const PROGRAM_ID = new PublicKey(payload.programId);
      const METADATA_PROGRAM_ID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");
      const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
      const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
      
      console.log("[TTC Inpage] Program ID:", PROGRAM_ID.toString());
      
      // Step 2: Upload metadata to backend API (MUST complete before proceeding)
      console.log("[TTC Inpage] 📤 Uploading metadata to API...");
      
      const metadataUri = await uploadTokenMetadata(
        payload.apiUrl,
        payload.tokenName, 
        payload.tokenSymbol, 
        payload.tokenDescription,
        payload.tweetImages[0] || null,
        payload.tweetUrl || null  // Add Twitter URL
      );
      console.log("[TTC Inpage] ✅ Metadata URI:", metadataUri);
      
      // Get SOL amount from payload (handle empty string and zero)
      let solAmount = 0.1; // default
      if (payload.solAmount !== undefined && payload.solAmount !== null && payload.solAmount !== "") {
        const parsed = parseFloat(payload.solAmount);
        if (!isNaN(parsed) && parsed >= 0) {
          solAmount = parsed;
        }
      }
      console.log("[TTC Inpage] 💰 Using SOL amount:", solAmount);
      
      // Create token via program
      const { tokenMint, signature } = await createTokenViaProgramWithMetadata(
        publicKey,
        provider,
        payload.programId,
        payload.tokenName,
        payload.tokenSymbol,
        metadataUri,
        solAmount, // Use custom SOL amount from user input
        PublicKey, // Pass web3 classes to the function
        Transaction,
        SystemProgram,
        Keypair,
        LAMPORTS_PER_SOL,
        PROGRAM_ID,
        METADATA_PROGRAM_ID,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );
      
      console.log("[TTC Inpage] 🎉 Token created successfully!");
      console.log("[TTC Inpage] 📝 Signature:", signature);
      console.log("[TTC Inpage] 🔗 Explorer:", `https://explorer.solana.com/tx/${signature}?cluster=devnet`);
      console.log("[TTC Inpage] 🪙 Token Mint:", tokenMint.publicKey.toString());
      
      // Send success message
      window.postMessage({
        source: "TTC_INPAGE",
        type: "TOKEN_CREATED",
        walletAddress: walletPubkey,
        txHash: signature,
        tokenName: payload.tokenName,
        tokenSymbol: payload.tokenSymbol,
        tokenMint: tokenMint.publicKey.toString()
      }, "*");
      
    } catch (error) {
      console.error("[TTC Inpage] ❌ Error:", error);
      window.postMessage({
        source: "TTC_INPAGE",
        type: "TOKEN_ERROR",
        error: error.message || "Unknown error"
      }, "*");
    }
  }
  
  // Calculate discriminator using native crypto
  async function calculateDiscriminator(preimage) {
    const encoder = new TextEncoder();
    const data = encoder.encode(preimage);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = new Uint8Array(hashBuffer);
    return hashArray.slice(0, 8);
  }
  
  // Helper function to build instruction data for createTokenSale
  function buildCreateTokenSaleInstruction(discriminator, name, symbol, uri, initialBuySOL) {
    // Encode name (string with length prefix)
    const nameBytes = new TextEncoder().encode(name);
    const nameLength = new Uint8Array(4);
    new DataView(nameLength.buffer).setUint32(0, nameBytes.length, true);
    
    // Encode symbol (string with length prefix)
    const symbolBytes = new TextEncoder().encode(symbol);
    const symbolLength = new Uint8Array(4);
    new DataView(symbolLength.buffer).setUint32(0, symbolBytes.length, true);
    
    // Encode uri (string with length prefix)
    const uriBytes = new TextEncoder().encode(uri);
    const uriLength = new Uint8Array(4);
    new DataView(uriLength.buffer).setUint32(0, uriBytes.length, true);
    
    // Encode initial_buy_amount (u64 in lamports)
    const lamports = Math.floor(initialBuySOL * 1_000_000_000);
    const lamportsBuffer = new Uint8Array(8);
    new DataView(lamportsBuffer.buffer).setBigUint64(0, BigInt(lamports), true);
    
    // Combine all parts
    const parts = [
      discriminator,
      nameLength,
      nameBytes,
      symbolLength,
      symbolBytes,
      uriLength,
      uriBytes,
      lamportsBuffer
    ];
    
    const totalLength = parts.reduce((sum, arr) => sum + arr.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    
    for (const part of parts) {
      result.set(part, offset);
      offset += part.length;
    }
    
    return result;
  }
  
  // Function to upload token metadata
  async function uploadTokenMetadata(apiUrl, name, symbol, description, image, tweetUrl) {
    // Prepare data as plain object instead of FormData
    const uploadData = {
      name: name.trim(),
      symbol: symbol.trim(),
      description: description?.trim() || "Token created from tweet"
    };
    
    // Add image if available
    if (image) {
      console.log("[TTC Inpage] 📷 Including tweet image in metadata:", image.filename);
      
      // Check if image is already base64 or needs to be fetched
      try {
        let base64;
        
        if (image.base64 && image.base64.startsWith('data:')) {
          // Image is already in base64 format (from form upload)
          console.log("[TTC Inpage] 📷 Using pre-loaded base64 image");
          base64 = image.base64;
        } else if (image.url && (image.url.startsWith('http://') || image.url.startsWith('https://'))) {
          // Image needs to be fetched from URL (from tweet)
          console.log("[TTC Inpage] 📷 Fetching image from URL:", image.url);
          const imgResponse = await fetch(image.url);
          const blob = await imgResponse.blob();
          base64 = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        } else {
          throw new Error("Invalid image format");
        }
        
        uploadData.image = base64;
        uploadData.imageFilename = image.filename;
      } catch (imgError) {
        console.warn("[TTC Inpage] ⚠️ Failed to process tweet image:", imgError);
      }
    }
    
    // Add tweet URL if available
    if (tweetUrl) {
      console.log("[TTC Inpage] 📚 Including tweet URL in metadata:", tweetUrl);
      uploadData.tweetUrl = tweetUrl;
    }
    
    // Make API call through content script (to bypass CSP)
    console.log("[TTC Inpage] 📡 Uploading to:", apiUrl);
    
    // Send data to content script for upload
    const uploadResult = await new Promise((resolve, reject) => {
      const uploadListener = (event) => {
        if (event.source !== window) return;
        if (!event.data || event.data.source !== "TTC_CONTENT") return;
        
        if (event.data.type === "METADATA_UPLOAD_RESPONSE") {
          window.removeEventListener("message", uploadListener);
          resolve(event.data);
        }
      };
      
      window.addEventListener("message", uploadListener);
      
      window.postMessage({
        source: "TTC_INPAGE",
        type: "METADATA_UPLOAD_REQUEST",
        apiUrl: apiUrl,
        uploadData: uploadData
      }, "*");
      
      setTimeout(() => {
        window.removeEventListener("message", uploadListener);
        reject(new Error("Metadata upload timeout"));
      }, 30000);
    });

    if (!uploadResult.success) {
      throw new Error(`❌ Metadata upload failed: ${uploadResult.error}. Check browser console for details.`);
    }

    const metadataUri = uploadResult.metadata_url;
    
    if (!metadataUri) {
      throw new Error("❌ API did not return a metadata_url. Please check your backend API response.");
    }
    
    // Validate it's a proper URL (not a data URI)
    if (!metadataUri.startsWith("http://") && !metadataUri.startsWith("https://")) {
      throw new Error(`❌ Invalid metadata URI format: "${metadataUri}". Smart contract requires a valid HTTP/HTTPS URL (e.g., from Arweave or IPFS).`);
    }
    
    console.log("[TTC Inpage] ✅ Metadata uploaded successfully!");
    console.log("[TTC Inpage] 📎 Metadata URI:", metadataUri);
    console.log("[TTC Inpage] 📏 Metadata URI length:", metadataUri.length, "bytes");
    
    // Warn if URI is very long (might cause transaction size issues)
    if (metadataUri.length > 200) {
      console.warn("[TTC Inpage] ⚠️ Metadata URI is very long (" + metadataUri.length + " bytes). This might cause transaction size issues. Consider using a URL shortener service.");
    }
    
    return metadataUri;
  }
  
  // Function to create token via program with metadata
  async function createTokenViaProgramWithMetadata(walletPublicKey, wallet, programId, tokenName, tokenSymbol, metadataUri, initialBuySOL, PublicKey, Transaction, SystemProgram, Keypair, LAMPORTS_PER_SOL, PROGRAM_ID, METADATA_PROGRAM_ID, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID) {
    // Generate token mint keypair
    const tokenMint = Keypair.generate();
    console.log("[TTC Inpage] 🪙 Token Mint:", tokenMint.publicKey.toString());
    
    // Derive PDAs (same as your code)
    const textEncoder = new TextEncoder();
    
    const [factoryConfigPda] = PublicKey.findProgramAddressSync(
      [textEncoder.encode("factory_config_v2")],
      PROGRAM_ID
    );
    
    const [saleConfigPda] = PublicKey.findProgramAddressSync(
      [
        textEncoder.encode("sale_config"),
        walletPublicKey.toBuffer(),
        tokenMint.publicKey.toBuffer(),
      ],
      PROGRAM_ID
    );
    
    const [devTokenAccount] = PublicKey.findProgramAddressSync(
      [
        walletPublicKey.toBuffer(),
        new Uint8Array([
          6, 221, 246, 225, 215, 101, 161, 147, 217, 203, 225, 70, 206, 235,
          121, 172, 28, 180, 133, 237, 95, 91, 55, 145, 58, 140, 245, 133,
          126, 255, 0, 169,
        ]), // SPL token program constant
        tokenMint.publicKey.toBuffer(),
      ],
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    
    const [metadataAccount] = PublicKey.findProgramAddressSync(
      [
        textEncoder.encode("metadata"),
        METADATA_PROGRAM_ID.toBuffer(),
        tokenMint.publicKey.toBuffer(),
      ],
      METADATA_PROGRAM_ID
    );
    
    const [masterEditionAccount] = PublicKey.findProgramAddressSync(
      [
        textEncoder.encode("metadata"),
        METADATA_PROGRAM_ID.toBuffer(),
        tokenMint.publicKey.toBuffer(),
        textEncoder.encode("edition"),
      ],
      METADATA_PROGRAM_ID
    );
    
    const [priceCachePda] = PublicKey.findProgramAddressSync(
      [
        textEncoder.encode("price_cache"),
        factoryConfigPda.toBuffer(),
      ],
      PROGRAM_ID
    );
    
    console.log("[TTC Inpage] 📍 PDAs derived:");
    console.log("  Factory Config:", factoryConfigPda.toString());
    console.log("  Sale Config:", saleConfigPda.toString());
    console.log("  Dev Token Account:", devTokenAccount.toString());
    console.log("  Metadata Account:", metadataAccount.toString());
    console.log("  Master Edition:", masterEditionAccount.toString());
    console.log("  Price Cache:", priceCachePda.toString());
    
    // Build instruction data manually (since we don't have Anchor in browser)
    const discriminator = await calculateDiscriminator("global:create_token_sale");
    const instructionData = buildCreateTokenSaleInstruction(
      discriminator,
      tokenName,
      tokenSymbol,
      metadataUri,
      initialBuySOL // Use custom SOL amount from user input
    );
    
    console.log("[TTC Inpage] 📝 Instruction data built");
    
    // Get latest blockhash
    console.log("[TTC Inpage] Getting latest blockhash...");
    const blockhashData = await solanaRpc("getLatestBlockhash", [{ commitment: "finalized" }]);
    const recentBlockhash = blockhashData.result.value.blockhash;
    console.log("[TTC Inpage] ✅ Blockhash:", recentBlockhash);
    
    // Build transaction
    const transaction = new Transaction();
    transaction.recentBlockhash = recentBlockhash;
    transaction.feePayer = walletPublicKey;
    
    // Add instruction
    const createTokenInstruction = {
      keys: [
        { pubkey: walletPublicKey, isSigner: true, isWritable: true },
        { pubkey: factoryConfigPda, isSigner: false, isWritable: false },
        { pubkey: tokenMint.publicKey, isSigner: true, isWritable: true },
        { pubkey: saleConfigPda, isSigner: false, isWritable: true },
        { pubkey: devTokenAccount, isSigner: false, isWritable: true },
        { pubkey: metadataAccount, isSigner: false, isWritable: true },
        { pubkey: masterEditionAccount, isSigner: false, isWritable: true },
        { pubkey: METADATA_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: priceCachePda, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: new PublicKey("SysvarRent111111111111111111111111111111111"), isSigner: false, isWritable: false },
      ],
      programId: PROGRAM_ID,
      data: instructionData,
    };
    
    transaction.add(createTokenInstruction);
    
    // Partial sign with tokenMint keypair
    transaction.partialSign(tokenMint);
    console.log("[TTC Inpage] 🔐 Transaction partially signed with tokenMint");
    
    // Sign with wallet
    console.log("[TTC Inpage] 📤 Requesting signature from wallet...");
    const signedTransaction = await wallet.signTransaction(transaction);
    
    console.log("[TTC Inpage] ✅ Transaction signed by wallet");
    
    // Send transaction - FIXED: Use correct RPC method and encoding
    console.log("[TTC Inpage] 📡 Sending transaction to Solana devnet...");
    const serialized = signedTransaction.serialize();
    
    console.log("[TTC Inpage] 📦 Serialized transaction length:", serialized.length);
    
    // Convert to base64 (Solana RPC expects base64 encoding)
    const base64Tx = btoa(String.fromCharCode.apply(null, serialized));
    
    const sendResult = await solanaRpc("sendTransaction", [
      base64Tx,
      { encoding: "base64", skipPreflight: false, preflightCommitment: "confirmed" }
    ]);
    
    console.log("[TTC Inpage] 📬 Send result:", JSON.stringify(sendResult, null, 2));
    
    // Check for RPC error
    if (sendResult.error) {
      console.error("[TTC Inpage] ❌ RPC Error:", sendResult.error);
      throw new Error(`RPC Error: ${sendResult.error.message || JSON.stringify(sendResult.error)}`);
    }
    
    const signature = sendResult.result;
    
    if (!signature) {
      console.error("[TTC Inpage] ❌ No signature returned. Full response:", sendResult);
      throw new Error("Transaction sent but no signature returned. Check RPC response.");
    }
    
    return { tokenMint, signature };
  }
  
  // Function to estimate tokens for SOL
  async function estimateTokensForSol(payload) {
    try {
      console.log("[TTC Inpage] 📊 Estimating tokens for SOL...");
      console.log("[TTC Inpage] SOL Amount:", payload.solAmount);
      
      // Wait for web3 to be available
      if (!window.solanaWeb3) {
        console.log("[TTC Inpage] Waiting for Solana libraries to load...");
        await new Promise((resolve) => {
          const checkInterval = setInterval(() => {
            if (window.solanaWeb3) {
              clearInterval(checkInterval);
              resolve();
            }
          }, 100);
          setTimeout(() => {
            clearInterval(checkInterval);
            if (!window.solanaWeb3) {
              throw new Error("Solana libraries failed to load");
            }
          }, 5000);
        });
      }
      
      console.log("[TTC Inpage] ✅ Solana libraries are available");
      
      // Get web3.js from global window object (injected by IIFE)
      const { PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } = window.solanaWeb3;
      
      // Check for wallet
      let provider = null;
      
      if (window.phantom?.solana?.isConnected) {
        provider = window.phantom.solana;
      } else if (window.solana?.isPhantom && window.solana?.isConnected) {
        provider = window.solana;
      } else if (window.backpack?.isConnected) {
        provider = window.backpack;
      } else if (window.solflare?.isConnected) {
        provider = window.solflare;
      }
      
      if (!provider || !provider.isConnected) {
        throw new Error("Wallet not connected");
      }
      
      const publicKey = provider.publicKey;
      console.log("[TTC Inpage] ✅ Wallet connected:", publicKey.toString());
      
      // Validate program ID
      if (!payload.programId || payload.programId === "YOUR_PROGRAM_ID_HERE") {
        throw new Error("⚠️ Program ID not configured!");
      }
      
      const PROGRAM_ID = new PublicKey(payload.programId);
      
      // Derive PDAs
      const textEncoder = new TextEncoder();
      
      const [factoryConfigPda] = PublicKey.findProgramAddressSync(
        [textEncoder.encode("factory_config_v2")],
        PROGRAM_ID
      );
      
      const [priceCachePda] = PublicKey.findProgramAddressSync(
        [textEncoder.encode("price_cache"), factoryConfigPda.toBuffer()],
        PROGRAM_ID
      );
      
      console.log("[TTC Inpage] 📍 Building estimation instruction...");
      
      // Get SOL amount in lamports
      const solAmountLamports = Math.floor(parseFloat(payload.solAmount) * LAMPORTS_PER_SOL);
      
      // Find the instruction discriminator for estimateDevTokensForSol from IDL
      const estimateInstruction = payload.idl.instructions.find(
        ix => ix.name === "estimateDevTokensForSol" || ix.name === "estimate_dev_tokens_for_sol"
      );
      
      if (!estimateInstruction || !estimateInstruction.discriminator) {
        throw new Error("Could not find estimateDevTokensForSol in IDL");
      }
      
      const discriminator = new Uint8Array(estimateInstruction.discriminator);
      console.log("[TTC Inpage] 🔍 Method discriminator:", Array.from(discriminator));
      
      // Build instruction data: [8-byte discriminator][8-byte u64 sol_amount]
      const instructionData = new Uint8Array(16);
      instructionData.set(discriminator, 0);
      
      // Set sol amount as little-endian u64
      const dataView = new DataView(instructionData.buffer);
      dataView.setBigUint64(8, BigInt(solAmountLamports), true);
      
      console.log("[TTC Inpage] 📦 Instruction data:", Array.from(instructionData));
      
      // Create the instruction
      const instruction = {
        programId: PROGRAM_ID,
        keys: [
          { pubkey: factoryConfigPda, isSigner: false, isWritable: false },
          { pubkey: priceCachePda, isSigner: false, isWritable: false },
        ],
        data: instructionData // Use Uint8Array directly (no Buffer needed in browser)
      };
      
      // Get latest blockhash
      console.log("[TTC Inpage] Getting latest blockhash for simulation...");
      const blockhashData = await solanaRpc("getLatestBlockhash", [{ commitment: "finalized" }]);
      const recentBlockhash = blockhashData.result.value.blockhash;
      
      // Create a transaction
      const transaction = new Transaction();
      transaction.recentBlockhash = recentBlockhash;
      transaction.feePayer = publicKey;
      transaction.add(instruction);
      
      // Serialize the transaction
      const serialized = transaction.serialize({ requireAllSignatures: false, verifySignatures: false });
      const base64Tx = btoa(String.fromCharCode.apply(null, serialized));
      
      // Simulate the transaction
      console.log("[TTC Inpage] 🎬 Simulating transaction...");
      const simulation = await solanaRpc("simulateTransaction", [
        base64Tx,
        {
          encoding: "base64",
          commitment: "processed"
        }
      ]);
      
      console.log("[TTC Inpage] 📊 Simulation result:", simulation);
      
      if (simulation.result.value.err) {
        throw new Error(`Simulation failed: ${JSON.stringify(simulation.result.value.err)}`);
      }
      
      // Parse the return data from simulation
      if (!simulation.result.value.returnData) {
        throw new Error("No return data from simulation");
      }
      
      const returnDataBase64 = simulation.result.value.returnData.data[0];
      const returnDataBytes = Uint8Array.from(atob(returnDataBase64), c => c.charCodeAt(0));
      
      console.log("[TTC Inpage] 📥 Return data bytes:", Array.from(returnDataBytes));
      
      // Parse as u64 little-endian (tokens in lamports)
      const returnView = new DataView(returnDataBytes.buffer);
      const estimatedLamports = returnView.getBigUint64(0, true);
      
      const estimatedTokens = Number(estimatedLamports) / LAMPORTS_PER_SOL;
      console.log("[TTC Inpage] ✅ Estimated tokens:", estimatedTokens);
      
      // Send success response
      window.postMessage({
        source: "TTC_INPAGE",
        type: "TOKEN_ESTIMATION_RESPONSE",
        success: true,
        estimatedTokens: estimatedTokens
      }, "*");
      
    } catch (error) {
      console.error("[TTC Inpage] ❌ Estimation error:", error);
      window.postMessage({
        source: "TTC_INPAGE",
        type: "TOKEN_ESTIMATION_RESPONSE",
        success: false,
        error: error.message || "Unknown error",
        estimatedTokens: 0
      }, "*");
    }
  }
  
  // ✅ Function to estimate SOL from tokens (for KOL phase)
  async function estimateSolFromTokens(payload) {
    try {
      console.log("[TTC Inpage] 📊 Estimating SOL from tokens...");
      console.log("[TTC Inpage] Token Amount:", payload.amount);
      
      // Wait for web3 to be available
      if (!window.solanaWeb3) {
        console.log("[TTC Inpage] Waiting for Solana libraries to load...");
        await new Promise((resolve) => {
          const checkInterval = setInterval(() => {
            if (window.solanaWeb3) {
              clearInterval(checkInterval);
              resolve();
            }
          }, 100);
          setTimeout(() => {
            clearInterval(checkInterval);
            if (!window.solanaWeb3) {
              throw new Error("Solana libraries failed to load");
            }
          }, 5000);
        });
      }
      
      console.log("[TTC Inpage] ✅ Solana libraries are available");
      
      // Get web3.js from global window object
      const { PublicKey, Transaction, LAMPORTS_PER_SOL } = window.solanaWeb3;
      
      // Check for wallet
      let provider = null;
      
      if (window.phantom?.solana?.isConnected) {
        provider = window.phantom.solana;
      } else if (window.solana?.isPhantom && window.solana?.isConnected) {
        provider = window.solana;
      } else if (window.backpack?.isConnected) {
        provider = window.backpack;
      } else if (window.solflare?.isConnected) {
        provider = window.solflare;
      }
      
      if (!provider || !provider.isConnected) {
        throw new Error("Wallet not connected");
      }
      
      const publicKey = provider.publicKey;
      console.log("[TTC Inpage] ✅ Wallet connected:", publicKey.toString());
      
      // Validate program ID
      if (!payload.programId || payload.programId === "YOUR_PROGRAM_ID_HERE") {
        throw new Error("⚠️ Program ID not configured!");
      }
      
      const PROGRAM_ID = new PublicKey(payload.programId);
      const tokenMint = new PublicKey(payload.tokenAddress);
      const saleConfigAuthority = new PublicKey(payload.saleAuthority);
      
      // Derive PDAs
      const textEncoder = new TextEncoder();
      
      const [factoryConfigPda] = PublicKey.findProgramAddressSync(
        [textEncoder.encode("factory_config_v2")],
        PROGRAM_ID
      );
      
      const [saleConfigPda] = PublicKey.findProgramAddressSync(
        [
          textEncoder.encode("sale_config"),
          saleConfigAuthority.toBuffer(),
          tokenMint.toBuffer()
        ],
        PROGRAM_ID
      );
      
      const [priceCachePda] = PublicKey.findProgramAddressSync(
        [textEncoder.encode("price_cache"), factoryConfigPda.toBuffer()],
        PROGRAM_ID
      );
      
      // Derive public_user_data PDA (optional account)
      const [publicUserDataPda] = PublicKey.findProgramAddressSync(
        [
          textEncoder.encode("public_user_data"),
          publicKey.toBuffer(),
          tokenMint.toBuffer()
        ],
        PROGRAM_ID
      );
      
      console.log("[TTC Inpage] 📍 Checking if public_user_data account exists...");
      
      // Check if public_user_data account exists on-chain
      let publicUserDataAccount = publicUserDataPda;
      try {
        const accountInfo = await solanaRpc("getAccountInfo", [
          publicUserDataPda.toString(),
          { encoding: "base64" }
        ]);
        
        if (!accountInfo.result || !accountInfo.result.value) {
          console.log("[TTC Inpage] ⚠️ public_user_data doesn't exist yet, using PROGRAM_ID");
          publicUserDataAccount = PROGRAM_ID; // Use PROGRAM_ID for optional non-existent accounts
        } else {
          console.log("[TTC Inpage] ✅ public_user_data exists");
        }
      } catch (err) {
        console.log("[TTC Inpage] ⚠️ Error checking public_user_data, using PROGRAM_ID:", err.message);
        publicUserDataAccount = PROGRAM_ID;
      }
      
      console.log("[TTC Inpage] 📍 Building estimation instruction...");
      
      // Get token amount as BN (integer tokens, not lamports)
      const tokenAmount = BigInt(Math.floor(parseFloat(payload.amount)));
      
      // Find the instruction discriminator for calculateSolForTokens from IDL
      const estimateInstruction = payload.idl.instructions.find(
        ix => ix.name === "calculateSolForTokens" || ix.name === "calculate_sol_for_tokens"
      );
      
      if (!estimateInstruction || !estimateInstruction.discriminator) {
        throw new Error("Could not find calculateSolForTokens in IDL");
      }
      
      const discriminator = new Uint8Array(estimateInstruction.discriminator);
      console.log("[TTC Inpage] 🔍 Method discriminator:", Array.from(discriminator));
      
      // Build instruction data: [8-byte discriminator][8-byte u64 token_amount]
      const instructionData = new Uint8Array(16);
      instructionData.set(discriminator, 0);
      
      // Set token amount as little-endian u64
      const dataView = new DataView(instructionData.buffer);
      dataView.setBigUint64(8, tokenAmount, true);
      
      console.log("[TTC Inpage] 📦 Instruction data:", Array.from(instructionData));
      
      // Create the instruction (matching Anchor's account order)
      const instruction = {
        programId: PROGRAM_ID,
        keys: [
          { pubkey: tokenMint, isSigner: false, isWritable: false }, // token_mint
          { pubkey: saleConfigPda, isSigner: false, isWritable: false }, // sale_config
          { pubkey: factoryConfigPda, isSigner: false, isWritable: false }, // factory_config
          { pubkey: publicUserDataAccount, isSigner: false, isWritable: false }, // public_user_data (optional - use PROGRAM_ID if doesn't exist)
          { pubkey: publicKey, isSigner: false, isWritable: false }, // user
          { pubkey: priceCachePda, isSigner: false, isWritable: false }, // price_cache
        ],
        data: instructionData
      };
      
      // Get latest blockhash
      console.log("[TTC Inpage] Getting latest blockhash for simulation...");
      const blockhashData = await solanaRpc("getLatestBlockhash", [{ commitment: "finalized" }]);
      const recentBlockhash = blockhashData.result.value.blockhash;
      
      // Create a transaction
      const transaction = new Transaction();
      transaction.recentBlockhash = recentBlockhash;
      transaction.feePayer = publicKey;
      transaction.add(instruction);
      
      // Serialize the transaction
      const serialized = transaction.serialize({ requireAllSignatures: false, verifySignatures: false });
      const base64Tx = btoa(String.fromCharCode.apply(null, serialized));
      
      // Simulate the transaction
      console.log("[TTC Inpage] 🎬 Simulating transaction...");
      const simulation = await solanaRpc("simulateTransaction", [
        base64Tx,
        {
          encoding: "base64",
          commitment: "processed"
        }
      ]);
      
      console.log("[TTC Inpage] 📊 Simulation result:", simulation);
      
      if (simulation.result.value.err) {
        throw new Error(`Simulation failed: ${JSON.stringify(simulation.result.value.err)}`);
      }
      
      // Parse the return data from simulation
      if (!simulation.result.value.returnData) {
        throw new Error("No return data from simulation");
      }
      
      const returnDataBase64 = simulation.result.value.returnData.data[0];
      const returnDataBytes = Uint8Array.from(atob(returnDataBase64), c => c.charCodeAt(0));
      
      console.log("[TTC Inpage] 📥 Return data bytes:", Array.from(returnDataBytes));
      
      // Parse as u64 little-endian (SOL in lamports)
      const returnView = new DataView(returnDataBytes.buffer);
      const estimatedLamports = returnView.getBigUint64(0, true);
      const estimatedSol = Number(estimatedLamports) / LAMPORTS_PER_SOL;
      console.log("[TTC Inpage] ✅ Estimated SOL:", estimatedSol);
      
      // Send success response
      window.postMessage({
        source: "TTC_INPAGE",
        type: "SOL_ESTIMATION_RESPONSE",
        success: true,
        estimatedSol: estimatedSol
      }, "*");
      
    } catch (error) {
      console.error("[TTC Inpage] ❌ Estimation error:", error);
      window.postMessage({
        source: "TTC_INPAGE",
        type: "SOL_ESTIMATION_RESPONSE",
        success: false,
        error: error.message || "Unknown error",
        estimatedSol: 0
      }, "*");
    }
  }
  
  // Function to buy or sell token
  async function buySellToken(payload) {
    try {
      console.log(`[TTC Inpage] 💰 ${payload.mode === 'buy' ? 'Buying' : 'Selling'} token...`);
      console.log("[TTC Inpage] Token Address:", payload.tokenAddress);
      console.log("[TTC Inpage] Amount:", payload.amount);
      console.log("[TTC Inpage] Mode:", payload.mode);
      
      // Wait for web3 to be available
      if (!window.solanaWeb3) {
        console.log("[TTC Inpage] Waiting for Solana libraries to load...");
        await new Promise((resolve, reject) => {
          let attempts = 0;
          const maxAttempts = 100; // 10 seconds total (100 * 100ms)
          
          const checkInterval = setInterval(() => {
            attempts++;
            
            if (window.solanaWeb3) {
              console.log(`[TTC Inpage] ✅ Libraries loaded after ${attempts * 100}ms`);
              clearInterval(checkInterval);
              resolve();
            } else if (attempts >= maxAttempts) {
              clearInterval(checkInterval);
              console.error("[TTC Inpage] ❌ Library not found:", {
                solanaWeb3: !!window.solanaWeb3
              });
              reject(new Error("Solana web3.js library failed to load"));
            }
          }, 100);
        });
      }
      
      console.log("[TTC Inpage] ✅ Solana libraries are available");
      
      // Get web3.js from global window object (injected by IIFE)
      const { PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } = window.solanaWeb3;
      
      // Define SPL Token program IDs manually (no need for spl-token library)
      const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
      const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
      
      // Check for wallet
      let provider = null;
      
      if (window.phantom?.solana?.isConnected) {
        provider = window.phantom.solana;
      } else if (window.solana?.isPhantom && window.solana?.isConnected) {
        provider = window.solana;
      } else if (window.backpack?.isConnected) {
        provider = window.backpack;
      } else if (window.solflare?.isConnected) {
        provider = window.solflare;
      }
      
      if (!provider || !provider.isConnected) {
        throw new Error("Wallet not connected");
      }
      
      const walletPublicKey = provider.publicKey;
      console.log("[TTC Inpage] ✅ Wallet connected:", walletPublicKey.toString());
      
      // Validate program ID
      if (!payload.programId) {
        throw new Error("⚠️ Program ID not configured!");
      }
      
      const PROGRAM_ID = new PublicKey(payload.programId);
      const tokenMint = new PublicKey(payload.tokenAddress);
      
      // Derive PDAs using TextEncoder (browser-safe alternative to Buffer)
      const textEncoder = new TextEncoder();
      
      const [factoryConfigPda] = PublicKey.findProgramAddressSync(
        [textEncoder.encode("factory_config_v2")],
        PROGRAM_ID
      );
      
      console.log("[TTC Inpage] 📍 Factory Config PDA:", factoryConfigPda.toString());
      
      // Get sale_authority from payload
      let saleConfigAuthority = null;
      let saleConfigPda = null;
      
      if (payload.saleAuthority && payload.saleAuthority.trim() !== "") {
        console.log("[TTC Inpage] ✅ Using sale_authority from token data:", payload.saleAuthority);
        saleConfigAuthority = new PublicKey(payload.saleAuthority);
      } else {
        // Fallback: Try to derive using the wallet as authority (in case it's the creator)
        console.log("[TTC Inpage] ⚠️ No sale_authority provided, trying wallet as authority");
        saleConfigAuthority = walletPublicKey;
      }
      
      // Derive saleConfig PDA using the authority
      [saleConfigPda] = PublicKey.findProgramAddressSync(
        [
          textEncoder.encode("sale_config"),
          saleConfigAuthority.toBuffer(),
          tokenMint.toBuffer()
        ],
        PROGRAM_ID
      );
      
      console.log("[TTC Inpage] 📍 Sale Config Authority:", saleConfigAuthority.toString());
      console.log("[TTC Inpage] 📍 Sale Config PDA:", saleConfigPda.toString());
      
      // Verify the saleConfig account exists on-chain
      const saleConfigAccountInfo = await solanaRpc("getAccountInfo", [
        saleConfigPda.toString(),
        { encoding: "base64" }
      ]);
      
      console.log("[TTC Inpage] 🔍 Sale Config Account Info:", saleConfigAccountInfo);
      
      if (!saleConfigAccountInfo.result || !saleConfigAccountInfo.result.value) {
        throw new Error(`SaleConfig account does not exist at ${saleConfigPda.toString()}. This means the sale_authority (${saleConfigAuthority.toString()}) is incorrect or the token was not properly initialized.`);
      }
      
      console.log("[TTC Inpage] ✅ Sale Config account exists on-chain");
      
      // Derive recipient token account (ATA)
      const customSeed = new Uint8Array([
        6, 221, 246, 225, 215, 101, 161, 147, 217, 203, 225, 70, 206, 235, 121,
        172, 28, 180, 133, 237, 95, 91, 55, 145, 58, 140, 245, 133, 126, 255, 0, 169
      ]);
      const customProgramId = new PublicKey([
        140, 151, 37, 143, 78, 36, 137, 241, 187, 61, 16, 41, 20, 142, 13, 131,
        11, 90, 19, 153, 218, 255, 16, 132, 4, 142, 123, 216, 219, 233, 248, 89
      ]);
      
      const [recipientTokenAccountPda] = PublicKey.findProgramAddressSync(
        [
          walletPublicKey.toBuffer(),
          customSeed,
          tokenMint.toBuffer()
        ],
        customProgramId
      );
      
      console.log("[TTC Inpage] ��� Recipient Token Account PDA:", recipientTokenAccountPda.toString());
      
      const [platformVault] = PublicKey.findProgramAddressSync(
        [textEncoder.encode("platform_vault"), factoryConfigPda.toBuffer()],
        PROGRAM_ID
      );
      
      const [priceCachePda] = PublicKey.findProgramAddressSync(
        [textEncoder.encode("price_cache"), factoryConfigPda.toBuffer()],
        PROGRAM_ID
      );
      
      const [publicUserDataPda] = PublicKey.findProgramAddressSync(
        [
          textEncoder.encode("public_user_data"),
          walletPublicKey.toBuffer(),
          tokenMint.toBuffer()
        ],
        PROGRAM_ID
      );
      
      // Optional KOL accounts (we'll set them to program ID as placeholder when not used)
      const [kolDataPda] = PublicKey.findProgramAddressSync(
        [
          textEncoder.encode("kol_data"),
          walletPublicKey.toBuffer(),
          tokenMint.toBuffer()
        ],
        PROGRAM_ID
      );
      
      const [kolMasterPda] = PublicKey.findProgramAddressSync(
        [textEncoder.encode("kol_master_v2"), walletPublicKey.toBuffer()],
        PROGRAM_ID
      );
      
      console.log("[TTC Inpage] 📍 Platform Vault PDA:", platformVault.toString());
      console.log("[TTC Inpage] 📍 Price Cache PDA:", priceCachePda.toString());
      console.log("[TTC Inpage] 📍 Public User Data PDA:", publicUserDataPda.toString());
      
      // Build the instruction based on mode
      let instruction;
      
      if (payload.mode === "buy") {
        // BUY TOKENS
        console.log("[TTC Inpage] 🛒 Building BUY instruction...");
        
        // Find buy_tokens instruction in IDL
        const buyInstruction = payload.idl.instructions.find(
          ix => ix.name === "buy_tokens"
        );
        
        if (!buyInstruction || !buyInstruction.discriminator) {
          throw new Error("Could not find buy_tokens in IDL");
        }
        
        const discriminator = new Uint8Array(buyInstruction.discriminator);
        console.log("[TTC Inpage] 🔍 Buy discriminator:", Array.from(discriminator));
        
        // Convert SOL amount to lamports
        const solAmountLamports = Math.floor(parseFloat(payload.amount) * LAMPORTS_PER_SOL);
        
        // Build instruction data: [8-byte discriminator][8-byte u64 sol_amount]
        const instructionData = new Uint8Array(16);
        instructionData.set(discriminator, 0);
        
        const dataView = new DataView(instructionData.buffer);
        dataView.setBigUint64(8, BigInt(solAmountLamports), true);
        
        console.log("[TTC Inpage] 📦 Buy instruction data:", Array.from(instructionData));
        
        // Create instruction with all required accounts (matching IDL order!)
        instruction = {
          programId: PROGRAM_ID,
          keys: [
            { pubkey: walletPublicKey, isSigner: true, isWritable: true }, // buyer
            { pubkey: tokenMint, isSigner: false, isWritable: true }, // token_mint (writable in IDL!)
            { pubkey: factoryConfigPda, isSigner: false, isWritable: false }, // factory_config
            { pubkey: saleConfigPda, isSigner: false, isWritable: true }, // sale_config
            { pubkey: recipientTokenAccountPda, isSigner: false, isWritable: true }, // recipient_token_account
            { pubkey: kolDataPda, isSigner: false, isWritable: true }, // kol_data (optional)
            { pubkey: kolMasterPda, isSigner: false, isWritable: false }, // kol_master (optional)
            { pubkey: publicUserDataPda, isSigner: false, isWritable: true }, // public_user_data
            { pubkey: saleConfigAuthority, isSigner: false, isWritable: true }, // dev_wallet
            { pubkey: platformVault, isSigner: false, isWritable: true }, // platform_vault
            { pubkey: priceCachePda, isSigner: false, isWritable: false }, // price_cache
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
            { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // token_program
            { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // associated_token_program
            { pubkey: new PublicKey("SysvarRent111111111111111111111111111111111"), isSigner: false, isWritable: false } // rent
          ],
          data: instructionData
        };
        
      } else {
        // SELL TOKENS
        console.log("[TTC Inpage] 💸 Building SELL instruction...");
        
        // Find sell_tokens instruction in IDL
        const sellInstruction = payload.idl.instructions.find(
          ix => ix.name === "sell_tokens"
        );
        
        if (!sellInstruction || !sellInstruction.discriminator) {
          throw new Error("Could not find sell_tokens in IDL");
        }
        
        const discriminator = new Uint8Array(sellInstruction.discriminator);
        console.log("[TTC Inpage] 🔍 Sell discriminator:", Array.from(discriminator));
        
        // Get token decimals - assuming 9 for now, should fetch from mint
        const tokenDecimals = 9;
        
        // Convert token amount to lamports
        const [whole, decimal = ""] = String(payload.amount).split(".");
        const paddedDecimal = decimal.padEnd(tokenDecimals, "0").slice(0, tokenDecimals);
        const tokenAmountLamports = BigInt(whole + paddedDecimal);
        
        console.log("[TTC Inpage] 🪙 Tokens to sell (lamports):", tokenAmountLamports.toString());
        
        // Build instruction data: [8-byte discriminator][8-byte u64 tokens_to_sell]
        const instructionData = new Uint8Array(16);
        instructionData.set(discriminator, 0);
        
        const dataView = new DataView(instructionData.buffer);
        dataView.setBigUint64(8, tokenAmountLamports, true);
        
        console.log("[TTC Inpage] 📦 Sell instruction data:", Array.from(instructionData));
        
        // Create instruction with all required accounts (matching IDL order!)
        instruction = {
          programId: PROGRAM_ID,
          keys: [
            { pubkey: walletPublicKey, isSigner: true, isWritable: true }, // seller
            { pubkey: tokenMint, isSigner: false, isWritable: true }, // token_mint (writable!)
            { pubkey: saleConfigPda, isSigner: false, isWritable: true }, // sale_config
            { pubkey: recipientTokenAccountPda, isSigner: false, isWritable: true }, // sender_token_account
            { pubkey: kolDataPda, isSigner: false, isWritable: true }, // kol_data (optional)
            { pubkey: publicUserDataPda, isSigner: false, isWritable: true }, // public_user_data
            { pubkey: factoryConfigPda, isSigner: false, isWritable: false }, // factory_config
            { pubkey: saleConfigAuthority, isSigner: false, isWritable: true }, // dev_wallet
            { pubkey: platformVault, isSigner: false, isWritable: true }, // platform_vault
            { pubkey: priceCachePda, isSigner: false, isWritable: false }, // price_cache
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
            { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false } // token_program
          ],
          data: instructionData
        };
      }
      
      // Get latest blockhash
      console.log("[TTC Inpage] Getting latest blockhash...");
      const blockhashData = await solanaRpc("getLatestBlockhash", [{ commitment: "finalized" }]);
      const recentBlockhash = blockhashData.result.value.blockhash;
      
      // Create transaction
      const transaction = new Transaction();
      transaction.recentBlockhash = recentBlockhash;
      transaction.feePayer = walletPublicKey;
      transaction.add(instruction);
      
      console.log("[TTC Inpage] 📝 Requesting signature from wallet...");
      
      // Sign and send transaction
      const signedTx = await provider.signTransaction(transaction);
      const serialized = signedTx.serialize();
      const base64Tx = btoa(String.fromCharCode.apply(null, serialized));
      
      console.log("[TTC Inpage] 📤 Sending transaction...");
      
      const txResult = await solanaRpc("sendTransaction", [
        base64Tx,
        { encoding: "base64", skipPreflight: false, preflightCommitment: "confirmed" }
      ]);
      
      if (txResult.error) {
        // Parse Anchor error codes
        const errorMsg = txResult.error.message || JSON.stringify(txResult.error);
        
        console.error("[TTC Inpage] ❌ Transaction Error:", txResult.error);
        console.error("[TTC Inpage] 📋 Error Logs:", txResult.error.data?.logs || "No logs");
        
        // Check for specific error codes
        if (errorMsg.includes("0x2971") || errorMsg.includes("10609")) {
          throw new Error("⚠️ Transaction Limit Exceeded! You're trying to buy/sell more than the per-transaction limit. Please reduce your amount and try again.");
        }
        
        if (errorMsg.includes("0x2870") || errorMsg.includes("10352")) {
          throw new Error("⚠️ Insufficient token allocation! The token sale has insufficient tokens available for this purchase. Try a smaller amount.");
        }
        
        throw new Error(errorMsg);
      }
      
      const txHash = txResult.result;
      console.log("[TTC Inpage] ✅ Transaction sent:", txHash);
      
      // Send success response
      window.postMessage({
        source: "TTC_INPAGE",
        type: "BUY_SELL_TOKEN_RESPONSE",
        success: true,
        txHash: txHash,
        mode: payload.mode
      }, "*");
      
    } catch (error) {
      console.error("[TTC Inpage] ❌ Buy/Sell error:", error);
      window.postMessage({
        source: "TTC_INPAGE",
        type: "BUY_SELL_TOKEN_ERROR",
        success: false,
        error: error.message || "Unknown error"
      }, "*");
    }
  }
  
  // Function to get token balance
  async function getTokenBalance(payload) {
    try {
      console.log("[TTC Inpage] 📊 Getting token balance...");
      console.log("[TTC Inpage] Token Address:", payload.tokenAddress);
      console.log("[TTC Inpage] Wallet Address:", payload.walletAddress);
      
      // Wait for web3 to be available
      if (!window.solanaWeb3) {
        console.log("[TTC Inpage] Waiting for Solana libraries to load...");
        await new Promise((resolve, reject) => {
          let attempts = 0;
          const maxAttempts = 100; // 10 seconds total (100 * 100ms)
          
          const checkInterval = setInterval(() => {
            attempts++;
            
            if (window.solanaWeb3) {
              console.log(`[TTC Inpage] ✅ Libraries loaded after ${attempts * 100}ms`);
              clearInterval(checkInterval);
              resolve();
            } else if (attempts >= maxAttempts) {
              clearInterval(checkInterval);
              console.error("[TTC Inpage] ❌ Library not found:", {
                solanaWeb3: !!window.solanaWeb3
              });
              reject(new Error("Solana web3.js library failed to load"));
            }
          }, 100);
        });
      }
      
      console.log("[TTC Inpage] ✅ Solana libraries are available");
      
      // Get web3.js from global window object (injected by IIFE)
      const { PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } = window.solanaWeb3;
      
      // Define SPL Token program IDs manually (no need for spl-token library)
      const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
      const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
      
      // Check for wallet
      let provider = null;
      
      if (window.phantom?.solana?.isConnected) {
        provider = window.phantom.solana;
      } else if (window.solana?.isPhantom && window.solana?.isConnected) {
        provider = window.solana;
      } else if (window.backpack?.isConnected) {
        provider = window.backpack;
      } else if (window.solflare?.isConnected) {
        provider = window.solflare;
      }
      
      if (!provider || !provider.isConnected) {
        throw new Error("Wallet not connected");
      }
      
      const walletPublicKey = provider.publicKey;
      console.log("[TTC Inpage] ✅ Wallet connected:", walletPublicKey.toString());
      
      // Validate program ID
      if (!payload.programId) {
        throw new Error("⚠️ Program ID not configured!");
      }
      
      const PROGRAM_ID = new PublicKey(payload.programId);
      const tokenMint = new PublicKey(payload.tokenAddress);
      
      // Derive PDAs using TextEncoder (browser-safe alternative to Buffer)
      const textEncoder = new TextEncoder();
      
      const [factoryConfigPda] = PublicKey.findProgramAddressSync(
        [textEncoder.encode("factory_config_v2")],
        PROGRAM_ID
      );
      
      console.log("[TTC Inpage] 📍 Factory Config PDA:", factoryConfigPda.toString());
      
      // Get sale_authority from payload
      let saleConfigAuthority = null;
      let saleConfigPda = null;
      
      if (payload.saleAuthority && payload.saleAuthority.trim() !== "") {
        console.log("[TTC Inpage] ✅ Using sale_authority from token data:", payload.saleAuthority);
        saleConfigAuthority = new PublicKey(payload.saleAuthority);
      } else {
        // Fallback: Try to derive using the wallet as authority (in case it's the creator)
        console.log("[TTC Inpage] ⚠️ No sale_authority provided, trying wallet as authority");
        saleConfigAuthority = walletPublicKey;
      }
      
      // Derive saleConfig PDA using the authority
      [saleConfigPda] = PublicKey.findProgramAddressSync(
        [
          textEncoder.encode("sale_config"),
          saleConfigAuthority.toBuffer(),
          tokenMint.toBuffer()
        ],
        PROGRAM_ID
      );
      
      console.log("[TTC Inpage] 📍 Sale Config Authority:", saleConfigAuthority.toString());
      console.log("[TTC Inpage] 📍 Sale Config PDA:", saleConfigPda.toString());
      
      // Derive recipient token account (ATA)
      const customSeed = new Uint8Array([
        6, 221, 246, 225, 215, 101, 161, 147, 217, 203, 225, 70, 206, 235, 121,
        172, 28, 180, 133, 237, 95, 91, 55, 145, 58, 140, 245, 133, 126, 255, 0, 169
      ]);
      const customProgramId = new PublicKey([
        140, 151, 37, 143, 78, 36, 137, 241, 187, 61, 16, 41, 20, 142, 13, 131,
        11, 90, 19, 153, 218, 255, 16, 132, 4, 142, 123, 216, 219, 233, 248, 89
      ]);
      
      const [recipientTokenAccountPda] = PublicKey.findProgramAddressSync(
        [
          walletPublicKey.toBuffer(),
          customSeed,
          tokenMint.toBuffer()
        ],
        customProgramId
      );
      
      console.log("[TTC Inpage] 📍 Recipient Token Account PDA:", recipientTokenAccountPda.toString());
      
      const [platformVault] = PublicKey.findProgramAddressSync(
        [textEncoder.encode("platform_vault"), factoryConfigPda.toBuffer()],
        PROGRAM_ID
      );
      
      // Get token balance
      console.log("[TTC Inpage] Getting token balance...");
      const balanceData = await solanaRpc("getTokenAccountBalance", [recipientTokenAccountPda.toString()]);
      
      if (balanceData.error) {
        throw new Error(balanceData.error.message || "Failed to get token balance");
      }
      
      const balance = balanceData.result.value.uiAmount;
      console.log("[TTC Inpage] ✅ Token balance:", balance);
      
      // Send success response
      window.postMessage({
        source: "TTC_INPAGE",
        type: "GET_TOKEN_BALANCE_RESPONSE",
        success: true,
        balance: balance
      }, "*");
      
    } catch (error) {
      console.error("[TTC Inpage] ❌ Get Token Balance error:", error);
      window.postMessage({
        source: "TTC_INPAGE",
        type: "GET_TOKEN_BALANCE_ERROR",
        success: false,
        error: error.message || "Unknown error"
      }, "*");
    }
  }
  
  // Function to get allocations
  async function getAllocations(payload) {
    try {
      console.log("[TTC Inpage] 📊 Getting allocations...");
      console.log("[TTC Inpage] Token Address:", payload.tokenAddress);
      console.log("[TTC Inpage] Wallet Address:", payload.walletAddress);
      
      // Wait for web3 to be available
      if (!window.solanaWeb3) {
        console.log("[TTC Inpage] Waiting for Solana libraries to load...");
        await new Promise((resolve, reject) => {
          let attempts = 0;
          const maxAttempts = 100; // 10 seconds total (100 * 100ms)
          
          const checkInterval = setInterval(() => {
            attempts++;
            
            if (window.solanaWeb3) {
              console.log(`[TTC Inpage] ✅ Libraries loaded after ${attempts * 100}ms`);
              clearInterval(checkInterval);
              resolve();
            } else if (attempts >= maxAttempts) {
              clearInterval(checkInterval);
              console.error("[TTC Inpage] ❌ Library not found:", {
                solanaWeb3: !!window.solanaWeb3
              });
              reject(new Error("Solana web3.js library failed to load"));
            }
          }, 100);
        });
      }
      
      console.log("[TTC Inpage] ✅ Solana libraries are available");
      
      // Get web3.js from global window object (injected by IIFE)
      const { PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } = window.solanaWeb3;
      
      // Define SPL Token program IDs manually (no need for spl-token library)
      const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
      const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
      
      // Check for wallet
      let provider = null;
      
      if (window.phantom?.solana?.isConnected) {
        provider = window.phantom.solana;
      } else if (window.solana?.isPhantom && window.solana?.isConnected) {
        provider = window.solana;
      } else if (window.backpack?.isConnected) {
        provider = window.backpack;
      } else if (window.solflare?.isConnected) {
        provider = window.solflare;
      }
      
      if (!provider || !provider.isConnected) {
        throw new Error("Wallet not connected");
      }
      
      const walletPublicKey = provider.publicKey;
      console.log("[TTC Inpage] ✅ Wallet connected:", walletPublicKey.toString());
      
      // Validate program ID
      if (!payload.programId) {
        throw new Error("⚠️ Program ID not configured!");
      }
      
      const PROGRAM_ID = new PublicKey(payload.programId);
      const tokenMint = new PublicKey(payload.tokenAddress);
      
      // Derive PDAs using TextEncoder (browser-safe alternative to Buffer)
      const textEncoder = new TextEncoder();
      
      const [factoryConfigPda] = PublicKey.findProgramAddressSync(
        [textEncoder.encode("factory_config_v2")],
        PROGRAM_ID
      );
      
      console.log("[TTC Inpage] 📍 Factory Config PDA:", factoryConfigPda.toString());
      
      // Get sale_authority from payload
      let saleConfigAuthority = null;
      let saleConfigPda = null;
      
      if (payload.saleAuthority && payload.saleAuthority.trim() !== "") {
        console.log("[TTC Inpage] ✅ Using sale_authority from token data:", payload.saleAuthority);
        saleConfigAuthority = new PublicKey(payload.saleAuthority);
      } else {
        // Fallback: Try to derive using the wallet as authority (in case it's the creator)
        console.log("[TTC Inpage] ⚠️ No sale_authority provided, trying wallet as authority");
        saleConfigAuthority = walletPublicKey;
      }
      
      // Derive saleConfig PDA using the authority
      [saleConfigPda] = PublicKey.findProgramAddressSync(
        [
          textEncoder.encode("sale_config"),
          saleConfigAuthority.toBuffer(),
          tokenMint.toBuffer()
        ],
        PROGRAM_ID
      );
      
      console.log("[TTC Inpage] 📍 Sale Config Authority:", saleConfigAuthority.toString());
      console.log("[TTC Inpage] 📍 Sale Config PDA:", saleConfigPda.toString());
      
      // Derive recipient token account (ATA)
      const customSeed = new Uint8Array([
        6, 221, 246, 225, 215, 101, 161, 147, 217, 203, 225, 70, 206, 235, 121,
        172, 28, 180, 133, 237, 95, 91, 55, 145, 58, 140, 245, 133, 126, 255, 0, 169
      ]);
      const customProgramId = new PublicKey([
        140, 151, 37, 143, 78, 36, 137, 241, 187, 61, 16, 41, 20, 142, 13, 131,
        11, 90, 19, 153, 218, 255, 16, 132, 4, 142, 123, 216, 219, 233, 248, 89
      ]);
      
      const [recipientTokenAccountPda] = PublicKey.findProgramAddressSync(
        [
          walletPublicKey.toBuffer(),
          customSeed,
          tokenMint.toBuffer()
        ],
        customProgramId
      );
      
      console.log("[TTC Inpage] 📍 Recipient Token Account PDA:", recipientTokenAccountPda.toString());
      
      // Derive KOL PDAs (optional - only for KOL phase)
      const [kolDataPda] = PublicKey.findProgramAddressSync(
        [
          textEncoder.encode("kol_data"),
          walletPublicKey.toBuffer(),
          tokenMint.toBuffer()
        ],
        PROGRAM_ID
      );
      
      const [kolMasterPda] = PublicKey.findProgramAddressSync(
        [textEncoder.encode("kol_master_v2"), walletPublicKey.toBuffer()],
        PROGRAM_ID
      );
      
      // Derive public user data PDA
      const [publicUserDataPda] = PublicKey.findProgramAddressSync(
        [
          textEncoder.encode("public_user_data"),
          walletPublicKey.toBuffer(),
          tokenMint.toBuffer()
        ],
        PROGRAM_ID
      );
      
      console.log("[TTC Inpage] 📍 KOL Data PDA:", kolDataPda.toString());
      console.log("[TTC Inpage] 📍 KOL Master PDA:", kolMasterPda.toString());
      console.log("[TTC Inpage] 📍 Public User Data PDA:", publicUserDataPda.toString());
      
      // Find the get_allocations instruction in IDL
      const getAllocationsInstruction = payload.idl.instructions.find(
        ix => ix.name === "get_allocations" || ix.name === "getAllocations"
      );
      
      if (!getAllocationsInstruction || !getAllocationsInstruction.discriminator) {
        throw new Error("Could not find get_allocations in IDL");
      }
      
      const discriminator = new Uint8Array(getAllocationsInstruction.discriminator);
      console.log("[TTC Inpage] 🔍 Get Allocations discriminator:", Array.from(discriminator));
      
      // Build instruction data (only discriminator, no parameters)
      const instructionData = new Uint8Array(8);
      instructionData.set(discriminator, 0);
      
      console.log("[TTC Inpage] 📦 Instruction data:", Array.from(instructionData));
      
      // Determine if we're in KOL phase based on payload
      const isKolPhase = payload.phase === "kol";
      console.log("[TTC Inpage] 📍 Is KOL phase:", isKolPhase);
      
      // Create the instruction with accounts (matching IDL order!)
      const instruction = {
        programId: PROGRAM_ID,
        keys: [
          { pubkey: tokenMint, isSigner: false, isWritable: false }, // token_mint
          { pubkey: saleConfigPda, isSigner: false, isWritable: false }, // sale_config
          { pubkey: walletPublicKey, isSigner: false, isWritable: false }, // user
          { pubkey: kolDataPda, isSigner: false, isWritable: false }, // kol_data (optional)
          { pubkey: kolMasterPda, isSigner: false, isWritable: false }, // kol_master (optional)
          { pubkey: publicUserDataPda, isSigner: false, isWritable: false } // public_user_data (optional)
        ],
        data: instructionData
      };
      
      // Get latest blockhash
      console.log("[TTC Inpage] Getting latest blockhash for simulation...");
      const blockhashData = await solanaRpc("getLatestBlockhash", [{ commitment: "finalized" }]);
      const recentBlockhash = blockhashData.result.value.blockhash;
      
      // Create a transaction
      const transaction = new Transaction();
      transaction.recentBlockhash = recentBlockhash;
      transaction.feePayer = walletPublicKey;
      transaction.add(instruction);
      
      // Serialize the transaction
      const serialized = transaction.serialize({ requireAllSignatures: false, verifySignatures: false });
      const base64Tx = btoa(String.fromCharCode.apply(null, serialized));
      
      // Simulate the transaction to get return data
      console.log("[TTC Inpage] 🎬 Simulating get_allocations view method...");
      const simulation = await solanaRpc("simulateTransaction", [
        base64Tx,
        {
          encoding: "base64",
          commitment: "processed"
        }
      ]);
      
      console.log("[TTC Inpage] 📊 Simulation result:", simulation);
      
      if (simulation.result.value.err) {
        throw new Error(`Simulation failed: ${JSON.stringify(simulation.result.value.err)}`);
      }
      
      // Parse the return data from simulation
      if (!simulation.result.value.returnData) {
        throw new Error("No return data from simulation");
      }
      
      const returnDataBase64 = simulation.result.value.returnData.data[0];
      const returnDataBytes = Uint8Array.from(atob(returnDataBase64), c => c.charCodeAt(0));
      
      console.log("[TTC Inpage] 📥 Return data bytes:", Array.from(returnDataBytes));
      console.log("[TTC Inpage] 📏 Return data length:", returnDataBytes.length);
      
      // Parse allocation summary from return data
      // Based on your code: kolPersonalRemaining, publicUserSolRemaining, globalKol/PublicAllocation/Sold/Remaining
      // Assuming the return structure is: [u64; 8] = 64 bytes total
      const returnView = new DataView(returnDataBytes.buffer);
      
      // Get token decimals to convert - ALL values use the SAME decimals
      const mintInfo = await solanaRpc("getAccountInfo", [
        tokenMint.toString(),
        { encoding: "jsonParsed" }
      ]);
      
      const decimals = mintInfo.result.value.data.parsed.info.decimals;
      const divisor = Math.pow(10, decimals);
      
      console.log("[TTC Inpage] 🔢 Token decimals:", decimals);
      console.log("[TTC Inpage] 📏 Parsing 11 fields from AllocationSummary struct:");
      
      // ✅ Parse ALL 11 fields from IDL in correct order
      const kolPersonalAllocation = Number(returnView.getBigUint64(0, true));
      const kolPersonalClaimed = Number(returnView.getBigUint64(8, true));
      const kolPersonalRemaining = Number(returnView.getBigUint64(16, true));
      const kolGlobalAllocation = Number(returnView.getBigUint64(24, true));
      const kolGlobalSold = Number(returnView.getBigUint64(32, true));
      const kolGlobalRemaining = Number(returnView.getBigUint64(40, true));
      const publicGlobalAllocation = Number(returnView.getBigUint64(48, true));
      const publicGlobalSold = Number(returnView.getBigUint64(56, true));
      const publicGlobalRemaining = Number(returnView.getBigUint64(64, true));
      const publicUserSolSpent = Number(returnView.getBigUint64(72, true));
      const publicUserSolRemaining = Number(returnView.getBigUint64(80, true));
      
      console.log("  Raw [0] kolPersonalAllocation:", kolPersonalAllocation);
      console.log("  Raw [8] kolPersonalClaimed:", kolPersonalClaimed);
      console.log("  Raw [16] kolPersonalRemaining:", kolPersonalRemaining);
      console.log("  Raw [24] kolGlobalAllocation:", kolGlobalAllocation);
      console.log("  Raw [32] kolGlobalSold:", kolGlobalSold);
      console.log("  Raw [40] kolGlobalRemaining:", kolGlobalRemaining);
      console.log("  Raw [48] publicGlobalAllocation:", publicGlobalAllocation);
      console.log("  Raw [56] publicGlobalSold:", publicGlobalSold);
      console.log("  Raw [64] publicGlobalRemaining:", publicGlobalRemaining);
      console.log("  Raw [72] publicUserSolSpent:", publicUserSolSpent);
      console.log("  Raw [80] publicUserSolRemaining:", publicUserSolRemaining);
      
      // Convert using parseFloat and same decimals for all (matching your Anchor code)
      const kolPersonalRemainingConverted = parseFloat(kolPersonalRemaining.toString()) / divisor;
      const publicUserSolRemainingConverted = parseFloat(publicUserSolRemaining.toString()) / divisor;
      const kolGlobalAllocationConverted = parseFloat(kolGlobalAllocation.toString()) / divisor;
      const kolGlobalSoldConverted = parseFloat(kolGlobalSold.toString()) / divisor;
      const kolGlobalRemainingConverted = parseFloat(kolGlobalRemaining.toString()) / divisor;
      const publicGlobalAllocationConverted = parseFloat(publicGlobalAllocation.toString()) / divisor;
      const publicGlobalSoldConverted = parseFloat(publicGlobalSold.toString()) / divisor;
      const publicGlobalRemainingConverted = parseFloat(publicGlobalRemaining.toString()) / divisor;
      
      console.log("[TTC Inpage] ✅ Allocation summary:");
      console.log("  KOL Personal Remaining:", kolPersonalRemainingConverted);
      console.log("  Public User SOL Remaining:", publicUserSolRemainingConverted);
      console.log("  Global KOL Allocation:", kolGlobalAllocationConverted);
      console.log("  Global KOL Sold:", kolGlobalSoldConverted);
      console.log("  Global KOL Remaining:", kolGlobalRemainingConverted);
      console.log("  Global Public Allocation:", publicGlobalAllocationConverted);
      console.log("  Global Public Sold:", publicGlobalSoldConverted);
      console.log("  Global Public Remaining:", publicGlobalRemainingConverted);
      
      // Send success response
      window.postMessage({
        source: "TTC_INPAGE",
        type: "GET_ALLOCATIONS_RESPONSE",
        success: true,
        allocations: {
          personalKolRemaining: kolPersonalRemainingConverted,
          personalPublicRemaining: publicUserSolRemainingConverted,
          globalKolAllocation: kolGlobalAllocationConverted,
          globalKolSold: kolGlobalSoldConverted,
          globalKolRemaining: kolGlobalRemainingConverted,
          globalPublicAllocation: publicGlobalAllocationConverted,
          globalPublicSold: publicGlobalSoldConverted,
          globalPublicRemaining: publicGlobalRemainingConverted
        }
      }, "*");
      
    } catch (error) {
      console.error("[TTC Inpage] ❌ Get Allocations error:", error);
      window.postMessage({
        source: "TTC_INPAGE",
        type: "GET_ALLOCATIONS_ERROR",
        success: false,
        error: error.message || "Unknown error"
      }, "*");
    }
  }
  
  // Function to get SOL balance
  async function getSolBalance(payload) {
    try {
      console.log("[TTC Inpage] 💰 Getting SOL balance...");
      console.log("[TTC Inpage] Wallet Address:", payload.walletAddress);
      
      // Wait for web3 to be available
      if (!window.solanaWeb3) {
        console.log("[TTC Inpage] Waiting for Solana libraries to load...");
        await new Promise((resolve, reject) => {
          let attempts = 0;
          const maxAttempts = 100; // 10 seconds total (100 * 100ms)
          
          const checkInterval = setInterval(() => {
            attempts++;
            
            if (window.solanaWeb3) {
              console.log(`[TTC Inpage] ✅ Libraries loaded after ${attempts * 100}ms`);
              clearInterval(checkInterval);
              resolve();
            } else if (attempts >= maxAttempts) {
              clearInterval(checkInterval);
              console.error("[TTC Inpage] ❌ Library not found:", {
                solanaWeb3: !!window.solanaWeb3
              });
              reject(new Error("Solana web3.js library failed to load"));
            }
          }, 100);
        });
      }
      
      console.log("[TTC Inpage] ✅ Solana libraries are available");
      
      // Get web3.js from global window object (injected by IIFE)
      const { PublicKey, LAMPORTS_PER_SOL } = window.solanaWeb3;
      
      // Check for wallet
      let provider = null;
      
      if (window.phantom?.solana?.isConnected) {
        provider = window.phantom.solana;
      } else if (window.solana?.isPhantom && window.solana?.isConnected) {
        provider = window.solana;
      } else if (window.backpack?.isConnected) {
        provider = window.backpack;
      } else if (window.solflare?.isConnected) {
        provider = window.solflare;
      }
      
      if (!provider || !provider.isConnected) {
        throw new Error("Wallet not connected");
      }
      
      const walletPublicKey = provider.publicKey;
      console.log("[TTC Inpage] ✅ Wallet connected:", walletPublicKey.toString());
      
      // Get SOL balance using RPC
      console.log("[TTC Inpage] Getting SOL balance...");
      const balanceData = await solanaRpc("getBalance", [walletPublicKey.toString()]);
      
      if (balanceData.error) {
        throw new Error(balanceData.error.message || "Failed to get SOL balance");
      }
      
      const lamports = balanceData.result.value;
      const balance = lamports / LAMPORTS_PER_SOL;
      console.log("[TTC Inpage] ✅ SOL balance:", balance, "SOL");
      
      // Send success response
      window.postMessage({
        source: "TTC_INPAGE",
        type: "GET_SOL_BALANCE_RESPONSE",
        success: true,
        balance: balance
      }, "*");
      
    } catch (error) {
      console.error("[TTC Inpage] ❌ Get SOL Balance error:", error);
      window.postMessage({
        source: "TTC_INPAGE",
        type: "GET_SOL_BALANCE_ERROR",
        success: false,
        error: error.message || "Unknown error"
      }, "*");
    }
  }
})();