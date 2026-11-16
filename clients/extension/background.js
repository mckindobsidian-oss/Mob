const sites = new Set(["https://mob-focus-north.autumnalaspen.chatgpt.site", "http://localhost:4173", "http://127.0.0.1:4173"]);
const API = "https://xrvqyraafmwpfenysmfo.supabase.co";
const YOUTUBE = "*://*.youtube.com/*";
const connectionKeys = ["connection", "cloud", "browserUsage", "focusPolicy", "browserSyncAt", "usage"];
const ruleIds = [1, 2];
const defaults = { blockShorts: true, limit: 0 };
let work = Promise.resolve();
const syncInterval = 15 * 60_000;
const validDomain = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9-]{2,63}$/;

function enqueue(action) {
  const next = work.then(action);
  work = next.catch(() => {});
  return next;
}

const dateKey = () => new Date().toISOString().slice(0, 10);

async function state() {
  const { connection, cloud, local, usage } = await chrome.storage.local.get(["connection", "cloud", "local", "usage"]);
  const safeUsage = usage?.day === dateKey() ? usage : { day: dateKey(), seconds: 0 };
  const preferences = connection && cloud ? cloud : local || defaults;
  const total = safeUsage.seconds + (connection && cloud?.day === safeUsage.day ? cloud.other : 0);
  return {
    ...preferences, usage: safeUsage, total, linked: Boolean(connection), synced: Boolean(connection && cloud?.synced),
    granted: await chrome.permissions.contains({ origins: [YOUTUBE] }),
    over: preferences.limit > 0 && total >= preferences.limit * 60
  };
}

async function apply() {
  const status = await state();
  const installed = await chrome.scripting.getRegisteredContentScripts({ ids: ["mob-youtube"] });
  if (status.granted && !installed.length) {
    await chrome.scripting.registerContentScripts([{ id: "mob-youtube", js: ["youtube.js"], matches: [YOUTUBE], runAt: "document_start" }]);
    for (const tab of await chrome.tabs.query({ url: [YOUTUBE] })) {
      if (tab.id) void chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["youtube.js"] }).catch(() => {});
    }
  } else if (!status.granted && installed.length) {
    await chrome.scripting.unregisterContentScripts({ ids: ["mob-youtube"] });
  }
  const rules = [];
  const newRule = (id, regexFilter) => ({
    id, priority: id, action: { type: "redirect", redirect: { extensionPath: "/blocked.html" } },
    condition: { regexFilter, resourceTypes: ["main_frame"] }
  });
  if (status.granted && status.blockShorts) rules.push(newRule(1, "^https?://([a-z0-9-]+\\.)*youtube\\.com/(shorts|feed/shorts)([/?#]|$)"));
  if (status.granted && status.over) rules.push(newRule(2, "^https?://([a-z0-9-]+\\.)*youtube\\.com/"));
  await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: ruleIds, addRules: rules });
  const { focusPolicy } = await chrome.storage.local.get("focusPolicy");
  const domains = focusPolicy?.until > Date.now() ? focusPolicy.sites : [];
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [100],
    addRules: domains.length ? [{
      id: 100, priority: 100, action: { type: "block" },
      condition: { requestDomains: domains, excludedRequestDomains: [...sites].map(site => new URL(site).hostname),
        resourceTypes: ["main_frame"] }
    }] : []
  });
  await chrome.alarms.clear("mob-focus-end");
  if (domains.length) await chrome.alarms.create("mob-focus-end", { when: focusPolicy.until });
  return status;
}

async function setFocus(policy) {
  const domains = Array.isArray(policy.sites) ? policy.sites.filter(value => typeof value === "string" && validDomain.test(value)).slice(0, 30) : [];
  const now = Date.now();
  const until = Number(policy.until);
  await chrome.storage.local.set({ focusPolicy: { sites: domains, until: until > now && until <= now + 120 * 60_000 ? until : 0 },
    theme: ["plain", "daylight", "ocean", "forest", "photo"].includes(policy.theme) ? policy.theme : "plain" });
}

