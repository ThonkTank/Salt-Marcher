// Species-Kulturen als eigenstaendige Culture-Entities
// Siehe: docs/types/culture.md
//
// Species-Cultures definieren kulturelle Marker fuer Spezies.
// Sie dienen als Basis fuer abgeleitete Kulturen (Factions, Regionen).
//
// Physische Merkmale (appearance) sind NICHT hier - sie gehoeren zu Creature.
// Hier nur kulturelle Attribute: styling, personality, values, quirks, goals, naming, speech

import { z } from 'zod';
import { cultureSchema, type Culture } from '../../../src/types/entities/culture';

// ============================================================================
// SPECIES-CULTURE-PRESETS
// ============================================================================

/**
 * Species-spezifische Kulturen.
 * ID-Format: species:{speciesId}
 */
export const speciesCulturePresets: Culture[] = z.array(cultureSchema).parse([
  // ──────────────────────────────────────────────────────────────────────────
  // Goblin - Kleine, listige, feige Kreaturen
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'species:goblin',
    name: 'Goblin-Kultur',
    usualSpecies: ['goblin'],
    tolerance: 0.2,

    styling: {
      add: ['tattered_clothes', 'tribal_paint', 'bone_jewelry', 'crude_weapons'],
    },

    naming: {
      patterns: ['{prefix}{root}', '{root}{suffix}', '{root}'],
      prefixes: ['Grik', 'Snag', 'Muk', 'Zit', 'Nix', 'Skrit'],
      roots: ['nak', 'gob', 'rik', 'snik', 'mug', 'zak', 'nib', 'grak'],
      suffixes: ['le', 'ik', 'az', 'uz', 'ak', 'ug', 'it'],
    },

    personality: {
      add: ['cunning', 'cowardly', 'greedy', 'cruel', 'nervous', 'brave', 'loyal', 'clever'],
      unwanted: ['heroic', 'honorable', 'generous', 'patient'],
    },

    values: {
      add: ['survival', 'wealth'],
      unwanted: ['honor', 'justice', 'mercy'],
    },

    quirks: {
      add: ['nervous_laugh', 'hoards_shiny', 'bites_nails', 'talks_fast', 'fidgets'],
    },

    goals: {
      add: ['loot', 'survive', 'please_boss', 'avoid_work', 'get_food'],
    },

    activities: ['ambush', 'scavenge', 'camp', 'patrol', 'feeding'],

    speech: {
      dialect: 'broken',
      commonPhrases: [
        'Nicht toeten!',
        'Boss sagt...',
        'Wir mehr als du!',
        'Hab gesehen, hab gesehen!',
        'Viel Schatz dort!',
        'Nicht ich, war andere Goblin!',
      ],
      accent: 'hoch, schnell, nervoes',
    },
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Hobgoblin - Militaerisch, diszipliniert, brutal effizient
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'species:hobgoblin',
    name: 'Hobgoblin-Kultur',
    usualSpecies: ['hobgoblin'],
    tolerance: 0.3,

    styling: {
      add: ['military_uniform', 'polished_armor', 'war_medals', 'regimental_colors'],
    },

    naming: {
      patterns: ['{prefix}{root}', '{root} {title}', '{root}'],
      prefixes: ['Kur', 'Gor', 'Thrak', 'Mor', 'Zul', 'Krag'],
      roots: ['gash', 'mok', 'thar', 'ron', 'gul', 'zorn', 'dak'],
      suffixes: ['ar', 'ok', 'ul', 'az', 'orn'],
      titles: ['der Eiserne', 'Kriegsmeister', 'der Unerbittliche', 'Scharfklinge'],
    },

    personality: {
      add: ['disciplined', 'ruthless', 'tactical', 'proud', 'ambitious', 'honorable', 'brave'],
      unwanted: ['cowardly', 'nervous', 'naive', 'generous'],
    },

    values: {
      add: ['power', 'honor', 'strength'],
      unwanted: ['mercy', 'friendship'],
    },

    quirks: {
      add: ['counts_kills', 'polishes_armor', 'despises_cowards'],
    },

    goals: {
      add: ['conquer', 'rise_in_rank', 'prove_worth', 'follow_orders', 'crush_weakness'],
    },

    activities: ['patrol', 'guard', 'ambush', 'command', 'camp'],

    speech: {
      dialect: 'military',
      commonPhrases: [
        'Befehl ist Befehl.',
        'Schwaeche wird bestraft.',
        'Die Legion vergisst nicht.',
        'Du wirst dienen oder sterben.',
        'Ehre durch Staerke.',
      ],
      accent: 'tief, knapp, befehlsgewohnt',
    },
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Human - Vielseitig, anpassungsfaehig, motivationsgetrieben
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'species:human',
    name: 'Menschen-Kultur',
    usualSpecies: ['human'],
    tolerance: 0.7,

    styling: {
      add: ['practical_clothes', 'regional_fashion', 'work_attire', 'simple_jewelry'],
    },

    naming: {
      patterns: ['{root}', '{prefix} {root}', '{root} {title}'],
      prefixes: ['Old', 'Young', 'Tall', 'Scarred', 'Red', 'Black'],
      roots: [
        'John', 'Mary', 'Tom', 'Anna', 'Erik', 'Sara', 'Rolf', 'Greta',
        'Hans', 'Marta', 'Karl', 'Elsa', 'Peter', 'Ingrid', 'Otto', 'Hilda',
      ],
      titles: ['der Wanderer', 'der Stille', 'der Schnelle', 'der Alte', 'der Fremde'],
    },

    personality: {
      add: ['practical', 'cautious', 'curious', 'ambitious', 'suspicious', 'heroic', 'generous', 'idealistic'],
      unwanted: ['mindless', 'predatory'],
    },

    values: {
      add: ['family', 'survival', 'freedom', 'wealth', 'honor'],
    },

    quirks: {
      add: ['nervous_tic', 'always_hungry', 'superstitious', 'tells_stories', 'whistles_tune'],
    },

    goals: {
      add: ['survive', 'profit', 'protect_family', 'gain_respect', 'find_meaning'],
    },

    activities: ['traveling', 'camp', 'patrol', 'guard', 'resting', 'ambush'],

    speech: {
      dialect: 'normal',
      commonPhrases: [
        'Das ist mir zu riskant.',
        'Was springt fuer mich dabei raus?',
        'Man muss vorsichtig sein.',
        'Harte Zeiten.',
        'So ist das Leben.',
      ],
      accent: 'neutral',
    },
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Skeleton - Willenlos, gebunden, automatenhaft
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'species:skeleton',
    name: 'Skelett-Kultur',
    usualSpecies: ['skeleton'],
    tolerance: 0.0,

    styling: {
      add: ['grave_clothes', 'rusted_armor', 'ancient_rags'],
    },

    naming: {
      patterns: ['{root}', 'The {root}', '{root} {title}'],
      roots: ['Bones', 'Hollow', 'Remnant', 'Clatter', 'Dust', 'Shade', 'Echo'],
      titles: ['the Bound', 'the Restless', 'the Forgotten', 'the Empty'],
    },

    personality: {
      add: ['mindless', 'relentless', 'obedient', 'tireless', 'sorrowful'],
      unwanted: ['curious', 'playful', 'generous', 'ambitious'],
    },

    values: {
      add: ['domination'],
      unwanted: ['friendship', 'family', 'freedom', 'wealth'],
    },

    quirks: {
      add: ['limps', 'paranoid_glances'],
    },

    goals: {
      add: ['serve_master', 'guard_location', 'patrol', 'destroy_living'],
    },

    activities: ['patrol', 'guard', 'resting', 'wandering'],

    speech: {
      dialect: 'hollow',
      commonPhrases: ['...', '*Klappern*', '*Knochenknirschen*', '*mechanisches Greifen*'],
      accent: 'hohl, rasselnd, leer',
    },
  },
]);

// Legacy-Export fuer Rueckwaertskompatibilitaet
// DEPRECATED: Verwende speciesCulturePresets stattdessen
export const speciesPresets: Record<string, Culture> = Object.fromEntries(
  speciesCulturePresets.map(c => [c.id.replace('species:', ''), c])
);

export default speciesCulturePresets;
