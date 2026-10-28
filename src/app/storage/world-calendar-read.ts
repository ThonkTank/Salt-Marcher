import { checkedRow, type SqliteDatabase } from './sqlite-connection';
import { decodeStored } from './stored-payload';
import * as shape from './stored-shapes';
import { createHash } from 'node:crypto';
import type { FantasyCalendar } from '../runtime/world-contracts';
export const hash = (s: string) => createHash('sha256').update(s).digest('hex');

export const defaultCalendar: FantasyCalendar = {
  revision: 0,
  name: 'Kampagnenkalender',
  startYear: 1,
  daySeconds: 86400,
  months: [
    { name: 'Frühmond', days: 30 },
    { name: 'Saatmond', days: 30 },
    { name: 'Blütenmond', days: 30 },
    { name: 'Sonnenmond', days: 30 },
    { name: 'Erntemond', days: 30 },
    { name: 'Nebelmond', days: 30 },
    { name: 'Frostmond', days: 30 },
    { name: 'Wintermond', days: 30 },
  ],
  weekdays: [
    'Erster Tag',
    'Zweiter Tag',
    'Dritter Tag',
    'Vierter Tag',
    'Fünfter Tag',
    'Sechster Tag',
    'Siebter Tag',
  ],
};

export function readWorldCalendar(db: SqliteDatabase, cam: string): FantasyCalendar {
  const row = db
    .prepare("SELECT * FROM world_record WHERE campaign_id=? AND kind='calendar' AND id='main'")
    .get(cam);
  return row ? checkedCalendarRow(row) : structuredClone(defaultCalendar);
}

/** Same saved calendar rules as the command; inspect without trimming or defaulting. */
export function checkedCalendar(value: unknown) {
  const c = shape.world_record_calendar(value);
  if (
    !Number.isSafeInteger(c.revision) ||
    c.revision < 0 ||
    !c.name.trim() ||
    !Number.isSafeInteger(c.startYear) ||
    !Number.isSafeInteger(c.daySeconds) ||
    c.daySeconds < 3600 ||
    c.daySeconds > 604800 ||
    !c.months.length ||
    c.months.length > 100 ||
    c.months.some(
      (m) => !m.name.trim() || !Number.isSafeInteger(m.days) || m.days < 1 || m.days > 10000,
    ) ||
    !c.weekdays.length ||
    c.weekdays.length > 100 ||
    c.weekdays.some((s) => !s.trim())
  )
    throw new Error('Gespeicherter Kalender benötigt gültige Monate, Tage und Wochentage.');
  return c;
}
export function checkedCalendarRow(value: unknown): FantasyCalendar {
  const row = checkedRow(value, { kind: 'text', id: 'text', revision: 'integer' });
  const c = decodeStored(value, checkedCalendar);
  if (
    row.kind !== 'calendar' ||
    row.id !== 'main' ||
    (c.id !== undefined && c.id !== row.id) ||
    row.revision < 1 ||
    c.revision !== row.revision
  )
    throw new Error('Kalenderidentität oder Revision widersprüchlich.');
  return c;
}
