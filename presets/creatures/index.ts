// Creature-Presets für CLI-Testing und Plugin-Bundling
// Siehe: docs/entities/creature.md

import { z } from 'zod';
import { creatureDefinitionSchema } from '../../src/types/entities/creature';

// ============================================================================
// PRESET-SCHEMA
// ============================================================================

/**
 * Schema für Creature-Presets.
 * Erweitert creatureDefinitionSchema um Preset-spezifische Defaults.
 */
export const creaturePresetSchema = creatureDefinitionSchema;

/**
 * Schema für die gesamte Preset-Collection.
 */
export const creaturePresetsSchema = z.array(creaturePresetSchema);

// ============================================================================
// PRESET-DATEN
// ============================================================================

export const creaturePresets = creaturePresetsSchema.parse([
  {
    id: 'goblin',
    name: 'Goblin',
    cr: 0.25,
    hitDice: '2d6',
    ac: 15,
    size: 'small',
    tags: ['humanoid', 'goblinoid'],
    species: 'goblin',
    baseDisposition: -80, // hostile - aggressiv, hinterhältig
    terrainAffinities: ['forest', 'hills', 'cave'],
    activeTime: ['dawn', 'morning', 'midday', 'afternoon', 'dusk', 'night'],
    designRole: 'skirmisher',
    groupSize: { min: 4, avg: 6, max: 12 },
    activities: ['ambush', 'patrol', 'scavenge'],
    preferences: {
      weather: { avoids: ['rain', 'heavy_rain'] },
    },
    wealthTier: 'poor',
    carriesLoot: true,
    detectionProfile: {
      noiseLevel: 'normal',
      scentStrength: 'moderate',
    },
    abilities: { str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 },
    speed: { walk: 30 },
    senses: { passivePerception: 9, darkvision: 60 },
    languages: ['Common', 'Goblin'],
    source: 'MM',
  },
  {
    id: 'wolf',
    name: 'Wolf',
    cr: 0.25,
    hitDice: '2d8+2',
    ac: 13,
    size: 'medium',
    tags: ['beast'],
    species: 'wolf',
    baseDisposition: -40, // unfriendly - territorial, aber nicht aggressiv ohne Provokation
    terrainAffinities: ['forest', 'hills', 'plains'],
    activeTime: ['dawn', 'dusk', 'night'],
    designRole: 'skirmisher',
    groupSize: { min: 3, avg: 5, max: 8 },
    activities: ['hunt', 'patrol'],
    preferences: {
      weather: { prefers: ['snow', 'blizzard'] },
    },
    wealthTier: 'poor',
    carriesLoot: false,
    detectionProfile: {
      noiseLevel: 'quiet',
      scentStrength: 'strong',
    },
    abilities: { str: 12, dex: 15, con: 12, int: 3, wis: 12, cha: 6 },
    speed: { walk: 40 },
    senses: { passivePerception: 13 },
    languages: [],
    source: 'MM',
  },
  {
    id: 'bandit',
    name: 'Bandit',
    cr: 0.125,
    hitDice: '2d8+2',
    ac: 12,
    size: 'medium',
    tags: ['humanoid', 'human'],
    species: 'human',
    baseDisposition: -60, // unfriendly/hostile Grenze - räuberisch, aber verhandelbar
    terrainAffinities: ['forest', 'hills', 'road'],
    activeTime: ['morning', 'midday', 'afternoon', 'dusk'],
    designRole: 'soldier',
    groupSize: { min: 2, avg: 4, max: 8 },
    activities: ['ambush', 'camp', 'travel'],
    preferences: {
      weather: { avoids: ['heavy_rain'] },
    },
    wealthTier: 'poor',
    carriesLoot: true,
    detectionProfile: {
      noiseLevel: 'normal',
      scentStrength: 'faint',
    },
    abilities: { str: 11, dex: 12, con: 12, int: 10, wis: 10, cha: 10 },
    speed: { walk: 30 },
    senses: { passivePerception: 10 },
    languages: ['Common'],
    source: 'MM',
  },
  {
    id: 'owlbear',
    name: 'Owlbear',
    cr: 3,
    hitDice: '7d10+21',
    ac: 13,
    size: 'large',
    tags: ['monstrosity'],
    species: 'owlbear',
    baseDisposition: -80, // hostile - extrem territorial, greift an
    terrainAffinities: ['forest'],
    activeTime: ['dawn', 'morning', 'midday', 'afternoon', 'dusk'],
    designRole: 'brute',
    groupSize: 1,
    activities: ['hunt', 'lair'],
    preferences: {
      weather: { prefers: ['rain', 'drizzle'] },
    },
    wealthTier: 'poor',
    carriesLoot: false,
    detectionProfile: {
      noiseLevel: 'loud',
      scentStrength: 'strong',
    },
    abilities: { str: 20, dex: 12, con: 17, int: 3, wis: 12, cha: 7 },
    speed: { walk: 40 },
    senses: { passivePerception: 13, darkvision: 60 },
    languages: [],
    source: 'MM',
  },
  {
    id: 'skeleton',
    name: 'Skeleton',
    cr: 0.25,
    hitDice: '2d8+4',
    ac: 13,
    size: 'medium',
    tags: ['undead'],
    species: 'skeleton',
    baseDisposition: -100, // hostile - mindless, greift immer an
    terrainAffinities: ['cave', 'ruins', 'graveyard'],
    activeTime: ['night'],
    designRole: 'minion',
    groupSize: { min: 3, avg: 6, max: 12 },
    activities: ['guard', 'patrol'],
    wealthTier: 'destitute',
    carriesLoot: true,
    detectionProfile: {
      noiseLevel: 'quiet',
      scentStrength: 'none',
    },
    abilities: { str: 10, dex: 14, con: 15, int: 6, wis: 8, cha: 5 },
    speed: { walk: 30 },
    senses: { passivePerception: 9, darkvision: 60 },
    languages: [],
    source: 'MM',
  },
  {
    id: 'hobgoblin',
    name: 'Hobgoblin',
    cr: 0.5,
    hitDice: '2d8+2',
    ac: 18,
    size: 'medium',
    tags: ['humanoid', 'goblinoid'],
    species: 'hobgoblin',
    baseDisposition: -70, // hostile - diszipliniert, aber militärisch aggressiv
    terrainAffinities: ['forest', 'hills', 'cave', 'plains'],
    activeTime: ['dawn', 'morning', 'midday', 'afternoon', 'dusk', 'night'],
    designRole: 'soldier',
    groupSize: { min: 2, avg: 4, max: 6 },
    activities: ['patrol', 'guard', 'ambush'],
    preferences: {
      weather: { avoids: ['heavy_rain'] },
    },
    wealthTier: 'poor',
    carriesLoot: true,
    detectionProfile: {
      noiseLevel: 'normal',
      scentStrength: 'moderate',
    },
    abilities: { str: 13, dex: 12, con: 12, int: 10, wis: 10, cha: 9 },
    speed: { walk: 30 },
    senses: { passivePerception: 10, darkvision: 60 },
    languages: ['Common', 'Goblin'],
    source: 'MM',
  },
  {
    id: 'goblin-boss',
    name: 'Goblin Boss',
    cr: 1,
    hitDice: '6d6',
    ac: 17,
    size: 'small',
    tags: ['humanoid', 'goblinoid'],
    species: 'goblin',
    baseDisposition: -70, // hostile - aber taktischer, könnte verhandeln
    terrainAffinities: ['forest', 'hills', 'cave'],
    activeTime: ['dawn', 'morning', 'midday', 'afternoon', 'dusk', 'night'],
    designRole: 'leader',
    groupSize: 1,
    activities: ['command', 'ambush', 'patrol'],
    preferences: {
      weather: { avoids: ['rain', 'heavy_rain'] },
    },
    wealthTier: 'average',
    carriesLoot: true,
    detectionProfile: {
      noiseLevel: 'normal',
      scentStrength: 'moderate',
    },
    abilities: { str: 10, dex: 14, con: 10, int: 10, wis: 8, cha: 10 },
    speed: { walk: 30 },
    senses: { passivePerception: 9, darkvision: 60 },
    languages: ['Common', 'Goblin'],
    source: 'MM',
  },
  {
    id: 'bandit-captain',
    name: 'Bandit Captain',
    cr: 2,
    hitDice: '10d8+20',
    ac: 15,
    size: 'medium',
    tags: ['humanoid', 'human'],
    species: 'human',
    baseDisposition: -50, // unfriendly - verhandelt für Profit, weniger impulsiv
    terrainAffinities: ['forest', 'hills', 'road', 'coast'],
    activeTime: ['morning', 'midday', 'afternoon', 'dusk'],
    designRole: 'leader',
    groupSize: 1,
    activities: ['command', 'ambush', 'camp'],
    preferences: {
      weather: { avoids: ['heavy_rain'] },
    },
    wealthTier: 'wealthy',
    carriesLoot: true,
    detectionProfile: {
      noiseLevel: 'normal',
      scentStrength: 'faint',
    },
    abilities: { str: 15, dex: 16, con: 14, int: 14, wis: 11, cha: 14 },
    speed: { walk: 30 },
    senses: { passivePerception: 10 },
    languages: ['Common', 'Thieves Cant'],
    source: 'MM',
  },
  {
    id: 'thug',
    name: 'Thug',
    cr: 0.5,
    hitDice: '5d8+10',
    ac: 11,
    size: 'medium',
    tags: ['humanoid', 'human'],
    species: 'human',
    baseDisposition: -50, // unfriendly - einschüchternd, aber folgt Befehlen
    terrainAffinities: ['forest', 'road', 'coast', 'urban'],
    activeTime: ['morning', 'midday', 'afternoon', 'dusk', 'night'],
    designRole: 'brute',
    groupSize: { min: 2, avg: 3, max: 4 },
    activities: ['guard', 'intimidate', 'ambush'],
    wealthTier: 'poor',
    carriesLoot: true,
    detectionProfile: {
      noiseLevel: 'normal',
      scentStrength: 'faint',
    },
    abilities: { str: 15, dex: 11, con: 14, int: 10, wis: 10, cha: 11 },
    speed: { walk: 30 },
    senses: { passivePerception: 10 },
    languages: ['Common'],
    source: 'MM',
  },
]);

// Default-Export für einfachen Import
export default creaturePresets;
