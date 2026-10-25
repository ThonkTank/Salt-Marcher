import type { DungeonGeometry } from './dungeon-contracts';
import type { GraphLayout, GraphContentCounts } from './graph-contracts';
import type {
  DungeonBudgetSummary,
  DungeonBudgetSetting,
  DungeonFeatureFact,
  DungeonBudgetValues,
} from './dungeon-budget-contracts';
import { budgetRarities, validateBudgetSettings } from './dungeon-budget-contracts';
import { dailyXp } from '../progression';
import { decimal, multiply, rational, roundHalfUp } from '../generation/rational';
import { rewardGuidance, type RewardGuidanceRules } from '../generation/reward-guidance';
export const emptyBudgetValues = (): DungeonBudgetValues => ({
  adjustedXp: 0,
  baseXp: 0,
  goldCopper: '0',
  magic: { Common: 0, Uncommon: 0, Rare: 0, 'Very Rare': 0, Legendary: 0 },
  unknownDanger: 0,
  unknownGold: 0,
  unknownMagic: 0,
});
export function addBudget(a: DungeonBudgetValues, b: DungeonBudgetValues) {
  a.adjustedXp += b.adjustedXp;
  a.baseXp += b.baseXp;
  a.goldCopper = String(BigInt(a.goldCopper) + BigInt(b.goldCopper));
  for (const r of budgetRarities) a.magic[r] += b.magic[r];
  a.unknownDanger += b.unknownDanger;
  a.unknownGold += b.unknownGold;
  a.unknownMagic += b.unknownMagic;
}
export function budgetSettings(ownerId: string): DungeonBudgetSetting {
  return {
    ownerId,
    level: null,
    sessions: null,
    partySize: null,
    dayFraction: null,
    rewardXpPerSession: null,
    mutedWarnings: false,
  };
}

