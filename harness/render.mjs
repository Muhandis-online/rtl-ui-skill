// Render live Arabic sites and record measurable RTL facts, with screenshots for what needs a reader.
//
//   node harness/render.mjs <urls.json> <out-dir>
//
// urls.json: [{ "id": "owner__repo", "url": "https://..." }, ...]
// Writes <out-dir>/<id>/{desktop.png, mobile.png, facts.json} and <out-dir>/facts.jsonl.
// Nothing from the sites runs outside the browser sandbox.
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const [, , urlsFile, outDir] = process.argv;
const targets = JSON.parse(fs.readFileSync(urlsFile, "utf8"));
const VIEWPORTS = { desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } };
const MAX_SHOT_HEIGHT = 5000; // full-page shots of long landing pages get huge; the top 5000px shows the patterns
const CONCURRENCY = 4;
const FONT_SAMPLES = 12; // Arabic text nodes per page whose rendered font we ask Chromium for

// Runs inside the page. Returns only measurements and short samples.
function measure() {
  const AR = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;
  const LATIN_WORD = /[A-Za-z]{3,}/;
  const html = document.documentElement;
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none";
  };
  // elements that own Arabic text directly
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const arabicEls = new Set();
  const textNodes = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = n.nodeValue.trim();
    if (!t || !n.parentElement || ["SCRIPT", "STYLE", "NOSCRIPT"].includes(n.parentElement.tagName)) continue;
    if (!visible(n.parentElement)) continue;
    textNodes.push(n);
    if (AR.test(t)) arabicEls.add(n.parentElement);
  }
  const els = [...arabicEls];
  const count = (f) => els.filter(f).length;
  const sample = (f, k = 5) => els.filter(f).slice(0, k).map((e) => e.textContent.trim().slice(0, 60));
  const cs = (e) => getComputedStyle(e);

  // text alignment as the side it lands on, not the keyword
  const side = (e) => {
    const s = cs(e);
    const a = s.textAlign;
    if (a === "center" || a === "justify") return a;
    if (a === "left" || a === "right") return a;
    const rtl = s.direction === "rtl";
    if (a === "start") return rtl ? "right" : "left";
    if (a === "end") return rtl ? "left" : "right";
    return a;
  };
  const sides = {};
  for (const e of els) sides[side(e)] = (sides[side(e)] || 0) + 1;

  // digits that appear in visible text
  const allText = textNodes.map((n) => n.nodeValue).join(" ");
  const latinDigits = (allText.match(/[0-9]/g) || []).length;
  const arabicIndic = (allText.match(/[٠-٩]/g) || []).length;
  const persianDigits = (allText.match(/[۰-۹]/g) || []).length;

  // tokens that must read left to right inside RTL text: check their pieces are drawn in logical order
  // values the user decided always read left to right: phone numbers, emails, URLs, times (and time ranges), dates
  const TOKEN = /(\d{1,2}:\d{2}(?:\s*[-–]\s*\d{1,2}:\d{2})?)|(\d{1,4}[\/.-]\d{1,2}[\/.-]\d{1,4})|(\+?\d[\d\s-]{6,}\d)|([\w.+-]+@[\w-]+\.[\w.]+)|(https?:\/\/\S+)/g;
  const tokens = [];
  for (const n of textNodes) {
    // tokens in LTR contexts are recorded too: an isolated phone number is a pass, not an absence
    const p = n.parentElement;
    for (const m of n.nodeValue.matchAll(TOKEN)) {
      const tok = m[0];
      // split into pieces at spaces, dashes, @, dots, colons and slashes; a piece drawn left of its predecessor
      // means reordering. A one-piece token cannot be reordered but is still recorded for the isolation check.
      const pieces = [];
      const re = /[^\s\-@.:\/]+/g;
      let pm;
      while ((pm = re.exec(tok))) pieces.push([m.index + pm.index, m.index + pm.index + pm[0].length]);
      if (!pieces.length) continue;
      const xs = pieces.map(([a, b]) => {
        const r = document.createRange();
        r.setStart(n, a);
        r.setEnd(n, b);
        const rect = r.getClientRects()[0];
        return rect ? { x: Math.round(rect.left), y: Math.round(rect.top) } : null;
      });
      if (xs.includes(null)) continue;
      const lines = new Set(xs.map((p) => p.y)).size;
      let inOrder = true;
      for (let i = 1; i < xs.length; i++) if (xs[i].y === xs[i - 1].y && xs[i].x < xs[i - 1].x) inOrder = false;
      const context = n.nodeValue.trim().slice(0, 80);
      // isolated: drawn in a left-to-right context of its own (dir="ltr", <bdi>, or an element computed as ltr)
      const isolated = !!p.closest("[dir=ltr], bdi, [dir=auto]") || cs(p).direction === "ltr";
      const kind = m[1] ? "time" : m[2] ? "date" : m[3] ? "phone" : m[4] ? "email" : "url";
      // part of an Arabic phrase ("10:30 مساءً"): reads right to left with the sentence, so it must not be wrapped
      const mixed = /^\s*[؀-ۿ]/.test(n.nodeValue.slice(m.index + tok.length));
      // the LTR wrapper also holds trailing punctuation: that mark is drawn on the wrong side
      const wrap = p.closest("[dir=ltr], bdi");
      const punctInside = !!wrap && /[.,،!?؟:;]\s*$/.test(wrap.textContent) && /[؀-ۿ]/.test(wrap.parentElement?.textContent || "");
      tokens.push({ token: tok.trim(), kind, inOrder, wrapsLines: lines > 1, isolated, mixed, punctInside, context });
    }
  }

  // lucide icons render <svg class="lucide lucide-arrow-right ..."> ; check which direction-bearing ones are mirrored
  const icons = [];
  const ctlOf = (svg) => svg.closest("button, a, [role=button]");
  for (const svg of document.querySelectorAll("svg[class*='lucide-']")) {
    if (!visible(svg)) continue;
    const name = [...svg.classList].find((c) => c.startsWith("lucide-"));
    if (!/(arrow|chevron|move|send|corner|undo|redo|log-in|log-out|reply|forward|skip|step|fast-forward|rewind|play)/.test(name || "")) continue;
    // what the icon is for: the label of the control it sits in, or the text next to it
    const ctl = ctlOf(svg);
    const label = ((ctl && (ctl.getAttribute("aria-label") || ctl.textContent)) || svg.parentElement.textContent || "")
      .trim().replace(/\s+/g, " ").slice(0, 50);
    // which way the icon finally points: combine `transform` (Tailwind 3 compiles rotate-180 / -scale-x-100 to it)
    // with the individual `rotate` and `scale` properties (Tailwind 4 compiles to those), on the icon and its
    // ancestors up to the control, since a flipped button flips its icon too
    let flips = 0;
    for (let e = svg; e && e !== document.body; e = e.parentElement) {
      const s = cs(e);
      const m = new DOMMatrix(s.transform === "none" ? undefined : s.transform);
      if (m.a < 0) flips++;
      const rot = s.rotate && s.rotate !== "none" ? parseFloat(s.rotate.replace(/^[a-z]+\s+/, "")) : 0;
      if (Math.abs((Math.abs(rot) % 360) - 180) < 1) flips++;
      const sc = s.scale && s.scale !== "none" ? parseFloat(s.scale.split(" ")[0]) : 1;
      if (sc < 0) flips++;
      if (e === ctl) break;
    }
    icons.push({ name, flipped: flips % 2 === 1, rtlContext: cs(svg).direction === "rtl", label,
                 control: ctl ? ctl.tagName.toLowerCase() : null });
  }
  const iconSummary = {};
  for (const i of icons) {
    const k = `${i.name}|${i.flipped ? "flipped" : "as-drawn"}`;
    iconSummary[k] = (iconSummary[k] || 0) + 1;
  }
  const iconDetails = icons.slice(0, 25);

  // English left in controls
  const controls = [...document.querySelectorAll("button, a, label, [placeholder], [aria-label]")].filter(visible);
  const englishControls = controls
    .map((e) => (e.getAttribute("placeholder") || e.getAttribute("aria-label") || e.textContent || "").trim())
    .filter((t) => t && LATIN_WORD.test(t) && !AR.test(t))
    .slice(0, 15);

  // text cut off by its own box: content larger than the box while overflow hides it (ellipsis is deliberate)
  const clipped = [];
  for (const e of els) {
    const s = cs(e);
    const hides = /hidden|clip/.test(s.overflowX + s.overflowY);
    if (!hides || s.textOverflow === "ellipsis" || /-webkit-box/.test(s.display)) continue;
    if (e.scrollWidth > e.clientWidth + 2 || e.scrollHeight > e.clientHeight + 2)
      clipped.push(e.textContent.trim().slice(0, 50));
  }

  // labels and buttons whose text collides with a form control they are not part of
  const formControls = [...document.querySelectorAll("input:not([type=hidden]):not([type=checkbox]):not([type=radio]), select, textarea, [role=combobox]")]
    .filter(visible);
  const overlaps = [];
  const textRects = [];
  for (const n of textNodes) {
    const p = n.parentElement;
    if (!AR.test(n.nodeValue) || formControls.some((c) => c.contains(p))) continue;
    const r = document.createRange();
    r.selectNodeContents(n);
    for (const rect of r.getClientRects()) textRects.push({ rect, p, text: n.nodeValue.trim().slice(0, 40) });
  }
  for (const c of formControls) {
    const cr = c.getBoundingClientRect();
    for (const { rect, p, text } of textRects) {
      if (p.contains(c)) continue;
      const w = Math.min(rect.right, cr.right) - Math.max(rect.left, cr.left);
      const h = Math.min(rect.bottom, cr.bottom) - Math.max(rect.top, cr.top);
      if (w > 4 && h > 4 && w * h > 0.3 * rect.width * rect.height) {
        overlaps.push({ text, control: c.tagName.toLowerCase() + (c.name ? `[name=${c.name}]` : "") });
        if (overlaps.length >= 10) break;
      }
    }
  }

  // did the layout flip: where the logo and the nav sit in the header (RTL convention: logo at the right)
  const header = document.querySelector("header, nav, [role=banner]");
  let layout = null;
  if (header && visible(header)) {
    const hr = header.getBoundingClientRect();
    const logo = header.querySelector("a img, a svg, img, a[href='/']");
    const lr = logo && visible(logo) ? logo.getBoundingClientRect() : null;
    layout = { logoSide: lr ? ((lr.left + lr.right) / 2 > hr.left + hr.width / 2 ? "right" : "left") : null };
  }

  return {
    clipped: clipped.slice(0, 10),
    overlaps,
    layout,
    title: document.title,
    lang: html.getAttribute("lang"),
    dirAttr: html.getAttribute("dir"),
    bodyDirection: cs(document.body).direction,
    arabicElements: els.length,
    arabicLtr: count((e) => cs(e).direction === "ltr"),
    arabicLtrSamples: sample((e) => cs(e).direction === "ltr"),
    alignSides: sides,
    letterSpacing: count((e) => cs(e).letterSpacing !== "normal" && parseFloat(cs(e).letterSpacing) !== 0),
    letterSpacingSamples: sample((e) => cs(e).letterSpacing !== "normal" && parseFloat(cs(e).letterSpacing) !== 0),
    uppercase: count((e) => cs(e).textTransform === "uppercase"),
    italic: count((e) => cs(e).fontStyle === "italic"),
    lineHeightRatios: els.slice(0, 40).map((e) => {
      const s = cs(e);
      return s.lineHeight === "normal" ? null : +(parseFloat(s.lineHeight) / parseFloat(s.fontSize)).toFixed(2);
    }).filter((x) => x),
    rowReverse: [...document.querySelectorAll("*")].filter((e) => cs(e).flexDirection === "row-reverse" && cs(e).direction === "rtl").length,
    digits: { latin: latinDigits, arabicIndic, persian: persianDigits },
    tokens: tokens.slice(0, 20),
    icons: iconSummary,
    iconDetails,
    englishControls,
    horizontalOverflow: document.documentElement.scrollWidth - window.innerWidth,
    textLength: allText.length,
  };
}

