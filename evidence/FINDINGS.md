# Findings

Evidence log. Each finding says what was measured, where, and how often. Rules in the skill must point here.

## Phase A: live Arabic sites built with Lovable and v0 (rendered 2026-10-30)

Source: 371 GitHub repos found by code search (`evidence/corpus/find_candidates.py`), 138 with a live homepage,
**72 rendered real Arabic content** (≥ 10 Arabic text elements). Rendered in Chromium 141 at 1440 and 390 px
(`harness/render.mjs`), counted by `evidence/corpus/aggregate.py`. Raw data: `raw renders (not published) `.

| # | Defect (measured) | Sites | Notes |
|---|---|---|---|
| A1 | English text left in buttons, links, `aria-label`, placeholders | 34/72 (47%) | Mostly carousel `aria-label`s ("Next slide"), nav, form placeholders |
| A2 | Phone number drawn out of order inside RTL text | 15/72 (21%) | e.g. `+966 50 123 4567` drawn as `4567 123 50 966 +`. 2 sites hand-reversed the digits in the source to compensate |
| A3 | Arabic drawn in a font the page never chose | 16/72 (22%) | Three causes, see A3 below |
| A4 | Directional arrow points the wrong way | 11/72 (15%) | 23 of 102 labelled arrows/chevrons. See A4 below |
| A5 | Sideways scroll on mobile | 4/72 (6%) | needs visual check |
| A6 | `flex-row-reverse` inside RTL | 5/72 (7%) | needs visual check: may be deliberate |
| A7 | Latin and Arabic-Indic digits mixed on one page | 4/72 (6%) | |
| A8 | Root not RTL | 1/72 (1%) | AI builders set `dir="rtl"` when asked for Arabic. Selection bias: sampled by `lang="ar"` |

**A3, fonts.** Causes, from reading the source of the affected repos:
- v0's default layout loads `Geist` (`next/font/google`, `subsets: ["latin"]`) and no Arabic font is added: Arabic
  falls back to the OS font. When the font variable is used with no generic family, the fallback is the browser
  default **serif** (Times New Roman on Windows): seen on one surveyed site.
- `Inter` as the only named family (Lovable/shadcn default): OS fallback.
- An Arabic font named but never loaded (`Cairo` on one site, `Avenir Arabic` on another).
- Sites using only the system stack (6) also fall back; that is a choice, not necessarily a defect.

**A4, icons.** Most sites already pick `ArrowLeft` for forward actions ("اطلب الآن"): 79 of 102 labelled arrows
point correctly. The wrong ones: `ArrowRight`/`ChevronRight` on forward actions (7 sites), carousels left with LTR
prev/next (2 sites), and one **double flip**: `ChevronLeft` plus a flip on "التفاصيل" (one site). So "add
`rtl:rotate-180` to arrows" is wrong advice; the rule is about the direction the arrow ends up pointing.

### Common RTL QA claims, checked against the same 72 sites

Four claims from a typical RTL QA deck, tested with added probes (`render.mjs`: clipping, text over form controls,
header logo side, mobile menu edge; raw data `raw renders (not published) `).

| Claim | Measured | Verdict |
|---|---|---|
| Arabic labels overlap fields; fixed-height buttons clip longer Arabic | 1 site flagged for overlap, a false positive on inspection (invisible input). Clipping hits were `sr-only` labels or deliberate `line-clamp` (crops in `evidence/lab/clip-*.png`) | **Not seen** on these sites; few have forms. Test in Phase B task 5 |
| Layouts never truly flip: CTAs, nav, cards stay LTR | Logo on the right on 41 sites, on the left on 7 (24 undetected). Mobile menu: 9 open from the right, 27 full-width/dropdown, **0 from the left** | **Mostly not seen**; 7 sites with a left logo need a visual check |
| Directional icons still point the LTR way; "forward icons should be mirrored" | 15% of sites have a wrong arrow (A4), but 79/102 arrows are right because builders pick `ArrowLeft` directly; mirroring on top caused a backwards arrow | **Partly**: the defect is real, the "mirror it" advice is wrong |
| Mixed directionality: numbers, emails, Latin names | Phones reordered on 21% (A2, lab-confirmed). Emails not reordered (lab). English left in controls 47% (A1) | **Phones yes, emails no** |
| Edge screens (modals, tooltips, errors, empty states) expose the worst bugs | Not measurable on live sites without submitting real forms | **Untested**: Phase B, on local copies |

