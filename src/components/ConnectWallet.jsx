export default function ConnectWallet({ 
  walletAddress, 
  walletType, 
  isConnecting, 
  onConnect, 
  onDisconnect 
}) {
  if (walletAddress) {
    return (
      <div style={{ 
        padding: "16px", 
        background: "#111", 
        borderRadius: "8px",
        marginBottom: "24px",
        border: "1px solid #222"
      }}>
        <div style={{ fontSize: "12px", color: "#888", marginBottom: "4px" }}>
          Connected Wallet {walletType && `(${walletType.charAt(0).toUpperCase() + walletType.slice(1)})`}
        </div>
        <div style={{ fontSize: "12px", wordBreak: "break-all", fontFamily: "monospace", color: "#0f0" }}>
          {walletAddress}
        </div>
        
        <button
          onClick={onDisconnect}
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
    );
  }

  return (
    <div style={{ 
      padding: "16px", 
      background: "#111", 
      borderRadius: "8px",
      marginBottom: "24px",
      border: "1px solid #222",
      textAlign: "center"
    }}>
      <div style={{ fontSize: "14px", color: "#888", marginBottom: "16px" }}>
        Connect your Solana wallet
      </div>
      
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <button
          onClick={() => onConnect("phantom")}
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
          onClick={() => onConnect("backpack")}
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
          onClick={() => onConnect("solflare")}
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
  );
}
