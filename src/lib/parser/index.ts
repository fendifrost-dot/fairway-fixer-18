/**
 * Deterministic Parser
 * 
 * Main entry point for parsing ChatGPT/structured text updates.
 * 
 * CONTRACT:
 * - Section-header-based routing ONLY (no keyword inference)
 * - No silent defaults
 * - Missing source => NOT a timeline_event (routes to unrouted)
 * - "All CRAs" => 3 child events (experian/transunion/equifax)
 * - Unresolved items are STATE, not timeline
 */

import { 
  ParseResult, 
  SectionType,
  TimelineEventParsed,
  UnresolvedItem,
  ScheduledEvent,
  DraftItem,
  NoteFlag,
  ClientProfile,
} from '@/types/parser';
import { detectSection, isMetaLine, cleanContentLine } from './sectionDetector';
import { 
  splitPipeLine, 
  parseTimelineEventRow, 
  parseUnresolvedItemRow,
  parseScheduledEventRow,
  parseDraftItemRow,
  parseNoteFlagRow,
  createUnroutedWarning,
} from './rowParsers';
import { parseClientProfile } from './profileParser';

/**
 * Parse a ChatGPT/structured text update into deterministic entities.
 */
export function parseUpdate(input: string, clientId: string): ParseResult {
  const result: ParseResult = {
    client_profile: null,
    timeline_events: [],
    unresolved_items: [],
    scheduled_events: [],
    draft_items: [],
    notes_flags: [],
    unrouted_lines: [],
    errors: [],
    counts: {
      actions: 0,
      responses: 0,
      outcomes: 0,
      unresolved: 0,
      scheduled: 0,
      drafts: 0,
      notes: 0,
      unrouted: 0,
    },
  };
  
  if (!input || !input.trim()) {
    result.errors.push('No input provided');
    return result;
  }
  
  const lines = input.split('\n');
  let currentSection: SectionType = 'none';
  let clientProfileLines: string[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // Skip empty and meta lines
    if (isMetaLine(line)) continue;
    
    // Check if this is a section header
    const detectedSection = detectSection(trimmed);
    if (detectedSection !== null) {
      // If we were collecting client profile lines, parse them now
      if (currentSection === 'client_profile' && clientProfileLines.length > 0) {
        result.client_profile = parseClientProfile(clientProfileLines);
        clientProfileLines = [];
      }
      
      currentSection = detectedSection;
      continue;
    }
    
    // Process content based on current section
    const cleanLine = cleanContentLine(line);
    if (!cleanLine) continue;
    
    const lineNumber = i + 1;
    
    switch (currentSection) {
      case 'none': {
        // No section header seen yet - route to unrouted if it looks like data
        if (cleanLine.includes('|') && cleanLine.length > 5) {
          result.unrouted_lines.push(`Line ${lineNumber}: ${cleanLine.substring(0, 80)}${cleanLine.length > 80 ? '...' : ''}`);
          result.notes_flags.push(createUnroutedWarning(lineNumber, cleanLine));
          result.counts.unrouted++;
        }
        break;
      }
      
      case 'client_profile': {
        clientProfileLines.push(cleanLine);
        break;
      }
      
      case 'completed_actions': {
        const parts = splitPipeLine(cleanLine);
        if (parts.length < 2) {
          result.errors.push(`Line ${lineNumber}: Invalid format (need at least 2 pipe-separated columns)`);
          break;
        }
        
        const events = parseTimelineEventRow(parts, 'action', cleanLine);
        if (events.length === 0) {
          // No valid source - route to unrouted
          result.unrouted_lines.push(`Line ${lineNumber}: Missing/invalid source - ${cleanLine.substring(0, 60)}...`);
          result.notes_flags.push(createUnroutedWarning(lineNumber, cleanLine));
          result.counts.unrouted++;
        } else {
          result.timeline_events.push(...events);
          result.counts.actions += events.length;
        }
        break;
      }
      
      case 'responses_received': {
        const parts = splitPipeLine(cleanLine);
        if (parts.length < 2) {
          result.errors.push(`Line ${lineNumber}: Invalid format (need at least 2 pipe-separated columns)`);
          break;
        }
        
        const events = parseTimelineEventRow(parts, 'response', cleanLine);
        if (events.length === 0) {
          result.unrouted_lines.push(`Line ${lineNumber}: Missing/invalid source - ${cleanLine.substring(0, 60)}...`);
          result.notes_flags.push(createUnroutedWarning(lineNumber, cleanLine));
          result.counts.unrouted++;
        } else {
          result.timeline_events.push(...events);
          result.counts.responses += events.length;
        }
        break;
      }
      
      case 'outcomes_observed': {
        const parts = splitPipeLine(cleanLine);
        if (parts.length < 2) {
          result.errors.push(`Line ${lineNumber}: Invalid format (need at least 2 pipe-separated columns)`);
          break;
        }
        
        const events = parseTimelineEventRow(parts, 'outcome', cleanLine);
        if (events.length === 0) {
          result.unrouted_lines.push(`Line ${lineNumber}: Missing/invalid source - ${cleanLine.substring(0, 60)}...`);
          result.notes_flags.push(createUnroutedWarning(lineNumber, cleanLine));
          result.counts.unrouted++;
        } else {
          result.timeline_events.push(...events);
          result.counts.outcomes += events.length;
        }
        break;
      }
      
      case 'open_unresolved': {
        const parts = splitPipeLine(cleanLine);
        const items = parseUnresolvedItemRow(parts, cleanLine);
        result.unresolved_items.push(...items);
        result.counts.unresolved += items.length;
        break;
      }
      
      case 'suggested_next': {
        const parts = splitPipeLine(cleanLine);
        const event = parseScheduledEventRow(parts, cleanLine);
        if (event) {
          result.scheduled_events.push(event);
          result.counts.scheduled++;
        } else {
          result.errors.push(`Line ${lineNumber}: Could not parse scheduled item`);
        }
        break;
      }
      
      case 'drafts': {
        const parts = splitPipeLine(cleanLine);
        const draft = parseDraftItemRow(parts, cleanLine);
        if (draft) {
          result.draft_items.push(draft);
          result.counts.drafts++;
        }
        break;
      }
      
      case 'missing_info': {
        const parts = splitPipeLine(cleanLine);
        const note = parseNoteFlagRow(parts, cleanLine, 'missing_info');
        if (note) {
          result.notes_flags.push(note);
          result.counts.notes++;
        }
        break;
      }
    }
  }
  
  // Handle any remaining client profile lines
  if (currentSection === 'client_profile' && clientProfileLines.length > 0) {
    result.client_profile = parseClientProfile(clientProfileLines);
  }
  
  // Add summary error if nothing was parsed
  const totalParsed = 
    result.timeline_events.length + 
    result.unresolved_items.length + 
    result.scheduled_events.length + 
    result.draft_items.length +
    result.notes_flags.filter(n => n.flag_type !== 'unrouted_warning').length;
  
  if (totalParsed === 0 && result.unrouted_lines.length === 0) {
    result.errors.unshift('0 rows parsed — check headers and pipe format');
  }
  
  // Add warning if there are unrouted lines
  if (result.unrouted_lines.length > 0) {
    result.errors.push(`${result.unrouted_lines.length} line(s) unrouted due to missing/invalid section headers or sources`);
  }
  
  return result;
}

// Re-export types for convenience
export type { ParseResult, TimelineEventParsed, UnresolvedItem, ScheduledEvent, DraftItem, NoteFlag };
