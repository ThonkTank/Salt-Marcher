import type { FantasyCalendar, CalendarEvent } from './calendar-contracts';
export type AgendaUnit = 'second' | 'minute' | 'hour' | 'day' | 'week';
export const agendaUnitLabels: Record<AgendaUnit, string> = {
  second: 'Sekunden',
  minute: 'Minuten',
  hour: 'Stunden',
  day: 'Tage',
  week: 'Wochen',
};
export function unitMs(c: FantasyCalendar, unit: AgendaUnit) {
  if (unit === 'second') return 1000n;
  if (unit === 'minute') return 60000n;
  if (unit === 'hour') return 3600000n;
  if (unit === 'day') return BigInt(c.daySeconds) * 1000n;
  if (unit === 'week') return BigInt(c.daySeconds) * 1000n * BigInt(c.weekdays.length || 7);
  throw new Error('Zeiteinheit ist ungültig.');
}
export function agendaDuration(c: FantasyCalendar, value: string, unit: AgendaUnit) {
  if (!/^\d+(\.\d{1,3})?$/.test(value))
    throw new Error('Eine positive Zahl mit höchstens drei Nachkommastellen eingeben.');
  const [whole, fraction = ''] = value.split('.'),
    scale = 10n ** BigInt(fraction.length),
    numerator = (BigInt(whole!) * scale + BigInt(fraction || '0')) * unitMs(c, unit);
  if (numerator % scale)
    throw new Error('Die Zeit muss sich in ganze Millisekunden umrechnen lassen.');
  return numerator / scale;
}
export function durationInput(c: FantasyCalendar, ms: string) {
  const value = BigInt(ms);
  for (const unit of ['day', 'hour', 'minute'] as const)
    if (value % unitMs(c, unit) === 0n) return { value: String(value / unitMs(c, unit)), unit };
  return {
    value:
      String(value / 1000n) + (value % 1000n ? '.' + String(value % 1000n).padStart(3, '0') : ''),
    unit: 'second' as const,
  };
}
export function calendarParts(c: FantasyCalendar, ms: string) {
  const dayMs = unitMs(c, 'day'),
    days = BigInt(ms) / dayMs,
    yearDays = BigInt(c.months.reduce((n, m) => n + m.days, 0));
  let day = Number(days % yearDays),
    month = 0;
  while (month < c.months.length - 1 && day >= c.months[month]!.days)
    day -= c.months[month++]!.days;
  const seconds = (BigInt(ms) % dayMs) / 1000n;
  return {
    year: String(BigInt(c.startYear) + days / yearDays),
    month: String(month),
    day: String(day + 1),
    hour: String(seconds / 3600n),
    minute: String((seconds / 60n) % 60n),
  };
}
export function calendarInstant(c: FantasyCalendar, p: ReturnType<typeof calendarParts>) {
  if (!/^-?\d+$/.test(p.year) || ![p.month, p.day, p.hour, p.minute].every((v) => /^\d+$/.test(v)))
    throw new Error('Kalenderdatum und Uhrzeit prüfen.');
  const month = Number(p.month),
    day = Number(p.day),
    hour = BigInt(p.hour),
    minute = BigInt(p.minute),
    years = BigInt(p.year) - BigInt(c.startYear),
    seconds = hour * 3600n + minute * 60n;
  if (
    years < 0n ||
    !c.months[month] ||
    day < 1 ||
    day > c.months[month]!.days ||
    minute > 59n ||
    seconds >= BigInt(c.daySeconds)
  )
    throw new Error('Datum muss im Kampagnenkalender liegen; Tag und Uhrzeit prüfen.');
  const days =
    years * BigInt(c.months.reduce((n, m) => n + m.days, 0)) +
    BigInt(c.months.slice(0, month).reduce((n, m) => n + m.days, 0) + day - 1);
  return days * unitMs(c, 'day') + seconds * 1000n;
}
export function agendaOccurrence(e: CalendarEvent, instant: string) {
  const now = BigInt(instant),
    first = BigInt(e.startMs),
    duration = BigInt(e.durationMs),
    repeat = e.repeatMs === null ? null : BigInt(e.repeatMs);
  if (duration <= 0n || (repeat !== null && repeat <= 0n))
    throw new Error('Kalenderereignis benötigt eine positive Dauer und Wiederholung.');
  let start = first;
  if (repeat !== null && now >= first) {
    start = first + ((now - first) / repeat) * repeat;
    if (now - start >= duration) start += repeat;
  }
  const end = start + duration,
    state =
      now < start ? ('upcoming' as const) : now < end ? ('active' as const) : ('past' as const);
  return {
    state,
    startMs: String(start),
    endMs: String(end),
    sortMs: String(state === 'active' ? now : state === 'past' ? end : start),
  };
}
export function agendaCountdown(c: FantasyCalendar, delta: string) {
  let ms = BigInt(delta);
  if (ms < 0n) ms = -ms;
  const day = unitMs(c, 'day'),
    days = ms / day,
    within = ms % day,
    hours = within / 3600000n,
    minutes = (within % 3600000n) / 60000n;
  return (
    [days ? days + ' Tage' : '', hours ? hours + ' h' : '', minutes ? minutes + ' min' : '']
      .filter(Boolean)
      .join(' ') || 'weniger als eine Minute'
  );
}
