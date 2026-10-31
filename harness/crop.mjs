// Screenshot one region of a built run, for the report: serve dist/, optionally type realistic values into the
// fields, find an element (by visible text or CSS selector) and capture it with some padding.
//
//   node harness/crop.mjs <dist-dir> <out.png> [--width 390] [--engine chromium|firefox|webkit] [--type]
//        (--text "..." | --selector "...") [--pad 16] [--height 0] [--nth 0]
//
// Only the page's own code runs, inside the browser.
import { chromium, firefox, webkit } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const argv = process.argv.slice(2);
const [dist, out] = argv;
const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const flag = (k) => argv.includes(`--${k}`);
const width = +opt("width", 390), pad = +opt("pad", 16), height = +opt("height", 0), nth = +opt("nth", 0);
const engine = { chromium, firefox, webkit }[opt("engine", "chromium")];

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml",
  ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".ico": "image/x-icon" };
const srv = http.createServer((q, s) => {
  const p = path.join(dist, decodeURIComponent(q.url.split("?")[0]));
  const f = fs.existsSync(p) && fs.statSync(p).isFile() ? p : path.join(dist, "index.html");
  s.writeHead(200, { "content-type": TYPES[path.extname(f)] || "application/octet-stream" });
  fs.createReadStream(f).pipe(s);
}).listen(0);

const b = await engine.launch();
const page = await b.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 2 });
await page.goto(`http://localhost:${srv.address().port}/`, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);

if (flag("type")) {
  // the same values the grader types (harness/grade.mjs)
  for (const f of await page.locator("input:visible").all()) {
    const m = await f.evaluate((e) => ({ type: e.type, hint: `${e.name} ${e.id} ${e.placeholder} ${e.labels?.[0]?.textContent || ""}` }));
    if (["checkbox", "radio", "range", "file", "hidden"].includes(m.type)) continue;
    const v = m.type === "tel" || /جوال|هاتف|phone|mobile|tel/i.test(m.hint) ? "+966 50 123 4567"
      : m.type === "email" || /بريد|email/i.test(m.hint) ? "abdulrahman.alqahtani@company-name.com.sa"
      : m.type === "password" ? "MySecurePassword2026!xyzABC" : "عبدالرحمن بن محمد القحطاني آل سعود";
    await f.fill(v).catch(() => {});
  }
  await page.keyboard.press("Escape").catch(() => {});
  await page.waitForTimeout(300);
}

const sel = opt("selector", null), text = opt("text", null);
const loc = sel ? page.locator(sel).nth(nth) : page.getByText(text, { exact: false }).nth(nth);
await loc.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => {});
const box = await loc.boundingBox();
if (!box) { console.error("element not found"); process.exit(1); }
const vw = page.viewportSize().width;
const clip = { x: Math.max(0, box.x - pad), y: Math.max(0, box.y - pad), width: Math.min(vw, box.width + 2 * pad), height: height || box.height + 2 * pad };
if (clip.x + clip.width > vw) clip.width = vw - clip.x;
await page.screenshot({ path: out, clip });
await b.close();
srv.close();
console.log("wrote", out);
