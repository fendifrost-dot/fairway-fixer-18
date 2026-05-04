/**
 * Row Parsers
 * 
 * Deterministic parsing for each entity type.
 * Returns structured data or null (never silently defaults).
 */

import { 
  TimelineEventParsed, 
  UnresolvedItem, 
  ScheduledEvent, 
  DraftItem,
  NoteFlag,
  EventKind,
  UnresolvedItemType,
  NormalizedSource,
} from '@/types/parser';
import { parseDate, extractDueText } from './dateParser';
import { normalizeSource, detectScope } from './sourceNormalizer';
import { detectFurnisher, extractAccountLast4 } from './furnisherDetector';
import { detectAttachmentsInText } from '@/lib/attachmentDetector';

/**
 * Detect a [Tradeline: "Display name"] anchor anywhere in the raw line.
 * Returns { displayName, strippedLine } where strippedLine has the tag removed
 * (so downstream pipe parsing isn't disturbed). Match is non-greedy and
 * tolerates straight or curly quotes.
 */
export function detectTradelineAnchor(rawLine: string): { displayName: string | null; strippedLine: string } {
  const re = /\[\s*Tradeline\s*:\s*["“]([^"”]+)["”]\s*\]/i;
  const m = rawLine.match(re);
  if (!m) return { displayName: null, strippedLine: rawLine };
  return {
    displayName: m[1].trim(),
    strippedLine: rawLine.replace(re, '').replace(/\s{2,}/g, ' ').trim(),
  };
}

/**
 * Split a pipe-delimited line into parts
 */
export function splitPipeLine(line: string): string[] {
  return line.split('|').map(p => p.trim());
}

/**
 * Parse a Timeline Event row.
 * Format: DATE | SOURCE/ENTITY | TYPE/STATUS | DETAILS | ACCOUNT_REF
 * 
 * Returns null if source cannot be determined (routes to unrouted).
 * Expands "All CRAs" into 3 separate events.
 */
/**
 * Detect FTC Identity Theft Report from content.
 * When FTC Identity Theft Report is created/filed online, it must be source='FTC'.
 * This is deterministic: creation online = filed = action.
 * 
 * STRICT RULE: Requires EXPLICIT FTC indicator (not generic "identity theft report").
 */
function detectFTCIdentityTheftReport(rawLine: string, typeOrStatus: string, details: string): boolean {
  const fullText = `${rawLine} ${typeOrStatus} ${details}`.toLowerCase();
  
  // EXPLICIT FTC indicators only - generic phrases like "identity theft report" do NOT qualify
  const explicitFTCIndicators = [
    'identitytheft.gov',
    'federal trade commission',
    'ftc identity theft',
    'ftc report',
    'ftc ',  // "FTC " with space to avoid false positives
  ];
  
  const creationPatterns = [
    'created',
    'filed',
    'submitted',
    'completed',
    'generated',
    'obtained',
  ];
  
  const hasExplicitFTC = explicitFTCIndicators.some(p => fullText.includes(p));
  const hasCreationPattern = creationPatterns.some(p => fullText.includes(p));
  
  // Both explicit FTC indicator AND creation signal required
  return hasExplicitFTC && hasCreationPattern;
}

export function parseTimelineEventRow(
  parts: string[], 
  eventKind: EventKind,
  rawLine: string
): TimelineEventParsed[] {
  if (parts.length < 2) return [];
  
  const dateParsed = parseDate(parts[0]);
  // B5: extract any [Tradeline: "..."] anchor from the trailing column(s)
  // before per-column processing so the tag never leaks into details/account.
  const tradelineFromLastPart = (() => {
    if (parts.length === 0) return null;
    const lastIdx = parts.length - 1;
    const last = parts[lastIdx] || '';
    const { displayName, strippedLine } = detectTradelineAnchor(last);
    if (displayName) {
      parts[lastIdx] = strippedLine;
      return displayName;
    }
    return null;
  })();
  const tradelineAnchor =
    tradelineFromLastPart ?? detectTradelineAnchor(rawLine).displayName;

  const entityRaw = parts[1] || '';
  const typeOrStatus = parts[2]?.trim() || '';
  const details = parts[3]?.trim() || '';
  const accountRef = parts[4]?.trim() || '';
  
  // Detect scope and sources from entity column
  let { scope, sources } = detectScope(entityRaw);
  
  // DETERMINISTIC FTC RULE: If no source detected but content indicates
  // FTC Identity Theft Report creation, assign source='FTC' automatically (PascalCase for DB enum)
  if (sources.length === 0 && detectFTCIdentityTheftReport(rawLine, typeOrStatus, details)) {
    sources = ['FTC' as NormalizedSource];
    scope = 'single';
  }

  // B4: Furnisher detection — if no bureau/data-broker source matched but the
  // source column looks like a creditor/collection agency, emit a single
  // event with source=null + furnisher_name so the import pipeline can
  // resolve it into a furnishers row before insert.
  let furnisherRef = sources.length === 0 ? detectFurnisher(entityRaw) : null;

  // If still no valid bureau source AND no furnisher detected, return empty
  // (caller routes to unrouted).
  if (sources.length === 0 && !furnisherRef) {
    return [];
  }

  // Build description
  const description = [typeOrStatus, details].filter(Boolean).join(' - ') || typeOrStatus || 'No description';
  const cleanedAccount = accountRef && accountRef !== '-' && accountRef.toLowerCase() !== 'n/a' ? accountRef : null;

  // B7: scan all free-text columns + the raw line for Drive path / URL refs.
  const attachmentScanText = [typeOrStatus, details, accountRef, rawLine].filter(Boolean).join(' \n ');
  const parsed_attachments = detectAttachmentsInText(attachmentScanText);

  if (furnisherRef) {
    // Upgrade furnisher last-4 from account_ref column when not already set
    const last4 = furnisherRef.account_last4 ?? extractAccountLast4(cleanedAccount);
    return [{
      event_kind: eventKind,
      event_date: dateParsed.date,
      date_is_unknown: dateParsed.isUnknown,
      source: null,
      scope: 'single',
      action_type: eventKind === 'action' ? typeOrStatus : null,
      status_verb: eventKind === 'response' || eventKind === 'outcome' ? typeOrStatus : null,
      counterparty: null,
      account_ref: cleanedAccount,
      description,
      raw_line: rawLine,
      furnisher_name: furnisherRef.name,
      furnisher_account_last4: last4,
      tradeline_anchor: tradelineAnchor,
      parsed_attachments: parsed_attachments.length > 0 ? parsed_attachments : undefined,
    }];
  }

  // Bureau / data-broker / regulatory path (existing behaviour, possibly
  // expanded for "all CRAs").
  return sources.map(source => ({
    event_kind: eventKind,
    event_date: dateParsed.date,
    date_is_unknown: dateParsed.isUnknown,
    source,
    scope,
    action_type: eventKind === 'action' ? typeOrStatus : null,
    status_verb: eventKind === 'response' || eventKind === 'outcome' ? typeOrStatus : null,
    counterparty: null,
    account_ref: cleanedAccount,
    description,
    raw_line: rawLine,
    tradeline_anchor: tradelineAnchor,
    parsed_attachments: parsed_attachments.length > 0 ? parsed_attachments : undefined,
  }));
}

/**
 * Detect unresolved item type from content
 */
function detectUnresolvedItemType(text: string): UnresolvedItemType {
  const lower = text.toLowerCase();
  
  if (lower.includes('inquiry') || lower.includes('inquiries')) return 'inquiry';
  if (lower.includes('address')) return 'address';
  if (lower.includes('employment') || lower.includes('employer')) return 'employment';
  if (lower.includes('ssn') || lower.includes('name') || lower.includes('dob') || lower.includes('identifier')) return 'personal_identifier';
  if (lower.includes('account') || lower.includes('balance') || lower.includes('debt') || lower.includes('collection')) return 'account';
  
  return 'other';
}

/**
 * Parse an Unresolved Item row.
 * Format: SOURCE | ITEM_TYPE/DESCRIPTION | STATUS | COUNTERPARTY/ACCOUNT | LAST_NOTED
 */
export function parseUnresolvedItemRow(
  parts: string[], 
  rawLine: string
): UnresolvedItem[] {
  if (parts.length < 2) return [];
  
  const entityRaw = parts[0] || '';
  const typeOrDesc = parts[1]?.trim() || '';
  const status = parts[2]?.trim() || 'Open';
  const counterpartyOrAccount = parts[3]?.trim() || '';
  const lastNotedRaw = parts[4]?.trim() || '';
  
  const { scope, sources } = detectScope(entityRaw);
  const dateParsed = parseDate(lastNotedRaw);
  const itemType = detectUnresolvedItemType(typeOrDesc + ' ' + counterpartyOrAccount);
  
  // Build description
  const description = typeOrDesc || 'No description';
  
  if (scope === 'all_cras') {
    // Store once with null source for all_cras
    return [{
      source_scope: 'all_cras',
      source: null,
      item_type: itemType,
      counterparty: counterpartyOrAccount && counterpartyOrAccount !== '-' ? counterpartyOrAccount : null,
      account_ref: null,
      status,
      last_noted_date: dateParsed.date,
      date_is_unknown: dateParsed.isUnknown,
      description,
      raw_line: rawLine,
    }];
  }

  if (sources.length === 0) {
    // B4: try furnisher detection before falling back to a null-source item
    const furnisherRef = detectFurnisher(entityRaw);
    return [{
      source_scope: 'single',
      source: null,
      item_type: itemType,
      counterparty: counterpartyOrAccount && counterpartyOrAccount !== '-' ? counterpartyOrAccount : null,
      account_ref: null,
      status,
      last_noted_date: dateParsed.date,
      date_is_unknown: dateParsed.isUnknown,
      description,
      raw_line: rawLine,
      furnisher_name: furnisherRef?.name ?? null,
      furnisher_account_last4: furnisherRef?.account_last4 ?? extractAccountLast4(counterpartyOrAccount),
    }];
  }
  
  return [{
    source_scope: 'single',
    source: sources[0],
    item_type: itemType,
    counterparty: counterpartyOrAccount && counterpartyOrAccount !== '-' ? counterpartyOrAccount : null,
    account_ref: null,
    status,
    last_noted_date: dateParsed.date,
    date_is_unknown: dateParsed.isUnknown,
    description,
    raw_line: rawLine,
  }];
}

/**
 * Parse a Scheduled Event row.
 * Format: DUE_DATE | TASK | ENTITY | PRIORITY | DETAILS
 */
export function parseScheduledEventRow(
  parts: string[], 
  rawLine: string
): ScheduledEvent | null {
  if (parts.length < 2) return null;
  
  const dueDateRaw = parts[0] || '';
  const task = parts[1]?.trim() || '';
  const entityRaw = parts[2]?.trim() || '';
  const priorityRaw = parts[3]?.trim()?.toLowerCase() || '';
  const details = parts[4]?.trim() || '';
  
  if (!task) return null;
  
  const dateParsed = parseDate(dueDateRaw);
  const dueText = extractDueText(dueDateRaw);
  const source = normalizeSource(entityRaw);
  
  // Parse priority
  let priority: 'low' | 'medium' | 'high' = 'medium';
  if (priorityRaw.includes('high') || priorityRaw === 'h') priority = 'high';
  else if (priorityRaw.includes('low') || priorityRaw === 'l') priority = 'low';
  
  const description = [task, details].filter(Boolean).join(' - ') || task;
  
  return {
    due_date: dateParsed.date,
    due_text: dateParsed.isUnknown ? (dueText || dueDateRaw || null) : null,
    source,
    description,
    priority,
    raw_line: rawLine,
  };
}

/**
 * Parse a Draft Item row.
 * Format: DATE | DOC_TYPE | TARGET | DESCRIPTION
 */
export function parseDraftItemRow(
  parts: string[], 
  rawLine: string
): DraftItem | null {
  if (parts.length < 2) return null;
  
  const dateRaw = parts[0] || '';
  const docType = parts[1]?.trim() || 'Draft';
  const targetRaw = parts[2]?.trim() || '';
  const descriptionRaw = parts[3]?.trim() || '';
  
  const dateParsed = parseDate(dateRaw);
  const targetEntity = normalizeSource(targetRaw);
  
  const description = descriptionRaw || docType;
  
  return {
    created_date: dateParsed.date,
    document_type: docType,
    target_entity: targetEntity,
    description,
    raw_line: rawLine,
  };
}

/**
 * Parse a Note/Flag row.
 * Format: DATE | NOTE_CONTENT
 */
export function parseNoteFlagRow(
  parts: string[], 
  rawLine: string,
  flagType: 'missing_info' | 'general' = 'general'
): NoteFlag | null {
  if (parts.length < 1) return null;
  
  const dateParsed = parseDate(parts[0]);
  let noteContent: string;
  
  if (dateParsed.date && parts.length >= 2) {
    noteContent = parts.slice(1).join(' | ').trim();
  } else {
    // No valid date in first column, use entire line as content
    noteContent = parts.join(' | ').trim();
  }
  
  if (!noteContent) return null;
  
  return {
    flag_date: dateParsed.date,
    flag_type: flagType,
    description: noteContent,
    raw_line: rawLine,
  };
}

/**
 * Create an unrouted warning note
 */
export function createUnroutedWarning(lineNumber: number, line: string): NoteFlag {
  return {
    flag_date: new Date().toISOString().split('T')[0],
    flag_type: 'unrouted_warning',
    description: `Unrouted line ${lineNumber}: ${line.substring(0, 80)}${line.length > 80 ? '...' : ''}`,
    raw_line: line,
  };
}