export function featureBudgetOwner(g: DungeonGeometry, scopeId: string, roomId: string | null) {
  const records = g.drawing.keyContent ?? [],
    parent = (id: string) => {
      const k = records.find((k) => k.kind === 'room' && k.id === id);
      return k?.groupId ?? k?.levelId ?? scopeId;
    };
  if (!roomId) return scopeId;
  const own = parent(roomId);
  if (own !== scopeId) return own;
  const path = g.drawing.paths?.find((p) => p.roomId === roomId);
  if (!path) return own;
  const a = parent(path.from.roomId),
    b = parent(path.to.roomId);
  if (a === b) return a;
  const level = (id: string) =>
    records.find((k) => k.id === id && k.kind === 'group')?.levelId ??
    (records.some((k) => k.id === id && k.kind === 'level') ? id : null);
  return level(a) && level(a) === level(b) ? level(a)! : scopeId;
}
const counts = (): GraphContentCounts => ({
  danger: 0,
  encounters: 0,
  treasure: 0,
  rewards: 0,
  curiosities: 0,
  puzzles: 0,
  secrets: 0,
});
function addCounts(a: GraphContentCounts, b: GraphContentCounts) {
  for (const k of Object.keys(a) as (keyof GraphContentCounts)[]) a[k] += b[k];
}
export function dungeonBudgetSummaries(
  g: DungeonGeometry,
  layout: GraphLayout,
  scopeId: string,
  facts: DungeonFeatureFact[],
  rules: RewardGuidanceRules,
  defaultPartySize = 4,
): DungeonBudgetSummary[] {
  const keys = g.drawing.keyContent ?? [],
    rootName =
      keys.find((k) => k.kind === 'dungeon' && k.scopeId === scopeId)?.name ?? 'Gesamter Dungeon',
    owners = [
      { id: scopeId, name: rootName, kind: 'dungeon' as const, parentId: null },
      ...keys
        .filter((k) => k.scopeId === scopeId && ['level', 'group'].includes(k.kind))
        .map((k) => ({
          id: k.id,
          name: k.name,
          kind: k.kind as 'level' | 'group',
          parentId: k.kind === 'group' ? (k.levelId ?? scopeId) : scopeId,
        })),
    ],
    settings = layout.budgets ?? [],
    results = new Map<string, DungeonBudgetSummary>();
  validateBudgetSettings(settings);
  const calculate = (owner: (typeof owners)[number]): DungeonBudgetSummary => {
    const found = results.get(owner.id);
    if (found) return found;
    const own = settings.find((s) => s.ownerId === owner.id) ?? budgetSettings(owner.id),
      parent = owner.parentId ? calculate(owners.find((o) => o.id === owner.parentId)!) : null,
      level = own.level ?? parent?.level ?? null,
      partySize = own.partySize ?? parent?.partySize ?? Math.max(1, defaultPartySize),
      dayFraction = own.dayFraction ?? parent?.dayFraction ?? '0.5',
      levelOrigin = own.level !== null ? owner.name : (parent?.levelOrigin ?? 'Ziellevel fehlt'),
      rewardXpPerSession =
        own.rewardXpPerSession ??
        (level === null
          ? 0
          : roundHalfUp(
              multiply(rational(BigInt(dailyXp[level - 1]! * partySize)), decimal(dayFraction)),
            )),
      result: DungeonBudgetSummary = {
        ownerId: owner.id,
        name: owner.name,
        kind: owner.kind,
        parentId: owner.parentId,
        level,
        levelOrigin,
        partySize,
        dayFraction,
        rewardXpPerSession,
        settings: own,
        allocatedSessions: own.sessions,
        rolledSessions: 0,
        childSessions: 0,
        unallocatedSessions: null,
        targets: emptyBudgetValues(),
        targetComplete: true,
        actual: emptyBudgetValues(),
        counts: counts(),
        roomCount: 0,
        contentRooms: 0,
        featureIds: [],
        warnings: [],
        muted: own.mutedWarnings,
      };
    results.set(owner.id, result);
    return result;
  };
  for (const owner of owners) calculate(owner);
  const ownRooms = new Map<string, Set<string>>(),
    contentRooms = new Map<string, Set<string>>();
  for (const room of g.rooms.filter((r) => r.scopeId === scopeId)) {
    const owner = featureBudgetOwner(g, scopeId, room.id),
      set = ownRooms.get(owner) ?? new Set();
    set.add(room.id);
    ownRooms.set(owner, set);
  }
  for (const fact of facts.filter((f) => f.placed)) {
    const s = results.get(fact.ownerId) ?? results.get(scopeId)!;
    addBudget(s.actual, fact.values);
    s.featureIds.push(fact.id);
    const e = g.drawing.elements.find((e) => e.id === fact.id);
    if (e?.secret) s.counts.secrets++;
    if (fact.kind === 'trap' || fact.kind === 'encounter') s.counts.danger++;
    if (fact.kind === 'encounter') s.counts.encounters++;
    if (fact.kind === 'loot') {
      s.counts.treasure++;
      s.counts.rewards++;
    }
    if (fact.kind === 'curiosity' || fact.kind === 'puzzle') s.counts.curiosities++;
    if (fact.kind === 'puzzle' || e?.content?.tags.some((t) => t.toLowerCase() === 'puzzle'))
      s.counts.puzzles++;
    if (fact.roomId) {
      const rooms = contentRooms.get(s.ownerId) ?? new Set();
      rooms.add(fact.roomId);
      contentRooms.set(s.ownerId, rooms);
    }
  }
  const roll = (s: DungeonBudgetSummary) => {
    const children = [...results.values()].filter((c) => c.parentId === s.ownerId);
    for (const child of children) {
      roll(child);
      s.childSessions += child.rolledSessions;
      addBudget(s.targets, child.targets);
      addBudget(s.actual, child.actual);
      addCounts(s.counts, child.counts);
      s.featureIds.push(...child.featureIds);
      s.targetComplete &&= child.targetComplete;
      const rooms = ownRooms.get(s.ownerId) ?? new Set();
      for (const room of ownRooms.get(child.ownerId) ?? []) rooms.add(room);
      ownRooms.set(s.ownerId, rooms);
      const filled = contentRooms.get(s.ownerId) ?? new Set();
      for (const room of contentRooms.get(child.ownerId) ?? []) filled.add(room);
      contentRooms.set(s.ownerId, filled);
    }
    s.rolledSessions = s.allocatedSessions ?? s.childSessions;
    s.unallocatedSessions =
      s.allocatedSessions === null ? null : s.allocatedSessions - s.childSessions;
    const directSessions = Math.max(0, s.unallocatedSessions ?? 0);
    if (directSessions > 0) {
      if (s.level === null) s.targetComplete = false;
      else {
        const target = emptyBudgetValues();
        target.adjustedXp = roundHalfUp(
          multiply(
            rational(BigInt(dailyXp[s.level - 1]! * s.partySize)),
            multiply(decimal(s.dayFraction), decimal(String(directSessions))),
          ),
        );
        target.baseXp = roundHalfUp(
          multiply(rational(BigInt(s.rewardXpPerSession)), decimal(String(directSessions))),
        );
        try {
          const reward = rewardGuidance(s.level, s.partySize, target.baseXp, rules);
          target.goldCopper = reward.goldCopper;
          target.magic = reward.magic;
        } catch (e) {
          s.targetComplete = false;
          s.warnings.push((e as Error).message);
        }
        addBudget(s.targets, target);
      }
    }
    s.roomCount = ownRooms.get(s.ownerId)?.size ?? 0;
    s.contentRooms = contentRooms.get(s.ownerId)?.size ?? 0;
    if ((s.unallocatedSessions ?? 0) < 0)
      s.warnings.push(
        'Unterbereiche besitzen ' +
          s.childSessions +
          ' Spielabende; zugeteilt sind ' +
          s.allocatedSessions +
          '. Überzuteilung bleibt eine GM-Entscheidung.',
      );
    if (s.allocatedSessions !== null && s.allocatedSessions > 0 && s.level === null)
      s.warnings.push('Ziellevel fehlt. Ziele enthalten nur bereits auswertbare Unterbereiche.');
    if (s.allocatedSessions !== null && s.allocatedSessions > 0 && s.targetComplete) {
      if (s.actual.unknownDanger)
        s.warnings.push(
          s.actual.unknownDanger +
            ' Gefahren besitzen keinen bekannten XP-Ansatz. XP-Vergleich ist unvollständig.',
        );
      else if (
        s.targets.adjustedXp > 0 &&
        (s.actual.adjustedXp < s.targets.adjustedXp * 0.5 ||
          s.actual.adjustedXp > s.targets.adjustedXp * 1.5)
      )
        s.warnings.push(
          'Gefahr-XP liegen bei ' +
            Math.round((s.actual.adjustedXp / s.targets.adjustedXp) * 100) +
            ' % des geplanten Tagesbudgets.',
        );
      if (s.actual.unknownGold)
        s.warnings.push(
          s.actual.unknownGold + ' Beuteeinträge besitzen keinen bekannten Nichtmagie-Wert.',
        );
      else if (
        BigInt(s.targets.goldCopper) > 0n &&
        (BigInt(s.actual.goldCopper) * 2n < BigInt(s.targets.goldCopper) ||
          BigInt(s.actual.goldCopper) * 2n > BigInt(s.targets.goldCopper) * 3n)
      )
        s.warnings.push('Nichtmagische Beute weicht um mehr als 50 % vom Fortschritts-Soll ab.');
      if (s.actual.unknownMagic)
        s.warnings.push(
          'Magische Beute besitzt ' + s.actual.unknownMagic + ' unklare Seltenheiten.',
        );
      else
        for (const r of budgetRarities) {
          const expected = s.targets.magic[r],
            actual = s.actual.magic[r];
          if (
            actual > Math.ceil(expected * 1.5) ||
            (expected >= 1 && actual < Math.floor(expected * 0.5))
          )
            s.warnings.push(
              'Magie ' +
                r +
                ': ' +
                actual +
                ' platziert, ' +
                expected.toFixed(2) +
                ' als Fortschritts-Erwartung. Keine automatische Ausgleichsbuchung.',
            );
        }
    }
    if (s.roomCount > 0 && s.contentRooms > 0)
      s.warnings.push(
        s.contentRooms +
          ' von ' +
          s.roomCount +
          ' Räumen tragen explizite Inhalte. Curiosity-Dichte ist keine Qualitätswertung.',
      );
  };
  roll(results.get(scopeId)!);
  return owners.map((o) => results.get(o.id)!);
}
