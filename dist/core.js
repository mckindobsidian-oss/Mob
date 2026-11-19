export const defaults = {
  focus: 25, short: 5, long: 15, interval: 4,
  autoBreak: false, autoFocus: false, sound: true, notifications: false,
  theme: "plain", photo: "", username: "", focusGoal: 2, onboarded: false,
  usageRules: [], flowTracking: false, blockShorts: false, dailyLimit: 0, blockedSites: [], hideUsage: false, hideList: false,
  focusAudio: {preset:"brown",volume:0.2}, shareScore: false, motion: true, spotify: ""
};

export const timerLabels = { focus: "Focus", short: "Short break", long: "Long break" };

export function dayKey(value = new Date()) {
  const date = new Date(value);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function dayDate(key) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

export function offsetDay(key, change) {
  const date = dayDate(key);
  date.setDate(date.getDate() + change);
  return dayKey(date);
}

export function usernameFor(label, uid) {
  const base = (label || "member").normalize("NFKD").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 16).replace(/-$/, "");
  return `${base || "member"}-${uid.slice(0, 6).toLowerCase()}`;
}

export function newTimer(settings, mode = "focus", extra = {}) {
  return {
    mode, duration: settings[mode] * 60_000, remaining: settings[mode] * 60_000,
    endsAt: null, rounds: 0, taskId: "", id: "", ...extra
  };
}

export function nextTimer(timer, settings, now, completed) {
  const rounds = timer.rounds + Number(completed && timer.mode === "focus");
  const mode = timer.mode === "focus"
    ? (rounds > 0 && rounds % settings.interval === 0 ? "long" : "short")
    : "focus";
  const result = newTimer(settings, mode, { rounds, taskId: timer.taskId });
  const auto = mode === "focus" ? settings.autoFocus : settings.autoBreak;
  // A phase missed while the app was closed should not log unattended sessions.
  if (completed && auto && now - timer.endsAt < result.duration && now - timer.endsAt < 60_000) {
    result.id = globalThis.crypto.randomUUID();
    result.endsAt = timer.endsAt + result.duration;
  }
  return result;
}

export function timerRemaining(timer, now = Date.now()) {
  return Math.max(0, timer.endsAt ? timer.endsAt - now : timer.remaining);
}

export function activityFor(tasks, sessions) {
  const days = new Map();
  for (const key of [...tasks.map(task => task.completedDay), ...sessions.map(session => session.day)]) {
    if (key) days.set(key, (days.get(key) || 0) + 1);
  }
  return days;
}

export function streakFor(days, today = dayKey()) {
  const sorted = [...days.keys()].filter(key => key <= today).sort();
  let best = 0;
  let run = 0;
  let previous = "";
  for (const key of sorted) {
    run = previous && offsetDay(previous, 1) === key ? run + 1 : 1;
    best = Math.max(best, run);
    previous = key;
  }
  const current = previous === today || previous === offsetDay(today, -1) ? run : 0;
  return { current, best };
}

export function spotifySource(input) {
  const url = new URL(input);
  const path = url.pathname.replace(/^\/intl-[a-z-]+\//i, "/").replace(/^\/embed\//, "/");
  if (url.protocol !== "https:" || url.hostname !== "open.spotify.com" || url.port || url.username || url.password ||
      !/^\/(playlist|album|track|artist|show|episode)\/[A-Za-z0-9]{22}$/.test(path)) {
    throw new Error("Paste a Spotify track, playlist, artist, album, or podcast link.");
  }
  return "https://open.spotify.com" + path;
}

export function safeYouTubeLink(input, blockShorts) {
  const url = new URL(input);
  if (url.protocol !== "https:" || !["www.youtube.com", "youtube.com", "m.youtube.com", "youtu.be"].includes(url.hostname)
      || url.username || url.password || url.port) {
    throw new Error("Enter a YouTube link that starts with https://.");
  }
  const path = decodeURIComponent(url.pathname).replace(/\/{2,}/g, "/").toLowerCase();
  if (blockShorts && /^\/(feed\/)?shorts(\/|$)/.test(path)) {
    throw new Error("YouTube Shorts are blocked in Mob.");
  }
  return url.href;
}

export function usageByDay(today, local, remote, device, kind) {
  const totals = new Map();
  for (let index = -6; index <= 0; index++) totals.set(offsetDay(today, index), { mobile: 0, desktop: 0 });
  const records = new Map();
  for (const row of remote) {
    records.set(row.day + "/" + row.device_id, row);
  }
  for (const [day, seconds] of Object.entries(local)) {
    const key = day + "/" + device;
    const value = Math.max(seconds, records.get(key)?.seconds || 0);
    records.set(key, { day, device_kind: kind, seconds: value });
  }
  for (const row of records.values()) {
    const total = totals.get(row.day);
    if (total) total[row.device_kind] += row.seconds;
  }
  return totals;
}

export function normalizeUsername(value) {
  const username = value.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{2,23}$/.test(username)) {
    throw new Error("Use 3–24 letters, numbers or hyphens, starting with a letter or number.");
  }
  return username;
}

export function achievements(tasks, sessions, today) {
  const minutes = sessions.reduce((total, session) => total + session.minutes, 0);
  const { best } = streakFor(activityFor([], sessions), today);
  return [
    { name: "First move", icon: "play", current: sessions.length, goal: 1, unit: "sessions" },
    { name: "Power hour", icon: "timer", current: minutes, goal: 60, unit: "min" },
    { name: "On a roll", icon: "flame", current: best, goal: 3, unit: "days in a row" },
    { name: "Clean sweep", icon: "check", current: tasks.filter(task => task.completedDay).length, goal: 10, unit: "tasks" },
  ];
}
