chrome.storage.local.get("theme").then(({ theme }) => {
  document.documentElement.dataset.theme = theme || "plain";
});
