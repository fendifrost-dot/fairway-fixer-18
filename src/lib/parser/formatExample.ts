/**
 * Format Example
 * 
 * Canonical format for ChatGPT imports.
 */

export function getFormatExample(): string {
  return `CLIENT PROFILE:
Name: John Smith
DOB: 1985-03-15
SSN Last 4: 1234
Issue Type: Identity Theft

COMPLETED ACTIONS:
2025-01-15 | LexisNexis | Freeze Request | Submitted via portal | Screenshot saved
2025-01-20 | Experian | Dispute Letter | Account XYZ | Certified mail #1234
2025-01-20 | All CRAs | Dispute Letter | Account ABC | Certified mail

RESPONSES RECEIVED:
2025-02-10 | Experian | Verified | No documentation provided | Account XYZ (****1234)
2025-02-15 | TransUnion | Deleted | Removed from report | -

OUTCOMES OBSERVED:
2025-02-15 | Innovis | Account Removed | 2 accounts deleted | -
2025-02-20 | Equifax | Score Increased | +45 points | -

OPEN / UNRESOLVED ITEMS:
Experian | Collection account | Disputed - awaiting response | ABC Collections | 2025-01-20
All CRAs | Fraudulent inquiry | Under investigation | Unknown creditor | 2025-01-15

SUGGESTED NEXT ACTIONS:
2025-02-25 | File CFPB Complaint | CFPB | High | Re: Experian violation
ASAP | Follow up letter | TransUnion | Medium | Second dispute

DOCUMENTS DRAFTED (NOT SENT):
2025-02-01 | Intent to Sue Letter | Experian | For 611 deadline violation

MISSING INFORMATION FLAGS:
2025-01-18 | Need copy of police report
2025-01-20 | Missing proof of mailing for TU dispute`;
}

export function getFormatSummary(): string {
  return `Format: Each section starts with a header followed by pipe-delimited rows.

HEADERS:
- CLIENT PROFILE: (name, dob, ssn, issue type)
- COMPLETED ACTIONS: DATE | SOURCE | TYPE | DETAILS | PROOF
- RESPONSES RECEIVED: DATE | SOURCE | STATUS | DETAILS | ACCOUNT
- OUTCOMES OBSERVED: DATE | SOURCE | OUTCOME | DETAILS | ACCOUNT
- OPEN / UNRESOLVED ITEMS: SOURCE | ITEM | STATUS | COUNTERPARTY | DATE
- SUGGESTED NEXT ACTIONS: DATE | TASK | ENTITY | PRIORITY | DETAILS
- DOCUMENTS DRAFTED: DATE | TYPE | TARGET | DESCRIPTION
- MISSING INFORMATION FLAGS: DATE | NOTE

SOURCES: Experian, TransUnion, Equifax, Innovis, LexisNexis, SageStream, CoreLogic, FTC, CFPB, BBB, AG
Use "All CRAs" for actions sent to all 3 bureaus (creates 3 events).

DATES: YYYY-MM-DD or "ASAP"/"Unknown" for pending items.`;
}
