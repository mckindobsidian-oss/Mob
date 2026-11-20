import { createFlowControls } from "./flow-controls.js";
import { createFocusAudio, soundPresets } from "./focus-audio.js";
import { installThemedControls } from "./themed-controls.js";
import { achievements, activityFor, dayDate, dayKey, defaults, newTimer, nextTimer, normalizeUsername, offsetDay, safeYouTubeLink, spotifySource, streakFor, timerLabels, timerRemaining, usageByDay } from "./core.js";

import { connectSupabase, getConfig, publicConfig } from "./supabase.js";

import { extensionMessage, nativeMessage } from "./mob-platform.js";

import { createFlow } from "./flow.js";



const icons = {

  today: '<rect x="3" y="4" width="18" height="17" rx="3"/><path d="M3 9h18M8 2v4m8-4v4"/><rect x="8" y="13" width="3" height="3" rx=".5"/>',

  tasks: '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="m7 12 3 3 7-7"/>',

  timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M9 2h6m3 4 2-2"/>',

  calendar: '<rect x="3" y="4" width="18" height="17" rx="3"/><path d="M3 9h18M8 2v4m8-4v4m-8 7h.01m4 0h.01m4 0h.01m-8 4h.01m4 0h.01"/>',

  social: '<path d="M8 21h8m-4-4v4M7 4h10v6a5 5 0 0 1-10 0zm0 2H3v2a4 4 0 0 0 4 4m10-6h4v2a4 4 0 0 1-4 4"/>',

  activity: '<path d="M3 19h18M6 15v-4m4 4V7m4 8V4m4 11V9"/>',

  settings: '<path d="M10 3h4l.7 2.4 2 .9L19 5l2 3-1.7 1.8v2.4l1.7 1.7-2 3-2.3-.9-2 .9L14 20h-4l-.7-3.1-2-.9-2.3.9-2-3 1.7-1.7V9.8L3 8l2-3 2.3 1.3 2-.9z"/><circle cx="12" cy="11.5" r="2.5"/>',

  sidebar: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9 4v16m7-11-3 3 3 3"/>',

  flow: '<path d="M2 12h4l3-7 4 14 3-7h6"/>',

  shield: '<path d="M12 22s7-3 7-9V5l-7-3-7 3v8c0 6 7 9 7 9z"/><path d="m9 12 2 2 4-4"/>',

  music: '<path d="M9 18V5l11-2v13M9 9l11-2"/><ellipse cx="6" cy="18" rx="3" ry="2"/><ellipse cx="17" cy="16" rx="3" ry="2"/>',

  video: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3"/>',

  theater: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 15h10"/>',

  fullscreen: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',

  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a5 5 0 0 1 5-5h6a5 5 0 0 1 5 5v2"/>',

  layers: '<path d="m12 3 9 5-9 5-9-5zm-9 9 9 5 9-5M3 16l9 5 9-5"/>',

  "chevron-right": '<path d="m9 5 7 7-7 7"/>',

  "chevron-left": '<path d="m15 5-7 7 7 7"/>',

  plus: '<path d="M12 5v14M5 12h14"/>',

  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8m-11 11a2 2 0 0 0 4 0"/>',

  spotify: '<circle cx="12" cy="12" r="11" fill="#1ed760" stroke="none"/><path d="M5.6 9c4.2-1.2 8.9-.8 12.8 1.4M6.7 12.4c3.5-1 7.3-.6 10.3 1.1M7.8 15.5c2.7-.7 5.4-.4 7.7.9" stroke="#102417" stroke-width="1.65"/>',
  flame: '<path fill="#ff662c" stroke="none" d="M13 1c1 5-3 7-2 11-2-1-3-3-3-5-4 4-5 7-4 10a8 8 0 0 0 16-2c0-4-2-7-4-9 0 3-1 4-1 4 0-4-1-6-2-9Z"/><path fill="#ffd45a" stroke="none" d="M13 12c1 3 4 4 3 7a4 4 0 0 1-8-1c0-2 1-3 2-4 0 2 1 2 1 2Z"/>' ,

  check: '<path d="m5 12 4 4L19 6"/>',

  play: '<path d="m8 5 12 7-12 7z"/>',

  pause: '<path d="M9 5v14m6-14v14"/>',

  reset: '<path d="M3 12a9 9 0 1 1 2.6 6.4M3 6v6h6"/>',

  skip: '<path d="m6 5 10 7-10 7zm13 0v14"/>',

  spark: '<path d="m12 2 2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z"/>',

  close: '<path d="m6 6 12 12M18 6 6 18"/>',

  arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>'

};

const icon = name => `<i data-icon="${name}" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">${icons[name]}</svg></i>`;

for (const placeholder of document.querySelectorAll("i[data-icon]")) {

  placeholder.outerHTML = icon(placeholder.dataset.icon);

}



const $ = selector => document.querySelector(selector);

const escape = (value = "") => String(value).replace(/[&<>"']/g, character => ({

  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"

})[character]);

const formatDay = (key, options) => new Intl.DateTimeFormat(undefined, options).format(dayDate(key));

const longDay = key => formatDay(key, { weekday: "long", month: "long", day: "numeric" });

const dateWithYear = key => formatDay(key, { month: "long", year: "numeric" });

const views = { today: ["Today", "today"], tasks: ["Tasks", "tasks"], focus: ["Focus", "timer"], calendar: ["Calendar", "calendar"], flow: ["Flow", "flow"], social: ["Social", "social"], settings: ["Settings", "settings"] };

// Android keeps a Flow placeholder; it never starts usage collection.

const id = () => crypto.randomUUID();



function read(key, fallback) {

  try { return JSON.parse(localStorage.getItem("mob:" + key)) ?? fallback; }

  catch { return fallback; }

}

function save(key, value) {

  localStorage.setItem("mob:" + key, JSON.stringify(value));

}



const initialDay = dayKey();

let account = null;

let api = null;

let backendError = "";

let subscriptions = [];

let handleLoaded = false;

let handle = "";

let leaderboard = [];

let leaderboardStatus = "";
let handleLoadFailed = false;

let lastRanking = 0;

let syncSessionBusy = false;

let extensionAvailable = false;

let extensionStatus;

let youtubeCloud = null;

let youtubeSyncing = false;

let nativeCompanionBusy = false;

const budgetDay = () => new Date().toISOString().slice(0, 10);

let companionBusy = false;

let nativeStatus = {};

let permissionJourney = 1;

let guest = read("guest", { settings: {}, tasks: [], sessions: [] });

const devicePreferenceKeys = ["theme", "photo", "focus", "short", "long", "interval", "focusGoal", "autoBreak", "autoFocus", "sound", "motion"];
const devicePreferences = () => read("device-preferences", {});
let settings = { ...defaults, ...guest.settings, ...devicePreferences() };

let tasks = guest.tasks;

let sessions = guest.sessions;

let timer = read("timer:guest", newTimer(settings));

let syncingTimer = false;

const pendingTimerKey = () => "timer-pending:" + scope();

let day = initialDay;

let selectedDay = day;

let month = day.slice(0, 7) + "-01";

let taskFilter = "all";

let taskSearch = "";

let sidebarCollapsed = read("sidebar", false);

let theater = false;

const deviceId = read("device", null) || id();

save("device", deviceId);

const deviceKind = (navigator.userAgentData?.mobile || /Android|iPhone|iPad|Mobile/.test(navigator.userAgent)) ? "mobile" : "desktop";

let youtubeLastRead = 0;

let audio;

let toastTimeout;

let dialogType = "";

let reminderSweep = 0;

const scope = () => account?.uid || "guest";

const timerKey = () => "timer:" + scope();

const queueKey = () => "session-queue:" + scope();

const route = () => Object.hasOwn(views, location.hash.slice(1)) ? location.hash.slice(1) : "today";

let trackingAllowed = read("device-tracking", false);

let browserTracking = read("browser-tracking", false);

const flow = createFlow({

  read, save, device: deviceId, source: window.MobDesktop ? "desktop" : deviceKind === "mobile" ? "mobile" : "web",

  enabled: () => Boolean(window.MobDesktop) && trackingAllowed, active: () => !document.hidden && document.hasFocus() && extensionStatus?.userActive !== false,

  native: Boolean(window.MobDesktop || window.MobAndroid),

  uploads: !window.MobAndroid,

  onEpoch: since => nativeMessage("flow", { enabled: trackingAllowed, since, owner: account?.uid || "" })

});

let lastUsagePolicy=0;
const flowControls=createFlowControls({document,snapshot:()=>flow.ruleState(),settings:()=>settings,save:saveSettings,modal:(title,body)=>modal('usage-rule',title,body),close:closeDialog});
window.MobDesktop?.watchActivity(({ kind, label, seconds, at }) => {

  if (kind !== "desktop" && kind !== "app") return;

  if (Date.now() - at >= 1000 || Date.now() < at) return;

  flow.count(kind === "app" ? "desktop" : "app", "", 0, at);

  flow.count(kind, label, seconds, at);

});



function toast(message) {

  $("#toast").textContent = message;

  clearTimeout(toastTimeout);

  toastTimeout = setTimeout(() => { $("#toast").textContent = ""; }, 4100);

}



function changeTheme() {

  const theme = ({ dusk: "ocean", moss: "forest" })[settings.theme] || settings.theme;

  document.documentElement.dataset.theme = theme;

  const photo = /^data:image\/jpeg;base64,[a-z0-9+/=]+$/i.test(settings.photo) ? settings.photo : "";

  document.body.style.setProperty("--custom-background", photo ? `url("${photo}")` : "none");

  $('meta[name="theme-color"]').content = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim();

}



function saveGuest() {

  guest = { tasks, sessions, settings };

  save("guest", guest);

}

function writeError() { toast("Changes couldn’t be saved. Please try again."); }

function cloud(promise) { promise.catch(writeError); }

function saveSettings({ flowTracking, ...changes }) {

  if (typeof flowTracking === "boolean") {

    flow.background();

    trackingAllowed = flowTracking;

    save("device-tracking", flowTracking);

  }

  if (window.MobAndroid && account) save("android-settings:"+account.uid,{...settings,...changes});

  const localChanges = Object.fromEntries(devicePreferenceKeys.filter(key => Object.hasOwn(changes, key)).map(key => [key, changes[key]]));
  if (Object.keys(localChanges).length) save("device-preferences", { ...devicePreferences(), ...localChanges });
  const old = settings;

  settings = { ...settings, ...changes };

  if (account && !window.MobAndroid && Object.keys(changes).length) {

    cloud(api.put(account.uid, "profile", "settings", changes).then(() => {

      if (extensionAvailable) extensionMessage("policy-changed");

    }));

  } else if (!account) {

    saveGuest();

    if (extensionAvailable && (Object.hasOwn(changes, "blockShorts") || Object.hasOwn(changes, "dailyLimit"))) {

      extensionMessage("policy-changed", { local: { blockShorts: settings.blockShorts, limit: settings.dailyLimit } });

    }

  }

  if (settings[timer.mode] !== old[timer.mode] && !timer.id) {

    setTimer(newTimer(settings, timer.mode, { rounds: timer.rounds, taskId: timer.taskId }), false, false);

  }

  render();

  sendPlatformSettings();

}

function saveTask(task) {

  const { id: key, completedDay, createdAt, ...data } = task;

  if (account) {

    const exists = tasks.some(existing => existing.id === key);

    tasks = [...tasks.filter(existing => existing.id !== key), task];

    render(); sendPlatformSettings();

    cloud(api.put(account.uid, "tasks", key, { ...data, completedDay, createdAt }));

    return;

  }

  tasks = [...tasks.filter(existing => existing.id !== key), task];

  saveGuest();

  render();

  sendPlatformSettings();

}

function deleteTask(key) {

  if (account) { tasks=tasks.filter(task=>task.id!==key); render(); sendPlatformSettings(); cloud(api.remove(account.uid, "tasks", key)); return; }

  tasks = tasks.filter(task => task.id !== key);

  saveGuest();

  render();

  sendPlatformSettings();

}

function recordSession(session) {

  if (sessions.some(entry => entry.id === session.id)) return;

  sessions = [...sessions, session];

  if (window.MobAndroid && account) {save("android-sessions:"+account.uid,sessions);void refreshLeaderboard(true);return;}

  if (account) {

    const queue = read(queueKey(), {});

    save(queueKey(), { ...queue, [session.id]: session });

    void syncSessions();

  } else saveGuest();

}



