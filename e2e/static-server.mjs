// Serves the static export in out/ the way GitHub Pages does: under
// /<base-path>/, index.html for folders, 404.html for missing files.
// Usage: node e2e/static-server.mjs <port> [/base-path]
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const port = Number(process.argv[2] ?? 3200);
const base = (process.argv[3] ?? "/bison-quest").replace(/\/+$/, "");
const root = fileURLToPath(new URL("../out/", import.meta.url));
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".ico": "image/x-icon",
};

http
  .createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://x");
    if (!url.pathname.startsWith(`${base}/`)) {
      res.writeHead(302, { Location: `${base}/` });
      return res.end();
    }
    let file = path.join(root, decodeURIComponent(url.pathname.slice(base.length)));
    if (!file.startsWith(root)) {
      res.writeHead(400);
      return res.end();
    }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
    if (!fs.existsSync(file)) {
      res.writeHead(404, { "Content-Type": types[".html"] });
      return res.end(fs.readFileSync(path.join(root, "404.html")));
    }
    res.writeHead(200, { "Content-Type": types[path.extname(file)] ?? "application/octet-stream" });
    res.end(fs.readFileSync(file));
  })
  .listen(port, "127.0.0.1", () => console.log(`Static site on http://localhost:${port}${base}/`));
