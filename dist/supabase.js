import { supabaseConfig } from "./supabase-config.js";
import { dayKey, offsetDay, normalizeUsername } from "./core.js";

export function publicConfig(url, publishableKey) {
  let project;
  try { project = new URL(url.trim()); }
  catch { throw new Error("Enter the HTTPS project URL from Supabase."); }
  if (project.protocol !== "https:" || project.username || project.password || project.pathname !== "/" || project.search || project.hash) {
    throw new Error("Enter the HTTPS project URL from Supabase.");
  }
  const key = publishableKey.trim();
  if (!/^sb_publishable_[a-z0-9_-]+$/i.test(key)) {
    let isLegacyAnon = false;
    try {
      const payload = key.split(".")[1].replaceAll("-", "+").replaceAll("_", "/");
      isLegacyAnon = key.split(".").length === 3 && JSON.parse(atob(payload)).role === "anon";
    } catch {
      // Legacy JWTs must explicitly carry the anon role.
    }
    if (!isLegacyAnon) throw new Error("Use the publishable API key from your Supabase project.");
  }
  return { url: project.origin, publishableKey: key };
}

export function getConfig() {
  try {
    const saved = JSON.parse(localStorage.getItem("mob:supabase") || "null") || supabaseConfig;
    return publicConfig(saved.url, saved.publishableKey);
  } catch {
    return null;
  }
}

const tables = { profile: "mob_settings", tasks: "mob_tasks", sessions: "mob_focus_sessions", usage: "mob_usage" };
const fieldMap = {
  profile: {
    username: "username", focus: "focus_minutes", short: "short_minutes", long: "long_minutes", interval: "long_every",
    focusGoal: "focus_goal", autoBreak: "auto_break", autoFocus: "auto_focus", sound: "sound", notifications: "notifications",
    theme: "theme", photo: "photo", onboarded: "onboarded", flowTracking: "flow_tracking", blockShorts: "block_shorts",
    motion: "motion", spotify: "spotify", dailyLimit: "daily_limit_minutes", blockedSites: "blocked_sites", shareScore: "share_score", activeTimer: "timer_state"
  },
  tasks: { id: "id", title: "title", project: "project", priority: "priority", date: "due_date", time: "reminder_time", remindAt: "remind_at", completedDay: "completed_day", createdAt: "created_at" },
  sessions: { id: "id", day: "day", minutes: "minutes", taskId: "task_id" }
};
const optional = new Set(["due_date", "reminder_time", "remind_at", "completed_day", "task_id"]);

function toRow(type, value) {
  return Object.fromEntries(Object.entries(value).map(([key, data]) => {
    const column = fieldMap[type][key];
    if (column === "created_at") return [column, new Date(data).toISOString()];
    return [column, optional.has(column) && data === "" ? null : data];
  }));
}
function fromRow(type, row) {
  return Object.fromEntries(Object.entries(fieldMap[type]).filter(([, column]) => Object.hasOwn(row, column)).map(([key, column]) => {
    if (column === "created_at") return [key, Date.parse(row[column])];
    if (column === "reminder_time") return [key, row[column]?.slice(0, 5) || ""];
    return [key, row[column] ?? ""];
  }));
}

async function result(request) {
  const { data, error } = await request;
  if (error) throw error;
  return data;
}
function userProfile(user) {
  if (!user) return null;
  const profile = user.user_metadata || {};
  return { uid: user.id, email: user.email, displayName: profile.full_name || profile.name, photoURL: profile.avatar_url || profile.picture };
}

