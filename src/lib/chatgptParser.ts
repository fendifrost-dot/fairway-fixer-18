import { 
  TimelineEvent, 
  OperatorTask, 
  EventCategory, 
  EventSource, 
  SimplePriority,
  ALL_SOURCES,
  RelatedAccount 
} from '@/types/operator';

export interface ParseResult {
  events: Omit<TimelineEvent, 'id' | 'created_at'>[];
  tasks: Omit<OperatorTask, 'id' | 'created_at'>[];
  errors: string[];
  counts: ParseCounts;
}

export interface ParseCounts {
  completed: number;
  responses: number;
  outcomes: number;
  todo: number;
  notes: number;
}

function parseDate(dateStr: string): string | null {
  if (!dateStr) return null;
  const trimmed = dateStr.trim();
  
  // Try YYYY-MM-DD format
  const isoMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})$/);
  if (isoMatch) {
    return isoMatch[1];
  }
  
  // Try MM/DD/YYYY format
  const usMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (usMatch) {
    const [, month, day, year] = usMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  // Try to extract date from longer string
  const embeddedIso = trimmed.match(/(\d{4}-\d{2}-\d{2})/);
  if (embeddedIso) {
    return embeddedIso[1];
  }
  
  const embeddedUs = trimmed.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (embeddedUs) {
    const [, month, day, year] = embeddedUs;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  return null;
}

function parseSource(text: string): EventSource | null {
  if (!text) return null;
  const normalized = text.trim().toLowerCase();
  
  for (const source of ALL_SOURCES) {
    if (normalized.includes(source.toLowerCase())) {
      return source;
    }
  }
  
  // Common variations
  if (normalized.includes('experian')) return 'Experian';
  if (normalized.includes('transunion') || normalized.includes('trans union')) return 'TransUnion';
  if (normalized.includes('equifax')) return 'Equifax';
  if (normalized.includes('lexisnexis') || normalized.includes('lexis nexis') || normalized.includes('lexis')) return 'LexisNexis';
  if (normalized.includes('corelogic') || normalized.includes('core logic')) return 'CoreLogic';
  if (normalized.includes('innovis')) return 'Innovis';
  if (normalized.includes('sagestream') || normalized.includes('sage stream')) return 'Sagestream';
  if (normalized.includes('chexsystems') || normalized.includes('chex systems') || normalized.includes('chex')) return 'ChexSystems';
  if (normalized.includes('ews') || normalized.includes('early warning')) return 'EWS';
  if (normalized.includes('nctue')) return 'NCTUE';
  if (normalized.includes('cfpb') || normalized.includes('consumer financial')) return 'CFPB';
  if (normalized.includes('bbb') || normalized.includes('better business')) return 'BBB';
  if (normalized.includes('attorney general') || normalized.includes(' ag ') || normalized === 'ag') return 'AG';
  
  return null;
}

function parsePriority(text: string): SimplePriority {
  if (!text) return 'Medium';
  const normalized = text.toLowerCase().trim();
  if (normalized.includes('high') || normalized === 'h') return 'High';
  if (normalized.includes('low') || normalized === 'l') return 'Low';
  return 'Medium';
}

function parseAccounts(text: string): RelatedAccount[] | null {
  if (!text || text.trim() === '' || text.trim() === '-') return null;
  
  // Try to parse account entries like "Account Name (****1234)"
  const accountPattern = /([^,;]+?)\s*\(([^)]+)\)/g;
  const accounts: RelatedAccount[] = [];
  
  let match;
  while ((match = accountPattern.exec(text)) !== null) {
    accounts.push({
      name: match[1].trim(),
      masked_number: match[2].trim(),
    });
  }
  
  // If no pattern matches, treat the whole thing as one account name
  if (accounts.length === 0 && text.trim()) {
    accounts.push({ name: text.trim() });
  }
  
  return accounts.length > 0 ? accounts : null;
}

