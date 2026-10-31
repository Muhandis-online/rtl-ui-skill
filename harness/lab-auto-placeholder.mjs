// An input with automatic direction and an Arabic placeholder: which direction is the empty field, and does
// forcing RTL only while the placeholder shows fix it without breaking a typed phone number?
//   node harness/lab-auto-placeholder.mjs <out-dir>
import { chromium, firefox, webkit } from "playwright";
const html = `<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><style>
body{font:18px sans-serif;margin:12px;width:360px} small{font:11px monospace;color:#888;display:block;direction:ltr;text-align:left;margin-top:8px}
input{width:100%;box-sizing:border-box;font:inherit;padding:6px} .fix:placeholder-shown{direction:rtl}</style>
<small>dir=auto, empty</small><input id="a" dir="auto" placeholder="ابحث بالاسم أو رقم الجوال.">
<small>dir=auto + RTL while placeholder shows, empty</small><input id="b" class="fix" dir="auto" placeholder="ابحث بالاسم أو رقم الجوال.">
<small>dir=auto + RTL while placeholder shows, typed phone</small><input id="c" class="fix" dir="auto" placeholder="ابحث بالاسم أو رقم الجوال." value="+966 50 123 4567">
<small>dir=auto + RTL while placeholder shows, typed Arabic</small><input id="d" class="fix" dir="auto" placeholder="ابحث" value="محمد القحطاني"></html>`;
for (const [n, e] of Object.entries({ chromium, firefox, webkit })) {
  const b = await e.launch(); const p = await b.newPage({ viewport: { width: 390, height: 300 }, deviceScaleFactor: 2 }); await p.setContent(html);
  const r = await p.evaluate(() => ["a", "b", "c", "d"].map((id) => `${id}:${getComputedStyle(document.getElementById(id)).direction}`).join("  "));
  console.log(n.padEnd(9), r);
  if (n === "chromium") await p.screenshot({ path: process.argv[2] + "/auto-placeholder.png" });
  await b.close();
}
