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
 
 // Source aliases map (lowercase key → EventSource value)
 const SOURCE_ALIASES: Record<string, EventSource> = {
   'tu': 'TransUnion',
   'ln': 'LexisNexis',
   'ag': 'AG',
   'attorney general': 'AG',
 };
 
 // All valid sources (lowercase → EventSource)
 const VALID_SOURCES: Record<string, EventSource> = {
   'experian': 'Experian',
   'transunion': 'TransUnion',
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
   // Add aliases
   ...SOURCE_ALIASES,
 };
 
 // Event kind detection keywords
 const RESPONSE_KEYWORDS = ['received', 'emailed', 'replied', 'response', 'acknowledg', 'we received'];
 const ACTION_KEYWORDS = ['sent', 'mailed', 'submitted', 'filed', 'uploaded', 'faxed'];
 const OUTCOME_KEYWORDS = ['deleted', 'removed', 'updated', 'completed', 'verified', 'results'];
 
 /**
  * Detect source from text using case-insensitive matching
  */
 export function detectSource(text: string): EventSource | null {
   const lowerText = text.toLowerCase();
   
   // Check each valid source (longest matches first to avoid partial matches)
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
  */
 export function detectEventKind(text: string): SmartImportEventKind {
   const lowerText = text.toLowerCase();
   
   // Check response keywords first
   for (const keyword of RESPONSE_KEYWORDS) {
     if (lowerText.includes(keyword)) {
       return 'response';
     }
   }
   
   // Check action keywords
   for (const keyword of ACTION_KEYWORDS) {
     if (lowerText.includes(keyword)) {
       return 'action';
     }
   }
   
   // Check outcome keywords
   for (const keyword of OUTCOME_KEYWORDS) {
     if (lowerText.includes(keyword)) {
       return 'outcome';
     }
   }
   
   // Default to action
   return 'action';
 }
 
 /**
  * Parse date from text
  * Supports: MM/DD/YY, MM/DD/YYYY, YYYY-MM-DD
  * Returns YYYY-MM-DD format or null
  */
 export function parseDate(text: string): string | null {
   // YYYY-MM-DD format
   const isoMatch = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
   if (isoMatch) {
     const [, year, month, day] = isoMatch;
     return `${year}-${month}-${day}`;
   }
   
   // MM/DD/YYYY format
   const usFullMatch = text.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
   if (usFullMatch) {
     const [, month, day, year] = usFullMatch;
     return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
   }
   
   // MM/DD/YY format (use 20YY)
   const usShortMatch = text.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{2})\b/);
   if (usShortMatch) {
     const [, month, day, year] = usShortMatch;
     return `20${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
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