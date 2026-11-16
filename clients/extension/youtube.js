(() => {
  if (globalThis.mobYouTubeActive) return;
  globalThis.mobYouTubeActive = true;
  let policy = {};
  const shorts = /^\/(shorts|feed\/shorts)(\/|$)/i;
  function guard() {
    if (!policy.granted) return;
    if (policy.over || (policy.blockShorts && shorts.test(location.pathname))) {
      location.replace(chrome.runtime.getURL("blocked.html"));
    }
    document.documentElement?.classList.toggle("mob-hide-shorts", Boolean(policy.blockShorts));
  }
  async function check(type) {
    try { policy = await chrome.runtime.sendMessage({ type }); guard(); }
    catch { document.documentElement?.classList.remove("mob-hide-shorts"); }
  }
  function hideShorts() {
    if (!document.head) return;
    const style = document.createElement("style");
    style.textContent = ".mob-hide-shorts a[href^='/shorts/'],.mob-hide-shorts a[href='/shorts'],.mob-hide-shorts ytd-reel-shelf-renderer,.mob-hide-shorts ytd-rich-shelf-renderer[is-shorts],.mob-hide-shorts ytm-reel-shelf-renderer {display:none!important}";
    document.head.append(style);
    guard();
  }
  document.addEventListener("DOMContentLoaded", hideShorts, { once: true });
  if (document.readyState !== "loading") hideShorts();
  window.addEventListener("yt-navigate-finish", guard);
  window.addEventListener("popstate", guard);
  window.addEventListener("pageshow", () => void check("status"));
  chrome.storage.onChanged.addListener(changes => {
    if (changes.cloud || changes.local || changes.connection) void check("status");
  });
  setInterval(() => {
    if (!document.hidden && document.hasFocus()) void check("activity");
  }, 5000);
  void check("status");
})();