async function syncSessions() {

  if (window.MobAndroid || !account || syncSessionBusy || !navigator.onLine) return;

  const uid = account.uid;

  const key = queueKey();

  const queue = read(key, {});

  if (!Object.keys(queue).length) return;

  syncSessionBusy = true;

  try {

    for (const { id, ...session } of Object.values(queue)) {

      if (account?.uid !== uid) break;

      await api.put(uid, "sessions", id, session);

      const current = read(key, {});

      delete current[id];

      save(key, current);

    }

    if (route() === "social") void refreshLeaderboard(true);

  } catch {

    // Completed sessions stay on the device and retry when sync resumes.

  } finally {

    syncSessionBusy = false;

  }

}



function navigationOrder() {
  const saved=read("navigation-order",[]);
  return [...new Set([...saved, ...Object.keys(views)])].filter(key => views[key] && !["calendar", "settings"].includes(key));
}
function avatarMarkup() {
  const photo=account?.photoURL||"";
  return /^https:\/\/(?:[^/]+\.)?googleusercontent\.com\//i.test(photo) ? `<img src="${escape(photo)}" alt="Your Google profile photo" referrerpolicy="no-referrer">` : account&&handle ? escape(handle[0].toUpperCase()) : icon("user");
}

function navMarkup() {

  return navigationOrder().map(key => [key,views[key]]).map(([key, [label, glyph]]) =>

    `<a class="nav-button ${key === (route() === "calendar" ? "tasks" : route()) ? "active" : ""}" href="#${key}" aria-label="${label}" title="${label}${key === "tasks" ? " (Alt+Shift+T)" : key === "focus" ? " (Alt+Shift+F)" : ""}" ${key === (route() === "calendar" ? "tasks" : route()) ? 'aria-current="page"' : ""}>${icon(glyph)}<span>${label}</span></a>`

  ).join("");

}



document.addEventListener("error",event=>{
 const image=event.target;
 if(image?.tagName==="IMG"&&(image.closest(".mobile-account")||image.closest(".avatar")||image.closest(".leader-avatar"))){if(image.closest(".leader-avatar"))image.parentElement.textContent=image.parentElement.dataset.initial||"?";else image.parentElement.innerHTML=account&&handle?escape(handle[0].toUpperCase()):icon("user");}
},true);

function profileMarkup() {

  const display = handle ? "@" + handle : account ? "Your account" : "Login";

  const detail = account ? "Account" : "Sync your devices";

  const picture = avatarMarkup();

  return `<span class="avatar">${picture}</span><span class="profile-text"><strong>${escape(display)}</strong><small>${detail}</small></span>${icon("chevron-right")}`;

}



function heading(title, description = "", extra = "") {

  return `<div class="page-heading"><div><h1>${title}</h1>${description ? `<p class="muted">${description}</p>` : ""}</div>${extra}</div>`;

}



function sectionTitle(glyph, title, subtitle, extra = "") {

  return `<div class="card-header"><div class="inline"><span class="section-icon">${icon(glyph)}</span><div><h2>${title}</h2>${subtitle ? `<p>${subtitle}</p>` : ""}</div></div>${extra}</div>`;

}



function orderTasks(list) {

  return [...list].sort((a,b) => Number(Boolean(a.completedDay)) - Number(Boolean(b.completedDay))

    || (a.date || "9999").localeCompare(b.date || "9999")

    || (a.time || "99").localeCompare(b.time || "99") || a.createdAt - b.createdAt);

}

function taskRows(list, empty = "No tasks here yet.") {

  if (!list.length) return `<div class="empty">${empty}</div>`;

  return orderTasks(list).map(task => {

    const completed = Boolean(task.completedDay);

    const details = [task.date ? (task.date === day ? "Today" : formatDay(task.date, { month: "short", day: "numeric" })) : "", task.time].filter(Boolean).join(" · ");

    return `<div class="task-row ${completed ? "completed" : ""}">

      <button class="check ${completed ? "done" : ""}" data-action="task-check" data-id="${escape(task.id)}" aria-label="${completed ? "Reopen" : "Complete"} ${escape(task.title)}" aria-pressed="${completed}">${completed ? icon("check") : ""}</button>

      <button class="task-summary" data-action="task-edit" data-id="${escape(task.id)}"><strong>${escape(task.title)}</strong><small>${escape(details || "No due date")}</small></button>

      ${task.project ? `<span class="tag desktop-only">${escape(task.project)}</span>` : ""}

      <span class="tag ${escape(task.priority)}">${({ high: "High", medium: "Medium", low: "Low" })[task.priority] || "Medium"}</span>

    </div>`;

  }).join("");

}



function focusMarkup(large = false) {

  const modes = Object.entries(timerLabels).map(([mode, label]) =>

    `<button class="${timer.mode === mode ? "active" : ""}" aria-pressed="${timer.mode === mode}" data-action="timer-mode" data-id="${mode}">${label}</button>`

  ).join("");

  const completed = timer.rounds % settings.interval || (timer.rounds && timer.mode !== "focus" ? settings.interval : 0);

  const rounds = Array.from({ length: settings.interval }, (_, index) => `<span class="round-dot ${index < completed ? "filled" : ""}"></span>`).join("");

  const focusTask = tasks.find(task => task.id === timer.taskId);

  return `<section class="card focus-card ${large ? "large-focus" : ""}">

    ${large ? "" : sectionTitle("timer", "Pomodoro", "Focus and break timer")}

    <div class="timer-content">

      <div class="segments" aria-label="Timer modes">${modes}</div>

      <div class="timer-ring"><svg viewBox="0 0 120 120" aria-hidden="true"><circle class="track" cx="60" cy="60" r="54"/><circle class="progress" cx="60" cy="60" r="54" pathLength="100" stroke-dasharray="100 100"/></svg><div><div class="time" role="timer">25:00</div><span class="timer-caption">${timer.endsAt ? "In progress" : timer.id ? "Paused" : "Ready to start"}</span></div></div>

      <div class="timer-buttons"><button class="button primary" data-action="timer-toggle" aria-keyshortcuts="Alt+Shift+S" title="Start a focus session with Alt+Shift+S">${icon(timer.endsAt ? "pause" : "play")} ${timer.endsAt ? "Pause" : timer.id ? "Resume" : "Start"}</button><button class="icon-button" data-action="timer-reset" aria-label="Reset timer" title="Reset timer">${icon("reset")}</button><button class="icon-button" data-action="timer-skip" aria-label="Skip phase" title="Skip phase">${icon("skip")}</button></div>

      <div class="rounds" aria-label="${completed} of ${settings.interval} rounds">${rounds}<span>${completed}/${settings.interval} rounds</span></div>

      ${!large && focusTask ? `<span class="small-text muted">Focusing on ${escape(focusTask.title)}</span>` : ""}

    </div>

    ${large ? `<label class="field timer-task">Task for this session<select id="focus-task"><option value="">Unlinked session</option>${tasks.filter(task => !task.completedDay || task.id === timer.taskId).map(task => `<option value="${escape(task.id)}" ${task.id === timer.taskId ? "selected" : ""}>${escape(task.title)}</option>`).join("")}</select></label>` : ""}

  </section>`;

}



const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

let clipOverride;

let spotifyOpen = false;
let focusSound;
let soundBusy=false;
function soundSettings(){const value=settings.focusAudio;return {preset:soundPresets.some(([id])=>id===value?.preset)?value.preset:"brown",volume:Number.isFinite(value?.volume)?Math.max(0,Math.min(0.6,value.volume)):0.2};}
function soundCard() {
  const { preset } = soundSettings();
  return `<section class="card focus-sounds">
    ${sectionTitle("music", "Focus sounds", "")}
    <div class="sound-preset-grid">${soundPresets.map(([key, label]) =>
      `<button type="button" class="sound-preset ${preset === key ? "active" : ""}" data-action="sound-preset" data-id="${key}" aria-pressed="${preset === key}"><strong>${label}</strong></button>`).join("")}</div>
    <button class="button primary" data-action="sound-toggle" ${soundBusy ? "disabled" : ""}>${icon(focusSound?.playing ? "pause" : "play")} ${focusSound?.playing ? "Pause sound" : "Play sound"}</button>
  </section>`;
}

async function toggleFocusSound(){
 if(soundBusy)return;
 focusSound ||= createFocusAudio();
 if(focusSound.playing){focusSound.stop();render();return;}
 soundBusy=true;render();
 try {const value=soundSettings();await focusSound.play(value.preset,value.volume);}catch(error){toast(error.message||"Sound could not start. Tap Play to retry.");}
 finally{soundBusy=false;render();}
}




function focusView() {

  return `${heading("Focus", "Choose a task and give it your full attention.")}

    <div class="focus-layout">

      <section class="focus-stage" id="focus-stage" aria-label="Pomodoro timer">

        <video muted loop playsinline preload="none" poster="./focus-lake.jpg" aria-hidden="true"></video>

        <div class="stage-controls" id="stage-controls"></div>

      </section>

      <div class="focus-audio-column"><section class="card music-card">

        <div id="spotify-player"></div>
        <div class="form-actions" id="music-actions"></div>

      </section>${soundCard()}</div>

    </div>`;

}



function renderFocus() {
  const soundRoot=$(".focus-sounds");
  if(soundRoot) soundRoot.outerHTML=soundCard();

  const stage = $("#focus-stage");

  const fullscreen = document.fullscreenElement === stage;

  const showMotion = clipOverride ?? (settings.motion && !reducedMotion.matches && !matchMedia("(pointer: coarse)").matches && !navigator.connection?.saveData);

  const video = stage.querySelector("video");

  stage.classList.toggle("expanded", theater);

  stage.classList.toggle("motion-on", showMotion);

  document.body.classList.toggle("focus-expanded", theater || fullscreen);

  if (showMotion) {

    if (!video.getAttribute("src")) video.src = "./focus-lake.mp4";

    if (video.paused) void video.play().catch(() => {});

  } else video.pause();

  $("#stage-controls").innerHTML = `

    <div class="stage-tools">

      <button class="icon-button stage-icon" data-action="motion" aria-pressed="${showMotion}" aria-label="${showMotion ? "Pause video" : "Play video"}" title="${showMotion ? "Pause video" : "Play video"}">${icon("video")}</button>

      <button class="icon-button stage-icon" data-action="theater" aria-pressed="${theater}" aria-label="${theater ? "Exit theater" : "Theater"}" title="${theater ? "Exit theater" : "Theater"}">${icon("theater")}</button>

      <button class="icon-button stage-icon" data-action="fullscreen" aria-pressed="${fullscreen}" aria-label="${fullscreen ? "Exit fullscreen" : "Fullscreen"}" title="${fullscreen ? "Exit fullscreen" : "Fullscreen"}">${icon("fullscreen")}</button>

    </div>

    ${focusMarkup(true)}`;

  const music=$(".music-card"),column=$(".focus-audio-column");
  if(music&&column){
    if(theater||fullscreen){if(music.parentElement!==stage)stage.append(music);music.classList.add("mini-spotify");}
    else{if(music.parentElement!==column)column.prepend(music);music.classList.remove("mini-spotify");}
  }
  renderMusic();

}



function renderMusic() {

  let url = "";

  try {

    if (settings.spotify) url = spotifySource(settings.spotify);

  } catch {

    // Older or manually edited settings can contain a stale URL.

  }

  const player = $("#spotify-player");

  const expanded = theater || document.fullscreenElement === $("#focus-stage");
  if (spotifyOpen && expanded) {

    url ||= "https://open.spotify.com/playlist/37i9dQZF1DWZeKCadgRdKQ";

    const source = url.replace("open.spotify.com/", "open.spotify.com/embed/");

    if (player.dataset.source !== source) {

      player.dataset.source = source;

      player.innerHTML = `<iframe title="Spotify focus music" src="${escape(source)}" height="352" loading="lazy" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"></iframe>`;

    }

  } else if (player.dataset.source) {

    player.replaceChildren();

    delete player.dataset.source;

  }

  const frame=player.querySelector("iframe");if(frame)frame.height=(theater||document.fullscreenElement===$("#focus-stage"))?"152":"352";

  const actions = $("#music-actions");

  const open = spotifyOpen && expanded;
  const label = open ? "Close Spotify player" : "Open Spotify player";
  const markup = `<button class="button spotify-launcher" data-action="spotify-player" aria-expanded="${open}" aria-label="${label}" title="${label}">${icon("spotify")}</button>${open ? '<button class="button" data-action="spotify-link">Change Spotify link</button>' : ""}`;

  if (actions.innerHTML !== markup) actions.innerHTML = markup;

}



