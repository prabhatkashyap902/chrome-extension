import { useEffect, useState } from "react";

export default function App() {
  const [tweetUrl, setTweetUrl] = useState("");
  const [wallet, setWallet] = useState("");
  const [status, setStatus] = useState("");
  const [signature, setSignature] = useState("");
  const [err, setErr] = useState("");
  const [myXUsername, setMyXUsername] = useState("");

  useEffect(() => {
    const load = () => {
      chrome.storage.local.get(
        [
          "lastTweetUrl",
          "walletAddress",
          "signResult",
          "lastActionStatus",
          "lastError",
          "loggedInXUsername",
        ],
        (data) => {
          if (data.lastTweetUrl) setTweetUrl(data.lastTweetUrl);
          if (data.walletAddress) setWallet(data.walletAddress);
          if (data.signResult) setSignature(data.signResult);
          if (data.lastActionStatus) setStatus(data.lastActionStatus);
          if (data.lastError) setErr(data.lastError);
          if (data.loggedInXUsername) setMyXUsername(data.loggedInXUsername);
        }
      );
    };

    load();
    chrome.storage.onChanged.addListener(load);
    return () => chrome.storage.onChanged.removeListener(load);
  }, []);

  return (
    <div style={{ padding: 16, display: "grid", gap: 12 }}>
      <h2>Tweet Token Creator</h2>
      <div>
        <b>Your X Username:</b>
        <br />
        {myXUsername ? "@" + myXUsername : "Not detected"}
      </div>

      <div>
        <b>Tweet:</b> <br /> {tweetUrl || "-"}
      </div>
      <div>
        <b>Wallet:</b> <br /> {wallet || "Not connected"}
      </div>

      <div>
        <b>Status:</b> <br /> {status || "Idle"}
      </div>

      {signature && (
        <div>
          <b>Signature:</b>
          <textarea
            readOnly
            value={signature}
            style={{ width: "100%", height: 80 }}
          />
        </div>
      )}

      {status === "error" && (
        <div style={{ color: "red", whiteSpace: "pre-wrap" }}>Error: {err}</div>
      )}
    </div>
  );
}