async function renderedFonts(page) {
  // mark a few Arabic text owners, then ask Chromium which platform font actually drew their glyphs
  const n = await page.evaluate((k) => {
    // only elements whose whole text is Arabic, so the fonts reported drew Arabic glyphs and nothing else
    const ARABIC_ONLY = /^[؀-ۿݐ-ݿ\s.,:;!?؟،«»()-]+$/;
    const owners = [];
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let t = w.nextNode(); t && owners.length < k; t = w.nextNode()) {
      const e = t.parentElement;
      if (e && /[؀-ۿ]/.test(e.textContent) && ARABIC_ONLY.test(e.textContent.trim()) && !owners.includes(e))
        owners.push(e);
    }
    owners.forEach((e, i) => e.setAttribute("data-rtlprobe", i));
    return owners.length;
  }, FONT_SAMPLES);
  if (!n) return {};
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("DOM.enable");
  await cdp.send("CSS.enable");
  const { root } = await cdp.send("DOM.getDocument", { depth: -1 });
  const { nodeIds } = await cdp.send("DOM.querySelectorAll", { nodeId: root.nodeId, selector: "[data-rtlprobe]" });
  const fonts = {};
  const declared = {};
  for (const nodeId of nodeIds) {
    // the probe attribute sits on the element; its first text child is what was drawn
    const { fonts: pf } = await cdp.send("CSS.getPlatformFontsForNode", { nodeId });
    for (const f of pf) fonts[f.familyName] = (fonts[f.familyName] || 0) + f.glyphCount;
    const { computedStyle } = await cdp.send("CSS.getComputedStyleForNode", { nodeId });
    const ff = computedStyle.find((p) => p.name === "font-family")?.value;
    if (ff) declared[ff] = (declared[ff] || 0) + 1;
  }
  await cdp.detach();
  return { renderedGlyphsByFont: fonts, declaredFontFamily: declared };
}

