export interface FantasyCalendar {
  revision: number;
  name: string;
  startYear: number;
  daySeconds: number;
  months: { name: string; days: number }[];
  weekdays: string[];
}

export interface CalendarEvent {
  id: string;
  revision: number;
  name: string;
  startMs: string;
  durationMs: string;
  repeatMs: string | null;
  locationId: string | null;
  notes: string;
  trashed: boolean;
}
