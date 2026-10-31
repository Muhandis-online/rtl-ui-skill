// Lay pairs of report crops side by side on one page and screenshot it, to check them in one look.
//   node harness/contact-sheet.mjs <img-dir> <out.png> name1 name2 ...   (each name has -base.png and -skill.png)
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
const [, , dir, out, ...names] = process.argv;
const img = (f) => `data:image/png;base64,${fs.readFileSync(path.join(dir, f)).toString("base64")}`;
const rows = names.map((n) => `<tr><td>${n}</td><td><img src="${img(n + "-base.png")}"></td><td><img src="${img(n + "-skill.png")}"></td></tr>`).join("");
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1500, height: 800 } });
await p.setContent(`<style>body{font:13px sans-serif;margin:8px}td{border:1px solid #ccc;padding:4px;vertical-align:top}img{max-width:640px;max-height:170px}</style><table><tr><th></th><th>baseline</th><th>skill</th></tr>${rows}</table>`);
await p.screenshot({ path: out, fullPage: true }); await b.close();
