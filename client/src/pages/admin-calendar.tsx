import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, CalendarDays, Download, ExternalLink, Link2, Smartphone, Copy, Check } from "lucide-react";
import { buildGoogleCalendarUrl, downloadICS, formatCalendarDate } from "@/lib/calendar-utils";

interface CalendarEvent {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  description: string;
  location?: string;
  sourceType: string;
  sourceId: string;
  leadName: string;
}

function getAuthToken(): string {
  try {
    const auth = JSON.parse(localStorage.getItem("hsquare_auth") || "{}");
    return auth.token || "";
  } catch { return ""; }
}

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

function getSourceColor(sourceType: string) {
  switch (sourceType) {
    case "follow_up": return "bg-blue-500";
    case "site_visit": return "bg-emerald-500";
    case "booking": return "bg-orange-500";
    default: return "bg-slate-500";
  }
}

function getSourceBadge(sourceType: string) {
  switch (sourceType) {
    case "follow_up": return <Badge className="bg-blue-100 text-blue-700 border-blue-200" data-testid={`badge-type-${sourceType}`}>Follow-up</Badge>;
    case "site_visit": return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200" data-testid={`badge-type-${sourceType}`}>Site Visit</Badge>;
    case "booking": return <Badge className="bg-orange-100 text-orange-700 border-orange-200" data-testid={`badge-type-${sourceType}`}>Booking</Badge>;
    default: return <Badge variant="outline" data-testid={`badge-type-${sourceType}`}>{sourceType}</Badge>;
  }
}

