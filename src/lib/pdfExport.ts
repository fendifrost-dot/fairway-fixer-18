import { TimelineEvent, OperatorTask } from '@/types/operator';
import { format, parseISO } from 'date-fns';

interface ClientInfo {
  legal_name: string;
  preferred_name?: string | null;
  email?: string | null;
  phone?: string | null;
}

export function generateClientStatusReportHTML(
  client: ClientInfo,
  events: TimelineEvent[],
  tasks: OperatorTask[]
): string {
  const now = format(new Date(), 'MMMM d, yyyy');
  const clientName = client.preferred_name || client.legal_name;
  
   // PDF MUST include ALL timeline_events where:
   // - client_id = current client (already filtered by caller)
   // - event_kind IN ('action','response','outcome') (already filtered by useTimelineEvents)
   // - is_draft = false (already filtered by useTimelineEvents)
   // NO additional filtering, recency limits, or heuristics permitted.
   
   // Group events by event_kind (NOT category) - filters on exact lowercase values
   const actions = events.filter(e => e.event_kind === 'action').sort((a, b) => 
    new Date(b.event_date).getTime() - new Date(a.event_date).getTime()
  );
   const responses = events.filter(e => e.event_kind === 'response').sort((a, b) => 
    new Date(b.event_date).getTime() - new Date(a.event_date).getTime()
  );
   const outcomes = events.filter(e => e.event_kind === 'outcome').sort((a, b) => 
    new Date(b.event_date).getTime() - new Date(a.event_date).getTime()
  );
  
  // Get open tasks
  const openTasks = tasks.filter(t => t.status === 'Open').sort((a, b) => {
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
  });

   // Render date or "Date unknown" if date_is_unknown = true or no date
   const formatEventDate = (event: TimelineEvent) => {
     if (event.date_is_unknown || !event.event_date) {
       return 'Date unknown';
     }
    try {
       return format(parseISO(event.event_date), 'MMM d, yyyy');
    } catch {
       return 'Date unknown';
    }
  };
   
   // Render raw_line verbatim - no edits, trimming, summarization, or interpretation
   const formatRawLine = (event: TimelineEvent) => {
      // STRICT: raw_line only, no fallback to derived fields
      return event.raw_line || '';
   };

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Client Status Report - ${clientName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 11pt;
      line-height: 1.5;
      color: #1a1a1a;
      padding: 40px;
      max-width: 800px;
      margin: 0 auto;
    }
    h1 { font-size: 18pt; margin-bottom: 8px; color: #111; }
    h2 { font-size: 13pt; margin: 24px 0 12px; padding-bottom: 4px; border-bottom: 1px solid #ddd; color: #333; }
    .header { margin-bottom: 24px; padding-bottom: 16px; border-bottom: 2px solid #333; }
    .date { color: #666; font-size: 10pt; }
    .contact { color: #666; font-size: 10pt; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    th, td { text-align: left; padding: 8px 12px; border-bottom: 1px solid #eee; vertical-align: top; }
    th { background: #f5f5f5; font-weight: 600; font-size: 10pt; color: #555; }
    td { font-size: 10pt; }
    .date-col { width: 90px; white-space: nowrap; }
    .source-col { width: 100px; }
    .priority-col { width: 70px; }
     .content-col { word-break: break-word; }
    .empty { color: #999; font-style: italic; padding: 16px; text-align: center; }
    .badge { 
      display: inline-block; 
      padding: 2px 8px; 
      border-radius: 4px; 
      font-size: 9pt; 
      font-weight: 500;
    }
    .badge-high { background: #fee2e2; color: #dc2626; }
    .badge-medium { background: #fef3c7; color: #d97706; }
    .badge-low { background: #dbeafe; color: #2563eb; }
    .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #ddd; font-size: 9pt; color: #666; text-align: center; }
    @media print {
      body { padding: 20px; }
      h2 { page-break-after: avoid; }
      table { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Credit File Status Report</h1>
    <div class="date">Prepared: ${now}</div>
    <div class="contact">${clientName}${client.email ? ` • ${client.email}` : ''}${client.phone ? ` • ${client.phone}` : ''}</div>
  </div>

  <h2>Completed Actions</h2>
  ${actions.length > 0 ? `
  <table>
    <thead>
      <tr>
        <th class="date-col">Date</th>
        <th class="source-col">Source</th>
         <th class="content-col">Action</th>
      </tr>
    </thead>
    <tbody>
      ${actions.map(a => `
      <tr>
         <td class="date-col">${formatEventDate(a)}</td>
        <td class="source-col">${a.source || '-'}</td>
         <td class="content-col">${formatRawLine(a)}</td>
      </tr>
      `).join('')}
    </tbody>
  </table>
  ` : '<div class="empty">No completed actions recorded.</div>'}

  <h2>Responses Received</h2>
  ${responses.length > 0 ? `
  <table>
    <thead>
      <tr>
        <th class="date-col">Date</th>
        <th class="source-col">From</th>
         <th class="content-col">Response</th>
      </tr>
    </thead>
    <tbody>
      ${responses.map(r => `
      <tr>
         <td class="date-col">${formatEventDate(r)}</td>
        <td class="source-col">${r.source || '-'}</td>
         <td class="content-col">${formatRawLine(r)}</td>
      </tr>
      `).join('')}
    </tbody>
  </table>
  ` : '<div class="empty">No responses recorded.</div>'}

  <h2>Outcomes</h2>
  ${outcomes.length > 0 ? `
  <table>
    <thead>
      <tr>
        <th class="date-col">Date</th>
         <th class="content-col">Outcome</th>
      </tr>
    </thead>
    <tbody>
      ${outcomes.map(o => `
      <tr>
         <td class="date-col">${formatEventDate(o)}</td>
         <td class="content-col">${formatRawLine(o)}</td>
      </tr>
      `).join('')}
    </tbody>
  </table>
  ` : '<div class="empty">No outcomes recorded.</div>'}

  <h2>Open Tasks</h2>
  ${openTasks.length > 0 ? `
  <table>
    <thead>
      <tr>
        <th>Task</th>
        <th class="date-col">Due Date</th>
        <th class="priority-col">Priority</th>
      </tr>
    </thead>
    <tbody>
      ${openTasks.map(t => `
      <tr>
        <td>${t.title}</td>
         <td class="date-col">${t.due_date ? format(parseISO(t.due_date), 'MMM d, yyyy') : '-'}</td>
        <td class="priority-col"><span class="badge badge-${t.priority.toLowerCase()}">${t.priority}</span></td>
      </tr>
      `).join('')}
    </tbody>
  </table>
  ` : '<div class="empty">No open tasks.</div>'}

  <div class="footer">
    This report was generated on ${now}. For questions, please contact your credit specialist.
  </div>
</body>
</html>
`;
}

export function downloadPDF(
  client: ClientInfo,
  events: TimelineEvent[],
  tasks: OperatorTask[]
): void {
  const html = generateClientStatusReportHTML(client, events, tasks);
  
  // Create a new window for printing
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups to generate the PDF');
    return;
  }
  
  printWindow.document.write(html);
  printWindow.document.close();
  
  // Wait for content to load then print
  printWindow.onload = () => {
    printWindow.print();
  };
}
