---
name: rtl-ui
description: Builds and fixes Arabic right-to-left interfaces so they render correctly, not just compile, in any UI technology (web, mobile, desktop). Covers the defects measured in real Arabic apps: phone numbers and times drawn in reverse, punctuation landing at the start of a line, text running under icons in password and search fields, Arabic falling back to a font nobody chose, components that stay left-to-right inside an RTL screen, arrows pointing backwards, English left in labels, and stretched or slanted Arabic. Use when writing or changing any screen, component or form whose interface is in Arabic, when making an app Arabic or bilingual, and for requests written in Arabic (عربي، واجهة بالعربي، اتجاه من اليمين لليسار).
---

# Arabic RTL interfaces

Each rule fixes a defect measured in rendered screens, with the mechanism behind it. Most of these pass code
review and still look broken, so check every rule on the rendered screen, not in the source.

## 1. Direction set once, at the top, and passed to every component
Set the interface language to Arabic and the layout direction to right-to-left at the root of the UI (the
document, window or app), or from the active language in a bilingual app. Not on an inner container: dialogs,
popovers, menus, toasts and other overlays are usually drawn outside it and come out left-to-right.

Component libraries often keep their own direction setting that defaults to left-to-right and ignores the
screen around them. A navigation bar, tab strip, segmented control, radio group or slider from such a library
then lays its items out left to right (the first item on the left) and its arrow keys run backwards, inside an
otherwise RTL screen. Find the library's direction setting and set it to RTL as well.

## 2. A font that has Arabic letters
Many Latin fonts have no Arabic glyphs, so the system draws Arabic in whatever font the device has, and it
differs per device. When no generic family follows, the fallback can be a serif font. Put an Arabic font first,
make sure its Arabic glyphs are actually bundled or loaded, and end with a generic sans-serif fallback.
Check: inspect which font actually drew an Arabic word.

## 3. Values that read left to right
Decide per value, by what it contains:
- **Only Latin letters, digits and separators**: an email, URL, phone number, an order or account number.
  Isolate it as left-to-right everywhere it is shown: headers, buttons, cards, footers, tables, tooltips. One
  unisolated copy is enough to show it reversed.
- **A range**: `9:00 - 17:00`, `15-25`, `100 - 200`, with or without an Arabic word around it. It reads right to
  left with the sentence, start on the right: leave it alone. Isolating it draws the start on the left, which an
  Arabic reader reads backwards.
- **A single time or date in digits**: `17:00`, `2026/10/30`. Drawn in order without isolation; leave it alone.
- **Contains an Arabic word**: `10 ريال`, `15 سبتمبر`, `10:30 مساءً`, `من 15-25 يناير`. It reads right to left
  with the sentence: leave it alone. Forcing it left-to-right draws `ريال 10` and `سبتمبر 15`.
- **Punctuation stays outside the isolated value**: isolating `info@nakhla.sa.` with its final dot draws the dot
  between the email and the word before it.

How to isolate: use the toolkit's own isolation or direction override for that span if it has one; otherwise
wrap the value in the Unicode isolates of the bidi algorithm: `U+2066` (LEFT-TO-RIGHT ISOLATE) + value +
`U+2069` (POP DIRECTIONAL ISOLATE). Either way the punctuation goes after the closing isolate. Isolates are part
of UAX #9 since Unicode 6.3; on an engine you have not checked before, confirm once by rendering a phone number.

Why plain-looking text breaks: in the Unicode bidi algorithm (UAX #9, rule W2), digits that follow an Arabic
letter count as Arabic numbers, and spaces and hyphens no longer hold them together. `+966 55 123 4567` is drawn
`4567 123 55 966+` and `050-123-4567` as `4567-123-050`, even alone in a link or button. The same mechanism lays a
range out right to left (`9:00 - 17:00` with `9:00` on the right), which is the order an Arabic reader expects.
Values that start with a Latin letter (URLs, emails, `SA03 8000 …` IBANs, `ORD-2024-0012`) and digits joined only
by `/ : , .` are drawn correctly; isolating them is harmless.

## 4. No Arabic text inside a left-to-right element
Arabic laid out in an element whose direction is left-to-right is aligned to the wrong side and its final `.`
`!` `؟` is drawn at the start of the line (`.مرحباً بك في متجرنا`). Common sources: an Arabic word or name kept
inside the isolated value of rule 3, a component that forces left-to-right, and the placeholder or hint of a
left-to-right field. For email, phone and password fields, make the placeholder the example value
(`name@example.com`, `05XXXXXXXX`) and put Arabic hints in the label or helper text.

## 5. Fields that hold left-to-right values
Email, phone, password, URL, code and number fields take left-to-right text direction, so typed values read
correctly. A general text field that may receive a phone number or email (for example "phone or email") needs
left-to-right or automatic direction as well; otherwise a typed `+966 50 123 4567` is shown reversed.
An automatic-direction field is left-to-right while it is empty, so its Arabic placeholder is laid out
left-to-right. Keep such a field right-to-left while it is empty and let the automatic direction apply once text
is typed (or put the Arabic hint in the label instead of the placeholder).

## 6. Icons inside a field: reserve space on the side the icon is on
A field set to left-to-right measures its own start and end in left-to-right terms, while an icon or button
placed by the surrounding RTL layout measures them in right-to-left terms. "End" then means the right side for
the field's text inset and the left side for the icon, and the typed text runs under the icon (a password under
its show/hide button). Direction-relative spacing on both does not prevent this.
- Either reserve the inset on the physical side where the icon actually sits,
- or put the field and its icon in one container with the same direction, so start and end agree.

Applies to every icon, button or prefix drawn inside a field: password show/hide, search icon, clear button,
country-code prefix. Check: type a long value (a 25-character password, a long name) and look at both ends.

## 7. Arrows point the way the action goes
Choose the direction an arrow must finally point, then the icon:
- Forward, next, "start", "book now", "read more": points left.
- Back, previous: points right.
Either use the left-pointing icon or mirror a right-pointing one for RTL, never both: mirroring an icon already
chosen for RTL makes it point backwards. Carousel and pager controls follow the same rule: "next" points left.

## 8. No English left behind
Translate what the eye does not see first: accessibility labels, screen-reader-only text, placeholders, tooltips,
carousel and pager control labels ("Next slide", "Previous slide"), toasts, empty states and validation
messages. Format examples such as `5XXXXXXXX` and `name@example.com` can stay. A language switch is the one
control where Latin text is right: its visible label names the other language ("English"), but its accessibility
label is in the screen's language ("التبديل إلى الإنجليزية"), since a screen reader reads it to an Arabic user.

## 9. No letter-spacing and no italic on Arabic
- Remove letter-spacing (tracking) from anything that can hold Arabic: headings, buttons, badges, labels. Some
  rendering engines pull Arabic letters apart to apply it, others ignore it, so it can look fine where you
  develop and break on the user's device.
- No italic on Arabic, including quote and citation styles. Arabic has no italic; engines slant the letters
  artificially. Show emphasis with weight or color instead.

## 10. Render it before you say it is done
Run the screen and look at it at a phone width and a desktop width. Look at: every email, phone number, time and
date; a long value typed into every field that has an icon; the font Arabic is drawn in; each arrow next to its
label; the order of items in navigation bars, tabs and segmented controls; menus, dialogs and the language
switch. If you cannot render it, say so and list these checks for the person instead of reporting it finished.

## Not problems (tested, leave them alone)
- Uppercase transforms have no effect on Arabic.
- URLs, IBANs that start with letters and codes like `ORD-2024-0012` are drawn in order without isolation.