export default function AdminCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [feedUrl, setFeedUrl] = useState<string>("");
  const [webcalUrl, setWebcalUrl] = useState<string>("");
  const [showSyncPanel, setShowSyncPanel] = useState(false);
  const [copied, setCopied] = useState(false);
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedError, setFeedError] = useState("");

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  useEffect(() => {
    fetchEvents();
  }, [year, month]);

  const fetchFeedUrl = async () => {
    setFeedLoading(true);
    setFeedError("");
    try {
      const res = await fetch("/api/calendar/feed-url", {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });
      if (res.ok) {
        const data = await res.json();
        setFeedUrl(data.feedUrl);
        setWebcalUrl(data.webcalUrl);
      } else {
        const err = await res.json().catch(() => ({}));
        setFeedError(err.error || "Failed to load feed URL");
      }
    } catch {
      setFeedError("Network error loading feed URL");
    } finally {
      setFeedLoading(false);
    }
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(feedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const from = new Date(year, month, 1).toISOString();
      const to = new Date(year, month + 1, 0, 23, 59, 59).toISOString();
      const res = await fetch(`/api/calendar/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });
      if (!res.ok) throw new Error("Failed to fetch events");
      const data = await res.json();
      setEvents(data);
    } catch (error) {
      console.error("Failed to fetch calendar events:", error);
    } finally {
      setLoading(false);
    }
  };

  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const days: Array<{ date: number; month: number; year: number; isCurrentMonth: boolean }> = [];

    for (let i = firstDay - 1; i >= 0; i--) {
      days.push({ date: daysInPrevMonth - i, month: month - 1, year, isCurrentMonth: false });
    }

    for (let i = 1; i <= daysInMonth; i++) {
      days.push({ date: i, month, year, isCurrentMonth: true });
    }

    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({ date: i, month: month + 1, year, isCurrentMonth: false });
    }

    return days;
  }, [year, month]);

  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const event of events) {
      const dateKey = new Date(event.startAt).toISOString().split("T")[0];
      if (!map[dateKey]) map[dateKey] = [];
      map[dateKey].push(event);
    }
    return map;
  }, [events]);

  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const selectedEvents = selectedDate ? (eventsByDate[selectedDate] || []) : [];

  const goToPrevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const goToNextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(todayKey);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2" data-testid="text-calendar-title">
            <CalendarDays className="w-7 h-7 text-indigo-500" />
            Calendar
          </h1>
          <p className="text-sm text-slate-500 mt-1">View follow-ups, site visits, and bookings</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              if (!feedUrl) fetchFeedUrl();
              setShowSyncPanel(!showSyncPanel);
            }}
            data-testid="button-sync-calendar"
          >
            <Smartphone className="w-4 h-4 mr-1.5" />
            Sync to Device
          </Button>
          <Button onClick={goToToday} variant="outline" data-testid="button-today">
            Today
          </Button>
        </div>
      </div>

      {showSyncPanel && (
        <Card className="border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/20">
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-indigo-100 dark:bg-indigo-900/40 rounded-lg">
                <Link2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div className="flex-1 space-y-3">
                <div>
                  <h3 className="font-semibold text-slate-800 dark:text-white text-sm">Sync Calendar to Your Device</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Subscribe once, and all your follow-ups and site visits will auto-sync to your phone's calendar with reminders (30 min and 10 min before each event).</p>
                </div>
                {feedLoading ? (
                  <p className="text-sm text-slate-500">Loading feed URL...</p>
                ) : feedError ? (
                  <p className="text-sm text-red-500" data-testid="text-feed-error">{feedError}</p>
                ) : (
                  <>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <a
                        href={webcalUrl || "#"}
                        className={`inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors ${!webcalUrl ? "pointer-events-none opacity-50" : ""}`}
                        data-testid="button-subscribe-calendar"
                      >
                        <Smartphone className="w-4 h-4" />
                        Subscribe (iPhone / Mac)
                      </a>
                      <a
                        href={feedUrl ? `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(feedUrl)}` : "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-medium rounded-lg transition-colors ${!feedUrl ? "pointer-events-none opacity-50" : ""}`}
                        data-testid="button-subscribe-google"
                      >
                        <ExternalLink className="w-4 h-4" />
                        Add to Google Calendar
                      </a>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9"
                        onClick={handleCopyUrl}
                        disabled={!feedUrl}
                        data-testid="button-copy-feed-url"
                      >
                        {copied ? <Check className="w-4 h-4 mr-1.5 text-green-500" /> : <Copy className="w-4 h-4 mr-1.5" />}
                        {copied ? "Copied!" : "Copy URL"}
                      </Button>
                    </div>
                    {feedUrl && (
                      <p className="text-xs text-slate-400 break-all font-mono bg-white dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-700" data-testid="text-feed-url">
                        {feedUrl}
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <Button variant="ghost" size="icon" onClick={goToPrevMonth} data-testid="button-prev-month">
                  <ChevronLeft className="w-5 h-5" />
                </Button>
                <CardTitle className="text-lg" data-testid="text-current-month">
                  {MONTH_NAMES[month]} {year}
                </CardTitle>
                <Button variant="ghost" size="icon" onClick={goToNextMonth} data-testid="button-next-month">
                  <ChevronRight className="w-5 h-5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-px">
                {DAYS_OF_WEEK.map((day) => (
                  <div key={day} className="text-center text-xs font-medium text-slate-500 py-2">
                    {day}
                  </div>
                ))}
                {calendarDays.map((day, idx) => {
                  const dateKey = `${day.year}-${String(day.month + 1).padStart(2, "0")}-${String(day.date).padStart(2, "0")}`;
                  const dayEvents = eventsByDate[dateKey] || [];
                  const isToday = dateKey === todayKey;
                  const isSelected = dateKey === selectedDate;
                  const hasFollowUp = dayEvents.some(e => e.sourceType === "follow_up");
                  const hasSiteVisit = dayEvents.some(e => e.sourceType === "site_visit");
                  const hasBooking = dayEvents.some(e => e.sourceType === "booking");

                  return (
                    <button
                      key={idx}
                      onClick={() => setSelectedDate(dateKey)}
                      data-testid={`calendar-day-${dateKey}`}
                      className={`
                        relative min-h-[60px] p-1 text-sm border border-slate-100 dark:border-slate-700 rounded-lg transition-colors
                        ${!day.isCurrentMonth ? "text-slate-300 dark:text-slate-600" : "text-slate-700 dark:text-slate-200"}
                        ${isToday ? "bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-700" : ""}
                        ${isSelected ? "ring-2 ring-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/30" : "hover:bg-slate-50 dark:hover:bg-slate-800"}
                      `}
                    >
                      <span className={`
                        inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium
                        ${isToday ? "bg-indigo-500 text-white" : ""}
                      `}>
                        {day.date}
                      </span>
                      {dayEvents.length > 0 && (
                        <div className="flex gap-0.5 justify-center mt-1 flex-wrap">
                          {hasFollowUp && <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
                          {hasSiteVisit && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                          {hasBooking && <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-4 mt-4 pt-4 border-t text-xs text-slate-500">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  Follow-ups
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Site Visits
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-orange-500" />
                  Bookings
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-base" data-testid="text-selected-date">
                {selectedDate
                  ? new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
                  : "Select a day"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!selectedDate ? (
                <p className="text-sm text-slate-500 text-center py-8">Click on a day to view events</p>
              ) : selectedEvents.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-8" data-testid="text-no-events">No events on this day</p>
              ) : (
                <div className="space-y-3">
                  {selectedEvents.map((event) => (
                    <div
                      key={event.id}
                      className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 space-y-2"
                      data-testid={`event-card-${event.id}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-slate-800 dark:text-white truncate" data-testid={`event-title-${event.id}`}>
                            {event.title}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5" data-testid={`event-time-${event.id}`}>
                            {formatCalendarDate(event.startAt)}
                          </p>
                        </div>
                        {getSourceBadge(event.sourceType)}
                      </div>
                      <p className="text-xs text-slate-500" data-testid={`event-lead-${event.id}`}>
                        Lead: {event.leadName}
                      </p>
                      {event.location && (
                        <p className="text-xs text-slate-400">📍 {event.location}</p>
                      )}
                      <div className="flex gap-2 pt-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs h-7 flex-1"
                          onClick={() => {
                            const url = buildGoogleCalendarUrl(event.title, event.startAt, event.endAt, event.description, event.location);
                            window.open(url, "_blank");
                          }}
                          data-testid={`button-google-cal-${event.id}`}
                        >
                          <ExternalLink className="w-3 h-3 mr-1" />
                          Google Cal
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs h-7 flex-1"
                          onClick={() => downloadICS(event.sourceType, event.sourceId)}
                          data-testid={`button-download-ics-${event.id}`}
                        >
                          <Download className="w-3 h-3 mr-1" />
                          .ics
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
