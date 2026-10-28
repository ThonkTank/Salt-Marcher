import type { NpcDailySlot, NpcDailyOverride } from './npc-data-contracts';
export const dailyTime = (minutes: number) =>
  Math.floor(minutes / 60)
    .toString()
    .padStart(2, '0') +
  ':' +
  (minutes % 60).toString().padStart(2, '0');
export function dailyMinute(text: string) {
  if (!/^\d{1,3}:[0-5]\d$/.test(text))
    throw new Error('Tagesplan: Uhrzeiten als Stunden:Minuten eingeben.');
  return Number(text.split(':')[0]) * 60 + Number(text.split(':')[1]);
}
export interface NpcDailyRaw {
  id: string;
  start: string;
  end: string;
  activity: string;
  place: NpcDailySlot['place'];
  notes: string;
  locationId?: string;
  weekdays?: number[];
}
export interface NpcDailyOverrideRaw {
  day: string;
  label: string;
  slots: NpcDailyRaw[];
}
const dailyRaw = (value: unknown): value is NpcDailyRaw =>
  !!value &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  ['id', 'start', 'end', 'activity', 'notes'].every(
    (key) => typeof (value as any)[key] === 'string',
  ) &&
  ['home', 'work', 'other', 'location'].includes((value as any).place) &&
  ((value as any).locationId === undefined || typeof (value as any).locationId === 'string') &&
  ((value as any).weekdays === undefined ||
    (Array.isArray((value as any).weekdays) &&
      (value as any).weekdays.every((day: unknown) => Number.isSafeInteger(day))));
export function readDailyPlanRaw(text: string): NpcDailyRaw[] {
  const raw: unknown = JSON.parse(text || '[]');
  if (!Array.isArray(raw) || !raw.every(dailyRaw)) throw new Error('Tagesplanentwurf prüfen.');
  return raw;
}
export function readDailyOverridesRaw(text: string): NpcDailyOverrideRaw[] {
  const raw: unknown = JSON.parse(text || '[]');
  if (
    !Array.isArray(raw) ||
    !raw.every(
      (value) =>
        !!value &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        typeof (value as any).day === 'string' &&
        typeof (value as any).label === 'string' &&
        Array.isArray((value as any).slots) &&
        (value as any).slots.every(dailyRaw),
    )
  )
    throw new Error('Tagesausnahmenentwurf prüfen.');
  return raw as NpcDailyOverrideRaw[];
}
export function rawDailyPlan(plan: NpcDailySlot[] = []): NpcDailyRaw[] {
  return plan.map((s) => ({
    id: s.id,
    start: dailyTime(s.startMinute),
    end: dailyTime(s.endMinute),
    activity: s.activity,
    place: s.place,
    notes: s.notes,
    ...(s.locationId !== undefined ? { locationId: s.locationId } : {}),
    ...(s.weekdays ? { weekdays: [...s.weekdays] } : {}),
  }));
}
export function rawDailyOverrides(overrides: NpcDailyOverride[] = []): NpcDailyOverrideRaw[] {
  return overrides.map((o) => ({ ...o, slots: rawDailyPlan(o.slots) }));
}
export function parseDailyPlan(text: string): NpcDailySlot[] {
  return checkedDailyPlan(
    readDailyPlanRaw(text).map((s) => ({
      id: s.id,
      startMinute: dailyMinute(s.start),
      endMinute: dailyMinute(s.end),
      activity: s.activity,
      place: s.place,
      notes: s.notes,
      ...(s.locationId !== undefined ? { locationId: s.locationId } : {}),
      ...(s.weekdays ? { weekdays: s.weekdays } : {}),
    })),
  );
}
export function parseDailyOverrides(text: string): NpcDailyOverride[] {
  return checkedDailyOverrides(
    readDailyOverridesRaw(text).map((o) => ({
      day: o.day,
      label: o.label,
      slots: parseDailyPlan(JSON.stringify(o.slots)),
    })),
  );
}
export function checkedDailyPlan(value: unknown, daySeconds?: number): NpcDailySlot[] {
  if (!Array.isArray(value) || value.length > 48)
    throw new Error('Tagesplan: höchstens 48 Aktivitäten.');
  const ids = new Set<string>();
  for (const s of value) {
    if (
      !s ||
      typeof s.id !== 'string' ||
      !s.id ||
      s.id.length > 1000 ||
      ids.has(s.id) ||
      !Number.isSafeInteger(s.startMinute) ||
      !Number.isSafeInteger(s.endMinute) ||
      s.startMinute < 0 ||
      s.startMinute >= 10080 ||
      s.endMinute < 0 ||
      s.endMinute > 10080 ||
      s.startMinute === s.endMinute ||
      typeof s.activity !== 'string' ||
      !s.activity.trim() ||
      s.activity.length > 2000 ||
      !['home', 'work', 'other', 'location'].includes(s.place) ||
      (s.place === 'location'
        ? typeof s.locationId !== 'string' || !s.locationId.trim() || s.locationId.length > 1000
        : s.locationId !== undefined) ||
      typeof s.notes !== 'string' ||
      s.notes.length > 20000 ||
      (s.weekdays !== undefined &&
        (!Array.isArray(s.weekdays) ||
          !s.weekdays.length ||
          s.weekdays.length > 100 ||
          new Set(s.weekdays).size !== s.weekdays.length ||
          s.weekdays.some(
            (d: unknown) => !Number.isSafeInteger(d) || Number(d) < 0 || Number(d) > 99,
          )))
    )
      throw new Error(
        'Tagesplan: Aktivität, unterschiedliche Uhrzeiten, Wochentage und Ziel prüfen.',
      );
    ids.add(s.id);
  }
  if (daySeconds !== undefined) checkedNpcSchedule(value, [], daySeconds, 100);
  return value as NpcDailySlot[];
}
export function checkedDailyOverrides(value: unknown): NpcDailyOverride[] {
  if (!Array.isArray(value) || value.length > 64)
    throw new Error('Tagesplan: höchstens 64 Datumsausnahmen.');
  const days = new Set<string>();
  for (const o of value) {
    if (
      !o ||
      typeof o.day !== 'string' ||
      !/^\d{1,12}$/.test(o.day) ||
      BigInt(o.day) < 1n ||
      o.day !== BigInt(o.day).toString() ||
      days.has(o.day) ||
      typeof o.label !== 'string' ||
      !o.label.trim() ||
      o.label.length > 1000
    )
      throw new Error('Tagesausnahme: eindeutigen Kampagnentag ab 1 und Bezeichnung eingeben.');
    days.add(o.day);
    checkedDailyPlan(o.slots);
    if (o.slots.some((s: NpcDailySlot) => s.weekdays !== undefined))
      throw new Error('Aktivitäten einer Datumsausnahme verwenden keine Wochentagsfilter.');
  }
  return value as NpcDailyOverride[];
}
const weekday = (day: bigint, count: number) =>
  Number(((day % BigInt(count)) + BigInt(count)) % BigInt(count));