Open question for a native reader: a range like `15 - 25 يناير` (spaces around the hyphen) is laid out
differently from `15-25 يناير` (no spaces) under the bidi algorithm. Which one reads correctly?

## Lab: single mechanisms, three engines (`harness/lab.mjs`, `evidence/lab/`)

Chromium 141, Firefox 142, WebKit 26, text in Noto Sans Arabic inside `<html dir="rtl">`.

| Claim | Chromium | Firefox | WebKit | Verdict |
|---|---|---|---|---|
| Phone `+966 50 123 4567` in Arabic sentence is reordered | yes | yes | yes | **real** |
| Same phone alone in `<a href="tel:">`, no `dir` | yes | yes | yes | **real** |
| Local `050-123-4567` reordered (`4567-123-050`) | yes | yes | yes | **real** |
| `<span dir="ltr">` or `<bdi>` fixes it | yes | yes | yes | fix confirmed |
| Email in Arabic sentence reordered | no | no | no | not a defect in this form |
| Number followed by Arabic unit (`1,250 ريال`) reordered | no | no | no | not a defect |
| `letter-spacing` changes Arabic | ignored | stretches, joins kept | stretches, joins kept | does **not** break joins; taste only |
| `text-transform: uppercase` changes Arabic | no | no | no | no effect |
| `font-style: italic` changes Arabic | synthetic slant | slant | slant | visible; taste |

### Why some numbers break and others don't (`harness/lab-charorder.mjs`, per-character positions)

Identical in Chromium, Firefox and WebKit. Mechanism from UAX #9:
- W2: a European digit whose nearest preceding strong character is Arabic (AL) becomes an Arabic Number (AN).
- W4: a single `-` or `+` (ES) joins two European numbers into one run, but does not join Arabic numbers;
  spaces never join numbers. Separate number runs in an RTL paragraph are laid out right to left.

| Text | Drawn left to right | |
|---|---|---|
| `الجوال: 050-123-4567` | `4567-123-050` | broken: digits after Arabic become AN, `-` no longer joins |
| `050-123-4567` alone in an input | `050-123-4567` | fine: no Arabic before it, `-` joins EN |
| `+966 50 123 4567`, with or without Arabic around | `4567 123 50 966+` | broken: spaces never join |
| `من 15-25 يناير` and `من 15 - 25 يناير` | `25-15`, `25 - 15` | read right to left this is "15 … 25": native reader to judge |

Other values inside Arabic text (`harness/lab-charorder2.mjs`), same in all three engines:

| Text | Drawn | |
|---|---|---|
| URL, `SA03 8000 0000 …` IBAN, `ORD-2024-0012` | in order | starts with a Latin letter (strong L) |
| `2026/10/30`, `1,250.50` | in order | `/ : , .` are common separators (CS) and join numbers (W4) |
| `2024-0012`, `1234 5678` | `0012-2024`, `5678 1234` | hyphen/space between digit groups after Arabic |
| `10:00 - 12:00` | `12:00 - 10:00` | a range: native reader to judge |

### Inputs (`harness/lab-inputs.mjs`, `lab-input-phone.mjs`, `lab-input-text.mjs`)

Prompted by the project owner's field experience: "a lot of problems in input fields, placeholders and icons".

**Icon inside an input** (shadcn pattern: absolutely positioned icon + padding on the input), all three engines:

| Icon / padding | Result |
|---|---|
| `left-3` + `pl-10` (untouched LTR) | no overlap; icon sits at the end |
| `start-3` + `ps-10` (both logical) | correct |
| `start-3` + `pl-10` (icon converted, padding not) | **text drawn under the icon** (15 px) |
| `left-3` + `ps-10` (padding converted, icon not) | **long text runs under the icon** |
| `right-3` + `pr-10` (hand-flipped) | fine in RTL, wrong if the app gains LTR |

Overlap comes from a half-converted pair, not from leaving LTR code alone.

**Phone and email values in inputs**, page `dir="rtl"`, all three engines:
- `type="tel"`: drawn LTR and in order with no `dir`. Source: HTML Standard §15.3.5,
  `input[type=tel i]:dir(ltr) { direction: ltr; }`, and the directionality algorithm makes a `tel` input without
  `dir` LTR.
