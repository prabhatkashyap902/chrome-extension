// Content script - runs on x.com/twitter.com
console.log("[TTC Content] Script loaded");

// CRITICAL: Store chrome reference immediately before it can be overwritten by page scripts
const extensionChrome = typeof chrome !== 'undefined' && chrome.runtime ? chrome : (typeof browser !== 'undefined' ? browser : null);

if (!extensionChrome) {
  console.error("[TTC Content] ❌ Extension APIs not available!");
}

// Create safe chrome object to use throughout the script
const safeChrome = {
  storage: extensionChrome?.storage,
  runtime: extensionChrome?.runtime
};

// Cache for tokens to avoid excessive API calls
let tokensCache = [];
let tokensCacheTime = 0;
const CACHE_DURATION = 60000; // 1 minute cache

// Fetch tokens from API
async function fetchTokens() {
  // Use cache if it's still fresh
  const now = Date.now();
  if (tokensCache.length > 0 && (now - tokensCacheTime) < CACHE_DURATION) {
    console.log("[TTC Content] 📦 Using cached tokens");
    return tokensCache;
  }
  
  try {
    console.log("[TTC Content] 🔄 Fetching tokens from API...");
    const response = await fetch("https://dev.api.icm.social/api/public/tokens/");
    const data = await response.json();
    
    if (data && data.tokens && Array.isArray(data.tokens)) {
      tokensCache = data.tokens;
      tokensCacheTime = now;
      console.log(`[TTC Content] ✅ Cached ${tokensCache.length} tokens`);
      return tokensCache;
    }
  } catch (error) {
    console.error("[TTC Content] ❌ Error fetching tokens:", error);
  }
  
  return [];
}

// Check if a token exists for this tweet URL
async function checkTokenExists(tweetUrl) {
  if (!tweetUrl) return null;
  
  const tokens = await fetchTokens();
  
  // Normalize tweet URL for comparison (remove query params)
  const normalizedUrl = tweetUrl.replace(/\?.*$/, '').toLowerCase();
  
  for (const token of tokens) {
    if (token.x_link) {
      const tokenUrl = token.x_link.replace(/\?.*$/, '').toLowerCase();
      if (tokenUrl === normalizedUrl) {
        console.log("[TTC Content] ✅ Token exists for tweet:", token.token_address);
        return token;
      }
    }
  }
  
  return null;
}

// Inject Solana libraries (IIFE bundles) and inpage script
function injectInpage() {
  if (document.getElementById("__ttc_libs_injected")) return;
  
  // Mark as injected
  const marker = document.createElement("div");
  marker.id = "__ttc_libs_injected";
  marker.style.display = "none";
  document.documentElement.appendChild(marker);
  
  // Inject Solana web3.js IIFE bundle
  const web3Script = document.createElement("script");
  web3Script.src = safeChrome.runtime.getURL("libs/web3.iife.js");
  web3Script.onload = () => {
    console.log("[TTC Content] ✅ Solana web3.js loaded");
    
    // Inject our inpage script
    const inpageScript = document.createElement("script");
    inpageScript.src = safeChrome.runtime.getURL("inpage.js");
    inpageScript.id = "__ttc_inpage";
    inpageScript.onload = () => {
      console.log("[TTC Content] ✅ Inpage script loaded");
    };
    document.documentElement.appendChild(inpageScript);
  };
  document.documentElement.appendChild(web3Script);
}

// Get logged-in user's username
function getMyUsername() {
  const profileLink = document.querySelector('a[data-testid="AppTabBar_Profile_Link"]');
  if (!profileLink) return null;
  
  const href = profileLink.getAttribute("href");
  if (!href || !href.startsWith("/")) return null;
  
  const username = href.split("/").filter(Boolean)[0];
  return username || null;
}

// Get tweet author username
function getTweetAuthor(tweetElement) {
  const userNameContainer = tweetElement.querySelector('div[data-testid="User-Name"]');
  if (!userNameContainer) return null;
  
  const handleSpan = Array.from(userNameContainer.querySelectorAll("span"))
    .map(s => s.textContent.trim())
    .find(txt => txt.startsWith("@"));
  
  if (!handleSpan) return null;
  return handleSpan.replace("@", "").trim();
}

