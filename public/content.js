function injectInpage() {
  if (document.getElementById("__ttc_inpage")) return;

  const s = document.createElement("script");
  s.src = chrome.runtime.getURL("inpage.js");
  s.id = "__ttc_inpage";
  document.documentElement.appendChild(s);
}

function waitFor(selector, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const loop = setInterval(() => {
      const el = document.querySelector(selector);
      if (el) {
        clearInterval(loop);
        resolve(el);
      }
      if (Date.now() - start > timeout) {
        clearInterval(loop);
        reject("Timeout: " + selector);
      }
    }, 200);
  });
}

function addButton(tweet) {
  if (!tweet || tweet.dataset.ttcAdded) return;
  tweet.dataset.ttcAdded = "1";

  const timeElem = tweet.querySelector("time");
  if (!timeElem) return;

  const tweetUrl = timeElem.parentElement?.href;
  if (!tweetUrl) return;

  const btn = document.createElement("button");
  btn.innerText = "Create a token";

  Object.assign(btn.style, {
    position: "absolute",
    top: "4px",
    right: "4px",
    padding: "3px 10px",
    background: "#1DA1F2",
    color: "#fff",
    fontSize: "12px",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    zIndex: 99999
  });

  tweet.style.position = "relative";
  tweet.appendChild(btn);

  btn.onclick = () => {
    chrome.storage.local.set({ lastTweetUrl: tweetUrl });

    injectInpage();

    // ask inpage to connect & sign
    window.postMessage(
      {
        source: "TTC_CONTENT",
        type: "TTC_CONNECT_AND_SIGN",
        payload: { message: "Sign for: " + tweetUrl }
      },
      "*"
    );

    chrome.runtime.sendMessage({ action: "OPEN_POPUP" });
  };
}

// observe tweet loads
const observer = new MutationObserver((mutations) => {
  mutations.forEach((m) => {
    m.addedNodes.forEach((node) => {
      if (node.nodeType === 1) {
        if (node.matches?.('article[data-testid="tweet"]')) addButton(node);
        node.querySelectorAll?.('article[data-testid="tweet"]').forEach(addButton);
      }
    });
  });
});

observer.observe(document.body, { childList: true, subtree: true });

// initial scan
waitFor('article[data-testid="tweet"]').then(() => {
  document.querySelectorAll('article[data-testid="tweet"]').forEach(addButton);
});

// receive from inpage
window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  if (event.data.source !== "TTC_INPAGE") return;

  const { type, payload, error } = event.data;

  if (type === "TTC_CONNECT_AND_SIGN_DONE") {
    chrome.storage.local.set({
      phantomConnected: true,
      walletAddress: payload.publicKey,
      signResult: payload.signature,
      lastActionStatus: "success",
      lastError: ""
    });

    chrome.runtime.sendMessage({ action: "OPEN_POPUP" });
  }

  if (type === "TTC_CONNECT_AND_SIGN_ERROR") {
    chrome.storage.local.set({
      phantomConnected: false,
      walletAddress: "",
      signResult: "",
      lastActionStatus: "error",
      lastError: error
    });

    chrome.runtime.sendMessage({ action: "OPEN_POPUP" });
  }
});
