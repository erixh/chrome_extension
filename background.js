// Handle messages from content script and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.openPopup) {
    // Instead of creating a new window, we'll just open the popup
    chrome.action.openPopup();
  }

  if (message.getContext) {
    // Get the active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];

      if (!tab || !tab.id) {
        console.error("[Engenium] No active tab found.");
        sendResponse({ title: "", domain: "", activeInput: "" });
        return;
      }

      // Get context from the content script in the active tab
      chrome.tabs.sendMessage(tab.id, { getContext: true }, (response) => {
        if (chrome.runtime.lastError) {
          console.error("[Engenium] Error getting context:", chrome.runtime.lastError);
          sendResponse({
            title: tab.title || "",
            domain: new URL(tab.url).hostname || "",
            activeInput: ""
          });
          return;
        }

        if (response) {
          console.log("[Engenium] Context from content script:", response);
          sendResponse(response);
        } else {
          console.log("[Engenium] No content script response, using tab info");
          sendResponse({
            title: tab.title || "",
            domain: new URL(tab.url).hostname || "",
            activeInput: ""
          });
        }
      });
    });

    return true; // Keep message channel open for async sendResponse
  }
});
