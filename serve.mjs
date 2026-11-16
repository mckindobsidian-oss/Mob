import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname } from "node:path";

const base = new URL("./dist/", import.meta.url);
const types = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".svg": "image/svg+xml",
  ".png": "image/png", ".jpg": "image/jpeg", ".mp4": "video/mp4", ".webmanifest": "application/manifest+json"
};
const port = Number(process.argv[2] || 4173);

createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, "http://localhost").pathname;
    const file = pathname === "/" ? "index.html" : pathname.slice(1);
    if (!/^[a-z0-9.-]+$/i.test(file) || !types[extname(file)]) {
      response.writeHead(404).end();
      return;
    }
    const content = await readFile(new URL(file, base));
    response.writeHead(200, { "Content-Type": types[extname(file)], "Cache-Control": "no-cache" });
    response.end(content);
  } catch {
    response.writeHead(404).end();
  }
}).listen(port, "127.0.0.1", () => console.log(`Mob is running at http://localhost:${port}`));
