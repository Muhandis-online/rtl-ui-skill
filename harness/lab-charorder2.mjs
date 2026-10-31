// Per-character drawing order of LTR tokens that are not phone numbers, inside Arabic text, in three engines.
//
//   node harness/lab-charorder2.mjs
import { chromium, firefox, webkit } from "playwright";

// [Arabic sentence, the token inside it]
const CASES = [
  ["زوروا https://nakhla.sa/offers اليوم", "https://nakhla.sa/offers"],
  ["الآيبان SA03 8000 0000 6080 1016 7519 للتحويل", "SA03 8000 0000 6080 1016 7519"],
  ["رقم الطلب ORD-2024-0012 جاهز", "ORD-2024-0012"],
  ["رقم الطلب 2024-0012 جاهز", "2024-0012"],
  ["رقم الطلب 1234 5678 جاهز", "1234 5678"],
  ["الدوام 10:00 - 12:00 صباحاً", "10:00 - 12:00"],
  ["التاريخ 2026/10/30", "2026/10/30"],
  ["السعر 1,250.50 ريال", "1,250.50"],
];
const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"></head><body style="font:20px sans-serif">` +
  CASES.map(([s]) => `<p>${s}</p>`).join("") + `</body></html>`;

for (const [name, engine] of Object.entries({ chromium, firefox, webkit })) {
  const b = await engine.launch();
  const p = await b.newPage();
  await p.setContent(html);
  const res = await p.evaluate((cases) => [...document.querySelectorAll("p")].map((el, i) => {
    const t = el.firstChild, s = t.nodeValue, tok = cases[i][1];
    const a = s.indexOf(tok);
    const chars = [];
    for (let k = a; k < a + tok.length; k++) {
      const r = document.createRange();
      r.setStart(t, k);
      r.setEnd(t, k + 1);
      chars.push({ c: s[k], x: r.getBoundingClientRect().left });
    }
    return { tok, drawn: [...chars].sort((u, v) => u.x - v.x).map((c) => c.c).join("") };
  }), CASES);
  console.log(`== ${name}`);
  for (const r of res) console.log(`  ${r.tok.padEnd(30)} drawn ${r.drawn.padEnd(30)} ${r.tok === r.drawn ? "same" : "DIFFERENT"}`);
  await b.close();
}
