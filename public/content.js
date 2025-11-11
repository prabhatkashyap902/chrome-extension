function injectInpage() {
  if (document.getElementById("__ttc_inpage")) return;

  const s = document.createElement("script");
  s.src = chrome.runtime.getURL("inpage.js");
  s.id = "__ttc_inpage";
  document.documentElement.appendChild(s);
}

// ✅ Get logged-in user's own username
function getLoggedInXUsername() {
  // This element always exists for the logged-in viewer
  const profileLink = document.querySelector('a[data-testid="AppTabBar_Profile_Link"]');

  if (!profileLink) return null;

  const href = profileLink.getAttribute("href"); // "/username"

  if (!href || !href.startsWith("/")) return null;

  const parts = href.split("/").filter(Boolean); // ["username"]

  return parts[0] || null;
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

function getTweetAuthor(tweet) {
  // Find the container that includes @username
  const userNameContainer = tweet.querySelector('div[data-testid="User-Name"]');

  if (!userNameContainer) return null;

  // Inside this container, find the @username exact element
  const handleSpan = Array.from(userNameContainer.querySelectorAll("span"))
    .map((s) => s.textContent.trim())
    .find((txt) => txt.startsWith("@"));

  if (!handleSpan) return null;

  return handleSpan.replace("@", "").trim();
}



function addButton(tweet) {
  if (!tweet || tweet.dataset.ttcAdded) return;

  // ✅ Get tweet author
  const author = getTweetAuthor(tweet);
  console.log("Tweet Author:", author);
  if (!author) return;

  // ✅ Compare with logged-in user
  chrome.storage.local.get("loggedInXUsername", (data) => {
    const myUser = data.loggedInXUsername;
    console.log("My user:", myUser);

    if (!myUser || author.toLowerCase() !== myUser.toLowerCase()) {
      console.log("Not my tweet → skipping");
      return;
    }

    console.log("✅ This is my tweet! Adding button.");

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
  });
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

// ✅ Store logged-in username once the page is ready
setTimeout(() => {
  const myUser = getLoggedInXUsername();
  console.log("Logged-in X username detected:", myUser);

  chrome.storage.local.set({ loggedInXUsername: myUser || "" });
}, 1500);


