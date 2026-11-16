const period = 15 * 60_000;
const hourMs = 3_600_000;
const empty = () => ({ epoch: 0, hidden: [], hours: [], items: [], devices: 0, visits: 0 });
const colors = { web: "#bd9df4", mobile: "#9be4ee", website: "#a1bafb", desktop: "#68dcb6", app: "#68dcb6" };
const names = { web: "Mob web", website: "Websites", desktop: "Mob desktop", app: "Desktop apps", mobile: "Mob mobile" };
const html = text => String(text).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const duration = value => {
  const s = Math.floor(value);
  return [Math.floor(s / 3600) && Math.floor(s / 3600) + "h", Math.floor(s / 60) % 60 && Math.floor(s / 60) % 60 + "m", s % 60 + "s"].filter(Boolean).join(" ");
};
const hourOf = now => Math.floor(now / hourMs) * hourMs;
const keyOf = (source, label) => source + ":" + label;

export function createFlow({ read, save, device, source, enabled, active }) {
  let owner = "guest", api, data = empty(), last = Date.now(), previous = {}, busy = false, revision = 0;
  const storage = () => "activity:" + owner;
  const draw = () => renderFlow(document.querySelector("#flow-dashboard"), api ? data : localSnapshot(), Boolean(api));
  let local = read(storage(), { epoch: 0, hidden: [], rows: {} });

  function localSnapshot() {
    const rows = Object.values(local.rows).filter(row => !local.hidden.includes(keyOf(row.source, row.label)));
    const items = new Map();
    for (const row of rows) {
      const key = keyOf(row.source, row.label);
      const item = items.get(key) || [row.source, row.label, 0, 0];
      item[2] += row.seconds; item[3] += row.visits;
      items.set(key, item);
    }
    return { ...local, hours: rows.map(r => [Date.parse(r.hour) / 1000, r.source, r.seconds]),
      items: [...items.values()].sort((a,b) => b[2] - a[2]), devices: Number(rows.length > 0),
      visits: rows.reduce((sum, row) => sum + row.visits, 0) };
  }

  function setEpoch(epoch) {
    if (epoch === local.epoch) return;
    local = { epoch, hidden: [], rows: {} };
    previous = {};
    save(storage(), local);
  }
  function count(kind, label, seconds, now = Date.now()) {
    if (!enabled() || !label || seconds <= 0) { delete previous[kind]; return; }
    const stored = read(storage(), local);
    if (stored.epoch !== local.epoch) previous = {};
    local = stored;
    const hour = new Date(hourOf(now)).toISOString();
    const key = keyOf(kind, label);
    const id = hour + "/" + key;
    const row = local.rows[id] || { hour, source: kind, label, seconds: 0, visits: 0 };
    row.seconds = Math.min(3600, row.seconds + seconds);
    row.visits = Math.min(3600, row.visits + Number(previous[kind] !== key));
    local.rows[id] = row;
    previous[kind] = key;
    for (const [id, record] of Object.entries(local.rows)) {
      if (Date.parse(record.hour) < now - 7 * 24 * hourMs) delete local.rows[id];
    }
    save(storage(), local);
  }
  async function sync(force = false) {
    const now = Date.now(), seq = revision;
    const throttle = "activity-sync:" + owner;
    if (!api || busy || !navigator.onLine || (!force && now - read(throttle, 0) < period)) return;
    const client = api;
    busy = true;
    save(throttle, now);
    try {
      const rows = Object.entries(local.rows).filter(([, row]) => Math.floor(row.seconds) > (row.sent || 0)).slice(0, 120);
      if (rows.length) {
        const sentRows = rows.map(([id, { sent, ...row }]) => [id, { ...row, seconds: Math.floor(row.seconds) }]);
        const epoch = await client.flowSync(device, local.epoch, sentRows.map(([, row]) => row));
        if (revision !== seq) return;
        if (epoch === local.epoch) for (const [id, row] of sentRows) {
          if (local.rows[id]) local.rows[id].sent = row.seconds;
        }
        setEpoch(epoch);
        save(storage(), local);
      }
      if (revision !== seq) return;
      const snapshot = await client.flowSnapshot();
      if (revision !== seq) return;
      if (!snapshot || snapshot.epoch < local.epoch) return;
      data = snapshot;
      save("activity-view:" + owner, data);
      setEpoch(data.epoch);
      draw();
    } catch { /* Local counters stay queued for the next sync. */ }
    finally { busy = false; if (seq !== revision) void sync(true); }
  }
  return {
    account(uid, client) {
      revision++;
      owner = uid || "guest";
      api = uid ? client : null;
      local = read(storage(), { epoch: 0, hidden: [], rows: {} });
      data = read("activity-view:" + owner, empty()); previous = {}; last = Date.now();
      void sync();
    },
    tick() {
      const now = Date.now();
      if (now - last < 5000) return;
      const elapsed = Math.floor((now - last) / 1000);
      last = now;
      count(source, "Mob", active() && elapsed < 8 ? elapsed : 0, now);
    },
    background() { delete previous[source]; last = Date.now(); },
    count, sync, draw,
    async manage(action, item) {
      const seq = revision;
      if (api) {
        const epoch = await api.flowManage(action, item);
        if (seq !== revision || epoch < local.epoch) return;
        setEpoch(epoch);
        if (action === "clear") {
          data = { ...empty(), epoch, hidden: data.hidden };
          save("activity-view:" + owner, data);
          draw();
        }
        const snapshot = await api.flowSnapshot();
        if (seq !== revision || !snapshot || snapshot.epoch < local.epoch) return;
        data = snapshot;
        save("activity-view:" + owner, data);
        setEpoch(data.epoch);
      } else {
        if (action === "clear") local.rows = {};
        if (action === "hide") local.hidden = [...new Set([...local.hidden, item])];
        if (action === "show") local.hidden = local.hidden.filter(key => key !== item);
        previous = {};
        save(storage(), local);
      }
      draw();
    },
    forget(uid) {
      localStorage.removeItem("mob:activity:" + uid);
      localStorage.removeItem("mob:activity-sync:" + uid);
      localStorage.removeItem("mob:activity-view:" + uid);
      localStorage.removeItem("mob:flow:" + uid);
    }
  };
}

