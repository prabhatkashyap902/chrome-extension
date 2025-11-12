import { useEffect, useState } from "react";

export default function App() {
  const [data, setData] = useState({
    status: "",
    walletAddress: "",
    txHash: "",
    tokenName: "",
    tokenSymbol: "",
    tokenMint: "",
    myUsername: "",
    error: "",
    walletType: "" // phantom, backpack, or solflare
  });
  
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    // Load data from storage
    const loadData = () => {
      chrome.storage.local.get(
        ["status", "walletAddress", "txHash", "tokenName", "tokenSymbol", "tokenMint", "myUsername", "error", "walletType"],
        (result) => {
          setData({
            status: result.status || "Ready",
            walletAddress: result.walletAddress || "",
            txHash: result.txHash || "",
            tokenName: result.tokenName || "",
            tokenSymbol: result.tokenSymbol || "",
            tokenMint: result.tokenMint || "",
            myUsername: result.myUsername || "",
            error: result.error || "",
            walletType: result.walletType || ""
          });
        }
      );
    };

    loadData();

    // Listen for storage changes
    const listener = (changes, area) => {
      if (area === "local") {
        loadData();
      }
    };

    chrome.storage.onChanged.addListener(listener);

    return () => {
      chrome.storage.onChanged.removeListener(listener);
    };
  }, []);
  
  const handleConnectWallet = async (walletType) => {
    setIsConnecting(true);
    try {
      // Send message to content script to connect wallet
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Check if we're on x.com or twitter.com
      if (!tab.url || (!tab.url.includes('x.com') && !tab.url.includes('twitter.com'))) {
        chrome.storage.local.set({ 
          error: "Please open X/Twitter first, then click the connect button."
        });
        setIsConnecting(false);
        return;
      }
      
      // Send message to content script
      chrome.tabs.sendMessage(tab.id, { 
        action: "CONNECT_WALLET", 
        walletType: walletType 
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error("Message error:", chrome.runtime.lastError);
          chrome.storage.local.set({ 
            error: "Failed to connect. Please refresh the X/Twitter page and try again."
          });
          setIsConnecting(false);
          return;
        }
        
        if (response && response.success) {
          chrome.storage.local.set({ 
            walletAddress: response.walletAddress,
            walletType: walletType,
            error: "",
            status: "Wallet connected"
          });
        } else {
          chrome.storage.local.set({ 
            error: response?.error || `Failed to connect ${walletType}. Make sure it's installed.`
          });
        }
        setIsConnecting(false);
      });
      
    } catch (error) {
      console.error("Failed to connect wallet:", error);
      chrome.storage.local.set({ 
        error: `Failed to connect wallet. ${error.message}`
      });
      setIsConnecting(false);
    }
  };
  
  const handleDisconnectWallet = async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Send message to content script to disconnect wallet
      if (tab.url && (tab.url.includes('x.com') || tab.url.includes('twitter.com'))) {
        chrome.tabs.sendMessage(tab.id, { 
          action: "DISCONNECT_WALLET",
          walletType: data.walletType
        }, () => {
          // Ignore errors - just clear local storage anyway
        });
      }
      
      // Clear wallet data from storage
      chrome.storage.local.set({ 
        walletAddress: "",
        walletType: "",
        status: "Wallet disconnected",
        error: "",
        txHash: "",
        tokenName: "",
        tokenSymbol: "",
        tokenMint: ""
      });
      
    } catch (error) {
      console.error("Failed to disconnect wallet:", error);
    }
  };

  return (
    <div style={{ 
      width: "400px", 
      minHeight: "500px", 
      background: "#000", 
      color: "#fff",
      padding: "24px",
      fontFamily: "system-ui, -apple-system, sans-serif"
    }}>
      {/* Header */}
      <div style={{ marginBottom: "32px" }}>
        <h1 style={{ fontSize: "24px", marginBottom: "8px" }}>Tweet Token Creator</h1>
        {data.myUsername && (
          <p style={{ color: "#888", fontSize: "14px" }}>@{data.myUsername}</p>
        )}
      </div>

      {/* Wallet Info */}
      {data.walletAddress ? (
        <div style={{ 
          padding: "16px", 
          background: "#111", 
          borderRadius: "8px",
          marginBottom: "24px",
          border: "1px solid #222"
        }}>
          <div style={{ fontSize: "12px", color: "#888", marginBottom: "4px" }}>
            Connected Wallet {data.walletType && `(${data.walletType.charAt(0).toUpperCase() + data.walletType.slice(1)})`}
          </div>
          <div style={{ fontSize: "12px", wordBreak: "break-all", fontFamily: "monospace", color: "#0f0" }}>
            {data.walletAddress}
          </div>
          
          {/* Disconnect button */}
          <button
            onClick={handleDisconnectWallet}
            style={{
              background: "#FF4500",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              padding: "12px 20px",
              fontSize: "14px",
              fontWeight: "600",
              cursor: "pointer",
              marginTop: "16px"
            }}
          >
            Disconnect Wallet
          </button>
        </div>
      ) : (
        <div style={{ 
          padding: "16px", 
          background: "#111", 
          borderRadius: "8px",
          marginBottom: "24px",
          border: "1px solid #222",
          textAlign: "center"
        }}>
          <div style={{ fontSize: "14px", color: "#888", marginBottom: "16px" }}>Connect your Solana wallet</div>
          
          {/* Wallet buttons */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <button
              onClick={() => handleConnectWallet("phantom")}
              disabled={isConnecting}
              style={{
                background: "#AB9FF2",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                padding: "12px 20px",
                fontSize: "14px",
                fontWeight: "600",
                cursor: isConnecting ? "not-allowed" : "pointer",
                opacity: isConnecting ? 0.6 : 1
              }}
            >
              {isConnecting ? "Connecting..." : "Connect Phantom"}
            </button>
            
            <button
              onClick={() => handleConnectWallet("backpack")}
              disabled={isConnecting}
              style={{
                background: "#E84142",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                padding: "12px 20px",
                fontSize: "14px",
                fontWeight: "600",
                cursor: isConnecting ? "not-allowed" : "pointer",
                opacity: isConnecting ? 0.6 : 1
              }}
            >
              {isConnecting ? "Connecting..." : "Connect Backpack"}
            </button>
            
            <button
              onClick={() => handleConnectWallet("solflare")}
              disabled={isConnecting}
              style={{
                background: "#FC6E20",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                padding: "12px 20px",
                fontSize: "14px",
                fontWeight: "600",
                cursor: isConnecting ? "not-allowed" : "pointer",
                opacity: isConnecting ? 0.6 : 1
              }}
            >
              {isConnecting ? "Connecting..." : "Connect Solflare"}
            </button>
          </div>
        </div>
      )}

      {/* Status */}
      <div style={{ 
        padding: "16px", 
        background: "#111", 
        borderRadius: "8px",
        marginBottom: "24px",
        border: "1px solid #222"
      }}>
        <div style={{ fontSize: "12px", color: "#888", marginBottom: "4px" }}>Status</div>
        <div style={{ fontSize: "16px" }}>{data.status}</div>
      </div>

      {/* Error */}
      {data.error && (
        <div style={{ 
          padding: "16px", 
          background: "#331111", 
          borderRadius: "8px",
          marginBottom: "24px",
          border: "1px solid #661111",
          color: "#ff6666"
        }}>
          <div style={{ fontSize: "12px", marginBottom: "4px" }}>Error</div>
          <div style={{ fontSize: "14px" }}>{data.error}</div>
        </div>
      )}

      {/* Success - Show token details */}
      {data.status === "success" && data.txHash && (
        <div>
          {/* Token Info */}
          <div style={{ 
            padding: "16px", 
            background: "#111", 
            borderRadius: "8px",
            marginBottom: "16px",
            border: "1px solid #222"
          }}>
            <div style={{ fontSize: "12px", color: "#888", marginBottom: "8px" }}>Token Created</div>
            <div style={{ fontSize: "20px", marginBottom: "4px" }}>{data.tokenName}</div>
            <div style={{ fontSize: "16px", color: "#888" }}>${data.tokenSymbol}</div>
          </div>

          {/* Transaction Hash */}
          <div style={{ 
            padding: "16px", 
            background: "#111", 
            borderRadius: "8px",
            marginBottom: "16px",
            border: "1px solid #222"
          }}>
            <div style={{ fontSize: "12px", color: "#888", marginBottom: "8px" }}>Transaction Signature</div>
            <div style={{ fontSize: "12px", wordBreak: "break-all", fontFamily: "monospace", marginBottom: "8px" }}>
              {data.txHash}
            </div>
            <a 
              href={`https://explorer.solana.com/tx/${data.txHash}?cluster=devnet`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ 
                color: "#1DA1F2", 
                fontSize: "12px",
                textDecoration: "none"
              }}
            >
              View on Solana Explorer →
            </a>
          </div>

          {/* Token Mint */}
          {data.tokenMint && (
            <div style={{ 
              padding: "16px", 
              background: "#111", 
              borderRadius: "8px",
              border: "1px solid #222"
            }}>
              <div style={{ fontSize: "12px", color: "#888", marginBottom: "4px" }}>Token Mint Address</div>
              <div style={{ fontSize: "12px", wordBreak: "break-all", fontFamily: "monospace" }}>
                {data.tokenMint}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Instructions */}
      {!data.txHash && !data.error && data.walletAddress && (
        <div style={{ 
          padding: "16px", 
          background: "#111", 
          borderRadius: "8px",
          border: "1px solid #222",
          fontSize: "14px",
          lineHeight: "1.6",
          color: "#888"
        }}>
          <p style={{ marginBottom: "12px" }}>How to use:</p>
          <ol style={{ paddingLeft: "20px", margin: 0 }}>
            <li style={{ marginBottom: "8px" }}>Make sure wallet is on <strong style={{ color: "#fff" }}>Devnet</strong></li>
            <li style={{ marginBottom: "8px" }}>Go to your profile on X/Twitter</li>
            <li style={{ marginBottom: "8px" }}>Click "Create a token" on your tweet</li>
            <li>Approve the transaction in your wallet</li>
          </ol>
        </div>
      )}
    </div>
  );
}