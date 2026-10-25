import { readProgressCharacter } from './progression';
import { readCharacter } from './live';
import { dailyXp, xpLevel, restFrame } from '../progression';
import { calculateDay, projectDayPacing, projectDayAdvancement } from '../adventuring-day-model';
import type { DayRequest, DayView, DaySnapshot } from '../adventuring-day-contracts';
import { readDayItinerary } from './day-itinerary';

export function readDay(db: any, cam: string, request: DayRequest): DayView {
  if (!request || !['active', 'custom'].includes(request.source))
    throw new Error('Rechnerquelle wählen.');
  // The calculator needs active party XP/rest facts, not inactive records or combat masks.
  const active: Array<ReturnType<typeof readProgressCharacter> & { name: string }> = db
      .prepare('SELECT id FROM roster_member WHERE campaign_id=? AND active=1 ORDER BY ordinal,id')
      .all(cam)
      .map((row: any) => ({
        ...readProgressCharacter(db, cam, row.id),
        name: readCharacter(db, cam, row.id).profile.name,
      })),
    groups = new Map<number | null, number>();
  const members = active.map((c) => {
    const level = c.xp === null ? null : xpLevel(c.xp).level,
      frame = restFrame(c);
    groups.set(level, (groups.get(level) ?? 0) + 1);
    return {
      id: c.characterId,
      name: c.name,
      xp: c.xp,
      level,
      restKnown: c.rest.known,
      shortXp: c.rest.shortXp,
      longXp: c.rest.longXp,
      nextShort: frame ? Math.max(0, Math.ceil(frame.nextRest - frame.consumed)) : null,
      remainingLong: frame ? Math.max(0, frame.budget - frame.consumed) : null,
    };
  });
  const levelsKnown = members.every((c) => c.level !== null),
    available = members.length > 0 && levelsKnown && members.every((c) => c.restKnown),
    rows = [...groups]
      .sort((a, b) => (a[0] ?? 21) - (b[0] ?? 21))
      .map(([level, count]) => ({ level, count }));
  const snapshot: DaySnapshot = {
    available,
    partySize: members.length,
    averageLevel:
      members.length && levelsKnown
        ? members.reduce((n, c) => n + c.level!, 0) / members.length
        : null,
    dailyBudget: levelsKnown ? members.reduce((n, c) => n + dailyXp[c.level! - 1]!, 0) : null,
    shortXp: available ? members.reduce((n, c) => n + c.shortXp, 0) : null,
    longXp: available ? members.reduce((n, c) => n + c.longXp, 0) : null,
    reason: !members.length
      ? 'Keine aktive Party.'
      : !levelsKnown
        ? 'Einige aktive Figuren haben noch keine bestätigten XP.'
        : !available
          ? 'Raststand einzelner Figuren ist noch offen. Lange Rast am Spieltisch bestätigen.'
          : 'Aktueller Stand aller aktiven Figuren, einschließlich Split Scenes.',
    rows,
    members,
  };
  let pacing = projectDayPacing(active);
  try {
    if (
      request.source === 'custom' &&
      (!Array.isArray(request.rows) || request.rows.some((r) => !r || r.count > 99))
    )
      throw new Error('Eigene Zeilen benötigen eine Anzahl von 1–99.');
    if (request.source === 'custom' && request.encounters !== undefined)
      calculateDay(request.rows, 0);
    const basis = request.source === 'active' ? rows : request.rows;
    const itinerary =
      request.encounters === undefined
        ? undefined
        : readDayItinerary(
            db,
            cam,
            request.encounters,
            basis.map((r, i) => ({ id: String(i), name: '', ...r })),
            request.source === 'active' ? active : null,
          );
    const totalXp = itinerary?.totalLoadXp ?? request.totalXp,
      rewardXp = itinerary?.totalRewardXp ?? request.rewardXp ?? totalXp;
    if (request.source === 'active')
      pacing = itinerary?.pacing ?? projectDayPacing(active, totalXp);
    if (request.source === 'active' && !levelsKnown)
      return {
        snapshot,
        pacing,
        itinerary,
        calculation: null,
        problem:
          'Für die aktive Party fehlen Level. XP im Roster ergänzen oder eigene Rechnerzeilen verwenden.',
      };
    const calculation = calculateDay(
      basis as { level: number; count: number }[],
      totalXp,
      rewardXp,
    );
    if (request.source === 'active')
      calculation.projections = members.map((c) => {
        const afterXp = c.xp! + calculation.shareXp;
        return {
          name: c.name,
          count: 1,
          beforeXp: c.xp!,
          afterXp,
          beforeLevel: c.level!,
          afterLevel: xpLevel(afterXp).level,
        };
      });
    return {
      snapshot,
      pacing,
      itinerary,
      calculation,
      advancement: projectDayAdvancement(calculation, itinerary?.stages),
      problem: null,
    };
  } catch (error) {
    return { snapshot, pacing, calculation: null, problem: (error as Error).message };
  }
}
