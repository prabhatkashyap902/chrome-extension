// Inpage script - uses IIFE bundles (window.solanaWeb3)
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
          // Timeout after 5 seconds
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
      const web3 = window.solanaWeb3;
      
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
      // if (!payload.programId || payload.programId === "CnfqUGYuKinSjAWU2abZBexMS3eHBG3vVKx9t5RR8mnu") {
      //   throw new Error("⚠️ Program ID not configured! Please update /public/idl.json line 90 with your actual Solana program ID from idl.metadata.address");
      // }
      
      // Get program ID from IDL
      const PROGRAM_ID = new web3.PublicKey("CnfqUGYuKinSjAWU2abZBexMS3eHBG3vVKx9t5RR8mnu");
      const METADATA_PROGRAM_ID = new web3.PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");
      const TOKEN_PROGRAM_ID = new web3.PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
      const ASSOCIATED_TOKEN_PROGRAM_ID = new web3.PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
      const RENT_SYSVAR = new web3.PublicKey("SysvarRent111111111111111111111111111111111");
      
      console.log("[TTC Inpage] Program ID:", PROGRAM_ID.toString());
      
      // Generate dummy metadata locally
      const metadata = {
        name: payload.tokenName,
        symbol: payload.tokenSymbol,
        description: `Token created from tweet: ${payload.tweetUrl}`,
        image: "https://via.placeholder.com/512x512.png?text=Token",
        external_url: payload.tweetUrl,
        attributes: [
          { trait_type: "Source", value: "Twitter/X" },
          { trait_type: "Tweet", value: payload.tweetUrl },
          { trait_type: "Created", value: new Date().toISOString() }
        ],
        properties: {
          files: [
            {
              uri: "https://via.placeholder.com/512x512.png?text=Token",
              type: "image/png"
            }
          ],
          category: "image"
        }
      };
      
      // Create dummy metadata URI (in production, upload to IPFS/Arweave)
      const metadataUri = "https://arweave.net/placeholder-metadata-uri";
      
      console.log("[TTC Inpage] 📦 Metadata:", metadata);
      console.log("[TTC Inpage] 📎 Metadata URI:", metadataUri);
      
      // Generate token mint keypair
      const tokenMint = web3.Keypair.generate();
      console.log("[TTC Inpage] 🪙 Token Mint:", tokenMint.publicKey.toString());
      
      // Derive PDAs
      const textEncoder = new TextEncoder();
      
      const [factoryConfigPda] = web3.PublicKey.findProgramAddressSync(
        [textEncoder.encode("factory_config_v2")],
        PROGRAM_ID
      );
      
      const [saleConfigPda] = web3.PublicKey.findProgramAddressSync(
        [
          textEncoder.encode("sale_config"),
          publicKey.toBuffer(),
          tokenMint.publicKey.toBuffer(),
        ],
        PROGRAM_ID
      );
      
      const [devTokenAccount] = web3.PublicKey.findProgramAddressSync(
        [
          publicKey.toBuffer(),
          TOKEN_PROGRAM_ID.toBuffer(),
          tokenMint.publicKey.toBuffer(),
        ],
        ASSOCIATED_TOKEN_PROGRAM_ID
      );
      
      const [metadataAccount] = web3.PublicKey.findProgramAddressSync(
        [
          textEncoder.encode("metadata"),
          METADATA_PROGRAM_ID.toBuffer(),
          tokenMint.publicKey.toBuffer(),
        ],
        METADATA_PROGRAM_ID
      );
      
      const [masterEditionAccount] = web3.PublicKey.findProgramAddressSync(
        [
          textEncoder.encode("metadata"),
          METADATA_PROGRAM_ID.toBuffer(),
          tokenMint.publicKey.toBuffer(),
          textEncoder.encode("edition"),
        ],
        METADATA_PROGRAM_ID
      );
      
      console.log("[TTC Inpage] 📍 PDAs derived:");
      console.log("  Factory Config:", factoryConfigPda.toString());
      console.log("  Sale Config:", saleConfigPda.toString());
      console.log("  Dev Token Account:", devTokenAccount.toString());
      console.log("  Metadata Account:", metadataAccount.toString());
      console.log("  Master Edition:", masterEditionAccount.toString());
      
      // Calculate discriminator for "create_token_sale"
      const discriminator = await calculateDiscriminator("global:create_token_sale");
      console.log("[TTC Inpage] 📝 Discriminator:", Array.from(discriminator));
      
      // Build instruction data for createTokenSale
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
      
      // Build the transaction
      const transaction = new web3.Transaction();
      transaction.recentBlockhash = recentBlockhash;
      transaction.feePayer = publicKey;
      
      // Add create token sale instruction
      const createTokenInstruction = new web3.TransactionInstruction({
        keys: [
          { pubkey: publicKey, isSigner: true, isWritable: true }, // dev_wallet
          { pubkey: factoryConfigPda, isSigner: false, isWritable: false }, // factory_config
          { pubkey: tokenMint.publicKey, isSigner: true, isWritable: true }, // token_mint
          { pubkey: saleConfigPda, isSigner: false, isWritable: true }, // sale_config
          { pubkey: devTokenAccount, isSigner: false, isWritable: true }, // dev_token_account
          { pubkey: metadataAccount, isSigner: false, isWritable: true }, // metadata_account
          { pubkey: masterEditionAccount, isSigner: false, isWritable: true }, // master_edition
          { pubkey: METADATA_PROGRAM_ID, isSigner: false, isWritable: false }, // token_metadata_program
          { pubkey: web3.SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // token_program
          { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // associated_token_program
          { pubkey: RENT_SYSVAR, isSigner: false, isWritable: false }, // rent
        ],
        programId: PROGRAM_ID,
        data: instructionData, // Already a Uint8Array, no need for Buffer
      });
      
      transaction.add(createTokenInstruction);
      
      // Partial sign with tokenMint keypair
      transaction.partialSign(tokenMint);
      console.log("[TTC Inpage] 🔐 Transaction partially signed with tokenMint");
      
      // Sign with Phantom wallet
      console.log("[TTC Inpage] 📤 Requesting signature from Phantom...");
      const signedTransaction = await provider.signTransaction(transaction);
      
      console.log("[TTC Inpage] ✅ Transaction signed by wallet");
      
      // Send transaction
      console.log("[TTC Inpage] 📡 Sending transaction to Solana devnet...");
      const serialized = signedTransaction.serialize();
      
      const sendResult = await solanaRpc("sendRawTransaction", [
        Array.from(serialized),
        { encoding: "base64", skipPreflight: false, preflightCommitment: "confirmed" }
      ]);
      
      const signature = sendResult.result;
      
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