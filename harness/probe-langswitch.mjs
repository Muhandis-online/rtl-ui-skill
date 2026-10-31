// For a bilingual app: check the default is Arabic RTL, then click the language switch and check the page really
// becomes English LTR, then switch back. Clicks only the language control.
//
//   node harness/probe-langswitch.mjs <url> <out-dir>
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const [, , url, outDir] = process.argv;
fs.mkdirSync(outDir, { recursive: true });

function state() {
  const AR = /[؀-ۿ]/g, LAT = /[A-Za-z]{2,}/g;
  const text = document.body.innerText || "";
  return {
    lang: document.documentElement.getAttribute("lang"),
    dir: document.documentElement.getAttribute("dir"),
    bodyDirection: getComputedStyle(document.body).direction,
    arabicChars: (text.match(AR) || []).length,
    latinWords: (text.match(LAT) || []).length,
  };
}

// the language control: a button or link whose text or label names the other language
async function findSwitch(page, toEnglish) {
  // exact names first: a page about English courses has many links that merely contain the word "English"
  const exact = toEnglish ? /^(EN|ENG|English|E)$/i : /^(AR|ع|عربي|العربية|Arabic)$/i;
  const label = /language|لغة|اللغة|switch|تبديل/i;
  const loose = toEnglish ? /English|الإنجليزية|انجليزي|إنجليزي/i : /عربي|العربية|Arabic/i;
  // the switch lives in the header, the navigation or an open menu; content sections can have their own "English"
  // buttons (a course tab), so look there only if nothing else matches
  const scoped = "header, nav, [role=dialog], [data-state=open]";
  const sel = (s) => `${s} button:visible, ${s} a:visible, ${s} [role=button]:visible, ${s} select:visible`;
  let els = await page.locator(scoped.split(", ").map(sel).join(", ")).all();
  if (!els.length) els = await page.locator("button:visible, a:visible, [role=button]:visible, select:visible").all();
  const texts = [];
  for (const el of els) texts.push({ el, text: ((await el.textContent()) || "").trim(), aria: (await el.getAttribute("aria-label")) || "" });
  return (texts.find((t) => exact.test(t.text)) || texts.find((t) => label.test(t.aria) && loose.test(t.aria + " " + t.text))
    || texts.find((t) => t.el && /^button$/i.test("button") && loose.test(t.text) && t.text.length < 20))?.el || null;
}

const b = await chromium.launch();
const out = {};
for (const [name, vp] of Object.entries({ desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } })) {
  const page = await b.newPage({ viewport: vp });
  await page.goto(url, { waitUntil: "networkidle" });
  const r = { initial: await page.evaluate(state) };
  let sw = await findSwitch(page, true);
  // a closed drawer keeps its links "visible" but translated off-screen; such a switch cannot be clicked
  const onScreen = sw && (await sw.evaluate((e) => {
    const r = e.getBoundingClientRect();
    return !!e.closest("header, nav, [role=dialog], [data-state=open]") && r.right > 0 && r.left < innerWidth && r.bottom > 0 && r.top < innerHeight;
  }));
  if ((!sw || !onScreen) && name === "mobile") {
    // the switch may sit inside the mobile menu
    const menu = page.locator("header button:visible").filter({ has: page.locator("svg.lucide-menu") }).first();
    if (await menu.count()) { await menu.click().catch(() => {}); await page.waitForTimeout(500); sw = await findSwitch(page, true); }
  }
  if (sw) {
    const tag = await sw.evaluate((e) => e.tagName.toLowerCase());
    if (tag === "select") await sw.selectOption({ label: /English|EN/i }).catch(() => {});
    else await sw.click().catch(() => {});
    await page.waitForTimeout(700);
    r.afterEnglish = await page.evaluate(state);
    await page.screenshot({ path: path.join(outDir, `english-${name}.png`) });
    const back = await findSwitch(page, false);
    if (back) {
      await back.click().catch(() => {});
      await page.waitForTimeout(700);
      r.afterArabic = await page.evaluate(state);
    }
    // a reload should keep the chosen language or return to the Arabic default; record which
    await page.reload({ waitUntil: "networkidle" });
    r.afterReload = await page.evaluate(state);
  } else r.switchFound = false;
  out[name] = r;
  await page.close();
}
await b.close();
fs.writeFileSync(path.join(outDir, "langswitch.json"), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out));
