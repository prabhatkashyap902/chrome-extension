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

          {/* Wallet Address */}
          <div style={{ 
            padding: "16px", 
            background: "#111", 
            borderRadius: "8px",
            marginBottom: "16px",
            border: "1px solid #222"
          }}>
            <div style={{ fontSize: "12px", color: "#888", marginBottom: "4px" }}>Wallet Address</div>
            <div style={{ fontSize: "12px", wordBreak: "break-all", fontFamily: "monospace" }}>
              {data.walletAddress}
            </div>
          </div>

          {/* Transaction Hash */}
          <div style={{ 
            padding: "16px", 
            background: "#111", 
            borderRadius: "8px",
            marginBottom: "16px",
            border: "1px solid #222"
          }}>
            <div style={{ fontSize: "12px", color: "#888", marginBottom: "8px" }}>Transaction Hash</div>
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
            <li style={{ marginBottom: "8px" }}>Go to your profile on X/Twitter</li>
            <li style={{ marginBottom: "8px" }}>Click "Create a token" on your tweet</li>
            <li>Approve the transaction in Phantom</li>
          </ol>
        </div>
      )}
    </div>
  );
}