// Open the hamburger menu (a click on a button, nothing is submitted) and record which edge the panel sits on.
async function openMobileMenu(page, dir) {
  await page.evaluate(() => window.scrollTo(0, 0));
  const button = page.locator("header button:visible, nav button:visible").filter({ has: page.locator("svg.lucide-menu, svg.lucide-align-justify") }).first();
  const fallback = page.locator("button[aria-label*='menu' i]:visible, button[aria-label*='القائمة']:visible").first();
  const target = (await button.count()) ? button : (await fallback.count()) ? fallback : null;
  if (!target) return { found: false };
  const before = await page.evaluate(() => [...document.querySelectorAll("*")].length);
  try {
    await target.click({ timeout: 3000 });
  } catch {
    return { found: true, clicked: false };
  }
  await page.waitForTimeout(800); // slide-in animations
  const panel = await page.evaluate(() => {
    // the opened panel: a dialog, or the largest newly visible fixed/absolute box near an edge
    const vw = window.innerWidth;
    const cands = [...document.querySelectorAll("[role=dialog], [data-state=open], aside, nav, div")].filter((e) => {
      const s = getComputedStyle(e);
      const r = e.getBoundingClientRect();
      return (s.position === "fixed" || e.getAttribute("role") === "dialog") && r.width > 120 && r.width < vw - 8 && r.height > 200;
    });
    if (!cands.length) return { kind: "full-width or dropdown" };
    const e = cands.sort((a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0];
    const r = e.getBoundingClientRect();
    return { kind: "side panel", edge: r.left < 4 ? "left" : r.right > vw - 4 ? "right" : "floating", width: Math.round(r.width) };
  });
  await page.screenshot({ path: path.join(dir, "mobile-menu.png") });
  return { found: true, clicked: true, ...panel, newNodes: (await page.evaluate(() => document.querySelectorAll("*").length)) - before };
}

async function renderOne(browser, t) {
  const dir = path.join(outDir, t.id);
  fs.mkdirSync(dir, { recursive: true });
  const result = { id: t.id, url: t.url };
  for (const [name, vp] of Object.entries(VIEWPORTS)) {
    const ctx = await browser.newContext({ viewport: vp, locale: "en-US", deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
    try {
      const resp = await page.goto(t.url, { waitUntil: "networkidle", timeout: 45000 });
      result.status = resp ? resp.status() : null;
      result.finalUrl = page.url();
      await page.waitForTimeout(1500); // entry animations and web fonts
      await page.evaluate(() => document.fonts.ready);
      const facts = await page.evaluate(measure);
      if (name === "desktop") Object.assign(facts, await renderedFonts(page));
      result[name] = facts;
      const h = Math.min(await page.evaluate(() => document.documentElement.scrollHeight), MAX_SHOT_HEIGHT);
      await page.screenshot({ path: path.join(dir, `${name}.png`), clip: { x: 0, y: 0, width: vp.width, height: h }, fullPage: true });
      if (name === "mobile") result.mobileMenu = await openMobileMenu(page, dir);
    } catch (e) {
      result[name] = { error: String(e).slice(0, 300) };
    }
    result[`${name}PageErrors`] = errors.slice(0, 5);
    await ctx.close();
  }
  fs.writeFileSync(path.join(dir, "facts.json"), JSON.stringify(result, null, 1));
  return result;
}

const browser = await chromium.launch();
const queue = [...targets];
const out = fs.createWriteStream(path.join(outDir, "facts.jsonl"), { flags: "a" });
await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
  for (let t = queue.shift(); t; t = queue.shift()) {
    const r = await renderOne(browser, t);
    out.write(JSON.stringify(r) + "\n");
    const d = r.desktop || {};
    console.log(`${t.id}  ${r.status ?? "-"}  lang=${d.lang} dir=${d.dirAttr} ar=${d.arabicElements ?? "-"} ${d.error ? "ERR " + d.error.slice(0, 60) : ""}`);
  }
}));
out.end();
await browser.close();