async function fullScreen() {

  const stage = $("#focus-stage");

  if (!stage) return;

  if (document.fullscreenElement === stage) {

    await document.exitFullscreen();

    return;

  }

  try {

    await stage.requestFullscreen();

    theater = false;

    render();

  } catch {

    theater = true;

    render();

    toast("Opened theater mode. Fullscreen is unavailable in this browser.");

  }

}



function todayView() {

  const todays = tasks.filter(task => task.date === day);

  const done = todays.filter(task => task.completedDay).length;

  const days = activityFor(tasks, sessions);

  const streak = streakFor(days, day).current;

  const focusCount = sessions.filter(session => session.day === day).length;

  const upcoming = orderTasks(tasks.filter(task => task.date >= day && task.time && !task.completedDay))

    .find(task => reminderTimestamp(task) > Date.now());

  return `<div class="page-heading"><div><div class="kicker">${longDay(day)}</div><h1>Today</h1></div><div class="inline streak-pill">${icon("flame")} ${streak} day streak</div></div>

    <section class="hero quest"><div class="hero-copy"><h2>Daily focus</h2><p>${focusCount} / ${settings.focusGoal} sessions</p><progress aria-label="Daily focus goal" value="${focusCount}" max="${settings.focusGoal}"></progress></div><a class="button primary" href="#focus">${icon("play")} Focus</a></section>

    <div class="dashboard">

      <section class="card">

        ${sectionTitle("tasks", "Today’s tasks", `${done} of ${todays.length} completed`, '<a class="text-action" href="#tasks">All tasks ' + icon("arrow") + '</a>')}

        <div class="task-list">${taskRows(orderTasks(todays).slice(0, 4), "Nothing planned for today.")}</div>

        <div class="task-footer"><button class="text-action" data-action="task-new">${icon("plus")} Add a task</button></div>

      </section>

      ${focusMarkup()}

    </div>

    ${upcoming ? `<section class="card next-reminder">${sectionTitle("bell", "Next reminder", escape(upcoming.title) + " · " + escape(new Date(reminderTimestamp(upcoming)).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })), `<button class="text-action" data-action="task-edit" data-id="${escape(upcoming.id)}">Edit</button>`)}</section>` : ""}



    ${achievementView()}`;

}



let achievementScope=null;
let achievementReady={tasks:false,sessions:false};
function checkAchievements(){
 if(account&&(!achievementReady.tasks||!achievementReady.sessions))return;
 const uid=scope(),key='achievement-notices:'+uid,earned=achievements(tasks,sessions,day).filter(b=>b.current>=b.goal).map(b=>b.name);
 if(achievementScope!==uid){achievementScope=uid;const previous=read(key,null);if(previous===null)save(key,earned);return;}
 const previous=read(key,[]),fresh=earned.filter(name=>!previous.includes(name));
 if(!fresh.length)return;save(key,[...new Set([...previous,...fresh])]);
 let popup=document.querySelector('#achievement-popup');if(!popup){popup=document.createElement('div');popup.id='achievement-popup';popup.className='achievement-popup';popup.setAttribute('role','status');popup.setAttribute('aria-live','polite');document.body.append(popup);}
 popup.innerHTML='<strong>Achievement unlocked</strong><span>'+fresh.map(escape).join(' · ')+'</span><button type="button" aria-label="Dismiss achievement">×</button>';popup.hidden=false;popup.querySelector('button').onclick=()=>popup.hidden=true;setTimeout(()=>popup.hidden=true,6500);
}
function achievementView() {

  const badges = achievements(tasks, sessions, day);

  const unlocked = badges.filter(badge => badge.current >= badge.goal).length;

  return `<section class="card achievement-card">${sectionTitle("social", "Achievements", `${unlocked} of ${badges.length} unlocked`)}

    <div class="achievement-grid">${badges.map((badge, index) => {

      const current = Math.min(badge.current, badge.goal);

      const earned = current === badge.goal;

      return `<div class="achievement ${earned ? "earned" : ""}" style="--badge:${index}"><span class="badge-art">${icon(badge.icon)}</span><strong>${badge.name}</strong><small>${earned ? "Unlocked" : `${current} / ${badge.goal} ${badge.unit}`}</small><progress aria-label="${badge.name}" value="${current}" max="${badge.goal}"></progress></div>`;

    }).join("")}</div></section>`;

}



function tasksView() {

  const options = { all: "All", open: "Open", completed: "Completed" };

  const search = taskSearch.toLocaleLowerCase().trim();

  const list = tasks.filter(task => (taskFilter === "all" || Boolean(task.completedDay) === (taskFilter === "completed"))

    && (task.title + " " + task.project).toLocaleLowerCase().includes(search));

  const filters = Object.entries(options).map(([value, label]) => `<button class="${taskFilter === value ? "active" : ""}" aria-pressed="${taskFilter === value}" data-action="task-filter" data-id="${value}">${label}</button>`).join("");

  return `${heading("Tasks", "Keep track of what you want to get done.", `<a class="button" href="#calendar" aria-keyshortcuts="Alt+Shift+C" title="Calendar (Alt+Shift+C)">${icon("calendar")} Calendar</a>`)}<section class="card">

    <div class="task-tools"><div class="segments" aria-label="Filter tasks">${filters}</div><input id="task-search" type="search" aria-label="Search tasks" placeholder="Search tasks" value="${escape(taskSearch)}"></div>

    <div class="task-list">${taskRows(list, "No tasks match this view.")}</div>

    <div class="task-footer"><button class="text-action" data-action="task-new">${icon("plus")} Add a task</button></div>

    </section>`;

}



function calendarView() {

  const first = dayDate(month);

  const gridStart = offsetDay(month, -((first.getDay() + 6) % 7));

  const taskCounts = new Map();

  for (const task of tasks) {

    if (task.date) taskCounts.set(task.date, (taskCounts.get(task.date) || 0) + 1);

  }

  const days = Array.from({ length: 42 }, (_, index) => {

    const key = offsetDay(gridStart, index);

    const count = taskCounts.get(key) || 0;

    return `<button class="calendar-day ${key === selectedDay ? "selected" : ""} ${key === day ? "today" : ""} ${key.slice(0,7) !== month.slice(0,7) ? "other" : ""}" data-action="calendar-day" data-id="${key}" aria-label="${longDay(key)}, ${count} tasks" aria-pressed="${key === selectedDay}">${Number(key.slice(8))}<span class="calendar-mark ${count ? "" : "none"}" style="width:${Math.min(count, 4) * 4 + 5}px"></span></button>`;

  }).join("");

  const headers = Array.from({ length: 7 }, (_, index) => `<span class="weekday">${formatDay(offsetDay(gridStart, index), { weekday: "short" })}</span>`).join("");

  const list = tasks.filter(task => task.date === selectedDay);

  return `${heading("Calendar", "See your tasks by due date.", `<a class="button" href="#tasks">${icon("tasks")} Tasks</a>`)}<div class="calendar-layout"><section class="card">

    <div class="card-header"><h2>${dateWithYear(month)}</h2><div class="section-actions"><button class="icon-button small" data-action="month-prev" aria-label="Previous month">${icon("chevron-left")}</button><button class="text-action" data-action="month-today">Today</button><button class="icon-button small" data-action="month-next" aria-label="Next month">${icon("chevron-right")}</button></div></div>

    <div class="calendar-grid">${headers}${days}</div></section><section class="card">${sectionTitle("calendar", longDay(selectedDay), `${list.length} ${list.length === 1 ? "task" : "tasks"}`)}<div class="task-list">${taskRows(list, "Nothing scheduled for this day.")}</div><div class="task-footer"><button class="text-action" data-action="task-new" data-id="${selectedDay}">${icon("plus")} Add a task</button></div></section></div>`;

}



async function refreshLeaderboard(force = false) {

  if (!account || !api) return;

  if (leaderboardStatus === "loading" || (!force && Date.now() - lastRanking < (window.MobAndroid?300_000:60_000))) return;

  const uid = account.uid;

  leaderboardStatus = "loading";

  if (route() === "social") render();

  try {

    let data;
    if(window.MobAndroid){
      let device=read("social-device","");if(!device){device=crypto.randomUUID();save("social-device",device);}
      const minutes=[...new Map(sessions.map(session=>[session.id,session])).values()].reduce((sum,session)=>sum+Math.max(0,Number(session.minutes)||0),0);
      const result=await api.androidSocial(device,minutes);
      if(account?.uid!==uid)return;
      settings={...settings,shareScore:result.sharing===true};
      save("android-settings:"+uid,settings);data=result.rows||[];
    }else data=await api.leaderboard();

    if (account?.uid !== uid) return;

    leaderboard = data;

    lastRanking = Date.now();

    leaderboardStatus = "ready";

  } catch {

    if (account?.uid !== uid) return;

    leaderboardStatus = "failed";

  }

  if (route() === "social") render();

}



function socialView() {

  const rows = leaderboard.map(({ username, minutes, position, photo_url }) =>

    `<li class="leader-row ${Number(position) <= 3 ? "podium" : ""} ${username === handle ? "own-rank" : ""}"><span class="rank">${Number(position)}</span><span class="leader-avatar" data-initial="${escape(username[0].toUpperCase())}">${/^https:\/\/(?:[^/]+\.)?googleusercontent\.com\//i.test(photo_url||"")?`<img src="${escape(photo_url)}" alt="" loading="lazy" referrerpolicy="no-referrer">`:escape(username[0].toUpperCase())}</span><strong>@${escape(username)}${username === handle ? ' <small>You</small>' : ""}</strong><span>${Number(minutes).toLocaleString()} min</span></li>`).join("");

  const accountAction = !account ? '<button class="button primary" data-action="account">Login</button>'

    : !handleLoaded ? `<span class="muted">${handleLoadFailed ? "Username unavailable. Reload to retry." : "Loading your profile…"}</span>`
    : !handle ? '<button class="button primary" data-action="onboard">Choose username to share</button>'

    : `<label class="switch"><input type="checkbox" id="share-score" role="switch" ${settings.shareScore ? "checked" : ""}> Show my score</label>`;

  let empty = "No scores yet. Finish a Pomodoro and join the board.";

  if (leaderboardStatus === "schema") empty = "Rankings are waiting for the account database update.";

  else if (!account) empty = "Log in to see the rankings.";

  else if (leaderboardStatus === "loading") empty = "Loading rankings…";

  else if (leaderboardStatus === "failed") empty = "Couldn’t load rankings. Try refreshing.";

  return `${heading("Social", "Focus together. Share only the score you choose.")}

    <section class="card leaderboard">${sectionTitle("social", "Global leaderboard", window.MobAndroid?"Completed focus minutes · refreshes every 5 minutes":"All-time completed Pomodoro minutes", accountAction)}

      ${rows ? `<ol class="leader-list">${rows}</ol>` : `<p class="empty">${empty}</p>`}

      ${account ? '<div class="task-footer"><button class="text-action" data-action="rank-refresh">Refresh rankings</button></div>' : ""}

    </section>`;

}



function timeUsed(seconds) {

  const hours = Math.floor(seconds / 3600);

  const minutes = Math.floor(seconds / 60) % 60;

  if (hours) return `${hours}h ${minutes}m`;

  return minutes ? `${minutes}m` : `${Math.floor(seconds)}s`;

}



function youtubeSeconds() {

  const cloud = youtubeCloud?.day === budgetDay() ? youtubeCloud.seconds : 0;

  const browser = extensionStatus?.usage?.day === budgetDay() ? extensionStatus.total : 0;

  const android = nativeStatus.youtubeDay === budgetDay() ? nativeStatus.youtubeSeconds : 0;

  return Math.max(cloud, browser || 0, android || 0);

}



