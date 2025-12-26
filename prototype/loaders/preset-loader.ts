/**
 * Preset Loader for Encounter CLI Prototype
 *
 * Loads JSON preset files from presets/ directory and provides typed access.
 * Uses simplified types compatible with the prototype pipeline.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type {
  Creature,
  Terrain,
  Faction,
  FactionCulture,
  FactionTemplateEntry,
  FactionTemplateComposition,
  PartySnapshot,
  CharacterSnapshot,
  EncounterTemplate,
  TemplateSlot,
  CreatureSize,
  CreatureDisposition,
  TimeSegment,
  Item,
  DefaultLootEntry,
  DesignRole,
} from '../types/encounter.js';

// =============================================================================
// Constants
// =============================================================================

const PRESETS_ROOT = resolve(process.cwd(), 'presets');

// =============================================================================
// Raw JSON Types (as stored in files)
// =============================================================================

/** Raw creature from JSON (has more fields than simplified Creature) */
interface RawCreature {
  id: string;
  name: string;
  cr: number;
  maxHp: number;
  ac: number;
  size: string;
  tags: string[];
  disposition: string;
  terrainAffinities: string[];
  activeTime: string[];
  lootTags: string[];
  groupSize?: { min: number; avg: number; max: number };
  defaultFactionId?: string;
  defaultLoot?: DefaultLootEntry[];
  rarity?: string;
  preferredWeather?: string[];
  designRoles?: string[];
  // Additional fields ignored for prototype
  [key: string]: unknown;
}

/** Raw item from JSON */
interface RawItem {
  id: string;
  name: string;
  weight?: number;
  category: string;
  tags: string[];
  value: number;
  stackable?: boolean;
  rarity?: string;
  description?: string;
  // Additional fields ignored for prototype
  [key: string]: unknown;
}

/** Raw terrain from JSON wrapper */
interface RawTerrainFile {
  terrains: RawTerrain[];
}

interface RawTerrain {
  id: string;
  name: string;
  movementCost: number;
  encounterModifier: number;
  threatLevel: number;
  threatRange: number;
  // Additional fields ignored for prototype
  [key: string]: unknown;
}

/** Raw faction template composition from JSON */
interface RawFactionTemplateComposition {
  creatureId: string;
  count: number | { min: number; max: number };
  role: string;
}

/** Raw faction template from JSON */
interface RawFactionTemplate {
  id: string;
  name: string;
  composition: RawFactionTemplateComposition[];
  triggers?: {
    minXPBudget?: number;
    maxXPBudget?: number;
  };
  weight: number;
}

/** Raw faction culture from JSON */
interface RawFactionCulture {
  naming?: {
    patterns: string[];
    prefixes?: string[];
    roots?: string[];
    suffixes?: string[];
  };
  personality?: {
    common: Array<{ trait: string; weight: number }>;
    rare?: Array<{ trait: string; weight: number }>;
  };
  quirks?: Array<{ quirk: string; weight: number; description?: string }>;
  activities?: Array<{ activityId: string; weight: number }>;
}

/** Raw faction from JSON */
interface RawFaction {
  id: string;
  name: string;
  defaultDisposition: number;
  encounterTemplates?: RawFactionTemplate[];
  culture?: RawFactionCulture;
  territoryTerrains?: string[];
  // Additional fields ignored for prototype
  [key: string]: unknown;
}

/** Raw template from bundled-templates.json */
interface RawTemplateFile {
  templates: RawTemplate[];
}

interface RawTemplate {
  id: string;
  name: string;
  description?: string;
  compatibleTags?: string[];
  roles: Record<string, RawTemplateRole>;
}

interface RawTemplateRole {
  count: number | { min: number; max: number };
  budgetPercent: number;
  crConstraint?: 'highest' | 'lowest' | 'any';
  designRole?: string;
}

/** Raw party from JSON */
interface RawParty {
  id: string;
  name: string;
  members: string[];
  // Additional fields ignored
  [key: string]: unknown;
}

/** Raw characters file */
interface RawCharactersFile {
  characters: RawCharacter[];
}

