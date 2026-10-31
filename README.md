# rtl-ui: an agent skill for Arabic right-to-left interfaces

A skill for Claude (and other agents that read skill files) that makes Arabic interfaces render correctly, not
just compile. It is written for any UI technology: web, mobile or desktop. It covers the defects that real
AI-built Arabic apps ship with: phone numbers drawn backwards, text running under the icon in a password field,
Arabic falling back to a font nobody chose, components that stay left-to-right inside an RTL screen, arrows that
point backwards, English left in labels, and stretched or slanted Arabic.

Every rule in it traces to a defect that was measured on rendered pages, with the mechanism behind it. Nothing is
there because it sounded right.

## Does it work?

48 agent runs on six client-style jobs, Claude Haiku and Claude Sonnet, each job with and without the skill (v0.5),
graded on the rendered page in Chromium at desktop and phone width after typing realistic values into every field:

| | without the skill | with the skill |
|---|---|---|
| RTL defects | 29 | **7** |
| runs with no defect | 8 of 24 | **19 of 24** |
| Haiku / Sonnet | 19 / 10 | **6 / 1** |

Five of the seven remaining defects came from two of the skill's own rules. Both are corrected in the current
version (v0.7), checked in the browser lab and against a native Arabic reader's rulings, but not yet re-run with
agents. Fixing an existing Arabic site came out clean with or without the skill; the skill helps most on new
screens with forms and data, and on converting existing apps.

Full write-up with screenshot pairs: [`evidence/report.html`](evidence/report.html) (open it in a browser).
Evidence log: [`evidence/FINDINGS.md`](evidence/FINDINGS.md).

## Install

The skill is one file: [`skills/rtl-ui/SKILL.md`](skills/rtl-ui/SKILL.md).

- **Claude Code**: copy the `skills/rtl-ui` folder into `~/.claude/skills/` (all projects) or into your project's
  `.claude/skills/`.
- **Claude apps**: zip the `skills/rtl-ui` folder and upload it as a skill in Settings → Capabilities.
- **Other agents**: put the contents of `SKILL.md` where your agent reads its instructions.

## What it tells the agent

1. Set the direction once at the root of the UI, and set the direction of every UI kit component too.
2. Use a font that has Arabic letters, loaded for real, with a generic fallback.
3. Isolate phone numbers, emails and codes as left-to-right; leave ranges, single times and dates, and anything
   with an Arabic word in the sentence's right-to-left flow; keep punctuation outside the isolated value.
4. No Arabic text inside a left-to-right element (including placeholders of left-to-right fields).
5. Email, phone, password and code fields are left-to-right; an automatic-direction field stays right-to-left
   while empty.
6. An icon inside a field: reserve the space on the side the icon actually sits.
7. Arrows point the way the action goes ("next" points left).
8. No English left behind, including accessibility labels; a language switch's own label is the exception.
9. No letter-spacing and no italic on Arabic.
10. Render it and look before saying it is done.

## How it was built

The first version of this skill was written from experience and assumptions. It was deleted and rebuilt from
evidence:

1. **What breaks in production**: 72 live Arabic sites built with Lovable and v0, rendered and measured.
   English left in labels on 47%, Arabic in a fallback font on 22%, reversed phone numbers on 21%, wrong arrows on 15%.
2. **Why it breaks**: single-mechanism test pages rendered in Chromium, Firefox and WebKit (`harness/lab*.mjs`),
   tied to the Unicode bidi algorithm (UAX #9) and the HTML standard. Several popular "RTL rules" did not survive
   this step (letter-spacing does not break Arabic joins in current engines; uppercase does nothing to Arabic;
   emails inside Arabic text are not reordered).
3. **What a native reader accepts**: rulings from a native Arabic reader on what reads correctly, for example that
   a range like `9:00 - 17:00` must keep its start on the right.
4. **What Claude does without help, and with it**: agent runs graded by the same probes, repeated after each change.

## Reproduce the tests

```
cd harness && npm install && npx playwright install chromium firefox webkit
node harness/lab-charorder.mjs                     # see a phone number reversed in three engines
RUNS=/path/to/agent/runs bash scripts/grade_runs.sh t5-haiku-b1 t5-haiku-v5a
python scripts/score.py > evidence/results/scores.json
```

Task prompts are in [`evidence/tasks.md`](evidence/tasks.md), the test design in
[`evidence/TEST-PLAN.md`](evidence/TEST-PLAN.md). The three real apps used for the conversion tasks are public
GitHub repositories named there; their code is not included here.

## Limits

- Measured in browser engines only. The rules are stated by mechanism and should hold elsewhere, but nothing has
  been rendered on Flutter, .NET or native toolkits yet.
- Small samples: two runs per model, task and condition.
- Arabic only so far. Most of the mechanisms apply to Hebrew, Persian and Urdu, but none of that has been tested.
- In the tests the agent was told to read the skill; automatic triggering was not measured.

## License

MIT. Built by [Muhandis](https://github.com/Muhandis-online).
