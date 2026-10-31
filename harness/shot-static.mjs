// Serve a built dist/ folder with a tiny static server and screenshot it (no project code runs in Node).
//   node harness/shot-static.mjs <dist-dir> <out.png> <width> [scale]
import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
const [, , dist, out, width, scale] = process.argv;
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml" };
const server = http.createServer((req, res) => {
  const p = path.join(dist, decodeURIComponent(req.url.split("?")[0]));
  const f = fs.existsSync(p) && fs.statSync(p).isFile() ? p : path.join(dist, "index.html");
  res.writeHead(200, { "content-type": TYPES[path.extname(f)] || "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
}).listen(0);
const port = server.address().port;
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: +width, height: 900 }, deviceScaleFactor: +(scale || 2) });
await page.goto(`http://localhost:${port}/`, { waitUntil: "networkidle" });
await page.screenshot({ path: out, fullPage: true });
await b.close(); server.close();
