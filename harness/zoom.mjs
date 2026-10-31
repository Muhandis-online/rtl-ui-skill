// One-off: letter-spacing on Arabic at 3x, per engine, to see whether the joins survive.
import { chromium, firefox, webkit } from "playwright";
const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;700&display=swap" rel="stylesheet">
<style>body{font:700 40px 'Noto Sans Arabic';margin:10px} div{margin:4px 0} small{font:12px monospace;direction:ltr;display:block;text-align:left}</style></head>
<body><small>normal</small><div>الثقافية محمد</div><small>0.1em (tracking-widest)</small><div style="letter-spacing:.1em">الثقافية محمد</div>
<small>-0.05em (tracking-tighter)</small><div style="letter-spacing:-.05em">الثقافية محمد</div></body></html>`;
for (const [n, e] of Object.entries({ chromium, firefox, webkit })) {
  const b = await e.launch(); const p = await b.newPage({ viewport: { width: 420, height: 230 }, deviceScaleFactor: 2 });
  await p.setContent(html, { waitUntil: "networkidle" }); await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: `../evidence/lab/letter-spacing-zoom.${n}.png` }); await b.close();
}
