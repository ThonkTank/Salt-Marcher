// Faction-Presets fuer CLI-Testing und Plugin-Bundling
// Siehe: docs/types/faction.md

import { z } from 'zod';
import { factionSchema } from '../../src/types/entities/faction';

// ============================================================================
// PRESET-SCHEMA
// ============================================================================

export const factionPresetSchema = factionSchema;
export const factionPresetsSchema = z.array(factionPresetSchema);

// ============================================================================
// PRESET-DATEN
// ============================================================================

export const factionPresets = factionPresetsSchema.parse([
  // ──────────────────────────────────────────────────────────────────────────
  // Ork-Allianz - Root-Faction fuer Bergstamm-Test
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'ork-allianz',
    name: 'Ork-Allianz',
    status: 'active',

    // Culture-System (NEU)
    usualCultures: ['faction:ork-allianz'],
    cultureTolerance: 0.2,
    acceptedSpecies: ['orc', 'half-orc', 'goblin', 'hobgoblin'],
    influence: {
      values: { add: ['power', 'strength'] },
      goals: { add: ['conquer', 'dominate'] },
    },

    creatures: [],
    controlledLandmarks: [],
    displayColor: '#2F4F4F',
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Bergstamm-Goblins - Kontrollieren die Berge im Norden
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'bergstamm',
    parentId: 'ork-allianz',
    name: 'Bergstamm-Goblins',
    status: 'active',

    // Culture-System (NEU)
    usualCultures: ['faction:bergstamm', 'species:goblin'],
    cultureTolerance: 0.1,
    acceptedSpecies: ['goblin', 'hobgoblin'],
    influence: {
      values: { add: ['tribal_loyalty'], unwanted: ['honor', 'justice'] },
      goals: { add: ['please_boss', 'raid'] },
    },

    creatures: [
      { creatureId: 'goblin', count: 15 },
      { creatureId: 'hobgoblin', count: 5 },
      { creatureId: 'goblin-boss', count: 2 },
    ],
    encounterTemplates: [
      {
        id: 'goblin-scouts',
        name: 'Goblin-Spaeher',
        description: 'Kleine Gruppe von Goblins, die das Gebiet erkunden',
        slots: {
          scouts: { designRole: 'skirmisher', count: { min: 2, max: 4 } },
        },
      },
      {
        id: 'goblin-raiding-party',
        name: 'Goblin-Raubzug',
        description: 'Ueberfall-Gruppe mit Anfuehrer',
        slots: {
          leader: { designRole: 'leader', count: 1 },
          raiders: { designRole: 'skirmisher', count: { min: 3, avg: 5, max: 6 } },
        },
      },
      {
        id: 'goblin-warband',
        name: 'Goblin-Kriegsband',
        description: 'Groessere taktische Einheit mit Hobgoblin-Unterstuetzung',
        slots: {
          commander: { designRole: 'leader', count: 1 },
          warriors: { designRole: 'soldier', count: 2 },
          skirmishers: { designRole: 'skirmisher', count: { min: 4, avg: 6, max: 8 } },
        },
      },
    ],
    controlledLandmarks: ['goblin-cave', 'watchtower-ruins'],
    displayColor: '#8B4513',
    reputations: [{ entityType: 'party', entityId: 'party', value: -20 }],
    description: 'Ein Goblin-Stamm, der die Bergpaesse kontrolliert und Reisende ueberfaellt.',
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Handelsgilde - Dachorganisation fuer Schmuggler
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'handelsgilde',
    name: 'Freie Handelsgilde',
    status: 'active',

    // Culture-System (NEU)
    usualCultures: ['faction:handelsgilde', 'species:human'],
    cultureTolerance: 0.8,
    acceptedSpecies: ['human', 'dwarf', 'halfling', 'elf'],
    influence: {
      values: { add: ['profit', 'reputation'] },
      goals: { add: ['expand_trade', 'gain_influence'] },
    },

    creatures: [],
    controlledLandmarks: [],
    displayColor: '#DAA520',
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Kuestenschmuggler - Kontrollieren die Kueste im Westen
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'schmuggler',
    parentId: 'handelsgilde',
    name: 'Kuestenschmuggler',
    status: 'active',

    // Culture-System (NEU)
    usualCultures: ['faction:schmuggler', 'species:human'],
    cultureTolerance: 0.5,
    acceptedSpecies: ['human'],
    influence: {
      values: { add: ['secrecy', 'loyalty_to_crew'], unwanted: ['honor'] },
      goals: { add: ['smuggle_goods', 'avoid_guards'] },
    },

    creatures: [
      { creatureId: 'bandit', count: 10 },
      { creatureId: 'bandit-captain', count: 2 },
      { creatureId: 'thug', count: 4 },
    ],
    encounterTemplates: [
      {
        id: 'smuggler-patrol',
        name: 'Schmuggler-Patrouille',
        description: 'Wachposten, die das Territorium sichern',
        slots: {
          guards: { designRole: 'soldier', count: { min: 2, max: 4 } },
        },
      },
      {
        id: 'smuggler-crew',
        name: 'Schmuggler-Trupp',
        description: 'Organisierte Crew mit Anfuehrer',
        slots: {
          captain: { designRole: 'leader', count: 1 },
          crew: { designRole: 'soldier', count: { min: 2, max: 4 } },
        },
      },
      {
        id: 'smuggler-ambush',
        name: 'Schmuggler-Hinterhalt',
        description: 'Ueberfall-Trupp mit Muskelkraft',
        slots: {
          leader: { designRole: 'leader', count: 1 },
          enforcers: { designRole: 'brute', count: { min: 1, max: 2 } },
          bandits: { designRole: 'soldier', count: { min: 2, max: 3 } },
        },
      },
    ],
    controlledLandmarks: ['smuggler-cove', 'lighthouse-ruins'],
    displayColor: '#4682B4',
    reputations: [{ entityType: 'party', entityId: 'party', value: -10 }],
    description: 'Schmuggler, die die Kuestenhoehlen als Versteck nutzen und illegale Waren handeln.',
  },
]);

export default factionPresets;
