import { dailyXp, levelXp, xpLevel, xpShare, restFrame, type Progress } from './progression';
import { assessEncounter } from '../catalog/encounter-contracts';
import type {
  DayRow,
  DayCalculation,
  DayPacing,
  DayRestFrame,
  DayAdvancement,
  DayLevelMark,
  DayRestStop,
} from './adventuring-day-contracts';
function checkedDayXp(n: number) {
  if (!Number.isSafeInteger(n) || n < 0 || n > 1000000000000)
    throw new Error('XP benötigen eine ganze Zahl von 0 bis 1 Billion.');
  return n;
}

/** First crossings within a repeated encounter row, using the same Party rest frame.
 * Count transitions rather than expanding every member for every repetition. */
export function projectDayRestStops(
  party: Progress[],
  loadShare: number,
  count: number,
): DayRestStop[] {
  const deltas = new Map<number, { short: number; long: number }>();
  const add = (after: number, short: number, long: number) => {
    if (after > count || !Number.isFinite(after)) return;
    const old = deltas.get(after) ?? { short: 0, long: 0 };
    old.short += short;
    old.long += long;
    deltas.set(after, old);
  };
  for (const p of party) {
    const f = restFrame(p);
    if (!f) continue;
    const at = (mark: number) =>
      f.consumed >= mark
        ? 0
        : loadShare > 0
          ? Math.ceil((mark - f.consumed) / loadShare)
          : Infinity;
    const long = at(f.budget),
      short = f.sections > 1 ? at(f.nextRest) : Infinity;
    if (short < long) {
      add(short, 1, 0);
      if (short <= count) add(long, -1, 0);
    }
    add(long, 0, 1);
  }
  let shortDue = 0,
    longDue = 0;
  const out: DayRestStop[] = [];
  for (const [after, delta] of [...deltas].sort((a, b) => a[0] - b[0])) {
    shortDue += delta.short;
    longDue += delta.long;
    if (delta.short || delta.long) out.push({ after, shortDue, longDue });
  }
  return out;
}

/** Current party facts plus hypothetical load, never rewards, levels, rests or time writes. */
export function projectDayPacing(
  party: (Progress & { name: string })[],
  loadXp?: number,
  projected?: (Progress & { name: string })[],
): DayPacing {
  const share = loadXp === undefined ? null : xpShare(checkedDayXp(loadXp), party.length);
  const frame = (p: Progress): DayRestFrame | null => {
    const f = restFrame(p);
    if (!f) return null;
    return {
      budget: f.budget,
      consumed: f.consumed,
      shortXp: p.rest.shortXp,
      baseline: p.rest.baseline,
      sections: f.sections,
      fill: f.fill,
      nextRest: f.nextRest,
      remainingLong: Math.max(0, f.budget - f.consumed),
      due: f.overdue ? 'long' : f.sections > 1 && f.consumed >= f.nextRest ? 'short' : null,
    };
  };
  const final = new Map(projected?.map((p) => [p.characterId, p]));
  const members = party.map((p) => ({
    id: p.characterId,
    name: p.name,
    before: frame(p),
    after: share
      ? frame(
          final.get(p.characterId) ?? {
            ...p,
            rest: {
              ...p.rest,
              longXp: p.rest.longXp + share.share,
              shortXp: p.rest.shortXp + share.share,
            },
          },
        )
      : null,
    reason:
      p.xp === null
        ? 'Bestätigte XP fehlen.'
        : !p.rest.known
          ? 'Raststand offen. Lange Rast bestätigen.'
          : null,
  }));
  const known = members.filter((m) => m.before !== null),
    frames = known.map((m) => m.before!);
  const projectedFrames = members.flatMap((m) => (m.after ? [m.after] : []));
  const pool = (gap: number) => (gap <= 0 ? 0 : (Math.ceil(gap) - 1) * party.length + 1);
  const until = (short: boolean) => {
    const values = frames
      .filter((f) => !short || f.sections > 1)
      .map((f) => pool((short ? Math.min(f.nextRest, f.budget) : f.budget) - f.consumed));
    return values.length ? Math.min(...values) : null;
  };
  return {
    partySize: party.length,
    known: known.length,
    loadShare: share?.share ?? null,
    totalLoad: share?.total ?? null,
    currentFill: known.length ? frames.reduce((n, f) => n + f.fill, 0) / known.length : null,
    projectedFill: projectedFrames.length
      ? projectedFrames.reduce((n, f) => n + f.fill, 0) / projectedFrames.length
      : null,
    projectedKnown: projectedFrames.length,
    projectedSections:
      projectedFrames.length &&
      projectedFrames.every((f) => f.sections === projectedFrames[0]!.sections)
        ? projectedFrames[0]!.sections
        : null,
    commonSections:
      frames.length && frames.every((f) => f.sections === frames[0]!.sections)
        ? frames[0]!.sections
        : null,
    untilShort: until(true),
    untilLong: until(false),
    members,
  };
}