type SectionType = 'none' | 'completed' | 'responses' | 'outcomes' | 'todo' | 'notes';

function detectSection(line: string): SectionType | null {
  const lower = line.toLowerCase().trim();
  
  // Original format headers
  if (lower === 'completed:' || lower === 'completed') return 'completed';
  if (lower.startsWith('completed:')) return 'completed';
  
  if (lower === 'responses:' || lower === 'responses') return 'responses';
  if (lower.startsWith('responses:')) return 'responses';
  
  if (lower === 'outcomes:' || lower === 'outcomes') return 'outcomes';
  if (lower.startsWith('outcomes:')) return 'outcomes';
  
  if (lower === 'todo:' || lower === 'todo' || lower === 'to do:' || lower === 'to do' || lower === 'to-do:' || lower === 'to-do') return 'todo';
  if (lower.startsWith('todo:') || lower.startsWith('to do:') || lower.startsWith('to-do:')) return 'todo';
  
  if (lower === 'notes:' || lower === 'notes') return 'notes';
  if (lower.startsWith('notes:')) return 'notes';
  
  // Alternative format headers (COMPLETED ACTIONS, etc.)
  if (lower.includes('completed actions') || lower.includes('completed items')) return 'completed';
  if (lower.includes('response') && (lower.includes('received') || lower.includes('log'))) return 'responses';
  if (lower.includes('outcome') || lower.includes('results')) return 'outcomes';
  if (lower.includes('pending') || lower.includes('task') || lower.includes('action items')) return 'todo';
  if (lower.includes('note') && !lower.includes('notification')) return 'notes';
  
  return null;
}

function isHeaderLine(line: string): boolean {
  const lower = line.toLowerCase().trim();
  // Skip lines that are clearly headers or meta
  return (
    lower.startsWith('client_update') ||
    lower.startsWith('client:') ||
    lower.startsWith('date:') ||
    lower.startsWith('---') ||
    lower.startsWith('===') ||
    lower.startsWith('###') ||
    lower === ''
  );
}

/**
 * Parse Completed row: DATE | ACTION_TYPE | ENTITY | DETAILS | PROOF
 */
function parseCompletedRow(parts: string[], clientId: string): Omit<TimelineEvent, 'id' | 'created_at'> | null {
  if (parts.length < 2) return null;
  
  const dateStr = parseDate(parts[0]);
  if (!dateStr) return null;
  
  const actionType = parts[1]?.trim() || 'Action';
  const entity = parts[2]?.trim() || '';
  const details = parts[3]?.trim() || '';
  const proof = parts[4]?.trim() || '';
  
  const source = parseSource(entity) || parseSource(actionType);
  const summary = [actionType, entity, details].filter(Boolean).join(' - ');
  
  return {
    client_id: clientId,
    event_date: dateStr,
    category: 'Action' as EventCategory,
    source,
    title: actionType,
    summary: summary || actionType,
    details: proof || null,
    related_accounts: null,
  };
}

/**
 * Parse Responses row: DATE | ENTITY | RESPONSE_TYPE | DETAILS | ACCOUNT [| ACCOUNT_NUMBER]
 * Supports both 5-column and 6-column formats
 */
function parseResponsesRow(parts: string[], clientId: string): Omit<TimelineEvent, 'id' | 'created_at'> | null {
  if (parts.length < 2) return null;
  
  const dateStr = parseDate(parts[0]);
  if (!dateStr) return null;
  
  const entity = parts[1]?.trim() || '';
  const responseType = parts[2]?.trim() || 'Response';
  const details = parts[3]?.trim() || '';
  
  // Handle both 5-column (account in col 5) and 6-column (account name in col 5, number in col 6) formats
  let accountStr = '';
  if (parts.length >= 6 && parts[5]?.trim() && parts[5].trim() !== 'N/A') {
    // 6-column format: combine account name and number
    const accountName = parts[4]?.trim() || '';
    const accountNumber = parts[5]?.trim() || '';
    accountStr = accountNumber ? `${accountName} (${accountNumber})` : accountName;
  } else {
    accountStr = parts[4]?.trim() || '';
  }
  
  const source = parseSource(entity) || 'Other';
  
  return {
    client_id: clientId,
    event_date: dateStr,
    category: 'Response' as EventCategory,
    source,
    title: `${source} Response`,
    summary: responseType,
    details: details || null,
    related_accounts: parseAccounts(accountStr),
  };
}

