import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { activityFor, defaults, newTimer, nextTimer, offsetDay, safeYouTubeLink, spotifySource, streakFor, timerRemaining, usageByDay, usernameFor } from "./dist/core.js";
import { publicConfig } from "./dist/supabase.js";
import { settingsQueue } from "./dist/settings-queue.js";

const tick = 100_000;
const focus = newTimer(defaults, "focus", { endsAt: tick, rounds: 3 });
assert.equal(timerRemaining(focus, tick - 10_000), 10_000);
assert.equal(timerRemaining(focus, tick + 1000), 0);

const longBreak = nextTimer(focus, { ...defaults, autoBreak: true }, tick + 120, true);
assert.equal(longBreak.mode, "long");
assert.equal(longBreak.rounds, 4);
assert.equal(longBreak.endsAt, tick + 15 * 60_000);
assert.equal(nextTimer(focus, defaults, tick, false).rounds, 3);
assert.equal(nextTimer(focus, { ...defaults, autoBreak: true }, tick + 120_000, true).endsAt, null);
assert.equal(nextTimer(longBreak, defaults, longBreak.endsAt, true).mode, "focus");

const days = activityFor([{ completedDay: "2024-02-28" }, { completedDay: "" }], [{ day: "2024-02-29" }]);
assert.deepEqual(streakFor(days, "2024-03-01"), { current: 2, best: 2 });
assert.deepEqual(streakFor(days, "2024-03-02"), { current: 0, best: 2 });
assert.equal(offsetDay("2024-02-28", 2), "2024-03-01");
assert.equal(usernameFor(" Mób North & Designer ", "ABCDEF123"), "mo-b-north-desig-abcdef");

const dist = new URL("./dist/", import.meta.url);
for (const asset of ["supabase-config.js", "focus-lake.jpg", "focus-coast.mp4", "icon.svg"]) await access(new URL(asset, dist));
const clip = await readFile(new URL("focus-coast.mp4", dist));
assert.equal(clip.toString("ascii", 4, 8), "ftyp");
assert.equal(spotifySource("https://open.spotify.com/playlist/37i9dQZF1DZ06evO3eIivx?si=example"), "https://open.spotify.com/playlist/37i9dQZF1DZ06evO3eIivx");
assert.throws(() => spotifySource("https://open.spotify.com.example.com/playlist/37i9dQZF1DZ06evO3eIivx"));
assert.throws(() => safeYouTubeLink("https://www.youtube.com/shorts/abcdef", true), /blocked/);
assert.equal(safeYouTubeLink("https://www.youtube.com/watch?v=abcdef", true), "https://www.youtube.com/watch?v=abcdef");
assert.throws(() => safeYouTubeLink("https://youtube.com.example.com/shorts/abcdef", true));
assert.equal(publicConfig("https://project.supabase.co/", "sb_publishable_example").url, "https://project.supabase.co");
assert.throws(() => publicConfig("https://project.supabase.co", "sb_secret_example"), /publishable/);
const usage = usageByDay("2026-11-15", { "2026-11-15": 31 }, [
  { day: "2026-11-15", device_id: "this-device", device_kind: "desktop", seconds: 20 },
  { day: "2026-11-15", device_id: "phone", device_kind: "mobile", seconds: 45 }
], "this-device", "desktop");
assert.deepEqual(usage.get("2026-11-15"), { mobile: 45, desktop: 31 });
assert.equal(usage.size, 7);

