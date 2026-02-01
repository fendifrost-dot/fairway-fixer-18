/**
 * Date Parsing Utilities
 * 
 * Deterministic date parsing with explicit unknown handling.
 * Returns { date, isUnknown } - never silently defaults.
 */

export interface ParsedDate {
  date: string | null; // YYYY-MM-DD or null
  isUnknown: boolean;  // true if date had XX, was unparseable, or marked unknown
}

/**
 * Parse a date string into normalized YYYY-MM-DD format.
 * Handles:
 * - YYYY-MM-DD
 * - MM/DD/YYYY
 * - Dates with XX for unknown parts
 * - "ASAP", "Unknown", empty
 */
export function parseDate(dateStr: string): ParsedDate {
  if (!dateStr) {
    return { date: null, isUnknown: true };
  }
  
  const trimmed = dateStr.trim().toLowerCase();
  
  // Check for explicit unknown markers
  if (
    trimmed === '' || 
    trimmed === '-' || 
    trimmed === 'n/a' ||
    trimmed === 'unknown' ||
    trimmed === 'asap' ||
    trimmed === 'tbd'
  ) {
    return { date: null, isUnknown: true };
  }
  
  // Check for XX patterns (unknown date parts)
  if (trimmed.includes('xx')) {
    return { date: null, isUnknown: true };
  }
  
  // Try ISO format: YYYY-MM-DD
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    if (isValidDate(year, month, day)) {
      return { date: `${year}-${month}-${day}`, isUnknown: false };
    }
  }
  
  // Try US format: MM/DD/YYYY
  const usMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (usMatch) {
    const [, month, day, year] = usMatch;
    if (isValidDate(year, month, day)) {
      return { 
        date: `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`, 
        isUnknown: false 
      };
    }
  }
  
  // Try to extract embedded ISO date
  const embeddedIso = trimmed.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (embeddedIso) {
    const [, year, month, day] = embeddedIso;
    if (isValidDate(year, month, day)) {
      return { date: `${year}-${month}-${day}`, isUnknown: false };
    }
  }
  
  // Try to extract embedded US date
  const embeddedUs = trimmed.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (embeddedUs) {
    const [, month, day, year] = embeddedUs;
    if (isValidDate(year, month, day)) {
      return { 
        date: `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`, 
        isUnknown: false 
      };
    }
  }
  
  // Could not parse - mark as unknown
  return { date: null, isUnknown: true };
}

/**
 * Validate date components
 */
function isValidDate(year: string, month: string, day: string): boolean {
  const y = parseInt(year, 10);
  const m = parseInt(month, 10);
  const d = parseInt(day, 10);
  
  if (isNaN(y) || isNaN(m) || isNaN(d)) return false;
  if (y < 1900 || y > 2100) return false;
  if (m < 1 || m > 12) return false;
  if (d < 1 || d > 31) return false;
  
  return true;
}

/**
 * Extract due text for scheduled items (e.g., "ASAP", "Next week")
 */
export function extractDueText(dateStr: string): string | null {
  if (!dateStr) return null;
  
  const trimmed = dateStr.trim();
  const lower = trimmed.toLowerCase();
  
  // These are due text values, not dates
  const dueTextPatterns = ['asap', 'tbd', 'soon', 'next week', 'urgent'];
  
  for (const pattern of dueTextPatterns) {
    if (lower.includes(pattern)) {
      return trimmed; // Return original casing
    }
  }
  
  return null;
}
