import { useEffect, useState } from "react";
import { CONFIG } from "../public/config.js";
import ConnectWallet from "./components/ConnectWallet";
import TokenCreationForm from "./components/TokenCreationForm";
import SuccessDisplay from "./components/SuccessDisplay";
import StatusDisplay from "./components/StatusDisplay";
import Instructions from "./components/Instructions";
import BuySell from "./components/BuySell";

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
  const [solAmount, setSolAmount] = useState(""); // Empty by default
  const [imagePreview, setImagePreview] = useState("");
  const [uploadedImage, setUploadedImage] = useState("");
  const [uploadedImageFilename, setUploadedImageFilename] = useState("");

  const [isConnecting, setIsConnecting] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [estimatedTokens, setEstimatedTokens] = useState(0);
  const [isEstimating, setIsEstimating] = useState(false);

  // Buy/Sell state
  const [showBuySell, setShowBuySell] = useState(false);
  const [buySellTokenData, setBuySellTokenData] = useState(null);

  // Track which mode is active
  const [activeMode, setActiveMode] = useState(null); // "create" or "buysell"

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
          "buySellTokenData",
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

          // Load tweet data for form (only if buy/sell is not active)
          if (result.tweetData && !result.buySellTokenData) {
            setTweetData(result.tweetData);
            setTokenName(result.tweetData.tokenName || "");
            setTokenSymbol(result.tweetData.tokenSymbol || "");
            setActiveMode("create");

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

          // Load buy/sell token data
          if (result.buySellTokenData) {
            setBuySellTokenData(result.buySellTokenData);
            setShowBuySell(true);
            setActiveMode("buysell");
            // Clear create token data when buy/sell is active
            setTweetData(null);
            setTokenName("");
            setTokenSymbol("");
            setSolAmount("");
            setImagePreview("");
            setUploadedImage("");
            setUploadedImageFilename("");
          } else {
            setBuySellTokenData(null);
            setShowBuySell(false);
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
      setSolAmount("");
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

  // Estimate tokens for SOL amount
  const estimateTokens = async (amount) => {
    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
      setEstimatedTokens(0);
      return;
    }

    if (!data.walletAddress) {
      setEstimatedTokens(0);
      return;
    }

    setIsEstimating(true);

    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (
        !tab.url ||
        (!tab.url.includes("x.com") && !tab.url.includes("twitter.com"))
      ) {
        setEstimatedTokens(0);
        setIsEstimating(false);
        return;
      }

      // Load IDL for the estimation
      const idlUrl = chrome.runtime.getURL("idl.json");
      const idlResponse = await fetch(idlUrl);
      const idl = await idlResponse.json();

      const PROGRAM_ID = CONFIG.PROGRAM_ID;

      chrome.tabs.sendMessage(
        tab.id,
        {
          action: "ESTIMATE_TOKENS",
          payload: {
            solAmount: amount,
            idl,
            programId: PROGRAM_ID,
          },
        },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error("Estimation error:", chrome.runtime.lastError);
            setEstimatedTokens(0);
            setIsEstimating(false);
            return;
          }

          if (
            response &&
            response.success &&
            response.data &&
            response.data.estimatedTokens !== undefined
          ) {
            setEstimatedTokens(response.data.estimatedTokens);
          } else {
            setEstimatedTokens(0);
          }
          setIsEstimating(false);
        }
      );
    } catch (error) {
      console.error("Estimation failed:", error);
      setEstimatedTokens(0);
      setIsEstimating(false);
    }
  };

  // Handle SOL amount change with debounced estimation
  const handleSolAmountChange = (value) => {
    setSolAmount(value);

    // Debounce the estimation (wait 500ms after user stops typing)
    if (window.estimateTimeout) {
      clearTimeout(window.estimateTimeout);
    }

    window.estimateTimeout = setTimeout(() => {
      estimateTokens(value);
    }, 500); // Wait 500ms after user stops typing
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
            solAmount: solAmount,
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

  const handleCreateAnother = () => {
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
    setSolAmount("");
  };

  const handleCloseBuySell = () => {
    chrome.storage.local.set({
      buySellTokenData: null,
    });
    setBuySellTokenData(null);
    setShowBuySell(false);
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

      {/* Connect Wallet Section */}
      <ConnectWallet
        walletAddress={data.walletAddress}
        walletType={data.walletType}
        isConnecting={isConnecting}
        onConnect={handleConnectWallet}
        onDisconnect={handleDisconnectWallet}
      />

      {/* Token Creation Form - Only show if wallet connected and tweet data exists and NOT in buysell mode */}
      {data.walletAddress &&
        tweetData &&
        !data.txHash &&
        activeMode === "create" &&
        !showBuySell && (
          <TokenCreationForm
            tweetData={tweetData}
            tokenName={tokenName}
            tokenSymbol={tokenSymbol}
            solAmount={solAmount}
            imagePreview={imagePreview}
            isCreating={isCreating}
            estimatedTokens={estimatedTokens}
            isEstimating={isEstimating}
            onTokenNameChange={setTokenName}
            onTokenSymbolChange={setTokenSymbol}
            onSolAmountChange={handleSolAmountChange}
            onImageUpload={handleImageUpload}
            onCreate={handleCreateToken}
          />
        )}

      {/* Status and Error Display - Hide when showing BuySell */}
      {!showBuySell && activeMode !== "buysell" && (
        <StatusDisplay status={data.status} error={data.error} />
      )}

      {/* Success Display - Show token details */}
      {!showBuySell &&
        activeMode !== "buysell" &&
        data.status === "success" &&
        data.txHash && (
          <SuccessDisplay
            tokenName={tokenName}
            tokenSymbol={tokenSymbol}
            txHash={data.txHash}
            tokenMint={data.tokenMint}
            onCreateAnother={handleCreateAnother}
          />
        )}

      {/* Instructions */}
      {!data.txHash &&
        !data.error &&
        data.walletAddress &&
        !tweetData &&
        !showBuySell &&
        activeMode !== "buysell" && <Instructions />}

      {/* Buy/Sell Section - Show when viewing other member's token */}
      {showBuySell &&
        buySellTokenData &&
        data.walletAddress &&
        activeMode === "buysell" && (
          <BuySell
            tokenData={buySellTokenData}
            walletAddress={data.walletAddress}
            walletType={data.walletType}
            onClose={handleCloseBuySell}
          />
        )}
    </div>
  );
}
