// Controlled renders of single mechanisms, so each claim in the skill has a picture behind it.
//
//   node harness/lab.mjs <out-dir>
import { chromium, firefox, webkit } from "playwright";
import fs from "node:fs";
import path from "node:path";

const outDir = process.argv[2];
fs.mkdirSync(outDir, { recursive: true });

const FONT = `<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;700&display=swap" rel="stylesheet">`;
const BASE = `body{font:24px 'Noto Sans Arabic',sans-serif;margin:24px;width:700px} .row{border:1px solid #ccc;padding:8px 12px;margin:8px 0}
  .label{font:12px monospace;color:#666;direction:ltr;text-align:left}`;
const row = (label, html, attrs = "") => `<div class="label">${label}</div><div class="row" ${attrs}>${html}</div>`;

const CASES = {
  "letter-spacing": [
    row("letter-spacing: normal", "اكتشف عالم الكتب الثقافية"),
    row("letter-spacing: 0.05em (tracking-wide)", "اكتشف عالم الكتب الثقافية", `style="letter-spacing:.05em"`),
    row("letter-spacing: -0.025em (tracking-tight)", "اكتشف عالم الكتب الثقافية", `style="letter-spacing:-.025em"`),
    row("letter-spacing: 0.1em (tracking-widest)", "اكتشف عالم الكتب الثقافية", `style="letter-spacing:.1em"`),
  ].join(""),
  "phone-email-in-rtl": [
    row("plain", "اتصل بنا على +966 50 123 4567 أو راسلنا"),
    row("&lt;span dir=ltr&gt;", `اتصل بنا على <span dir="ltr">+966 50 123 4567</span> أو راسلنا`),
    row("&lt;bdi&gt;", `اتصل بنا على <bdi>+966 50 123 4567</bdi> أو راسلنا`),
    row("plain email", "راسلنا على support@example.com للمساعدة"),
    row("plain, number then Arabic unit", "السعر 1,250 ريال شهرياً"),
    row("phone starting with digits (local)", "الجوال: 050-123-4567"),
    row("phone in its own element, no dir", `<a href="tel:+966501234567">+966 50 123 4567</a>`),
  ].join(""),
  "uppercase-italic": [
    row("normal", "عرض خاص لفترة محدودة"),
    row("text-transform: uppercase", "عرض خاص لفترة محدودة", `style="text-transform:uppercase"`),
    row("font-style: italic", "عرض خاص لفترة محدودة", `style="font-style:italic"`),
  ].join(""),
};

// Per row: rendered text width, and the left-to-right order in which the digit/word pieces are drawn.
function measureRows() {
  return [...document.querySelectorAll(".row")].map((row) => {
    const label = row.previousElementSibling.textContent;
    const range = document.createRange();
    range.selectNodeContents(row);
    const width = Math.round([...range.getClientRects()].reduce((w, r) => w + r.width, 0));
    // pieces of LTR tokens: runs of digits / Latin, plus a lone "+"
    const pieces = [];
    const walk = document.createTreeWalker(row, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode(); n; n = walk.nextNode()) {
      for (const m of n.nodeValue.matchAll(/\+|[0-9A-Za-z,]+/g)) {
        const r = document.createRange();
        r.setStart(n, m.index);
        r.setEnd(n, m.index + m[0].length);
        const rect = r.getClientRects()[0];
        if (rect) pieces.push({ text: m[0], x: rect.left });
      }
    }
    const logical = pieces.map((p) => p.text).join(" ");
    const visual = [...pieces].sort((a, b) => a.x - b.x).map((p) => p.text).join(" ");
    return { label, width, logical, visualLeftToRight: visual, readsCorrectly: logical === visual };
  });
}

const ENGINES = { chromium, firefox, webkit };
const results = {};
for (const [engineName, engine] of Object.entries(ENGINES)) {
  const browser = await engine.launch();
  results[engineName] = { version: browser.version() };
  for (const [name, body] of Object.entries(CASES)) {
    const page = await browser.newPage({ viewport: { width: 760, height: 200 } });
    await page.setContent(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">${FONT}<style>${BASE}</style></head><body>${body}</body></html>`,
      { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(outDir, `${name}.${engineName}.png`), fullPage: true });
    results[engineName][name] = await page.evaluate(measureRows);
    await page.close();
  }
  await browser.close();
}
fs.writeFileSync(path.join(outDir, "lab.json"), JSON.stringify(results, null, 1));
for (const [engineName, r] of Object.entries(results)) {
  console.log(`\n== ${engineName} ${r.version}`);
  for (const [name, rows] of Object.entries(r)) {
    if (name === "version") continue;
    for (const row of rows) {
      const order = row.logical ? `  drawn L→R: ${row.visualLeftToRight}  ${row.readsCorrectly ? "OK" : "REORDERED"}` : "";
      console.log(`${name.padEnd(20)} ${row.label.padEnd(42)} width=${row.width}${order}`);
    }
  }
}
