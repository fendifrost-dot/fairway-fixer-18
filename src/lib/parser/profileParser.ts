/**
 * Client Profile Parser
 * 
 * Parse client profile section into structured data.
 */

import { ClientProfile, PrimaryIssueType, PRIMARY_ISSUE_TYPES } from '@/types/parser';

/**
 * Parse client profile from lines in the CLIENT PROFILE section
 */
export function parseClientProfile(lines: string[]): ClientProfile | null {
  if (lines.length === 0) return null;
  
  let fullLegalName: string | null = null;
  let dob: string | null = null;
  let ssnLast4: string | null = null;
  let primaryIssueType: PrimaryIssueType | null = null;
  const profileNotes: string[] = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    // Try to parse key: value format
    const colonIndex = trimmed.indexOf(':');
    if (colonIndex > 0) {
      const key = trimmed.substring(0, colonIndex).toLowerCase().trim();
      const value = trimmed.substring(colonIndex + 1).trim();
      
      // Name
      if (key.includes('name') && !key.includes('nick') && !key.includes('prefer')) {
        fullLegalName = value || null;
        continue;
      }
      
      // DOB
      if (key.includes('dob') || key.includes('birth') || key.includes('born')) {
        // Try to parse as YYYY-MM-DD
        const dobMatch = value.match(/(\d{4})-(\d{2})-(\d{2})/);
        if (dobMatch) {
          dob = dobMatch[0];
        } else {
          // Try MM/DD/YYYY
          const usMatch = value.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
          if (usMatch) {
            const [, month, day, year] = usMatch;
            dob = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
          }
        }
        continue;
      }
      
      // SSN
      if (key.includes('ssn') || key.includes('social')) {
        const last4Match = value.match(/(\d{4})\s*$/);
        if (last4Match) {
          ssnLast4 = last4Match[1];
        }
        continue;
      }
      
      // Issue Type
      if (key.includes('issue') || key.includes('type') || key.includes('category')) {
        const normalizedValue = value.toLowerCase().replace(/[^a-z]/g, '_');
        for (const issueType of PRIMARY_ISSUE_TYPES) {
          if (normalizedValue.includes(issueType.replace(/_/g, ''))) {
            primaryIssueType = issueType;
            break;
          }
        }
        // Also check for common phrases
        if (!primaryIssueType) {
          if (value.toLowerCase().includes('identity theft')) {
            primaryIssueType = 'identity_theft';
          } else if (value.toLowerCase().includes('mixed file')) {
            primaryIssueType = 'mixed_file';
          } else if (value.toLowerCase().includes('inquir')) {
            primaryIssueType = 'unauthorized_inquiries';
          } else {
            primaryIssueType = 'general_credit_repair';
          }
        }
        continue;
      }
      
      // Anything else is a note
      profileNotes.push(trimmed);
    } else {
      // Non-key-value lines are profile notes
      profileNotes.push(trimmed);
    }
  }
  
  // If we don't have the required field, return null
  if (!fullLegalName) {
    // Try to find name in notes
    for (const note of profileNotes) {
      if (note.length > 2 && note.length < 100 && !note.includes('|')) {
        fullLegalName = note;
        break;
      }
    }
  }
  
  if (!fullLegalName) return null;
  
  return {
    full_legal_name: fullLegalName,
    dob,
    ssn_last4: ssnLast4,
    primary_issue_type: primaryIssueType || 'general_credit_repair',
    profile_notes: profileNotes,
  };
}
