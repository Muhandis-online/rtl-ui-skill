// Grade one Phase B run: build it, serve it, run the Phase A probes on it, then type realistic values into every
// input and measure again. Writes <out-dir>/{facts.json, inputs.json, typed.json, *.png}.
//
//   node harness/grade.mjs <run-dir> <out-dir> [port]
//
// Every check here comes from evidence/FINDINGS.md; nothing is graded that was not observed or lab-proven.
import { chromium } from "playwright";
import { execSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const [, , runDir, outDir, portArg] = process.argv;
const port = +(portArg || 4310);
fs.mkdirSync(outDir, { recursive: true });

execSync("npx vite build", { cwd: runDir, stdio: "pipe" });
const server = spawn("npx", ["vite", "preview", "--port", String(port), "--strictPort"], { cwd: runDir, shell: true });
await new Promise((ok) => setTimeout(ok, 4000));
const url = `http://localhost:${port}/`;

try {
  const urls = path.join(outDir, "urls.json");
  fs.writeFileSync(urls, JSON.stringify([{ id: "run", url }]));
  execSync(`node "${path.join(here, "render.mjs")}" "${urls}" "${outDir}"`, { stdio: "pipe" });
  execSync(`node "${path.join(here, "probe-inputs.mjs")}" "${urls}" "${path.join(outDir, "inputs")}"`, { stdio: "pipe" });

  // Typing pass: values chosen from the lab cases that break (spaced intl phone, long text next to icons).
  const VALUES = {
    tel: "+966 50 123 4567",
    email: "abdulrahman.alqahtani@company-name.com.sa",
    password: "MySecurePassword2026!xyzABC",
    phoneLike: "+966 50 123 4567",
    text: "عبدالرحمن بن محمد القحطاني آل سعود",
  };
  const browser = await chromium.launch();
  const typed = {};
  for (const [name, vp] of Object.entries({ desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } })) {
    const page = await browser.newPage({ viewport: vp });
    await page.goto(url, { waitUntil: "networkidle" });
    const fields = await page.locator("input:visible").all();
    for (const f of fields) {
      const meta = await f.evaluate((e) => ({ type: e.type, hint: `${e.name} ${e.id} ${e.placeholder} ${e.getAttribute("aria-label") || ""} ${e.labels?.[0]?.textContent || ""}` }));
      if (["checkbox", "radio", "range", "file", "hidden"].includes(meta.type)) continue;
      const phoneish = /جوال|هاتف|phone|mobile|tel/i.test(meta.hint);
      const v = meta.type === "tel" || phoneish ? VALUES.tel : meta.type === "email" || /بريد|email/i.test(meta.hint) ? VALUES.email
        : meta.type === "password" ? VALUES.password : VALUES.text;
      await f.fill(v).catch(() => {});
    }
    await page.keyboard.press("Escape").catch(() => {}); // close any autocomplete popup opened by typing
    await page.waitForTimeout(400);
    typed[name] = await page.evaluate(() => {
      return [...document.querySelectorAll("input")].filter((e) => e.offsetParent).map((e) => {
        const s = getComputedStyle(e);
        // inputs draw their value with the same bidi rules as text; a spaced phone in an RTL input is drawn
        // reversed in all three engines (evidence/lab/input-text-phone.*.png)
        const phoneValue = /^\+?\d[\d\s-]{6,}\d$/.test(e.value);
        return {
          type: e.type, name: e.name || e.id, value: e.value.slice(0, 40), direction: s.direction, dirAttr: e.getAttribute("dir"),
          inputMode: e.inputMode || null, autoComplete: e.autocomplete || null,
          phoneDrawnReversed: phoneValue && s.direction === "rtl" && /\s/.test(e.value),
        };
      });
    });
    await page.screenshot({ path: path.join(outDir, `typed-${name}.png`), fullPage: true });
    // re-run the icon/text overlap probe with the typed values in place
    const probe = fs.readFileSync(path.join(here, "probe-inputs.mjs"), "utf8");
    const fnSrc = probe.slice(probe.indexOf("function measureInputs()"), probe.indexOf("\nconst browser"));
    typed[`${name}Overlap`] = await page.evaluate(`(${fnSrc.replace("function measureInputs()", "function ()")})()`);
    await page.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(outDir, "typed.json"), JSON.stringify(typed, null, 1));
  // bilingual tasks: click the language switch and check the page really changes language and direction
  if (process.env.LANGSWITCH) {
    execSync(`node "${path.join(here, "probe-langswitch.mjs")}" "${url}" "${path.join(outDir, "lang")}"`, { stdio: "pipe" });
  }
  console.log("graded", runDir);
} finally {
  if (process.platform === "win32") execSync(`taskkill /pid ${server.pid} /T /F`, { stdio: "ignore" });
  else server.kill();
}
