# Handoff — CreditFlow: letters must incorporate client dispute history (not just the current report)

**For:** whoever is fixing CreditFlow **inside Lovable** (function logic + SQL — no standalone Supabase)
**App:** CreditFlow · https://fairway-fixer-18.lovable.app/ · client: Jamal Theodore Harris (`5ef6735a-48fc-4630-ad5c-af7c42152214`)
**Related handoffs (read together):** `CreditFlow_Analyzer_LetterQuality_Handoff.md` (Issue 2 follow-up framing, Issue 3 empty timeline), `CreditFlow_Analyzer_FTC_Reference_Handoff.md` (multi-FTC verification).

---

## The core problem
The analyzer drafts each letter as a **standalone "initial dispute"** built only from the report excerpt pasted in. It does **not** read the client's **prior disputes, bureau responses, or outcomes**, so the letters are structurally weak — they ignore the strongest facts in the file. For a client with a long paper trail like Jamal, an "initial" letter that omits the history reads as a first attempt and gives the bureau no reason to escalate its handling.

A strong complaint for this client should reference, per item: how many times it was disputed, when, what the bureau said, whether it was deleted and then **reinserted without the §611(a)(5)(B) notice**, whether it was "verified" with **no documentation produced**, that an **FTC Identity Theft Report has been on file since 01/07/2026**, and that **complaints have already been filed/queued** (CFPB, IL AG). None of that is in the current output.

## The history that exists on file but was ignored
(All present in this client's folder and/or scheduled events — the app should be sourcing this.)

- **Experian** disputes: 01.07.2026, 01.24.2026 (`Experians/…Experian Dispute 01.07.docx`, `…01.24.docx`)
- **TransUnion** disputes: 01.07.2026, 01.24.2026 (`TransUnion/…TransUnion Dispute - 01.07.docx`, `…01.24.docx`)
- **Equifax** disputes: 01.07.2026, 01.24.2026, **05.08.2026** (three rounds) (`Equifax/…Equifax Dispute - 01.07/01.24/05.08.docx`)
- **Goldman Sachs furnisher** direct dispute on the Apple Card (`Equifax/…Goldman Sachs Furnisher Dispute - 06.24.docx`)
- **LexisNexis** dispute + security freeze, 01.24.2026 (`LEXISNEXIS DISPUTE/…`)
- **Innovis** dispute + freeze, 01.24.2026 (`INNOVIS/…`)
- **CFPB** complaint filed 01.06.2026 (`CFPB/Screenshot 2026-01-06…png`)
- **FTC Identity Theft Report #195885587**, filed 01/07/2026 (`FTC/IDTheftReport_195885587.pdf`)
- **Scheduled-event timeline** (already in the app, right rail): "Mail updated dispute — Re: APPLE CARD fraudulent tradeline" (done 05.08); "File Complaint — If Equifax fails to delete within 30 days" (x2, done); "File Complaint — IL AG" (done); "Consider FCRA civil action — 15 U.S.C. 1681n / 1681o."

The Apple Card specifically was **disputed across multiple rounds, deleted, and then reinserted** — the single most powerful fact available, and it appears nowhere in the generated Equifax letter.

## Required behavior
1. **Ingest history.** Before drafting, the analyzer should load the client's prior dispute letters, bureau responses, and outcomes for the selected source (from the evidence timeline + stored documents). This is the same gap as Issue 3 ("Server matched 0 evidence rows" even though history exists) — fix the timeline load so history is actually available, then USE it.
2. **Weave history into the letter.** The draft should cite the dispute round count and dates, prior "verified/no documentation" responses, any delete-then-reinsert event, the FTC report filing date, and prior CFPB/AG complaints.
3. **Escalate the legal posture when history supports it:**
   - Reinserted-after-deletion item → **FCRA §611(a)(5)(B)** (written notice within 5 business days + furnisher recertification); demand proof or deletion.
   - "Verified" with no documents across multiple rounds → challenge the **reasonableness of the reinvestigation (§611)** and note furnisher obligations (§623).
   - Repeated failures + FTC report on file → signal **willful noncompliance (§1681n)** and that CFPB/AG complaints are filed/forthcoming.
4. **Letter-mode logic should follow the history,** not an operator guess: if prior disputes exist for the item/source, it is **not** an initial letter — it's a follow-up/escalation, and the framing must be accurate (ties to Issue 2).

## Current dispute letter details (so next session has them)
These are the letters generated 06/24–06/25/2026 and saved to the client file + bureau folders. They are **correct on targeting but thin on history** — they are the baseline to upgrade.

**Experian — §605B unauthorized inquiries** (`Experians/Jamal_Harris_Experian_Dispute_605B_06-24-2026.docx`)
- Items: JPMCB CARD (Chase) 02/23/2026; NORTHSTAR LEASING INC 02/20/2026; AMERICAN EXPRESS 05/15/2025 — all flagged fraudulent (Amex confirmed unverified, not a real account).
- Basis: §605B identity-theft block; FTC report referenced.
- Gap: no mention of prior Experian disputes (01.07, 01.24) or escalation history.

**TransUnion — §605B unauthorized inquiry** (`TransUnion/Jamal_Harris_TransUnion_Dispute_605B_06-24-2026.docx`)
- Item: JPMCB CARD (Chase) 02/23/2026.
- Basis: §605B; FTC report referenced.
- Gap: no mention of prior TU disputes (01.07, 01.24).

**Equifax — §605B Apple Card block** (`Equifax/Jamal_Harris_Equifax_AppleCard_605B_06-24-2026.docx`)
- Item: APPLE CARD — GS BANK, acct 120001XXXXXXXXXX, charge-off/closed by grantor.
- Basis: §605B identity-theft block (opened by thief per FTC report) + accuracy challenge.
- **Biggest gap:** omits that this tradeline was disputed in three prior rounds (01.07, 01.24, 05.08), was **deleted and then reinserted**, and that complaints were filed when it wasn't removed. The reinsertion/§611(a)(5)(B) and willful-noncompliance angles are missing entirely.

**Also on file (earlier 06.24 set, same day):** `…Experian Inquiries 605B - 06.24.docx`, `…TransUnion Inquiry 605B - 06.24.docx`, `…Equifax Apple Card 605B Block - 06.24.docx`, `…Goldman Sachs Furnisher Dispute - 06.24.docx`. Some predate the "Amex is fraudulent" correction and may treat Amex as authorized — reconcile/supersede when upgrading.

## Mailing gate (carry forward)
- Equifax (Apple Card) and the Amex inquiry are backed by the current FTC report and are mailable.
- Chase (02/23/26) and Northstar (02/20/26) postdate the 01/07/2026 FTC report → need an **updated FTC report** listing them before the Experian/TransUnion letters mail.

## Definition of done
1. Analyzer loads prior letters/responses/outcomes for the selected source (timeline no longer returns 0 rows when history exists).
2. Generated letters cite the documented history (rounds, dates, verified-without-docs, reinsertion, FTC report date, prior complaints).
3. History unlocks the correct escalated basis (§611(a)(5)(B) reinsertion, §611 reasonableness, §1681n willful noncompliance) where facts support it.
4. Initial-vs-follow-up framing is driven by whether prior disputes exist, not a manual toggle.
5. Re-run Jamal's Apple Card (Equifax) and confirm the new draft references the multi-round + reinsertion history.
