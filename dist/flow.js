const period = 5 * 60_000;
const hourMs = 3_600_000;
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
  const storage = () => "activity:" + owner;
  const draw = () => {
    const root = document.querySelector("#flow-dashboard");
    if (!root) return;
    const visibility=privacy?.() || {usage:read("usage-private",false),list:read("usage-list-hidden",false)};
    root.classList.toggle("usage-private", visibility.usage);
    root.classList.toggle("usage-list-hidden", visibility.list);
    const view=api ? combinedSnapshot() : localSnapshot();
    view.listFilter=read("flow-list-filter","all");
    renderFlow(root, view, Boolean(api));
    const status = root.querySelector("#flow-sync-status");
    if (status) status.textContent = api
      ? (busy ? "Syncing…" : syncError ? syncError+" · usage queued" : navigator.onLine ? "Usage saved on this device" : "Offline · usage queued")
        + (data.syncedAt ? " · Last synced " + new Date(data.syncedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : " · Waiting for first sync")
      : "Saved on this device · Log in to sync";
    const privacyButton=root.querySelector('[data-action="flow-privacy"]');
    if (privacyButton) privacyButton.setAttribute("aria-pressed",String(root.classList.contains("usage-private")));
    const list=root.querySelector('[data-action="flow-list"]');
    if (list) list.setAttribute("aria-pressed",String(root.classList.contains("usage-list-hidden")));
  };
  let local = read(storage(), { epoch: 0, hidden: [], rows: {} });
  let companion=null,pendingSnapshot=false;
  let dirty = false;
  function persist() {
    if (dirty) { save(storage(), local); dirty = false; }
  }

  function localSnapshot() {
    const start = Date.now() - 7 * 24 * hourMs;
    const rows = Object.values(local.rows).filter(row => row.source !== "mobile" &&
      Date.parse(row.hour) >= start && !local.hidden.includes(keyOf(row.source, row.label)));
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

  function pendingRows() {
    const own=native?Object.values(local.rows):[];
    const browser=!native&&companion&&data.ownDevice===companion.device&&companion.epoch===data.epoch?companion.rows:[];
    return [...own,...browser];
  }
  function ruleState() {
    const catalog=new Map(),daily={};
    const key=(kind,label)=>(kind==='website'?'website':'app')+':'+label.toLowerCase();
    for(const row of data.catalog||data.items||[]){if(row[0]==='mobile'||row[0]==='web')continue;catalog.set(key(row[0],row[1]),{kind:row[0]==='website'?'website':'app',label:row[1]});}
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
  function combinedSnapshot() {
    const result = structuredClone(data);
    const own = new Map((data.own || []).map(([stamp,kind,label,seconds,visits]) =>
      [stamp + "/" + keyOf(kind,label), { seconds, visits }]));
    const items = new Map(result.items.map(row => [keyOf(row[0],row[1]),row]));
    const hours = new Map(result.hours.map(row => [row[0] + "/" + row[1],row]));
    let pending = false;
    for (const row of pendingRows()) {
      const stamp = Date.parse(row.hour)/1000;
      if (stamp*1000 < Date.now()-7*24*hourMs || result.hidden.includes(keyOf(row.source,row.label))) continue;
      const baseline = own.get(stamp + "/" + keyOf(row.source,row.label));
      const seconds = Math.max(0,row.seconds - (baseline?.seconds ?? (data.own ? 0 : row.sent || 0)));
      const visits = Math.max(0,row.visits - (baseline?.visits ?? (data.own ? 0 : row.sentVisits || 0)));
      if (!seconds) continue;
      const item = items.get(keyOf(row.source,row.label)) || [row.source,row.label,0,0];
      item[2]+=seconds; item[3]+=visits;
      items.set(keyOf(row.source,row.label),item);
      const hour = hours.get(stamp + "/" + row.source) || [stamp,row.source,0];
      hour[2]+=seconds; hours.set(stamp + "/" + row.source,hour);
      result.visits+=visits;
      pending = true;
    }
    result.items=[...items.values()].sort((a,b)=>b[2]-a[2]);
    result.hours=[...hours.values()];
    if (pending) result.devices=data.own && data.own.length===0 ? result.devices+1 : Math.max(1,result.devices);
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
    for (const [id, record] of Object.entries(local.rows)) {
      if (Date.parse(record.hour) < now - 7 * 24 * hourMs) delete local.rows[id];
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
    busy = true;
    pendingSnapshot=false;
    save(throttle, now);
    try {
      const rows = uploads ? Object.entries(local.rows).filter(([, row]) => row.source !== "mobile" && Math.floor(row.seconds) > (row.sent || 0)).slice(0, 80) : [];
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
      const ownDevice=!native&&companion?companion.device:device;
      const snapshot = await client.flowSnapshot(ownDevice);
      if(snapshot)snapshot.ownDevice=ownDevice;
      if (revision !== seq) return;
      if (!snapshot || snapshot.epoch < local.epoch) return;
      data = snapshot;
      syncError="";
      data.syncedAt = Date.now();
      save("activity-view:" + owner, data);
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
      data = read("activity-view:" + owner, empty()); previous = {}; last = Date.now();
      void sync();
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
    async manage(action, item) {
      persist();
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
        const snapshot = await api.flowSnapshot(device);
        if (seq !== revision || !snapshot || snapshot.epoch < local.epoch) return;
        data = snapshot;
        save("activity-view:" + owner, data);
        setEpoch(data.epoch);
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
  const snapshot = JSON.stringify([data.hours, data.items, data.hidden, data.devices, data.visits, data.listFilter, signedIn]);
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
  root.innerHTML = '<p id="flow-sync-status" class="small-text muted" role="status"></p><div class="form-actions"><button class="button" data-action="flow-privacy" aria-pressed="' + root.classList.contains("usage-private") + '">Hide usage</button><button class="button" data-action="flow-list" aria-pressed="' + root.classList.contains("usage-list-hidden") + '">Hide list</button></div><div class="usage-grid"><section class="card"><h2>Usage time today (UTC)</h2>' + usageChart(data.hours)
    + '</section><section class="usage-metrics" aria-label="Last 7 days">' + [["Total usage", duration(total)], ["Total sessions", data.visits],
      ["Daily average", duration(total / 7)], ["Devices", data.devices]].map(([label,value]) =>
      '<div class="card"><div class="tally">' + label + '</div><div class="stat-value">' + value + '</div><small class="muted">Last 7 days</small></div>').join("")
    + '</section><section class="card"><h2>' + (signedIn ? "All devices" : "This device") + '</h2><label class="field">Usage list<select id="flow-list-filter">'
    + [["all","All usage"],["apps","Apps"],["websites","Websites"]].map(([value,label])=>'<option value="'+value+'" '+(data.listFilter===value ? "selected" : "")+'>'+label+'</option>').join("")
    + '</select></label><ul class="usage-list">' + (rows || '<li class="muted">No visible usage yet.</li>')
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
