import type { Result } from '../shared/contracts';
import type { FantasyCalendar, CalendarEvent } from './calendar-contracts';
export interface AgendaBasis {
  calendarRevision: number;
  sceneId: string | null;
  clockRevision: number | null;
  instantMs: string | null;
}
export interface AgendaCursor {
  sortMs: string;
  id: string;
  instantMs: string;
  calendarRevision: number;
}
export interface AgendaQuery {
  sceneId: string | null;
  search: string;
  locationId?: string;
  eventId?: string;
  location: 'all' | 'current';
  horizonDays: number | null;
  includePast: boolean;
  includeTrash?: boolean;
  after: AgendaCursor | null;
}
export interface AgendaItem {
  event: CalendarEvent;
  state: 'active' | 'upcoming' | 'past';
  startMs: string;
  endMs: string;
  sortMs: string;
  locationTitle: string;
  locationAvailable: boolean;
}
export interface AgendaPage {
  calendar: FantasyCalendar;
  scene: {
    id: string;
    title: string;
    clockRevision: number;
    instantMs: string;
    locationId: string | null;
    locationTitle: string;
  } | null;
  items: AgendaItem[];
  next: AgendaCursor | null;
  total: number;
}
export interface AgendaAPI {
  agenda(token: string, query: AgendaQuery): Promise<Result<AgendaPage>>;
}
