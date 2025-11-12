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
    
    // Handle CREATE_TOKEN request
    if (event.data.source === "TTC_CONTENT" && event.data.type === "CREATE_TOKEN") {
      await createToken(event.data.payload);
    }
  });
  
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
      
      // Check for Phantom wallet
      const provider = window.solana || window.phantom?.solana;
      if (!provider) {
        throw new Error("Phantom wallet not found. Please install Phantom.");
      }
      
      console.log("[TTC Inpage] Phantom found, connecting...");
      
      // Connect to Phantom
      const { publicKey } = await provider.connect();
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
      
      // Generate dummy metadata locally (in production, upload to backend)
      const metadataUri = "https://arweave.net/placeholder-" + Date.now();
      
      console.log("[TTC Inpage] 📎 Metadata URI:", metadataUri);
      
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
          publicKey.toBuffer(),
          tokenMint.publicKey.toBuffer(),
        ],
        PROGRAM_ID
      );
      
      const [devTokenAccount] = PublicKey.findProgramAddressSync(
        [
          publicKey.toBuffer(),
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
        payload.tokenName,
        payload.tokenSymbol,
        metadataUri,
        0.1 // 0.1 SOL initial buy
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
      transaction.feePayer = publicKey;
      
      // Add instruction
      const createTokenInstruction = {
        keys: [
          { pubkey: publicKey, isSigner: true, isWritable: true },
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
      
      // Sign with Phantom wallet
      console.log("[TTC Inpage] 📤 Requesting signature from Phantom...");
      const signedTransaction = await provider.signTransaction(transaction);
      
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
})();