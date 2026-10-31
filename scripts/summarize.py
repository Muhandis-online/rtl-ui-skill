"""One row per graded Phase B run, one column per defect from evidence/FINDINGS.md.

    python scripts/summarize.py ./graded

A cell is "x" when the defect was measured in that run, "." when it was checked and absent, "-" when the run had
nothing to check (no phone shown, no inputs, no directional icons).
"""
import json
import os
import re
import sys

PHONE = re.compile(r"^\+?\d[\d\s-]{6,}\d$")
BACK = re.compile(r"previous|prev\b|السابق|رجوع|العودة|عودة|back", re.I)
TOP = re.compile(r"الأعلى|top", re.I)
GENERIC = {"serif", "sans-serif", "monospace", "system-ui", "ui-sans-serif", "-apple-system", "blinkmacsystemfont"}


def wrong_arrows(icons):
    bad, checked = [], 0
    for i in icons or []:
        m = re.search(r"(arrow|chevron)-(left|right)$", i["name"])
        if not m or not i.get("label") or TOP.search(i["label"]):
            continue
        checked += 1
        points = m.group(2) if not i["flipped"] else {"left": "right", "right": "left"}[m.group(2)]
        should = "right" if BACK.search(i["label"]) else "left"
        if points != should:
            bad.append(f'{i["name"][7:]}:{i["label"][:20]}')
    return bad, checked