async function refreshYouTubeBudget() {

  if (window.MobAndroid || !account || youtubeSyncing || document.hidden || route() !== "flow") return;

  if (Date.now() - youtubeLastRead < 300_000) return;

  youtubeLastRead = Date.now();

  youtubeSyncing = true;

  const uid = account.uid;

  const date = budgetDay();

  try {

    const seconds = await api.youtubeSeconds(date);

    if (account?.uid === uid) {

      youtubeCloud = { day: date, seconds };

      drawBudget();

    }

  } catch {

    // The local companion can still block and report its last-known total.

  } finally { youtubeSyncing = false; }

}



async function linkAndroidBudget() {}



function drawBudget() {

  const deviceStatus=$("#device-tracking-status");

  if (deviceStatus) {

    deviceStatus.textContent=window.MobAndroid

      ? (!nativeStatus.usage ? "Allow Usage Access to track foreground apps" : nativeStatus.flowStatus || "Waiting for Android tracking")

      : window.MobDesktop

        ? (nativeStatus.desktop?.running ? "Foreground tracker running · 60-second idle cutoff" : "Checking foreground tracker")

          + (nativeStatus.desktop?.startup ? " · Starts at sign-in" : " · Enable Start Mob at sign-in from the tray")

        : extensionAvailable ? (extensionStatus?.linked ? "Extension linked · " + (extensionStatus.tracking ? "Website tracking on" : "Website tracking off") + (extensionStatus.granted ? "" : " · YouTube access needed") + " · " + (extensionStatus.syncStatus || "Waiting to sync") : "Extension installed") : "Install the extension to track browser tabs";

  }

  const summary = $("#youtube-budget");

  if (!summary) return;

  const seconds = youtubeSeconds();

  const limit = settings.dailyLimit * 60;

  summary.querySelector("strong").textContent = limit && seconds >= limit ? "Limit reached" : timeUsed(seconds) + " used";

  summary.querySelector("small").textContent = limit ? timeUsed(limit) + " daily budget" : "No daily limit";

  const progress = summary.querySelector("progress");

  progress.hidden = !limit;

  progress.max = limit || 1;

  progress.value = Math.min(seconds, progress.max);

}



function flowView() {
  if(window.MobAndroid)return `${heading("Flow", "Your focus, with room to grow.")}<section class="card coming-soon">${icon("flow")}<span class="pill">Coming soon</span><h2>Flow for Android</h2><p>App usage tracking and usage limits are not available on Android yet.</p><p class="muted">For now, use tasks, Pomodoro, Social and local YouTube Shorts blocking. Website and Windows usage stay on those devices.</p></section>`;

  const sync = account ? "Usage sync runs about every 5 minutes while connected." : "Log in to sync your activity and YouTube budget.";

  const browserSetup = window.MobDesktop ? "" : extensionStatus?.linked
    ? '<label class="switch browser-tracking"><input id="browser-tracking" type="checkbox" role="switch" ' + (browserTracking ? "checked" : "") + '> Track active browser tabs</label>'
    : `<div class="card flow-control">${extensionAvailable ? "<p>Sign in and open Flow to connect your browser.</p>" : extensionDownload()}</div>`;
  return `${heading("Flow")}
    ${window.MobDesktop ? `<div class="card flow-control"><label class="switch"><input type="checkbox" id="flow-tracking" role="switch" ${trackingAllowed ? "checked" : ""}> Track foreground apps</label><p class="small-text muted">${sync}</p></div>` : browserSetup}
    <p class="small-text muted" id="device-tracking-status" role="status"></p>
    <div id="flow-dashboard"></div>${flowControls.render()}
    <div class="flow-layout">

      <section class="card flow-safety">${sectionTitle("shield", "Focus blocking", "")}

        <div class="youtube-budget" id="youtube-budget"><strong></strong><small></small><progress aria-label="Daily YouTube budget"></progress></div>

        <label class="switch"><input type="checkbox" id="shorts-toggle" role="switch" ${settings.blockShorts ? "checked" : ""}> Block YouTube Shorts</label>

        <p class="small-text muted">${account ? "Linked devices share a daily budget that resets at midnight UTC." : "Counts YouTube time on this device. Resets at midnight UTC."}</p>

        <form id="shorts-form">

          <label class="field">Open a YouTube link<input name="url" type="url" placeholder="https://www.youtube.com/watch?v=…" maxlength="2000" required></label>

          <p class="error" role="alert"></p><button type="submit" class="button primary">Open link</button>

        </form>

      </section>

    </div>`;

}



function drawFlow() {
  if(window.MobAndroid)return;

  drawBudget();

  flow.draw();

}



function sendFocusPolicy() {

  nativeMessage("focus-policy", { sites: settings.blockedSites || [], until: timer.mode==="focus" ? timer.endsAt : null });

  if (extensionAvailable && extensionStatus?.linked) extensionMessage("focus-policy", {

    owner:account?.uid,

    policy: { rules:settings.usageRules||[], siteLimits:settings.siteLimits || {}, sites: settings.blockedSites || [], until: timer.mode === "focus" ? timer.endsAt : null, theme: settings.theme,

      shorts:settings.blockShorts,limit:settings.dailyLimit }

  });

}



function renderSidebar() {

  document.body.classList.toggle("sidebar-collapsed", sidebarCollapsed);

  const button = $("#sidebar-toggle");

  const label = sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar";

  button.setAttribute("aria-label", label);

  button.setAttribute("aria-expanded", String(!sidebarCollapsed));

  button.title = label;

  button.querySelector("span").textContent = label;

}



function render() {

  const page = route();

  const nav = navMarkup();
  document.body.dataset.view = page;
  const settingsLink = $("#settings-link");
  settingsLink.classList.toggle("active", page === "settings");
  if (page === "settings") settingsLink.setAttribute("aria-current", "page");
  else settingsLink.removeAttribute("aria-current");
  document.body.classList.toggle("android-app",Boolean(window.MobAndroid));
  $(".mobile-account").innerHTML=avatarMarkup();

  $("#nav").innerHTML = nav;

  $("#mobile-nav").innerHTML = nav;

  $("#profile").innerHTML = profileMarkup();

  $("#profile").setAttribute("aria-label", account ? "Your account" : "Guest workspace");

  renderSidebar();

  $("#crumb").textContent = views[page][0];

  const markup = { today: todayView, tasks: tasksView, calendar: calendarView, social: socialView, focus: focusView, flow: flowView, settings: settingsView };

  const active = document.activeElement;

  const activeAction = active?.dataset?.action;

  const activeId = active?.dataset?.id;

  const selected = active?.selectedOptions ? active.id : "";

  const activeInView = active && $("#view").contains(active);

  const editingSettings = page === "settings" && $("#view form")?.contains(active) && !refreshSettingsView;
  refreshSettingsView = false;
  if (!editingSettings && (page !== "focus" || !$("#focus-stage"))) $("#view").innerHTML = markup[page]();

  if (page === "focus") renderFocus();

  if (page === "flow") drawFlow();

  if (activeInView && activeAction) {

    [...$("#view").querySelectorAll("[data-action]")].find(button => button.dataset.action === activeAction && button.dataset.id === activeId)?.focus({ preventScroll: true });

  } else if (selected) {

    document.getElementById(selected)?.focus({ preventScroll: true });

  }

  changeTheme();

  drawClock();

}



function drawClock() {

  const remaining = timerRemaining(timer);

  const seconds = Math.ceil(remaining / 1000);

  const time = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  const field = $(".time");

  if (field && field.textContent !== time) field.textContent = time;

  $(".timer-ring .progress")?.setAttribute("stroke-dasharray", `${100 * remaining / timer.duration} 100`);

  document.title = timer.endsAt ? `${time} · ${timerLabels[timer.mode]} · Mob` : "Mob · North Designer";

}



function validCloudTimer(value) {

  return value && typeof value === "object" && Object.hasOwn(timerLabels, value.mode)

    && Number.isFinite(value.duration) && value.duration > 0 && value.duration <= 7_200_000

    && Number.isFinite(value.remaining) && value.remaining >= 0 && value.remaining <= value.duration

    && (value.endsAt === null || Number.isFinite(value.endsAt))

    && Number.isInteger(value.rounds) && value.rounds >= 0

    && typeof value.taskId === "string" && typeof value.id === "string"

    && Number.isFinite(value.updatedAt);

}



function setTimer(next, redraw = true, sync = true) {

  timer = { ...next, updatedAt: sync ? Date.now() : next.updatedAt };

  save(timerKey(), timer);

  if (account && sync) {

    save(pendingTimerKey(), timer);

    void syncTimer();

  }

  sendFocusPolicy();

  if (redraw) render();

}



async function syncTimer() {

  if (window.MobAndroid) return;

  if (!account || syncingTimer || !navigator.onLine) return;

  const uid = account.uid;

  const key = pendingTimerKey();

  const value = read(key, null);

  if (!value) return;

  syncingTimer = true;

  let uploaded = false;

  try {

    await api.put(uid, "profile", "settings", { activeTimer: value });

    uploaded = true;

    if (read(key, null)?.updatedAt === value.updatedAt) localStorage.removeItem("mob:" + key);

  } catch {

    // The timer remains usable and its latest pending state retries after reconnecting.

  } finally {

    syncingTimer = false;

    if (uploaded && read(key, null) && account?.uid === uid) void syncTimer();

  }

}



function notify(title, body, tag) {

  if (!settings.notifications || !read("device-notifications", false)) return;

  if (nativeMessage("notify", { title, body, tag })) return;

  if (globalThis.Notification?.permission !== "granted") return;

  const options = { body, tag, icon: "./icon-192.png", badge: "./icon-192.png" };

  void (async () => {

    try {

      const registration = await navigator.serviceWorker?.getRegistration();

      if (registration) await registration.showNotification(title, options);

      else new Notification(title, options);

    } catch {

      toast(title + " · " + body);

    }

  })();

}



function reminderTimestamp(task) {

  return Date.parse(task.remindAt || `${task.date}T${task.time}:00`);

}



function sendPlatformSettings() {

  nativeMessage("flow", { enabled: trackingAllowed, since: flow.epoch(), owner: account?.uid || "" });

  sendFocusPolicy();

  nativeMessage("policy", { blockShorts: settings.blockShorts, dailyLimit: 0 });

  nativeMessage("reminders", {

    items: settings.notifications && read("device-notifications", false) ? tasks

      .filter(task => task.date && task.time && !task.completedDay && reminderTimestamp(task) > Date.now())

      .map(task => ({ id: task.id, title: task.title, at: reminderTimestamp(task) })) : []

  });

}



function unlockAudio() {

  if (!settings.sound || !globalThis.AudioContext) return;

  try {

    audio ||= new AudioContext();

    void audio.resume().catch(() => {});

  } catch {

    // The timer remains usable if sound is unavailable.

  }

}



function chime() {

  if (!settings.sound || audio?.state !== "running") return;

  const oscillator = audio.createOscillator();

  const volume = audio.createGain();

  const now = audio.currentTime;

  oscillator.type = "sine";

  oscillator.frequency.setValueAtTime(600, now);

  oscillator.frequency.setValueAtTime(850, now + .13);

  volume.gain.setValueAtTime(.1, now);

  volume.gain.exponentialRampToValueAtTime(.001, now + .45);

  oscillator.connect(volume).connect(audio.destination);

  oscillator.start(now);

  oscillator.stop(now + .46);

}



function finishTimer(now) {

  const last = read(timerKey(), timer);

  if (last.id !== timer.id || last.endsAt !== timer.endsAt) {

    timer = last;

    render();

    return;

  }

  const ended = timer;

  setTimer(nextTimer(ended, settings, now, true), false);

  const wasFocus = ended.mode === "focus";

  if (wasFocus) {

    recordSession({ id: ended.id, day: dayKey(ended.endsAt), minutes: ended.duration / 60_000, taskId: ended.taskId });

  }

  const title = wasFocus ? "Focus session complete" : "Break finished";

  const body = wasFocus ? `Take a ${timer.mode === "long" ? "long" : "short"} break.` : "Ready for another focus session?";

  toast(title + " · " + body);

  chime();

  notify(title, body, "session-" + ended.id);

  render();

}



