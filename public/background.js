// Background service worker
console.log("[TTC Background] Service worker started");

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Open popup
  if (message.action === "OPEN_POPUP") {
    chrome.action.openPopup();
    return;
  }

  // Proxy Solana RPC requests to bypass CSP
  if (message.action === "SOLANA_RPC") {
    fetch("https://api.devnet.solana.com", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message.payload)
    })
      .then(response => response.json())
      .then(data => sendResponse({ success: true, data }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    
    return true; // Keep channel open for async response
  }
});
