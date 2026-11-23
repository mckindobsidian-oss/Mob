const period = 5 * 60_000;
const hourMs = 3_600_000;
const dayMs = 24 * hourMs;
const ranges = {
  today: { label: "Today", days: 1, offset: 0 },
  yesterday: { label: "Yesterday", days: 1, offset: 1 },
  "7-days": { label: "Last 7 days", days: 7, offset: 0 },
  "30-days": { label: "Last 30 days", days: 30, offset: 0 }
};
function rangeWindow(key, now = Date.now()) {
  const range = ranges[key];
  const midnight = Math.floor(now / dayMs) * dayMs;
  const end = midnight + (1 - range.offset) * dayMs;
  return { ...range, key, day: new Date(midnight).toISOString().slice(0, 10), start: end - range.days * dayMs, end };
}
const empty = () => ({ epoch: 0, hidden: [], hours: [], items: [], devices: 0, visits: 0 });
const colors = { web: "#bd9df4", mobile: "#9be4ee", website: "#a1bafb", desktop: "#68dcb6", app: "#68dcb6" };
const names = { web: "Mob web", website: "Websites", desktop: "Mob desktop", app: "Desktop apps", mobile: "Android apps" };
const html = text => String(text).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const duration = value => {
  const s = Math.floor(value);
  return [Math.floor(s / 3600) && Math.floor(s / 3600) + "h", Math.floor(s / 60) % 60 && Math.floor(s / 60) % 60 + "m", s % 60 + "s"].filter(Boolean).join(" ");
};
const hourOf = now => Math.floor(now / hourMs) * hourMs;
const keyOf = (source, label) => source + ":" + label;