function checkReminders(now) {

  if (now - reminderSweep < 1500) return;

  reminderSweep = now;

  const key = "reminders:" + scope();

  const seen = read(key, {});

  let changed = false;

  for (const task of tasks) {

    if (!task.date || !task.time || task.completedDay) continue;

    const due = reminderTimestamp(task);

    const tag = `${task.id}-${due}`;

    if (!Number.isFinite(due) || due > now || due < now - 5 * 60_000 || seen[tag]) continue;

    seen[tag] = due;

    changed = true;

    toast("Task due · " + task.title);

    if (!window.MobAndroid) notify("Task due", task.title, tag);

  }

  if (changed) save(key, Object.fromEntries(Object.entries(seen).filter(([, due]) => due >= now - 86_400_000)));

}



function tick() {

  const now = Date.now();

  const today = dayKey(now);

  if (today !== day) {

    if (selectedDay === day) selectedDay = today;

    if (month === day.slice(0,7) + "-01") month = today.slice(0,7) + "-01";

    day = today;

    render();

  }

  flow.tick();
  checkAchievements();
  if(window.MobDesktop?.setUsagePolicy&&Date.now()-lastUsagePolicy>=2000) {
    lastUsagePolicy=Date.now();
    const state=flow.ruleState();
    window.MobDesktop.setUsagePolicy({...state,rules:settings.usageRules||[],theme:settings.theme,focusUntil:timer.mode==='focus'?timer.endsAt:0,enabled:trackingAllowed});
  }

  if (timer.endsAt && timer.endsAt <= now) finishTimer(now);

  drawClock();

  checkReminders(now);

}



const dialog = $("#dialog");

function modal(type, title, body) {

  dialogType = type;

  dialog.setAttribute("aria-labelledby", "dialog-heading");

  dialog.innerHTML = `<div class="dialog-title"><h2 id="dialog-heading">${title}</h2><button class="icon-button small" data-action="close" aria-label="Close">${icon("close")}</button></div>${body}`;

  if (!dialog.open) dialog.showModal();

  dialog.querySelector("[autofocus]")?.focus();

}



function closeDialog() { dialog.close(); }

dialog.addEventListener("close", () => {

  if (dialog.open) return;

  const previous = dialogType;

  dialogType = "";

  if(previous==="welcome"){save("welcome:"+platformName(),true);return;}
  if (previous !== "onboard" && previous !== "browser-consent") maybeOnboard();

});



function taskDialog(key, date) {

  const task = tasks.find(item => item.id === key);

  const value = task || { title: "", date: date || day, project: "", time: "", priority: "medium" };

  modal("task", task ? "Edit task" : "New task", `<form id="task-form" class="dialog-body" data-id="${escape(key || "")}">

    <label class="field">Task name<input name="title" required maxlength="140" value="${escape(value.title)}" autofocus placeholder="What needs to get done?"></label>

    <div class="form-grid"><label class="field">Due date<input name="date" type="date" min="1900-01-01" max="2199-12-31" value="${escape(value.date)}"></label><label class="field">Reminder time<input name="time" type="time" value="${escape(value.time)}"></label></div>

    <label class="field">Project<input name="project" maxlength="35" value="${escape(value.project)}" placeholder="Optional"></label>

    <fieldset class="field priority-group"><legend>Priority</legend><div class="segments priority-options">${Object.entries({ low: "Low", medium: "Medium", high: "High" }).map(([level, label]) => `<label><input type="radio" name="priority" value="${level}" ${level === value.priority ? "checked" : ""}><span class="priority-${level}">${label}</span></label>`).join("")}</div></fieldset>

    <p class="error" role="alert"></p>

    <div class="form-actions">${task ? `<button type="button" class="button danger" data-action="task-delete-confirm" data-id="${escape(key)}">Delete</button>` : ""}<button type="button" class="button" data-action="close">Cancel</button><button class="button primary" type="submit">Save task</button></div></form>`);

}



function switchField(name, label) {

  if(window.MobAndroid && name==="flowTracking") return "";

  return `<label class="switch"><input type="checkbox" name="${name}" role="switch" ${(name === "flowTracking" ? trackingAllowed : settings[name]) ? "checked" : ""}> ${label}</label>`;

}

function numberField(name, label, min, max) {

  return `<label class="field">${label}<input type="number" required name="${name}" min="${min}" max="${max}" value="${settings[name]}"></label>`;

}



let settingsTab = "appearance";
let refreshSettingsView = false;
function openSettings(tab = "appearance") {
  settingsTab = tab;
  refreshSettingsView = true;
  if (route() === "settings") render();
  else location.hash = "settings";
}
function settingsView(tab = settingsTab) {

  const tabs = { appearance: "Appearance", timer: "Timer", ...(window.MobAndroid?{shorts:"Shorts",navigation:"Navigation"}:{}) };
  if(!tabs[tab])tab="appearance";

  const nav = `<div class="segments settings-tabs" aria-label="Settings sections">${Object.entries(tabs).map(([key, label]) =>

    `<button type="button" class="${key === tab ? "active" : ""}" aria-pressed="${key === tab}" data-action="settings-tab" data-id="${key}">${label}</button>`).join("")}</div>`;

  const themeOptions = {

    plain: ["Graphite", "linear-gradient(135deg,#111613 55%,#c1dbb1 55%)"],

    daylight: ["Daylight", "linear-gradient(135deg,#f1f3ec 55%,#315b40 55%)"],

    ocean: ["Deep ocean", "linear-gradient(135deg,#101923 55%,#a9d8ee 55%)"],

    forest: ["Evergreen", "linear-gradient(135deg,#102019 55%,#cfdeb1 55%)"],

    photo: ["Custom photo", "url('./focus-lake.jpg') center/cover"]

  };

  const selected = document.documentElement.dataset.theme;

  const appearance = `<form id="appearance-form" class="dialog-body">

    <fieldset class="field theme-options"><legend>Website theme</legend>${Object.entries(themeOptions).map(([value, [label, color]]) => `<label class="theme-option"><input type="radio" name="theme" value="${value}" ${selected === value ? "checked" : ""}><span class="theme-swatch" style="--swatch:${color}"></span><span>${label}</span></label>`).join("")}</fieldset>

    <label class="field">Background photo<input type="file" name="photo" accept="image/*"></label>

    ${settings.photo ? switchField("removePhoto", "Remove saved photo") : ""}

    <p class="error" role="alert"></p>

    <div class="form-actions"><button class="button primary" type="submit">Apply theme</button></div>

  </form>`;

  const timerForm = `<form id="settings-form" class="dialog-body">

    <div class="form-grid">${numberField("focus", "Focus minutes", 1, 120)}${numberField("short", "Short break minutes", 1, 60)}${numberField("long", "Long break minutes", 1, 90)}${numberField("interval", "Rounds per long break", 2, 12)}${numberField("focusGoal", "Daily focus goal", 1, 20)}</div>

    ${switchField("autoBreak", "Automatically start breaks")}${switchField("autoFocus", "Automatically start focus sessions")}${switchField("sound", "Play a chime when a phase ends")}${switchField("motion", "Play the background video on desktop")}

    <div class="form-actions"><button type="button" class="button" data-action="notifications">Notifications</button><button class="button primary" type="submit">Save settings</button></div>

  </form>`;

  const shorts = `<div class="dialog-body"><h3>YouTube Shorts</h3><p>Keep regular YouTube videos and dismiss the Shorts player locally.</p><label class="switch"><input id="shorts-toggle" type="checkbox" ${settings.blockShorts?"checked":""}> Block YouTube Shorts</label><p class="permission-status" role="status">${settings.blockShorts?(nativeStatus.blocking?"Blocking is enabled.":"Turn on Mob in Android Accessibility settings to finish setup."):"Blocking is off."}</p><button class="button" data-action="native-blocking">Open Accessibility settings</button><small class="muted">Mob reads only the active YouTube screen to recognize Shorts. No app usage is collected or uploaded.</small></div>`;
  const navigation = `<div class="dialog-body"><p>Arrange the bottom bar in the order that works for you. Changes stay on this device.</p><ol class="navigation-editor">${navigationOrder().map((key,i)=>`<li><span>${icon(views[key][1])} ${views[key][0]}</span><button class="icon-button small" data-action="nav-move" data-id="${key}:-1" aria-label="Move ${views[key][0]} earlier" ${i===0?"disabled":""}>${icon("chevron-left")}</button><button class="icon-button small" data-action="nav-move" data-id="${key}:1" aria-label="Move ${views[key][0]} later" ${i===navigationOrder().length-1?"disabled":""}>${icon("chevron-right")}</button></li>`).join("")}</ol><button class="button" data-action="nav-reset">Reset order</button></div>`;
  return `${heading("Settings")}<section class="card settings-page">${nav}${({ appearance, timer: timerForm, shorts, navigation })[tab]}</section>`;

}



async function requestNotifications() {

  if (nativeMessage("notification-permission")) return;

  if (!globalThis.Notification) { toast("Notifications are unavailable in this browser."); return; }

  try {

    const granted = await Notification.requestPermission() === "granted";

    save("device-notifications", granted);

    if (granted) saveSettings({ notifications: true });

    if (dialogType === "notifications") notificationDialog();

    else if (dialogType === "onboard") $(".permission-status").textContent = granted ? "Notifications enabled." : "Notifications are off.";

  } catch { toast("This browser couldn’t enable notifications."); }

}



function notificationDialog() {

  const permission = globalThis.Notification?.permission;

  const native = Boolean(window.MobAndroid);

  const enabled = settings.notifications && read("device-notifications", false) && (native || permission === "granted");

  const blocked = !native && (!permission || permission === "denied");

  const detail = native ? "Android can alert you when a task is due, including when Mob is closed."

    : "Get an alert when a timer ends or a task is due while Mob is open.";

  modal("notifications", "Reminders", `<div class="dialog-body"><p>${detail}</p>

    ${native ? '<button class="button" data-action="exact-reminders">Allow exact reminder times</button>' : ""}

    ${blocked ? '<p class="muted">Check notification permissions in your browser settings.</p>' : `<button class="button primary" data-action="${enabled ? "notifications-off" : "notifications-enable"}">${enabled ? "Turn off on this device" : "Allow notifications"}</button>`}

  </div>`);

}



function accountDialog(mode = "login") {

  if (account) {

    modal("account", "Your account", `<div class="dialog-body"><div class="inline">${profileMarkup()}</div><p class="muted">${escape(account.email || "")}</p>

      <div class="account-actions">${handleLoaded && !handle ? '<button class="button" data-action="onboard">Choose username</button>' : ""}<button class="button" data-action="account-password">Set a password</button><button class="button" data-action="signout">Log out</button><button class="button danger" data-action="delete-account">Delete account</button></div></div>`);

    return;

  }

  const signup = mode === "signup";

  const reset = mode === "reset";

  const title = signup ? "Create an account" : reset ? "Reset password" : "Login";

  const authNotice = !getConfig() ? "Account sync needs a configured Supabase project."

    : backendError ? "Mob couldn’t connect. Your guest workspace is still available." : api ? "" : "Connecting…";

  const disabled = api ? "" : "disabled";

  modal("account", title, `<form id="auth-form" data-mode="${mode}" class="dialog-body">

    ${authNotice ? `<div class="notice">${authNotice}</div>` : ""}

    ${signup ? '<label class="field">Username<input name="username" autocomplete="username" autocapitalize="none" minlength="3" maxlength="24" required placeholder="e.g. quiet-knight"></label><small class="muted">This is your permanent name on the leaderboard.</small>' : ""}

    <label class="field">${signup || reset ? "Email" : "Email or username"}<input name="email" type="${signup || reset ? "email" : "text"}" required autocomplete="${signup || reset ? "email" : "username"}" autocapitalize="none" ${disabled}></label>

    ${reset ? "" : `<label class="field">Password<input name="password" type="password" minlength="${signup ? 8 : 1}" required autocomplete="${signup ? "new-password" : "current-password"}" ${disabled}></label>`}

    <p class="error" role="alert"></p>

    <div class="account-actions">

      <button class="button primary" type="submit" ${disabled}>${signup ? "Create account" : reset ? "Send reset link" : "Login"}</button>

      ${reset ? "" : `<button class="button" type="button" data-action="google" ${disabled}><span class="google-mark" aria-hidden="true">G</span> Continue with Google</button>`}

      <button class="text-action" type="button" data-action="auth-mode" data-id="${mode === "login" ? "signup" : "login"}">${mode === "login" ? "Create an account" : "Back to login"}</button>

      ${mode === "login" ? '<button class="text-action" type="button" data-action="auth-mode" data-id="reset">Forgot password?</button>' : ""}

    </div></form>`);

}



