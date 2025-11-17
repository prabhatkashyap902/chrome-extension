// Inpage script - uses IIFE bundles (window.solanaWeb3 and window.anchor)
(function() {
  console.log("[TTC Inpage] Script loaded");
  
  let rpcId = 0;
  const pendingRpcCalls = {};
  
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
})();