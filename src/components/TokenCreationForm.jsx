export default function TokenCreationForm({
  tweetData,
  tokenName,
  tokenSymbol,
  solAmount,
  imagePreview,
  isCreating,
  onTokenNameChange,
  onTokenSymbolChange,
  onSolAmountChange,
  onImageUpload,
  onCreate,
}) {
  return (
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
          onChange={onImageUpload}
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
          onChange={(e) => onTokenNameChange(e.target.value)}
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
          onChange={(e) => onTokenSymbolChange(e.target.value.toUpperCase())}
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

      {/* SOL Amount */}
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
          SOL Amount
        </label>
        <input
          type="number"
          value={solAmount}
          onChange={(e) => onSolAmountChange(e.target.value)}
          placeholder="Enter SOL amount"
          step="0.01"
          min="0.01"
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
        onClick={onCreate}
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
  );
}