async function sampleBrowser() {
  const { connection, tracking, browserUsage = { epoch: 0, rows: {} } } = await chrome.storage.local.get(["connection","tracking","browserUsage"]);
  if (!connection || !tracking) return;
  const now = Date.now();
  const last = browserUsage.at || 0;
  const before = browserUsage.domain;
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  const window = tab && await chrome.windows.get(tab.windowId);
  let domain = "";
  if (window?.focused && !tab.incognito && await chrome.idle.queryState(60) === "active") {
    try {
      const url = new URL(tab.url);
      if (["https:", "http:"].includes(url.protocol) && !sites.has(url.origin) && !url.hostname.endsWith(".supabase.co")) domain = url.hostname.replace(/^www\./, "");
    } catch { /* Browser-internal pages have no tracked host. */ }
  }
  browserUsage.at = now;
  browserUsage.domain = domain;
  const seconds = Math.floor((now - last) / 1000);
  if (domain && domain.length <= 100 && domain === before && seconds > 0 && seconds <= 45) {
    const hour = new Date(Math.floor(now / 3_600_000) * 3_600_000).toISOString();
    const key = hour + "/" + domain;
    const row = browserUsage.rows[key] || { hour, label: domain, source: "website", seconds: 0, visits: 0 };
    row.seconds = Math.min(3600, row.seconds + seconds);
    if (!browserUsage.counted) row.visits = Math.min(3600, row.visits + 1);
    browserUsage.rows[key] = row;
    browserUsage.counted = true;
  } else browserUsage.counted = false;
  for (const [key, row] of Object.entries(browserUsage.rows)) {
    if (Date.parse(row.hour) < now - 7 * 24 * 3_600_000) delete browserUsage.rows[key];
  }
  await chrome.storage.local.set({ browserUsage });
}

async function pullPolicy(force = false) {
  const { connection, browserSyncAt = 0, browserUsage = { epoch: 0, rows: {} } } =
    await chrome.storage.local.get(["connection", "browserSyncAt", "browserUsage"]);
  if (!connection) return apply();
  if (!force && Date.now() - browserSyncAt < syncInterval) return state();
  await chrome.storage.local.set({ browserSyncAt: Date.now() });
  const { usage, granted } = await state();
  const seconds = granted ? usage.seconds : 0;
  const headers = { apikey: connection.key, "content-type": "application/json" };
  try {
    const rows = Object.entries(browserUsage.rows).filter(([, row]) => row.seconds > (row.sent || 0)).slice(0, 120);
    const flow = await fetch(API + "/rest/v1/rpc/mob_flow_browser", {
      method: "POST", headers, signal: AbortSignal.timeout(5000),
      body: JSON.stringify({ token: connection.token, generation: browserUsage.epoch,
        batch: rows.map(([, { sent, ...row }]) => row) })
    });
    if (flow.ok) {
      const policy = await flow.json();
      if (!policy) { await chrome.storage.local.remove(connectionKeys); return apply(); }
      await setFocus(policy);
      if (policy.epoch !== browserUsage.epoch) {
        await chrome.storage.local.set({ browserUsage: { epoch: policy.epoch, rows: {} }, usage: { day: dateKey(), seconds: 0 } });
        return apply();
      }
      for (const [, row] of rows) row.sent = row.seconds;
      await chrome.storage.local.set({ browserUsage });
    }
    let response = await fetch(API + "/rest/v1/rpc/mob_youtube_budget", {
      method: "POST",
      headers,
      body: JSON.stringify({ p_token: connection.token, p_day: usage.day, p_seconds: seconds }),
      signal: AbortSignal.timeout(5000)
    });
    const synced = response.ok;
    if (response.status === 404) response = await fetch(API + "/rest/v1/rpc/mob_companion_policy", {
      method: "POST", headers, body: JSON.stringify({ p_token: connection.token }), signal: AbortSignal.timeout(5000)
    });
    if (response.ok) {
      const [row] = await response.json();
      if (!row) await chrome.storage.local.remove(connectionKeys);
      else await chrome.storage.local.set({ cloud: {
        blockShorts: row.block_shorts, limit: row.daily_limit_minutes, synced, day: usage.day,
        other: Math.max(0, (row.total_seconds || 0) - usage.seconds)
      } });
    }
  } catch {
    // Keep the last successfully synced blocking policy while offline.
  }
  return apply();
}

