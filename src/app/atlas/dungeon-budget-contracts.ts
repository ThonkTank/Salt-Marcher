import type { GraphContentCounts } from './graph-contracts';
export const budgetRarities = ['Common', 'Uncommon', 'Rare', 'Very Rare', 'Legendary'] as const;
export function budgetRarity(value: string): BudgetRarity | null {
  const plain = value.toLowerCase().replace(/[\s_-]/g, '');
  return (
    budgetRarities.find((r) => r.toLowerCase().replaceAll(' ', '') === plain) ??
    (
      {
        gewöhnlich: 'Common',
        ungewöhnlich: 'Uncommon',
        selten: 'Rare',
        sehrselten: 'Very Rare',
        legendär: 'Legendary',
      } as Record<string, BudgetRarity>
    )[plain] ??
    null
  );
}
export type BudgetRarity = (typeof budgetRarities)[number];
export interface DungeonBudgetSetting {
  ownerId: string;
  level: number | null;
  sessions: number | null;
  partySize: number | null;
  dayFraction: string | null;
  rewardXpPerSession: number | null;
  mutedWarnings: boolean;
}
export interface DungeonContent {
  reference: { kind: 'encounter' | 'group' | 'treasure'; id: string } | null;
  sourceReference?: { kind: 'encounter' | 'group' | 'treasure'; id: string } | null;
  search?: { method: string; dc: number | null; notes: string; revealedText: string };
  publicText: string;
  categories: string[];
  tags: string[];
  trapXp: number | null;
  anchor: { volumeId: string; x: number; y: number; z: number };
}
export interface DungeonBudgetValues {
  adjustedXp: number;
  baseXp: number;
  goldCopper: string;
  magic: Record<BudgetRarity, number>;
  unknownDanger: number;
  unknownGold: number;
  unknownMagic: number;
}
export interface DungeonFeatureFact {
  id: string;
  roomId: string | null;
  placed: boolean;
  kind: string;
  title: string;
  ownerId: string;
  referenceId: string | null;
  referenceLabel: string;
  problem: string | null;
  values: DungeonBudgetValues;
}
export interface DungeonBudgetSummary {
  ownerId: string;
  name: string;
  kind: 'dungeon' | 'level' | 'group';
  parentId: string | null;
  level: number | null;
  levelOrigin: string;
  partySize: number;
  dayFraction: string;
  rewardXpPerSession: number;
  settings: DungeonBudgetSetting;
  allocatedSessions: number | null;
  rolledSessions: number;
  childSessions: number;
  unallocatedSessions: number | null;
  targets: DungeonBudgetValues;
  targetComplete: boolean;
  actual: DungeonBudgetValues;
  counts: GraphContentCounts;
  roomCount: number;
  contentRooms: number;
  featureIds: string[];
  warnings: string[];
  muted: boolean;
}
export interface DungeonBudgetView {
  scopes: DungeonBudgetSummary[];
  facts: DungeonFeatureFact[];
  preset: { id: string; name: string; revision: number };
  encounters: { id: string; name: string }[];
  treasures: { id: string; name: string }[];
  groups?: { id: string; name: string }[];
}

export function validateBudgetSettings(values: unknown): asserts values is DungeonBudgetSetting[] {
  if (!Array.isArray(values) || values.length > 1000) throw new Error('Budgetbereiche prüfen.');
  const ids = new Set<string>();
  for (const v of values) {
    if (
      !v ||
      typeof v !== 'object' ||
      Array.isArray(v) ||
      typeof v.ownerId !== 'string' ||
      !v.ownerId ||
      v.ownerId.length > 1000 ||
      ids.has(v.ownerId) ||
      (v.level !== null && (!Number.isSafeInteger(v.level) || v.level < 1 || v.level > 20)) ||
      (v.sessions !== null &&
        (!Number.isFinite(v.sessions) || v.sessions < 0 || v.sessions > 1000)) ||
      (v.partySize !== null &&
        (!Number.isSafeInteger(v.partySize) || v.partySize < 1 || v.partySize > 1000)) ||
      (v.dayFraction !== null &&
        (typeof v.dayFraction !== 'string' ||
          !/^\d+(\.\d+)?$/.test(v.dayFraction) ||
          Number(v.dayFraction) <= 0 ||
          Number(v.dayFraction) > 10)) ||
      (v.rewardXpPerSession !== null &&
        (!Number.isSafeInteger(v.rewardXpPerSession) ||
          v.rewardXpPerSession < 0 ||
          v.rewardXpPerSession > 100000000)) ||
      typeof v.mutedWarnings !== 'boolean'
    )
      throw new Error('Ziellevel, Sessionanteile und Budgetparty prüfen.');
    ids.add(v.ownerId);
  }
}

export function validateDungeonContentValue(value: unknown): asserts value is DungeonContent {
  const object = (v: unknown): v is Record<string, any> =>
    !!v && typeof v === 'object' && !Array.isArray(v);
  const id = (v: unknown) => typeof v === 'string' && v.length > 0 && v.length <= 1000;
  const reference = (v: unknown) =>
    v === null || (object(v) && ['encounter', 'group', 'treasure'].includes(v.kind) && id(v.id));
  const strings = (v: unknown) =>
    Array.isArray(v) &&
    v.length <= 1000 &&
    v.every((s) => typeof s === 'string' && s.length <= 2000000);
  if (!object(value)) throw new Error('Dungeon-Inhalt prüfen.');
  if (
    typeof value.publicText !== 'string' ||
    value.publicText.length > 2000000 ||
    !strings(value.categories) ||
    !strings(value.tags) ||
    !reference(value.reference) ||
    (value.sourceReference !== undefined && !reference(value.sourceReference)) ||
    (value.trapXp !== null &&
      (!Number.isSafeInteger(value.trapXp) || value.trapXp < 0 || value.trapXp > 100000000)) ||
    !object(value.anchor) ||
    !id(value.anchor.volumeId) ||
    ![value.anchor.x, value.anchor.y, value.anchor.z].every(Number.isSafeInteger)
  )
    throw new Error('Dungeon-Inhalt, Quellenbezug oder Voxelanker prüfen.');
}