export function createFlow({ read, save, device, source, enabled, active, native = false, uploads = true, privacy, onEpoch = () => {} }) {
  let owner = "guest", api, data = empty(), last = Date.now(), previous = {}, busy = false, revision = 0, syncError="";
  let selectedRange = "today";
  const reports = new Map();
  const storage = () => "activity:" + owner;
  const ownDevice = () => !native && companion ? companion.device : device;
  const reportFor = range => {
    const snapshot = reports.get(range.key);
    return snapshot?.day === range.day && snapshot.ownDevice === ownDevice() ? snapshot : null;
  };
  const rememberReport = (snapshot, requestedDevice) => {
    if (data.epoch !== snapshot.epoch) reports.clear();
    data = { ...snapshot, ownDevice: requestedDevice, syncedAt: Date.now() };
    reports.set(data.range, data);
    save("activity-view:" + owner, data);
  };
  const draw = () => {
    const root = document.querySelector("#flow-dashboard");
    if (!root) return;

    const range = rangeWindow(selectedRange);
    const report = api ? reportFor(range) : null;
    const view = api ? combinedSnapshot(report, range) : localSnapshot(range);
    view.listFilter = read("flow-list-filter", "all");
    renderFlow(root, view, Boolean(api), range, Boolean(api && !report));
    if (api && !report) void sync();
    const status = root.querySelector("#flow-sync-status");
    if (status) status.textContent = api
      ? (busy ? "Syncing…" : syncError ? syncError+" · usage queued" : navigator.onLine ? "Usage saved on this device" : "Offline · usage queued")
        + (data.syncedAt ? " · Last synced " + new Date(data.syncedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : " · Waiting for first sync")
      : "Saved on this device · Log in to sync";

  };
  let local = read(storage(), { epoch: 0, hidden: [], rows: {} });
  let companion=null,pendingSnapshot=false;
  let dirty = false;
  let lastPrune = 0;
  function persist() {
    if (dirty) { save(storage(), local); dirty = false; }
  }

  function localSnapshot(range) {
    const rows = Object.values(local.rows).filter(row => {
      const time = Date.parse(row.hour);
      return row.source !== "mobile" && time >= range.start && time < range.end
        && !local.hidden.includes(keyOf(row.source, row.label));
    });
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

  function pendingRows(snapshot = data) {
    const own=native?Object.values(local.rows):[];
    const browser=!native&&companion&&snapshot.ownDevice===companion.device&&companion.epoch===snapshot.epoch?companion.rows:[];
    return [...own,...browser];
  }
  function ruleState() {
    const catalog=new Map(),daily={};
    const key=(kind,label)=>(kind==='website'?'website':'app')+':'+label.toLowerCase();
    for(const row of [...(data.catalog || []), ...(data.items || [])]){if(row[0]==='mobile'||row[0]==='web')continue;catalog.set(key(row[0],row[1]),{kind:row[0]==='website'?'website':'app',label:row[1]});}
    for(const [kind,label,seconds] of (data.day===new Date().toISOString().slice(0,10)?data.totals||[]:[]))daily[key(kind,label)]=(daily[key(kind,label)]||0)+seconds;
    const baseline=new Map((data.own||[]).map(([stamp,kind,label,seconds])=>[stamp+'/'+kind+':'+label,seconds]));
    for(const row of pendingRows()){
      catalog.set(key(row.source,row.label),{kind:row.source==='website'?'website':'app',label:row.label});
      if(row.hour.slice(0,10)!==new Date().toISOString().slice(0,10))continue;
      const id=Date.parse(row.hour)/1000+'/'+row.source+':'+row.label;
      const delta=Math.max(0,row.seconds-(baseline.get(id)||0));daily[key(row.source,row.label)]=(daily[key(row.source,row.label)]||0)+delta;
    }
    for(const row of Object.values(local.rows))if(['app','desktop','website'].includes(row.source))catalog.set(key(row.source,row.label),{kind:row.source==='website'?'website':'app',label:row.label});
    if(companion)for(const row of companion.rows)catalog.set(key(row.source,row.label),{kind:'website',label:row.label});
    return {owner,epoch:local.epoch,catalog:[...catalog.values()].filter(i=>i.label.toLowerCase()!=='mob'),daily};
  }
  function combinedSnapshot(snapshot, range) {
    snapshot ||= { ...empty(), hidden: data.hidden, epoch: local.epoch, ownDevice: ownDevice() };
    const result = structuredClone(snapshot);
    const own = new Map((snapshot.own || []).map(([stamp,kind,label,seconds,visits]) =>
      [stamp + "/" + keyOf(kind,label), { seconds, visits }]));
    const items = new Map(result.items.map(row => [keyOf(row[0],row[1]),row]));
    const hours = new Map(result.hours.map(row => [row[0] + "/" + row[1],row]));
    let pending = false;
    const queueCutoff = Date.now() - 7 * dayMs;
    for (const row of pendingRows(snapshot)) {
      const time = Date.parse(row.hour);
      if (time < queueCutoff || time < range.start || time >= range.end || result.hidden.includes(keyOf(row.source, row.label))) continue;
      const stamp = time / 1000;
      const bucket = range.days === 1 ? stamp : Math.floor(time / dayMs) * dayMs / 1000;
      const baseline = own.get(stamp + "/" + keyOf(row.source,row.label));
      const seconds = Math.max(0,row.seconds - (baseline?.seconds ?? (snapshot.own ? 0 : row.sent || 0)));
      const visits = Math.max(0,row.visits - (baseline?.visits ?? (snapshot.own ? 0 : row.sentVisits || 0)));
      if (!seconds) continue;
      const item = items.get(keyOf(row.source,row.label)) || [row.source,row.label,0,0];
      item[2]+=seconds; item[3]+=visits;
      items.set(keyOf(row.source,row.label),item);
      const hour = hours.get(bucket + "/" + row.source) || [bucket,row.source,0];
      hour[2]+=seconds; hours.set(bucket + "/" + row.source,hour);
      result.visits+=visits;
      pending = true;
    }
    result.items=[...items.values()].sort((a,b)=>b[2]-a[2]);
    result.hours=[...hours.values()];
    if (pending && !snapshot.ownVisible) result.devices++;
    return result;
  }

  function setEpoch(epoch) {
    if (epoch === local.epoch) return;
    if (!Number.isSafeInteger(epoch) || epoch<local.epoch) return;
    const retained=Object.fromEntries(Object.entries(local.rows)
      .filter(([,row])=>Date.parse(row.hour)>=epoch)
      .map(([id,row])=>[id,{...row,sent:0,sentVisits:0}]));
    local = { epoch, hidden: [], rows: retained };
    dirty=false;
    previous = {};
    if (data.epoch<epoch) {
      reports.clear();
      data={...empty(),epoch,hidden:data.hidden};
      save("activity-view:"+owner,data);
    }
    save(storage(), local);
    onEpoch(epoch);
  }
  function count(kind, label, seconds, now = Date.now()) {
    if (kind === "mobile" || !enabled() || !label || !Number.isFinite(seconds) || seconds <= 0 || seconds > 60) { delete previous[kind]; return; }
    const stored = dirty ? local : read(storage(), local);
    if (stored.epoch !== local.epoch) previous = {};
    local = stored;
    const start = now-seconds*1000;
    if (hourOf(start) !== hourOf(now-1)) {
      const boundary=hourOf(now-1);
      count(kind,label,(boundary-start)/1000,boundary);
      count(kind,label,(now-boundary)/1000,now);
      return;
    }
    const hour = new Date(hourOf(now-1)).toISOString();
    const key = keyOf(kind, label);
    const id = hour + "/" + key;
    const row = local.rows[id] || { hour, source: kind, label, seconds: 0, visits: 0 };
    row.seconds = Math.min(3600, row.seconds + seconds);
    row.visits = Math.min(3600, row.visits + Number(previous[kind] !== key));
    local.rows[id] = row;
    previous[kind] = key;
    if (now - lastPrune >= hourMs) {
      const cutoff = api ? now - 7 * dayMs : rangeWindow("30-days", now).start;
      for (const [id, record] of Object.entries(local.rows)) {
        if (Date.parse(record.hour) < cutoff) delete local.rows[id];
      }
      lastPrune = now;
    }
    dirty = true;
  }
  async function sync(force = false) {
    persist();
    const now = Date.now(), seq = revision;
    const throttle = "activity-sync:" + owner;
    const lastAttempt=read(throttle,0);
    if (!api || busy || !navigator.onLine || (!force && now>=lastAttempt && now-lastAttempt<period)) return;
    const client = api;
    const requestedRange = selectedRange;
    busy = true;
    pendingSnapshot=false;
    save(throttle, now);
    try {
      const rows = uploads ? Object.entries(local.rows).filter(([, row]) => row.source !== "mobile" && Date.parse(row.hour) >= now - 7 * dayMs && Math.floor(row.seconds) > (row.sent || 0)).slice(0, 80) : [];
      if (rows.length) {
        const sentRows = rows.map(([id, { sent, sentVisits, nativeSince, nativeBase, ...row }]) => [id, { ...row, seconds: Math.floor(row.seconds) }]);
        // Reserve space for JSONB formatting and multibyte executable names.
        while (sentRows.length>1 && JSON.stringify(sentRows.map(([,row])=>row)).replace(/[^\x00-\x7F]/g,"xxxx").length>20000)
          sentRows.pop();
        // Leave room for JSONB formatting; four bytes per non-ASCII code unit is conservative.
        while (JSON.stringify(sentRows.map(([,row])=>row)).replace(/[^\x00-\x7F]/g,"xxxx").length>20000) sentRows.pop();
        const epoch = await client.flowSync(device, local.epoch, sentRows.map(([, row]) => row));
        if (revision !== seq || !Number.isSafeInteger(epoch) || epoch < local.epoch) return;
        const latest=read(storage(),local);
        if (latest.epoch>epoch) { local=latest; return; }
        if (!dirty) local=latest;
        if (epoch === local.epoch) for (const [id, row] of sentRows) {
          if (local.rows[id]) local.rows[id].sent = row.seconds;
          if (local.rows[id]) local.rows[id].sentVisits = row.visits;
        }
        setEpoch(epoch);
        save(storage(), local);
      }
      if (revision !== seq) return;
      const requestedDevice = ownDevice();
      const snapshot = await client.flowSnapshot(requestedDevice, requestedRange);
      if (revision !== seq) return;
      if (!snapshot || snapshot.epoch < local.epoch) return;
      rememberReport(snapshot, requestedDevice);
      syncError = "";
      setEpoch(data.epoch);
      draw();
    } catch (error) {
      syncError=["PGRST202","PGRST205"].includes(error?.code) ? "Database update required" : "Sync unavailable";
    }
    finally { busy = false; draw(); if (seq !== revision || pendingSnapshot) void sync(true); }
  }
  return {
    account(uid, client) {
      persist();
      revision++;
      owner = uid || "guest";
      companion=null;
      syncError="";
      api = uid ? client : null;
      local = read(storage(), { epoch: 0, hidden: [], rows: {} });
      reports.clear();
      selectedRange = "today";
      lastPrune = 0;
      data = read("activity-view:" + owner, empty());
      if (Object.hasOwn(ranges, data.range)) reports.set(data.range, data);
      previous = {};
      last = Date.now();
      void sync(Boolean(api && !reportFor(rangeWindow(selectedRange))));
    },
    tick() {
      const now = Date.now();
      if (now - last < 5000) return;
      const elapsed = (now - last) / 1000;
      last = now;
      // Website time is measured exclusively by the linked extension.
      persist();
    },
    background() { delete previous[source]; last = Date.now(); persist(); },
    ruleState,
    importBrowser(status) {
      const valid=api&&status?.linked&&status.owner===owner&&status.device;
      const changed=(companion?.device||null)!==(valid?status.device:null);
      companion=valid?{device:status.device,epoch:status.activity?.epoch??0,rows:(status.activity?.rows||[]).filter(r=>r.source==='website'&&typeof r.label==='string'&&Number.isFinite(r.seconds)&&r.seconds>=0).slice(0,500)}:null;
      if(changed){pendingSnapshot=true;void sync(true);}draw();
    },
    epoch: () => local.epoch,
    count, sync, draw,
    setRange(key) {
      if (!Object.hasOwn(ranges, key) || key === selectedRange) return;
      selectedRange = key;
      const cached = reportFor(rangeWindow(key));
      if (api && (!cached || Date.now() - cached.syncedAt >= period)) {
        if (busy) pendingSnapshot = true;
        else void sync(true);
      }
      draw();
    },
    async manage(action, item) {
      persist();
      const seq = revision;
      if (api) {
        const epoch = await api.flowManage(action, item);
        if (seq !== revision || epoch < local.epoch) return;
        setEpoch(epoch);
        reports.clear();
        if (busy) revision++;
        if (action === "clear") {
          data = { ...empty(), epoch, hidden: data.hidden };
          save("activity-view:" + owner, data);
          draw();
        }
        await sync(true);
      } else {
        if (action === "clear") local.rows = {};
        if (action === "clear") {
          local.epoch = Math.max(Date.now(),local.epoch+1);
          onEpoch(local.epoch);
        }
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

function usageChart(hours, range) {
  const step = range.days === 1 ? hourMs : dayMs;
  const slots = range.days === 1 ? 24 : range.days;
  const bins = new Map();
  for (const [stamp, source, seconds] of hours) {
    const index = Math.floor((stamp * 1000 - range.start) / step);
    if (index < 0 || index >= slots) continue;
    if (!bins.has(source)) bins.set(source, Array(slots).fill(0));
    bins.get(source)[index] += seconds;
  }
  const max = Math.max(60, ...[...bins.values()].flat());
  const x = index => 24 + index * 483 / (slots - 1);
  const ticks = range.days === 1 ? [0, 6, 12, 18] : range.days === 7 ? [0, 2, 4, 6] : [0, 7, 14, 21, 29];
  const formatter = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
  const axis = ticks.map((index, i) => {
    const label = range.days === 1 ? ["12 AM", "6 AM", "12 PM", "6 PM"][i] : formatter.format(range.start + index * step);
    const anchor = index === 0 ? "start" : index === slots - 1 ? "end" : "middle";
    return '<text x="' + x(index) + '" y="174" text-anchor="' + anchor + '">' + html(label) + '</text>';
  }).join("");
  const chart = [...bins].map(([source, values]) => {
    const points = values.map((v,i) => x(i) + "," + (154 - (v / max) * 135));
    return '<polyline points="' + points.join(" ") + '" fill="none" stroke="' + colors[source] + '" stroke-width="2.5" vector-effect="non-scaling-stroke"/>';
  }).join("");
  return '<svg class="usage-chart" viewBox="0 0 530 180" role="img" aria-label="Usage ' + (range.days === 1 ? 'by hour' : 'by day') + '"><path d="M24 19V154H507M24 87H507M24 19H507" fill="none" stroke="var(--line)"/>' + chart
    + '<g fill="var(--muted)" font-size="12">' + axis + '</g></svg>'
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

function renderFlow(root, data, signedIn, range, waiting) {
  if (!root) return;
  const snapshot = JSON.stringify([data.hours, data.items, data.hidden, data.devices, data.visits, data.listFilter, signedIn, range.key, range.day, waiting]);
  if (root.dataset.snapshot === snapshot) return;
  root.dataset.snapshot = snapshot;
  const total = data.hours.reduce((sum, row) => sum + row[2], 0);
  const entries=data.items.filter(row=> data.listFilter==="apps" ? ["app","desktop","mobile"].includes(row[0])
    : data.listFilter==="websites" ? ["web","website"].includes(row[0]) : true);
  const rows = entries.map(([source,label,seconds,visits]) => {
    const key = html(keyOf(source,label));
    const percent = total ? Math.round(seconds / total * 100) : 0;
    return '<li><div><strong>' + html(label) + '</strong><small>' + names[source] + ' · ' + visits + ' sessions</small><progress aria-label="Share of usage" value="' + percent + '" max="100"></progress></div><div><strong>' + duration(seconds) + '</strong><small>' + percent + '%</small><button type="button" class="button usage-hide" data-action="flow-hide" data-id="' + key + '">Hide</button><button type="button" class="button usage-set-limit" data-rule-action="limit-item" data-id="' + key + '">Set limit</button></div></li>';
  }).join("");
  const hidden = data.hidden.map(key => '<li>' + html(key.slice(key.indexOf(":") + 1))
    + '<button type="button" class="text-action" data-action="flow-show" data-id="' + html(key) + '">Unhide</button></li>').join("");
  const detailsOpen=root.querySelector("details")?.open;
  const focused=root.contains(document.activeElement) ? document.activeElement : null;
  const focusId=focused?.id;
  const action=focused?.dataset?.action;
  const item=focused?.dataset?.id;
  const options = Object.entries(ranges).map(([key, value]) =>
    '<button type="button" class="button range-chip' + (key === range.key ? ' active' : '') + '" data-action="flow-range" data-id="' + key + '" aria-pressed="' + (key === range.key) + '">' + value.label + '</button>').join("");
  root.classList.toggle('flow-loading', waiting && !total && navigator.onLine);
  root.innerHTML = '<div class="flow-report-toolbar"><div class="flow-date-range" role="group" aria-label="Date range in UTC">' + options + '</div>'
    + '<p id="flow-sync-status" class="small-text muted" role="status"></p></div>'
    + '<section class="usage-metrics" aria-label="' + range.label + '">' + [["Total usage", duration(total)], ["Sessions", data.visits],
      ["Daily average", duration(total / range.days)], ["Devices", data.devices]].map(([label,value]) =>
      '<div class="card"><div class="tally">' + label + '</div><div class="stat-value">' + value + '</div></div>').join("")
    + '</section><section class="card flow-chart-card"><div class="flow-chart-heading"><h2>Usage time · ' + range.label
    + '</h2><span class="small-text muted">UTC</span></div>' + usageChart(data.hours, range)
    + '</section><div class="usage-grid"><section class="card"><h2>' + (signedIn ? "All devices" : "This device") + '</h2><label class="field">Usage list<select id="flow-list-filter">'
    + [["all","All usage"],["apps","Apps"],["websites","Websites"]].map(([value,label])=>'<option value="'+value+'" '+(data.listFilter===value ? "selected" : "")+'>'+label+'</option>').join("")
    + '</select></label><ul class="usage-list">' + (rows || '<li class="muted">' + (waiting ? 'No synced usage available for this period yet.' : 'No visible usage in this period.') + '</li>')
    + '</ul><details><summary>Hidden usage (' + data.hidden.length + ')</summary><ul class="usage-list">' + (hidden || '<li>No hidden entries.</li>') + '</ul></details>'
    + '<button type="button" class="text-action" data-action="flow-clear">Clear usage</button></section><div class="usage-pies">'
    + chartCard("App usage", data.items.filter(row => ["app","desktop","mobile"].includes(row[0])))
    + chartCard("Website usage", data.items.filter(row => ["website","web"].includes(row[0]))) + '</div></div>';
  if (detailsOpen) root.querySelector("details").open=true;
  if (focusId) root.querySelector("#"+focusId)?.focus({preventScroll:true});
  else if (action) {
    const replacement=[...root.querySelectorAll("[data-action]")].find(node=>node.dataset.action===action && node.dataset.id===item);
    (replacement || root.querySelector("summary"))?.focus({preventScroll:true});
  }
}
