import { useEffect, useState } from "react";
import { CONFIG } from "../public/config.js";

export default function App() {
  const [data, setData] = useState({
    status: "",
    walletAddress: "",
    txHash: "",
    tokenMint: "",
    myUsername: "",
    error: "",
    walletType: "",
  });

  // Form state
  const [tweetData, setTweetData] = useState(null);
  const [tokenName, setTokenName] = useState("");
  const [tokenSymbol, setTokenSymbol] = useState("");
  const [imagePreview, setImagePreview] = useState("");
  const [uploadedImage, setUploadedImage] = useState("");
  const [uploadedImageFilename, setUploadedImageFilename] = useState("");

  const [isConnecting, setIsConnecting] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    // Load data from storage
    const loadData = () => {
      chrome.storage.local.get(
        [
          "status",
          "walletAddress",
          "txHash",
          "tokenMint",
          "myUsername",
          "error",
          "walletType",
          "tweetData",
        ],
        (result) => {
          setData({
            status: result.status || "Ready",
            walletAddress: result.walletAddress || "",
            txHash: result.txHash || "",
            tokenMint: result.tokenMint || "",
            myUsername: result.myUsername || "",
            error: result.error || "",
            walletType: result.walletType || "",
          });

          // Load tweet data for form
          if (result.tweetData) {
            setTweetData(result.tweetData);
            setTokenName(result.tweetData.tokenName || "");
            setTokenSymbol(result.tweetData.tokenSymbol || "");

            // Set image preview if available
            if (
              result.tweetData.tweetImages &&
              result.tweetData.tweetImages.length > 0
            ) {
              setImagePreview(result.tweetData.tweetImages[0].base64);
              setUploadedImage(result.tweetData.tweetImages[0].base64);
              setUploadedImageFilename(
                result.tweetData.tweetImages[0].filename
              );
            }
          }
        }
      );
    };

    loadData();

    // Listen for storage changes
    const listener = (changes, area) => {
      if (area === "local") {
        loadData();

        // Reset isCreating if error occurs
        if (changes.error && changes.error.newValue) {
          setIsCreating(false);
        }

        // Reset isCreating if success occurs
        if (changes.status && changes.status.newValue === "success") {
          setIsCreating(false);
        }
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
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (
        !tab.url ||
        (!tab.url.includes("x.com") && !tab.url.includes("twitter.com"))
      ) {
        chrome.storage.local.set({
          error: "Please open X/Twitter first, then click the connect button.",
        });
        setIsConnecting(false);
        return;
      }

      chrome.tabs.sendMessage(
        tab.id,
        {
          action: "CONNECT_WALLET",
          walletType: walletType,
        },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error("Message error:", chrome.runtime.lastError);
            chrome.storage.local.set({
              error:
                "Failed to connect. Please refresh the X/Twitter page and try again.",
            });
            setIsConnecting(false);
            return;
          }

          if (response && response.success) {
            chrome.storage.local.set({
              walletAddress: response.walletAddress,
              walletType: walletType,
              error: "",
              status: "Wallet connected",
            });
          } else {
            chrome.storage.local.set({
              error:
                response?.error ||
                `Failed to connect ${walletType}. Make sure it's installed.`,
            });
          }
          setIsConnecting(false);
        }
      );
    } catch (error) {
      console.error("Failed to connect wallet:", error);
      chrome.storage.local.set({
        error: `Failed to connect wallet. ${error.message}`,
      });
      setIsConnecting(false);
    }
  };

  const handleDisconnectWallet = async () => {
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (
        tab.url &&
        (tab.url.includes("x.com") || tab.url.includes("twitter.com"))
      ) {
        chrome.tabs.sendMessage(
          tab.id,
          {
            action: "DISCONNECT_WALLET",
            walletType: data.walletType,
          },
          () => {}
        );
      }

      chrome.storage.local.set({
        walletAddress: "",
        walletType: "",
        status: "Wallet disconnected",
        error: "",
        txHash: "",
        tokenMint: "",
        tweetData: null,
      });

      setTweetData(null);
      setTokenName("");
      setTokenSymbol("");
      setImagePreview("");
      setUploadedImage("");
    } catch (error) {
      console.error("Failed to disconnect wallet:", error);
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result;
      setImagePreview(base64);
      setUploadedImage(base64);
      setUploadedImageFilename(file.name);
    };
    reader.readAsDataURL(file);
  };

  const handleCreateToken = async () => {
    if (!data.walletAddress) {
      chrome.storage.local.set({ error: "Please connect your wallet first" });
      return;
    }

    if (!tokenName.trim() || !tokenSymbol.trim()) {
      chrome.storage.local.set({
        error: "Please fill in token name and symbol",
      });
      return;
    }

    setIsCreating(true);
    chrome.storage.local.set({
      status: "Creating token...",
      error: "",
    });

    try {
      const idlUrl = chrome.runtime.getURL("idl.json");
      const idlResponse = await fetch(idlUrl);
      const idl = await idlResponse.json();

      const PROGRAM_ID = CONFIG.PROGRAM_ID;
      const API_URL = CONFIG.API_URL;

      const tweetImages = uploadedImage
        ? [
            {
              url: imagePreview,
              base64: uploadedImage,
              filename: uploadedImageFilename || "token_image.jpg",
              type: "image/jpeg",
            },
          ]
        : tweetData?.tweetImages || [];

      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      chrome.tabs.sendMessage(
        tab.id,
        {
          action: "CREATE_TOKEN_FROM_POPUP",
          payload: {
            tweetText: tweetData?.tweetText || "",
            tweetUrl: tweetData?.tweetUrl || "",
            tokenName: tokenName.trim(),
            tokenSymbol: tokenSymbol.trim(),
            tokenDescription:
              tweetData?.tokenDescription || tweetData?.tweetText || "",
            tweetImages,
            idl,
            programId: PROGRAM_ID,
            apiUrl: API_URL,
          },
        },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error("Error:", chrome.runtime.lastError);
            chrome.storage.local.set({
              error:
                "Failed to communicate with page. Please refresh and try again.",
              status: "Error",
            });
            setIsCreating(false);
          }
        }
      );
    } catch (err) {
      console.error("Error:", err);
      chrome.storage.local.set({
        error: err.message || "Failed to create token",
        status: "Error",
      });
      setIsCreating(false);
    }
  };

  return (
    <div
      style={{
        width: "400px",
        maxHeight: "600px",
        overflowY: "auto",
        background: "#000",
        color: "#fff",
        padding: "16px",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: "20px" }}>
        <h1 style={{ fontSize: "20px", marginBottom: "4px" }}>
          Tweet Token Creator
        </h1>
        {data.myUsername && (
          <p style={{ color: "#888", fontSize: "12px" }}>@{data.myUsername}</p>
        )}
      </div>

      {/* Wallet Info */}
      {data.walletAddress ? (
        <div
          style={{
            padding: "16px",
            background: "#111",
            borderRadius: "8px",
            marginBottom: "24px",
            border: "1px solid #222",
          }}
        >
          <div style={{ fontSize: "12px", color: "#888", marginBottom: "4px" }}>
            Connected Wallet{" "}
            {data.walletType &&
              `(${
                data.walletType.charAt(0).toUpperCase() +
                data.walletType.slice(1)
              })`}
          </div>
          <div
            style={{
              fontSize: "12px",
              wordBreak: "break-all",
              fontFamily: "monospace",
              color: "#0f0",
            }}
          >
            {data.walletAddress}
          </div>

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
              marginTop: "16px",
            }}
          >
            Disconnect Wallet
          </button>
        </div>
      ) : (
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
          <div
            style={{ fontSize: "14px", color: "#888", marginBottom: "16px" }}
          >
            Connect your Solana wallet
          </div>

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
                opacity: isConnecting ? 0.6 : 1,
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
                opacity: isConnecting ? 0.6 : 1,
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
                opacity: isConnecting ? 0.6 : 1,
              }}
            >
              {isConnecting ? "Connecting..." : "Connect Solflare"}
            </button>
          </div>
        </div>
      )}

      {/* Token Creation Form - Only show if wallet connected and tweet data exists */}
      {data.walletAddress && tweetData && !data.txHash && (
        <div>
          {/* Image Upload */}
          <div
            style={{
              padding: "10px",
              background: "#111",
              borderRadius: "6px",
              marginBottom: "10px",
              border: "1px solid #222",
            }}
          >
            <label
              style={{
                fontSize: "11px",
                color: "#888",
                display: "block",
                marginBottom: "6px",
              }}
            >
              Token Image
            </label>
            {imagePreview && (
              <div
                style={{
                  width: "100%",
                  maxHeight: "200px",
                  aspectRatio: "1",
                  borderRadius: "6px",
                  overflow: "hidden",
                  background: "#222",
                  marginBottom: "6px",
                }}
              >
                <img
                  src={imagePreview}
                  alt="Token preview"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              style={{
                width: "100%",
                padding: "6px",
                background: "#222",
                border: "1px solid #333",
                borderRadius: "4px",
                color: "#fff",
                fontSize: "12px",
              }}
            />
          </div>

          {/* Token Name */}
          <div
            style={{
              padding: "10px",
              background: "#111",
              borderRadius: "6px",
              marginBottom: "10px",
              border: "1px solid #222",
            }}
          >
            <label
              style={{
                fontSize: "11px",
                color: "#888",
                display: "block",
                marginBottom: "6px",
              }}
            >
              Token Name
            </label>
            <input
              type="text"
              value={tokenName}
              onChange={(e) => setTokenName(e.target.value)}
              placeholder="Enter token name"
              maxLength={32}
              style={{
                width: "100%",
                padding: "8px",
                background: "#222",
                border: "1px solid #333",
                borderRadius: "4px",
                color: "#fff",
                fontSize: "13px",
              }}
            />
          </div>

          {/* Token Symbol */}
          <div
            style={{
              padding: "10px",
              background: "#111",
              borderRadius: "6px",
              marginBottom: "10px",
              border: "1px solid #222",
            }}
          >
            <label
              style={{
                fontSize: "11px",
                color: "#888",
                display: "block",
                marginBottom: "6px",
              }}
            >
              Token Symbol
            </label>
            <input
              type="text"
              value={tokenSymbol}
              onChange={(e) => setTokenSymbol(e.target.value.toUpperCase())}
              placeholder="Enter token symbol"
              maxLength={10}
              style={{
                width: "100%",
                padding: "8px",
                background: "#222",
                border: "1px solid #333",
                borderRadius: "4px",
                color: "#fff",
                fontSize: "13px",
              }}
            />
          </div>

          {/* Twitter Link (non-editable) */}
          <div
            style={{
              padding: "10px",
              background: "#111",
              borderRadius: "6px",
              marginBottom: "10px",
              border: "1px solid #222",
            }}
          >
            <label
              style={{
                fontSize: "11px",
                color: "#888",
                display: "block",
                marginBottom: "6px",
              }}
            >
              Twitter Link
            </label>
            <input
              type="text"
              value={tweetData?.tweetUrl || ""}
              disabled
              style={{
                width: "100%",
                padding: "8px",
                background: "#222",
                border: "1px solid #333",
                borderRadius: "4px",
                color: "#666",
                fontSize: "12px",
                cursor: "not-allowed",
              }}
            />
          </div>

          {/* Create Token Button */}
          <button
            onClick={handleCreateToken}
            disabled={isCreating || !tokenName.trim() || !tokenSymbol.trim()}
            style={{
              width: "100%",
              background:
                isCreating || !tokenName.trim() || !tokenSymbol.trim()
                  ? "#444"
                  : "#AB9FF2",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              padding: "12px 16px",
              fontSize: "14px",
              fontWeight: "600",
              cursor:
                isCreating || !tokenName.trim() || !tokenSymbol.trim()
                  ? "not-allowed"
                  : "pointer",
              marginBottom: "10px",
            }}
          >
            {isCreating ? "Creating Token..." : "Create Token"}
          </button>
        </div>
      )}

      {/* Status */}
      {data.status && (
        <div
          style={{
            padding: "16px",
            background: "#111",
            borderRadius: "8px",
            marginBottom: "24px",
            border: "1px solid #222",
          }}
        >
          <div style={{ fontSize: "12px", color: "#888", marginBottom: "4px" }}>
            Status
          </div>
          <div style={{ fontSize: "16px" }}>{data.status}</div>
        </div>
      )}

      {/* Error */}
      {data.error && (
        <div
          style={{
            padding: "16px",
            background: "#331111",
            borderRadius: "8px",
            marginBottom: "24px",
            border: "1px solid #661111",
            color: "#ff6666",
          }}
        >
          <div style={{ fontSize: "12px", marginBottom: "4px" }}>Error</div>
          <div style={{ fontSize: "14px" }}>{data.error}</div>
        </div>
      )}

      {/* Success - Show token details */}
      {data.status === "success" && data.txHash && (
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
            <div
              style={{ fontSize: "12px", color: "#888", marginBottom: "8px" }}
            >
              Token Created
            </div>
            <div style={{ fontSize: "20px", marginBottom: "4px" }}>
              {tokenName}
            </div>
            <div style={{ fontSize: "16px", color: "#888" }}>
              ${tokenSymbol}
            </div>
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
            <div
              style={{ fontSize: "12px", color: "#888", marginBottom: "8px" }}
            >
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
              {data.txHash}
            </div>
            <a
              href={`https://explorer.solana.com/tx/${data.txHash}?cluster=devnet`}
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

          {data.tokenMint && (
            <div
              style={{
                padding: "16px",
                background: "#111",
                borderRadius: "8px",
                border: "1px solid #222",
                marginBottom: "16px",
              }}
            >
              <div
                style={{ fontSize: "12px", color: "#888", marginBottom: "4px" }}
              >
                Token Mint Address
              </div>
              <div
                style={{
                  fontSize: "12px",
                  wordBreak: "break-all",
                  fontFamily: "monospace",
                }}
              >
                {data.tokenMint}
              </div>
            </div>
          )}

          <button
            onClick={() => {
              chrome.storage.local.set({
                status: "Ready",
                error: "",
                txHash: "",
                tokenMint: "",
                tweetData: null,
              });
              setTweetData(null);
              setTokenName("");
              setTokenSymbol("");
              setImagePreview("");
              setUploadedImage("");
            }}
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
      )}

      {/* Instructions */}
      {!data.txHash && !data.error && data.walletAddress && !tweetData && (
        <div
          style={{
            padding: "16px",
            background: "#111",
            borderRadius: "8px",
            border: "1px solid #222",
            fontSize: "14px",
            lineHeight: "1.6",
            color: "#888",
          }}
        >
          <p style={{ marginBottom: "12px" }}>How to use:</p>
          <ol style={{ paddingLeft: "20px", margin: 0 }}>
            <li style={{ marginBottom: "8px" }}>
              Make sure wallet is on{" "}
              <strong style={{ color: "#fff" }}>Devnet</strong>
            </li>
            <li style={{ marginBottom: "8px" }}>
              Go to your profile on X/Twitter
            </li>
            <li style={{ marginBottom: "8px" }}>
              Click "Create a token" on your tweet
            </li>
            <li>Fill in the form and create your token</li>
          </ol>
        </div>
      )}
    </div>
  );
}
