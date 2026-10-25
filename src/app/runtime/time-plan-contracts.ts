import type { Result } from '../shared/contracts';
import type { LiveAction } from './live-contracts';
import type { FantasyCalendar } from './world-contracts';
import type { AgendaUnit } from './agenda-model';
export interface ClockEventTarget {
  eventId: string;
  expectedRevision: number;
  phase: 'start' | 'end';
  instantMs: string;
}
export type TimeRequest = { sceneId: string; reason: string; expectedCalendarRevision?: number } & (
  | { kind: 'duration'; amount: string; unit: AgendaUnit }
  | { kind: 'instant'; instantMs: string }
  | { kind: 'next-day' }
  | { kind: 'event'; eventId: string; expectedRevision: number; phase: 'start' | 'end' }
);
export interface TimePreview {
  sceneId: string;
  sceneTitle: string;
  from: string;
  to: string;
  durationMs: string;
  calendar: FantasyCalendar;
  action: Extract<LiveAction, { kind: 'advance-clock' }>;
  events: { name: string; instantMs: string }[];
  eventCount?: string;
  journeyNotice: string | null;
}
export interface TimePlanAPI {
  previewTime(token: string, request: TimeRequest): Promise<Result<TimePreview>>;
}
