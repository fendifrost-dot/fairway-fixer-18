/**
 * Source Normalization Utilities
 * 
 * Deterministic mapping from raw source strings to normalized enum values.
 * No silent defaults - returns null if source cannot be mapped.
 */

import { 
  NormalizedSource, 
  SOURCE_NORMALIZATION_MAP, 
  CRA_SOURCES,
  ScopeValue 
} from '@/types/parser';

/**
 * Normalize a raw source string to a NormalizedSource enum value.
 * Returns null if no valid mapping found - caller must handle.
 */
export function normalizeSource(raw: string): NormalizedSource | null {
  if (!raw) return null;
  
  const normalized = raw.toLowerCase().trim();
  
  // Direct lookup
  if (normalized in SOURCE_NORMALIZATION_MAP) {
    return SOURCE_NORMALIZATION_MAP[normalized];
  }
  
  // Check if any key is contained in the input
  for (const [key, value] of Object.entries(SOURCE_NORMALIZATION_MAP)) {
    if (normalized.includes(key)) {
      return value;
    }
  }
  
  return null;
}

/**
 * Detect if the source indicates "all CRAs" scope.
 * Returns { scope, sources } where sources is either the single source or all 3 CRAs.
 */
export function detectScope(raw: string): { scope: ScopeValue; sources: NormalizedSource[] } {
  const normalized = raw.toLowerCase().trim();
  
  // Check for "all" patterns
  const allPatterns = [
    'all bureaus',
    'all cras',
    'all credit bureaus',
    'all 3 bureaus',
    'all three bureaus',
    'all 3 cras',
    'all three cras',
    '3 bureaus',
    'three bureaus',
  ];
  
  for (const pattern of allPatterns) {
    if (normalized.includes(pattern)) {
      return { 
        scope: 'all_cras', 
        sources: [...CRA_SOURCES] 
      };
    }
  }
  
  // Single source
  const source = normalizeSource(raw);
  if (source) {
    return { 
      scope: 'single', 
      sources: [source] 
    };
  }
  
  // Could not determine source
  return { scope: 'single', sources: [] };
}

/**
 * Get display name for a normalized source
 */
export function getSourceDisplayName(source: NormalizedSource): string {
  const displayNames: Record<NormalizedSource, string> = {
    experian: 'Experian',
    transunion: 'TransUnion',
    equifax: 'Equifax',
    innovis: 'Innovis',
    lexisnexis: 'LexisNexis',
    sagestream: 'SageStream',
    corelogic: 'CoreLogic',
    ftc: 'FTC',
    cfpb: 'CFPB',
    bbb: 'BBB',
    ag: 'Attorney General',
  };
  
  return displayNames[source] || source;
}

/**
 * Group sources by category for UI display
 */
export const SOURCE_CATEGORIES = {
  credit_bureaus: ['experian', 'transunion', 'equifax', 'innovis'] as NormalizedSource[],
  data_brokers: ['lexisnexis', 'sagestream', 'corelogic'] as NormalizedSource[],
  regulatory: ['ftc', 'cfpb', 'bbb', 'ag'] as NormalizedSource[],
};
