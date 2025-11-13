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
    console.log("[TTC Background] RPC Request:", JSON.stringify(message.payload, null, 2));
    
    fetch("https://api.devnet.solana.com", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message.payload)
    })
      .then(response => response.json())
      .then(data => {
        console.log("[TTC Background] RPC Response:", JSON.stringify(data, null, 2));
        sendResponse({ success: true, data });
      })
      .catch(error => {
        console.error("[TTC Background] RPC Error:", error);
        sendResponse({ success: false, error: error.message });
      });
    
    return true; // Keep channel open for async response
  }
  
  // Upload metadata to backend API
  if (message.action === "UPLOAD_METADATA") {
    console.log("[TTC Background] 📤 Metadata upload request to:", message.apiUrl);
    console.log("[TTC Background] 📋 FormData:", message.formData);
    
    // Create FormData from the plain object
    const formData = new FormData();
    Object.keys(message.formData).forEach(key => {
      const value = message.formData[key];
      
      // Handle image files (base64 data)
      if (key === 'image' && value && value.startsWith('data:')) {
        // Convert base64 to blob
        const base64Data = value.split(',')[1];
        const mimeType = value.match(/data:(.*?);/)[1];
        
        // Convert base64 to binary
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        const blob = new Blob([bytes], { type: mimeType });
        
        console.log("[TTC Background] 📷 Image blob created:", blob.size, "bytes, type:", mimeType);
        
        formData.append(key, blob, message.formData.imageFilename || 'token_image.jpg');
      } else if (key !== 'imageFilename') {
        // Skip imageFilename as it's just metadata
        formData.append(key, value);
      }
    });
    
    console.log("[TTC Background] 🔄 Making fetch request...");
    
    fetch(message.apiUrl, {
      method: "POST",
      body: formData
    })
      .then(response => {
        console.log("[TTC Background] 📡 Response status:", response.status);
        console.log("[TTC Background] 📡 Response headers:", response.headers);
        if (!response.ok) {
          return response.text().then(text => {
            console.error("[TTC Background] ❌ Response body:", text);
            throw new Error(`HTTP ${response.status}: ${response.statusText} - ${text}`);
          });
        }
        return response.json();
      })
      .then(data => {
        console.log("[TTC Background] ✅ Metadata upload success:", data);
        sendResponse({ 
          success: true, 
          metadata_url: data.metadata_url 
        });
      })
      .catch(error => {
        console.error("[TTC Background] ❌ Metadata upload error:", error);
        console.error("[TTC Background] ❌ Error stack:", error.stack);
        sendResponse({ 
          success: false, 
          error: error.message 
        });
      });
    
    return true; // Keep channel open for async response
  }
});