// Get tweet images
async function getTweetImages(tweetElement) {
  const images = [];
  
  // Find all images in the tweet
  const imgElements = tweetElement.querySelectorAll('img[src*="pbs.twimg.com/media"]');
  
  for (const img of imgElements) {
    try {
      // Get the image URL and convert to higher quality
      let imgUrl = img.src;
      
      // Replace with original size image
      imgUrl = imgUrl.replace(/&name=\w+/, '&name=large');
      
      console.log("[TTC Content] 📷 Found tweet image:", imgUrl);
      
      // Fetch the image and convert to blob
      const response = await fetch(imgUrl);
      const blob = await response.blob();
      
      // Convert blob to base64 for message passing
      const base64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });
      
      images.push({
        url: imgUrl,
        base64: base64,
        filename: `tweet_image_${Date.now()}_${images.length}.jpg`,
        type: blob.type
      });
    } catch (error) {
      console.error("[TTC Content] ❌ Error fetching image:", error);
    }
  }
  
  return images;
}

// Add "Create a token", "Visit Token", or "Buy/Sell Token" button to tweets
async function addTokenButton(tweetElement) {
  // Skip if already added
  if (tweetElement.dataset.ttcProcessed) return;
  tweetElement.dataset.ttcProcessed = "true";
  
  const author = getTweetAuthor(tweetElement);
  if (!author) return;
  
  // Get my username from storage
  safeChrome.storage.local.get("myUsername", async (data) => {
    const myUsername = data.myUsername;
    if (!myUsername) return;
    
    const isMyTweet = author.toLowerCase() === myUsername.toLowerCase();
    
    console.log(`[TTC Content] Processing tweet by @${author} (Mine: ${isMyTweet})`);
    
    // Get tweet text and URL
    const tweetTextElem = tweetElement.querySelector('[data-testid="tweetText"]');
    const tweetText = tweetTextElem ? tweetTextElem.textContent : "";
    
    const timeElem = tweetElement.querySelector("time");
    const tweetUrl = timeElem && timeElem.parentElement ? timeElem.parentElement.href : "";
    
    // Check if token already exists for this tweet
    const existingToken = await checkTokenExists(tweetUrl);
    
    // Logic for MY tweets
    if (isMyTweet) {
      // Create button
      const button = document.createElement("button");
      
      if (existingToken) {
        // Show "Visit Token" button
        button.textContent = "Visit Token";
        button.style.cssText = `
          position: absolute;
          top: 8px;
          right: 4.5rem;
          padding: 6px 12px;
          background: #1DA1F2;
          color: white;
          border: none;
          border-radius: 4px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          z-index: 10;
        `;
        
        button.onclick = () => {
          console.log("[TTC Content] 🔗 Visit Token clicked, opening:", `https://icm-social-app.vercel.app/t/${existingToken.token_address}`);
          window.open(`https://icm-social-app.vercel.app/t/${existingToken.token_address}`, '_blank');
        };
      } else {
        // Show "Create a token" button
        button.textContent = "Create a token";
        button.style.cssText = `
          position: absolute;
          top: 8px;
          right: 4.5rem;
          padding: 6px 12px;
          background: #3c3c3cff;
          color: white;
          border: none;
          border-radius: 4px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          z-index: 10;
        `;
        
        // Button click handler
        button.onclick = async () => {
          console.log("[TTC Content] 🔘 Create token button clicked");
          
          // Get tweet text and URL
          const tweetTextElem = tweetElement.querySelector('[data-testid="tweetText"]');
          const tweetText = tweetTextElem ? tweetTextElem.textContent : "";
          
          const timeElem = tweetElement.querySelector("time");
          const tweetUrl = timeElem && timeElem.parentElement ? timeElem.parentElement.href : "";
          
          // Extract tweet images
          console.log("[TTC Content] 📷 Extracting tweet images...");
          const tweetImages = await getTweetImages(tweetElement);
          console.log(`[TTC Content] Found ${tweetImages.length} image(s) in tweet`);
          
          // Generate token name and symbol from tweet
          const tokenName = tweetText.slice(0, 10) || "My Token";
          const tokenSymbol = (tweetText.slice(0, 4).toUpperCase().replace(/[^A-Z]/g, '') || "TKN");
          const tokenDescription = tweetText || "Token created from tweet";
          
          // Store tweet data for popup to use
          safeChrome.storage.local.set({
            tweetData: {
              tweetText,
              tweetUrl,
              tokenName,
              tokenSymbol,
              tokenDescription,
              tweetImages: tweetImages.map(img => ({
                url: img.url,
                base64: img.base64,
                filename: img.filename,
                type: img.type
              }))
            },
            buySellTokenData: null,  // ✅ Clear buy/sell data when switching to create mode
            status: "Ready to create token",
            error: "",
            txHash: "",  // Clear old transaction hash
            tokenMint: ""  // Clear old token mint
          }, () => {
            console.log("[TTC Content] ✅ Tweet data stored, opening popup...");
            // Open popup
            safeChrome.runtime.sendMessage({ action: "OPEN_POPUP" });
          });
        };
      }
      
      tweetElement.style.position = "relative";
      tweetElement.appendChild(button);
    } 
    // Logic for OTHERS' tweets
    else {
      // Only show button if token exists
      if (existingToken) {
        const button = document.createElement("button");
        button.textContent = "Buy/Sell Token";
        button.style.cssText = `
          position: absolute;
          top: 8px;
          right: 4.5rem;
          padding: 6px 12px;
          background: #10B981;
          color: white;
          border: none;
          border-radius: 4px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          z-index: 10;
        `;
        
        button.onclick = () => {
          console.log("[TTC Content] 💰 Buy/Sell Token clicked for:", existingToken.token_address);
          
          // Save token data to storage for the popup
          safeChrome.storage.local.set({
            buySellTokenData: {
              tokenAddress: existingToken.token_address,
              name: existingToken.name,
              symbol: existingToken.symbol,
              image: existingToken.token_image_url, // Correct field
              marketCap: existingToken.total_usd_raised || 0, // Correct field
              price: existingToken.last_trade_price_usd || 0, // Correct field
              phase: existingToken.phase || existingToken.sale_phase || "public", // Add phase
              creatorUsername: author,
              saleAuthority: existingToken.sale_authority || existingToken.creator_wallet || "" // ⚠️ YOU NEED TO ADD THIS TO YOUR API!
            },
            tweetData: null, // Clear any existing tweet data
            txHash: "", // Clear any transaction hash
            tokenMint: "" // Clear any token mint
          }, () => {
            console.log("[TTC Content] ✅ Token data saved to storage");
            
            // Try to open the popup
            safeChrome.runtime.sendMessage({ action: "OPEN_POPUP" });
            
            // Show a notification that data is ready
            button.textContent = "✓ Opening...";
            button.style.background = "#059669";
            setTimeout(() => {
              button.textContent = "Buy/Sell Token";
              button.style.background = "#10B981";
            }, 2000);
          });
        };
        
        tweetElement.style.position = "relative";
        tweetElement.appendChild(button);
      }
      // If no token exists for others' tweets, don't show anything
    }
  });
}