/**
 * Parse Outcomes row: DATE | ENTITY | OUTCOME_TYPE | DETAILS | ACCOUNT [| ACCOUNT_NUMBER]
 * Supports both 5-column and 6-column formats
 */
function parseOutcomesRow(parts: string[], clientId: string): Omit<TimelineEvent, 'id' | 'created_at'> | null {
  if (parts.length < 2) return null;
  
  const dateStr = parseDate(parts[0]);
  if (!dateStr) return null;
  
  const entity = parts[1]?.trim() || '';
  const outcomeType = parts[2]?.trim() || 'Outcome';
  const details = parts[3]?.trim() || '';
  
  // Handle both 5-column and 6-column formats
  let accountStr = '';
  if (parts.length >= 6 && parts[5]?.trim() && parts[5].trim() !== 'N/A') {
    const accountName = parts[4]?.trim() || '';
    const accountNumber = parts[5]?.trim() || '';
    accountStr = accountNumber ? `${accountName} (${accountNumber})` : accountName;
  } else {
    accountStr = parts[4]?.trim() || '';
  }
  
  const source = parseSource(entity);
  
  return {
    client_id: clientId,
    event_date: dateStr,
    category: 'Outcome' as EventCategory,
    source,
    title: 'Outcome',
    summary: [outcomeType, details].filter(Boolean).join(' - ') || outcomeType,
    details: null,
    related_accounts: parseAccounts(accountStr),
  };
}

/**
 * Parse ToDo row: DUE_DATE | TASK | ENTITY | PRIORITY | DETAILS
 */
function parseToDoRow(parts: string[], clientId: string): Omit<OperatorTask, 'id' | 'created_at'> | null {
  if (parts.length < 2) return null;
  
  const dueDateStr = parseDate(parts[0]);
  const task = parts[1]?.trim() || '';
  const entity = parts[2]?.trim() || '';
  const priorityStr = parts[3]?.trim() || '';
  const details = parts[4]?.trim() || '';
  
  if (!task) return null;
  
  const title = [task, entity, details].filter(Boolean).join(' - ');
  
  return {
    client_id: clientId,
    title: title || task,
    due_date: dueDateStr,
    priority: parsePriority(priorityStr),
    status: 'Open',
  };
}

/**
 * Parse Notes row: DATE | NOTE
 */
function parseNotesRow(parts: string[], clientId: string): Omit<TimelineEvent, 'id' | 'created_at'> | null {
  if (parts.length < 1) return null;
  
  let dateStr = parseDate(parts[0]);
  let noteContent: string;
  
  if (dateStr && parts.length >= 2) {
    noteContent = parts.slice(1).join(' | ').trim();
  } else {
    // No valid date in first column, use today and treat entire line as note
    dateStr = new Date().toISOString().split('T')[0];
    noteContent = parts.join(' | ').trim();
  }
  
  if (!noteContent) return null;
  
  return {
    client_id: clientId,
    event_date: dateStr,
    category: 'Note' as EventCategory,
    source: null,
    title: 'Note',
    summary: noteContent,
    details: null,
    related_accounts: null,
  };
}

