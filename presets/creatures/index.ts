// Creature-Presets fuer CLI-Testing und Plugin-Bundling
// Siehe: docs/types/creature.md

import { z } from 'zod';
import { creatureDefinitionSchema } from '../../src/types/entities/creature';

// ============================================================================
// PRESET-SCHEMA
// ============================================================================

/**
 * Schema fuer Creature-Presets.
 * Erweitert creatureDefinitionSchema um Preset-spezifische Defaults.
 */
export const creaturePresetSchema = creatureDefinitionSchema;

/**
 * Schema fuer die gesamte Preset-Collection.
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
    baseDisposition: -80,
    terrainAffinities: ['forest', 'hill', 'mountain'],
    activeTime: ['dawn', 'morning', 'midday', 'afternoon', 'dusk', 'night'],
    designRole: 'skirmisher',
    groupSize: { min: 4, avg: 6, max: 12 },
    activities: ['ambush', 'patrol', 'scavenge'],
    preferences: {
      weather: { avoids: ['rain', 'heavy_rain'] },
    },
    wealthTier: 'poor',
    carriesLoot: true,
    // appearance wird von Species 'goblin' geerbt
    detectionProfile: {
      noiseLevel: 'normal',
      scentStrength: 'moderate',
    },
    abilities: { str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 },
    skills: { stealth: 6 },
    speed: { walk: 30 },
    senses: { passivePerception: 9, darkvision: 60 },
    languages: ['Common', 'Goblin'],
    actionIds: ['goblin-scimitar', 'goblin-shortbow'],
    source: 'MM',
  },
  {
    id: 'wolf',
    name: 'Wolf',
    cr: 0.25,
    hitDice: '2d8+2',
    ac: 12,
    size: 'medium',
    tags: ['beast'],
    species: 'wolf',
    baseDisposition: -40,
    terrainAffinities: ['forest', 'hill', 'grassland'],
    activeTime: ['dawn', 'dusk', 'night'],
    designRole: 'skirmisher',
    groupSize: { min: 3, avg: 5, max: 8 },
    activities: ['hunt', 'patrol'],
    preferences: {
      weather: { prefers: ['snow', 'blizzard'] },
    },
    wealthTier: 'poor',
    carriesLoot: false,
    // appearance wird von Species 'wolf' geerbt
    detectionProfile: {
      noiseLevel: 'quiet',
      scentStrength: 'strong',
    },
    abilities: { str: 14, dex: 15, con: 12, int: 3, wis: 12, cha: 6 },
    skills: { perception: 5, stealth: 4 },
    speed: { walk: 40 },
    senses: { passivePerception: 15, darkvision: 60 },
    languages: [],
    actionIds: ['wolf-bite', 'trait-pack-tactics'],
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
    baseDisposition: -60,
    terrainAffinities: ['forest', 'hill', 'grassland'],
    activeTime: ['morning', 'midday', 'afternoon', 'dusk'],
    designRole: 'soldier',
    groupSize: { min: 2, avg: 4, max: 8 },
    activities: ['ambush', 'camp', 'travel'],
    preferences: {
      weather: { avoids: ['heavy_rain'] },
    },
    wealthTier: 'poor',
    carriesLoot: true,
    // appearance wird von Species 'human' geerbt
    detectionProfile: {
      noiseLevel: 'normal',
      scentStrength: 'faint',
    },
    abilities: { str: 11, dex: 12, con: 12, int: 10, wis: 10, cha: 10 },
    speed: { walk: 30 },
    senses: { passivePerception: 10 },
    languages: ['Common'],
    actionIds: ['bandit-scimitar', 'bandit-light-crossbow'],
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
    baseDisposition: -80,
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
    // appearance wird von Species 'owlbear' geerbt
    detectionProfile: {
      noiseLevel: 'loud',
      scentStrength: 'strong',
    },
    abilities: { str: 20, dex: 12, con: 17, int: 3, wis: 12, cha: 7 },
    skills: { perception: 3 },
    speed: { walk: 40 },
    senses: { passivePerception: 13, darkvision: 60 },
    languages: [],
    actionIds: ['owlbear-multiattack', 'owlbear-beak', 'owlbear-claws'],
    source: 'MM',
  },
  {
    id: 'skeleton',
    name: 'Skeleton',
    cr: 0.25,
    hitDice: '2d8+4',
    ac: 14,
    size: 'medium',
    tags: ['undead'],
    species: 'skeleton',
    baseDisposition: -100,
    terrainAffinities: ['mountain', 'forest'],
    activeTime: ['night'],
    designRole: 'minion',
    groupSize: { min: 3, avg: 6, max: 12 },
    activities: ['guard', 'patrol'],
    wealthTier: 'destitute',
    carriesLoot: true,
    // appearance wird von Species 'skeleton' geerbt
    detectionProfile: {
      noiseLevel: 'quiet',
      scentStrength: 'none',
    },
    abilities: { str: 10, dex: 16, con: 15, int: 6, wis: 8, cha: 5 },
    speed: { walk: 30 },
    senses: { passivePerception: 9, darkvision: 60 },
    vulnerabilities: ['bludgeoning'],
    damageImmunities: ['poison'],
    conditionImmunities: ['exhaustion', 'poisoned'],
    languages: [],
    actionIds: ['skeleton-shortsword', 'skeleton-shortbow'],
    source: 'MM',
  },
  {
    id: 'hobgoblin',
    name: 'Hobgoblin',
    cr: 0.5,
    hitDice: '2d8+2',
    ac: 18,
    size: 'medium',
    tags: ['fey', 'goblinoid'],  // SRD 5.2: Fey statt Humanoid
    species: 'hobgoblin',
    baseDisposition: -70,
    terrainAffinities: ['forest', 'hill', 'mountain', 'grassland'],
    activeTime: ['dawn', 'morning', 'midday', 'afternoon', 'dusk', 'night'],
    designRole: 'soldier',
    groupSize: { min: 2, avg: 4, max: 6 },
    activities: ['patrol', 'guard', 'ambush'],
    preferences: {
      weather: { avoids: ['heavy_rain'] },
    },
    wealthTier: 'poor',
    carriesLoot: true,
    // appearance wird von Species 'hobgoblin' geerbt
    detectionProfile: {
      noiseLevel: 'normal',
      scentStrength: 'moderate',
    },
    abilities: { str: 13, dex: 12, con: 12, int: 10, wis: 10, cha: 9 },
    speed: { walk: 30 },
    senses: { passivePerception: 10, darkvision: 60 },
    languages: ['Common', 'Goblin'],
    actionIds: ['hobgoblin-longsword', 'hobgoblin-longbow', 'trait-pack-tactics'],
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
    baseDisposition: -70,
    terrainAffinities: ['forest', 'hill', 'mountain'],
    activeTime: ['dawn', 'morning', 'midday', 'afternoon', 'dusk', 'night'],
    designRole: 'leader',
    groupSize: 1,
    activities: ['command', 'ambush', 'patrol'],
    preferences: {
      weather: { avoids: ['rain', 'heavy_rain'] },
    },
    wealthTier: 'average',
    carriesLoot: true,
    // appearance wird von Species 'goblin' geerbt (goblin-boss ist auch ein Goblin)
    detectionProfile: {
      noiseLevel: 'normal',
      scentStrength: 'moderate',
    },
    abilities: { str: 10, dex: 14, con: 10, int: 10, wis: 8, cha: 10 },
    skills: { stealth: 6 },
    speed: { walk: 30 },
    senses: { passivePerception: 9, darkvision: 60 },
    languages: ['Common', 'Goblin'],
    actionIds: ['goblin-boss-scimitar', 'goblin-boss-javelin'],
    source: 'MM',
  },
  {
    id: 'bandit-captain',
    name: 'Bandit Captain',
    cr: 2,
    hitDice: '8d8+16',
    ac: 15,
    size: 'medium',
    tags: ['humanoid', 'human'],
    species: 'human',
    baseDisposition: -50,
    terrainAffinities: ['forest', 'hill', 'grassland', 'coast'],
    activeTime: ['morning', 'midday', 'afternoon', 'dusk'],
    designRole: 'leader',
    groupSize: 1,
    activities: ['command', 'ambush', 'camp'],
    preferences: {
      weather: { avoids: ['heavy_rain'] },
    },
    wealthTier: 'wealthy',
    carriesLoot: true,
    // appearance wird von Species 'human' geerbt
    detectionProfile: {
      noiseLevel: 'normal',
      scentStrength: 'faint',
    },
    abilities: { str: 15, dex: 16, con: 14, int: 14, wis: 11, cha: 14 },
    speed: { walk: 30 },
    senses: { passivePerception: 10 },
    languages: ['Common', 'Thieves Cant'],
    actionIds: ['bandit-captain-multiattack', 'bandit-captain-scimitar', 'bandit-captain-pistol'],
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
    baseDisposition: -50,
    terrainAffinities: ['forest', 'grassland', 'coast'],
    activeTime: ['morning', 'midday', 'afternoon', 'dusk', 'night'],
    designRole: 'brute',
    groupSize: { min: 2, avg: 3, max: 4 },
    activities: ['guard', 'intimidate', 'ambush'],
    wealthTier: 'poor',
    carriesLoot: true,
    // appearance wird von Species 'human' geerbt
    detectionProfile: {
      noiseLevel: 'normal',
      scentStrength: 'faint',
    },
    abilities: { str: 15, dex: 11, con: 14, int: 10, wis: 10, cha: 11 },
    speed: { walk: 30 },
    senses: { passivePerception: 10 },
    languages: ['Common'],
    actionIds: ['thug-multiattack', 'thug-mace', 'thug-heavy-crossbow'],
    source: 'MM',
  },

  // ==========================================================================
  // BUGBEAR WARRIOR (CR 1) - Grappler mit 10ft Reach
  // ==========================================================================
  {
    id: 'bugbear-warrior',
    name: 'Bugbear Warrior',
    cr: 1,
    hitDice: '6d8+6',
    ac: 14,
    size: 'medium',
    tags: ['fey', 'goblinoid'],
    species: 'bugbear',
    baseDisposition: -70,
    terrainAffinities: ['forest', 'hill', 'mountain'],
    activeTime: ['dawn', 'dusk', 'night'],
    designRole: 'controller',  // Grapple-focused
    groupSize: { min: 2, avg: 3, max: 5 },
    activities: ['ambush', 'patrol', 'hunt'],
    wealthTier: 'poor',
    carriesLoot: true,
    detectionProfile: {
      noiseLevel: 'quiet',
      scentStrength: 'moderate',
    },
    abilities: { str: 15, dex: 14, con: 13, int: 8, wis: 11, cha: 9 },
    skills: { stealth: 6, survival: 2 },
    speed: { walk: 30 },
    senses: { passivePerception: 10, darkvision: 60 },
    languages: ['Common', 'Goblin'],
    actionIds: ['bugbear-grab', 'bugbear-light-hammer', 'trait-long-limbed', 'trait-abduct'],
    source: 'MM',
  },

  // ==========================================================================
  // HOBGOBLIN CAPTAIN (CR 3) - Aura of Authority Leader
  // ==========================================================================
  {
    id: 'hobgoblin-captain',
    name: 'Hobgoblin Captain',
    cr: 3,
    hitDice: '9d8+18',
    ac: 17,
    size: 'medium',
    tags: ['fey', 'goblinoid'],
    species: 'hobgoblin',
    baseDisposition: -70,
    terrainAffinities: ['forest', 'hill', 'mountain', 'grassland'],
    activeTime: ['dawn', 'morning', 'midday', 'afternoon', 'dusk', 'night'],
    designRole: 'leader',
    groupSize: 1,
    activities: ['command', 'patrol', 'guard'],
    wealthTier: 'average',
    carriesLoot: true,
    detectionProfile: {
      noiseLevel: 'normal',
      scentStrength: 'moderate',
    },
    abilities: { str: 15, dex: 14, con: 14, int: 12, wis: 10, cha: 13 },
    speed: { walk: 30 },
    senses: { passivePerception: 10, darkvision: 60 },
    languages: ['Common', 'Goblin'],
    actionIds: ['hobcaptain-multiattack', 'hobcaptain-greatsword', 'hobcaptain-longbow'],
    // HACK: Aura of Authority (10ft Advantage) wird via modifierRefs implementiert
    source: 'MM',
  },

  // ==========================================================================
  // BERSERKER (CR 2) - Bloodied Frenzy
  // ==========================================================================
  {
    id: 'berserker',
    name: 'Berserker',
    cr: 2,
    hitDice: '9d8+27',
    ac: 13,
    size: 'medium',
    tags: ['humanoid', 'human'],
    species: 'human',
    baseDisposition: -60,
    terrainAffinities: ['forest', 'hill', 'mountain', 'grassland'],
    activeTime: ['dawn', 'morning', 'midday', 'afternoon', 'dusk'],
    designRole: 'brute',
    groupSize: { min: 1, avg: 2, max: 4 },
    activities: ['raid', 'hunt', 'guard'],
    wealthTier: 'poor',
    carriesLoot: true,
    detectionProfile: {
      noiseLevel: 'loud',
      scentStrength: 'moderate',
    },
    abilities: { str: 16, dex: 12, con: 17, int: 9, wis: 11, cha: 9 },
    speed: { walk: 30 },
    senses: { passivePerception: 10 },
    languages: ['Common'],
    actionIds: ['berserker-greataxe'],
    // Bloodied Frenzy: Advantage when < 50% HP (via action modifierRefs)
    source: 'MM',
  },

  // ==========================================================================
  // KNIGHT (CR 3) - Tank mit Radiant Damage
  // ==========================================================================
  {
    id: 'knight',
    name: 'Knight',
    cr: 3,
    hitDice: '8d8+16',
    ac: 18,
    size: 'medium',
    tags: ['humanoid', 'human'],
    species: 'human',
    baseDisposition: 0,  // Neutral
    terrainAffinities: ['grassland', 'hill', 'forest'],
    activeTime: ['dawn', 'morning', 'midday', 'afternoon', 'dusk'],
    designRole: 'soldier',
    groupSize: { min: 1, avg: 2, max: 4 },
    activities: ['patrol', 'guard', 'escort'],
    wealthTier: 'wealthy',
    carriesLoot: true,
    detectionProfile: {
      noiseLevel: 'loud',  // Plate armor
      scentStrength: 'faint',
    },
    abilities: { str: 16, dex: 11, con: 14, int: 11, wis: 11, cha: 15 },
    speed: { walk: 30 },
    senses: { passivePerception: 10 },
    languages: ['Common'],
    actionIds: ['knight-multiattack', 'knight-greatsword', 'knight-heavy-crossbow'],
    conditionImmunities: ['frightened'],
    source: 'MM',
  },

  // ==========================================================================
  // GNOLL WARRIOR (CR 1/2) - Rampage Bonus Action
  // ==========================================================================
  {
    id: 'gnoll-warrior',
    name: 'Gnoll Warrior',
    cr: 0.5,
    hitDice: '6d8',
    ac: 15,
    size: 'medium',
    tags: ['fiend'],
    species: 'gnoll',
    baseDisposition: -90,
    terrainAffinities: ['grassland', 'hill', 'forest'],
    activeTime: ['dawn', 'dusk', 'night'],
    designRole: 'skirmisher',
    groupSize: { min: 3, avg: 5, max: 8 },
    activities: ['hunt', 'raid', 'scavenge'],
    wealthTier: 'destitute',
    carriesLoot: false,
    detectionProfile: {
      noiseLevel: 'normal',
      scentStrength: 'strong',
    },
    abilities: { str: 14, dex: 12, con: 11, int: 6, wis: 10, cha: 7 },
    speed: { walk: 30 },
    senses: { passivePerception: 10, darkvision: 60 },
    languages: ['Gnoll'],
    actionIds: ['gnoll-rend', 'gnoll-bone-bow', 'gnoll-rampage'],
    source: 'MM',
  },

  // ==========================================================================
  // OGRE (CR 2) - Glass Cannon (High Damage, Low AC)
  // ==========================================================================
  {
    id: 'ogre',
    name: 'Ogre',
    cr: 2,
    hitDice: '8d10+24',
    ac: 11,
    size: 'large',
    tags: ['giant'],
    species: 'ogre',
    baseDisposition: -70,
    terrainAffinities: ['forest', 'hill', 'mountain', 'swamp'],
    activeTime: ['dawn', 'morning', 'midday', 'afternoon', 'dusk'],
    designRole: 'brute',
    groupSize: { min: 1, avg: 2, max: 3 },
    activities: ['hunt', 'lair', 'scavenge'],
    wealthTier: 'poor',
    carriesLoot: true,
    detectionProfile: {
      noiseLevel: 'loud',
      scentStrength: 'strong',
    },
    abilities: { str: 19, dex: 8, con: 16, int: 5, wis: 7, cha: 7 },
    speed: { walk: 40 },
    senses: { passivePerception: 8, darkvision: 60 },
    languages: ['Common', 'Giant'],
    actionIds: ['ogre-greatclub', 'ogre-javelin'],
    source: 'MM',
  },

  // ==========================================================================
  // SCOUT (CR 1/2) - Mobile Ranged Attacker
  // ==========================================================================
  {
    id: 'scout',
    name: 'Scout',
    cr: 0.5,
    hitDice: '3d8+3',
    ac: 13,
    size: 'medium',
    tags: ['humanoid', 'human'],
    species: 'human',
    baseDisposition: 0,  // Neutral
    terrainAffinities: ['forest', 'grassland', 'hill', 'mountain'],
    activeTime: ['dawn', 'morning', 'midday', 'afternoon', 'dusk'],
    designRole: 'skirmisher',
    groupSize: { min: 1, avg: 2, max: 4 },
    activities: ['patrol', 'scout', 'hunt'],
    wealthTier: 'poor',
    carriesLoot: true,
    detectionProfile: {
      noiseLevel: 'quiet',
      scentStrength: 'faint',
    },
    abilities: { str: 11, dex: 14, con: 12, int: 11, wis: 13, cha: 11 },
    skills: { nature: 4, perception: 5, stealth: 6, survival: 5 },
    speed: { walk: 30 },
    senses: { passivePerception: 15 },
    languages: ['Common'],
    actionIds: ['scout-multiattack', 'scout-shortsword', 'scout-longbow'],
    source: 'MM',
  },

  // ==========================================================================
  // PRIEST (CR 2) - Healer und Support
  // ==========================================================================
  {
    id: 'priest',
    name: 'Priest',
    cr: 2,
    hitDice: '7d8+7',
    ac: 13,
    size: 'medium',
    tags: ['humanoid', 'human'],
    species: 'human',
    baseDisposition: 20,  // Friendly
    terrainAffinities: ['grassland', 'hill', 'forest'],
    activeTime: ['dawn', 'morning', 'midday', 'afternoon', 'dusk'],
    designRole: 'support',
    groupSize: 1,
    activities: ['guard', 'patrol', 'ritual'],
    wealthTier: 'average',
    carriesLoot: true,
    detectionProfile: {
      noiseLevel: 'normal',
      scentStrength: 'faint',
    },
    abilities: { str: 16, dex: 10, con: 12, int: 13, wis: 16, cha: 13 },
    skills: { medicine: 7, perception: 5, religion: 5 },
    speed: { walk: 30 },
    senses: { passivePerception: 15 },
    languages: ['Common'],
    actionIds: ['priest-multiattack', 'priest-mace', 'priest-radiant-flame', 'priest-healing-word'],
    source: 'MM',
  },
]);

// Default-Export fuer einfachen Import
export default creaturePresets;
