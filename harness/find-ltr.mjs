// Serve a built dist/ and report which ancestor makes an Arabic element left-to-right.
//   node harness/find-ltr.mjs <dist-dir> <arabic text>
import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
const [, , dist, text] = process.argv;
const T = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };
const srv = http.createServer((q, s) => { const p = path.join(dist, q.url.split("?")[0]); const f = fs.existsSync(p) && fs.statSync(p).isFile() ? p : path.join(dist, "index.html"); s.writeHead(200, { "content-type": T[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(s); }).listen(0);
const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1440, height: 900 } });
await pg.goto(`http://localhost:${srv.address().port}/`, { waitUntil: "networkidle" });
console.log(await pg.evaluate((t) => {
  const el = [...document.querySelectorAll("a,button,span,div")].find((e) => e.textContent.trim() === t);
  if (!el) return "not found";
  const chain = [];
  for (let e = el; e; e = e.parentElement) if (e.hasAttribute("dir") || e.getAttribute("role") || /tablist|radix|nav/i.test(e.className + e.tagName)) chain.push(`${e.tagName.toLowerCase()} dir=${e.getAttribute("dir")} role=${e.getAttribute("role")} data-orientation=${e.getAttribute("data-orientation")} class=${(e.className || "").toString().slice(0, 60)}`);
  return chain.join("\n");
}, text));
await b.close(); srv.close();
