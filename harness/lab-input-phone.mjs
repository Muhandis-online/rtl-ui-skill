// What a phone number or email looks like after typing it into an RTL input, with and without dir="ltr".
import { chromium, firefox, webkit } from "playwright";
const rows = [
  ["input, page dir=rtl, no dir", ""],
  ["input dir=ltr", 'dir="ltr"'],
  ["input dir=auto", 'dir="auto"'],
];
const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>body{font:18px sans-serif;margin:12px;width:340px}
small{font:11px monospace;display:block;direction:ltr;text-align:left;color:#666;margin-top:8px} input{width:100%;box-sizing:border-box;font:inherit;padding:6px}</style></head><body>
${rows.map(([l, a]) => `<small>${l} — phone</small><input type="tel" ${a} value="+966 50 123 4567"><small>${l} — local phone</small><input type="tel" ${a} value="050-123-4567"><small>${l} — email</small><input type="email" ${a} value="sara.ali@example.com">`).join("")}</body></html>`;
for (const [n, e] of Object.entries({ chromium, firefox, webkit })) {
  const b = await e.launch(); const p = await b.newPage({ viewport: { width: 370, height: 460 }, deviceScaleFactor: 2 });
  await p.setContent(html); await p.screenshot({ path: `../evidence/lab/input-phone.${n}.png` }); await b.close();
}
