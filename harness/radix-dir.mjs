// Serve a built dist/ and report, per [data-c] block, the dir attribute and computed direction Radix gives it.
//   node harness/radix-dir.mjs <dist-dir>
import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
const [, , dist] = process.argv;
const T = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };
const srv = http.createServer((q, s) => { const p = path.join(dist, q.url.split("?")[0]); const f = fs.existsSync(p) && fs.statSync(p).isFile() ? p : path.join(dist, "index.html"); s.writeHead(200, { "content-type": T[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(s); }).listen(0);
const b = await chromium.launch(); const pg = await b.newPage();
await pg.goto(`http://localhost:${srv.address().port}/`, { waitUntil: "networkidle" });
const rows = await pg.evaluate(() => [...document.querySelectorAll("[data-c]")].map((box) => {
  const stamped = box.querySelector("[dir]");
  const inner = box.firstElementChild;
  return `${box.dataset.c.padEnd(15)} stamped dir=${stamped ? stamped.getAttribute("dir") : "none"}  computed direction=${getComputedStyle(stamped || inner).direction}`;
}));
console.log(`html dir=${await pg.evaluate(() => document.documentElement.dir)}\n` + rows.join("\n"));
await b.close(); srv.close();
