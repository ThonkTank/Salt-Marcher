export interface ClockEventTarget {
  eventId: string;
  expectedRevision: number;
  phase: 'start' | 'end';
  instantMs: string;
}
