export default function ConnectWallet({
  walletAddress,
  walletType,
  isConnecting,
  solBalance,
  isLoadingSolBalance,
  onConnect,
  onDisconnect,
}) {
  if (walletAddress) {
    return (
      <div style={{ marginBottom: "24px" }}>
        {/* Wallet Address and SOL Balance in flex layout */}
        <div
          style={{
            display: "flex",
            gap: "8px",
            marginBottom: "12px",
          }}
        >
          {/* Wallet Address Box */}
          <div
            style={{
              flex: 1,
              padding: "12px",
              background: "#111",
              borderRadius: "8px",
              border: "1px solid #222",
            }}
          >
            <div
              style={{ fontSize: "10px", color: "#888", marginBottom: "4px" }}
            >
              Wallet{" "}
              {walletType &&
                `(${walletType.charAt(0).toUpperCase() + walletType.slice(1)})`}
            </div>
            <div
              style={{
                fontSize: "11px",
                wordBreak: "break-all",
                fontFamily: "monospace",
                color: "#0f0",
              }}
            >
              {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
            </div>
          </div>

          {/* SOL Balance Box */}
          <div
            style={{
              flex: 1,
              padding: "12px",
              background: "#111",
              borderRadius: "8px",
              border: "1px solid #222",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                fontSize: "10px",
                color: "#888",
                marginBottom: "4px",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 397.7 311.7"
                fill="#14F195"
              >
                <path d="M64.6 237.9c2.4-2.4 5.7-3.8 9.2-3.8h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1l62.7-62.7z" />
                <path d="M64.6 3.8C67.1 1.4 70.4 0 73.8 0h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1L64.6 3.8z" />
                <path d="M333.1 120.1c-2.4-2.4-5.7-3.8-9.2-3.8H6.5c-5.8 0-8.7 7-4.6 11.1l62.7 62.7c2.4 2.4 5.7 3.8 9.2 3.8h317.4c5.8 0 8.7-7 4.6-11.1l-62.7-62.7z" />
              </svg>
              SOL Balance
            </div>
            <div style={{ fontSize: "13px", color: "#fff", fontWeight: "600" }}>
              {isLoadingSolBalance ? "..." : `${solBalance.toFixed(4)}`}
            </div>
          </div>
        </div>

        <button
          onClick={onDisconnect}
          style={{
            width: "100%",
            background: "#FF4500",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            padding: "12px 20px",
            fontSize: "14px",
            fontWeight: "600",
            cursor: "pointer",
          }}
        >
          Disconnect Wallet
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: "16px",
        background: "#111",
        borderRadius: "8px",
        marginBottom: "24px",
        border: "1px solid #222",
        textAlign: "center",
      }}
    >
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
            opacity: isConnecting ? 0.6 : 1,
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
            opacity: isConnecting ? 0.6 : 1,
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
            opacity: isConnecting ? 0.6 : 1,
          }}
        >
          {isConnecting ? "Connecting..." : "Connect Solflare"}
        </button>
      </div>
    </div>
  );
}