// A linked device must count the other device's seconds exactly once.
const browserDay = new Date().toISOString().slice(0, 10);
const storage = { connection: { key: "test", token: "test" }, usage: { day: browserDay, seconds: 30 } };
let rules = [];
const event = { addListener() {} };
const extension = {
  storage: { local: {
    get: async keys => Object.fromEntries([keys].flat().filter(key => key in storage).map(key => [key, storage[key]])),
    set: async value => Object.assign(storage, value)
  } },
  scripting: { getRegisteredContentScripts: async () => [{ id: "mob-youtube" }] },
  permissions: { contains: async () => true, onAdded: event, onRemoved: event },
  declarativeNetRequest: { updateDynamicRules: async ({ addRules,removeRuleIds=[] }) => { rules = [...rules.filter(rule=>!removeRuleIds.includes(rule.id)),...addRules]; }, updateSessionRules: async () => {} },
  runtime: { onInstalled: event, onStartup: event, onMessage: event },
  alarms: { onAlarm: event, clear: async () => {} }
};
extension.tabs = { onActivated: event, onUpdated: event, onRemoved: event };
extension.windows = { onFocusChanged: event };
extension.idle = { onStateChanged: event, queryState: async () => "active" };
const worker = await readFile(new URL("./clients/extension/background.js", import.meta.url), "utf8");
const budget = await runInNewContext(worker + "\npullPolicy()", {
  chrome: extension, AbortSignal,
  fetch: async (url, request) => {
    if (url.endsWith("mob_flow_browser")) return Response.json({ epoch: 0, sites: [], theme: "plain" });
    assert.equal(JSON.parse(request.body).p_seconds, 30);
    return new Response(JSON.stringify([{ block_shorts: true, daily_limit_minutes: 1, total_seconds: 65 }]));
  }
});
assert.equal(budget.total, 65);
assert.equal(budget.over, true);
assert.deepEqual(Array.from(rules, rule => rule.id), [1, 2]);
let focusRules;
extension.declarativeNetRequest.updateSessionRules = async ({ addRules }) => { focusRules = addRules; };
extension.alarms.create = async () => {};
await runInNewContext(worker + '\nsetFocus({ sites: ["example.com", "invalid"], until: Date.now() + 30_000 }).then(apply)', { chrome: extension, URL });
assert.deepEqual(Array.from(focusRules[0].condition.requestDomains), ["example.com"]);
await runInNewContext(worker + '\nsetFocus({ sites: ["example.com"], until: 0 }).then(apply)', { chrome: extension, URL });
assert.equal(focusRules.length, 0);
// Only the same active tab in a focused, unlocked browser gets time.
const browserStorage = { connection: { token: "test" }, tracking: true };
let now = Date.now();
let tab = { id: 1, windowId: 2, url: "https://example.com/", incognito: false };
let focused = true, idle = "active";
const browserChrome = {
  ...extension,
  storage: { local: {
    get: async keys => Object.fromEntries([keys].flat().filter(key => key in browserStorage).map(key => [key, structuredClone(browserStorage[key])])),
    set: async value => Object.assign(browserStorage, structuredClone(value))
  } },
  tabs: { ...extension.tabs, query: async () => [tab] },
  windows: { ...extension.windows, get: async () => ({ focused, state: focused ? "normal" : "minimized" }) },
  idle: { ...extension.idle, queryState: async () => idle }
};
class SampleDate extends Date { static now() { return now; } }
const sample = async reset => runInNewContext(worker + "\nsampleBrowser(" + reset + ")", { chrome: browserChrome, URL, Date: SampleDate });
const seconds = () => Object.values(browserStorage.browserUsage.rows).reduce((sum, row) => sum + row.seconds, 0);
await sample(false);
now += 30_000; await sample(false);
assert.equal(seconds(), 30);
tab = { ...tab, id: 3 };
now += 10_000; await sample(true);
assert.equal(seconds(), 30);
now += 30_000; await sample(false);
assert.equal(seconds(), 60);
focused = false; now += 30_000; await sample(false);
assert.equal(seconds(), 60);
focused = true; await sample(true);
idle = "locked"; now += 30_000; await sample(false);
assert.equal(seconds(), 60);
idle = "active"; await sample(true);
now += 300_000; await sample(false);
assert.equal(seconds(), 60);
tab = { ...tab, incognito: true }; await sample(true);
now += 30_000; await sample(false);
assert.equal(seconds(), 60);
const flowSource = await readFile(new URL("./dist/flow.js", import.meta.url), "utf8");
const localActivity = {};
let tracking = true;
const flow = runInNewContext(flowSource.replace("export function createFlow", "function createFlow") + "\ncreateFlow(options)", {
  options: {
    read: (key, fallback) => structuredClone(localActivity[key] ?? fallback),
    save: (key, value) => { localActivity[key] = structuredClone(value); },
    device: "device", source: "desktop", native: true,
    enabled: () => tracking, active: () => false
  },
  document: { querySelector: () => null }
});
flow.count("app", "editor", 0.25);
flow.background();
let saved = () => Object.values(localActivity["activity:guest"].rows);
assert.equal(saved()[0].seconds, 0.25);
tracking = false;
flow.count("app", "editor", 1);
flow.background();
assert.equal(saved()[0].seconds, 0.25);
tracking = true;
const mobileHour = new Date(Math.floor(Date.now() / 3600000) * 3600000).toISOString();
const mobile = [{ hour: mobileHour, source: "mobile", label: "example.app", seconds: 10, visits: 1 }];
// Android imports are retired.
// Android imports are retired.



console.log("Mob checks passed.");
const settingStore=new Map();
const pendingSettings=settingsQueue({
  getItem:key=>settingStore.get(key) || null,
  setItem:(key,value)=>settingStore.set(key,value)
},"owner");
pendingSettings.add({dailyLimit:20,blockedSites:["example.com"]});
const sentSettings=pendingSettings.snapshot();
pendingSettings.add({dailyLimit:30});
pendingSettings.acknowledge(sentSettings);
assert.deepEqual(pendingSettings.values(),{dailyLimit:30});
pendingSettings.acknowledge(pendingSettings.snapshot());
assert.deepEqual(pendingSettings.values(),{});
console.log("Offline settings queue preserves newer edits across acknowledgements.");
// Cloud latency must not block foreground sampling or overwrite newer counters.
tab={...tab,incognito:false};
await sample(true);
let releaseNetwork, markStarted;
const started=new Promise(resolve=>{markStarted=resolve;});
const networkGate=new Promise(resolve=>{releaseNetwork=resolve;});
const liveWorker=runInNewContext(worker+"\n({pullPolicy,sampleBrowser})",{
  chrome:browserChrome,URL,Date:SampleDate,AbortSignal,
  fetch:async url=>{
    if (url.endsWith("mob_flow_browser")) {
      markStarted();
      await networkGate;
      return Response.json({epoch:0,sites:[],theme:"plain"});
    }
    return Response.json([{block_shorts:false,daily_limit_minutes:0,total_seconds:0}]);
  }
});
const uploading=liveWorker.pullPolicy(true);
await started;
const beforeLatency=seconds();
now+=30_000;
await liveWorker.sampleBrowser();
assert.equal(seconds(),beforeLatency+30,"Network latency blocked or dropped foreground time");
releaseNetwork();
await uploading;
assert.equal(seconds(),beforeLatency+30,"Acknowledgement overwrote a newer foreground counter");
console.log("Browser sampling continues during cloud latency without losing queued data.");