function schedule() {
  void chrome.alarms.create("mob-policy", { periodInMinutes: 1 });
  void chrome.alarms.create("mob-activity", { periodInMinutes: 0.5 });
  const midnight = new Date();
  midnight.setUTCHours(24, 0, 1, 0);
  void chrome.alarms.create("mob-midnight", { when: +midnight });
}
chrome.runtime.onInstalled.addListener(() => { schedule(); void enqueue(pullPolicy); });
chrome.runtime.onStartup.addListener(() => { schedule(); void enqueue(pullPolicy); });
chrome.permissions.onAdded.addListener(() => void enqueue(apply));
chrome.permissions.onRemoved.addListener(() => void enqueue(apply));
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === "mob-midnight") schedule();
  if (alarm.name === "mob-activity") void enqueue(sampleBrowser);
  else if (alarm.name === "mob-focus-end") void enqueue(apply);
  else void enqueue(() => pullPolicy());
});

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  const origin = new URL(sender.url || chrome.runtime.getURL("/")).origin;
  const fromMob = sites.has(origin);
  const fromPopup = sender.url === chrome.runtime.getURL("popup.html");
  const fromYouTube = /^https?:\/\/([a-z0-9-]+\.)*youtube\.com$/.test(origin);
  const handle = async () => {
    if (fromMob && message.type === "status") {
      let { device } = await chrome.storage.local.get("device");
      if (!device) {
        device = crypto.randomUUID();
        await chrome.storage.local.set({ device });
      }
      return { ...(await state()), device };
    }
    if (fromMob && message.type === "pair") {
      if (message.url !== API || !/^[a-f0-9]{64}$/.test(message.token) ||
          !/^(sb_publishable_[a-z0-9_-]+|eyJ[a-zA-Z0-9._-]+)$/i.test(message.key)) return { ok: false };
      await chrome.storage.local.remove(connectionKeys);
      await chrome.storage.local.set({ connection: { token: message.token, key: message.key } });
      const status = await pullPolicy(true);
      if (!status.linked || !Object.hasOwn(await chrome.storage.local.get("focusPolicy"), "focusPolicy")) {
        await chrome.storage.local.remove(connectionKeys);
        return { ok: false };
      }
      return { ...status, ok: true };
    }
    if (fromMob && message.type === "browser-tracking") {
      await chrome.storage.local.set({ tracking: message.enabled === true });
      return state();
    }
    if (fromMob && message.type === "focus-policy") {
      if ((await state()).linked) await setFocus(message.policy || {});
      return apply();
    }
    if (fromMob && message.type === "policy-changed") {
      if (message.local && !(await state()).linked) {
        const limit = Math.max(0, Math.min(1440, Math.trunc(Number(message.local.limit) || 0)));
        await chrome.storage.local.set({ local: { blockShorts: message.local.blockShorts === true, limit } });
      }
      return pullPolicy();
    }
    if ((fromMob || fromPopup) && message.type === "disconnect") {
      await chrome.storage.local.remove(connectionKeys);
      return apply();
    }
    if (fromPopup && message.type === "save") {
      await chrome.storage.local.set({ local: { blockShorts: message.blockShorts === true, limit: Math.max(0, Math.min(1440, Math.trunc(Number(message.limit) || 0))) } });
      return apply();
    }
    if ((fromPopup || fromYouTube) && message.type === "status") return state();
    if (fromYouTube && message.type === "activity" && sender.tab?.active) {
      const status = await state();
      if (!status.granted || status.over) return status;
      const active = await chrome.windows.get(sender.tab.windowId).catch(() => null);
      if (!active?.focused) return status;
      const usage = { ...status.usage, seconds: Math.min(86400, status.usage.seconds + 5) };
      await chrome.storage.local.set({ usage });
      if (status.limit > 0 && status.total + 5 >= status.limit * 60) {
        const blocked = await apply();
        return blocked;
      }
      return state();
    }
    return { ok: false };
  };
  void enqueue(handle).then(respond, () => respond({ ok: false }));
  return true;
});
