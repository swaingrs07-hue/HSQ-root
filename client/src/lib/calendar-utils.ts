function formatDateUTC(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  const h = String(date.getUTCHours()).padStart(2, '0');
  const min = String(date.getUTCMinutes()).padStart(2, '0');
  const s = String(date.getUTCSeconds()).padStart(2, '0');
  return `${y}${m}${d}T${h}${min}${s}Z`;
}

export function buildGoogleCalendarUrl(title: string, startAt: string, endAt: string, description: string, location?: string): string {
  const start = formatDateUTC(new Date(startAt));
  const end = formatDateUTC(new Date(endAt));
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${start}/${end}`,
    details: description,
  });
  if (location) {
    params.set('location', location);
  }
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export async function downloadICS(sourceType: string, sourceId: string): Promise<void> {
  const token = getAuthToken();
  if (!token) return;
  try {
    const response = await fetch(`/api/calendar/events/${sourceType}/${sourceId}/ics`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('Failed to download');
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'event.ics';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch {
    console.error('Failed to download ICS file');
  }
}

export function formatCalendarDate(date: string): string {
  const d = new Date(date);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = days[d.getDay()];
  const month = months[d.getMonth()];
  const dateNum = d.getDate();
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${day}, ${month} ${dateNum} at ${hours}:${minutes} ${ampm}`;
}

function getAuthToken(): string {
  try {
    const auth = JSON.parse(localStorage.getItem("hsquare_auth") || "{}");
    return auth.token || "";
  } catch { return ""; }
}
