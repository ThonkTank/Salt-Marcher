import { assessEncounter } from '../catalog/encounter-contracts';
import { dailyXp } from './experience-tables';
import { decimal, multiply, rational, roundHalfUp } from '../campaign/generation/rational';
import { exactWeight } from '../campaign/generation-contracts';
import type { ManualPlan } from '../../features/planner/manual-planner';
import type { VisitDetail, SessionProfile, SessionView } from '../campaign/session-contracts';
export const restLabel = (kind: 'short' | 'long') =>
  kind === 'short' ? 'Kurze Rast' : 'Lange Rast';
export function checkVisitPlanning(detail: VisitDetail) {
  if (
    detail.allocationXp !== undefined &&
    (!Number.isSafeInteger(detail.allocationXp) || detail.allocationXp < 0)
  )
    throw new Error('Szenenbudget benötigt nichtnegative ganze XP.');
  const rest = detail.restAfter;
  if (
    rest !== undefined &&
    (!rest ||
      !['short', 'long'].includes(rest.kind) ||
      typeof rest.beforeVisitId !== 'string' ||
      !rest.beforeVisitId.trim() ||
      rest.beforeVisitId.length > 1000)
  )
    throw new Error('Geplante Rast hat eine ungültige Szenenbindung.');
}
/** Rests belong to a gap, never to a new or reordered neighbour by accident. */
export function copyVisitPlanning(
  detail: VisitDetail,
  sourceIds: readonly string[],
  targetIds: readonly string[],
): Pick<VisitDetail, 'restAfter'> {
  const i = sourceIds.indexOf(detail.visitId);
  return detail.restAfter && i >= 0 && sourceIds[i + 1] === detail.restAfter.beforeVisitId
    ? { restAfter: { kind: detail.restAfter.kind, beforeVisitId: targetIds[i + 1]! } }
    : {};
}
export function sessionDay(
  plan: ManualPlan,
  view: SessionView,
  profile: SessionProfile = view.profile,
) {
  let dayBudget: number | null = null,
    budget: number | null = null;
  if (profile.party.length && profile.party.every((p) => p.level !== null)) {
    dayBudget = profile.party.reduce((n, p) => n + dailyXp[p.level! - 1]! * p.count, 0);
    budget = Number(
      roundHalfUp(
        multiply(rational(BigInt(dayBudget)), decimal(exactWeight(profile.adventureDayFraction))),
      ),
    );
  }
  let plannedXp = 0,
    allocatedXp = 0,
    missingXp = 0,
    sinceLong = 0,
    sinceShort = 0;
  const rows = plan.scenes.map((scene, index) => {
    const detail = view.visits.find((v) => v.visitId === scene.id),
      groups = (detail?.groupIds ?? []).map((id) => view.groups.find((g) => g.id === id));
    const opponents = groups.flatMap(
      (g) =>
        g?.plan.entries.map((e) => ({
          xp: g.plan.sources.find((c) => c.id === e.creatureId)?.xp,
          count: e.count,
        })) ?? [{ xp: undefined, count: 1 }],
    );
    const assessment = assessEncounter(profile.party, opponents);
    plannedXp += assessment.adjustedXp;
    allocatedXp += detail?.allocationXp ?? 0;
    missingXp += assessment.missingXp;
    sinceLong += assessment.adjustedXp;
    sinceShort += assessment.adjustedXp;
    const next = plan.scenes[index + 1],
      rest = detail?.restAfter?.beforeVisitId === next?.id ? detail?.restAfter : null;
    const suggestion: 'short' | 'long' | null =
      next && dayBudget && opponents.length
        ? sinceLong >= dayBudget
          ? 'long'
          : sinceShort >= dayBudget / 3
            ? 'short'
            : null
        : null;
    const row = {
      scene,
      detail,
      assessment,
      groupCount: groups.length,
      cumulativeXp: plannedXp,
      sinceLongXp: sinceLong,
      rest,
      suggestion,
    };
    if (rest?.kind === 'long') sinceLong = sinceShort = 0;
    else if (rest?.kind === 'short') sinceShort = 0;
    return row;
  });
  return {
    dayBudget,
    budget,
    plannedXp,
    allocatedXp,
    missingXp,
    remainingXp: budget === null ? null : budget - plannedXp,
    rows,
  };
}