function usageChart(hours) {
  const today = new Date().toISOString().slice(0, 10);
  const bins = new Map();
  for (const [stamp, source, seconds] of hours) {
    const time = new Date(stamp * 1000);
    if (time.toISOString().slice(0, 10) !== today) continue;
    if (!bins.has(source)) bins.set(source, Array(24).fill(0));
    bins.get(source)[time.getUTCHours()] += seconds;
  }
  const max = Math.max(60, ...[...bins.values()].flat());
  const chart = [...bins].map(([source, values]) => {
    const points = values.map((v,i) => (24 + i * 21) + "," + (154 - (v / max) * 135));
    return '<polyline points="' + points.join(" ") + '" fill="none" stroke="' + colors[source] + '" stroke-width="2.5" vector-effect="non-scaling-stroke"/>';
  }).join("");
  return '<svg class="usage-chart" viewBox="0 0 530 180" role="img" aria-label="Usage by hour today"><path d="M24 19V154H507M24 87H507M24 19H507" fill="none" stroke="var(--line)"/>' + chart
    + '<g fill="var(--muted)" font-size="12"><text x="24" y="174">12 AM</text><text x="145" y="174">6 AM</text><text x="269" y="174">12 PM</text><text x="398" y="174">6 PM</text></g></svg>'
    + '<div class="usage-legend">' + [...bins].map(([source]) => '<span><i style="background:' + colors[source] + '"></i>' + names[source] + '</span>').join("") + '</div>';
}

function chartCard(title, items) {
  const top = items.slice(0, 5);
  if (items.length > 5) top.push(["", "Other", items.slice(5).reduce((sum, item) => sum + item[2],0)]);
  const total = top.reduce((sum, row) => sum + row[2], 0);
  if (!total) return "";
  const palette = ["#a1bafb", "#9be4ee", "#68dcb6", "#bed8ae", "#f0dc89", "#edbd89"];
  let end = 0;
  const stops = top.map((row,i) => {
    const start = end;
    end += row[2] / total * 100;
    return palette[i] + " " + start + "% " + end + "%";
  });
  return '<section class="card"><h2>' + title + '</h2><div class="usage-breakdown"><div class="usage-legend">' + top.map((row,i) =>
    '<span><i style="background:' + palette[i] + '"></i>' + html(row[1]) + ' · ' + Math.round(row[2] / total * 100) + '%</span>').join("")
    + '</div><div class="usage-pie" aria-hidden="true" style="background:conic-gradient(' + stops.join(",") + ')"></div></div></section>';
}

function renderFlow(root, data, signedIn) {
  if (!root) return;
  const snapshot = JSON.stringify([data.hours, data.items, data.hidden, data.devices, data.visits, signedIn]);
  if (root.dataset.snapshot === snapshot) return;
  root.dataset.snapshot = snapshot;
  const total = data.hours.reduce((sum, row) => sum + row[2], 0);
  const rows = data.items.map(([source,label,seconds,visits]) => {
    const key = html(keyOf(source,label));
    const percent = total ? Math.round(seconds / total * 100) : 0;
    return '<li><div><strong>' + html(label) + '</strong><small>' + names[source] + ' · ' + visits + ' sessions</small><progress aria-label="Share of usage" value="' + percent + '" max="100"></progress></div><div><strong>' + duration(seconds) + '</strong><small>' + percent + '%</small><button type="button" class="text-action" data-action="flow-hide" data-id="' + key + '">Hide</button></div></li>';
  }).join("");
  const hidden = data.hidden.map(key => '<li>' + html(key.slice(key.indexOf(":") + 1))
    + '<button type="button" class="text-action" data-action="flow-show" data-id="' + html(key) + '">Unhide</button></li>').join("");
  root.innerHTML = '<div class="usage-grid"><section class="card"><h2>Usage time today (UTC)</h2>' + usageChart(data.hours)
    + '</section><section class="usage-metrics" aria-label="Last 7 days">' + [["Total usage", duration(total)], ["Total sessions", data.visits],
      ["Daily average", duration(total / 7)], ["Devices", data.devices]].map(([label,value]) =>
      '<div class="card"><div class="tally">' + label + '</div><div class="stat-value">' + value + '</div><small class="muted">Last 7 days</small></div>').join("")
    + '</section><section class="card"><h2>' + (signedIn ? "All devices" : "This device") + '</h2><ul class="usage-list">' + (rows || '<li class="muted">No visible usage yet.</li>')
    + '</ul><details><summary>Hidden usage (' + data.hidden.length + ')</summary><ul class="usage-list">' + (hidden || '<li>No hidden entries.</li>') + '</ul></details>'
    + '<button type="button" class="text-action" data-action="flow-clear">Clear usage</button></section><div class="usage-pies">'
    + chartCard("Desktop app usage", data.items.filter(row => ["app","desktop"].includes(row[0])))
    + chartCard("Website usage", data.items.filter(row => ["website","web"].includes(row[0]))) + '</div></div>';
}
