// Inputs with icons inside them, under dir="rtl": which combinations put the text under the icon.
//
//   node harness/lab-inputs.mjs <out-dir>
//
// Markup mirrors the shadcn/Tailwind pattern AI builders emit:
//   <div class="relative"><Search class="absolute left-3 top-1/2 -translate-y-1/2" /><Input class="pl-10" /></div>
// with Tailwind classes written out as inline styles (left-3 = left:12px, pl-10 = padding-left:40px, ms/ps = logical).
import { chromium, firefox, webkit } from "playwright";
import fs from "node:fs";
import path from "node:path";

const outDir = process.argv[2];
fs.mkdirSync(outDir, { recursive: true });

const ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>`;
const PH = "ابحث عن منتج أو علامة تجارية أو فئة";
// [label, icon position style, input padding style, typed value]
const CASES = [
  ["icon left-3 + pl-10 (LTR code, untouched)", "left:12px", "padding-left:40px;padding-right:12px", ""],
  ["icon start-3 + ps-10 (logical both)", "inset-inline-start:12px", "padding-inline-start:40px;padding-inline-end:12px", ""],
  ["icon start-3 + pl-10 (icon converted, padding not)", "inset-inline-start:12px", "padding-left:40px;padding-right:12px", ""],
  ["icon left-3 + ps-10 (padding converted, icon not)", "left:12px", "padding-inline-start:40px;padding-inline-end:12px", ""],
  ["icon right-3 + pr-10 (manually 'flipped')", "right:12px", "padding-right:40px;padding-left:12px", ""],
  ["icon left-3 + pl-10, long typed text", "left:12px", "padding-left:40px;padding-right:12px", "سماعات لاسلكية بخاصية إلغاء الضوضاء من سوني"],
  ["icon start-3 + pl-10, long typed text", "inset-inline-start:12px", "padding-left:40px;padding-right:12px", "سماعات لاسلكية بخاصية إلغاء الضوضاء من سوني"],
];

const page = (rows) => `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600&display=swap" rel="stylesheet">
<style>body{font:14px Cairo,sans-serif;margin:16px;width:360px} .label{font:11px monospace;color:#666;direction:ltr;text-align:left;margin-top:10px}
.wrap{position:relative} .wrap svg{display:block;color:#888}
input{box-sizing:border-box;width:100%;height:40px;border:1px solid #ccc;border-radius:6px;font:inherit}</style></head><body>${rows}</body></html>`;

const rows = CASES.map(([label, iconPos, pad, value], i) =>
  `<div class="label">${label}</div><div class="wrap"><span style="position:absolute;${iconPos};top:0;bottom:0;display:flex;align-items:center" data-icon="${i}">${ICON}</span>` +
  `<input data-i="${i}" style="${pad}" placeholder="${PH}" value="${value}"></div>`).join("");

// Measure where the text of each input is drawn (placeholder or value) and whether it meets the icon.
function measure() {
  const ctx = document.createElement("canvas").getContext("2d");
  return [...document.querySelectorAll("input[data-i]")].map((inp) => {
    const i = inp.dataset.i;
    const s = getComputedStyle(inp);
    ctx.font = `${s.fontWeight} ${s.fontSize} ${s.fontFamily}`;
    const text = inp.value || inp.placeholder;
    const r = inp.getBoundingClientRect();
    const padL = parseFloat(s.paddingLeft) + parseFloat(s.borderLeftWidth);
    const padR = parseFloat(s.paddingRight) + parseFloat(s.borderRightWidth);
    const contentL = r.left + padL, contentR = r.right - padR;
    const w = Math.min(ctx.measureText(text).width, contentR - contentL);
    // RTL input text starts at the right edge of the content box
    const textL = contentR - w, textR = contentR;
    const icon = document.querySelector(`[data-icon="${i}"] svg`).getBoundingClientRect();
    const overlap = Math.max(0, Math.min(textR, icon.right) - Math.max(textL, icon.left));
    const iconSide = (icon.left + icon.right) / 2 > (r.left + r.right) / 2 ? "right (start)" : "left (end)";
    // can typed text ever reach the icon? the content box itself overlapping the icon means yes
    const reach = Math.max(0, Math.min(contentR, icon.right) - Math.max(contentL, icon.left));
    return { case: i, iconSide, textUnderIconPx: Math.round(overlap), contentBoxUnderIconPx: Math.round(reach) };
  });
}

const results = {};
for (const [name, engine] of Object.entries({ chromium, firefox, webkit })) {
  const b = await engine.launch();
  const p = await b.newPage({ viewport: { width: 400, height: 700 }, deviceScaleFactor: 2 });
  await p.setContent(page(rows), { waitUntil: "networkidle" });
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: path.join(outDir, `inputs.${name}.png`), fullPage: true });
  results[name] = await p.evaluate(measure);
  await b.close();
}
fs.writeFileSync(path.join(outDir, "inputs.json"), JSON.stringify(results, null, 1));
for (const [i, [label]] of CASES.entries()) {
  const c = results.chromium[i];
  const same = ["firefox", "webkit"].every((e) => results[e][i].textUnderIconPx === c.textUnderIconPx);
  console.log(`${label.padEnd(52)} icon ${c.iconSide.padEnd(13)} text under icon ${String(c.textUnderIconPx).padStart(3)}px  ` +
    `(typing can reach it: ${c.contentBoxUnderIconPx > 0 ? "yes" : "no"})${same ? "" : "  [engines differ]"}`);
}