/** Party-owned preview: fixed starting-level budgets, no mutation and bounded milestones. */
export function calculateDay(rows: DayRow[], totalXp: number, rewardXp = totalXp): DayCalculation {
  if (
    !Array.isArray(rows) ||
    rows.length > 20 ||
    rows.some(
      (r) =>
        !r ||
        !Number.isSafeInteger(r.level) ||
        r.level < 1 ||
        r.level > 20 ||
        !Number.isSafeInteger(r.count) ||
        r.count < 1 ||
        r.count > 1000,
    )
  )
    throw new Error('Bis zu 20 Zeilen mit Level 1–20 und positiver Anzahl eingeben.');
  checkedDayXp(totalXp);
  checkedDayXp(rewardXp);
  const partySize = rows.reduce((n, r) => n + r.count, 0),
    dailyBudget = rows.reduce((n, r) => n + dailyXp[r.level - 1]! * r.count, 0),
    share = partySize ? xpShare(rewardXp, partySize) : { share: 0, total: 0 },
    days = dailyBudget ? Math.floor(totalXp / dailyBudget) : 0,
    remainder = dailyBudget ? totalXp % dailyBudget : 0;
  const milestones: [number, number, number] = [
      Math.ceil(dailyBudget / 3),
      Math.ceil((2 * dailyBudget) / 3),
      dailyBudget,
    ],
    timeline: DayCalculation['timeline'] = [];
  const shown = Math.min(days, 30);
  for (let day = 1; day <= shown; day++)
    for (const [i, mark] of milestones.entries())
      timeline.push({
        label: 'Tag ' + day + ' · ' + (i < 2 ? 'kurze Rast ' + (i + 1) : 'lange Rast'),
        xp: (day - 1) * dailyBudget + mark,
      });
  if (days > shown)
    timeline.push({
      label:
        'Weitere ' +
        (days - shown) +
        ' volle Tage · ' +
        (days - shown) * 2 +
        ' kurze und ' +
        (days - shown) +
        ' lange Rasten',
      xp: days * dailyBudget,
    });
  if (remainder) {
    for (const [i, mark] of milestones.entries())
      if (i < 2 && mark <= remainder)
        timeline.push({
          label: 'Tag ' + (days + 1) + ' · kurze Rast ' + (i + 1),
          xp: days * dailyBudget + mark,
        });
    timeline.push({
      label: 'Tag ' + (days + 1) + ' · bisher ' + remainder + ' / ' + dailyBudget + ' XP',
      xp: totalXp,
    });
  }
  return {
    partySize,
    dailyBudget,
    totalXp,
    rewardXp,
    shareXp: share.share,
    totalAwardXp: share.total,
    milestones,
    thresholds: assessEncounter(
      rows.map((r, i) => ({ id: String(i), name: '', ...r })),
      [],
    ).thresholds,
    completedDays: days,
    dayProgress: dailyBudget ? remainder / dailyBudget : 0,
    shortRests:
      days * 2 +
      (remainder >= milestones[0] && dailyBudget ? 1 : 0) +
      (remainder >= milestones[1] && dailyBudget ? 1 : 0),
    longRests: days,
    timeline,
    projections: rows.map((r) => {
      const beforeXp = levelXp[r.level - 1]!,
        afterXp = beforeXp + share.share;
      return {
        name: 'Level ' + r.level,
        count: r.count,
        beforeXp,
        afterXp,
        beforeLevel: r.level,
        afterLevel: xpLevel(afterXp).level,
      };
    }),
  };
}

/** Minimum group pools under the same equal, rounded-up distribution as xpShare. */
export function projectDayAdvancement(
  c: DayCalculation,
  stages?: { cumulativeRewardXp: number }[],
): DayAdvancement {
  const reached = new Map<string, DayLevelMark>(),
    next = new Map<string, DayLevelMark>();
  let atMaximum = 0;
  const add = (
    marks: Map<string, DayLevelMark>,
    p: DayCalculation['projections'][number],
    level: number,
  ) => {
    const gap = levelXp[level - 1]! - p.beforeXp,
      groupXp = (gap - 1) * c.partySize + 1,
      key = level + ':' + groupXp;
    let mark = marks.get(key);
    if (!mark) {
      const stage = stages?.findIndex((s) => s.cumulativeRewardXp >= groupXp) ?? -1;
      mark = {
        level,
        groupXp,
        shareXp: gap,
        missingGroupXp: Math.max(0, groupXp - c.rewardXp),
        members: [],
        stage: stage < 0 ? null : stage + 1,
      };
      marks.set(key, mark);
    }
    mark.members.push({ name: p.name, count: p.count });
  };
  for (const p of c.projections) {
    for (let level = p.beforeLevel + 1; level <= p.afterLevel; level++) add(reached, p, level);
    if (p.afterLevel === 20) atMaximum += p.count;
    else add(next, p, p.afterLevel + 1);
  }
  const ordered = (marks: Map<string, DayLevelMark>) =>
    [...marks.values()].sort((a, b) => a.groupXp - b.groupXp || a.level - b.level);
  return { reached: ordered(reached), next: ordered(next), atMaximum };
}
