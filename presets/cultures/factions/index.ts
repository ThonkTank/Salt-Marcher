// Faction-spezifische Kulturen als eigenstaendige Culture-Entities
// Siehe: docs/types/culture.md
//
// Faction-Cultures definieren einzigartige kulturelle Marker fuer Fraktionen.
// Sie erben von Species/Type-Cultures via parentId und ueberschreiben spezifische Attribute.
//
// ID-Format: faction:{factionId}

import { z } from 'zod';
import { cultureSchema, type Culture } from '../../../src/types/entities/culture';

// ============================================================================
// FACTION-CULTURE-PRESETS
// ============================================================================

/**
 * Fraktions-spezifische Kulturen.
 * Erben von Species-Cultures und definieren Fraktions-Eigenheiten.
 */
export const factionCulturePresets: Culture[] = z.array(cultureSchema).parse([
  // ──────────────────────────────────────────────────────────────────────────
  // Ork-Allianz - Root-Faction Kultur
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'faction:ork-allianz',
    name: 'Ork-Allianz-Kultur',
    usualSpecies: ['orc', 'half-orc', 'goblin', 'hobgoblin'],
    tolerance: 0.2,

    styling: {
      add: ['war_paint', 'bone_trophies', 'tribal_tattoos'],
    },

    naming: {
      patterns: ['{root}'],
      roots: ['Gruk', 'Thrak', 'Morg', 'Grul', 'Krag'],
    },

    personality: {
      add: ['aggressive', 'honorable', 'proud'],
    },

    values: {
      add: ['power', 'strength'],
    },
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Bergstamm-Goblins - Spezifische Goblin-Kultur im Berggebiet
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'faction:bergstamm',
    name: 'Bergstamm-Goblin-Kultur',
    parentId: 'species:goblin',
    usualSpecies: ['goblin', 'hobgoblin'],
    tolerance: 0.1,

    styling: {
      add: ['mountain_furs', 'cave_paint', 'bone_necklaces'],
    },

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
      commonPhrases: ['Nicht toeten!', 'Hab Schatz!', 'Boss sagt...', 'Wir mehr als du!'],
      accent: 'hoch, schnell, nervoes',
    },
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Handelsgilde - Dachorganisation fuer Haendler
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'faction:handelsgilde',
    name: 'Freie Handelsgilde-Kultur',
    parentId: 'species:human',
    usualSpecies: ['human', 'dwarf', 'halfling'],
    tolerance: 0.8,

    styling: {
      add: ['fine_clothes', 'guild_symbols', 'merchant_rings'],
    },

    naming: {
      patterns: ['{prefix} {root}', '{root} von {suffix}'],
      prefixes: ['Meister', 'Kaufmann', 'Haendler'],
      roots: ['Heinrich', 'Wilhelm', 'Friedrich', 'Gustav', 'Ernst'],
      suffixes: ['Nordhafen', 'Salzburg', 'Westmark'],
    },

    personality: {
      add: ['patient', 'ambitious', 'shrewd'],
    },

    values: {
      add: ['wealth', 'reputation'],
    },

    goals: {
      add: ['profit', 'gain_respect'],
    },
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Kuestenschmuggler - Piraten und Schmuggler an der Kueste
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'faction:schmuggler',
    name: 'Kuestenschmuggler-Kultur',
    parentId: 'species:human',
    usualSpecies: ['human'],
    tolerance: 0.5,

    styling: {
      add: ['sailor_clothes', 'tattoos', 'earrings', 'weathered_coat'],
    },

    naming: {
      patterns: ['{prefix} {root}', '{root} "{title}"', '{root}'],
      prefixes: ['Schwarzer', 'Einaeugiger', 'Krummer', 'Fetter'],
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

    speech: {
      dialect: 'rough',
      commonPhrases: [
        'Kein Geschaeft ohne Anzahlung',
        'Die See nimmt, die See gibt',
        'Frag nicht woher',
        'Das kostet extra',
      ],
      accent: 'rau, langsam, drohend',
    },
  },
]);

export default factionCulturePresets;
