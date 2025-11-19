import { useState, useEffect } from "react";
import { CONFIG } from "../../public/config.js";

export default function BuySell({
  tokenData,
  walletAddress,
  walletType,
  onClose,
  onBalanceRefresh,
}) {
  const [mode, setMode] = useState("buy"); // "buy" or "sell"
  const [amount, setAmount] = useState("");
  const [estimatedAmount, setEstimatedAmount] = useState(0);
  const [isEstimating, setIsEstimating] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [ownedTokens, setOwnedTokens] = useState(0);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [userAllocation, setUserAllocation] = useState(0); // For BUY mode - stores KOL tokens or PUBLIC SOL
  const [isLoadingAllocation, setIsLoadingAllocation] = useState(false);

  // Debounce timer
  let estimateTimer = null;

  // ✅ Determine if we're in KOL phase (case-insensitive check)
  const isKolPhase = tokenData?.phase?.toLowerCase() === "kol";

  // 🔍 Debug log to see actual phase value
  useEffect(() => {
    console.log("🔍 [BuySell] Token Phase:", tokenData?.phase);
    console.log("🔍 [BuySell] isKolPhase:", isKolPhase);
  }, [tokenData?.phase, isKolPhase]);

  // ✅ Fetch allocations when in BUY mode
  useEffect(() => {
    if (mode === "buy" && tokenData?.tokenAddress && walletAddress) {
      fetchUserAllocation();
    }

    // Clear error/success messages when switching modes
    setError(null);
    setSuccess(null);

    // ✅ Clear amount and estimated amount when switching modes
    setAmount("");
    setEstimatedAmount(0);
  }, [mode, tokenData?.tokenAddress, walletAddress]);

  // Fetch owned token balance when switching to sell mode
  useEffect(() => {
    if (mode === "sell" && tokenData?.tokenAddress && walletAddress) {
      fetchOwnedTokenBalance();
    }
  }, [mode, tokenData?.tokenAddress, walletAddress]);

  const fetchUserAllocation = async () => {
    setIsLoadingAllocation(true);

    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (
        !tab.url ||
        (!tab.url.includes("x.com") && !tab.url.includes("twitter.com"))
      ) {
        setUserAllocation(0);
        setIsLoadingAllocation(false);
        return;
      }

      // Load IDL
      const idlUrl = chrome.runtime.getURL("idl.json");
      const idlResponse = await fetch(idlUrl);
      const idl = await idlResponse.json();

      const PROGRAM_ID = CONFIG.PROGRAM_ID;

      chrome.tabs.sendMessage(
        tab.id,
        {
          action: "GET_ALLOCATIONS",
          payload: {
            tokenAddress: tokenData.tokenAddress,
            saleAuthority: tokenData.saleAuthority || "",
            phase: tokenData.phase || "public", // "kol" or "public"
            walletAddress: walletAddress,
            idl,
            programId: PROGRAM_ID,
          },
        },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error("Allocation fetch error:", chrome.runtime.lastError);
            setUserAllocation(0);
            setIsLoadingAllocation(false);
            return;
          }

          if (response && response.success && response.allocations) {
            console.log("✅ Allocations received:", response.allocations);

            // ✅ Set allocation based on phase (case-insensitive)
            // KOL phase → personalKolRemaining (tokens)
            // PUBLIC phase → personalPublicRemaining (SOL)
            const phase = (tokenData.phase || "public").toLowerCase();
            if (phase === "kol") {
              setUserAllocation(response.allocations.personalKolRemaining || 0);
              console.log(
                `📊 KOL phase - Remaining tokens: ${response.allocations.personalKolRemaining}`
              );
            } else {
              setUserAllocation(
                response.allocations.personalPublicRemaining || 0
              );
              console.log(
                `📊 PUBLIC phase - Remaining SOL: ${response.allocations.personalPublicRemaining}`
              );
            }
          } else {
            setUserAllocation(0);
          }
          setIsLoadingAllocation(false);
        }
      );
    } catch (error) {
      console.error("Allocation fetch failed:", error);
      setUserAllocation(0);
      setIsLoadingAllocation(false);
    }
  };

  const fetchOwnedTokenBalance = async () => {
    setIsLoadingBalance(true);

    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (
        !tab.url ||
        (!tab.url.includes("x.com") && !tab.url.includes("twitter.com"))
      ) {
        setOwnedTokens(0);
        setIsLoadingBalance(false);
        return;
      }

      const PROGRAM_ID = CONFIG.PROGRAM_ID;

      chrome.tabs.sendMessage(
        tab.id,
        {
          action: "GET_TOKEN_BALANCE",
          payload: {
            tokenAddress: tokenData.tokenAddress,
            walletAddress: walletAddress,
            programId: PROGRAM_ID,
          },
        },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error("Balance fetch error:", chrome.runtime.lastError);
            setOwnedTokens(0);
            setIsLoadingBalance(false);
            return;
          }

          if (response && response.success && response.balance !== undefined) {
            setOwnedTokens(response.balance || 0);
          } else {
            setOwnedTokens(0);
          }
          setIsLoadingBalance(false);
        }
      );
    } catch (error) {
      console.error("Balance fetch failed:", error);
      setOwnedTokens(0);
      setIsLoadingBalance(false);
    }
  };

  const handlePercentageClick = (percentage) => {
    if (mode === "sell") {
      if (ownedTokens <= 0) return;
      const calculatedAmount = ((ownedTokens * percentage) / 100).toFixed(9);
      setAmount(calculatedAmount);
      handleAmountChange(calculatedAmount);
    } else if (mode === "buy") {
      if (userAllocation <= 0) return;
      const calculatedAmount = ((userAllocation * percentage) / 100).toFixed(9);
      setAmount(calculatedAmount);
      handleAmountChange(calculatedAmount);
    }
  };

  // Format market cap (K for thousands, M for millions)
  const formatMarketCap = (value) => {
    if (!value || value === 0) return "—";

    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(2)}M`;
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(2)}K`;
    } else {
      return `$${value.toFixed(2)}`;
    }
  };

  const handleAmountChange = (value) => {
    setAmount(value);

    // Clear previous timer
    if (estimateTimer) {
      clearTimeout(estimateTimer);
    }

    // Only estimate if valid amount AND in BUY mode
    if (!value || parseFloat(value) <= 0 || mode === "sell") {
      setEstimatedAmount(0);
      return;
    }

    // Debounce estimation for 500ms (only for BUY mode)
    if (mode === "buy") {
      estimateTimer = setTimeout(() => {
        handleEstimateTokens(value);
      }, 500);
    }
  };

  const handleEstimateTokens = async (inputAmount) => {
    if (!inputAmount || parseFloat(inputAmount) <= 0) {
      setEstimatedAmount(0);
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
        setEstimatedAmount(0);
        setIsEstimating(false);
        return;
      }

      // Load IDL for the estimation
      const idlUrl = chrome.runtime.getURL("idl.json");
      const idlResponse = await fetch(idlUrl);
      const idl = await idlResponse.json();

      const PROGRAM_ID = CONFIG.PROGRAM_ID;

      // ✅ For KOL phase: convert tokens → SOL (reverse estimation)
      // For PUBLIC phase: convert SOL → tokens (normal estimation)
      const action = isKolPhase
        ? "ESTIMATE_SOL_FROM_TOKENS"
        : "ESTIMATE_TOKENS";

      // Build payload with correct field names based on phase
      const payload = {
        tokenAddress: tokenData.tokenAddress,
        saleAuthority: tokenData.saleAuthority || "",
        idl,
        programId: PROGRAM_ID,
      };

      // ✅ Add correct field name based on phase
      if (isKolPhase) {
        payload.amount = inputAmount; // KOL: token amount
      } else {
        payload.solAmount = inputAmount; // PUBLIC: SOL amount
      }

      chrome.tabs.sendMessage(
        tab.id,
        {
          action: action,
          payload: payload,
        },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error("Estimation error:", chrome.runtime.lastError);
            setEstimatedAmount(0);
            setIsEstimating(false);
            return;
          }

          if (response && response.success && response.data) {
            // For KOL: estimatedSol, For PUBLIC: estimatedTokens
            const estimated = isKolPhase
              ? response.data.estimatedSol || 0
              : response.data.estimatedTokens || 0;
            setEstimatedAmount(estimated);
          } else {
            setEstimatedAmount(0);
          }
          setIsEstimating(false);
        }
      );
    } catch (error) {
      console.error("Estimation failed:", error);
      setEstimatedAmount(0);
      setIsEstimating(false);
    }
  };

  const handleBuySell = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      return;
    }

    // ✅ For BUY mode in KOL phase, use estimatedAmount (SOL)
    // For BUY mode in PUBLIC phase, use amount (SOL)
    // For SELL mode, use amount (tokens)
    const transactionAmount =
      mode === "buy" && isKolPhase ? estimatedAmount : amount;

    setIsProcessing(true);

    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (
        !tab.url ||
        (!tab.url.includes("x.com") && !tab.url.includes("twitter.com"))
      ) {
        console.error("Not on X/Twitter");
        setIsProcessing(false);
        return;
      }

      // Load IDL
      const idlUrl = chrome.runtime.getURL("idl.json");
      const idlResponse = await fetch(idlUrl);
      const idl = await idlResponse.json();

      const PROGRAM_ID = CONFIG.PROGRAM_ID;

      chrome.tabs.sendMessage(
        tab.id,
        {
          action: "BUY_SELL_TOKEN",
          payload: {
            mode: mode, // "buy" or "sell"
            amount: transactionAmount, // ✅ Use calculated transaction amount
            tokenAddress: tokenData.tokenAddress,
            saleAuthority: tokenData.saleAuthority || "", // Add sale_authority from API
            idl,
            programId: PROGRAM_ID,
          },
        },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error("Buy/Sell error:", chrome.runtime.lastError);
            setError("Transaction failed: " + chrome.runtime.lastError.message);
            setIsProcessing(false);
            return;
          }

          if (response && response.success) {
            console.log("✅ Transaction successful:", response);
            const txHash =
              response.data?.txHash || response.txHash || "unknown";

            // ✅ Optimistic UI update
            if (mode === "sell") {
              const soldAmount = parseFloat(amount);
              setOwnedTokens((prevTokens) =>
                Math.max(0, prevTokens - soldAmount)
              );
              console.log(
                `📉 Optimistic update: Subtracted ${soldAmount} tokens`
              );
            } else if (mode === "buy") {
              // ✅ Optimistic UI update for BUY - subtract SOL from allocation
              const spentSOL = parseFloat(amount);
              setUserAllocation((prevAlloc) =>
                Math.max(0, prevAlloc - spentSOL)
              );
              console.log(
                `📉 Optimistic update: Subtracted ${spentSOL} SOL from allocation`
              );
            }

            setAmount("");
            setEstimatedAmount(0);
            setSuccess(
              `🎉 ${
                mode === "buy" ? "Purchase" : "Sale"
              } successful! TX: ${txHash.slice(0, 8)}...`
            );
            setError(null);

            // ✅ Wait for blockchain confirmation before fetching SOL balance (3-5 seconds)
            console.log(
              "⏳ Waiting for blockchain confirmation for SOL balance..."
            );
            setTimeout(() => {
              console.log("🔄 Fetching updated SOL balance...");
              onBalanceRefresh(); // Refresh SOL balance in App.jsx
            }, 4000); // Wait 4 seconds for SOL balance update

            setIsProcessing(false);

            // Auto-hide success message after 8 seconds
            setTimeout(() => setSuccess(null), 8000);
          } else {
            console.error("❌ Transaction failed:", response?.error);

            // Parse error message
            let errorMessage =
              response?.error || response?.data?.error || "Transaction failed.";

            // Check for user rejection
            if (
              errorMessage.includes("User rejected") ||
              errorMessage.includes("rejected the request")
            ) {
              errorMessage = "❌ Transaction cancelled by user";
            } else if (errorMessage.includes("Transaction Limit Exceeded")) {
              errorMessage =
                "⚠️ Amount exceeds transaction limit. Try a smaller amount.";
            } else if (errorMessage.includes("Insufficient funds")) {
              errorMessage = "❌ Insufficient funds in wallet";
            } else if (errorMessage.includes("simulation failed")) {
              errorMessage =
                "❌ Transaction simulation failed. Check your balance and try again.";
            }

            // ✅ For failed transactions, fetch balances immediately (no need to wait)
            onBalanceRefresh(); // Refresh SOL balance in App.jsx
            if (mode === "sell") {
              fetchOwnedTokenBalance();
            }

            setError(errorMessage);
            setSuccess(null);
            setIsProcessing(false);
          }
        }
      );
    } catch (error) {
      console.error("Buy/Sell failed:", error);
      setIsProcessing(false);
    }
  };

  return (
    <div
      style={{
        borderTop: "1px solid #333",
        paddingTop: "16px",
        marginTop: "16px",
      }}
    >
      {/* Title */}
      <h2 style={{ fontSize: "16px", marginBottom: "12px" }}>Trade Token</h2>

      {/* Buy/Sell Toggle */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          marginBottom: "16px",
        }}
      >
        <button
          onClick={() => setMode("buy")}
          style={{
            flex: 1,
            padding: "10px",
            background: mode === "buy" ? "#1d9bf0" : "#111",
            color: mode === "buy" ? "#fff" : "#888",
            border: "1px solid #333",
            borderRadius: "8px",
            cursor: "pointer",
            fontSize: "14px",
            transition: "all 0.2s",
          }}
        >
          Buy
        </button>
        <button
          onClick={() => setMode("sell")}
          style={{
            flex: 1,
            padding: "10px",
            background: mode === "sell" ? "#f91880" : "#111",
            color: mode === "sell" ? "#fff" : "#888",
            border: "1px solid #333",
            borderRadius: "8px",
            cursor: "pointer",
            fontSize: "14px",
            transition: "all 0.2s",
          }}
        >
          Sell
        </button>
      </div>

      {/* Token Info Card */}
      <div
        style={{
          background: "#111",
          border: "1px solid #333",
          borderRadius: "8px",
          padding: "12px",
          marginBottom: "16px",
        }}
      >
        {/* Token Image & Name */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginBottom: "12px",
          }}
        >
          {tokenData?.image && (
            <img
              src={tokenData.image}
              alt={tokenData.name}
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                objectFit: "cover",
              }}
            />
          )}
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: "14px",
                marginBottom: "2px",
              }}
            >
              {tokenData?.name || "Token Name"}
            </div>
            <div
              style={{
                fontSize: "12px",
                color: "#888",
              }}
            >
              ${tokenData?.symbol || "TOKEN"}
            </div>
          </div>
        </div>

        {/* Token Details */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: "8px",
            fontSize: "12px",
          }}
        >
          <div>
            <div style={{ color: "#888", marginBottom: "2px" }}>Market Cap</div>
            <div style={{ color: "#fff" }}>
              {tokenData?.marketCap
                ? formatMarketCap(tokenData.marketCap)
                : "—"}
            </div>
          </div>
          <div>
            <div style={{ color: "#888", marginBottom: "2px" }}>Price</div>
            <div style={{ color: "#fff" }}>
              {tokenData?.price ? `$${tokenData.price}` : "—"}
            </div>
          </div>
          <div>
            <div style={{ color: "#888", marginBottom: "2px" }}>Phase</div>
            <div
              style={{
                color: "#fff",
                background:
                  tokenData?.phase === "public" ? "#10B981" : "#F59E0B",
                padding: "2px 6px",
                borderRadius: "4px",
                fontSize: "10px",
                display: "inline-block",
              }}
            >
              {tokenData?.phase ? tokenData.phase.toUpperCase() : "—"}
            </div>
          </div>
        </div>

        {/* Token Address */}
        <div
          style={{
            marginTop: "8px",
            paddingTop: "8px",
            borderTop: "1px solid #222",
          }}
        >
          <div style={{ color: "#888", fontSize: "10px", marginBottom: "4px" }}>
            Token Address
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              justifyContent: "space-between",
            }}
          >
            <div
              style={{
                fontSize: "11px",
                fontFamily: "monospace",
                color: "#1d9bf0",
                flex: 1,
              }}
            >
              {tokenData?.tokenAddress
                ? `${tokenData.tokenAddress.slice(
                    0,
                    6
                  )}...${tokenData.tokenAddress.slice(-6)}`
                : "—"}
            </div>
            <button
              onClick={() => {
                window.open(
                  `https://icm-social-app.vercel.app/t/${tokenData?.tokenAddress}`,
                  "_blank"
                );
              }}
              style={{
                padding: "4px 10px",
                background: "#1d9bf0",
                color: "#fff",
                border: "none",
                borderRadius: "4px",
                fontSize: "10px",
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "all 0.2s",
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = "#1a8cd8";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = "#1d9bf0";
              }}
            >
              Visit Website
            </button>
          </div>
        </div>
      </div>

      {/* Amount Input */}
      <div style={{ marginBottom: "12px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "6px",
          }}
        >
          <label
            style={{
              fontSize: "12px",
              color: "#888",
            }}
          >
            {mode === "buy"
              ? isKolPhase
                ? "Token Allocated"
                : "SOL Amount"
              : "Token Amount"}
          </label>

          {/* ✅ Show allocation in BUY mode - KOL tokens or PUBLIC SOL */}
          {mode === "buy" && (
            <div style={{ fontSize: "11px", color: "#888" }}>
              {isLoadingAllocation ? (
                "Loading..."
              ) : (
                <>
                  Remaining: {userAllocation.toLocaleString()}{" "}
                  {isKolPhase ? tokenData?.symbol || "tokens" : "SOL"}
                </>
              )}
            </div>
          )}

          {/* Show owned tokens in sell mode */}
          {mode === "sell" && (
            <div style={{ fontSize: "11px", color: "#888" }}>
              {isLoadingBalance
                ? "Loading..."
                : `Balance: ${ownedTokens.toLocaleString()} ${
                    tokenData?.symbol || "tokens"
                  }`}
            </div>
          )}
        </div>
        <input
          type="number"
          value={amount}
          onChange={(e) => handleAmountChange(e.target.value)}
          placeholder={
            mode === "buy" ? "Use buttons below" : "Use buttons below"
          }
          disabled={true}
          style={{
            width: "100%",
            padding: "10px",
            background: "#0a0a0a",
            border: "1px solid #333",
            borderRadius: "6px",
            color: "#666",
            fontSize: "14px",
            outline: "none",
            cursor: "not-allowed",
          }}
        />

        {/* Percentage buttons for BUY mode */}
        {mode === "buy" && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: "6px",
              marginTop: "8px",
            }}
          >
            {[10, 25, 50, 100].map((percentage) => (
              <button
                key={percentage}
                onClick={() => handlePercentageClick(percentage)}
                disabled={isProcessing || userAllocation <= 0}
                style={{
                  padding: "6px",
                  background: "#111",
                  color: userAllocation <= 0 ? "#444" : "#888",
                  border: "1px solid #333",
                  borderRadius: "4px",
                  fontSize: "11px",
                  cursor:
                    isProcessing || userAllocation <= 0
                      ? "not-allowed"
                      : "pointer",
                  transition: "all 0.2s",
                  opacity: userAllocation <= 0 ? 0.5 : 1,
                }}
                onMouseOver={(e) => {
                  if (!isProcessing && userAllocation > 0) {
                    e.currentTarget.style.background = "#1d9bf0";
                    e.currentTarget.style.color = "#fff";
                  }
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = "#111";
                  e.currentTarget.style.color =
                    userAllocation <= 0 ? "#444" : "#888";
                }}
              >
                {percentage === 100 ? "Max" : `${percentage}%`}
              </button>
            ))}
          </div>
        )}

        {/* Percentage buttons for SELL mode */}
        {mode === "sell" && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: "6px",
              marginTop: "8px",
            }}
          >
            {[10, 25, 50, 100].map((percentage) => (
              <button
                key={percentage}
                onClick={() => handlePercentageClick(percentage)}
                disabled={isProcessing || ownedTokens <= 0}
                style={{
                  padding: "6px",
                  background: "#111",
                  color: ownedTokens <= 0 ? "#444" : "#888",
                  border: "1px solid #333",
                  borderRadius: "4px",
                  fontSize: "11px",
                  cursor:
                    isProcessing || ownedTokens <= 0
                      ? "not-allowed"
                      : "pointer",
                  transition: "all 0.2s",
                  opacity: ownedTokens <= 0 ? 0.5 : 1,
                }}
                onMouseOver={(e) => {
                  if (!isProcessing && ownedTokens > 0) {
                    e.currentTarget.style.background = "#f91880";
                    e.currentTarget.style.color = "#fff";
                  }
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = "#111";
                  e.currentTarget.style.color =
                    ownedTokens <= 0 ? "#444" : "#888";
                }}
              >
                {percentage === 100 ? "Max" : `${percentage}%`}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Estimation Display - Only show in BUY mode */}
      {mode === "buy" && (
        <div
          style={{
            background: "#111",
            border: "1px solid #333",
            borderRadius: "6px",
            padding: "10px",
            marginBottom: "12px",
            fontSize: "12px",
          }}
        >
          <div style={{ color: "#888", marginBottom: "4px" }}>
            {isKolPhase ? "Estimated SOL" : "You will receive"}
          </div>
          <div style={{ color: "#fff", fontSize: "14px" }}>
            {isEstimating ? (
              <span style={{ color: "#888" }}>Calculating...</span>
            ) : estimatedAmount > 0 ? (
              <>
                ~{estimatedAmount.toLocaleString()}{" "}
                {isKolPhase ? "SOL" : tokenData?.symbol}
              </>
            ) : (
              <span style={{ color: "#888" }}>
                Enter amount to see estimation
              </span>
            )}
          </div>
        </div>
      )}

      {/* Buy/Sell Button */}
      <button
        onClick={handleBuySell}
        disabled={
          !amount ||
          isProcessing ||
          parseFloat(amount) <= 0 ||
          (mode === "buy" && (isEstimating || estimatedAmount <= 0)) // ✅ Disable if estimating or no estimation in BUY mode
        }
        style={{
          width: "100%",
          padding: "12px",
          background:
            mode === "buy"
              ? !amount ||
                isProcessing ||
                parseFloat(amount) <= 0 ||
                isEstimating ||
                estimatedAmount <= 0
                ? "#0a4a7a"
                : "#1d9bf0"
              : !amount || isProcessing || parseFloat(amount) <= 0
              ? "#7a0a3f"
              : "#f91880",
          color: "#fff",
          border: "none",
          borderRadius: "8px",
          fontSize: "14px",
          cursor:
            !amount ||
            isProcessing ||
            parseFloat(amount) <= 0 ||
            (mode === "buy" && (isEstimating || estimatedAmount <= 0))
              ? "not-allowed"
              : "pointer",
          opacity:
            !amount ||
            isProcessing ||
            parseFloat(amount) <= 0 ||
            (mode === "buy" && (isEstimating || estimatedAmount <= 0))
              ? 0.5
              : 1,
          marginBottom: "12px",
        }}
      >
        {isProcessing
          ? "Processing..."
          : mode === "buy" && isEstimating
          ? "Estimating..."
          : mode === "buy"
          ? "Buy Token"
          : "Sell Token"}
      </button>

      {/* Close Button */}
      <button
        onClick={onClose}
        disabled={isProcessing}
        style={{
          width: "100%",
          padding: "10px",
          background: "transparent",
          color: "#888",
          border: "1px solid #333",
          borderRadius: "8px",
          fontSize: "13px",
          cursor: isProcessing ? "not-allowed" : "pointer",
          opacity: isProcessing ? 0.5 : 1,
        }}
      >
        Close
      </button>

      {/* Error/Success Messages */}
      {error && (
        <div
          style={{
            background: "#f91880",
            color: "#fff",
            padding: "10px",
            borderRadius: "6px",
            marginTop: "12px",
          }}
        >
          {error}
        </div>
      )}
      {success && (
        <div
          style={{
            background: "#1d9bf0",
            color: "#fff",
            padding: "10px",
            borderRadius: "6px",
            marginTop: "12px",
          }}
        >
          {success}
        </div>
      )}
    </div>
  );
}