function scheduleDays(plan: NpcDailySlot[], overrides: NpcDailyOverride[], count: number) {
  const map = new Map(overrides.map((o) => [o.day, o]));
  return {
    override: (day: bigint) => map.get((day + 1n).toString()),
    slots: (day: bigint) =>
      map.get((day + 1n).toString())?.slots ??
      plan.filter((s) => !s.weekdays || s.weekdays.includes(weekday(day, count))),
  };
}
function dayRanges(plan: ReturnType<typeof scheduleDays>, day: bigint, minutes: number) {
  const ranges: { start: number; end: number; slot: NpcDailySlot; previous: boolean }[] = [];
  for (const slot of plan.slots(day))
    ranges.push({
      start: slot.startMinute,
      end: slot.startMinute < slot.endMinute ? slot.endMinute : minutes,
      slot,
      previous: false,
    });
  if (!plan.override(day))
    for (const slot of plan.slots(day - 1n))
      if (slot.startMinute > slot.endMinute && slot.endMinute > 0)
        ranges.push({ start: 0, end: slot.endMinute, slot, previous: true });
  return ranges.filter((r) => r.end > r.start).sort((a, b) => a.start - b.start);
}
export function checkedNpcSchedule(
  plan: NpcDailySlot[],
  overrides: NpcDailyOverride[],
  daySeconds: number,
  weekdays: number,
) {
  checkedDailyPlan(plan);
  checkedDailyOverrides(overrides);
  if (!Number.isSafeInteger(weekdays) || weekdays < 1 || weekdays > 100)
    throw new Error('Kampagnenwoche prüfen.');
  const minutes = daySeconds / 60;
  for (const s of [...plan, ...overrides.flatMap((o) => o.slots)])
    if (s.startMinute >= minutes || s.endMinute > minutes || s.weekdays?.some((d) => d >= weekdays))
      throw new Error('Tagesplan passt nicht zur Tageslänge oder Woche des Kampagnenkalenders.');
  const check = (schedule: ReturnType<typeof scheduleDays>, day: bigint) => {
    const ranges = dayRanges(schedule, day, minutes);
    for (let i = 1; i < ranges.length; i++)
      if (ranges[i]!.start < ranges[i - 1]!.end)
        throw new Error(
          'Tagesplan: Aktivitäten überschneiden sich am Kampagnentag ' + (day + 1n) + '.',
        );
  };
  const base = scheduleDays(plan, [], weekdays);
  for (let d = 0; d < weekdays; d++) check(base, BigInt(d));
  const all = scheduleDays(plan, overrides, weekdays);
  for (const o of overrides) {
    const d = BigInt(o.day) - 1n;
    for (const shift of [-1n, 0n, 1n]) check(all, d + shift);
  }
}
export function dailyPlanAt(
  plan: NpcDailySlot[] | undefined,
  instantMs: string,
  daySeconds: number,
  weekdays = 7,
  overrides: NpcDailyOverride[] = [],
) {
  const slots = plan ?? [],
    dayMs = BigInt(daySeconds) * 1000n,
    now = BigInt(instantMs),
    day = now / dayMs,
    second = Number(((now % dayMs) + dayMs) % dayMs) / 1000;
  const empty = {
    current: null,
    next: null,
    secondsUntilNext: null,
    nextInstantMs: null,
    nextDay: null,
    day: (day + 1n).toString(),
    weekday: weekday(day, weekdays),
    overrideLabel: null,
    startsOnPreviousDay: false,
  };
  try {
    checkedNpcSchedule(slots, overrides, daySeconds, weekdays);
  } catch (e) {
    return { ...empty, problem: (e as Error).message };
  }
  const schedule = scheduleDays(slots, overrides, weekdays),
    range = dayRanges(schedule, day, daySeconds / 60).find(
      (r) => second >= r.start * 60 && second < r.end * 60,
    ),
    days = new Set<bigint>([day]);
  // A weekly appointment can be cancelled for many weeks. For each used weekday,
  // only its first future non-exception day can supply the next regular start.
  // Jump whole weeks across exceptions instead of imposing a calendar horizon.
  const usedWeekdays = new Set(
    slots.flatMap((s) => s.weekdays ?? Array.from({ length: weekdays }, (_, i) => i)),
  );
  for (const wanted of usedWeekdays) {
    let candidate = day + 1n + BigInt((wanted - weekday(day + 1n, weekdays) + weekdays) % weekdays);
    while (schedule.override(candidate)) candidate += BigInt(weekdays);
    days.add(candidate);
  }
  // Exceptions replace the regular day and may contain their own distant starts.
  for (const o of overrides) if (BigInt(o.day) - 1n >= day) days.add(BigInt(o.day) - 1n);
  let next: NpcDailySlot | null = null,
    nextMs: bigint | null = null;
  for (const d of days)
    for (const slot of schedule.slots(d)) {
      const start = d * dayMs + BigInt(slot.startMinute) * 60000n;
      if (start > now && (nextMs === null || start < nextMs)) {
        next = slot;
        nextMs = start;
      }
    }
  return {
    current: range?.slot ?? null,
    next,
    secondsUntilNext: nextMs === null ? null : Number(nextMs - now) / 1000,
    nextInstantMs: nextMs?.toString() ?? null,
    nextDay: nextMs === null ? null : (nextMs / dayMs + 1n).toString(),
    day: (day + 1n).toString(),
    weekday: weekday(day, weekdays),
    overrideLabel: schedule.override(day)?.label ?? null,
    startsOnPreviousDay: range?.previous ?? false,
    problem: null,
  };
}

export const npcPlanLocationIds = (record: {
  dailyPlan?: NpcDailySlot[];
  dailyOverrides?: NpcDailyOverride[];
}) => [
  ...new Set(
    [...(record.dailyPlan ?? []), ...(record.dailyOverrides ?? []).flatMap((o) => o.slots)]
      .filter((s) => s.place === 'location')
      .map((s) => s.locationId!),
  ),
];
