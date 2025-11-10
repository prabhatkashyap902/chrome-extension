chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "OPEN_POPUP") {
    // May be ignored by Chrome if not from a direct user gesture; it's fine.
    chrome.action.openPopup().catch(() => {});
  }
});
