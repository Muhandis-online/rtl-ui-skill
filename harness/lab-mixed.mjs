// Values that mix numbers with Arabic words, and punctuation next to left-to-right values, in an RTL page.
// Each case is rendered in several markups; per row we record where the number sits relative to the Arabic word
// and on which edge the final punctuation mark is drawn.
//
//   node harness/lab-mixed.mjs <out-dir>
import { chromium, firefox, webkit } from "playwright";
import fs from "node:fs";
import path from "node:path";

const outDir = process.argv[2];
fs.mkdirSync(outDir, { recursive: true });

// [group, label, html]
const ROWS = [
  ["مبلغ مع كلمة عربية", "plain", "السعر 10 ريال"],
  ["مبلغ مع كلمة عربية", "whole value in dir=ltr", 'السعر <span dir="ltr">10 ريال</span>'],
  ["تاريخ مع شهر عربي", "plain", "الموعد 15 سبتمبر"],
  ["تاريخ مع شهر عربي", "whole value in dir=ltr", 'الموعد <span dir="ltr">15 سبتمبر</span>'],
  ["وقت مع مساءً", "plain", "يبدأ 10:30 مساءً"],
  ["وقت مع مساءً", "whole value in dir=ltr", 'يبدأ <span dir="ltr">10:30 مساءً</span>'],
  ["مدى أيام مع شهر", "plain", "من 15-25 يناير"],
  ["مدى أيام مع شهر", "numbers only in dir=ltr", 'من <span dir="ltr">15-25</span> يناير'],
  ["مدى أوقات بالأرقام فقط", "plain", "الدوام 10:00 - 12:00"],
  ["مدى أوقات بالأرقام فقط", "dir=ltr", 'الدوام <span dir="ltr">10:00 - 12:00</span>'],
  ["مدى أوقات بكلمات عربية", "plain", "الدوام من 10:00 صباحاً إلى 12:00 ظهراً"],
  ["نقطة بعد إيميل", "plain", "راسلنا على info@nakhla.sa."],
  ["نقطة بعد إيميل", "dot inside dir=ltr", 'راسلنا على <span dir="ltr">info@nakhla.sa.</span>'],
  ["نقطة بعد إيميل", "dot outside dir=ltr", 'راسلنا على <span dir="ltr">info@nakhla.sa</span>.'],
  ["نقطة بعد رقم جوال", "plain", "اتصل على +966 55 123 4567."],
  ["نقطة بعد رقم جوال", "dot outside dir=ltr", 'اتصل على <span dir="ltr">+966 55 123 4567</span>.'],
  ["جملة تنتهي بكلمة إنجليزية", "plain", "الموقع مبني بـ React."],
  ["جملة عربية داخل عنصر LTR", "Arabic text in a dir=ltr box", '<span dir="ltr" style="display:block">مرحباً بك في متجرنا.</span>'],
  ["جملة عربية داخل عنصر LTR", "same box, dir=rtl", '<span dir="rtl" style="display:block">مرحباً بك في متجرنا.</span>'],
  ["علامة تعجب واستفهام", "plain", "هل أنت جاهز؟ ابدأ الآن!"],
  ["أقواس", "plain", "الباقة الشاملة (الأكثر طلباً)"],
  ["أقواس داخل عنصر LTR", "Arabic in dir=ltr box", '<span dir="ltr" style="display:block">الباقة الشاملة (الأكثر طلباً)</span>'],
];

let lastGroup = "";
const body = ROWS.map(([group, label, html], i) => {
  const head = group !== lastGroup ? `<h3>${group}</h3>` : "";
  lastGroup = group;
  return `${head}<div class="label">${label}</div><div class="row" data-i="${i}">${html}</div>`;
}).join("");

const page = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;600&display=swap" rel="stylesheet">
<style>body{font:20px 'IBM Plex Sans Arabic',sans-serif;margin:16px;width:560px} h3{font-size:15px;margin:18px 0 4px;color:#0b5}
.label{font:11px monospace;color:#888;direction:ltr;text-align:left} .row{border:1px solid #ddd;padding:6px 10px;margin:2px 0 6px}</style>
</head><body>${body}</body></html>`;

// For each row: the visual left-to-right order of its "pieces" (digit runs, Latin words, Arabic words) and which
// edge the last punctuation mark is drawn on.
function measure() {
  return [...document.querySelectorAll(".row")].map((row) => {
    const items = [];
    const walk = document.createTreeWalker(row, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode(); n; n = walk.nextNode()) {
      for (const m of n.nodeValue.matchAll(/[0-9][0-9:,\-+ ]*[0-9]|[0-9]|[A-Za-z@.]+[A-Za-z]|[؀-ۿ]+|[.!?؟()]/g)) {
        const r = document.createRange();
        r.setStart(n, m.index);
        r.setEnd(n, m.index + m[0].length);
        const rect = r.getClientRects()[0];
        if (rect) items.push({ t: m[0].trim(), x: rect.left, right: rect.right });
      }
    }
    const box = row.getBoundingClientRect();
    const visual = [...items].sort((a, b) => a.x - b.x).map((i) => i.t);
    const punct = items.filter((i) => /^[.!?؟]$/.test(i.t)).pop();
    let punctEdge = null;
    if (punct) {
      const minX = Math.min(...items.map((i) => i.x)), maxR = Math.max(...items.map((i) => i.right));
      punctEdge = punct.x <= minX + 1 ? "left end (end of an Arabic line)" : punct.right >= maxR - 1 ? "RIGHT end (start of an Arabic line)" : "middle";
    }
    return { visualLeftToRight: visual.join(" | "), punctEdge };
  });
}

const results = {};
for (const [name, engine] of Object.entries({ chromium, firefox, webkit })) {
  const b = await engine.launch();
  const p = await b.newPage({ viewport: { width: 600, height: 400 }, deviceScaleFactor: 2 });
  await p.setContent(page, { waitUntil: "networkidle" });
  await p.evaluate(() => document.fonts.ready);
  results[name] = await p.evaluate(measure);
  if (name === "chromium") await p.screenshot({ path: path.join(outDir, "mixed-values.png"), fullPage: true });
  await b.close();
}
fs.writeFileSync(path.join(outDir, "mixed-values.json"), JSON.stringify(results, null, 1));
ROWS.forEach(([group, label], i) => {
  const c = results.chromium[i];
  const same = ["firefox", "webkit"].every((e) => results[e][i].visualLeftToRight === c.visualLeftToRight && results[e][i].punctEdge === c.punctEdge);
  console.log(`${label.padEnd(30)} drawn L→R: ${c.visualLeftToRight.padEnd(48)} ${c.punctEdge ? "punct: " + c.punctEdge : ""}${same ? "" : "  [engines differ]"}`);
});
