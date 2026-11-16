const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const { createServer } = require("node:http");
const { createReadStream, existsSync } = require("node:fs");
const { join, extname } = require("node:path");
const { spawn } = require("node:child_process");
const { createInterface } = require("node:readline");

const origin = "http://127.0.0.1:43172";
const project = "https://xrvqyraafmwpfenysmfo.supabase.co";
const assets = existsSync(join(__dirname, "web")) ? join(__dirname, "web") : join(__dirname, "../../dist");
const contentTypes = {
  ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml",
  ".jpg": "image/jpeg", ".png": "image/png", ".mp4": "video/mp4", ".webmanifest": "application/manifest+json"
};
let window, server, tracker, waiting = false;
function external(value) {
  if (/^https:\/\//i.test(value)) void shell.openExternal(value);
}

function run() {
  window = new BrowserWindow({
    title: "Mob", width: 1280, height: 840, minWidth: 360, minHeight: 500, autoHideMenuBar: true,
    webPreferences: { preload: join(__dirname, "preload.cjs"), contextIsolation: true, sandbox: true }
  });
  window.webContents.on("will-navigate", (event, url) => {
    if (new URL(url).origin !== origin) { event.preventDefault(); external(url); }
  });
  window.webContents.setWindowOpenHandler(({ url }) => { external(url); return { action: "deny" }; });
  ipcMain.handle("mob-oauth", async (event, value) => {
    const url = new URL(value);
    if (event.sender !== window.webContents || new URL(event.senderFrame.url).origin !== origin ||
        url.origin !== project || url.pathname !== "/auth/v1/authorize") throw new Error("Unexpected sign-in URL");
    waiting = true;
    await shell.openExternal(url.href);
  });
  const helper = join(__dirname, "MobActivity.exe");
  if (existsSync(helper)) {
    tracker = spawn(helper, { windowsHide: true, stdio: ["ignore", "pipe", "ignore"] });
    tracker.on("error", () => {});
    const lines = createInterface({ input: tracker.stdout });
    lines.on("line", label => {
      if (label.length <= 100 && !window.isDestroyed()) window.webContents.send("mob-activity", { label, seconds: label ? 5 : 0 });
    });
  }
  void window.loadURL(origin);
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on("second-instance", () => window?.focus());
  app.whenReady().then(() => {
    server = createServer((request, response) => {
      if (request.method !== "GET" || request.headers.host !== "127.0.0.1:43172") return response.writeHead(403).end();
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
    server.listen(43172, "127.0.0.1", run);
  });
  app.on("window-all-closed", () => app.quit());
  app.on("before-quit", () => { tracker?.kill(); server?.close(); });
}