function platformName(){return window.MobAndroid?"android":window.MobDesktop?"windows":"web";}
function finishSetup(){save("welcome:"+platformName(),true);save("permissions:"+scope(),true);saveSettings({onboarded:true});closeDialog();}
function welcome(step=0){
  step=Math.min(2,Math.max(0,Number(step)||0));
  const native=Boolean(window.MobAndroid),desktop=Boolean(window.MobDesktop);
  const pages=[
    ["Welcome to Mob", "Plan your day with tasks and calendar, then focus on one thing at a time. Guest tasks stay on this device; logging in safely merges them into your account."],
    ["Make room for focus", "Use Pomodoro, local focus sounds and Spotify. Open Theater for a quiet timer and a compact Spotify player. Social is optional: choose whether to share your focus score."],
    [native?"Your Android setup":desktop?"Your Windows setup":"Connect your browser",native?"Reorder the bottom bar in Settings → Navigation. Turn on Shorts blocking in Settings → Shorts; Android asks for accessibility only for that feature. Flow is coming soon; Android app usage is not collected.":desktop?"Keep Mob running or in the tray to track foreground apps. Link the browser extension for active-tab usage and website blocking. Choose visited apps or websites in Flow to set limits.":"Download the Mob extension to track active tabs and use website limits in Flow."]
  ];
  modal("welcome",`${step+1} of 3 · ${pages[step][0]}`,`<div class="dialog-body welcome-journey"><img class="onboard-logo" src="./icon.svg" alt="Mob"><p>${pages[step][1]}</p>${step===2&&!native?extensionDownload():""}<p class="small-text muted">You can revisit setup from Account at any time. Permissions are optional and requested when you enable a feature.</p><div class="form-actions"><button class="button" data-action="setup-finish">Skip for now</button>${step?`<button class="button" data-action="welcome" data-id="${step-1}">Back</button>`:""}<button class="button primary" data-action="${step===2?"onboard":"welcome"}" data-id="${step===2?1:step+1}">${step===2?"Set up features":"Next"}</button></div></div>`);
}

const extensionURL = "https://github.com/mckindobsidian-oss/Mob-Platform/releases/download/v1.5.1/Mob-Browser-Extension-v1.6.3.zip";
function extensionDownload() {
  return `<a class="button primary" href="${extensionURL}">Download Mob extension</a><p class="small-text muted">Extract the ZIP and load it from Chrome or Edge’s Extensions page using Developer mode. Reload Flow when it’s installed.</p>`;
}
let browserPrompt = "";
let pairingKey = "";
const browserConsentKey = () => `browser-consent:${scope()}:${extensionStatus?.device || ""}`;
async function connectBrowser() {
  if (companionBusy || !account || !extensionStatus?.device || extensionStatus.linked) return;
  const uid = account.uid;
  const browser = extensionStatus.device;
  const key = browserConsentKey();
  if (pairingKey === key) return;
  companionBusy = true;
  pairingKey = key;
  try {
    const connection = await api.pairCompanion(browser);
    if (account?.uid === uid && extensionStatus?.device === browser) extensionMessage("pair", connection);
  } catch {
    toast("Couldn’t connect the browser. Reload Flow to try again.");
  } finally { companionBusy = false; }
}
function maybeConnectBrowser() {
  if (route() !== "flow" || window.MobAndroid || !account || !extensionStatus?.device || extensionStatus.linked || dialog.open) return;
  const key = browserConsentKey();
  if (read(key, false)) { void connectBrowser(); return; }
  if (browserPrompt === key) return;
  browserPrompt = key;
  modal("browser-consent", "Enable browser activity?", `<div class="dialog-body"><p>Link the Mob extension to this account. It records time by website domain for your active tab and syncs aggregated usage. You can turn tracking off in Flow.</p><div class="form-actions"><button class="button" data-action="defer-extension">Not now</button><button class="button primary" data-action="allow-extension">Allow</button></div></div>`);
}

function maybeOnboard() {

  if (!settings.onboarded && !read("welcome:"+platformName(),false) && !dialog.open) {welcome();return;}

  if (route() === "flow") maybeConnectBrowser();

}



function onboard(step = 1) {

  permissionJourney = Number(step) || 1;

  if (account && !handle && !handleLoaded) {

    toast(leaderboardStatus === "schema" ? "Username setup is waiting for the account database update." : "Loading your account…");

    return;

  }

  if (account && !handle) {

    const pending = read("pending-handle", {});

    modal("onboard", "Choose your username", `<form id="handle-form" class="dialog-body">

      <p class="muted">Your username is yours to keep. Use it to log in and appear on the leaderboard.</p>

      <label class="field">Username<input name="username" autocomplete="username" autocapitalize="none" minlength="3" maxlength="24" required autofocus value="${pending.email === account.email ? escape(pending.username) : ""}"></label>

      <p class="error" role="alert"></p><div class="form-actions"><button class="button primary" type="submit">Claim username</button></div></form>`);

    return;

  }

  if(window.MobAndroid){
    modal("onboard","Set up Mob on Android",`<div class="dialog-body"><p>Tasks sync with your account. Social shares completed focus minutes only when you opt in and refreshes every five minutes. Your timer and Shorts blocker work locally.</p><label class="switch"><input id="shorts-toggle" type="checkbox" ${settings.blockShorts?"checked":""}> Block YouTube Shorts</label><p class="permission-status">${nativeStatus.blocking?"Accessibility is ready.":"Accessibility is needed only for Shorts blocking."}</p><button class="button" data-action="native-blocking">Set up Shorts blocking</button><button class="button" data-action="notifications">Set up reminders</button><button class="button primary" data-action="setup-finish">Finish setup</button></div>`);return;
  }
  modal("onboard", "Set up Flow", `<div class="dialog-body">${extensionDownload()}<div class="form-actions"><button class="button primary" data-action="setup-finish">Done</button></div></div>`);


}



async function backgroundPhoto(file) {

  if (!file.type.startsWith("image/")) throw new Error("Choose an image file.");

  if (file.size > 20_000_000) throw new Error("Choose an image smaller than 20 MB.");

  const bitmap = await createImageBitmap(file);

  try {

    const scale = Math.min(1, 1500 / Math.max(bitmap.width, bitmap.height));

    const canvas = document.createElement("canvas");

    canvas.width = Math.max(1, Math.round(bitmap.width * scale));

    canvas.height = Math.max(1, Math.round(bitmap.height * scale));

    const context = canvas.getContext("2d");

    context.fillStyle = "#1a1821";

    context.fillRect(0, 0, canvas.width, canvas.height);

    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    for (const quality of [.8, .6, .4, .2]) {

      const data = canvas.toDataURL("image/jpeg", quality);

      if (data.length <= 450_000) return data;

    }

    throw new Error("Choose a smaller or less detailed photo.");

  } finally {

    bitmap.close();

  }

}



function authError(error) {

  return ({

    invalid_credentials: "That email or username and password didn’t match.",

    login_unavailable: "Username login is temporarily unavailable. You can still log in with your email.",

    user_already_exists: "This email already has an account. Log in or reset your password.",

    email_not_confirmed: "Confirm your email before logging in.",

    over_email_send_rate_limit: "Too many emails were requested. Try again later.",

    weak_password: "Choose a stronger password.",

    same_password: "Choose a different password.",

    validation_failed: "Check your email address and password."

  })[error.code] || "Login couldn’t finish. Please try again.";

}



function formError(form, message) { form.querySelector(".error").textContent = message; }



function recoveryDialog() {

  modal("recovery", "Choose a new password", `<form class="dialog-body" id="recovery-form"><label class="field">New password<input type="password" name="password" minlength="8" autocomplete="new-password" autofocus required></label><p class="error" role="alert"></p><div class="form-actions"><button type="submit" class="button primary">Update password</button></div></form>`);

}



function watchAccount(user, event) {

  if (account?.uid === user?.uid) {

    if (user && user.photoURL !== account.photoURL) { account = user; render(); }

    if (event === "PASSWORD_RECOVERY") recoveryDialog();

    return;

  }

  for (const unsubscribe of subscriptions) unsubscribe();

  subscriptions = [];



  focusSound?.stop();
  if (account) {
    const previous = Object.fromEntries(devicePreferenceKeys.map(key => [key, settings[key]]));
    save("device-preferences", { ...previous, ...devicePreferences() });
  }
  account = user;
  achievementReady={tasks:false,sessions:Boolean(window.MobAndroid)};

  flow.account(window.MobAndroid ? null : user?.uid, api);

  youtubeLastRead = 0;

  youtubeCloud = null;

  if (nativeStatus.owner && nativeStatus.owner !== user?.uid) {

    nativeMessage("youtube-account");

    nativeStatus = { ...nativeStatus, owner: "", youtubeSeconds: 0 };

  }

  handleLoaded = false;
  handleLoadFailed = false;

  handle = "";

  leaderboard = [];

  leaderboardStatus = "";

  lastRanking = 0;

  if (!user) {

    guest = read("guest", guest);

    settings = { ...defaults, ...guest.settings, ...devicePreferences() };

    tasks = guest.tasks;

    sessions = guest.sessions;

    timer = read(timerKey(), newTimer(settings));

    if (dialog.open && dialogType === "account") accountDialog();

    render();

    sendPlatformSettings();

    return;

  }

  const uid = user.uid;

  if (guest.tasks.length || guest.sessions.length) {

    for (const {id,...task} of guest.tasks) cloud(api.put(uid,"tasks",id,task));

    if (!window.MobAndroid) save("session-queue:"+uid,{...read("session-queue:"+uid,{}),...Object.fromEntries(guest.sessions.map(session=>[session.id,session]))});

    if (!read("timer:"+uid,null)) save("timer:"+uid,read("timer:guest",newTimer(settings)));

    if (window.MobAndroid) save("android-sessions:"+uid,[...read("android-sessions:"+uid,[]),...guest.sessions]);

    guest={...guest,tasks:[],sessions:[]}; save("guest",guest);

  }



  settings = { ...defaults, ...read("android-settings:"+uid,{}), ...devicePreferences() };

  tasks = [];

  sessions = window.MobAndroid ? read("android-sessions:"+uid,[]) : [];

  timer = read(timerKey(), newTimer(settings));

  if (dialog.open && dialogType === "account") closeDialog();

  let profileLoaded = false;

  void api.handle().then(value => {

    if (account?.uid !== uid) return;

    handle = value;

    handleLoaded = true;

    render();
    maybeConnectBrowser();

    if (profileLoaded || window.MobAndroid) {

      sendPlatformSettings();

      void linkAndroidBudget();

      if (event !== "PASSWORD_RECOVERY") maybeOnboard();

    }

    if (window.MobAndroid || route() === "social") void refreshLeaderboard();

    void refreshYouTubeBudget();

  }).catch(error => {

    if (account?.uid !== uid) return;

    handleLoadFailed = true;
    render();

    if (route() === "social") void refreshLeaderboard(true);

    toast(error.code === "PGRST205" ? "Username setup is waiting for the account database update." : "Couldn’t load your username. Reload Mob to retry.");

  });

  subscriptions = [

    ...(window.MobAndroid ? [] : [api.watchSettings(uid, data => {

      if (account?.uid !== uid) return;

      const previousAudio=soundSettings();
      settings = { ...defaults, ...data, ...devicePreferences() };
      if (data) {
        const preferences = devicePreferences();
        const incoming = Object.fromEntries(devicePreferenceKeys.filter(key => data[key] != null && !Object.hasOwn(preferences, key)).map(key => [key, data[key]]));
        if (Object.keys(incoming).length) save("device-preferences", { ...preferences, ...incoming });
      }
      if(focusSound?.playing){
        if(soundSettings().preset!==previousAudio.preset){focusSound.stop();toast("Sound preferences updated. Press Play to listen.");}
        else focusSound.setVolume(soundSettings().volume);
      }

      if (validCloudTimer(data?.activeTimer) && data.activeTimer.updatedAt > (timer.updatedAt || 0)) {

        setTimer(data.activeTimer, false, false);

      } else if (!timer.id && !timer.updatedAt) {

        timer = newTimer(settings, timer.mode, { rounds: timer.rounds, taskId: timer.taskId });

      }

      void syncTimer();

      render();

      if (handleLoaded) {

        sendPlatformSettings();

        void linkAndroidBudget();

        if (!profileLoaded && event !== "PASSWORD_RECOVERY") maybeOnboard();

      }

      profileLoaded = true;

    }, () => toast("Profile sync unavailable. Check the Supabase schema."))]),

    api.watchList(uid, "tasks", result => {

      if (account?.uid !== uid) return;

      achievementReady.tasks=true;
      tasks = result;

      render();

      sendPlatformSettings();

    }, () => toast("Task sync unavailable. Check the Supabase schema.")),

    ...(window.MobAndroid ? [] : [api.watchList(uid, "sessions", result => {

      if (account?.uid !== uid) return;

      achievementReady.sessions=true;
      const pending = Object.values(read(queueKey(), {}));

      const syncedIds = new Set(result.map(session => session.id));

      sessions = [...result, ...pending.filter(session => !syncedIds.has(session.id))];

      render();

      void syncSessions();

    }, () => toast("Focus history sync unavailable. Check the Supabase schema."))])

  ];

  if (event === "PASSWORD_RECOVERY") recoveryDialog();
  if (route() === "social") void refreshLeaderboard();
  maybeConnectBrowser();

  render();

  tick();

}



