// 零依赖静态预览服务器：node scripts/serve.mjs [dir] [port]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
const dir = path.resolve(process.argv[2] || "dist");
const port = Number(process.argv[3] || process.env.PORT || 4321);
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".webp": "image/webp" };
http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  let f = path.join(dir, path.normalize(p).replace(/^(\.\.[/\\])+/, ""));
  if (!f.startsWith(dir)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html");
  if (!fs.existsSync(f) && fs.existsSync(f + ".html")) f += ".html";
  if (!fs.existsSync(f)) { res.writeHead(404, { "content-type": types[".html"] }); return res.end(fs.existsSync(path.join(dir, "404.html")) ? fs.readFileSync(path.join(dir, "404.html")) : "404"); }
  res.writeHead(200, { "content-type": types[path.extname(f)] || "application/octet-stream", "cache-control": "no-cache" });
  fs.createReadStream(f).pipe(res);
}).listen(port, "0.0.0.0", () => console.log(`▶ 预览: http://localhost:${port}/  (目录 ${dir})`));
