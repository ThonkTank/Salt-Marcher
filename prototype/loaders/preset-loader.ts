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
  PartySnapshot,
  CharacterSnapshot,
  EncounterTemplate,
  TemplateSlot,
  CreatureSize,
  CreatureDisposition,
  TimeSegment,
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

/** Raw faction from JSON */
interface RawFaction {
  id: string;
  name: string;
  defaultDisposition: number;
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
    activeTime: c.activeTime as TimeSegment[],
    tags: c.tags,
    lootTags: c.lootTags,
    groupSize: c.groupSize,
    defaultFactionId: c.defaultFactionId,
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
// Template Loader
// =============================================================================

/**
 * Converts raw template roles to TemplateSlot array.
 */
function convertRolesToSlots(roles: Record<string, RawTemplateRole>): TemplateSlot[] {
  return Object.entries(roles).map(([roleName, role]) => ({
    role: (role.designRole ?? roleName) as TemplateSlot['role'],
    tags: [], // Generic templates don't have tag constraints
    count: role.count,
    optional: false,
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
 * Loads all factions from presets/factions/base-factions.json.
 */
export function loadFactions(): Faction[] {
  const raw = loadJson<RawFaction[]>('factions/base-factions.json');

  return raw.map((f) => ({
    id: f.id,
    name: f.name,
    disposition: dispositionFromNumber(f.defaultDisposition),
    territoryTerrains: [], // Not in current JSON, can be extended later
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
    party: presets.party,
  };
}
