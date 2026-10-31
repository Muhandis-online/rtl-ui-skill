// Do Unicode isolates (U+2066 LRI ... U+2069 PDI) fix LTR values inside Arabic text the way dir="ltr" does?
//   node harness/lab-isolates.mjs
import { chromium, firefox, webkit } from "playwright";
const LRI = "\u2066", PDI = "\u2069";
const CASES = [
  ["plain", "اتصل على +966 55 123 4567 الآن", "+966 55 123 4567"],
  ["LRI..PDI", `اتصل على ${LRI}+966 55 123 4567${PDI} الآن`, "+966 55 123 4567"],
  ["plain time", "الدوام 10:00 - 12:00", "10:00 - 12:00"],
  ["LRI..PDI time", `الدوام ${LRI}10:00 - 12:00${PDI}`, "10:00 - 12:00"],
  ["LRI..PDI then dot", `راسلنا على ${LRI}info@nakhla.sa${PDI}.`, "info@nakhla.sa"],
];
const html = `<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><body style="font:20px sans-serif">${CASES.map(([, t]) => `<p>${t}</p>`).join("")}</body></html>`;
for (const [n, e] of Object.entries({ chromium, firefox, webkit })) {
  const b = await e.launch(); const p = await b.newPage(); await p.setContent(html);
  const res = await p.evaluate((cases) => [...document.querySelectorAll("p")].map((el, i) => {
    const t = el.firstChild, s = t.nodeValue, tok = cases[i][2], a = s.indexOf(tok), chars = [];
    for (let k = a; k < a + tok.length; k++) { const r = document.createRange(); r.setStart(t, k); r.setEnd(t, k + 1); chars.push({ c: s[k], x: r.getBoundingClientRect().left }); }
    const dot = s.endsWith(".") ? (() => { const r = document.createRange(); r.setStart(t, s.length - 1); r.setEnd(t, s.length); const all = document.createRange(); all.selectNodeContents(el); return r.getBoundingClientRect().left <= all.getBoundingClientRect().left + 2 ? "dot at line end (left)" : "dot misplaced"; })() : "";
    const drawn = [...chars].sort((u, v) => u.x - v.x).map((c) => c.c).join("");
    return `${cases[i][0].padEnd(18)} ${drawn === tok ? "in order" : "REVERSED " + drawn} ${dot}`;
  }), CASES);
  console.log(`== ${n}\n  ` + res.join("\n  ")); await b.close();
}
