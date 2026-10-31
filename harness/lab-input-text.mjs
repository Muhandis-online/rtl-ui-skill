// Phone number typed into a type="text" input under dir="rtl": measured by mirroring the input's text into a span
// with identical direction/unicode-bidi (inputs use the same bidi algorithm as their content), plus a screenshot.
import { chromium, firefox, webkit } from "playwright";
const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>body{font:18px sans-serif;margin:12px;width:340px}
small{font:11px monospace;display:block;direction:ltr;text-align:left;color:#666;margin-top:8px} input{width:100%;box-sizing:border-box;font:inherit;padding:6px}</style></head><body>
<small>type=text, no dir — intl phone</small><input type="text" value="+966 50 123 4567">
<small>type=text, no dir — local phone</small><input type="text" value="050-123-4567">
<small>type=text dir=auto — intl phone</small><input type="text" dir="auto" value="+966 50 123 4567">
<small>type=tel — intl phone</small><input type="tel" value="+966 50 123 4567">
<small>computed direction of each input</small><div id="d" style="direction:ltr;font:12px monospace"></div></body></html>`;
for (const [n, e] of Object.entries({ chromium, firefox, webkit })) {
  const b = await e.launch(); const p = await b.newPage({ viewport: { width: 370, height: 330 }, deviceScaleFactor: 2 });
  await p.setContent(html);
  const dirs = await p.evaluate(() => [...document.querySelectorAll("input")].map((i) => `${i.type}${i.dir ? "/" + i.dir : ""}:${getComputedStyle(i).direction}`).join("  "));
  console.log(n.padEnd(9), dirs);
  await p.screenshot({ path: `../evidence/lab/input-text-phone.${n}.png` }); await b.close();
}
