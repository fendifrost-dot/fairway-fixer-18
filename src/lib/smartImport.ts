 /**
  * Smart Import - Plain text single-event import
  * Deterministic detection rules (no AI/LLM)
  */
 
 import { EventSource } from '@/types/operator';
 
 export type SmartImportEventKind = 'action' | 'response' | 'outcome';
 
 export interface SmartImportResult {
   raw_line: string;
   source: EventSource | null;
   event_kind: SmartImportEventKind;
   event_date: string | null;
   date_is_unknown: boolean;
 }
 
// All valid sources (lowercase → EventSource) - matches DB enum exactly
// NO short aliases except safe ones (tu for TransUnion is common and unambiguous)
const VALID_SOURCES: Record<string, EventSource> = {
   'experian': 'Experian',
   'transunion': 'TransUnion',
  'tu': 'TransUnion',
   'equifax': 'Equifax',
   'innovis': 'Innovis',
   'lexisnexis': 'LexisNexis',
   'sagestream': 'Sagestream',
   'corelogic': 'CoreLogic',
   'chexsystems': 'ChexSystems',
   'ews': 'EWS',
   'nctue': 'NCTUE',
   'cfpb': 'CFPB',
   'ftc': 'FTC',
   'bbb': 'BBB',
   'ag': 'AG',
  'attorney general': 'AG',
 };
 
// Leading label patterns - these sources at the START of input get priority
// Captures: "TransUnion emailed..." or "TransUnion: response..."
const LEADING_SOURCE_PATTERN = /^(Experian|TransUnion|Equifax|Innovis|LexisNexis|Sagestream|CoreLogic|ChexSystems|EWS|NCTUE|CFPB|FTC|BBB|AG|Attorney General)\b[:\s-]*/i;

 // Event kind detection keywords
// Order matters: response checked first, then action, then outcome
 const RESPONSE_KEYWORDS = ['received', 'emailed', 'replied', 'response', 'acknowledg', 'we received'];
 const ACTION_KEYWORDS = ['sent', 'mailed', 'submitted', 'filed', 'uploaded', 'faxed'];
// Narrowed outcome keywords to avoid noise from acknowledgement emails
const OUTCOME_KEYWORDS = ['deleted', 'removed', 'reinsertion', 'verified as accurate', 'investigation completed'];
 
 /**
 * Detect source from text using case-insensitive matching
 * Priority: 1) Leading label pattern, 2) Word-boundary scan (longest first)
  */
 export function detectSource(text: string): EventSource | null {
  // PASS 1: Check for leading source label (most reliable)
  const leadingMatch = text.match(LEADING_SOURCE_PATTERN);
  if (leadingMatch) {
    const leadingSource = leadingMatch[1].toLowerCase();
    // Normalize "attorney general" to "ag"
    const normalizedLeading = leadingSource === 'attorney general' ? 'ag' : leadingSource;
    if (VALID_SOURCES[normalizedLeading]) {
      return VALID_SOURCES[normalizedLeading];
    }
  }
  
  // PASS 2: Word-boundary scan (longest matches first to avoid partial matches)
  const lowerText = text.toLowerCase();
   const sortedSources = Object.entries(VALID_SOURCES)
     .sort((a, b) => b[0].length - a[0].length);
   
   for (const [key, value] of sortedSources) {
     // Word boundary check to avoid partial matches
     const regex = new RegExp(`\\b${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
     if (regex.test(lowerText)) {
       return value;
     }
   }
   
   return null;
 }
 
 /**
 * Detect event kind using keyword matching
 * Strict precedence: response → action → outcome → default action
  */
 export function detectEventKind(text: string): SmartImportEventKind {
   const lowerText = text.toLowerCase();
   
  // Check response keywords first (highest priority)
   for (const keyword of RESPONSE_KEYWORDS) {
     if (lowerText.includes(keyword)) {
       return 'response';
     }
   }
   
  // Check action keywords second
   for (const keyword of ACTION_KEYWORDS) {
     if (lowerText.includes(keyword)) {
       return 'action';
     }
   }
   
  // Check outcome keywords third
   for (const keyword of OUTCOME_KEYWORDS) {
     if (lowerText.includes(keyword)) {
       return 'outcome';
     }
   }
   
   // Default to action
   return 'action';
 }
 
 /**
 * Validate date components are within valid ranges
 */
function isValidDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  // Basic validation - could be more precise per month but this catches garbage
  if (year < 2000 || year > 2099) return false;
  return true;
}

/**
 * Parse date from text with validation
 * Supports: MM/DD/YY, MM/DD/YYYY, YYYY-MM-DD
 * Returns YYYY-MM-DD format or null if invalid/not found
  */
 export function parseDate(text: string): string | null {
   // YYYY-MM-DD format
   const isoMatch = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
   if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10);
    const day = parseInt(isoMatch[3], 10);
    if (isValidDate(year, month, day)) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
   }
   
   // MM/DD/YYYY format
   const usFullMatch = text.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
   if (usFullMatch) {
    const month = parseInt(usFullMatch[1], 10);
    const day = parseInt(usFullMatch[2], 10);
    const year = parseInt(usFullMatch[3], 10);
    if (isValidDate(year, month, day)) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
   }
   
  // MM/DD/YY format (assumes 20YY)
   const usShortMatch = text.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{2})\b/);
   if (usShortMatch) {
    const month = parseInt(usShortMatch[1], 10);
    const day = parseInt(usShortMatch[2], 10);
    const year = 2000 + parseInt(usShortMatch[3], 10);
    if (isValidDate(year, month, day)) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
   }
   
   return null;
 }
 
 /**
  * Check if input is JSON (starts with { or [)
  */
 export function isJsonInput(text: string): boolean {
   const trimmed = text.trim();
   return trimmed.startsWith('{') || trimmed.startsWith('[');
 }
 
 /**
  * Run Smart Import detection on plain text
  */
 export function smartImportParse(text: string): SmartImportResult {
   const eventDate = parseDate(text);
   
   return {
     raw_line: text,
     source: detectSource(text),
     event_kind: detectEventKind(text),
     event_date: eventDate,
     date_is_unknown: eventDate === null,
   };
 }
 
 /**
  * Get all valid sources for dropdown
  */
 export function getAllSources(): EventSource[] {
   return [
     'Experian', 'TransUnion', 'Equifax',
     'Innovis', 'LexisNexis', 'Sagestream', 'CoreLogic',
     'ChexSystems', 'EWS', 'NCTUE',
     'CFPB', 'FTC', 'BBB', 'AG',
   ];
 }