// Watch for tweets being added to the page
const observer = new MutationObserver(() => {
  const tweets = document.querySelectorAll('article[data-testid="tweet"]');
  tweets.forEach(addTokenButton);
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});

// Process existing tweets
setTimeout(() => {
  const tweets = document.querySelectorAll('article[data-testid="tweet"]');
  tweets.forEach(addTokenButton);
}, 1000);

// Store my username
setTimeout(() => {
  const myUsername = getMyUsername();
  if (myUsername) {
    console.log("[TTC Content] My username:", myUsername);
    safeChrome.storage.local.set({ myUsername });
  }
}, 1500);

// Inject libraries and inpage script immediately on page load
setTimeout(() => {
  console.log("[TTC Content] 🚀 Injecting libraries and inpage script...");
  injectInpage();
}, 100);

// Listen for messages from inpage
window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  if (!event.data || !event.data.source) return;
  
  // Handle RPC requests from inpage
  if (event.data.source === "TTC_INPAGE" && event.data.type === "RPC_REQUEST") {
    handleRpcRequest(event.data);
    return;
  }
  
  // Handle metadata upload requests from inpage
  if (event.data.source === "TTC_INPAGE" && event.data.type === "METADATA_UPLOAD_REQUEST") {
    handleMetadataUpload(event.data);
    return;
  }
  
  // Handle success
  if (event.data.source === "TTC_INPAGE" && event.data.type === "TOKEN_CREATED") {
    console.log("[TTC Content] 🎉 Token created successfully!");
    
    // Clear cache to force refresh on next check
    tokensCache = [];
    tokensCacheTime = 0;
    
    safeChrome.storage.local.set({
      status: "success",
      walletAddress: event.data.walletAddress,
      txHash: event.data.txHash,
      tokenName: event.data.tokenName,
      tokenSymbol: event.data.tokenSymbol,
      tokenMint: event.data.tokenMint,
      error: ""
    });
    safeChrome.runtime.sendMessage({ action: "OPEN_POPUP" });
    
    // Refresh the page after 3 seconds to show the new "Visit Token" button
    console.log("[TTC Content] 🔄 Page will refresh in 3 seconds to update button...");
    setTimeout(() => {
      window.location.reload();
    }, 3000);
  }
  
  // Handle error
  if (event.data.source === "TTC_INPAGE" && event.data.type === "TOKEN_ERROR") {
    console.error("[TTC Content] ❌ Token creation failed:", event.data.error);
    safeChrome.storage.local.set({
      status: "error",
      error: event.data.error
    });
    safeChrome.runtime.sendMessage({ action: "OPEN_POPUP" });
  }
  
  // Estimation feature removed - requires Anchor library
  // Handle estimation response handler also removed
  
  // Handle wallet connection response from inpage
  if (event.data.source === "TTC_INPAGE" && event.data.type === "WALLET_CONNECTED") {
    console.log("[TTC Content] ✅ Wallet connected:", event.data.walletAddress);
    if (window.__connectWalletCallback) {
      window.__connectWalletCallback({
        success: true,
        walletAddress: event.data.walletAddress
      });
      delete window.__connectWalletCallback;
    }
  }
  
  // Handle wallet connection error from inpage
  if (event.data.source === "TTC_INPAGE" && event.data.type === "WALLET_ERROR") {
    console.error("[TTC Content] ❌ Wallet connection failed:", event.data.error);
    if (window.__connectWalletCallback) {
      window.__connectWalletCallback({
        success: false,
        error: event.data.error
      });
      delete window.__connectWalletCallback;
    }
  }
  
  // Handle estimation response from inpage
  if (event.data.source === "TTC_INPAGE" && event.data.type === "TOKEN_ESTIMATION_RESPONSE") {
    console.log("[TTC Content] 📊 Estimation response received:", event.data);
    if (window.__estimateTokensCallback) {
      window.__estimateTokensCallback({
        success: true,
        data: event.data
      });
      delete window.__estimateTokensCallback;
    }
  }
  
  // Handle estimation error from inpage
  if (event.data.source === "TTC_INPAGE" && event.data.type === "ESTIMATE_TOKENS_ERROR") {
    console.error("[TTC Content] ❌ Estimation failed:", event.data.error);
    if (window.__estimateTokensCallback) {
      window.__estimateTokensCallback({
        success: false,
        error: event.data.error
      });
      delete window.__estimateTokensCallback;
    }
  }
  
  // Handle buy/sell token response from inpage
  if (event.data.source === "TTC_INPAGE" && event.data.type === "BUY_SELL_TOKEN_RESPONSE") {
    console.log("[TTC Content] 💰 Buy/Sell token response received:", event.data);
    if (window.__buySellTokenCallback) {
      window.__buySellTokenCallback({
        success: true,
        data: event.data
      });
      delete window.__buySellTokenCallback;
    }
  }
  
  // Handle buy/sell token error from inpage
  if (event.data.source === "TTC_INPAGE" && event.data.type === "BUY_SELL_TOKEN_ERROR") {
    console.error("[TTC Content] ❌ Buy/Sell token failed:", event.data.error);
    if (window.__buySellTokenCallback) {
      window.__buySellTokenCallback({
        success: false,
        error: event.data.error
      });
      delete window.__buySellTokenCallback;
    }
  }
  
  // Handle get token balance response from inpage
  if (event.data.source === "TTC_INPAGE" && event.data.type === "GET_TOKEN_BALANCE_RESPONSE") {
    console.log("[TTC Content] 💼 Get token balance response received:", event.data);
    if (window.__getTokenBalanceCallback) {
      window.__getTokenBalanceCallback({
        success: true,
        balance: event.data.balance
      });
      delete window.__getTokenBalanceCallback;
    }
  }
  
  // Handle get token balance error from inpage
  if (event.data.source === "TTC_INPAGE" && event.data.type === "GET_TOKEN_BALANCE_ERROR") {
    console.error("[TTC Content] ❌ Get token balance failed:", event.data.error);
    if (window.__getTokenBalanceCallback) {
      window.__getTokenBalanceCallback({
        success: false,
        error: event.data.error,
        balance: 0
      });
      delete window.__getTokenBalanceCallback;
    }
  }
  
  // Handle get allocations response from inpage
  if (event.data.source === "TTC_INPAGE" && event.data.type === "GET_ALLOCATIONS_RESPONSE") {
    console.log("[TTC Content] 📊 Get allocations response received:", event.data);
    if (window.__getAllocationsCallback) {
      window.__getAllocationsCallback({
        success: true,
        allocations: event.data.allocations
      });
      delete window.__getAllocationsCallback;
    }
  }
  
  // Handle get allocations error from inpage
  if (event.data.source === "TTC_INPAGE" && event.data.type === "GET_ALLOCATIONS_ERROR") {
    console.error("[TTC Content] ❌ Get allocations failed:", event.data.error);
    if (window.__getAllocationsCallback) {
      window.__getAllocationsCallback({
        success: false,
        error: event.data.error,
        allocations: []
      });
      delete window.__getAllocationsCallback;
    }
  }
});

