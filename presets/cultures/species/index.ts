// Species-Presets für Culture-Resolution
// Siehe: docs/services/npcs/Culture-Resolution.md
//
// Species-Cultures ERSETZEN Type-Presets wenn creature.species gesetzt ist.
// Sie sind spezifischer als Type-Presets (z.B. "goblin" vs. "goblinoid").
//
// Struktur: LayerTraitConfig mit add[] und optional unwanted[]
// - add[]: Fügt Attribute mit vollem Layer-Gewicht hinzu
// - unwanted[]: Viertelt bisherigen akkumulierten Wert

import { z } from 'zod';
import { cultureDataSchema } from '../../../src/types/entities/faction';

// ============================================================================
// PRESET-SCHEMA
// ============================================================================

export const speciesCulturePresetSchema = cultureDataSchema;
export type SpeciesCulturePreset = z.infer<typeof speciesCulturePresetSchema>;

// ============================================================================
// SPECIES-PRESETS
// ============================================================================

/**
 * Species-spezifische Kulturen.
 * Key = creature.species (aus CreatureDefinition)
 */
export const speciesPresets: Record<string, SpeciesCulturePreset> = {
  // ──────────────────────────────────────────────────────────────────────────
  // Goblin - Kleine, listige, feige Kreaturen
  // ──────────────────────────────────────────────────────────────────────────
  goblin: {
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
    appearance: {
      add: ['sharp_teeth', 'missing_teeth', 'missing_ear', 'crooked_nose', 'yellow_eyes'],
    },
    goals: {
      add: ['loot', 'survive', 'please_boss', 'avoid_work', 'get_food'],
    },
    activities: ['ambush', 'scavenge', 'camp', 'patrol', 'feeding'],
    speech: {
      dialect: 'broken',
      commonPhrases: [
        'Nicht töten!',
        'Boss sagt...',
        'Wir mehr als du!',
        'Hab gesehen, hab gesehen!',
        'Viel Schatz dort!',
        'Nicht ich, war andere Goblin!',
      ],
      accent: 'hoch, schnell, nervös',
    },
    lootPool: ['crude-spear', 'club', 'dagger', 'goblin-totem', 'silver-piece'],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Hobgoblin - Militärisch, diszipliniert, brutal effizient
  // ──────────────────────────────────────────────────────────────────────────
  hobgoblin: {
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
    appearance: {
      add: ['scarred_face', 'war_paint', 'heavily_armored', 'muscular'],
    },
    goals: {
      add: ['conquer', 'rise_in_rank', 'prove_worth', 'follow_orders', 'crush_weakness'],
    },
    activities: ['patrol', 'guard', 'ambush', 'command', 'camp'],
    speech: {
      dialect: 'military',
      commonPhrases: [
        'Befehl ist Befehl.',
        'Schwäche wird bestraft.',
        'Die Legion vergisst nicht.',
        'Du wirst dienen oder sterben.',
        'Ehre durch Stärke.',
      ],
      accent: 'tief, knapp, befehlsgewohnt',
    },
    lootPool: ['longsword', 'shortsword', 'chain-shirt', 'gold-piece'],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Human - Vielseitig, anpassungsfähig, motivationsgetrieben
  // ──────────────────────────────────────────────────────────────────────────
  human: {
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
    appearance: {
      add: ['scarred_face', 'weathered_skin', 'tattoos', 'long_hair', 'bald', 'black_hair', 'red_hair'],
    },
    goals: {
      add: ['survive', 'profit', 'protect_family', 'gain_respect', 'find_meaning'],
    },
    activities: ['traveling', 'camp', 'patrol', 'guard', 'resting', 'ambush'],
    speech: {
      dialect: 'normal',
      commonPhrases: [
        'Das ist mir zu riskant.',
        'Was springt für mich dabei raus?',
        'Man muss vorsichtig sein.',
        'Harte Zeiten.',
        'So ist das Leben.',
      ],
      accent: 'neutral',
    },
    lootPool: ['shortsword', 'dagger', 'leather-armor', 'gold-piece', 'silver-piece', 'rations'],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Skeleton - Willenlos, gebunden, automatenhaft
  // ──────────────────────────────────────────────────────────────────────────
  skeleton: {
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
    appearance: {
      add: ['skeletal', 'rotting', 'glowing_eyes', 'missing_limb'],
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
    lootPool: ['dagger', 'club', 'silver-piece'],
  },
};

export default speciesPresets;