- `type="text"` holding `+966 50 123 4567`: drawn `4567 123 50 966+`. `dir="auto"` or `dir="ltr"` fixes it.
- `type="email"`: right-aligned, characters in order.
- One live sign-in page: the password eye toggle covers 15–19 px of the typing area (no padding on its
  side); a combined "phone or email" field is `type="text"`, so a typed phone number would be reversed.

### Inputs across the 72 live sites (`harness/probe-inputs.mjs`, `raw input measurements (not published) `)

Form pages visited read-only (`/`, `/login`, `/signup`, `/contact`, `/checkout`…), desktop and mobile.
40 sites have inputs (259 measured). On 4 of them (10%) a control sits inside the typing area; 12 of the 15 hits
are a **password show/hide button**. 14 inputs show an Arabic placeholder inside an LTR field (left-aligned):
native reader to judge.

## Phase B: Claude without a skill (2026-10-30)

Tasks and prompts: `evidence/tasks.md`. Each run: a clean Vite + React + Tailwind 4 + shadcn starter, one
agent, no skill (the project owner's environment has the `impeccable` design skill installed; t4-opus used it). Graded by
`harness/grade.mjs` (Phase A probes + typing realistic values into every input), scored by
`scripts/summarize.py`. t1, t2, t3 and t6 need third-party repos built locally and are not run yet.

| run | root rtl | Arabic font drawn | phone shown in text | phone typed in input | text under icon | wrong arrow | English in UI | sideways scroll |
|---|---|---|---|---|---|---|---|---|
| t4-haiku | ok | ok | **reversed** (hero button) | – | – | ok | ok | ok |
| t4-sonnet | ok | ok | ok (isolated) | – | – | ok | ok | ok |
| t4-opus | ok | ok | ok (isolated) | – | – | ok | ok | ok |
| t5-haiku | **wrapper only** | **fallback (Segoe UI)** | – | ok | **password** | – | ok | ok |
| t5-sonnet | ok | ok | – | ok (`type=tel`) | **password** | – | ok | ok |
| t5-opus | ok | ok | – | ok | ok | ok | ok | ok |

Process notes: the first t4-haiku run reported a finished page but had only edited `index.html` (rerun shown).
No agent rendered its page: Sonnet and Opus said so explicitly.

**B1: the password eye toggle.** 2 of 3 sign-up forms put the eye over the typed password; same defect class as
the corpus (12/15 input hits). Mechanism, from the source:
- Sonnet: `<Input dir="ltr" className="pe-11">` + button `absolute left-1`.
- Haiku: `<Input dir="ltr" className="pe-10">` + button `absolute end-0` (in the RTL wrapper).
- Opus (correct): `<Input dir="ltr" className="pl-11">` + button on the left.

A `dir="ltr"` input resolves its own logical padding against LTR (`pe` = right), while the button's logical
position resolves against the RTL wrapper (`end` = left). Logical classes on both sides still disagree. The working
rule is physical and local: in an LTR field, pad the side the icon is on.

**B2: phone shown in text.** t4-haiku isolated the footer phone (`dir="ltr"`) but not the hero call button:
drawn `4567 123 55 966+`. Sonnet and Opus isolated every occurrence.

**B3: font.** t5-haiku loaded no Arabic font; Arabic fell back to Segoe UI (Windows). Haiku also put `dir="rtl"` on
a wrapper `div` instead of `<html>`; portals (dialogs, popovers, toasts) then render outside it.

## Phase D: skill v0.1 against no skill (2026-10-30)

Same two tasks (t4 landing page, t5 sign-up form), Haiku, Sonnet and Opus. Baseline: 2 runs per model and task
(the Phase B run plus one more). Skill: 2 runs per model and task, each told to read the frozen
`the frozen skill v0.1 (git history)` first; prompts otherwise identical. 24 runs, all graded by the same probes
(`scripts/grade_all.sh`). A check counts only where it applied (a page with a phone, a field with an icon…).

| check | baseline | skill v0.1 |
|---|---|---|
| root `dir` on `<html>` | 2/12 failed | 0/12 |
| Arabic drawn in the chosen font | 2/12 failed | 0/12 |
| phone number reversed in text | 1/6 failed | 0/6 |
| text under an icon inside a field | 2/7 failed | 0/6 |
| arrow points the wrong way | 1/8 failed | 0/11 |
| phone reversed in an input | 0/5 | 0/6 |
| English left in the UI | 0/12 | 0/12 |
| sideways scroll on mobile | 0/12 | 0/12 |

- The 8 baseline failures: Haiku 7 (root ×2, font ×2, phone, password, arrow), Sonnet 1 (password). Opus failed
  nothing without the skill on these two tasks. With the skill, no model failed any check.
- One skill run (t4-opus-s1) rendered its own page with headless Chrome and checked it; no baseline run looked at
  its output. The other skill runs said they could not render (the prompt forbids a dev server) and listed the
  checks for the project owner, as rule 8 asks; most baseline runs did not mention rendering.
- English in the UI, phone in an input and sideways scroll never failed on fresh builds; their evidence is the
  corpus (A1 47%, inputs, A5), i.e. existing apps. Untested until the conversion tasks run.
- Small samples: 2 runs per cell. The direction is consistent (0 skill failures vs 8 baseline), not a rate.
- Grader fix during scoring: Tailwind 4 compiles `rotate-180` to the CSS `rotate` property, not `transform`; the
  icon probe first missed those flips and scored two correct Opus carousels as wrong. `render.mjs` now combines
  `transform`, `rotate` and `scale` on the icon and its ancestors; all landing pages were regraded.

## Phase E: converting real apps, skill v0.3 against no skill (2026-10-31)

Real Lovable apps, source copied onto our own Lovable-style starter and built with the project owner's permission:
t1 convert `drewsephski/Hyper.AI-SaaS-Boilerplate` to Arabic; t3 fix `AbdelqaderSafi12/book-culture-hub` (a live
Arabic site with measured defects); t6 add Arabic plus a language switch to `yashgondalia/lingofun-academy-diya`.
Haiku, Sonnet, Opus, 1 run each with and without `the frozen skill v0.3 (git history)`: 18 runs.

The untouched t3 app, built locally, reproduces the live-site measurements (Arabic in Segoe UI fallback,
letter-spacing on 10 Arabic elements, "Next slide"/"Previous slide"), so the copy behaves like the real site.

| check | baseline | skill v0.3 |
|---|---|---|
| root `dir`, Arabic font, phone/email/time, arrows, letter-spacing, italic, punctuation, sideways scroll | 0 failures | 0 failures |
| Arabic in an LTR element | 3/9 | 2/9 |
| English left in the UI | 2/9 | 1/9 |
| language switch flips `lang`/`dir` and text (t6) | 3/3 work | 3/3 work |

- **t3 (fix a broken Arabic site): all 6 runs clean in both conditions.** Every model, with or without the skill,
  added an Arabic font, removed the letter-spacing, translated the English carousel labels and isolated the
  publishers' phone numbers. The skill adds nothing measurable here.
- **E1, Radix `dir="ltr"`: 4/6 t1 runs failed in both conditions (Haiku, Sonnet).** Hyper.AI's header nav is a
  Radix `ToggleGroup`; without `DirectionProvider` Radix stamps `dir="ltr"` on it, so the Arabic nav links are laid
  out left to right. Only Opus (both conditions) added `DirectionProvider`. Skill v0.3 did not cover this.
  Lab (`harness/radix-dir.mjs`, current shadcn/Radix): without a provider, `ToggleGroup`, `Tabs`, `RadioGroup`,
  `NavigationMenu` and `Slider` stamp `dir="ltr"` on an RTL page; `Accordion` does not. Rule added in v0.4.
- **E2: an Arabic name inside the phone's `dir="ltr"` wrapper** (`+91 7045 5959 90 (ديا واذوانا)`, t6-haiku-b1):
  the rule-4 case; covered by the skill.
- **E3: English `aria-label` on the language switch** ("Switch to English" on an Arabic page): t6 opus-b1,
  haiku-b1, sonnet-s1. A screen reader reads it in English to an Arabic user.
- Prices: every t1 run kept "$99" (some as "99 دولار") and asked the owner about riyals. Owner decision, not graded.
- Probe fixes made while grading: the language-switch probe first clicked course tabs labelled "English" and a
  switch hidden in a closed off-screen drawer; it now searches the header and opens the menu when the switch is
  off-screen. The mobile switch back to Arabic stays untested (the menu closes after switching).
- Two skill runs (t1-opus-s1 and Phase D t4-opus-s1) rendered their own pages in headless Chromium; no baseline
  run did.

## v0.5: stack-agnostic rewrite (2026-10-31)

At the project owner's request the skill no longer names any stack (it is meant for web, C#, Flutter, Rust…). Rules are
stated as rendered behaviour plus mechanism; isolation uses Unicode isolates. Lab (`harness/lab-isolates.mjs`):
`U+2066` … `U+2069` around `+966 55 123 4567` and `10:00 - 12:00` inside Arabic text draws them in order in
Chromium, Firefox and WebKit, and a dot placed after the closing isolate lands at the end of the Arabic line.

Verification scope: every rendered measurement in this file comes from browser engines (Chromium 141, Firefox
142, WebKit 26). The bidi rules (3, 4, 5) follow from UAX #9, which other engines implement; layout rules (1, 6)
are stated by mechanism. None of it has been rendered on Flutter, .NET or native toolkits yet.

### v0.5 against the Radix nav defect (E1), Haiku and Sonnet only (2026-10-31)

Same t1 task, same prompt, frozen `the frozen skill v0.5 (git history)` (stack-agnostic: it never names Radix or
`DirectionProvider`; rule 1 only says component libraries keep their own direction setting that defaults to LTR).
Opus was left out at the project owner's request: it passed without the skill.

| condition | runs with the Arabic nav laid out LTR | all other checks |
|---|---|---|
| no skill | 2/2 (Haiku, Sonnet) | clean |
| skill v0.3 | 2/2 | clean |
| skill v0.5 | **0/4** | clean |

How the v0.5 runs fixed it, from the general wording alone: both Sonnet runs wrapped the app in Radix
`DirectionProvider`; both Haiku runs set `dir="rtl"` on each Radix component instead (`ToggleGroup`, `Tabs`,
`Accordion`). Both work in the rendered page. Small sample (2 runs per model); the direction is clear.

## Phase F: full comparison, skill v0.5 (2026-10-31)

Plan: `evidence/TEST-PLAN.md`. Six tasks (t4, t5, t7 new; t1, t3, t6 real apps), Haiku and Sonnet, 2 runs
per model, task and condition: 48 runs (30 new). Scores: `evidence/results/scores.json` (`score.py`). Report with
screenshots: `evidence/report.html`.

| | no skill | skill v0.5 |
|---|---|---|
| defects (all checks, all runs) | 32 | 6 |
| runs with no defect | 7/24 | 19/24 |
| Haiku / Sonnet | 21 / 11 | 4 / 2 |
| by task t4 / t5 / t7 / t1 / t3 / t6 | 4 / 8 / 9 / 4 / 0 / 7 | 0 / 1 / 4 / 0 / 0 / 1 |

- **Correction after native review (same day).** The project owner flagged the opening-hours pair: the skill's isolated
  `9:00 - 17:00` (9:00 on the left) is the failure; the plain range (9:00 on the right) reads correctly. Ranges of
  times, dates or numbers stay in the RTL flow (v0.7 rule 3). Rescored: **29 → 7 defects, clean runs 8 → 19 of 24,
  Haiku 19 → 6, Sonnet 10 → 1**. The markup-based "phone/email not isolated" check was dropped: it missed Unicode
  isolate characters; phones are judged by whether they are drawn reversed. 5 of the 7 skill-side defects came from
  two skill rules (rule 3 ranges ×2, rule 5 auto-direction placeholder ×3), both corrected in v0.7, not re-run.
- **F1, a defect the skill caused.** v0.5 rule 5 says a general field that may receive a phone number gets
  automatic direction. An empty automatic-direction field is LTR (Chromium, Firefox, WebKit:
  `harness/lab-auto-placeholder.mjs`), so its Arabic placeholder is laid out LTR: 3 of 4 t7 skill runs. v0.6 adds:
  keep the field RTL while it is empty. Lab-verified; not re-run with agents.
- Other skill-side defects: a Radix-style status dropdown left LTR (agent set direction on tabs only), a font
  import the browser ignored, a search icon without the matching inset, dates joined by `/` not isolated (v0.5 text
  says they draw correctly, which softens the isolate instruction).
- t3 (fix an Arabic site): 0 defects in all 8 runs, both conditions.
- A baseline run crashed on load (React `useContext` of null): new "page renders" check.
- Grading lessons: running grading batches in parallel caused port collisions (`ERR_CONNECTION_REFUSED`) that
  looked like defects; the scorer now refuses a run whose page failed to load in the grader.

## For the project owner to judge (native reader)

- Stretched Arabic under letter-spacing in Firefox/Safari: `evidence/lab/letter-spacing-zoom.*.png`
- Synthetic italic: `evidence/lab/uppercase-italic.*.png`
- A5/A6 screenshots: listed in `aggregate.py` output
