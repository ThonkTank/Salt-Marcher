import type { Result } from '../shared/contracts';
import type { CreatureCatalogQuery } from '../../features/catalog/creature-catalog';
import type {
  EncounterParty,
  EncounterPlan,
  EncounterAssessment,
} from '../catalog/encounter-contracts';
import type { GeneratorPresetConfigV3 } from './generation/config';
import type { EncounterComposition } from './generation/selector';
import type { ItemCategory, ItemInput } from '../catalog/item-input-contracts';
export interface WorldSource {
  disposition?: number;
  kind: 'faction' | 'location';
  id: string;
  revision: number;
  tableIds: string[];
  factionIds: string[];
  stock: { creatureId: string; limit: number }[];
}
export interface WorldSources {
  sources: WorldSource[];
  factions: { id: string; name: string }[];
  locations: { id: string; name: string }[];
}
export interface EncounterTable {
  id: string;
  revision: number;
  scope: 'campaign' | 'installation';
  name: string;
  description: string;
  entries: { creatureId: string; weight: string }[];
  habitats: string[];
  time: 'any' | 'day' | 'night';
  lootTableId: string | null;
  trashed: boolean;
}
export interface LootTableEntry {
  id: string;
  weight: string;
  minimum: number;
  maximum: number;
  item: { name: string; valueGold: string; category: ItemCategory };
}
export interface LootTable {
  id: string;
  revision: number;
  name: string;
  description: string;
  rolls: number;
  entries: LootTableEntry[];
  trashed: boolean;
}
export interface GeneratorPreset {
  id: string;
  revision: number;
  name: string;
  system: boolean;
  config: GeneratorPresetConfigV3;
  hash: string;
}
export const encounterTableFields = {
  id: true,
  revision: true,
  scope: true,
  name: true,
  description: true,
  entries: true,
  habitats: true,
  time: true,
  lootTableId: true,
  trashed: true,
} satisfies Record<keyof EncounterTable, true>;
export const generatorPresetFields = {
  id: true,
  revision: true,
  name: true,
  system: true,
  config: true,
  hash: true,
} satisfies Record<keyof GeneratorPreset, true>;
export interface GeneratorRegistry {
  revision: number;
  presets: GeneratorPreset[];
  assignedId: string | null;
  effectiveId: string;
}
export interface GenerationCommand {
  commandId: string;
  campaignId: string;
  token: string;
  action:
    | { kind: 'source-save'; source: WorldSource; expectedRevision: number | null }
    | { kind: 'table-save'; table: EncounterTable; expectedRevision: number | null }
    | { kind: 'table-trash'; id: string; expectedRevision: number; trashed: boolean }
    | { kind: 'loot-save'; table: LootTable; expectedRevision: number | null }
    | { kind: 'loot-trash'; id: string; expectedRevision: number; trashed: boolean }
    | { kind: 'preset-save'; preset: GeneratorPreset; expectedRegistryRevision: number }
    | {
        kind: 'preset-assign' | 'preset-delete';
        id: string | null;
        expectedRegistryRevision: number;
      };
}
export interface LootRollCommand {
  commandId: string;
  campaignId: string;
  token: string;
  tableId: string;
  expectedRevision: number;
  seed: string;
  title: string;
}
export interface LootRoll {
  tableId: string;
  tableRevision: number;
  seed: string;
  treasureId: string;
  items: ItemInput[];
}
export interface GenerationRequest {
  fillPlan?: { id: string; revision: number };
  requiredNpcIds?: string[];
  excludedNpcIds?: string[];
  includeNpcs?: boolean;
  npcOnly?: boolean;
  factionIds?: string[];
  locationId?: string | null;
  seed: string;
  tableIds: string[];
  filters: CreatureCatalogQuery;
  habitat: string;
  time: 'any' | 'day' | 'night';
  party: EncounterParty[];
  difficulty: 'weighted' | 'trivial' | 'easy' | 'medium' | 'hard' | 'deadly';
  amount: 'neutral' | 'few' | 'standard' | 'many';
  balance: 'neutral' | 'even' | 'varied';
  diversity: 'neutral' | 'low' | 'high';
  title: string;
  count: number;
  xpCeiling?: number | null;
  targetXp?: number;
}
export interface WorldSourceSnapshot {
  location: WorldSource | null;
  involved: WorldSource[];
  tableIds: string[];
  caps: { creatureId: string; limit: number }[];
}
export interface GenerationRun {
  fixedRoster?: EncounterPlan;
  sourceSnapshot?: WorldSourceSnapshot | null;
  npcBasis?: {
    id: string;
    name: string;
    creatureId: string | null;
    noteRevision: number;
    actorRevision: number | null;
    recordRevision: number;
    positionRevision: number | null;
    locationId: string | null;
    role: string;
  }[];
  sourceBasis?: string | null;
  id: string;
  revision: 1;
  seed: string;
  request: GenerationRequest;
  preset: { id: string; name: string; revision: number; hash: string; mobThreshold: number };
  tables: { id: string; revision: number }[];
  lootTables?: { id: string; revision: number }[];
  catalogHash: string;
  plans: (EncounterPlan & { assessment: EncounterAssessment; composition: EncounterComposition })[];
  warnings: string[];
  candidates: { creatureId: string; weight: string }[];
  acceptedPlanIds: string[];
}
export interface GenerationAPI {
  generationSources(token: string): Promise<Result<WorldSources>>;
  encounterTables(token: string, includeTrashed: boolean): Promise<Result<EncounterTable[]>>;
  lootTables(token: string, includeTrashed: boolean): Promise<Result<LootTable[]>>;
  presetRegistry(campaignId: string | null): Promise<Result<GeneratorRegistry>>;
  presetCommand(command: PresetCommand): Promise<Result<PresetReceipt>>;
  presetOutcome(command: PresetCommand): Promise<Result<PresetReceipt | null>>;
  generatorRegistry(token: string): Promise<Result<GeneratorRegistry>>;
  executeGeneration(
    command: GenerationCommand,
  ): Promise<
    Result<{ tables: EncounterTable[]; lootTables: LootTable[]; registry: GeneratorRegistry }>
  >;
  generateEncounters(token: string, request: GenerationRequest): Promise<Result<GenerationRun>>;
  acceptGeneration(command: {
    commandId: string;
    campaignId: string;
    token: string;
    runId: string;
    index: number;
    expectedRegistryRevision: number;
  }): Promise<Result<EncounterPlan>>;
  generationRuns(
    token: string,
  ): Promise<Result<{ id: string; seed: string; title: string; count: number }[]>>;
  generationRun(token: string, id: string): Promise<Result<GenerationRun>>;
  rollLoot(command: LootRollCommand): Promise<Result<LootRoll>>;
}
export function exactWeight(value: string): string {
  if (typeof value !== 'string' || !/^\d{1,18}([.,]\d{1,12})?$/.test(value.trim()))
    throw new Error('Gewicht benötigt eine nichtnegative exakte Dezimalzahl.');
  const [whole, part = ''] = value.trim().replace(',', '.').split('.');
  const digits = part.replace(/0+$/, '');
  return BigInt(whole!).toString() + (digits ? '.' + digits : '');
}
/** New encounter weights follow the authoring range; an unchanged stored entry keeps its exact legacy value. */
export function encounterWeight(value: string, previous?: string): string {
  let checked: string;
  try {
    checked = exactWeight(value);
  } catch {
    throw new Error('Neue oder geänderte Begegnungsgewichte benötigen ganze Zahlen von 1 bis 10.');
  }
  if (previous !== undefined && checked === exactWeight(previous)) return previous;
  if (!/^(?:[1-9]|10)$/.test(checked))
    throw new Error('Neue oder geänderte Begegnungsgewichte benötigen ganze Zahlen von 1 bis 10.');
  return checked;
}
export function integerWeights(values: readonly string[]): bigint[] {
  const checked = values.map(exactWeight),
    scale = Math.max(0, ...checked.map((v) => v.split('.')[1]?.length ?? 0));
  return checked.map((v) => {
    const [whole, part = ''] = v.split('.');
    return BigInt(whole!) * 10n ** BigInt(scale) + BigInt(part.padEnd(scale, '0') || '0');
  });
}
export function weightShares(values: readonly string[]): string[] {
  const weights = integerWeights(values),
    sum = weights.reduce((a, b) => a + b, 0n);
  if (!sum) return weights.map(() => '0,00 %');
  const floors = weights.map((w) => Number((w * 10000n) / sum));
  let remaining = 10000 - floors.reduce((a, b) => a + b, 0);
  const order = weights
    .map((w, i) => ({ i, remainder: (w * 10000n) % sum }))
    .sort((a, b) => (a.remainder === b.remainder ? a.i - b.i : a.remainder > b.remainder ? -1 : 1));
  for (const e of order) {
    if (!remaining--) break;
    floors[e.i] = floors[e.i]! + 1;
  }
  return floors.map((v) => Math.floor(v / 100) + ',' + String(v % 100).padStart(2, '0') + ' %');
}
export function currentGenerationLoot(
  refs: GenerationRun['lootTables'],
  tables: LootTable[],
): LootTable | null {
  if (refs?.length !== 1) return null;
  const ref = refs[0]!;
  return (
    tables.find(
      (table) => table.id === ref.id && table.revision === ref.revision && !table.trashed,
    ) ?? null
  );
}

export type PresetAction = Extract<
  GenerationCommand['action'],
  { kind: 'preset-save' | 'preset-assign' | 'preset-delete' }
>;
export interface PresetCommand {
  commandId: string;
  campaignId: string | null;
  action: PresetAction;
}
export interface PresetReceipt {
  commandId: string;
  kind: PresetAction['kind'];
  registry: GeneratorRegistry;
  preset: GeneratorPreset | null;
  deletedId: string | null;
  affectedCampaignIds: string[];
  campaignId: string | null;
}
