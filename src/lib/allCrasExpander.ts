/**
 * All CRAs Expander Utility
 * 
 * Handles deterministic duplication of events with "All CRAs" / "All bureaus" sources.
 * 
 * NON-NEGOTIABLE RULE:
 * - If source matches All CRAs patterns, expand into 3 separate events
 * - Experian, TransUnion, Equifax
 * - Never render/store the parent "All CRAs" item
 */

import { TimelineEvent, EventSource, CRA_SOURCES } from '@/types/operator';

// Patterns that indicate "All CRAs" scope
const ALL_CRAS_PATTERNS = [
  'all cras',
  'all bureaus',
  'all credit bureaus',
  'all 3 bureaus',
  'all three bureaus',
  'all 3 cras',
  'all three cras',
  '3 bureaus',
  'three bureaus',
];

/**
 * Check if a source string represents "All CRAs"
 */
export function isAllCrasSource(source: string | null): boolean {
  if (!source) return false;
  const normalized = source.toLowerCase().trim();
  return ALL_CRAS_PATTERNS.some(pattern => normalized.includes(pattern));
}

/**
 * Check if event summary/title contains "All CRAs" patterns
 * Used when source is null but content indicates multi-bureau scope
 */
export function hasAllCrasInContent(summary: string | null, title: string | null): boolean {
  const combined = `${summary || ''} ${title || ''}`.toLowerCase().trim();
  if (!combined) return false;
  return ALL_CRAS_PATTERNS.some(pattern => combined.includes(pattern));
}

/**
 * Expand a single timeline event into multiple if it's an "All CRAs" event.
 * Returns the original event if it doesn't match All CRAs patterns.
 * Returns 3 duplicated events (one per bureau) if it does match.
 * 
 * Checks BOTH source field AND summary/title content for "All CRAs" patterns.
 */
export function expandAllCrasEvent(event: TimelineEvent): TimelineEvent[] {
  // Check if source matches "All CRAs" patterns
  const sourceIsAllCras = isAllCrasSource(event.source);
  
  // Also check summary/title when source is null
  const contentIsAllCras = !event.source && hasAllCrasInContent(event.summary, event.title);
  
  if (!sourceIsAllCras && !contentIsAllCras) {
    return [event];
  }

  // Expand into 3 bureau-specific events
  return CRA_SOURCES.map((bureauSource) => ({
    ...event,
    // Create synthetic unique ID for expanded events (append bureau suffix)
    id: `${event.id}_${bureauSource.toLowerCase()}`,
    source: bureauSource,
  }));
}

/**
 * Expand all timeline events, duplicating "All CRAs" events into 3 bureau-specific events.
 * This is the defensive UI layer for existing DB rows.
 */
export function expandAllCrasEvents(events: TimelineEvent[]): TimelineEvent[] {
  return events.flatMap(expandAllCrasEvent);
}

/**
 * Get the 3 CRA sources for expansion
 */
export function getCraSources(): readonly EventSource[] {
  return CRA_SOURCES;
}
