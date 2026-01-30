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
}

function parseDate(dateStr: string): string | null {
  // Try YYYY-MM-DD format
  const isoMatch = dateStr.match(/(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) {
    return isoMatch[1];
  }
  
  // Try MM/DD/YYYY format
  const usMatch = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (usMatch) {
    const [, month, day, year] = usMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  return null;
}

function parseSource(text: string): EventSource | null {
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
  if (normalized.includes('lexisnexis') || normalized.includes('lexis nexis')) return 'LexisNexis';
  if (normalized.includes('corelogic') || normalized.includes('core logic')) return 'CoreLogic';
  if (normalized.includes('innovis')) return 'Innovis';
  if (normalized.includes('sagestream') || normalized.includes('sage stream')) return 'Sagestream';
  if (normalized.includes('chexsystems') || normalized.includes('chex systems')) return 'ChexSystems';
  if (normalized.includes('ews') || normalized.includes('early warning')) return 'EWS';
  if (normalized.includes('nctue')) return 'NCTUE';
  if (normalized.includes('cfpb') || normalized.includes('consumer financial')) return 'CFPB';
  if (normalized.includes('bbb') || normalized.includes('better business')) return 'BBB';
  if (normalized.includes('attorney general') || normalized.includes(' ag ')) return 'AG';
  
  return null;
}

function parsePriority(text: string): SimplePriority {
  const normalized = text.toLowerCase().trim();
  if (normalized.includes('high')) return 'High';
  if (normalized.includes('low')) return 'Low';
  return 'Medium';
}

function parseAccounts(text: string): RelatedAccount[] | null {
  if (!text || text.trim() === '') return null;
  
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

export function parseChatGPTUpdate(input: string, clientId: string): ParseResult {
  const result: ParseResult = {
    events: [],
    tasks: [],
    errors: [],
  };
  
  const lines = input.split('\n').map(l => l.trim()).filter(l => l);
  
  let currentSection: 'none' | 'completed' | 'responses' | 'outcomes' | 'todo' | 'notes' = 'none';
  
  for (const line of lines) {
    const lowerLine = line.toLowerCase();
    
    // Detect section headers
    if (lowerLine.startsWith('completed:') || lowerLine === 'completed') {
      currentSection = 'completed';
      continue;
    }
    if (lowerLine.startsWith('responses:') || lowerLine === 'responses') {
      currentSection = 'responses';
      continue;
    }
    if (lowerLine.startsWith('outcomes:') || lowerLine === 'outcomes') {
      currentSection = 'outcomes';
      continue;
    }
    if (lowerLine.startsWith('todo:') || lowerLine === 'todo' || lowerLine.startsWith('to do:') || lowerLine === 'to do') {
      currentSection = 'todo';
      continue;
    }
    if (lowerLine.startsWith('notes:') || lowerLine === 'notes') {
      currentSection = 'notes';
      continue;
    }
    
    // Skip header lines
    if (lowerLine.startsWith('client_update:') || lowerLine.startsWith('client:')) {
      continue;
    }
    
    // Skip empty bullet points
    if (line === '-' || line === '*') continue;
    
    // Parse line based on section
    const cleanLine = line.replace(/^[-*]\s*/, '').trim();
    if (!cleanLine) continue;
    
    try {
      switch (currentSection) {
        case 'completed': {
          // Format: <Action> | <YYYY-MM-DD> | <optional note>
          const parts = cleanLine.split('|').map(p => p.trim());
          if (parts.length >= 2) {
            const title = parts[0];
            const dateStr = parseDate(parts[1]);
            const note = parts[2] || '';
            
            if (dateStr) {
              const source = parseSource(title);
              result.events.push({
                client_id: clientId,
                event_date: dateStr,
                category: 'Action',
                source,
                title,
                summary: note || title,
                details: null,
                related_accounts: null,
              });
            } else {
              result.errors.push(`Invalid date in Completed: "${cleanLine}"`);
            }
          } else {
            result.errors.push(`Invalid format in Completed: "${cleanLine}"`);
          }
          break;
        }
        
        case 'responses': {
          // Format: <Source> | <YYYY-MM-DD> | <summary> | <optional violations> | <optional accounts>
          const parts = cleanLine.split('|').map(p => p.trim());
          if (parts.length >= 3) {
            const sourceStr = parts[0];
            const dateStr = parseDate(parts[1]);
            const summary = parts[2];
            const violations = parts[3] || '';
            const accountsStr = parts[4] || '';
            
            if (dateStr) {
              const source = parseSource(sourceStr) || 'Other';
              result.events.push({
                client_id: clientId,
                event_date: dateStr,
                category: 'Response',
                source,
                title: `${source} Response`,
                summary,
                details: violations || null,
                related_accounts: parseAccounts(accountsStr),
              });
            } else {
              result.errors.push(`Invalid date in Responses: "${cleanLine}"`);
            }
          } else {
            result.errors.push(`Invalid format in Responses: "${cleanLine}"`);
          }
          break;
        }
        
        case 'outcomes': {
          // Format: <YYYY-MM-DD> | <what changed>
          const parts = cleanLine.split('|').map(p => p.trim());
          if (parts.length >= 2) {
            const dateStr = parseDate(parts[0]);
            const summary = parts[1];
            
            if (dateStr) {
              const source = parseSource(summary);
              result.events.push({
                client_id: clientId,
                event_date: dateStr,
                category: 'Outcome',
                source,
                title: 'Outcome',
                summary,
                details: null,
                related_accounts: null,
              });
            } else {
              result.errors.push(`Invalid date in Outcomes: "${cleanLine}"`);
            }
          } else {
            result.errors.push(`Invalid format in Outcomes: "${cleanLine}"`);
          }
          break;
        }
        
        case 'todo': {
          // Format: <Task title> | Due: <YYYY-MM-DD> | Priority: <Low/Medium/High>
          const parts = cleanLine.split('|').map(p => p.trim());
          if (parts.length >= 1) {
            const title = parts[0];
            let dueDate: string | null = null;
            let priority: SimplePriority = 'Medium';
            
            for (const part of parts.slice(1)) {
              if (part.toLowerCase().startsWith('due:')) {
                dueDate = parseDate(part.replace(/due:\s*/i, ''));
              } else if (part.toLowerCase().startsWith('priority:')) {
                priority = parsePriority(part.replace(/priority:\s*/i, ''));
              }
            }
            
            result.tasks.push({
              client_id: clientId,
              title,
              due_date: dueDate,
              priority,
              status: 'Open',
            });
          }
          break;
        }
        
        case 'notes': {
          // Format: <YYYY-MM-DD> | <note content> OR just <note content>
          const parts = cleanLine.split('|').map(p => p.trim());
          let dateStr = new Date().toISOString().split('T')[0];
          let content = cleanLine;
          
          if (parts.length >= 2 && parseDate(parts[0])) {
            dateStr = parseDate(parts[0])!;
            content = parts.slice(1).join(' | ');
          }
          
          result.events.push({
            client_id: clientId,
            event_date: dateStr,
            category: 'Note',
            source: null,
            title: 'Note',
            summary: content,
            details: null,
            related_accounts: null,
          });
          break;
        }
      }
    } catch (e) {
      result.errors.push(`Error parsing line: "${cleanLine}"`);
    }
  }
  
  return result;
}
