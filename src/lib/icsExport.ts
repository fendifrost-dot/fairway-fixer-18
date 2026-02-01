/**
 * ICS file generation for calendar integration
 * Works with Google Calendar, Apple Calendar, Outlook, etc.
 */

interface ICSEvent {
  title: string;
  description?: string;
  startDate: Date;
  endDate?: Date;
  allDay?: boolean;
}

function formatDateForICS(date: Date, allDay: boolean = false): string {
  if (allDay) {
    // For all-day events: YYYYMMDD
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
  }
  
  // For timed events: YYYYMMDDTHHMMSSZ
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function escapeICSText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

function generateUID(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}@lovable.app`;
}

export function generateICSContent(event: ICSEvent): string {
  const uid = generateUID();
  const now = formatDateForICS(new Date());
  const startDate = formatDateForICS(event.startDate, event.allDay);
  const endDate = event.endDate 
    ? formatDateForICS(event.endDate, event.allDay)
    : event.allDay
      ? formatDateForICS(new Date(event.startDate.getTime() + 24 * 60 * 60 * 1000), true) // Next day for all-day
      : formatDateForICS(new Date(event.startDate.getTime() + 60 * 60 * 1000)); // +1 hour
  
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Lovable//Credit Operator Console//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${now}`,
  ];
  
  if (event.allDay) {
    lines.push(`DTSTART;VALUE=DATE:${startDate}`);
    lines.push(`DTEND;VALUE=DATE:${endDate}`);
  } else {
    lines.push(`DTSTART:${startDate}`);
    lines.push(`DTEND:${endDate}`);
  }
  
  lines.push(`SUMMARY:${escapeICSText(event.title)}`);
  
  if (event.description) {
    lines.push(`DESCRIPTION:${escapeICSText(event.description)}`);
  }
  
  lines.push('END:VEVENT');
  lines.push('END:VCALENDAR');
  
  return lines.join('\r\n');
}

export function downloadICSFile(event: ICSEvent, filename?: string): void {
  const content = generateICSContent(event);
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || `${event.title.replace(/[^a-zA-Z0-9]/g, '_')}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generate Google Calendar URL for a quick add
 */
export function generateGoogleCalendarUrl(event: ICSEvent): string {
  const formatGoogleDate = (date: Date, allDay: boolean = false): string => {
    if (allDay) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}${month}${day}`;
    }
    return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  };
  
  const start = formatGoogleDate(event.startDate, event.allDay);
  const end = event.endDate 
    ? formatGoogleDate(event.endDate, event.allDay)
    : event.allDay
      ? formatGoogleDate(new Date(event.startDate.getTime() + 24 * 60 * 60 * 1000), true)
      : formatGoogleDate(new Date(event.startDate.getTime() + 60 * 60 * 1000));
  
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${start}/${end}`,
  });
  
  if (event.description) {
    params.set('details', event.description);
  }
  
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
