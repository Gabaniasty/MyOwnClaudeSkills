/* Minimal static server for a generated project. Copied into every new project
 * by the dashboard; also what the deploy host runs (Nixpacks detects Node and
 * runs `npm start`). PORT comes from the environment — the host sets it. */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL(".", import.meta.url));
const PORT = process.env.PORT || 4173;

const TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
  ".webp": "image/webp", ".avif": "image/avif", ".ico": "image/x-icon",
  ".woff2": "font/woff2", ".txt": "text/plain; charset=utf-8",
};

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    let rel = decodeURIComponent(url.pathname);
    if (rel.endsWith("/")) rel += "index.html";
    const target = normalize(join(ROOT, rel));
    if (!target.startsWith(normalize(ROOT))) { res.writeHead(403).end("Forbidden"); return; }
    const info = await stat(target).catch(() => null);
    if (!info || !info.isFile()) {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" }).end("Not found");
      return;
    }
    const body = await readFile(target);
    const type = TYPES[extname(target).toLowerCase()] || "application/octet-stream";
    const cache = extname(target) === ".html" ? "no-cache" : "public, max-age=3600";
    res.writeHead(200, { "content-type": type, "cache-control": cache, "content-length": body.length });
    res.end(body);
  } catch {
    res.writeHead(500, { "content-type": "text/plain; charset=utf-8" }).end("Server error");
  }
}).listen(PORT, () => console.log(`serving on http://localhost:${PORT}`));