interface RawCharacter {
  id: string;
  name: string;
  level: number;
  class: string;
  maxHp: number;
  currentHp: number;
  ac: number;
  wisdom?: number;
  // Additional fields ignored
  [key: string]: unknown;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Mapping for time segment aliases.
 * Presets may use 'day' which maps to multiple segments.
 */
const TIME_SEGMENT_MAPPING: Record<string, TimeSegment[]> = {
  day: ['morning', 'midday', 'afternoon'],
  daytime: ['morning', 'midday', 'afternoon'],
};

const VALID_TIME_SEGMENTS: TimeSegment[] = [
  'dawn',
  'morning',
  'midday',
  'afternoon',
  'dusk',
  'night',
];

/**
 * Normalizes raw activeTime strings to valid TimeSegments.
 * Expands aliases like 'day' to their component segments.
 */
function normalizeActiveTime(raw: string[]): TimeSegment[] {
  const result: TimeSegment[] = [];

  for (const t of raw) {
    // Check for alias mapping
    if (TIME_SEGMENT_MAPPING[t]) {
      result.push(...TIME_SEGMENT_MAPPING[t]);
    } else if (VALID_TIME_SEGMENTS.includes(t as TimeSegment)) {
      // Valid segment, add directly
      result.push(t as TimeSegment);
    }
    // Invalid segments are silently ignored
  }

  // Remove duplicates (e.g., if both 'day' and 'morning' were specified)
  return [...new Set(result)];
}

/**
 * Loads and parses a JSON file.
 */
function loadJson<T>(relativePath: string): T {
  const fullPath = resolve(PRESETS_ROOT, relativePath);
  const content = readFileSync(fullPath, 'utf-8');
  return JSON.parse(content) as T;
}

/**
 * Creates a lookup map from items with id field.
 */
export function createLookup<T extends { id: string }>(items: T[]): Map<string, T> {
  return new Map(items.map((item) => [item.id, item]));
}

// =============================================================================
// Creature Loader
// =============================================================================

/**
 * Loads all creatures from presets/creatures/base-creatures.json.
 */
export function loadCreatures(): Creature[] {
  const raw = loadJson<RawCreature[]>('creatures/base-creatures.json');

  return raw.map((c) => ({
    id: c.id,
    name: c.name,
    cr: c.cr,
    maxHp: c.maxHp,
    ac: c.ac,
    size: c.size as CreatureSize,
    disposition: c.disposition as CreatureDisposition,
    terrainAffinities: c.terrainAffinities,
    activeTime: normalizeActiveTime(c.activeTime),
    tags: c.tags,
    lootTags: c.lootTags,
    groupSize: c.groupSize,
    defaultFactionId: c.defaultFactionId,
    defaultLoot: c.defaultLoot,
    rarity: (c.rarity as Creature['rarity']) ?? 'common',
    preferredWeather: c.preferredWeather,
    designRoles: c.designRoles as DesignRole[] | undefined,
  }));
}

// =============================================================================
// Terrain Loader
// =============================================================================

/**
 * Loads all terrains from presets/terrains/base-terrains.json.
 */
export function loadTerrains(): Terrain[] {
  const raw = loadJson<RawTerrainFile>('terrains/base-terrains.json');

  return raw.terrains.map((t) => ({
    id: t.id,
    name: t.name,
    movementCost: t.movementCost,
    encounterModifier: t.encounterModifier,
    threatLevel: t.threatLevel,
    threatRange: t.threatRange,
  }));
}

// =============================================================================
// Item Loader
// =============================================================================

/**
 * Loads all items from presets/items/base-items.json.
 */
export function loadItems(): Item[] {
  const raw = loadJson<RawItem[]>('items/base-items.json');

  return raw.map((i) => ({
    id: i.id,
    name: i.name,
    category: i.category,
    tags: i.tags,
    value: i.value,
    rarity: i.rarity ?? 'common',
    weight: i.weight,
    stackable: i.stackable,
  }));
}

// =============================================================================
// Template Loader
// =============================================================================

/**
 * Converts raw template roles to TemplateSlot array.
 */
function convertRolesToSlots(roles: Record<string, RawTemplateRole>): TemplateSlot[] {
  return Object.entries(roles).map(([roleName, role]) => ({
    role: roleName as TemplateSlot['role'],
    tags: [], // Generic templates don't have tag constraints
    count: role.count,
    optional: false,
    designRole: role.designRole as DesignRole | undefined,
  }));
}

/**
 * Loads all templates from presets/encounter-templates/bundled-templates.json.
 */
export function loadTemplates(): EncounterTemplate[] {
  const raw = loadJson<RawTemplateFile>('encounter-templates/bundled-templates.json');

  return raw.templates.map((t) => ({
    id: t.id,
    name: t.name,
    slots: convertRolesToSlots(t.roles),
  }));
}

// =============================================================================
// Faction Loader
// =============================================================================

/**
 * Converts disposition number to disposition type.
 * Negative = hostile, 0-20 = neutral, positive > 20 = friendly
 */
function dispositionFromNumber(value: number): CreatureDisposition {
  if (value < 0) return 'hostile';
  if (value > 20) return 'friendly';
  return 'neutral';
}

/**
 * Converts raw faction template composition to typed version.
 */
function convertFactionComposition(
  raw: RawFactionTemplateComposition
): FactionTemplateComposition {
  return {
    creatureId: raw.creatureId,
    count: raw.count,
    role: raw.role as FactionTemplateComposition['role'],
  };
}

/**
 * Converts raw faction template to typed version.
 */
function convertFactionTemplate(raw: RawFactionTemplate): FactionTemplateEntry {
  return {
    id: raw.id,
    name: raw.name,
    composition: raw.composition.map(convertFactionComposition),
    triggers: raw.triggers,
    weight: raw.weight,
  };
}

/**
 * Converts raw faction culture to typed version.
 */
function convertFactionCulture(raw?: RawFactionCulture): FactionCulture | undefined {
  if (!raw) return undefined;

  return {
    naming: raw.naming,
    personality: raw.personality,
    quirks: raw.quirks,
    activities: raw.activities,
  };
}

/**
 * Loads all factions from presets/factions/base-factions.json.
 */
export function loadFactions(): Faction[] {
  const raw = loadJson<RawFaction[]>('factions/base-factions.json');

  return raw.map((f) => ({
    id: f.id,
    name: f.name,
    disposition: dispositionFromNumber(f.defaultDisposition),
    territoryTerrains: f.territoryTerrains ?? [],
    encounterTemplates: f.encounterTemplates?.map(convertFactionTemplate),
    culture: convertFactionCulture(f.culture),
  }));
}

// =============================================================================
// Party Loader
// =============================================================================

/**
 * Converts raw character to CharacterSnapshot.
 */
function toCharacterSnapshot(c: RawCharacter): CharacterSnapshot {
  // Calculate passive perception: 10 + WIS modifier
  // WIS modifier = floor((wisdom - 10) / 2)
  const wisdomMod = Math.floor(((c.wisdom ?? 10) - 10) / 2);
  const passivePerception = 10 + wisdomMod;

  return {
    id: c.id,
    name: c.name,
    level: c.level,
    class: c.class,
    maxHp: c.maxHp,
    currentHp: c.currentHp,
    ac: c.ac,
    passivePerception,
  };
}

/**
 * Loads party and characters, combines into PartySnapshot.
 */
export function loadParty(): PartySnapshot {
  const party = loadJson<RawParty>('parties/demo-party.json');
  const charactersFile = loadJson<RawCharactersFile>('characters/demo-characters.json');

  // Create lookup for characters
  const characterMap = createLookup(charactersFile.characters);

  // Get characters in party order
  const characters = party.members
    .map((id) => characterMap.get(id))
    .filter((c): c is RawCharacter => c !== undefined)
    .map(toCharacterSnapshot);

  // Calculate aggregates
  const totalHp = characters.reduce((sum, c) => sum + c.maxHp, 0);
  const averageLevel =
    characters.length > 0
      ? characters.reduce((sum, c) => sum + c.level, 0) / characters.length
      : 0;

  return {
    characters,
    averageLevel,
    totalHp,
    size: characters.length,
  };
}

// =============================================================================
// Preset Collection
// =============================================================================

/**
 * Collection of all loaded presets.
 */
export interface PresetCollection {
  creatures: Creature[];
  terrains: Terrain[];
  templates: EncounterTemplate[];
  factions: Faction[];
  items: Item[];
  party: PartySnapshot;
}

/**
 * Loads all presets at once.
 */
export function loadAllPresets(): PresetCollection {
  return {
    creatures: loadCreatures(),
    terrains: loadTerrains(),
    templates: loadTemplates(),
    factions: loadFactions(),
    items: loadItems(),
    party: loadParty(),
  };
}

// =============================================================================
// Preset Lookups (for pipeline use)
// =============================================================================

/**
 * Preset lookups with Map-based access for efficient lookups.
 */
export interface PresetLookups {
  creatures: Map<string, Creature>;
  terrains: Map<string, Terrain>;
  templates: Map<string, EncounterTemplate>;
  factions: Map<string, Faction>;
  items: Map<string, Item>;
  party: PartySnapshot;
}

/**
 * Creates lookup maps from preset collection.
 */
export function createPresetLookups(presets: PresetCollection): PresetLookups {
  return {
    creatures: createLookup(presets.creatures),
    terrains: createLookup(presets.terrains),
    templates: createLookup(presets.templates),
    factions: createLookup(presets.factions),
    items: createLookup(presets.items),
    party: presets.party,
  };
}
