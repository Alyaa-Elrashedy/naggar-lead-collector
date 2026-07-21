// Naggar Lead Collector - Service Worker
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "updateBadge") {
    const text = request.count > 0 ? request.count.toString() : "";
    chrome.action.setBadgeText({ text });
    chrome.action.setBadgeBackgroundColor({ color: "#0a66c2" });
  }
});
