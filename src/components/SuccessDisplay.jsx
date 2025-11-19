import { useState, useEffect, useCallback } from "react";

export default function SuccessDisplay({
  tokenName,
  tokenSymbol,
  txHash,
  tokenMint,
  onCreateAnother,
}) {
  const [tokenAddress, setTokenAddress] = useState(null);
  const [loadingTokenAddress, setLoadingTokenAddress] = useState(false);
  const [tokenError, setTokenError] = useState(null);

  const fetchTokenAddress = useCallback(async () => {
    setLoadingTokenAddress(true);
    setTokenError(null);

    try {
      const response = await fetch(chrome.runtime.getURL("config.js"));
      const configText = await response.text();
      const apiUrlMatch = configText.match(/API_URL:\s*["']([^"']+)["']/);

      if (!apiUrlMatch) {
        throw new Error("API URL not found in config");
      }

      const apiUrl = apiUrlMatch[1];

      const tokenResponse = await fetch(`${apiUrl}/token/${tokenMint}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!tokenResponse.ok) {
        throw new Error(`API returned status ${tokenResponse.status}`);
      }

      const tokenData = await tokenResponse.json();

      const address =
        tokenData.address ||
        tokenData.token_address ||
        tokenData.mint ||
        tokenMint;
      setTokenAddress(address);
    } catch (error) {
      console.error("[TTC] Error fetching token address:", error);
      setTokenError(error.message);
      setTokenAddress(tokenMint);
    } finally {
      setLoadingTokenAddress(false);
    }
  }, [tokenMint]);

  useEffect(() => {
    if (tokenMint) {
      fetchTokenAddress();
    }
  }, [tokenMint, fetchTokenAddress]);

  return (
    <div>
      <div
        style={{
          padding: "16px",
          background: "#111",
          borderRadius: "8px",
          marginBottom: "16px",
          border: "1px solid #222",
        }}
      >
        <div style={{ fontSize: "12px", color: "#888", marginBottom: "8px" }}>
          Token Created
        </div>
        <div style={{ fontSize: "20px", marginBottom: "4px" }}>{tokenName}</div>
        <div style={{ fontSize: "16px", color: "#888" }}>${tokenSymbol}</div>
      </div>

      <div
        style={{
          padding: "16px",
          background: "#111",
          borderRadius: "8px",
          marginBottom: "16px",
          border: "1px solid #222",
        }}
      >
        <div style={{ fontSize: "12px", color: "#888", marginBottom: "8px" }}>
          Transaction Signature
        </div>
        <div
          style={{
            fontSize: "12px",
            wordBreak: "break-all",
            fontFamily: "monospace",
            marginBottom: "8px",
          }}
        >
          {txHash}
        </div>
        <a
          href={`https://explorer.solana.com/tx/${txHash}?cluster=devnet`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: "#1DA1F2",
            fontSize: "12px",
            textDecoration: "none",
          }}
        >
          View on Solana Explorer →
        </a>
      </div>

      {tokenMint && (
        <div
          style={{
            padding: "16px",
            background: "#111",
            borderRadius: "8px",
            border: "1px solid #222",
            marginBottom: "16px",
          }}
        >
          <div style={{ fontSize: "12px", color: "#888", marginBottom: "4px" }}>
            Token Mint Address
          </div>
          <div
            style={{
              fontSize: "12px",
              wordBreak: "break-all",
              fontFamily: "monospace",
            }}
          >
            {tokenMint}
          </div>
        </div>
      )}

      {/* Visit Token Button */}
      {tokenAddress && (
        <button
          onClick={() => {
            // Construct token URL - adjust this based on where your tokens are viewable
            const tokenUrl = `https://dev.icm.social/token/${tokenAddress}`;
            window.open(tokenUrl, "_blank");
          }}
          style={{
            width: "100%",
            background: "#1DA1F2",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            padding: "16px 20px",
            fontSize: "16px",
            fontWeight: "600",
            cursor: "pointer",
            marginBottom: "12px",
          }}
        >
          Visit Token →
        </button>
      )}

      {loadingTokenAddress && (
        <div
          style={{
            width: "100%",
            background: "#222",
            color: "#888",
            border: "1px solid #333",
            borderRadius: "8px",
            padding: "16px 20px",
            fontSize: "14px",
            textAlign: "center",
            marginBottom: "12px",
          }}
        >
          Loading token details...
        </div>
      )}

      {tokenError && (
        <div
          style={{
            width: "100%",
            background: "#331111",
            color: "#ff6b6b",
            border: "1px solid #441111",
            borderRadius: "8px",
            padding: "12px",
            fontSize: "12px",
            marginBottom: "12px",
          }}
        >
          Failed to load token details: {tokenError}
        </div>
      )}

      <button
        onClick={onCreateAnother}
        style={{
          width: "100%",
          background: "#AB9FF2",
          color: "#fff",
          border: "none",
          borderRadius: "8px",
          padding: "16px 20px",
          fontSize: "16px",
          fontWeight: "600",
          cursor: "pointer",
        }}
      >
        Create Another Token
      </button>
    </div>
  );
}
