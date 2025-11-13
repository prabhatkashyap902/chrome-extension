// Content script - runs on x.com/twitter.com
console.log("[TTC Content] Script loaded");

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
  web3Script.src = chrome.runtime.getURL("libs/web3.iife.js");
  web3Script.onload = () => {
    console.log("[TTC Content] ✅ Solana web3.js loaded");
    
    // Inject SPL Token IIFE bundle
    const splTokenScript = document.createElement("script");
    splTokenScript.src = chrome.runtime.getURL("libs/spl-token.iife.js");
    splTokenScript.onload = () => {
      console.log("[TTC Content] ✅ SPL Token loaded");
      
      // Finally inject our inpage script
      const inpageScript = document.createElement("script");
      inpageScript.src = chrome.runtime.getURL("inpage.js");
      inpageScript.id = "__ttc_inpage";
      inpageScript.onload = () => {
        console.log("[TTC Content] ✅ Inpage script loaded");
      };
      document.documentElement.appendChild(inpageScript);
    };
    document.documentElement.appendChild(splTokenScript);
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

// Add "Create a token" button to user's own tweets
function addTokenButton(tweetElement) {
  // Skip if already added
  if (tweetElement.dataset.ttcProcessed) return;
  tweetElement.dataset.ttcProcessed = "true";
  
  const author = getTweetAuthor(tweetElement);
  if (!author) return;
  
  // Get my username from storage
  chrome.storage.local.get("myUsername", (data) => {
    const myUsername = data.myUsername;
    
    // Only add button to MY tweets
    if (!myUsername || author.toLowerCase() !== myUsername.toLowerCase()) {
      return;
    }
    
    console.log("[TTC Content] Adding button to my tweet");
    
    // Get tweet text and URL
    const tweetTextElem = tweetElement.querySelector('[data-testid="tweetText"]');
    const tweetText = tweetTextElem ? tweetTextElem.textContent : "";
    
    const timeElem = tweetElement.querySelector("time");
    const tweetUrl = timeElem && timeElem.parentElement ? timeElem.parentElement.href : "";
    
    // Create button
    const button = document.createElement("button");
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
    
    tweetElement.style.position = "relative";
    tweetElement.appendChild(button);
    
    // Button click handler
    button.onclick = async () => {
      console.log("[TTC Content] 🔘 Create token button clicked");
      
      // Check if wallet is connected first
      chrome.storage.local.get(["walletAddress"], async (result) => {
        if (!result.walletAddress) {
          // Wallet not connected - open popup to show connect UI
          console.log("[TTC Content] ⚠️ Wallet not connected, opening popup...");
          chrome.storage.local.set({
            status: "Please connect your wallet first",
            error: "You need to connect a wallet before creating tokens"
          });
          chrome.runtime.sendMessage({ action: "OPEN_POPUP" });
          return;
        }
        
        // Wallet is connected, proceed with token creation
        // Generate token name and symbol from tweet
        const tokenName = tweetText.slice(0, 10) || "My Token";
        const tokenSymbol = (tweetText.slice(0, 4).toUpperCase().replace(/[^A-Z]/g, '') || "TKN");
        const tokenDescription = tweetText || "Token created from tweet";
        
        // Set status to creating
        chrome.storage.local.set({
          status: "Creating token...",
          txHash: "",
          tokenName: "",
          tokenSymbol: "",
          tokenMint: "",
          error: ""
        });
        
        // Open popup
        chrome.runtime.sendMessage({ action: "OPEN_POPUP" });
        
        try {
          // Extract tweet images
          console.log("[TTC Content] 📷 Extracting tweet images...");
          const tweetImages = await getTweetImages(tweetElement);
          console.log(`[TTC Content] Found ${tweetImages.length} image(s) in tweet`);
          
          // Load IDL
          const idlUrl = chrome.runtime.getURL("idl.json");
          const idlResponse = await fetch(idlUrl);
          const idl = await idlResponse.json();
          
          // ⚠️ REPLACE THIS WITH YOUR ACTUAL PROGRAM ID FROM YOUR SMART CONTRACT
          const PROGRAM_ID = "CnfqUGYuKinSjAWU2abZBexMS3eHBG3vVKx9t5RR8mnu";
          const API_URL = "https://dev.api.icm.social/api/tokens/upload-metadata-v2/";
          
          console.log("[TTC Content] Program ID:", PROGRAM_ID);
          console.log("[TTC Content] API URL:", API_URL);
          
          // Inject inpage script
          injectInpage();
          
          // Wait for inpage to load
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Send message to inpage to create token
          console.log("[TTC Content] 📤 Sending create token request to inpage...");
          window.postMessage({
            source: "TTC_CONTENT",
            type: "CREATE_TOKEN",
            payload: {
              tweetText,
              tweetUrl,
              tokenName,
              tokenSymbol,
              tokenDescription,
              tweetImages: tweetImages.map(img => ({
                url: img.url,
                filename: img.filename
              })),
              idl,
              programId: PROGRAM_ID,
              apiUrl: API_URL
            }
          }, "*");
          
        } catch (error) {
          console.error("[TTC Content] ❌ Error:", error);
          chrome.storage.local.set({
            status: "error",
            error: error.message
          });
        }
      });
    };
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
    chrome.storage.local.set({ myUsername });
  }
}, 1500);

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
    chrome.storage.local.set({
      status: "success",
      walletAddress: event.data.walletAddress,
      txHash: event.data.txHash,
      tokenName: event.data.tokenName,
      tokenSymbol: event.data.tokenSymbol,
      tokenMint: event.data.tokenMint,
      error: ""
    });
    chrome.runtime.sendMessage({ action: "OPEN_POPUP" });
  }
  
  // Handle error
  if (event.data.source === "TTC_INPAGE" && event.data.type === "TOKEN_ERROR") {
    console.error("[TTC Content] ❌ Token creation failed:", event.data.error);
    chrome.storage.local.set({
      status: "error",
      error: event.data.error
    });
    chrome.runtime.sendMessage({ action: "OPEN_POPUP" });
  }
  
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
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
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
  
  if (request.action === "DISCONNECT_WALLET") {
    console.log("[TTC Content] 🔌 Disconnect wallet request:", request.walletType);
    
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
});

// Helper function to handle RPC requests
function handleRpcRequest(data) {
  chrome.runtime.sendMessage(
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
  console.log("[TTC Content] 📋 FormData:", data.formData);
  
  // Forward to background script which has permission to make external requests
  chrome.runtime.sendMessage(
    { 
      action: "UPLOAD_METADATA", 
      apiUrl: data.apiUrl,
      formData: data.formData
    },
    (response) => {
      if (chrome.runtime.lastError) {
        console.error("[TTC Content] ❌ Chrome runtime error:", chrome.runtime.lastError);
        window.postMessage({
          source: "TTC_CONTENT",
          type: "METADATA_UPLOAD_RESPONSE",
          success: false,
          error: chrome.runtime.lastError.message
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
      
      console.log("[TTC Content] 📬 Metadata upload response:", response);
      window.postMessage({
        source: "TTC_CONTENT",
        type: "METADATA_UPLOAD_RESPONSE",
        success: response.success,
        metadata_url: response.metadata_url,
        error: response.error
      }, "*");
    }
  );
}