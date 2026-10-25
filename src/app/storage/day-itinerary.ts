import { readEncounterPlan } from './encounters';
import { assessEncounter, type EncounterParty } from '../catalog/encounter-contracts';
import { xpShare, levelXp, restAfter, type Progress } from '../runtime/progression';
import { projectDayPacing, projectDayRestStops } from '../runtime/adventuring-day-model';
import type { DayPlanEntry, DayItinerary } from '../runtime/adventuring-day-contracts';

/** Read saved source revisions only. Each fight is rounded separately like a real award. */
export function readDayItinerary(
  db: any,
  cam: string,
  entries: DayPlanEntry[],
  party: EncounterParty[],
  active: (Progress & { name: string })[] | null,
): DayItinerary {
  if (
    !Array.isArray(entries) ||
    entries.length > 20 ||
    entries.some(
      (e) =>
        !e ||
        typeof e.id !== 'string' ||
        !e.id ||
        !Number.isSafeInteger(e.revision) ||
        e.revision < 1 ||
        !Number.isSafeInteger(e.count) ||
        e.count < 1 ||
        e.count > 99 ||
        (e.restBefore !== undefined && !['short', 'long'].includes(e.restBefore)),
    )
  )
    throw new Error(
      'Tagesplan: höchstens 20 gespeicherte Vorlagen mit jeweils 1–99 Wiederholungen wählen.',
    );
  const partySize = party.reduce((n, p) => n + p.count, 0),
    out: DayItinerary = {
      partySize,
      stages: [],
      rawLoadXp: 0,
      rawRewardXp: 0,
      totalLoadXp: 0,
      totalRewardXp: 0,
      plannedRests: { short: 0, long: 0 },
    };
  if (!partySize && entries.length)
    throw new Error(
      'Für den Encounter-Tagesplan zuerst eine Party oder eigene Rechnerzeilen wählen.',
    );
  // Work on isolated Party facts. Custom level groups start with a fresh long rest.
  const initial =
    active ??
    party.flatMap((p) =>
      Array.from({ length: p.count }, (_, i) => ({
        characterId: p.id + ':' + i,
        name: p.name,
        xp: levelXp[p.level! - 1]!,
        revision: 0,
        rest: { known: true, longXp: 0, shortXp: 0, baseline: 0, sections: 0 },
        health: null,
      })),
    );
  const projected = initial.map((p) => ({ ...p, rest: { ...p.rest } }));
  // A rest split reuses its source. Scope reuse to this read transaction only.
  const sources = new Map<
    string,
    { plan: ReturnType<typeof readEncounterPlan>; assessment?: ReturnType<typeof assessEncounter> }
  >();
  for (const entry of entries) {
    let source = sources.get(entry.id);
    if (!source) {
      source = { plan: readEncounterPlan(db, cam, entry.id) };
      sources.set(entry.id, source);
    }
    const { plan } = source;
    if (plan.revision !== entry.revision)
      throw new Error(
        'Vorlage „' + plan.name + '“ wurde geändert. Im Tagesplan „Vorlagen aktualisieren“ wählen.',
      );
    const assessment = (source.assessment ??= assessEncounter(
      party,
      plan.entries.map((e) => ({
        count: e.count,
        xp: plan.sources.find((c) => c.id === e.creatureId)?.xp,
      })),
    ));
    if (assessment.missingXp)
      throw new Error(
        'Vorlage „' +
          plan.name +
          '“: XP fehlen für ' +
          assessment.missingXp +
          ' Kreaturen. Quelle im Encounter-Editor ergänzen.',
      );
    if (!assessment.count) throw new Error('Vorlage „' + plan.name + '“ enthält keine Gegner.');
    const load = xpShare(assessment.adjustedXp, partySize),
      reward = xpShare(assessment.baseXp, partySize);
    out.rawLoadXp += assessment.adjustedXp * entry.count;
    out.rawRewardXp += assessment.baseXp * entry.count;
    out.totalLoadXp += load.total * entry.count;
    out.totalRewardXp += reward.total * entry.count;
    if (
      ![out.rawLoadXp, out.rawRewardXp, out.totalLoadXp, out.totalRewardXp].every(
        (n) => Number.isSafeInteger(n) && n <= 1e12,
      )
    )
      throw new Error('Tagesplan überschreitet 1 Billion XP. Wiederholungen verringern.');
    if (entry.restBefore) {
      out.plannedRests[entry.restBefore]++;
      for (const p of projected) p.rest = restAfter(p.rest, entry.restBefore);
    }
    const restStops = projectDayRestStops(projected, load.share, entry.count);
    for (const p of projected) {
      p.rest.longXp += load.share * entry.count;
      p.rest.shortXp += load.share * entry.count;
    }
    const pacing = projectDayPacing(initial, out.totalLoadXp, projected);
    out.stages.push({
      ...entry,
      name: plan.name,
      difficulty: assessment.difficulty,
      baseXp: assessment.baseXp,
      adjustedXp: assessment.adjustedXp,
      multiplier: assessment.multiplier,
      loadShare: load.share,
      rewardShare: reward.share,
      cumulativeLoadXp: out.totalLoadXp,
      cumulativeRewardXp: out.totalRewardXp,
      shortDue: pacing.projectedKnown
        ? pacing.members.filter((m) => m.after?.due === 'short').length
        : null,
      longDue: pacing.projectedKnown
        ? pacing.members.filter((m) => m.after?.due === 'long').length
        : null,
      knownRestStates: pacing.projectedKnown ?? 0,
      restStops,
    });
  }
  if (active)
    out.pacing = {
      ...projectDayPacing(initial, out.totalLoadXp, projected),
      plannedRests: out.plannedRests,
    };
  return out;
}
