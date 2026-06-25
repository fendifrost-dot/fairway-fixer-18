# Handoff — CreditFlow: verified FTC-report referencing (and stop fabricating numbers)

**For:** whoever is fixing CreditFlow **inside Lovable** (function logic + SQL — no standalone Supabase)
**App:** CreditFlow · https://fairway-fixer-18.lovable.app/ · client: Jamal Theodore Harris (`5ef6735a-48fc-4630-ad5c-af7c42152214`)
**Trigger:** A generated Experian §605B letter's checklist said *"FTC Identity Theft Report (ending 0233)."* The client has **no** report ending 0233.

---

## What we verified
- Jamal's file contains **one** FTC Identity Theft Report: `IDTheftReport_195885587.pdf`.
- The number printed inside the PDF and in the filename is **195885587** (ends **5587**), filed **01/07/2026**.
- **"0233" matches nothing** in his file → the analyzer **invented** an FTC reference number. This violates the operator's no-placeholder / no-fabrication standard: the app must **never** generate, guess, or mask-with-fake-digits any identifier.

## Two problems to fix

### Problem 1 — App fabricates the FTC report number
The letter/checklist should cite the FTC report number **only** from a verified stored value. If no verified FTC report is on file for the client, the output must say so plainly (e.g., "Enclose the client's FTC Identity Theft Report") with **no invented number** — never "(ending 0233)".

### Problem 2 — No way to store / verify / pick the right FTC report when a client has several
Clients commonly file **multiple** FTC reports over time as new fraud or new inquiries appear. There is currently no structured place for them, so the app can't cite the correct one. Build:

1. **FTC reports table** on the client record. Per report store: `ftc_report_number`, `filed_date`, `file_attachment`, and the **items it covers** (accounts + inquiries, with dates), plus a `superseded` / `is_current` flag.
2. **Operator selects which FTC report backs a given letter** (default = most recent by `filed_date`), and the letter cites *that* number.
3. **Coverage validation (important).** When the letter disputes an inquiry/account as identity theft, the app should check it against the selected FTC report's covered items and **warn** when:
   - the disputed item is **not listed** on the selected report, or
   - the disputed item's **date is after** the report's `filed_date` (it couldn't be on it) — prompt: "this item postdates the FTC report; file an updated report before mailing."

## Why this is urgent (live example on this client)
The current FTC report (#195885587, **01/07/2026**) lists the unauthorized **inquiries** as **NASA Federal Credit Union (06/10/2025)** and **American Express (05/15/2025)**, and the fraudulent **accounts** as **Apple Card – GS Bank** and **Contract Callers Inc**.

But the analyzer's Experian letter disputes **JPMCB/Chase (02/23/2026)** and **Northstar Leasing (02/20/2026)** as identity theft and tells the bureau to **keep Amex**. That:
- cites inquiries **not on** the FTC report,
- cites inquiries **dated after** the report was filed, and
- **keeps** an inquiry (Amex) the report itself calls fraudulent.

A §605B block built on a report that doesn't list the disputed items will be rejected — and mailing it asserts facts the sworn report contradicts. The coverage-validation feature above would have caught all three.

## Definition of done
1. No invented identifiers anywhere in letters/checklists; FTC numbers come only from a stored, verified value.
2. Client record holds multiple FTC reports with number, filed date, attachment, covered items, and a current/superseded flag.
3. Operator can pick the backing report (defaults to most recent); the letter cites that exact number.
4. Coverage validation warns when a disputed item isn't on, or postdates, the selected FTC report.

---
## Operator action items (separate from the app fix — for Fendi)
- **Amex — RESOLVED:** the Amex inquiry (05/15/2025) is **fraudulent/unverified** (does not match any real Amex account Jamal holds). Dispute it; the FTC report correctly lists it as fraudulent. The analyzer was accurate here.
- **Updated FTC report needed.** Jamal's current report (#195885587, 01/07/2026) predates Chase (02/23/2026) and Northstar (02/20/2026). Have him **file an updated FTC Identity Theft Report** scoped to: the **fraudulent inquiries** (Chase, Northstar, American Express, and NASA Federal if still showing) **+ the Apple Card – GS Bank account**. The other accounts on the old report (Contract Callers Inc / Commonwealth Edison) are **already deleted** and should be dropped from the new report.
- Mail §605B inquiry letters only after the updated report lists the inquiries being disputed.
- Confirm whether a **prior FTC report ending 0233** actually exists unfiled; if not, treat "0233" purely as an app fabrication (Problem 1).
