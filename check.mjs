import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { activityFor, defaults, newTimer, nextTimer, offsetDay, safeYouTubeLink, spotifySource, streakFor, timerRemaining, usageByDay, usernameFor } from "./dist/core.js";
import { publicConfig } from "./dist/supabase.js";

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
for (const asset of ["supabase-config.js", "focus-lake.jpg", "focus-lake.mp4", "icon.svg"]) await access(new URL(asset, dist));
const clip = await readFile(new URL("focus-lake.mp4", dist));
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
  declarativeNetRequest: { updateDynamicRules: async ({ addRules }) => { rules = addRules; }, updateSessionRules: async () => {} },
  runtime: { onInstalled: event, onStartup: event, onMessage: event },
  alarms: { onAlarm: event, clear: async () => {} }
};
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
console.log("Mob checks passed.");
