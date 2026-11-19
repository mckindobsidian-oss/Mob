if(typeof importScripts === "function")importScripts("usage-rules.js");
const RuleEngine=globalThis.MobUsageRules;
const sites = new Set(["https://usemob.netlify.app", "http://localhost:4173", "http://127.0.0.1:4173"]);
const API = "https://xrvqyraafmwpfenysmfo.supabase.co";
const YOUTUBE = "*://*.youtube.com/*";
const connectionKeys = ["connection", "cloud", "browserUsage", "focusPolicy", "browserSyncAt", "usage", "siteOther", "ruleOther", "ruleSessions"];
const ruleIds = [1, 2];
const defaults = { blockShorts: false, limit: 0 };
let work = Promise.resolve();
let syncWork;
const syncInterval = 5 * 60_000;
const validDomain = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9-]{2,63}$/;

function enqueue(action) {
  const next = work.then(action);
  work = next.catch(() => {});
  return next;
}

const dateKey = () => new Date().toISOString().slice(0, 10);

async function state() {
  const { connection, cloud, local, usage, syncStatus, tracking, browserUsage } = await chrome.storage.local.get(["connection", "cloud", "local", "usage","syncStatus","tracking","browserUsage"]);
  const safeUsage = usage?.day === dateKey() ? usage : { day: dateKey(), seconds: 0 };
  const preferences = connection && cloud ? cloud : local || defaults;
  const total = safeUsage.seconds + (connection && cloud?.day === safeUsage.day ? cloud.other : 0);
  return {
    ...preferences, activity:{epoch:browserUsage?.epoch||0,rows:Object.values(browserUsage?.rows||{}).slice(-500)}, tracking:tracking===true, usage: safeUsage, total, linked: Boolean(connection), synced: Boolean(connection && cloud?.synced),
    owner: connection?.owner || "",
    userActive: await chrome.idle.queryState(60) === "active",
    syncStatus: syncStatus || (connection ? "Waiting to sync" : "Browser not linked"),
    lastSync: cloud?.syncedAt || 0,
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
  const {browserUsage,siteOther={}}=await chrome.storage.local.get(["browserUsage","siteOther"]);
  const daily={};
  for(const row of Object.values(browserUsage?.rows || {})) if(row.hour.slice(0,10)===dateKey()) daily[row.label]=(daily[row.label]||0)+row.seconds;
  const domainSeconds=domain=>[...new Set([...Object.keys(daily),...Object.keys(siteOther)])]
    .filter(key=>key===domain || key.endsWith('.'+domain))
    .reduce((sum,key)=>sum+(daily[key]||0)+(siteOther.day===dateKey() ? siteOther[key]||0 : 0),0);
  const {ruleOther={},ruleSessions={}}=await chrome.storage.local.get(["ruleOther","ruleSessions"]);
  const allDaily=ruleOther.day===dateKey()?{...ruleOther.values}:{};
  for(const [label,seconds] of Object.entries(daily))allDaily['website:'+label]=(allDaily['website:'+label]||0)+seconds;
  const ruleDomains=RuleEngine?RuleEngine.clean(focusPolicy?.rules).filter(rule=>RuleEngine.blocked(rule,{daily:allDaily,session:ruleSessions[rule.id]&&Date.now()-ruleSessions[rule.id].at<=60000?ruleSessions[rule.id].seconds:0,focusUntil:focusPolicy?.until})).flatMap(rule=>rule.items.filter(i=>i.kind==='website').map(i=>i.label)):[];
  const exceeded=Object.entries(focusPolicy?.siteLimits || {}).filter(([domain,minutes])=>validDomain.test(domain) && Number(minutes)>0 && domainSeconds(domain)>=minutes*60).map(([domain])=>domain);
  exceeded.push(...ruleDomains);
  await chrome.declarativeNetRequest.updateDynamicRules({removeRuleIds:[101],addRules:exceeded.length ? [{id:101,priority:101,action:{type:"block"},condition:{requestDomains:[...new Set(exceeded)],excludedRequestDomains:[...sites].map(site=>new URL(site).hostname),resourceTypes:["main_frame"]}}] : []});
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
  if (chrome.tabs.query && chrome.tabs.update) {
    const [tab]=await chrome.tabs.query({active:true,lastFocusedWindow:true});
    if(tab && !tab.incognito && (await chrome.windows.get(tab.windowId)).focused) {
      try {
        const url=new URL(tab.url);
        if(!sites.has(url.origin) && [...domains,...exceeded].some(domain=>url.hostname===domain || url.hostname.endsWith("."+domain)))
          await chrome.tabs.update(tab.id,{url:chrome.runtime.getURL("blocked.html")});
      } catch { /* Internal tabs and tabs closed during a sample need no action. */ }
    }
  }
  return status;
}

async function setFocus(policy) {
  const domains = Array.isArray(policy.sites) ? policy.sites.filter(value => typeof value === "string" && validDomain.test(value)).slice(0, 30) : [];
  const now = Date.now();
  const until = Number(policy.until);
  await chrome.storage.local.set({ focusPolicy: { rules:RuleEngine?RuleEngine.clean(policy.rules):[], siteLimits:Object.fromEntries(Object.entries(policy.siteLimits || {}).filter(([d,n])=>validDomain.test(d) && Number.isInteger(n) && n>0 && n<=1440).slice(0,30)), sites: domains, until: until > now && until <= now + 120 * 60_000 ? until : 0 },
    theme: ["plain", "daylight", "ocean", "forest", "photo"].includes(policy.theme) ? policy.theme : "plain" });
  if (typeof policy.shorts==="boolean" && Number.isInteger(policy.limit) && policy.limit>=0 && policy.limit<=1440) {
    const {cloud}=await chrome.storage.local.get("cloud");
    await chrome.storage.local.set({cloud:{...cloud,blockShorts:policy.shorts,limit:policy.limit}});
  }
}

async function sampleBrowser(reset = false, finishPrevious = false, at = Date.now()) {
  const { connection, tracking, browserUsage = { epoch: 0, rows: {} } } = await chrome.storage.local.get(["connection","tracking","browserUsage"]);
  if (!connection || !tracking) return;
  const now = at;
  const last = browserUsage.at || 0;
  const before = browserUsage.domain;
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  const window = tab && await chrome.windows.get(tab.windowId);
  let domain = "";
  if (window?.focused && window.state !== "minimized" && !tab.incognito && await chrome.idle.queryState(60) === "active") {
    try {
      const url = new URL(tab.url);
      if (["https:", "http:"].includes(url.protocol)) domain = url.hostname.replace(/^www\./, "");
    } catch { /* Browser-internal pages have no tracked host. */ }
  }
  browserUsage.at = now;
  browserUsage.domain = domain;
  const sameTab = browserUsage.tab === tab?.id;
  browserUsage.tab = tab?.id;
  const seconds = Math.floor((now - last) / 1000);
  const closing = finishPrevious && before && browserUsage.counted !== undefined;
  const countedDomain = closing ? before : domain;
  if ((closing || (!reset && sameTab && domain === before)) && countedDomain &&
      countedDomain.length <= 100 && seconds > 0 && seconds <= 45) {
    let start=last;
    let visit=!browserUsage.counted;
    while (start<now) {
      const boundary=Math.floor(start/3_600_000)*3_600_000;
      const end=Math.min(now,boundary+3_600_000);
      const hour=new Date(boundary).toISOString();
      const key=hour+"/"+countedDomain;
      const row=browserUsage.rows[key] || {hour,label:countedDomain,source:"website",seconds:0,visits:0};
      row.seconds=Math.min(3600,row.seconds+(end-start)/1000);
      if (visit) row.visits=Math.min(3600,row.visits+1);
      browserUsage.rows[key]=row;
      start=end; visit=false;
    }
    browserUsage.counted = true;
  } else browserUsage.counted = false;
  if (reset) browserUsage.counted = false;
  for (const [key, row] of Object.entries(browserUsage.rows)) {
    if (Date.parse(row.hour) < now - 7 * 24 * 3_600_000) delete browserUsage.rows[key];
  }
  const {focusPolicy,ruleSessions={}}=await chrome.storage.local.get(["focusPolicy","ruleSessions"]);
  const sessions=RuleEngine?RuleEngine.advance(focusPolicy?.rules||[],ruleSessions,'website',domain,domain&&seconds>0&&seconds<=45&&before===domain?seconds:0,now):ruleSessions;
  await chrome.storage.local.set({ browserUsage,ruleSessions:sessions });
}

async function pullPolicy(force = false) {
  if (syncWork) return syncWork;
  syncWork=syncPolicy(force);
  try { return await syncWork; } finally { syncWork=null; }
}

async function syncPolicy(force) {
  const { connection, browserSyncAt = 0, localPolicyAt = 0, browserUsage = { epoch: 0, rows: {} } } =
    await chrome.storage.local.get(["connection", "browserSyncAt", "browserUsage","localPolicyAt"]);
  if (!connection) return apply();
  if (!force && Date.now()>=browserSyncAt && Date.now()-browserSyncAt<syncInterval) return state();
  await chrome.storage.local.set({ browserSyncAt: Date.now() });
  const { usage, granted } = await state();
  const seconds = granted ? Math.floor(usage.seconds) : 0;
  const headers = { apikey: connection.key, "content-type": "application/json" };
  try {
    const rows = Object.entries(browserUsage.rows).filter(([, row]) => Math.floor(row.seconds) > (row.sent || 0)).slice(0, 80)
      .map(([id,row])=>[id,{...row,seconds:Math.floor(row.seconds)}]);
    const flow = await fetch(API + "/rest/v1/rpc/mob_flow_browser", {
      method: "POST", headers, signal: AbortSignal.timeout(5000),
      body: JSON.stringify({ token: connection.token, generation: browserUsage.epoch,
        batch: rows.map(([, { sent, ...row }]) => row) })
    });
    if (flow.ok) {
      const policy = await flow.json();
      await enqueue(async()=>{
        const current=await chrome.storage.local.get(["connection","browserUsage","localPolicyAt"]);
        if (current.connection?.token!==connection.token) return;
        if (!policy) { await chrome.storage.local.remove(connectionKeys); return; }
        if (!Number.isSafeInteger(policy.epoch) || policy.epoch<(current.browserUsage?.epoch || 0)) return;
        if ((current.localPolicyAt || 0)===localPolicyAt) await setFocus(policy);
        const own={};
        for(const row of Object.values(browserUsage.rows)) if(row.hour.slice(0,10)===dateKey()) own[row.label]=(own[row.label]||0)+row.seconds;
        await chrome.storage.local.set({siteOther:{...Object.fromEntries(Object.entries(policy.siteUsage||{}).map(([d,n])=>[d,Math.max(0,n-(own[d]||0))])),day:policy.day||dateKey()}});
        const ruleOwn={};
        for(const row of Object.values(browserUsage.rows))if(row.hour.slice(0,10)===dateKey())ruleOwn['website:'+row.label]=(ruleOwn['website:'+row.label]||0)+row.seconds;
        await chrome.storage.local.set({ruleOther:{day:policy.day||dateKey(),values:Object.fromEntries(Object.entries(policy.ruleUsage||{}).map(([id,n])=>[id,Math.max(0,n-(ruleOwn[id]||0))]))}});
        const latest=current.browserUsage || browserUsage;
        if (policy.epoch!==latest.epoch) {
          const retained=Object.fromEntries(Object.entries(latest.rows)
            .filter(([,row])=>Date.parse(row.hour)>=policy.epoch)
            .map(([id,row])=>[id,{...row,sent:0}]));
          await chrome.storage.local.set({ browserUsage:{epoch:policy.epoch,rows:retained} });
        } else {
          for (const [id,row] of rows) if (latest.rows[id]) latest.rows[id].sent=row.seconds;
          await chrome.storage.local.set({browserUsage:latest});
        }
      });
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
      await enqueue(async()=>{
        const current=await chrome.storage.local.get(["connection","localPolicyAt"]);
        if (current.connection?.token!==connection.token) return;
        if ((current.localPolicyAt || 0)!==localPolicyAt) return;
        if (!row) await chrome.storage.local.remove(connectionKeys);
        else await chrome.storage.local.set({cloud:{
          blockShorts:row.block_shorts,limit:row.daily_limit_minutes,synced,day:usage.day,
          other:Math.max(0,(row.total_seconds || 0)-usage.seconds),syncedAt:Date.now()
        },syncStatus:"Shared budget connected · totals may be up to 5 minutes behind"});
      });
    }
  } catch {
    if ((await chrome.storage.local.get("connection")).connection?.token===connection.token)
      await chrome.storage.local.set({syncStatus:"Offline or unavailable · usage queued"});
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
function restore() {
  schedule();
  void enqueue(async () => { await sampleBrowser(true); await apply(); });
  void pullPolicy();
}
chrome.runtime.onInstalled.addListener(restore);
chrome.runtime.onStartup.addListener(restore);
chrome.permissions.onAdded.addListener(() => void enqueue(apply));
chrome.permissions.onRemoved.addListener(() => void enqueue(apply));
const resetSample = () => {
  const at = Date.now();
  void enqueue(() => sampleBrowser(true, true, at));
};
chrome.tabs.onActivated.addListener(resetSample);
async function resetTrackedTab(id) {
  const {browserUsage}=await chrome.storage.local.get("browserUsage");
  if (browserUsage?.tab===id) resetSample();
}
chrome.tabs.onUpdated.addListener((id, change) => { if (change.url) void resetTrackedTab(id); });
chrome.tabs.onRemoved.addListener(id=>void resetTrackedTab(id));
chrome.windows.onFocusChanged.addListener(resetSample);
chrome.idle.onStateChanged.addListener(() => void enqueue(() => sampleBrowser(true)));
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === "mob-midnight") schedule();
  if (alarm.name === "mob-activity") void enqueue(async() => {await sampleBrowser();await apply();});
  else if (alarm.name === "mob-focus-end") void enqueue(apply);
  else void pullPolicy();
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
      if (!/^[a-f0-9-]{36}$/.test(message.owner || "")) return {ok:false};
      await chrome.storage.local.set({ connection: { token: message.token, key: message.key, owner: message.owner } });
      const status = await pullPolicy(true);
      if (!status.linked || !Object.hasOwn(await chrome.storage.local.get("focusPolicy"), "focusPolicy")) {
        await chrome.storage.local.remove(connectionKeys);
        return { ok: false };
      }
      return { ...status, ok: true };
    }
    if (fromMob && message.type === "browser-tracking") {
      await chrome.storage.local.set({ tracking: message.enabled === true });
      await sampleBrowser(true);
      return state();
    }
    if (fromMob && message.type === "focus-policy") {
      return enqueue(async()=>{
        const current=await state();
        if (current.linked && current.owner===message.owner) {
          await chrome.storage.local.set({localPolicyAt:crypto.randomUUID()});
          await setFocus(message.policy || {});
        }
        return apply();
      });
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
    if (fromYouTube && message.type === "activity" && sender.tab?.active && !sender.tab.incognito) {
      const status = await state();
      if (!status.granted || status.over) return status;
      const active = await chrome.windows.get(sender.tab.windowId).catch(() => null);
      if (!active?.focused || !status.userActive) return status;
      const {youtubeSample}=await chrome.storage.local.get("youtubeSample");
      const now=Date.now();
      const elapsed=youtubeSample?.tab===sender.tab.id && now-youtubeSample.at<8000
        ? Math.max(0,(now-youtubeSample.at)/1000) : 0;
      const usage = { ...status.usage, seconds: Math.min(86400, status.usage.seconds + elapsed) };
      await chrome.storage.local.set({ usage,youtubeSample:{tab:sender.tab.id,at:now} });
      if (status.limit > 0 && status.total + elapsed >= status.limit * 60) {
        const blocked = await apply();
        return blocked;
      }
      return state();
    }
    return { ok: false };
  };
  const action=message.type==="activity" ? enqueue(handle) : handle();
  void action.then(respond, () => respond({ ok: false }));
  return true;
});