async function initAuth() {

  const config = getConfig();

  if (!config) return;

  try {

    api = await connectSupabase(config);

    api.watchUser(watchAccount);

    if (dialog.open && dialogType === "account") accountDialog($("#auth-form")?.dataset.mode);

  } catch {

    backendError = "connection";

    if (dialog.open && dialogType === "account") accountDialog($("#auth-form")?.dataset.mode);

  }

}



function changeMonth(delta) {

  const date = dayDate(month);

  date.setMonth(date.getMonth() + delta);

  month = dayKey(date);

  render();

}



function toggleMobileMenu(open = !document.body.classList.contains("mobile-menu-open")) {
  document.body.classList.toggle("mobile-menu-open", open);
  $("#mobile-menu")?.setAttribute("aria-expanded", String(open));
}

const actions = {
  "mobile-menu": () => toggleMobileMenu(),
  "sound-toggle": toggleFocusSound,
  "sound-preset": async preset=>{
    if(soundBusy || !soundPresets.some(([id])=>id===preset))return;
    const wasPlaying=focusSound?.playing;
    saveSettings({focusAudio:{...soundSettings(),preset}});
    if(wasPlaying){soundBusy=true;try{await focusSound.play(preset,soundSettings().volume);}catch(error){toast(error.message);}finally{soundBusy=false;}}
    render();
  },

  "task-new": key => taskDialog("", key || (route() === "calendar" ? selectedDay : day)),

  "task-edit": key => taskDialog(key),

  "task-check": key => {

    const task = tasks.find(item => item.id === key);

    if (!task) return;

    const completedDay = task.completedDay ? "" : day;

    saveTask({ ...task, completedDay });

  },

  "task-delete-confirm": key => {

    const task = tasks.find(item => item.id === key);

    if (!task) return;

    modal("task-delete", "Delete task?", `<div class="dialog-body"><p>${escape(task.title)}</p><div class="form-actions"><button class="button" data-action="task-edit" data-id="${escape(key)}">Cancel</button><button class="button danger" data-action="task-delete" data-id="${escape(key)}">Delete task</button></div></div>`);

  },

  "task-delete": key => { deleteTask(key); closeDialog(); },

  "task-filter": key => { taskFilter = key; render(); },

  "calendar-day": key => { selectedDay = key; month = key.slice(0,7) + "-01"; render(); },

  "month-prev": () => changeMonth(-1),

  "month-next": () => changeMonth(1),

  "month-today": () => { selectedDay = day; month = day.slice(0,7) + "-01"; render(); },

  "timer-toggle": () => {

    tick();

    if (timer.endsAt) setTimer({ ...timer, remaining: timerRemaining(timer), endsAt: null });

    else {

      unlockAudio();

      setTimer({ ...timer, endsAt: Date.now() + timer.remaining, id: timer.id || id() });

    }

  },

  "timer-mode": mode => {

    if (mode === timer.mode) return;

    if (timer.id && !confirm("Switch phases and reset the current timer?")) return;

    setTimer(newTimer(settings, mode, { rounds: timer.rounds, taskId: timer.taskId }));

  },

  "timer-reset": () => setTimer(newTimer(settings, timer.mode, { rounds: timer.rounds, taskId: timer.taskId })),

  "timer-skip": () => setTimer(nextTimer(timer, settings, Date.now(), false)),

  "settings-tab": openSettings,
  "welcome": welcome,
  "setup-finish": finishSetup,
  "nav-move": value=>{const [key,delta]=value.split(":");const order=navigationOrder(),at=order.indexOf(key),to=at+Number(delta);if(at>=0&&to>=0&&to<order.length){[order[at],order[to]]=[order[to],order[at]];save("navigation-order",order);render();openSettings("navigation");}},
  "nav-reset": ()=>{save("navigation-order",[]);render();openSettings("navigation");},

  "sidebar": () => {

    sidebarCollapsed = !sidebarCollapsed;

    save("sidebar", sidebarCollapsed);

    renderSidebar();

  },

  "motion": () => {

    clipOverride = !$("#focus-stage").classList.contains("motion-on");

    render();

  },

  "theater": () => {

    if (document.fullscreenElement === $("#focus-stage")) { void fullScreen(); return; }

    theater = !theater;

    render();

  },

  "fullscreen": fullScreen,

  "spotify-player": () => {
    if (!theater && !document.fullscreenElement) { theater = true; spotifyOpen = true; }
    else spotifyOpen = !spotifyOpen;
    render();
  },

  "spotify-link": () => {

    modal("spotify", "Your Spotify music", `<form id="spotify-form" class="dialog-body"><label class="field">Spotify URL<input name="url" type="url" required placeholder="https://open.spotify.com/playlist/…" value="${escape(settings.spotify)}" autofocus></label><p class="error" role="alert"></p><div class="form-actions">${settings.spotify ? '<button type="button" class="button" data-action="spotify-clear">Use default playlist</button>' : ""}<button class="button primary" type="submit">Load music</button></div></form>`);

  },

  "spotify-clear": () => {

    spotifyOpen = true;

    saveSettings({ spotify: "" });

    closeDialog();

  },

  "supabase-clear": () => {

    localStorage.removeItem("mob:supabase");

    location.reload();

  },

  "notifications": notificationDialog,

  "notifications-enable": requestNotifications,

  "notifications-off": () => {

    save("device-notifications", false);

    nativeMessage("notification-disable");

    sendPlatformSettings();

    notificationDialog();

  },

  "flow-hide": key => flow.manage("hide", key).catch(writeError),

  "flow-show": key => flow.manage("show", key).catch(writeError),

  "flow-clear": async () => {

    if (!confirm(account ? "Clear synced Flow usage for all devices? This cannot be undone." : "Clear tracked usage on this device?")) return;

    try { await flow.manage("clear"); youtubeCloud = null; drawBudget(); toast("Usage cleared"); }

    catch { writeError(); }

  },

  "delete-account": () => modal("delete-account", "Delete account", '<form id="delete-account-form" class="dialog-body"><p>This permanently deletes your Mob account and synced data. Type DELETE to confirm.</p><label class="field">Confirmation<input name="confirmation" required autocomplete="off"></label><p class="error" role="alert"></p><button class="button danger" type="submit">Permanently delete account</button></form>'),

  "native-blocking": () => nativeMessage("blocking-permission"),

  "native-usage": () => nativeMessage("usage-permission"),

  "exact-reminders": () => nativeMessage("exact-reminders"),

  "allow-extension": () => {
    if (!account || !extensionStatus?.device) return;
    save(browserConsentKey(), true);
    closeDialog();
    void connectBrowser();
  },
  "defer-extension": () => { browserPrompt = browserConsentKey(); closeDialog(); },
  "unlink-extension": async () => {

    try {

      if (account && extensionStatus?.device) await api.unpairCompanion(extensionStatus.device);

      extensionMessage("disconnect");

    } catch { toast("Couldn’t unlink the browser. Try again."); }

  },

  "rank-refresh": () => refreshLeaderboard(true),

  "account-password": recoveryDialog,

  "account": () => accountDialog(),

  "auth-mode": accountDialog,

  "google": async () => {

    const form = $("#auth-form");

    try { await api.google(); }

    catch (error) { if (form) formError(form, authError(error)); }

  },

  "signout": async () => {

    try { await api.logout();

      extensionMessage("disconnect");

      closeDialog(); }

    catch { toast("Couldn’t log out. Please try again."); }

  },

  "onboard": onboard,

  "close": closeDialog

};



document.addEventListener("click", event => {

  const button = event.target.closest("[data-action]");

  if (button && Object.hasOwn(actions, button.dataset.action)) {

    actions[button.dataset.action](button.dataset.id);

  }

});



document.addEventListener("change", event => {

  if (event.target.id === "focus-task") setTimer({ ...timer, taskId: event.target.value });

  if (event.target.id === "flow-list-filter") {

    save("flow-list-filter",event.target.value);

    flow.draw();

  }

  if (event.target.id === "flow-tracking") {

    saveSettings({ flowTracking: event.target.checked });

    $("#flow-tracking")?.focus();

  }

  if (event.target.id === "share-score" && account) {

    const enabled = event.target.checked;

    settings = { ...settings, shareScore: enabled };

    void api.put(account.uid, "profile", "settings", { shareScore: enabled }).then(() => refreshLeaderboard(true)).catch(writeError);

  }

  if (event.target.id === "browser-tracking") {

    browserTracking = event.target.checked;

    save("browser-tracking", browserTracking);

    extensionMessage("browser-tracking", { enabled: browserTracking });

  }

  if (event.target.id === "shorts-toggle") {

    saveSettings({ blockShorts: event.target.checked });

    if(window.MobAndroid&&route()==="settings")openSettings("shorts");
    $("#shorts-toggle")?.focus();

  }

});



document.addEventListener("input", event => {

  if (event.target.id === "task-search") {

    taskSearch = event.target.value;

    const search = taskSearch.toLocaleLowerCase().trim();

    const list = tasks.filter(task => (taskFilter === "all" || Boolean(task.completedDay) === (taskFilter === "completed"))

      && (task.title + " " + task.project).toLocaleLowerCase().includes(search));

    $("#view .task-list").innerHTML = taskRows(list, "No tasks match this view.");

  }

});