export async function connectSupabase(config) {
  const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.0/+esm");
  const desktop = window.MobDesktop;
  const native = Boolean(window.MobAndroid || desktop);
  const client = createClient(config.url, config.publishableKey, { auth: { flowType: "pkce" } });
  const redirectTo = desktop ? location.origin + "/auth/callback" : native ? "mobnorth://auth/callback" : new URL("./", location.href).href;
  const listeners = new Map();

  function watch(uid, type, handler, onError) {
    let closed = false;
    let pending = false;
    let again = false;
    let failed = false;
    let previous;
    let lastRead = 0;
    let photo;
    const refresh = async (force = false) => {
      if (closed) return;
      if (pending) { again = true; return; }
      if (force !== true && Date.now() - lastRead < (type === "profile" ? 30_000 : 300_000)) return;
      pending = true;
      lastRead = Date.now();
      try {
        const columns = type === "profile" && photo !== undefined && force !== true
          ? Object.values(fieldMap.profile).filter(column => column !== "photo").join(",")
          : "*";
        let query = client.from(tables[type]).select(columns).eq("user_id", uid);
        if (type === "profile") query = query.maybeSingle();
        if (type === "usage") query = query.gte("day", offsetDay(dayKey(), -13));
        let rows;
        if (type === "tasks" || type === "sessions") {
          rows = [];
          query = query.order("id");
          for (let start = 0; !closed; start += 500) {
            const page = await result(query.range(start, start + 499));
            rows.push(...page);
            if (page.length < 500) break;
          }
        } else {
          rows = await result(query);
        }
        if (closed) return;
        if (type === "profile" && rows) {
          if (Object.hasOwn(rows, "photo")) photo = rows.photo;
          else rows.photo = photo;
        }
        const snapshot = JSON.stringify(rows);
        if (previous !== snapshot) {
          previous = snapshot;
          const value = type === "profile" ? (rows ? fromRow(type, rows) : null)
            : type === "usage" ? rows : rows.map(row => fromRow(type, row));
          handler(value);
        }
        failed = false;
      } catch (error) {
        if (!closed && !failed) onError(error);
        failed = true;
      } finally {
        pending = false;
        if (again && !closed) { again = false; void refresh(true); }
      }
    };
    listeners.set(type, refresh);
    const interval = setInterval(() => { if (!document.hidden) void refresh(); }, type === "profile" ? 30_000 : 300_000);
    window.addEventListener("focus", refresh);
    void refresh();
    return () => {
      closed = true;
      if (listeners.get(type) === refresh) listeners.delete(type);
      clearInterval(interval);
      window.removeEventListener("focus", refresh);
    };
  }

  async function write(type, request) {
    const data = await result(request);
    void listeners.get(type)?.(true);
    return data;
  }

  return {
    watchUser(handler) {
      client.auth.onAuthStateChange((event, session) => setTimeout(() => handler(userProfile(session?.user), event), 0));
    },
    async google() {
      const { url } = await result(client.auth.signInWithOAuth({
        provider: "google", options: { redirectTo, skipBrowserRedirect: native }
      }));
      if (desktop) await desktop.oauth(url);
      else if (native) window.MobAndroid.postMessage(JSON.stringify({ type: "oauth", url }));
    },
    async login(identifier, password) {
      if (identifier.indexOf("@") > 0) return result(client.auth.signInWithPassword({ email: identifier, password }));
      let username;
      try { username = normalizeUsername(identifier.replace(/^@/, "")); }
      catch { throw { code: "invalid_credentials" }; }
      const response = await fetch(config.url + "/functions/v1/mob-login", {
        method: "POST",
        headers: { apikey: config.publishableKey, "content-type": "application/json" },
        body: JSON.stringify({ username, password })
      });
      const data = await response.json();
      if (!response.ok) throw data;
      return result(client.auth.setSession(data));
    },
    async handle() {
      const row = await result(client.from("mob_handles").select("username").maybeSingle());
      return row?.username || "";
    },
    chooseHandle(username) {
      return result(client.from("mob_handles").insert({ username }).select("username").single());
    },
    leaderboard: () => result(client.rpc("mob_leaderboard")),
    flowSync: (device, generation, batch) => result(client.rpc("mob_flow_sync", { device, generation, batch })),
    flowSnapshot: () => result(client.rpc("mob_flow_snapshot")),
    flowManage: (action, item = null) => result(client.rpc("mob_flow_manage", { action, item })),
    deleteAccount: () => result(client.rpc("mob_delete_my_account")),
    async youtubeSeconds(day) {
      const rows = await result(client.from("mob_youtube_usage").select("seconds").eq("day", day));
      return rows.reduce((total, row) => total + row.seconds, 0);
    },
    unpairCompanion(device) {
      return result(client.from("mob_companion").delete().eq("device_id", device));
    },
    async pairCompanion(device) {
      const bytes = crypto.getRandomValues(new Uint8Array(32));
      const hex = value => Array.from(value, byte => byte.toString(16).padStart(2, "0")).join("");
      const token = hex(bytes);
      const hash = hex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token))));
      await result(client.from("mob_companion").upsert({ device_id: device, token_hash: hash }, { onConflict: "user_id,device_id" }));
      return { token, url: config.url, key: config.publishableKey };
    },
    signup: (email, password) => result(client.auth.signUp({ email, password, options: { emailRedirectTo: redirectTo } })),
    reset: email => result(client.auth.resetPasswordForEmail(email, { redirectTo })),
    changePassword: password => result(client.auth.updateUser({ password })),
    logout: () => result(client.auth.signOut({ scope: "local" })),
    watchSettings: (uid, handler, onError) => watch(uid, "profile", handler, onError),
    watchList: watch,
    put(uid, type, id, value) {
      const row = { user_id: uid, ...(type === "profile" ? {} : { id }), ...toRow(type, value) };
      const query = client.from(tables[type]);
      if (type === "tasks") return write(type, query.insert(row));
      return write(type, query.upsert(row, { onConflict: type === "profile" ? "user_id" : "user_id,id", defaultToNull: false }));
    },
    update(uid, type, id, value) {
      return write(type, client.from(tables[type]).update(toRow(type, value)).eq("user_id", uid).eq("id", id).select("id").single());
    },
    remove(uid, type, id) {
      return write(type, client.from(tables[type]).delete().eq("user_id", uid).eq("id", id));
    },
    recordUsage(day, device, kind, seconds) {
      return write("usage", client.rpc("mob_record_usage", { p_day: day, p_device: device, p_kind: kind, p_seconds: seconds }));
    }
  };
}
