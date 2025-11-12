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
    error: ""
  });
  
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    // Load data from storage
    const loadData = () => {
      chrome.storage.local.get(
        ["status", "walletAddress", "txHash", "tokenName", "tokenSymbol", "tokenMint", "myUsername", "error"],
        (result) => {
          setData({
            status: result.status || "Waiting...",
            walletAddress: result.walletAddress || "",
            txHash: result.txHash || "",
            tokenName: result.tokenName || "",
            tokenSymbol: result.tokenSymbol || "",
            tokenMint: result.tokenMint || "",
            myUsername: result.myUsername || "",
            error: result.error || ""
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
  
  const handleConnectWallet = async () => {
    setIsConnecting(true);
    try {
      // Inject a script to connect to Phantom
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: async () => {
          const provider = window.solana || window.phantom?.solana;
          if (!provider) {
            throw new Error("Phantom wallet not found");
          }
          const { publicKey } = await provider.connect();
          return publicKey.toString();
        }
      }).then(results => {
        if (results && results[0] && results[0].result) {
          chrome.storage.local.set({ walletAddress: results[0].result });
        }
      });
    } catch (error) {
      console.error("Failed to connect wallet:", error);
      chrome.storage.local.set({ 
        error: "Failed to connect wallet. Make sure Phantom is installed."
      });
    } finally {
      setIsConnecting(false);
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
          <div style={{ fontSize: "12px", color: "#888", marginBottom: "4px" }}>Connected Wallet</div>
          <div style={{ fontSize: "12px", wordBreak: "break-all", fontFamily: "monospace", color: "#0f0" }}>
            {data.walletAddress}
          </div>
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
          <div style={{ fontSize: "14px", color: "#888", marginBottom: "12px" }}>No wallet connected</div>
          <button
            onClick={handleConnectWallet}
            disabled={isConnecting}
            style={{
              background: "#1DA1F2",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              padding: "10px 20px",
              fontSize: "14px",
              fontWeight: "600",
              cursor: isConnecting ? "not-allowed" : "pointer",
              opacity: isConnecting ? 0.6 : 1
            }}
          >
            {isConnecting ? "Connecting..." : "Connect Phantom Wallet"}
          </button>
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
      {!data.txHash && !data.error && (
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
            <li style={{ marginBottom: "8px" }}>Make sure Phantom is on <strong style={{ color: "#fff" }}>Devnet</strong></li>
            <li style={{ marginBottom: "8px" }}>Connect your wallet above</li>
            <li style={{ marginBottom: "8px" }}>Go to your profile on X/Twitter</li>
            <li style={{ marginBottom: "8px" }}>Click "Create a token" on your tweet</li>
            <li>Approve the transaction in Phantom</li>
          </ol>
        </div>
      )}
    </div>
  );
}