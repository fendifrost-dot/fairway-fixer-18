/**
 * Section Detection
 * 
 * Deterministic section header detection with regex patterns.
 * Supports common variants. No silent defaults.
 */

import { SectionType } from '@/types/parser';

interface SectionPattern {
  section: SectionType;
  patterns: RegExp[];
}

/**
 * Explicit header patterns for each section type.
 * Order matters - more specific patterns first.
 */
const SECTION_PATTERNS: SectionPattern[] = [
  // Client Profile
  {
    section: 'client_profile',
    patterns: [
      /^#+\s*client\s*profile:?$/i,
      /^client\s*profile:?$/i,
    ],
  },
  
  // Completed Actions
  {
    section: 'completed_actions',
    patterns: [
      /^#+\s*completed\s*actions?:?$/i,
      /^completed\s*actions?:?$/i,
      /^completed:?$/i,
      /^actions?\s*completed:?$/i,
      /^actions?\s*sent:?$/i,
      /^sent\s*actions?:?$/i,
      /^sent:?$/i,
    ],
  },
  
  // Responses Received
  {
    section: 'responses_received',
    patterns: [
      /^#+\s*responses?\s*received:?$/i,
      /^responses?\s*received:?$/i,
      /^responses?:?$/i,
      /^received\s*responses?:?$/i,
    ],
  },
  
  // Outcomes Observed
  {
    section: 'outcomes_observed',
    patterns: [
      /^#+\s*outcomes?\s*observed:?$/i,
      /^outcomes?\s*observed:?$/i,
      /^outcomes?:?$/i,
      /^credit\s*file\s*outcomes?:?$/i,
      /^observed\s*outcomes?:?$/i,
      /^results?:?$/i,
    ],
  },
  
  // Open / Unresolved Items (STATE, not timeline)
  {
    section: 'open_unresolved',
    patterns: [
      /^#+\s*open\s*\/?\s*unresolved\s*items?:?$/i,
      /^open\s*\/?\s*unresolved\s*items?:?$/i,
      /^open\s*\/?\s*unresolved:?$/i,
      /^unresolved\s*items?:?$/i,
      /^unresolved:?$/i,
      /^open\s*items?:?$/i,
      /^pending\s*items?:?$/i,
      /^outstanding\s*items?:?$/i,
    ],
  },
  
  // Suggested Next Actions / ToDo
  {
    section: 'suggested_next',
    patterns: [
      /^#+\s*suggested\s*next\s*actions?:?$/i,
      /^suggested\s*next\s*actions?:?$/i,
      /^next\s*actions?:?$/i,
      /^next\s*steps?:?$/i,
      /^to\s*-?\s*do:?$/i,
      /^todo:?$/i,
      /^action\s*items?:?$/i,
      /^pending\s*tasks?:?$/i,
      /^recommended\s*actions?:?$/i,
    ],
  },
  
  // Documents Drafted (Not Sent)
  {
    section: 'drafts',
    patterns: [
      /^#+\s*documents?\s*drafted\s*\(not\s*sent\):?$/i,
      /^documents?\s*drafted\s*\(not\s*sent\):?$/i,
      /^documents?\s*drafted:?$/i,
      /^drafts?\s*\(not\s*sent\):?$/i,
      /^drafts?:?$/i,
      /^unsent\s*drafts?:?$/i,
      /^unsent\s*documents?:?$/i,
    ],
  },
  
  // Missing Information Flags
  {
    section: 'missing_info',
    patterns: [
      /^#+\s*missing\s*information\s*flags?:?$/i,
      /^missing\s*information\s*flags?:?$/i,
      /^missing\s*information:?$/i,
      /^missing\s*info\s*flags?:?$/i,
      /^missing\s*info:?$/i,
      /^flags?:?$/i,
      /^notes?:?$/i,
      /^internal\s*notes?:?$/i,
    ],
  },
];

/**
 * Headers to explicitly skip (meta sections that don't contain parseable row data)
 */
const SKIP_HEADER_PATTERNS: RegExp[] = [
  /^case\s*summary:?$/i,
  /^overview:?$/i,
  /^summary:?$/i,
  /^-{3,}$/,  // horizontal rules
  /^={3,}$/,
  /^\*{3,}$/,
];

/**
 * Detect which section a line represents.
 * Returns:
 * - SectionType if it's a valid section header
 * - 'none' if it's a skip header (meta section)
 * - null if it's not a header (content line)
 */
export function detectSection(line: string): SectionType | null {
  const trimmed = line.trim();
  
  // Skip empty lines
  if (!trimmed) return null;
  
  // Check skip patterns first
  for (const pattern of SKIP_HEADER_PATTERNS) {
    if (pattern.test(trimmed)) {
      return 'none';
    }
  }
  
  // Check section patterns
  for (const { section, patterns } of SECTION_PATTERNS) {
    for (const pattern of patterns) {
      if (pattern.test(trimmed)) {
        return section;
      }
    }
  }
  
  return null;
}

/**
 * Check if a line is a structural/meta line (not content)
 */
export function isMetaLine(line: string): boolean {
  const trimmed = line.trim().toLowerCase();
  
  return (
    !trimmed ||
    trimmed.startsWith('---') ||
    trimmed.startsWith('===') ||
    trimmed.startsWith('###') ||
    trimmed.startsWith('***') ||
    trimmed.startsWith('date:') ||
    trimmed.startsWith('client_update')
  );
}

/**
 * Clean a content line by removing list markers
 */
export function cleanContentLine(line: string): string {
  return line
    .trim()
    .replace(/^[-*•]\s*/, '')
    .replace(/^\d+\.\s*/, '')
    .trim();
}
