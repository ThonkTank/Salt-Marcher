/** Structural storage decoders. Domain owners additionally check ranges, row identity and relations.
 * Values are inspected in place: text, extra fields and ordering are never normalized. */
import shapes from './stored-shapes.json';
import type * as Model from './stored-record-types';
export interface StoredShapes {
  planned_visit: Model.planned_visit;
  location: Model.location;
  world_note: Model.world_note;
  session_profile: Model.session_profile;
  session_visit: Model.session_visit;
  live_scene_extra: Model.live_scene_extra;
  world_actor: Model.world_actor;
  session_run: Model.session_run;
  session_receipt: Model.session_receipt;
  generator_preset: Model.generator_preset;
  generation_run: Model.generation_run;
  encounter_table: Model.encounter_table;
  loot_table: Model.loot_table;
  generation_receipt: Model.generation_receipt;
  generation_result: Extract<Model.generation_receipt, { registry: unknown }>;
  loot_roll: import('../campaign/generation-contracts').LootRoll;
  encounter_plan: Model.encounter_plan;
  encounter_snapshot: import('../catalog/encounter-contracts').EncounterPlan;
  prepared_group: Model.prepared_group;
  character_profile: Model.character_profile;
  character_progress: Model.character_progress;
  treasure: Model.treasure;
  character_ledger: Model.character_ledger;
  progress_event: Model.progress_event;
  progress_receipt: Model.progress_receipt;
  combat_award: Model.combat_award;
  combat: Model.combat;
  shop: Model.shop;
  shop_event: Omit<Model.shop_event, 'id'>;
  shop_receipt: Model.shop_receipt;
  world_record_calendar: Model.world_record_calendar;
  world_record_map: Model.world_record_map;
  world_record_phenomenon: Model.world_record_phenomenon;
  world_record_place_presentation: Model.world_record_place_presentation;
  world_record_weather_state: Model.world_record_weather_state;
  world_history: Model.world_history;
  world_receipt: Model.world_receipt;
  scene_position: Model.scene_position;
  world_journey: Model.world_journey;
  audio_asset: Omit<Model.audio_asset, 'available'> & Partial<Pick<Model.audio_asset, 'available'>>;
  audio_registry: Model.audio_registry;
  music_state: Model.music_state;
  scene_music: Model.scene_music;
  music_subject: Model.music_subject;
  music_receipt: Model.music_receipt;
  atlas_landscape: Model.atlas_landscape;
  dungeon_feature_state: Model.dungeon_feature_state;
  campaign_catalog_receipt: Model.campaign_catalog_receipt;
}

type Rule =
  | { literal: string | number | boolean | null }
  | { scalar: 'string' | 'number' | 'boolean' }
  | { array: Rule }
  | { union: Rule[] }
  | { node: number }
  | { unknown: true };
