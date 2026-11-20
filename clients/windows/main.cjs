const { app, BrowserWindow, dialog, ipcMain, shell, powerMonitor, Tray, Menu } = require("electron");
const { createServer } = require("node:http");
const { createReadStream, existsSync } = require("node:fs");
const { join, extname } = require("node:path");
const { spawn } = require("node:child_process");
const { createInterface } = require("node:readline");

const verification=process.argv.includes('--mob-verification');
const portArgument=process.argv.find(value=>value.startsWith('--mob-verification-port='));
const portCandidate=Number(portArgument?.split('=')[1]);
const localPort=verification&&Number.isInteger(portCandidate)&&portCandidate>=1024&&portCandidate<=65535?portCandidate:43172;
const profileArgument=process.argv.find(value=>value.startsWith('--user-data-dir='));
if(verification&&profileArgument)app.setPath('userData',profileArgument.slice('--user-data-dir='.length));
const origin = 'http://127.0.0.1:'+localPort;
const project = "https://xrvqyraafmwpfenysmfo.supabase.co";
const assets = existsSync(join(__dirname, "web")) ? join(__dirname, "web") : join(__dirname, "../../dist");
const contentTypes = {
  ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml",
  ".jpg": "image/jpeg", ".png": "image/png", ".mp4": "video/mp4", ".ogg": "audio/ogg", ".txt": "text/plain; charset=utf-8", ".webmanifest": "application/manifest+json"
};
let usageShield;
let window, server, tracker, tray, waiting = false, locked = false, quitting = false, trackerRestarts=0;
function external(value) {
  if (/^https:\/\//i.test(value)) void shell.openExternal(value);
}

function run() {
  window = new BrowserWindow({
    title: "Mob", width: 1280, height: 840, minWidth: 360, minHeight: 500, autoHideMenuBar: true,
    icon: join(assets, "icon-192.png"),
    webPreferences: { preload: join(__dirname, "preload.cjs"), contextIsolation: true, sandbox: true, backgroundThrottling: false }
  });
  window.webContents.on("will-navigate", (event, url) => {
    if (new URL(url).origin !== origin) { event.preventDefault(); external(url); }
  });
  window.webContents.setWindowOpenHandler(({ url }) => { external(url); return { action: "deny" }; });
  tray = new Tray(join(assets, "icon-192.png"));
  tray.setToolTip("Mob");
  const show = () => { window.show(); window.restore(); window.focus(); };
  tray.on("double-click", show);
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "Open Mob", click: show },
    { label: "Start Mob at sign-in", type: "checkbox", checked: app.getLoginItemSettings().openAtLogin,
      click: item => app.setLoginItemSettings({ openAtLogin: item.checked, args: ["--background"] }) },
    { label: "Quit Mob", click: () => app.quit() }
  ]));
  window.on("close", event => {
    if (!quitting) { event.preventDefault(); window.hide(); }
  });
  ipcMain.handle("mob-oauth", async (event, value) => {
    const url = new URL(value);
    if (event.sender !== window.webContents || new URL(event.senderFrame.url).origin !== origin ||
        url.origin !== project || url.pathname !== "/auth/v1/authorize") throw new Error("Unexpected sign-in URL");
    waiting = true;
    await shell.openExternal(url.href);
  });
  require(join(assets,"usage-rules.js"));
  usageShield=require("./usage-shield.cjs")(window,app,globalThis.MobUsageRules,origin);
  const helper = join(__dirname, "MobActivity.exe");
  ipcMain.handle("mob-tracking-status",()=>({running:Boolean(tracker && tracker.exitCode===null),
    startup:app.getLoginItemSettings().openAtLogin,locked,idle:powerMonitor.getSystemIdleTime()>=60}));
  function startTracker() {
    if (!existsSync(helper) || quitting || window.isDestroyed()) return;
    tracker = spawn(helper, { windowsHide: true, stdio: ["ignore", "pipe", "ignore"] });
    tracker.on("error", () => { tracker=null; });
    const lines = createInterface({ input: tracker.stdout });
    lines.on("line", label => {
      const [name, value, timestamp] = label.split("\t");
      const seconds = Number(value);
      const at = Number(timestamp);
      if (name.length <= 100 && Number.isFinite(seconds) && seconds >= 0 && seconds < 1 &&
          at <= Date.now() && Date.now()-at < 1000 && !window.isDestroyed()) {
        usageShield.sample(name,seconds,at,locked);
        const inMob = window.isFocused() && !window.isMinimized() && powerMonitor.getSystemIdleTime() < 60;
        window.webContents.send("mob-activity", {
          kind: inMob ? "desktop" : "app",
          label: locked ? "" : inMob ? "Mob" : name,
          seconds: locked ? 0 : seconds,
          at
        });
      }
    });
    tracker.on("exit", () => {
      if (!window.isDestroyed()) window.webContents.send("mob-activity", { label: "", seconds: 0 });
    });
    tracker.on("close",()=>{
      if (!quitting && ++trackerRestarts<=5) setTimeout(startTracker,5000);
    });
  }
  startTracker();
  powerMonitor.on("lock-screen", () => { locked = true; });
  powerMonitor.on("unlock-screen", () => { locked = false; });
  powerMonitor.on("suspend", () => { locked = true; });
  powerMonitor.on("resume", () => { locked = false; });
  void window.loadURL(origin);
  if (process.argv.includes("--background")) window.hide();
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on("second-instance", () => {
    if (!window || window.isDestroyed()) return;
    window.show();
    window.restore();
    window.focus();
  });
  app.whenReady().then(() => {
    server = createServer((request, response) => {
      if (request.method !== "GET" || request.headers.host !== "127.0.0.1:"+localPort) return response.writeHead(403).end();
      const url = new URL(request.url, origin);
      if (url.pathname === "/auth/callback") {
        const code = url.searchParams.get("code");
        response.writeHead(200, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" })
          .end("Return to Mob to continue.");
        if (code && code.length <= 500) {
          waiting = false;
          void window.loadURL(origin + "/?code=" + encodeURIComponent(code));
          window.show();
        } else if (waiting) {
          waiting = false;
          void window.loadURL(origin + "/?auth-error=1");
        }
        return;
      }
      const file = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
      const type = contentTypes[extname(file)];
      if (!type || !/^[a-z0-9.-]+$/i.test(file)) return response.writeHead(404).end();
      const stream = createReadStream(join(assets, file));
      stream.once("open", () => {
        response.writeHead(200, { "Content-Type": type, "X-Content-Type-Options": "nosniff", "Cache-Control": "no-cache" });
        stream.pipe(response);
      });
      stream.on("error", () => { if (!response.headersSent) response.writeHead(404); response.end(); });
    });
    server.once("error", error => { dialog.showErrorBox("Mob could not start", error.message); app.quit(); });
    server.listen(localPort, "127.0.0.1", run);
  });
  app.on("window-all-closed", () => app.quit());
  app.on("before-quit", () => { quitting = true; usageShield?.close(); tracker?.kill(); tray?.destroy(); server?.close(); });
}
