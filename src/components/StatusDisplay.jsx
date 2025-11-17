export default function StatusDisplay({ status, error }) {
  return (
    <>
      {/* Status */}
      {status && (
        <div style={{ 
          padding: "16px", 
          background: "#111", 
          borderRadius: "8px",
          marginBottom: "24px",
          border: "1px solid #222"
        }}>
          <div style={{ fontSize: "12px", color: "#888", marginBottom: "4px" }}>Status</div>
          <div style={{ fontSize: "16px" }}>{status}</div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ 
          padding: "16px", 
          background: "#331111", 
          borderRadius: "8px",
          marginBottom: "24px",
          border: "1px solid #661111",
          color: "#ff6666"
        }}>
          <div style={{ fontSize: "12px", marginBottom: "4px" }}>Error</div>
          <div style={{ fontSize: "14px" }}>{error}</div>
        </div>
      )}
    </>
  );
}
