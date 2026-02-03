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
 * Expand a single timeline event into multiple if it's an "All CRAs" event.
 * Returns the original event if it doesn't match All CRAs patterns.
 * Returns 3 duplicated events (one per bureau) if it does match.
 */
export function expandAllCrasEvent(event: TimelineEvent): TimelineEvent[] {
  // Check if source matches "All CRAs" patterns
  if (!isAllCrasSource(event.source)) {
    return [event];
  }

  // Expand into 3 bureau-specific events
  return CRA_SOURCES.map((bureauSource, index) => ({
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
