export default function Instructions() {
  return (
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
        <li style={{ marginBottom: "8px" }}>Make sure wallet is on <strong style={{ color: "#fff" }}>Devnet</strong></li>
        <li style={{ marginBottom: "8px" }}>Go to your profile on X/Twitter</li>
        <li style={{ marginBottom: "8px" }}>Click "Create a token" on your tweet</li>
        <li>Fill in the form and create your token</li>
      </ol>
    </div>
  );
}
