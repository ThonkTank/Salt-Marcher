import type { TimeRequest, TimePreview } from '../runtime/time-plan-contracts';
import type { ClockEventTarget } from '../runtime/clock-event-contracts';
import { agendaDuration, agendaOccurrence, unitMs } from '../runtime/agenda-model';
import { calendarEvents, readClockEvent } from './calendar-events';
import { validInstant } from '../runtime/time-plan-model';
import { readWorldCalendar } from './world-calendar-read';
import { readLiveScene } from './live-read';
export function previewSceneTime(db: any, cam: string, r: TimeRequest): TimePreview {
  if (!r || typeof r.reason !== 'string' || r.reason.length > 2000)
    throw new Error('Zeitgrund benötigt höchstens 2.000 Zeichen.');
  const scene = readLiveScene(db, cam, r.sceneId),
    focus = db
      .prepare('SELECT focus_id,focus_revision FROM live_state WHERE campaign_id=?')
      .get(cam),
    calendar = readWorldCalendar(db, cam);
  if (scene.retired || focus?.focus_id !== scene.id)
    throw new Error('Zeitvorschau gehört nicht mehr zur fokussierten Gruppe.');
  if (r.expectedCalendarRevision !== undefined && r.expectedCalendarRevision !== calendar.revision)
    throw new Error('Kalender geändert. Zeitdialog neu öffnen.');
  const now = BigInt(scene.clock.instantMs);
  let to: bigint, target: ClockEventTarget | undefined;
  if (r.kind === 'duration') to = now + agendaDuration(calendar, r.amount, r.unit);
  else if (r.kind === 'next-day')
    to = (now / unitMs(calendar, 'day') + 1n) * unitMs(calendar, 'day');
  else if (r.kind === 'instant') {
    if (!validInstant(r.instantMs)) throw new Error('Kalenderdatum prüfen.');
    to = BigInt(r.instantMs);
  } else if (r.kind === 'event') {
    const event = readClockEvent(db, cam, r.eventId);
    if (event.revision !== r.expectedRevision)
      throw new Error('Ereignis geändert. Agenda aktualisieren.');
    const occurrence = agendaOccurrence(event, scene.clock.instantMs),
      instant = r.phase === 'end' ? occurrence.endMs : occurrence.startMs;
    to = BigInt(instant);
    target = {
      eventId: event.id,
      expectedRevision: event.revision,
      phase: r.phase,
      instantMs: instant,
    };
  } else throw new Error('Zeitvorschau benötigt Dauer, Datum oder Ereignis.');
  if (to <= now || !validInstant(String(to)))
    throw new Error('Zeit muss vorwärts gehen. Bei bereits laufendem Ereignis dessen Ende wählen.');
  const events: TimePreview['events'] = [];
  let eventCount = 0n;
  for (const event of calendarEvents(db, cam)) {
    if (event.trashed || (event.locationId && event.locationId !== scene.locationId)) continue;
    const first = BigInt(event.startMs),
      repeat = event.repeatMs ? BigInt(event.repeatMs) : null;
    let start = first;
    if (repeat && now >= first) start = first + ((now - first) / repeat + 1n) * repeat;
    if (start <= now || start > to) continue;
    const count = repeat ? (to - start) / repeat + 1n : 1n;
    eventCount += count;
    for (let occurrences = 0; occurrences < 40 && BigInt(occurrences) < count; occurrences++) {
      events.push({ name: event.name, instantMs: String(start) });
      events.sort((a, b) =>
        BigInt(a.instantMs) < BigInt(b.instantMs)
          ? -1
          : BigInt(a.instantMs) > BigInt(b.instantMs)
            ? 1
            : a.name.localeCompare(b.name),
      );
      if (events.length > 40) events.pop();
      if (!repeat) break;
      start += repeat;
    }
  }
  const worldJourney = db
      .prepare(
        "SELECT 1 FROM world_journey WHERE campaign_id=? AND scene_id=? AND status IN('active','paused','interrupted') LIMIT 1",
      )
      .get(cam, scene.id),
    dungeonJourney = db
      .prepare(
        "SELECT 1 FROM dungeon_journey WHERE campaign_id=? AND scene_id=? AND json_extract(payload,'$.status') IN('active','paused','decision') LIMIT 1",
      )
      .get(cam, scene.id);
  return {
    sceneId: scene.id,
    sceneTitle: scene.title,
    from: scene.clock.instantMs,
    to: String(to),
    durationMs: String(to - now),
    calendar,
    events,
    eventCount: String(eventCount),
    journeyNotice:
      worldJourney || dungeonJourney
        ? 'Diese Gruppe hat eine Reise. Die Position bleibt beim Warten erhalten; danach im Reisebereich „Restweg neu bewerten“ öffnen.'
        : null,
    action: {
      kind: 'advance-clock',
      sceneId: scene.id,
      expectedRevision: scene.clock.revision,
      calendarVersion: 'campaign-calendar-v1',
      calendar: { revision: calendar.revision, daySeconds: calendar.daySeconds },
      toInstantMs: String(to),
      expectedFocusRevision: focus.focus_revision,
      ...(target ? { eventTarget: target } : {}),
      reason: r.reason,
    },
  };
}
