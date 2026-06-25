# Handoff — CreditFlow / Credit Guardian Analyzer: letter-quality + workflow fixes

**For:** whoever is fixing CreditFlow **inside Lovable**
**App:** CreditFlow · https://fairway-fixer-18.lovable.app/ · client: Jamal Theodore Harris (`5ef6735a-48fc-4630-ad5c-af7c42152214`)
**Where the work happens:** This is a **Lovable** app. There is **no separate/standalone Supabase project to manage** — the edge functions and database (SQL) are edited and deployed from **inside Lovable** (Lovable's backend / SQL editor). All fixes below are Lovable edits (function logic + SQL), not external CLI deploys.
**Status:** The `analyze-bureau-response` edge function is now **working (returns 200)** — letter generation runs. These are the **content/workflow issues** found while running Jamal's three reports through it.

---

## Issue 1 — Inquiry / fraud disputes are not auto-targeted
When fed a full credit report, the analyzer only finds **account/tradeline** derogatories. It does **not** identify **unauthorized hard inquiries** as disputable.
- Example: uploading the clean Experian report produced a letter disputing *trivia* — a Chime "missing credit limit" and a Kikoff balance — and **ignored the two fraudulent inquiries** (Chase 02/23/26, Northstar 02/20/26) that are the actual dispute.
- Workaround used: manually pasting the inquiry scope into the bureau-text box, after which it drafted the correct §605B inquiry letter.
- **Fix:** parse the report's "Inquiries" section; let the operator flag inquiries as authorized/unauthorized; support an "inquiry dispute (FCRA §605B / identity theft)" letter type that does **not** require a tradeline.

## Issue 2 — Letters default to "follow-up" framing (accuracy risk)
The tool is a "Response Analyzer" and assumes a **prior dispute already occurred**, so it fabricates that premise even for an **initial** dispute. This is a factual inaccuracy.
- Verbatim from the generated TransUnion letter: *"TransUnion acknowledged my dispute regarding a specific unauthorized inquiry; however, the item remains on my credit file…"* and *"I have already provided an FTC Identity Theft Report."*
- If no prior dispute/response exists, these statements are false and undermine the letter.
- **Fix:** add an **Initial vs. Follow-up** mode. Initial = first-time dispute language (no "you previously acknowledged," no "already provided"). Only use follow-up language when there's a real prior action/response in the timeline.

## Issue 3 — Evidence timeline never loads (always "0 events")
Every generation showed **"Server matched 0 evidence rows for this source"** even though the client clearly has dispute history (the Scheduled Events list shows a prior "Mail updated dispute — Re: APPLE CARD fraudulent tradeline," IL AG complaint tasks, etc.).
- The letters therefore carry follow-up framing (Issue 2) with **no actual evidence behind it**.
- **Fix:** ensure the "Paste ChatGPT Update" / evidence-import actually writes rows the analyzer reads, and that prior actions/responses populate the per-source timeline so generated letters cite real history.

## Issue 4 — Generated letters are not persisted
Letters are **ephemeral**: generated one at a time, shown in an editable textarea, and **lost when you regenerate or switch source**. There's no "save letter to client file."
- This is why nothing could be saved to Jamal's file from a normal run.
- **Fix:** "Save draft to client" (store the generated letter + source + date on the client record), and/or have **Generate PDF** export all saved letters, not just the on-screen one.

## Issue 5 — No-placeholder guarantee + standing enclosures (operator standard)
Operator (Fendi) standard: **never** leave fill-in placeholders in a letter; if a value can't be inserted, omit it. ID/SS card + utility bill + FTC report are attached to **every** mailing by default, so they should **not** be itemized as "enclosures" inside the letter body.
- Current output mostly complies, but the **checklist** still says things like "insert the consumer's full SSN/DOB" — keep that in the operator checklist, never in the letter body.
- **Fix:** enforce no-placeholder output; drop enclosure lists from letter bodies; keep enclosure reminders in the checklist only.

---

## What currently works (don't regress)
- File upload + OCR/text extraction into the bureau-text box.
- The **Equifax / Apple Card** letter is strong out of the box (inconsistent multi-year charge-off vs. 30–120 markers, re-aging, reinvestigation + date-of-first-delinquency demand, real account number).
- Once given explicit inquiry scope, the §605B inquiry letters are correct.

## Definition of done
1. Inquiry disputes auto-detected from the report and selectable.
2. Initial vs. follow-up mode produces accurate framing (no false "previously disputed/provided").
3. Evidence timeline loads real history (no more "0 events" when history exists).
4. Generated letters can be **saved to the client file** and exported (PDF) as a set.
5. No placeholders in letter bodies; enclosures live only in the checklist.
