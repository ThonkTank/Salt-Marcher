import type { Result } from '../shared/contracts';
import type { Creature, CreatureCatalogQuery } from '../../features/catalog/creature-catalog';
import type { CatalogReference } from './catalog-reference-contracts';
import { validateCatalogReference } from './catalog-reference-contracts';
export interface EncounterParty {
  id: string;
  name: string;
  level: number | null;
  count: number;
}
export interface EncounterEntry {
  id: string;
  creatureId: string;
  count: number;
  grouped: boolean;
  groupName?: string;
  worldActorIds?: string[];
  actorNames?: string[];
  allowAnonymous?: boolean;
}
export interface EncounterItem {
  id: string;
  reference: CatalogReference;
  quantity: number;
}
export interface EncounterItemFacts {
  id: string;
  revision: number;
  name: string;
  unitCopper: string | null;
}
export interface EncounterPlanDefinition {
  items?: EncounterItem[];
  id: string;
  revision: number;
  name: string;
  notes: string;
  party: EncounterParty[];
  entries: EncounterEntry[];
  catalogHash: string;
  generationOrigin?: {
    runId: string;
    index: number;
    seed: string;
    preset: { id: string; name: string; revision: number; hash: string; mobThreshold: number };
  };
}
/** Canonical reusable definition. Sources remain global even in independent campaign copies. */
export interface StoredEncounterPlan extends EncounterPlanDefinition {
  sources: CatalogReference[];
}
export interface EncounterPlan extends EncounterPlanDefinition {
  /** Resolved display/frozen historical facts; never written into encounter_plan. */
  sources: Creature[];
  sourceReferences?: CatalogReference[];
  resolvedItems?: EncounterItemFacts[];
}
export const encounterPlanFields = {
  id: true,
  revision: true,
  name: true,
  notes: true,
  party: true,
  entries: true,
  sources: true,
  sourceReferences: true,
  catalogHash: true,
  generationOrigin: true,
  items: true,
  resolvedItems: true,
} satisfies Record<keyof EncounterPlan, true>;
export function validateEncounterPlanInput(input: EncounterPlan): void {
  if (
    !input ||
    !input.id ||
    typeof input.name !== 'string' ||
    input.name.length > 1000 ||
    typeof input.notes !== 'string' ||
    input.notes.length > 2000000 ||
    !Array.isArray(input.party) ||
    input.party.length > 1000 ||
    !Array.isArray(input.entries) ||
    input.entries.length > 1000
  )
    throw new Error('Ungültige Encounter-Vorlage.');
  if (input.sourceReferences !== undefined) {
    if (!Array.isArray(input.sourceReferences) || input.sourceReferences.length > 1000)
      throw new Error('Encounter-Katalogreferenzen prüfen.');
    input.sourceReferences.forEach(validateCatalogReference);
  }
  if (input.items !== undefined) {
    if (!Array.isArray(input.items) || input.items.length > 1000)
      throw new Error('Encounter-Gegenstandsreferenzen prüfen.');
    const itemIds = new Set<string>();
    for (const item of input.items) {
      if (
        !item ||
        typeof item.id !== 'string' ||
        !item.id ||
        itemIds.has(item.id) ||
        !Number.isSafeInteger(item.quantity) ||
        item.quantity < 1 ||
        item.quantity > 1000000
      )
        throw new Error('Encounter-Gegenstandsmenge oder Identität prüfen.');
      itemIds.add(item.id);
      validateCatalogReference(item.reference);
      if (item.reference.entryType !== 'item')
        throw new Error('Encounter-Gegenstand benötigt eine Itemreferenz.');
    }
  }
  const ids = new Set<string>();
  for (const p of input.party) {
    if (
      !p ||
      !p.id ||
      ids.has(p.id) ||
      typeof p.name !== 'string' ||
      p.name.length > 1000 ||
      (p.level !== null && (!Number.isSafeInteger(p.level) || p.level < 1 || p.level > 20)) ||
      !Number.isSafeInteger(p.count) ||
      p.count < 1 ||
      p.count > 10000
    )
      throw new Error('Ungültige Planungsparty.');
    ids.add(p.id);
  }
  ids.clear();
  const actors = new Set<string>();
  for (const e of input.entries) {
    if (
      !e ||
      !e.id ||
      ids.has(e.id) ||
      !Number.isSafeInteger(e.count) ||
      e.count < 1 ||
      e.count > 1000 ||
      typeof e.grouped !== 'boolean'
    )
      throw new Error('Ungültiger Encounter-Eintrag.');
    if (e.groupName !== undefined && (typeof e.groupName !== 'string' || e.groupName.length > 120))
      throw new Error('Truppname benötigt höchstens 120 Zeichen.');
    ids.add(e.id);
    if (e.allowAnonymous !== undefined && typeof e.allowAnonymous !== 'boolean')
      throw new Error('Ergänzbare NPC-Gruppe prüfen.');
    if (e.worldActorIds) {
      if (
        !Array.isArray(e.worldActorIds) ||
        e.worldActorIds.length > e.count ||
        (e.worldActorIds.length < e.count && e.allowAnonymous !== true) ||
        new Set(e.worldActorIds).size !== e.worldActorIds.length ||
        e.worldActorIds.some((id) => typeof id !== 'string' || !id || actors.has(id))
      )
        throw new Error('Benannte NPCs benötigen eindeutige Weltfiguren, jede nur einmal.');
      for (const id of e.worldActorIds) actors.add(id);
    }
    if (
      e.actorNames !== undefined &&
      (!Array.isArray(e.actorNames) ||
        e.actorNames.length !== (e.worldActorIds?.length ?? 0) ||
        e.actorNames.some((n) => typeof n !== 'string' || n.length > 1000))
    )
      throw new Error('NPC-Namen im Vorschlag prüfen.');
  }
}
export function encounterEntryLabel(e: EncounterEntry, sources: EncounterPlan['sources']) {
  const creature = sources.find((c) => c.id === e.creatureId)?.name ?? e.creatureId,
    named = e.worldActorIds?.length ?? 0;
  const title = e.groupName?.trim();
  return (
    (title ? title + ' · ' : '') +
    (named
      ? (e.actorNames?.join(', ') ?? 'Benannte NPCs') +
        (e.count > named ? ' + ' + (e.count - named) + ' × ' + creature : '')
      : e.count + ' × ' + creature)
  );
}
export interface EncounterAssessment {
  baseXp: number;
  adjustedXp: number;
  multiplier: number;
  count: number;
  partySize: number;
  unknownLevels: number;
  difficulty: string | null;
  thresholds: number[];
  missingXp: number;
}
export interface CreaturePage {
  rows: Pick<
    Creature,
    'id' | 'name' | 'challengeRating' | 'cr' | 'type' | 'size' | 'ac' | 'hp' | 'xp' | 'sourceLabel'
  >[];
  total: number;
  offset: number;
  limit: number;
}
export interface CatalogInfo {
  count: number;
  types: string[];
  subtypes: string[];
  sizes: string[];
  habitats: string[];
  alignments: string[];
  notice: string;
  hash: string;
}
export interface EncounterPlanCommand {
  commandId: string;
  campaignId: string;
  token: string;
  plan: EncounterPlan;
  expectedRevision: number | null;
}
export interface EncounterAPI {
  catalogReference(entryType: 'creature' | 'item', id: string): Promise<Result<CatalogReference>>;
  resolveCatalogReference(
    reference: CatalogReference,
  ): Promise<Result<{ reference: CatalogReference; name: string }>>;
  creatureInfo(): Promise<Result<CatalogInfo>>;
  creatures(query: CreatureCatalogQuery): Promise<Result<CreaturePage>>;
  creature(id: string): Promise<Result<Creature>>;
  encounterPlans(
    token: string,
    search: string,
    limit?: number,
  ): Promise<Result<{ id: string; revision: number; name: string }[]>>;
  encounterPlan(token: string, id: string): Promise<Result<EncounterPlan>>;
  saveEncounterPlan(command: EncounterPlanCommand): Promise<Result<EncounterPlan>>;
}
export const encounterThresholds = [
  [25, 50, 75, 100],
  [50, 100, 150, 200],
  [75, 150, 225, 400],
  [125, 250, 375, 500],
  [250, 500, 750, 1100],
  [300, 600, 900, 1400],
  [350, 750, 1100, 1700],
  [450, 900, 1400, 2100],
  [550, 1100, 1600, 2400],
  [600, 1200, 1900, 2800],
  [800, 1600, 2400, 3600],
  [1000, 2000, 3000, 4500],
  [1100, 2200, 3400, 5100],
  [1250, 2500, 3800, 5700],
  [1400, 2800, 4300, 6400],
  [1600, 3200, 4800, 7200],
  [2000, 3900, 5900, 8800],
  [2100, 4200, 6300, 9500],
  [2400, 4900, 7300, 10900],
  [2800, 5700, 8500, 12700],
] as const;
export function encounterXpMultiplier(count: number, partySize: number): number {
  if (!count) return 0;
  const factors = [0.5, 1, 1.5, 2, 2.5, 3, 4, 5];
  let index =
    count <= 1 ? 1 : count === 2 ? 2 : count <= 6 ? 3 : count <= 10 ? 4 : count <= 14 ? 5 : 6;
  if (partySize > 0 && partySize < 3) index++;
  if (partySize > 5) index--;
  return factors[index]!;
}
export function assessEncounter(
  party: readonly EncounterParty[],
  opponents: readonly { xp: number | undefined; count: number; countForMultiplier?: boolean }[],
): EncounterAssessment {
  for (const p of party)
    if (
      !Number.isSafeInteger(p.count) ||
      p.count < 1 ||
      (p.level !== null && (!Number.isSafeInteger(p.level) || p.level < 1 || p.level > 20))
    )
      throw new Error(
        'Planungsparty benötigt Level 1–20 oder ein leeres Level sowie eine positive ganze Anzahl.',
      );
  for (const e of opponents)
    if (
      !Number.isSafeInteger(e.count) ||
      e.count < 1 ||
      (e.xp !== undefined && (!Number.isSafeInteger(e.xp) || e.xp < 0))
    )
      throw new Error('Encounter benötigt gültige Kreaturmengen und XP.');
  const count = opponents.reduce((n, e) => n + (e.countForMultiplier === false ? 0 : e.count), 0),
    partySize = party.reduce((n, p) => n + p.count, 0);
  const multiplier = encounterXpMultiplier(count, partySize),
    baseXp = opponents.reduce((n, e) => n + (e.xp ?? 0) * e.count, 0),
    adjustedXp = Math.round(baseXp * multiplier);
  const unknownLevels = party.filter((p) => p.level === null).reduce((n, p) => n + p.count, 0),
    missingXp = opponents.filter((e) => e.xp === undefined).reduce((n, e) => n + e.count, 0);
  const thresholds = [0, 0, 0, 0];
  for (const p of party)
    if (p.level !== null)
      for (let i = 0; i < 4; i++) thresholds[i]! += encounterThresholds[p.level - 1]![i]! * p.count;
  const difficulty =
    !partySize || unknownLevels || missingXp
      ? null
      : adjustedXp >= thresholds[3]!
        ? 'Tödlich'
        : adjustedXp >= thresholds[2]!
          ? 'Schwer'
          : adjustedXp >= thresholds[1]!
            ? 'Mittel'
            : adjustedXp >= thresholds[0]!
              ? 'Leicht'
              : 'Trivial';
  return {
    baseXp,
    adjustedXp,
    multiplier,
    count,
    partySize,
    unknownLevels,
    difficulty,
    thresholds,
    missingXp,
  };
}