// Listen for messages from popup
safeChrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "CONNECT_WALLET") {
    console.log("[TTC Content] 🔌 Connect wallet request:", request.walletType);
    
    // Inject inpage if not already done
    injectInpage();
    
    // Store callback
    window.__connectWalletCallback = sendResponse;
    
    // Wait for inpage to load then send message
    setTimeout(() => {
      window.postMessage({
        source: "TTC_CONTENT",
        type: "CONNECT_WALLET",
        walletType: request.walletType
      }, "*");
    }, 500);
    
    // Return true to indicate async response
    return true;
  }
  
  if (request.action === "CREATE_TOKEN_FROM_POPUP") {
    console.log("[TTC Content] 🚀 Create token from popup request");
    
    // Inject inpage if not already done
    injectInpage();
    
    // Wait for inpage to load then send message
    setTimeout(() => {
      window.postMessage({
        source: "TTC_CONTENT",
        type: "CREATE_TOKEN",
        payload: request.payload
      }, "*");
    }, 500);
    
    sendResponse({ success: true });
    return true;
  }
  
  if (request.action === "DISCONNECT_WALLET") {
    console.log("[TTC Content] 🔌 Disconnect wallet request");
    
    // Inject inpage if not already done
    injectInpage();
    
    // Wait for inpage to load then send message
    setTimeout(() => {
      window.postMessage({
        source: "TTC_CONTENT",
        type: "DISCONNECT_WALLET",
        walletType: request.walletType
      }, "*");
    }, 500);
    
    sendResponse({ success: true });
    return true;
  }
  
  if (request.action === "ESTIMATE_TOKENS") {
    console.log("[TTC Content] 📊 Estimate tokens request");
    
    // Inject inpage if not already done
    injectInpage();
    
    // Store callback for async response
    window.__estimateTokensCallback = sendResponse;
    
    // Wait for inpage to load then send message
    setTimeout(() => {
      window.postMessage({
        source: "TTC_CONTENT",
        type: "ESTIMATE_TOKENS",
        payload: request.payload
      }, "*");
    }, 500);
    
    // Return true to indicate async response
    return true;
  }
  
  if (request.action === "BUY_SELL_TOKEN") {
    console.log("[TTC Content] 💰 Buy/Sell token request");
    
    // Inject inpage if not already done
    injectInpage();
    
    // Store callback for async response
    window.__buySellTokenCallback = sendResponse;
    
    // Wait for inpage to load then send message - increased delay for library loading
    setTimeout(() => {
      window.postMessage({
        source: "TTC_CONTENT",
        type: "BUY_SELL_TOKEN",
        payload: request.payload
      }, "*");
    }, 1500); // Increased from 500ms to 1500ms
    
    // Return true to indicate async response
    return true;
  }
  
  if (request.action === "GET_TOKEN_BALANCE") {
    console.log("[TTC Content] 💼 Get token balance request");
    
    // Inject inpage if not already done
    injectInpage();
    
    // Store callback for async response
    window.__getTokenBalanceCallback = sendResponse;
    
    // Wait for inpage to load then send message - increased delay for library loading
    setTimeout(() => {
      window.postMessage({
        source: "TTC_CONTENT",
        type: "GET_TOKEN_BALANCE",
        payload: request.payload
      }, "*");
    }, 1500); // Increased from 500ms to 1500ms
    
    // Return true to indicate async response
    return true;
  }
  
  if (request.action === "GET_ALLOCATIONS") {
    console.log("[TTC Content] 📊 Get allocations request");
    
    // Inject inpage if not already done
    injectInpage();
    
    // Store callback for async response
    window.__getAllocationsCallback = sendResponse;
    
    // Wait for inpage to load then send message - increased delay for library loading
    setTimeout(() => {
      window.postMessage({
        source: "TTC_CONTENT",
        type: "GET_ALLOCATIONS",
        payload: request.payload
      }, "*");
    }, 1500); // Increased from 500ms to 1500ms
    
    // Return true to indicate async response
    return true;
  }
});