def row(run_dir):
    facts = json.loads(open(os.path.join(run_dir, "facts.jsonl"), encoding="utf-8").readline())
    typed = json.load(open(os.path.join(run_dir, "typed.json"), encoding="utf-8"))
    d, m = facts["desktop"], facts["mobile"]
    if d.get("error"):
        # the grader could not load the page (server not up): a grading failure, not a result; regrade the run
        raise RuntimeError(f"{run_dir}: page did not load in the grader: {d['error'][:80]}")
    cells = {}
    # the app itself crashed: no Arabic rendered and the page threw
    crashed = not d.get("arabicElements") and facts.get("desktopPageErrors")
    cells["page renders"] = f"x ({facts['desktopPageErrors'][0][:50]})" if crashed else "."
    cells["root rtl"] = "." if d.get("bodyDirection") == "rtl" else "x"
    glyphs = d.get("renderedGlyphsByFont") or {}
    declared = {f.strip().strip("'\"").lower() for decl in (d.get("declaredFontFamily") or {}) for f in decl.split(",")} - GENERIC
    top = max(glyphs, key=glyphs.get).lower() if glyphs else ""
    cells["arabic font drawn"] = "." if top and any(dec in top or top.startswith(dec) for dec in declared) else f"x ({top})"
    phones = [t for t in d.get("tokens", []) + m.get("tokens", []) if PHONE.match(t["token"])]
    cells["phone in text"] = "-" if not phones else ("x" if any(not t["inOrder"] for t in phones) else ".")
    tel_inputs = [i for v in ("desktop", "mobile") for i in typed[v] if PHONE.match(i["value"] or "")]
    cells["phone in input"] = "-" if not tel_inputs else ("x" if any(i["phoneDrawnReversed"] for i in tel_inputs) else ".")
    overlaps = [f'{i["type"]}' for v in ("desktopOverlap", "mobileOverlap") for i in typed[v] if any(h["textPx"] > 2 for h in i["hits"])]
    has_inputs = any(typed[v] for v in ("desktop", "mobile"))
    cells["text under icon"] = "-" if not has_inputs else (f"x ({','.join(sorted(set(overlaps)))})" if overlaps else ".")
    bad, checked = wrong_arrows(d.get("iconDetails"))
    cells["wrong arrow"] = "-" if not checked else (f"x ({'; '.join(bad[:2])})" if bad else ".")
    # the user's rule: emails, phone numbers, times and dates always sit in a left-to-right context
    # Native-reader rulings: phone numbers and emails read left to right and are isolated. A range (9:00 - 17:00,
    # 15-25) follows the Arabic sentence, start on the right, so isolating it is the defect. A single time or date is
    # drawn in order on its own; it fails only if it is actually drawn out of order. A value that is part of an Arabic
    # phrase ("10:30 مساءً") reads right to left and must stay unwrapped.
    RANGE = re.compile(r"\d\s*[-–]\s*\d")
    shown = [t for t in d.get("tokens", []) + m.get("tokens", []) if t.get("kind") in ("email", "phone", "time", "date")]
    pure = [t for t in shown if not t.get("mixed")]
    # phones and emails are judged by what the reader sees ("phone in text": drawn reversed), not by markup: an agent
    # may isolate with Unicode isolate characters, which the markup check cannot see
    ranges = [t for t in pure if t["kind"] in ("time", "date") and RANGE.search(t["token"])]
    forced = sorted({t["token"][:18] for t in ranges if t["isolated"]})
    cells["range forced LTR"] = "-" if not ranges else (f"x ({'; '.join(forced[:2])})" if forced else ".")
    singles = [t for t in pure if t["kind"] in ("time", "date") and not RANGE.search(t["token"])]
    reversed_ = sorted({t["token"][:18] for t in singles if not t["inOrder"]})
    cells["time/date drawn out of order"] = "-" if not singles else (f"x ({'; '.join(reversed_[:2])})" if reversed_ else ".")
    mixed = [t for t in shown if t.get("mixed")]
    wrapped_mixed = sorted({t["token"][:18] for t in mixed if t["isolated"]})
    cells["Arabic phrase wrapped LTR"] = "-" if not mixed else (f"x ({'; '.join(wrapped_mixed[:2])})" if wrapped_mixed else ".")
    punct = sorted({t["token"][:18] for t in shown if t.get("punctInside")})
    cells["punctuation inside LTR wrapper"] = f"x ({'; '.join(punct[:2])})" if punct else "."
    # Arabic text laid out in an LTR element, and Arabic placeholders in LTR fields (rule 4)
    ph = []
    ipath = os.path.join(run_dir, "inputs", "inputs.json")
    if os.path.isfile(ipath):
        for site in json.load(open(ipath, encoding="utf-8")):
            for pg in site["pages"]:
                ph += [i["placeholder"][:16] for i in pg["inputs"] if i["placeholderArabic"] and i["direction"] == "ltr"]
    arabic_ltr = d.get("arabicLtr") or 0
    bad = ([f"{arabic_ltr} el"] if arabic_ltr else []) + [f"ph:{p}" for p in sorted(set(ph))[:1]]
    cells["Arabic in LTR element"] = f"x ({'; '.join(bad)})" if bad else "."
    cells["letter-spacing on Arabic"] = f'x ({d.get("letterSpacing")})' if d.get("letterSpacing") else "."
    cells["italic on Arabic"] = f'x ({d.get("italic")})' if d.get("italic") else "."
    # not English UI: the language switch naming the other language, brand names, contact details with a name
    allowed = re.compile(r"^(English|EN|ENG|Instagram|WhatsApp|Facebook|LinkedIn|YouTube|TikTok|X|Twitter|Snapchat)$|"
                         r"\+?\d[\d\s-]{6,}\d|@", re.I)
    english = [t for t in d.get("englishControls", []) if not allowed.search(t.strip())]
    english = [t for t in english if re.search(r"[A-Za-z]{3,}", t) and not re.search(r"@|\.com|^[\dX+ -]+$", t)]
    cells["english in UI"] = f"x ({', '.join(english[:2])})" if english else "."
    cells["sideways scroll (mobile)"] = "x" if (m.get("horizontalOverflow") or 0) > 1 else "."
    sides = d.get("alignSides") or {}
    n_ar = d.get("arabicElements") or 0
    cells["Arabic left-aligned"] = "x" if n_ar and sides.get("left", 0) / n_ar > 0.25 else "."
    return cells


def condition(run):
    return "skill" if re.search(r"-s\d$", run) else "baseline"


def main(root):
    runs = sorted(d for d in os.listdir(root) if os.path.isfile(os.path.join(root, d, "typed.json")))
    rows = {r: row(os.path.join(root, r)) for r in runs}
    cols = list(next(iter(rows.values())).keys())
    print("| run | " + " | ".join(cols) + " |")
    print("|---|" + "---|" * len(cols))
    for r, cells in rows.items():
        print(f"| {r} | " + " | ".join(cells[c] for c in cols) + " |")
    # defect rate per condition: failed runs / runs where the check applied
    print("\n| check | baseline | skill |\n|---|---|---|")
    for c in cols:
        out = []
        for cond in ("baseline", "skill"):
            cells = [rows[r][c] for r in rows if condition(r) == cond and rows[r][c] != "-"]
            out.append(f"{sum(x.startswith('x') for x in cells)}/{len(cells)} failed" if cells else "n/a")
        print(f"| {c} | {out[0]} | {out[1]} |")


if __name__ == "__main__":
    main(sys.argv[1])
