// Faction-Presets für CLI-Testing und Plugin-Bundling
// Siehe: docs/entities/faction.md

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
  // Bergstamm-Goblins - Kontrollieren die Berge im Norden
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'bergstamm',
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
        common: [
          { trait: 'cunning', weight: 0.7 },
          { trait: 'cowardly', weight: 0.6 },
          { trait: 'greedy', weight: 0.8 },
        ],
        rare: [{ trait: 'brave', weight: 0.1 }],
      },
      quirks: [
        { quirk: 'nervous_laugh', weight: 0.3, description: 'Kichert nervös' },
        { quirk: 'hoards_shiny', weight: 0.4, description: 'Sammelt Glänzendes' },
        { quirk: 'fear_of_heights', weight: 0.2, description: 'Ironischerweise Höhenangst' },
      ],
      goals: [
        { goal: 'loot', weight: 0.8, description: 'Beute machen' },
        { goal: 'survive', weight: 0.9, description: 'Überleben' },
        { goal: 'please_boss', weight: 0.6, description: 'Den Boss zufriedenstellen' },
      ],
      values: {
        priorities: ['survival', 'loot', 'tribe'],
        taboos: ['direct_confrontation', 'sharing_treasure'],
        greetings: ['Was du wollen?', 'Nicht hauen!'],
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
    reputationWithParty: -20,
    description: 'Ein Goblin-Stamm, der die Bergpässe kontrolliert und Reisende überfällt.',
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Küstenschmuggler - Kontrollieren die Küste im Westen
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'schmuggler',
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
        common: [
          { trait: 'greedy', weight: 0.8 },
          { trait: 'suspicious', weight: 0.7 },
          { trait: 'opportunistic', weight: 0.6 },
        ],
        rare: [
          { trait: 'honorable', weight: 0.15 },
          { trait: 'generous', weight: 0.1 },
        ],
        forbidden: ['naive', 'trusting'],
      },
      quirks: [
        { quirk: 'counts_coins', weight: 0.5, description: 'Zählt ständig Münzen' },
        { quirk: 'sea_superstition', weight: 0.4, description: 'Abergläubisch bzgl. Meer' },
        { quirk: 'old_scar', weight: 0.3, description: 'Reibt sich alte Narbe' },
      ],
      goals: [
        { goal: 'profit', weight: 0.9, description: 'Profit machen' },
        { goal: 'avoid_guards', weight: 0.7, description: 'Wachen vermeiden' },
        { goal: 'expand_network', weight: 0.5, description: 'Netzwerk erweitern' },
      ],
      values: {
        priorities: ['gold', 'freedom', 'crew'],
        taboos: ['betraying_crew', 'working_for_free', 'talking_to_guards'],
        greetings: ['Was willst du?', 'Hast du Ware?', 'Wer schickt dich?'],
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
    reputationWithParty: -10,
    description: 'Schmuggler, die die Küstenhöhlen als Versteck nutzen und illegale Waren handeln.',
  },
]);

export default factionPresets;