export function parseChatGPTUpdate(input: string, clientId: string): ParseResult {
  const result: ParseResult = {
    events: [],
    tasks: [],
    errors: [],
    counts: {
      completed: 0,
      responses: 0,
      outcomes: 0,
      todo: 0,
      notes: 0,
    },
  };
  
  if (!input || !input.trim()) {
    result.errors.push('No input provided');
    return result;
  }
  
  const lines = input.split('\n');
  let currentSection: SectionType = 'none';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip empty lines and header lines
    if (!line || isHeaderLine(line)) continue;
    
    // Check if this is a section header
    const detectedSection = detectSection(line);
    if (detectedSection) {
      currentSection = detectedSection;
      continue;
    }
    
    // Skip if we haven't entered a section yet
    if (currentSection === 'none') continue;
    
    // Remove bullet points or list markers
    const cleanLine = line.replace(/^[-*•]\s*/, '').replace(/^\d+\.\s*/, '').trim();
    if (!cleanLine) continue;
    
    // Split by pipe
    const parts = cleanLine.split('|').map(p => p.trim());
    
    // Skip if no pipe delimiter found (invalid format)
    if (parts.length < 2) {
      // For notes, we can accept single-column entries
      if (currentSection === 'notes') {
        const noteEvent = parseNotesRow([cleanLine], clientId);
        if (noteEvent) {
          result.events.push(noteEvent);
          result.counts.notes++;
        }
        continue;
      } else {
        result.errors.push(`Invalid format (no pipes) at line ${i + 1}: "${cleanLine.substring(0, 50)}..."`);
      }
      continue;
    }
    
    try {
      switch (currentSection) {
        case 'completed': {
          const event = parseCompletedRow(parts, clientId);
          if (event) {
            result.events.push(event);
            result.counts.completed++;
          } else {
            result.errors.push(`Could not parse Completed row at line ${i + 1}`);
          }
          break;
        }
        
        case 'responses': {
          const event = parseResponsesRow(parts, clientId);
          if (event) {
            result.events.push(event);
            result.counts.responses++;
          } else {
            result.errors.push(`Could not parse Responses row at line ${i + 1}`);
          }
          break;
        }
        
        case 'outcomes': {
          const event = parseOutcomesRow(parts, clientId);
          if (event) {
            result.events.push(event);
            result.counts.outcomes++;
          } else {
            result.errors.push(`Could not parse Outcomes row at line ${i + 1}`);
          }
          break;
        }
        
        case 'todo': {
          const task = parseToDoRow(parts, clientId);
          if (task) {
            result.tasks.push(task);
            result.counts.todo++;
          } else {
            result.errors.push(`Could not parse ToDo row at line ${i + 1}`);
          }
          break;
        }
        
        case 'notes': {
          const event = parseNotesRow(parts, clientId);
          if (event) {
            result.events.push(event);
            result.counts.notes++;
          } else {
            result.errors.push(`Could not parse Notes row at line ${i + 1}`);
          }
          break;
        }
      }
    } catch (e) {
      result.errors.push(`Error parsing line ${i + 1}: "${cleanLine.substring(0, 50)}..."`);
    }
  }
  
  // Add error if nothing was parsed
  if (result.events.length === 0 && result.tasks.length === 0) {
    result.errors.unshift('0 rows parsed — check headers and pipe format');
  }
  
  return result;
}

/**
 * Generate example format text for the UI
 */
export function getFormatExample(): string {
  return `Completed:
2025-01-15 | Freeze Request | LexisNexis | Submitted via portal | Screenshot saved
2025-01-20 | Dispute Letter | Experian | Account XYZ | Certified mail

Responses:
2025-02-10 | Experian | Verified | No documentation provided | Account XYZ (****1234)
2025-02-15 | TransUnion | Deleted | Removed from report | -

Outcomes:
2025-02-15 | Innovis | Account Removed | 2 accounts deleted | -
2025-02-20 | Equifax | Score Increased | +45 points | -

ToDo:
2025-02-25 | File CFPB Complaint | CFPB | High | Re: Experian violation
2025-03-01 | Follow up letter | TransUnion | Medium | Second dispute

Notes:
2025-01-18 | Client confirmed identity theft report filed with FTC`;
}
