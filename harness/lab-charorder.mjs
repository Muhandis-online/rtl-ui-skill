// Per-character x positions of LTR tokens inside RTL text: the ground truth for "drawn in order or not".
import { chromium, firefox, webkit } from "playwright";
const CASES = ["الجوال: 050-123-4567", "اتصل على 050-123-4567 الآن", "اتصل بنا على +966 50 123 4567 أو راسلنا", "+966 50 123 4567", "050 123 4567", "من 15 - 25 يناير", "من 15-25 يناير"];
const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"></head><body style="font:20px sans-serif">${CASES.map((c) => `<p>${c}</p>`).join("")}</body></html>`;
for (const [n, e] of Object.entries({ chromium, firefox, webkit })) {
  const b = await e.launch(); const p = await b.newPage(); await p.setContent(html);
  const res = await p.evaluate(() => [...document.querySelectorAll("p")].map((el) => {
    const t = el.firstChild, s = t.nodeValue;
    // the token: from the first digit or "+" to the last digit
    const a = s.search(/[+\d]/), z = s.length - [...s].reverse().join("").search(/\d/);
    const chars = [];
    for (let i = a; i < z; i++) { const r = document.createRange(); r.setStart(t, i); r.setEnd(t, i + 1); const b = r.getBoundingClientRect(); chars.push({ c: s[i], x: b.left }); }
    const visual = [...chars].sort((p, q) => p.x - q.x).map((c) => c.c).join("");
    return { logical: s.slice(a, z), visualLeftToRight: visual };
  }));
  console.log(`== ${n}`); for (const r of res) console.log(`  ${r.logical.padEnd(18)} -> drawn ${r.visualLeftToRight}  ${r.logical === r.visualLeftToRight ? "same" : "DIFFERENT"}`);
  await b.close();
}
