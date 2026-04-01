export interface CalendarEvent {
  id: string;
  title: string;
  startAt: Date;
  endAt: Date;
  description: string;
  location?: string;
  sourceType: 'follow_up' | 'site_visit' | 'booking';
  sourceId: string;
}

function formatDateUTC(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  const h = String(date.getUTCHours()).padStart(2, '0');
  const min = String(date.getUTCMinutes()).padStart(2, '0');
  const s = String(date.getUTCSeconds()).padStart(2, '0');
  return `${y}${m}${d}T${h}${min}${s}Z`;
}

function escapeICSText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [];
  parts.push(line.substring(0, 75));
  let pos = 75;
  while (pos < line.length) {
    parts.push(' ' + line.substring(pos, pos + 74));
    pos += 74;
  }
  return parts.join('\r\n');
}

export function generateICS(event: CalendarEvent): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Hsquare Living//Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${event.id}@hsquareliving.com`,
    `DTSTAMP:${formatDateUTC(new Date())}`,
    `DTSTART:${formatDateUTC(event.startAt)}`,
    `DTEND:${formatDateUTC(event.endAt)}`,
    `SUMMARY:${escapeICSText(event.title)}`,
    foldLine(`DESCRIPTION:${escapeICSText(event.description)}`),
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    'TRANSP:OPAQUE',
  ];

  if (event.location) {
    lines.push(foldLine(`LOCATION:${escapeICSText(event.location)}`));
  }

  lines.push('END:VEVENT', 'END:VCALENDAR');
  return lines.join('\r\n');
}

export function generateICSFeed(events: CalendarEvent[], calendarName: string): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Hsquare Living//Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    foldLine(`X-WR-CALNAME:${escapeICSText(calendarName)}`),
    'X-WR-CALDESC:Hsquare Living - Follow-ups\\, Site Visits & Bookings',
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
    'X-PUBLISHED-TTL:PT1H',
  ];

  for (const event of events) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${event.id}@hsquareliving.com`,
      `DTSTAMP:${formatDateUTC(new Date())}`,
      `DTSTART:${formatDateUTC(event.startAt)}`,
      `DTEND:${formatDateUTC(event.endAt)}`,
      foldLine(`SUMMARY:${escapeICSText(event.title)}`),
      foldLine(`DESCRIPTION:${escapeICSText(event.description)}`),
      'STATUS:CONFIRMED',
      'SEQUENCE:0',
      'TRANSP:OPAQUE',
    );
    if (event.location) {
      lines.push(foldLine(`LOCATION:${escapeICSText(event.location)}`));
    }
    lines.push(
      'BEGIN:VALARM',
      'TRIGGER:-PT30M',
      'ACTION:DISPLAY',
      foldLine(`DESCRIPTION:${escapeICSText(event.title)} in 30 minutes`),
      'END:VALARM',
      'BEGIN:VALARM',
      'TRIGGER:-PT10M',
      'ACTION:DISPLAY',
      foldLine(`DESCRIPTION:${escapeICSText(event.title)} in 10 minutes`),
      'END:VALARM',
      'END:VEVENT',
    );
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export function buildGoogleCalendarUrl(event: CalendarEvent): string {
  const start = formatDateUTC(event.startAt);
  const end = formatDateUTC(event.endAt);
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${start}/${end}`,
    details: event.description,
  });
  if (event.location) {
    params.set('location', event.location);
  }
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
