import { createHash } from 'node:crypto';
import type { CalendarEvent } from '../world-contracts';
import { checkedCalendarEvent } from '../world-model';

/** Verify author bytes and row identity before any payload-based filtering. */
export function checkedCalendarEventRow(row: any): CalendarEvent {
  if (!row || createHash('sha256').update(row.payload).digest('hex') !== row.checksum)
    throw new Error('Kalenderereignis beschädigt.');
  const event = checkedCalendarEvent(JSON.parse(row.payload), true);
  if (event.id !== row.id || event.revision !== row.revision)
    throw new Error('Kalenderereignis widerspricht seiner Identität.');
  return event;
}
export function* calendarEvents(db: any, cam: string, eventId?: string): Generator<CalendarEvent> {
  for (const row of db
    .prepare(
      "SELECT id,revision,payload,checksum FROM world_record WHERE campaign_id=? AND kind='calendar-event' AND (? IS NULL OR id=?) ORDER BY id",
    )
    .iterate(cam, eventId ?? null, eventId ?? null))
    yield checkedCalendarEventRow(row);
}
export function readClockEvent(db: any, cam: string, id: string): CalendarEvent {
  const event = checkedCalendarEventRow(
    db
      .prepare("SELECT * FROM world_record WHERE campaign_id=? AND kind='calendar-event' AND id=?")
      .get(cam, id),
  );
  if (event.trashed) throw new Error('Kalenderereignis geändert, beschädigt oder im Papierkorb.');
  return event;
}
