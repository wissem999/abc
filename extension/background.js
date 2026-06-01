const componentUrls = [];

chrome.webRequest.onCompleted.addListener(
  (details) => {
    const url = details.url.toLowerCase();
    if (url.includes('component') || url.includes('/api/')) {
      if (!componentUrls.includes(details.url)) {
        componentUrls.push(details.url);
        chrome.tabs.query({ url: "https://*.netacad.com/*" }, (tabs) => {
          tabs.forEach(tab => {
            chrome.tabs.sendMessage(tab.id, {
              type: 'COMPONENTS_URL',
              url: details.url
            }).catch(() => {});
          });
        });
      }
    }
  },
  { urls: ["https://*.netacad.com/*"] }
);

chrome.runtime.onInstalled.addListener(() => {
  console.log('NetMate installed');
});
