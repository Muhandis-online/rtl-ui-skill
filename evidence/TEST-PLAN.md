# rtl-ui skill v0.5: full comparison test

## Question
Does skill v0.5 reduce the RTL defects an Arabic user sees, for the models that need it (Haiku, Sonnet), across
the jobs clients actually ask for? Opus and Fable are left out by the project owner's decision: they pass without it.

## Conditions
- **Baseline**: the agent gets the client prompt and the project, nothing else.
- **Skill**: the same, plus one line telling it to read `the frozen skill v0.5 (git history)` first.
- Models: Haiku, Sonnet. Two runs per model, task and condition.
- Every agent: works only in its own copy of the project, may run the production build, may not start a dev
  server (identical in both conditions).

## Tasks (prompts in `evidence/tasks.md`)
| id | kind | job | project |
|---|---|---|---|
| t4 | new build | Arabic landing page: phone, email, prices, slider, FAQ | own Vite + React + Tailwind 4 + shadcn starter |
| t5 | new build | Arabic sign-up form: phone, email, password with eye toggle, city search, price | same starter |
| t7 | new build | Arabic orders dashboard: table, order numbers, phones, dates, times, amounts, tabs, pagination, search, toast | same starter |
| t1 | convert | make a real English Lovable SaaS site Arabic | drewsephski/Hyper.AI-SaaS-Boilerplate |
| t3 | fix | fix a real Arabic Lovable site with measured defects | AbdelqaderSafi12/book-culture-hub |
| t6 | bilingual | add Arabic with a language switch, Arabic default | yashgondalia/lingofun-academy-diya |

## Reuse
Baseline runs from earlier phases used the identical prompt, project and rules, so they are reused:
t4/t5 baseline (2 per model, Phase B/D), t1 baseline (1 per model, Phase E), t3/t6 baseline (1 per model).
t1 skill v0.5 runs (2 per model) are reused. Earlier skill runs (v0.1, v0.3) are not: they used older skill text.
New runs: 30.

## Checks (automated, `harness/grade.mjs`, scored by `scripts/score.py`)
Each check is a defect measured on the rendered page at 1440 and 390 px, after typing realistic values into every
field. A check counts only where it applies (a page with a phone number, a field with an icon…).

| check | rule | how it is measured |
|---|---|---|
| root direction | 1 | computed direction of `<body>` |
| component left-to-right inside RTL | 1, 4 | Arabic text whose computed direction is ltr |
| Arabic font drawn | 2 | font Chromium actually used for Arabic glyphs vs the fonts the page named |
| LTR value not isolated | 3 | phone/email/time/date made of Latin and digits, not in an LTR context |
| Arabic phrase forced LTR | 3 | a value followed by an Arabic word inside an LTR wrapper |
| punctuation inside LTR wrapper | 3 | LTR wrapper whose text ends in punctuation inside Arabic text |
| reversed phone in text / input | 3, 5 | per-character positions / input direction with a spaced number |
| Arabic placeholder in LTR field | 4 | placeholder with Arabic in a field whose direction is ltr |
| text under an icon in a field | 6 | icon box overlapping the typed text box |
| arrow points the wrong way | 7 | final pointing direction (icon, flips on it and its ancestors) vs its label |
| English left in the UI | 8 | Latin-only labels, aria-labels, placeholders (language names, brands, contacts excepted) |
| letter-spacing on Arabic | 9 | computed letter-spacing on Arabic text |
| italic on Arabic | 9 | computed font-style on Arabic text |
| Arabic left-aligned | 1 | more than 25% of Arabic elements aligned to the left |
| sideways scroll on mobile | – | document wider than the 390 px viewport |
| language switch works (t6) | 1 | click the switch: lang/dir/text change; click back |

## Not covered
Native-reader judgement of the copy; non-browser engines; whether the skill triggers by itself; Opus/Fable.