// Helper function to handle RPC requests
function handleRpcRequest(data) {
  safeChrome.runtime.sendMessage(
    { action: "SOLANA_RPC", payload: data.payload },
    (response) => {
      window.postMessage({
        source: "TTC_CONTENT",
        type: "RPC_RESPONSE",
        requestId: data.requestId,
        response
      }, "*");
    }
  );
}

// Helper function to handle metadata upload requests
function handleMetadataUpload(data) {
  console.log("[TTC Content] 📤 Handling metadata upload...");
  console.log("[TTC Content] 📋 API URL:", data.apiUrl);
  console.log("[TTC Content] 📋 Upload Data:", data.uploadData);
  
  // Forward to background script which has permission to make external requests
  safeChrome.runtime.sendMessage(
    { 
      action: "UPLOAD_METADATA", 
      apiUrl: data.apiUrl,
      uploadData: data.uploadData
    },
    (response) => {
      if (safeChrome.runtime.lastError) {
        console.error("[TTC Content] ❌ Chrome runtime error:", safeChrome.runtime.lastError);
        window.postMessage({
          source: "TTC_CONTENT",
          type: "METADATA_UPLOAD_RESPONSE",
          success: false,
          error: safeChrome.runtime.lastError.message
        }, "*");
        return;
      }
      
      if (!response) {
        console.error("[TTC Content] ❌ No response from background script");
        window.postMessage({
          source: "TTC_CONTENT",
          type: "METADATA_UPLOAD_RESPONSE",
          success: false,
          error: "No response from background script"
        }, "*");
        return;
      }
      
      console.log("[TTC Content] ✅ Metadata upload response:", response);
      window.postMessage({
        source: "TTC_CONTENT",
        type: "METADATA_UPLOAD_RESPONSE",
        ...response
      }, "*");
    }
  );
}