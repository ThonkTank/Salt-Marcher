// Faction-Presets für CLI-Testing und Plugin-Bundling
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
  // Ork-Allianz - Root-Faction für Bergstamm-Test
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'ork-allianz',
    name: 'Ork-Allianz',
    status: 'active',
    culture: {
      naming: {
        patterns: ['{root}'],
        roots: ['Gruk', 'Thrak', 'Morg'],
      },
      personality: {
        add: ['aggressive', 'honorable'],
      },
      values: {
        add: ['power', 'strength'],
      },
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
    culture: {
      naming: {
        patterns: ['{prefix}{root}', '{root}{suffix}'],
        prefixes: ['Grik', 'Snag', 'Muk', 'Zit', 'Borg'],
        roots: ['nak', 'gob', 'rik', 'snik', 'berg'],
        suffixes: ['le', 'ik', 'az', 'uz', 'ak'],
      },
      personality: {
        add: ['cunning', 'cowardly', 'greedy', 'brave'],
      },
      values: {
        add: ['survival', 'wealth'],
        unwanted: ['honor', 'justice'],
      },
      quirks: {
        add: ['nervous_laugh', 'hoards_shiny'],
      },
      goals: {
        add: ['loot', 'survive', 'please_boss'],
      },
      speech: {
        dialect: 'broken',
        commonPhrases: ['Nicht töten!', 'Hab Schatz!', 'Boss sagt...', 'Wir mehr als du!'],
        accent: 'hoch, schnell, nervös',
      },
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
    description: 'Ein Goblin-Stamm, der die Bergpässe kontrolliert und Reisende überfällt.',
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Handelsgilde - Dachorganisation für Schmuggler
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'handelsgilde',
    name: 'Freie Handelsgilde',
    status: 'active',
    culture: {
      naming: {
        patterns: ['{prefix} {root}', '{root} von {suffix}'],
        prefixes: ['Meister', 'Kaufmann', 'Händler'],
        roots: ['Heinrich', 'Wilhelm', 'Friedrich', 'Gustav', 'Ernst'],
        suffixes: ['Nordhafen', 'Salzburg', 'Westmark'],
      },
      personality: {
        add: ['patient', 'ambitious'],
      },
      values: {
        add: ['wealth', 'reputation'],
      },
      goals: {
        add: ['profit', 'gain_respect'],
      },
    },
    creatures: [],
    controlledLandmarks: [],
    displayColor: '#DAA520',
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Küstenschmuggler - Kontrollieren die Küste im Westen
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'schmuggler',
    parentId: 'handelsgilde',
    name: 'Küstenschmuggler',
    status: 'active',
    culture: {
      naming: {
        patterns: ['{prefix} {root}', '{root} "{title}"', '{root}'],
        prefixes: ['Schwarzer', 'Einäugiger', 'Krummer', 'Fetter'],
        roots: ['Jack', 'Pete', 'Morgan', 'Finn', 'Bart', 'Willem'],
        titles: ['der Schlitzer', 'Messerhand', 'Narbengesicht', 'Goldklaue'],
      },
      personality: {
        add: ['greedy', 'suspicious', 'opportunistic'],
        unwanted: ['naive', 'trusting'],
      },
      values: {
        add: ['wealth', 'freedom'],
        unwanted: ['honor'],
      },
      quirks: {
        add: ['superstitious', 'scarred_face'],
      },
      goals: {
        add: ['profit', 'survive'],
      },
      appearance: {
        add: ['scarred_face', 'tattoos', 'weathered_skin'],
      },
      speech: {
        dialect: 'rough',
        commonPhrases: [
          'Kein Geschäft ohne Anzahlung',
          'Die See nimmt, die See gibt',
          'Frag nicht woher',
          'Das kostet extra',
        ],
        accent: 'rau, langsam, drohend',
      },
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
    description: 'Schmuggler, die die Küstenhöhlen als Versteck nutzen und illegale Waren handeln.',
  },
]);

export default factionPresets;