interface Shape {
  fields: Record<string, Rule>;
  required: string[];
  values?: Rule;
}
// The generated graph is compiler-derived from StoredShapes; tools/check-repository verifies it.
const graph = shapes as unknown as { roots: Record<string, Rule>; nodes: Shape[] };
function matches(rule: Rule, value: unknown): boolean {
  if ('unknown' in rule) return true;
  if ('literal' in rule) return value === rule.literal;
  if ('scalar' in rule)
    return typeof value === rule.scalar && (typeof value !== 'number' || Number.isFinite(value));
  if ('union' in rule) return rule.union.some((branch) => matches(branch, value));
  if ('array' in rule) return Array.isArray(value) && value.every((v) => matches(rule.array, v));
  const shape = graph.nodes[rule.node];
  if (!shape || !value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  if (shape.required.some((key) => !Object.hasOwn(record, key))) return false;
  return Object.entries(record).every(([key, v]) => {
    const field = Object.hasOwn(shape.fields, key) ? shape.fields[key] : shape.values;
    // Extra fields are retained; owners with closed contracts check them explicitly.
    return (
      !field ||
      (v === undefined && Object.hasOwn(shape.fields, key) && !shape.required.includes(key)) ||
      matches(field, v)
    );
  });
}
function isShape<K extends keyof StoredShapes>(kind: K, value: unknown): value is StoredShapes[K] {
  return matches(graph.roots[kind]!, value);
}
const domainNames: Partial<Record<keyof StoredShapes, string>> = {
  encounter_table: 'Encounter-Tabelle',
  world_journey: 'Reisegrundlage',
  atlas_landscape: 'Landschaft',
  character_ledger: 'Beuteeintrag',
  character_progress: 'Fortschrittsdaten',
  treasure: 'Beutedaten',
  session_profile: 'Spielabendprofil',
  session_visit: 'Besuchsvorbereitung',
  session_run: 'Spielabendvorschau',
  shop: 'Shopdaten',
  audio_asset: 'Audiodatei',
  music_state: 'Musikplayerstand',
};
function checkedShape<K extends keyof StoredShapes>(kind: K, value: unknown): StoredShapes[K] {
  if (!isShape(kind, value))
    throw new Error(
      (domainNames[kind] ?? 'Gespeicherter Inhalt') +
        ' hat ungültige Felder. Originaldaten bleiben erhalten.',
    );
  return value;
}

// Every exported decoder fixes its domain type; a caller cannot nominate an arbitrary T.
export const planned_visit = (value: unknown) => checkedShape('planned_visit', value);
export const location = (value: unknown) => checkedShape('location', value);
export const world_note = (value: unknown) => checkedShape('world_note', value);
export const session_profile = (value: unknown) => checkedShape('session_profile', value);
export const session_visit = (value: unknown) => checkedShape('session_visit', value);
export const live_scene_extra = (value: unknown) => checkedShape('live_scene_extra', value);
export const world_actor = (value: unknown) => checkedShape('world_actor', value);
export const session_run = (value: unknown) => checkedShape('session_run', value);
export const session_receipt = (value: unknown) => checkedShape('session_receipt', value);
export const generator_preset = (value: unknown) => checkedShape('generator_preset', value);
export const generation_run = (value: unknown) => checkedShape('generation_run', value);
export const encounter_table = (value: unknown) => checkedShape('encounter_table', value);
export const loot_table = (value: unknown) => checkedShape('loot_table', value);
export const generation_receipt = (value: unknown) => checkedShape('generation_receipt', value);
export const character_progress = (value: unknown) => checkedShape('character_progress', value);
export const treasure = (value: unknown) => checkedShape('treasure', value);
export const character_ledger = (value: unknown) => checkedShape('character_ledger', value);
export const progress_event = (value: unknown) => checkedShape('progress_event', value);
export const progress_receipt = (value: unknown) => checkedShape('progress_receipt', value);
export const combat_award = (value: unknown) => checkedShape('combat_award', value);
export const combat = (value: unknown) => checkedShape('combat', value);
export const shop = (value: unknown) => checkedShape('shop', value);
export const shop_event = (value: unknown) => checkedShape('shop_event', value);
export const shop_receipt = (value: unknown) => checkedShape('shop_receipt', value);
export const world_record_calendar = (value: unknown) =>
  checkedShape('world_record_calendar', value);
export const world_record_map = (value: unknown) => checkedShape('world_record_map', value);
export const world_record_phenomenon = (value: unknown) =>
  checkedShape('world_record_phenomenon', value);
export const world_record_place_presentation = (value: unknown) =>
  checkedShape('world_record_place_presentation', value);
export const world_record_weather_state = (value: unknown) =>
  checkedShape('world_record_weather_state', value);
export const world_history = (value: unknown) => checkedShape('world_history', value);
export const world_receipt = (value: unknown) => checkedShape('world_receipt', value);
export const scene_position = (value: unknown) => checkedShape('scene_position', value);
export const world_journey = (value: unknown) => checkedShape('world_journey', value);
export const audio_asset = (value: unknown) => checkedShape('audio_asset', value);
export const audio_registry = (value: unknown) => checkedShape('audio_registry', value);
export const music_state = (value: unknown) => checkedShape('music_state', value);
export const scene_music = (value: unknown) => checkedShape('scene_music', value);
export const music_subject = (value: unknown) => checkedShape('music_subject', value);
export const music_receipt = (value: unknown) => checkedShape('music_receipt', value);
export const atlas_landscape = (value: unknown) => checkedShape('atlas_landscape', value);
export const dungeon_feature_state = (value: unknown) =>
  checkedShape('dungeon_feature_state', value);
export const campaign_catalog_receipt = (value: unknown) =>
  checkedShape('campaign_catalog_receipt', value);

export const generation_result = (value: unknown) => checkedShape('generation_result', value);
export const loot_roll = (value: unknown) => checkedShape('loot_roll', value);
export const encounter_plan = (value: unknown) => checkedShape('encounter_plan', value);
export const encounter_snapshot = (value: unknown) => checkedShape('encounter_snapshot', value);

export const character_profile = (value: unknown) => checkedShape('character_profile', value);

export const prepared_group = (value: unknown) => checkedShape('prepared_group', value);
