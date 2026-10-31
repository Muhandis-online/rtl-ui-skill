// Visit pages that usually hold forms and measure each input: does anything drawn inside it (icon, eye toggle,
// prefix) sit over the area where its text goes, and is its placeholder on the right side?
//
//   node harness/probe-inputs.mjs <urls.json> <out-dir>
//
// Read-only: GET navigations and measurements. Nothing is typed, clicked or submitted.
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const [, , urlsFile, outDir] = process.argv;
const targets = JSON.parse(fs.readFileSync(urlsFile, "utf8"));
const PATHS = ["", "/login", "/auth", "/signin", "/signup", "/register", "/contact", "/checkout", "/search"];
const CONCURRENCY = 4;
fs.mkdirSync(outDir, { recursive: true });

function measureInputs() {
  const AR = /[؀-ۿ]/;
  const ctx = document.createElement("canvas").getContext("2d");
  const visible = (e) => {
    const r = e.getBoundingClientRect();
    const s = getComputedStyle(e);
    return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none" && +s.opacity > 0;
  };
  const inputs = [...document.querySelectorAll("input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=file]):not([type=range]), textarea")]
    .filter(visible);
  const out = [];
  for (const inp of inputs) {
    const s = getComputedStyle(inp);
    const r = inp.getBoundingClientRect();
    const contentL = r.left + parseFloat(s.paddingLeft) + parseFloat(s.borderLeftWidth);
    const contentR = r.right - parseFloat(s.paddingRight) - parseFloat(s.borderRightWidth);
    // things drawn inside the input box: positioned elements in the same wrapper (2 levels up), not the input
    const wrap = inp.parentElement?.parentElement || inp.parentElement;
    const inside = [...wrap.querySelectorAll("*")].filter((e) => {
      if (e === inp || e.contains(inp) || inp.contains(e) || !visible(e)) return false;
      const ps = getComputedStyle(e).position;
      if (ps !== "absolute" && ps !== "fixed") return false;
      const er = e.getBoundingClientRect();
      return er.width < r.width / 2 && er.left >= r.left - 2 && er.right <= r.right + 2 && er.top >= r.top - 2 && er.bottom <= r.bottom + 2;
    });
    // text extent: value or placeholder, aligned per the input's own text-align/direction
    const text = inp.value || inp.getAttribute("placeholder") || "";
    ctx.font = `${s.fontWeight} ${s.fontSize} ${s.fontFamily}`;
    const w = Math.min(ctx.measureText(text).width, contentR - contentL);
    const rtl = s.direction === "rtl";
    const align = s.textAlign === "start" ? (rtl ? "right" : "left") : s.textAlign === "end" ? (rtl ? "left" : "right") : s.textAlign;
    const [tL, tR] = align === "right" ? [contentR - w, contentR] : align === "center" ? [(contentL + contentR - w) / 2, (contentL + contentR + w) / 2] : [contentL, contentL + w];
    const hits = inside.map((e) => {
      const er = e.getBoundingClientRect();
      const ov = (a, b) => Math.max(0, Math.min(b, er.right) - Math.max(a, er.left));
      return { tag: e.tagName.toLowerCase(), cls: (e.getAttribute("class") || "").slice(0, 80), textPx: Math.round(ov(tL, tR)), contentPx: Math.round(ov(contentL, contentR)) };
    }).filter((h) => h.contentPx > 2);
    out.push({
      type: inp.type || inp.tagName.toLowerCase(),
      name: inp.name || inp.id || "",
      placeholder: (inp.getAttribute("placeholder") || "").slice(0, 50),
      placeholderArabic: AR.test(inp.getAttribute("placeholder") || ""),
      direction: s.direction,
      align,
      inputClass: (inp.getAttribute("class") || "").slice(0, 160),
      hits,
    });
  }
  return out;
}

const browser = await chromium.launch();
const queue = [...targets];
const results = [];
await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
  for (let t = queue.shift(); t; t = queue.shift()) {
    const base = new URL(t.url).origin;
    const site = { id: t.id, pages: [] };
    const seen = new Set();
    for (const vp of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      const ctx = await browser.newContext({ viewport: vp });
      const page = await ctx.newPage();
      for (const p of PATHS) {
        try {
          await page.goto(base + p, { waitUntil: "networkidle", timeout: 30000 });
          await page.waitForTimeout(800);
          const inputs = await page.evaluate(measureInputs);
          const key = `${vp.width}|${page.url()}|${inputs.length}`;
          if (!inputs.length || seen.has(key)) continue;
          seen.add(key);
          const shot = `${t.id}__${vp.width}__${p.replace(/\//g, "") || "home"}.png`;
          if (inputs.some((i) => i.hits.length)) await page.screenshot({ path: path.join(outDir, shot) });
          site.pages.push({ width: vp.width, path: p, url: page.url(), inputs, shot });
        } catch { /* page missing or slow: skip */ }
      }
      await ctx.close();
    }
    results.push(site);
    const n = site.pages.reduce((a, p) => a + p.inputs.length, 0);
    const bad = site.pages.reduce((a, p) => a + p.inputs.filter((i) => i.hits.some((h) => h.contentPx > 2)).length, 0);
    console.log(`${t.id}  inputs=${n}  with-something-in-text-area=${bad}`);
  }
}));
fs.writeFileSync(path.join(outDir, "inputs.json"), JSON.stringify(results, null, 1));
await browser.close();