document.addEventListener("submit", async event => {

  const form = event.target;

  event.preventDefault();

  const values = new FormData(form);

  if (form.id === "delete-account-form" && account) {

    if (values.get("confirmation") !== "DELETE") { formError(form, "Type DELETE to confirm."); return; }

    const uid = account.uid;

    const submit = form.querySelector('[type="submit"]');

    submit.disabled = true;

    try { await api.deleteAccount(uid); }

    catch { formError(form, "Account deletion failed. Try again."); submit.disabled = false; return; }

    flow.forget(uid);

    for (const key of ["timer:", "timer-pending:", "session-queue:", "permissions:","settings-queue:","profile-cache:"])

      localStorage.removeItem("mob:" + key + uid);

    if (account?.uid!==uid) {

      nativeMessage("delete-local-account",{owner:uid});

      if (dialogType==="delete-account") closeDialog();

      toast("Mob account deleted");

      return;

    }

    trackingAllowed=false;

    save("device-tracking",false);

    nativeMessage("flow",{enabled:false,since:0,owner:uid});

    nativeMessage("delete-local-account",{owner:uid});

    extensionMessage("disconnect");

    nativeMessage("youtube-account");

    await api.logout().catch(() => {});

    watchAccount(null);

    closeDialog();

    toast("Mob account deleted");

  } else if (form.id === "task-form") {

    const key = form.dataset.id;

    const previous = tasks.find(task => task.id === key);

    if (key && !previous) { formError(form, "This task is no longer available."); return; }

    const title = values.get("title").trim();

    const date = values.get("date");

    const time = values.get("time");

    if (!title) { formError(form, "Enter a task name."); return; }

    if (time && !date) { formError(form, "Choose a due date for the reminder."); return; }

    const remindAt = date && time ? (previous?.date === date && previous?.time === time && previous.remindAt || new Date(`${date}T${time}:00`).toISOString()) : "";

    const task = { ...previous, id: key || id(), title, date, time, remindAt, project: values.get("project").trim(), priority: values.get("priority"), completedDay: previous?.completedDay || "", createdAt: previous?.createdAt || Date.now() };

    saveTask(task);

    closeDialog();

  } else if (form.id === "supabase-form") {

    try {

      const config = publicConfig(values.get("url"), values.get("key"));

      save("supabase", config);

      location.reload();

    } catch (error) { formError(form, error.message || "Check the project URL and publishable key."); }

  } else if (form.id === "settings-form") {

    const changes = Object.fromEntries(["focus", "short", "long", "interval", "focusGoal"].map(key => [key, Number(values.get(key))]));

    for (const name of ["autoBreak", "autoFocus", "sound", "motion"]) changes[name] = values.has(name);

    clipOverride = undefined;
    refreshSettingsView = true;

    saveSettings(changes);

    toast("Timer settings saved");

  } else if (form.id === "appearance-form") {

    const submit = form.querySelector('[type="submit"]');

    submit.disabled = true;

    const owner = scope();

    const changes = { theme: values.get("theme") || "plain" };

    try {

      const photo = values.get("photo");

      if (photo.size) {

        changes.photo = await backgroundPhoto(photo);

        changes.theme = "photo";

      } else if (values.has("removePhoto")) {

        changes.photo = "";

      }

      if (changes.theme === "photo" && !(changes.photo ?? settings.photo)) {

        formError(form, "Choose a photo or select a different theme.");

        if (!values.has("removePhoto")) return;

        changes.theme = "plain";

      }

      if (!form.isConnected || route() !== "settings" || scope() !== owner) return;

      refreshSettingsView = true;
      saveSettings(changes);
      toast("Theme applied");

    } catch (error) {

      formError(form, error.message || "This image couldn’t be opened.");

    } finally { submit.disabled = false; }

  } else if (form.id === "spotify-form") {

    try {

      const spotify = spotifySource(values.get("url").trim());

      spotifyOpen = true;

      saveSettings({ spotify });

      closeDialog();

    } catch (error) { formError(form, error.message); }

  } else if (form.id === "limit-form") {

    const blockedSites = [...new Set(values.get("blockedSites").split(/[,\s]+/).filter(Boolean).map(site => site.toLowerCase()))];

    if (blockedSites.length > 30 || blockedSites.some(site => site.length > 100 || !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9-]{2,63}$/.test(site))) {

      formError(form, "Enter up to 30 domains, such as reddit.com, separated by commas.");

      return;

    }

    const siteLimits={};

    for (const entry of String(values.get("siteLimits") || "").split(/[,\s]+/).filter(Boolean)) {

      const [domain,minutes]=entry.toLowerCase().split("=");

      if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9-]{2,63}$/.test(domain) || !Number.isInteger(Number(minutes)) || Number(minutes)<1 || Number(minutes)>1440 || Object.keys(siteLimits).length>=30) {formError(form,"Use up to 30 domain=minutes limits, from 1 to 1440 minutes.");return;}

      siteLimits[domain]=Number(minutes);

    }

    saveSettings({ dailyLimit: Number(values.get("dailyLimit")), blockedSites, siteLimits });

    toast("Blocking settings saved");

  } else if (form.id === "shorts-form") {

    try {

      const url = safeYouTubeLink(values.get("url").trim(), settings.blockShorts);

      if (settings.dailyLimit && youtubeSeconds() >= settings.dailyLimit * 60) throw new Error("YouTube time limit reached for today.");

      formError(form, "");

      if (!nativeMessage("youtube", { url })) window.open(url, "_blank", "noopener,noreferrer");

    } catch (error) { formError(form, error.message); }

  } else if (form.id === "recovery-form" && api) {

    const submit = form.querySelector('[type="submit"]');

    submit.disabled = true;

    try {

      await api.changePassword(values.get("password"));

      closeDialog();

      toast("Password updated");

    } catch (error) { formError(form, authError(error)); }

    finally { submit.disabled = false; }

  } else if (form.id === "handle-form" && account) {

    const submit = form.querySelector('[type="submit"]');

    submit.disabled = true;

    const uid = account.uid;

    try {

      const desired = normalizeUsername(values.get("username"));

      try {

        const saved = await api.chooseHandle(desired);

        if (account?.uid !== uid) return;

        handle = saved.username;

      } catch (error) {

        if (error.code !== "23505" || account?.uid !== uid) throw error;

        const owned = await api.handle();

        if (!owned || account?.uid !== uid) throw new Error("That username is already taken.");

        handle = owned;

      }

      localStorage.removeItem("mob:pending-handle");

      render();

      sendPlatformSettings();

      closeDialog();
      void refreshLeaderboard(true);

    } catch (error) { formError(form, error instanceof Error ? error.message : "Couldn’t save your username. Try again."); }

    finally { submit.disabled = false; }

  } else if (form.id === "auth-form" && api) {

    const mode = form.dataset.mode;

    const submit = form.querySelector('[type="submit"]');

    submit.disabled = true;

    try {

      const email = values.get("email").trim();

      if (mode === "signup") save("pending-handle", { email: email.toLowerCase(), username: normalizeUsername(values.get("username")) });

      const result = await api[mode](email, values.get("password"));

      if (mode === "signup" && !result.session && form.isConnected && dialog.open) {

        modal("account", "Check your email", `<div class="dialog-body"><p>Open the confirmation link to finish creating your Mob account.</p><button class="button" data-action="auth-mode" data-id="login">Back to login</button></div>`);

      }

      if (mode === "reset" && form.isConnected && dialog.open) {

        closeDialog();

        toast("If the email has an account, you’ll receive a reset link.");

      }

    } catch (error) { formError(form, error instanceof Error && !error.code ? error.message : authError(error)); }

    finally { submit.disabled = false; }

  }

});



window.addEventListener("hashchange", () => {

  if (route() !== "focus") {

    theater = false;

    document.body.classList.remove("focus-expanded");

    if (document.fullscreenElement === $("#focus-stage") && document.fullscreenElement) void document.exitFullscreen();

  }

  render();

  if (route() === "social") void refreshLeaderboard();
  if (route() === "flow") maybeConnectBrowser();
  toggleMobileMenu(false);
  if (route() === "tasks" && searchAfterNavigation) {
    searchAfterNavigation = false;
    $("#task-search")?.focus();
  }
  window.scrollTo(0, 0);

});

document.addEventListener("fullscreenchange", () => { if (route() === "focus") render(); });

let searchAfterNavigation = false;
document.addEventListener("keydown", event => {
  if (event.defaultPrevented || event.isComposing || event.repeat || dialog.open) return;
  const key = event.key.toLowerCase();
  if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && key === "k") {
    event.preventDefault();
    if (route() === "tasks") $("#task-search")?.focus();
    else { searchAfterNavigation = true; location.hash = "tasks"; }
    return;
  }
  if (event.altKey && event.shiftKey && !event.ctrlKey && !event.metaKey && !event.target.closest?.("input,textarea,select,[contenteditable]")) {
    const target = { t: "tasks", c: "calendar", f: "focus", s: "focus" }[key];
    if (target) {
      event.preventDefault();
      location.hash = target;
      if (key === "s" && !timer.endsAt) {
        if (timer.mode !== "focus") setTimer(newTimer(settings, "focus", { rounds: timer.rounds, taskId: timer.taskId }));
        actions["timer-toggle"]();
      }
      return;
    }
  }
  if (event.key === "Escape" && document.body.classList.contains("mobile-menu-open")) {
    toggleMobileMenu(false);
    $("#mobile-menu")?.focus();
    return;
  }

  if (event.key === "Escape" && theater && !dialog.open) {

    theater = false;

    render();

    document.querySelector('[data-action="theater"]')?.focus();

  }

});

reducedMotion.addEventListener("change", () => { if (route() === "focus") render(); });

window.addEventListener("storage", event => {

  if (event.key === "mob:" + timerKey()) {

    timer = read(timerKey(), newTimer(settings));

    render();

  }

  if (event.key === "mob:guest" && !account) {

    guest = read("guest", guest);

    settings = { ...defaults, ...guest.settings, ...devicePreferences() };

    tasks = guest.tasks;

    sessions = guest.sessions;

    render();

  }

  if (event.key === "mob:device-tracking") { trackingAllowed = read("device-tracking", false); render(); }

});

document.addEventListener("visibilitychange", () => {

  flow.background();

  if (!document.hidden) { tick(); void flow.sync(); }

});

window.addEventListener("focus", tick);

if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => {});

if (!read("guest", null)) saveGuest();

render();

tick();

setInterval(tick, 400);
setTimeout(maybeOnboard,700);
setInterval(()=>{if(window.MobAndroid&&!document.hidden)void refreshLeaderboard();},300_000);
window.addEventListener("online",()=>{if(window.MobAndroid)void refreshLeaderboard();});
document.addEventListener("visibilitychange",()=>{if(!document.hidden&&window.MobAndroid)void refreshLeaderboard();});

async function refreshDesktopTracking() {

  if (!window.MobDesktop?.trackingStatus) return;

  try { nativeStatus.desktop=await window.MobDesktop.trackingStatus(); drawBudget(); }

  catch { nativeStatus.desktop={running:false}; drawBudget(); }

}

void refreshDesktopTracking();

setInterval(refreshDesktopTracking,30_000);

setInterval(() => { if (!document.hidden) drawFlow(); }, 3000);

setInterval(() => { void refreshYouTubeBudget(); void flow.sync(); }, 300_000);

window.addEventListener("hashchange", refreshYouTubeBudget);

setInterval(() => { if (!document.hidden) { void syncSessions(); void syncTimer(); } }, 60_000);

window.addEventListener("online", () => { void flow.sync(); void syncSessions(); void syncTimer(); });

window.addEventListener("message", event => {

  if (event.source !== window || event.origin !== location.origin || event.data?.source !== "mob-extension") return;

  const { type, status } = event.data;

  if (status?.device) {

    if (account && status.linked && status.owner!==account.uid) {

      extensionMessage("disconnect");

      return;

    }

    const changed = !extensionAvailable || extensionStatus?.linked !== status.linked || extensionStatus?.tracking !== status.tracking;

    extensionAvailable = true;

    extensionStatus = status;
    if (typeof status.tracking === "boolean") browserTracking = status.tracking;
    flow.importBrowser(status);

    if (changed) sendFocusPolicy();
    maybeConnectBrowser();

    if (route() === "flow" && changed) render();

    else drawBudget();

  }

  if (type === "paired") {
    browserTracking=true;save("browser-tracking",true);

    extensionMessage("browser-tracking", { enabled: browserTracking });

    toast("Browser linked");

  }

  if (type === "pair-failed") toast("Couldn’t link the browser. Try again when account sync is available.");

});

window.addEventListener("mob-native-status", event => {

  nativeStatus = event.detail;

  if (window.MobAndroid && typeof nativeStatus.flowEnabled === "boolean") {

    trackingAllowed = nativeStatus.flowEnabled;

    save("device-tracking",trackingAllowed);

  }

  if (window.MobAndroid && (account?.uid || "")===(nativeStatus.owner || ""))

    void 0;

  void linkAndroidBudget();

  drawBudget();

  const status = $(".permission-status");
  if(window.MobAndroid&&dialogType==="settings"&&status)status.textContent=settings.blockShorts?(nativeStatus.blocking?"Blocking is enabled.":"Turn on Mob in Android Accessibility settings to finish setup."):"Blocking is off.";

  if (permissionJourney === 1 && status && dialogType === "onboard") {

    status.textContent = `Shorts blocking ${settings.blockShorts && nativeStatus.blocking ? "enabled" : settings.blockShorts ? "needs Accessibility permission" : "off"}`;

  }

  if (typeof nativeStatus.notifications === "boolean") {

    save("device-notifications", nativeStatus.notifications);

    if (nativeStatus.notifications && !settings.notifications) saveSettings({ notifications: true });

    else sendPlatformSettings();

    if (permissionJourney === 2 && status) status.textContent = nativeStatus.notifications ? "Notifications enabled." : "Notifications are off.";

    if (dialogType === "notifications") notificationDialog();

  }

});

extensionMessage("discover");

nativeMessage("ready");

const initialParams = new URL(location.href).searchParams;

if (initialParams.has("pair")) location.hash = "flow";

if (initialParams.has("auth-error")) toast("Google login did not finish. Try again from Login.");

void initAuth();


installThemedControls();
