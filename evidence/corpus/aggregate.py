"""Count measurable RTL defects across rendered live sites.

    python evidence/corpus/aggregate.py <renders>/facts.jsonl

A site counts only if it rendered real Arabic content (MIN_ARABIC elements on desktop). Each defect is defined
from measured facts, never from source patterns; the definitions are printed with the counts.
"""
import json
import re
import sys
from collections import Counter

MIN_ARABIC = 10  # fewer Arabic text elements than this is a failed render, a login wall or an English site
GENERIC = {"serif", "sans-serif", "monospace", "cursive", "fantasy", "system-ui", "ui-sans-serif", "ui-serif",
           "ui-monospace", "-apple-system", "blinkmacsystemfont", "emoji", "math", "fangsong"}
PHONE = re.compile(r"^\+?\d[\d\s-]{6,}\d$")


def families(decl):
    return [f.strip().strip("'\"").lower() for f in decl.split(",")]


def defects(site):
    d, m = site.get("desktop") or {}, site.get("mobile") or {}
    out = {}
    out["root-not-rtl"] = d.get("bodyDirection") != "rtl"
    ltr_share = d["arabicLtr"] / d["arabicElements"]
    out["arabic-text-laid-out-ltr (>25% of Arabic elements)"] = ltr_share > 0.25
    # fallback font: the font that drew most of the Arabic-only text is not one the page named. Spaces and
    # punctuation are drawn by the first listed font even when it has no Arabic, so judge by the majority.
    glyphs = d.get("renderedGlyphsByFont") or {}
    declared = set()
    for decl in (d.get("declaredFontFamily") or {}):
        declared.update(f for f in families(decl) if f not in GENERIC)
    if glyphs:
        top = max(glyphs, key=glyphs.get).lower()
        out["arabic-drawn-in-fallback-font"] = not any(dec in top or top.startswith(dec) for dec in declared)
        site["_topFont"] = top
    phones = [t for t in (d.get("tokens") or []) + (m.get("tokens") or []) if PHONE.match(t["token"])]
    out["phone-number-drawn-out-of-order"] = any(not t["inOrder"] for t in phones)
    out["phone-number-wraps-across-lines (mobile)"] = any(t["wrapsLines"] for t in (m.get("tokens") or [])
                                                           if PHONE.match(t["token"]))
    out["english-in-controls"] = len(d.get("englishControls") or []) > 0
    out["sideways-scroll-on-mobile"] = (m.get("horizontalOverflow") or 0) > 1
    out["row-reverse-inside-rtl (needs visual check)"] = (d.get("rowReverse") or 0) > 0
    sides = d.get("alignSides") or {}
    out["arabic-left-aligned (>25% of Arabic elements)"] = sides.get("left", 0) / d["arabicElements"] > 0.25
    dg = d.get("digits") or {}
    out["latin-and-arabic-indic-digits-mixed"] = dg.get("latin", 0) >= 5 and dg.get("arabicIndic", 0) >= 5
    icons = d.get("icons") or {}
    out["unmirrored-arrow-or-chevron (needs visual check)"] = any(
        k.endswith("as-drawn") and re.search(r"arrow-(left|right)|chevron-(left|right)", k) for k in icons)
    return out


def main(path):
    sites = [json.loads(l) for l in open(path, encoding="utf-8")]
    usable = [s for s in sites if (s.get("desktop") or {}).get("arabicElements", 0) >= MIN_ARABIC
              and not (s.get("desktop") or {}).get("error")]
    by_builder = Counter()
    counts = Counter()
    examples = {}
    for s in usable:
        for k, v in defects(s).items():
            if v:
                counts[k] += 1
                examples.setdefault(k, []).append(s["id"])
    n = len(usable)
    print(f"{len(sites)} sites rendered, {n} usable (>= {MIN_ARABIC} Arabic text elements)\n")
    for k, c in counts.most_common():
        print(f"{c:4d}/{n}  {100 * c / n:5.1f}%  {k}")
        print(f"            e.g. {', '.join(examples[k][:4])}")
    fonts = Counter()
    for s in usable:
        for f, g in ((s.get("desktop") or {}).get("renderedGlyphsByFont") or {}).items():
            fonts[f] += 1
    print("\nFonts that actually drew Arabic glyphs (sites):", fonts.most_common(12))


if __name__ == "__main__":
    main(sys.argv[1])
