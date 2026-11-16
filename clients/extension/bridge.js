function announce(type, status) {
  window.postMessage({ source: "mob-extension", type, status }, location.origin);
}
async function report(type = "available") {
  try { announce(type, await chrome.runtime.sendMessage({ type: "status" })); }
  catch { /* The extension can reload while the page is open. */ }
}
const origins = ["https://mob-focus-north.autumnalaspen.chatgpt.site", "http://localhost:4173", "http://127.0.0.1:4173"];
window.addEventListener("message", async event => {
  if (!origins.includes(location.origin) || event.source !== window || event.origin !== location.origin || event.data?.source !== "mob-web") return;
  const { type, token, url, key, local, policy, enabled } = event.data;
  if (type === "discover") return report();
  if (!["pair", "policy-changed", "disconnect", "focus-policy", "browser-tracking"].includes(type)) return;
  try {
    const result = await chrome.runtime.sendMessage({ type, token, url, key, local, policy, enabled });
    await report(type === "pair" ? (result?.ok ? "paired" : "pair-failed") : "status");
  } catch {
    if (type === "pair") announce("pair-failed");
  }
});
if (origins.includes(location.origin)) {
  void report();
  chrome.storage.onChanged.addListener(changes => {
    if (changes.connection || changes.cloud || changes.local || changes.usage) void report("status");
  });
}
