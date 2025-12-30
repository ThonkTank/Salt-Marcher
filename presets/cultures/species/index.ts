// Species-Presets für Culture-Resolution
// Siehe: docs/services/NPCs/Culture-Resolution.md
//
// Species-Cultures ERSETZEN Type-Presets wenn creature.species gesetzt ist.
// Sie sind spezifischer als Type-Presets (z.B. "goblin" vs. "goblinoid").

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
      common: [
        { trait: 'cunning', weight: 0.8 },
        { trait: 'cowardly', weight: 0.7 },
        { trait: 'greedy', weight: 0.9 },
        { trait: 'cruel', weight: 0.5 },
        { trait: 'nervous', weight: 0.6 },
      ],
      rare: [
        { trait: 'brave', weight: 0.1 },
        { trait: 'loyal', weight: 0.15 },
        { trait: 'clever', weight: 0.2 },
      ],
    },
    quirks: [
      { quirk: 'nervous_laugh', weight: 0.5, description: 'Kichert nervös bei Gefahr' },
      { quirk: 'hoards_shiny', weight: 0.6, description: 'Sammelt alles was glänzt' },
      { quirk: 'bites_nails', weight: 0.4, description: 'Kaut an den Krallen' },
      { quirk: 'talks_fast', weight: 0.5, description: 'Spricht hektisch und schnell' },
    ],
    activities: ['ambush', 'scavenge', 'camp', 'patrol', 'feeding'],
    goals: [
      { goal: 'loot', weight: 1.0, description: 'Beute machen' },
      { goal: 'survive', weight: 0.9, description: 'Am Leben bleiben' },
      { goal: 'please_boss', weight: 0.7, description: 'Boss zufriedenstellen' },
      { goal: 'avoid_work', weight: 0.6, description: 'Arbeit vermeiden' },
      { goal: 'get_food', weight: 0.5, description: 'Essen beschaffen' },
    ],
    values: {
      priorities: ['survival', 'loot', 'tribe'],
      taboos: ['direct_confrontation', 'sharing_treasure', 'standing_ground'],
      greetings: ['Was du wollen?', 'Nicht hauen!', 'Hab Schatz!', 'Boss nicht hier!'],
    },
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
      common: [
        { trait: 'disciplined', weight: 0.9 },
        { trait: 'ruthless', weight: 0.7 },
        { trait: 'tactical', weight: 0.8 },
        { trait: 'proud', weight: 0.6 },
        { trait: 'ambitious', weight: 0.5 },
      ],
      rare: [
        { trait: 'merciful', weight: 0.1 },
        { trait: 'honorable', weight: 0.2 },
      ],
    },
    quirks: [
      { quirk: 'counts_kills', weight: 0.5, description: 'Führt Buch über Siege' },
      { quirk: 'polishes_armor', weight: 0.4, description: 'Poliert ständig Ausrüstung' },
      { quirk: 'despises_cowards', weight: 0.6, description: 'Verachtet Feiglinge offen' },
    ],
    activities: ['patrol', 'guard', 'ambush', 'command', 'camp'],
    goals: [
      { goal: 'conquer', weight: 0.9, description: 'Erobern und unterwerfen' },
      { goal: 'rise_in_rank', weight: 0.8, description: 'Im Rang aufsteigen' },
      { goal: 'prove_worth', weight: 0.7, description: 'Wert beweisen' },
      { goal: 'follow_orders', weight: 0.6, description: 'Befehle ausführen' },
      { goal: 'crush_weakness', weight: 0.5, description: 'Schwäche vernichten' },
    ],
    values: {
      priorities: ['duty', 'strength', 'legion'],
      taboos: ['cowardice', 'disobedience', 'mercy_to_weak'],
      greetings: ['Halt. Identifiziere dich.', 'Was ist dein Anliegen?', 'Sprich schnell.'],
    },
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
      common: [
        { trait: 'practical', weight: 0.6 },
        { trait: 'cautious', weight: 0.5 },
        { trait: 'curious', weight: 0.5 },
        { trait: 'ambitious', weight: 0.4 },
        { trait: 'suspicious', weight: 0.4 },
      ],
      rare: [
        { trait: 'heroic', weight: 0.1 },
        { trait: 'cruel', weight: 0.15 },
        { trait: 'generous', weight: 0.15 },
        { trait: 'idealistic', weight: 0.1 },
      ],
    },
    quirks: [
      { quirk: 'nervous_tic', weight: 0.3, description: 'Nervöses Zucken' },
      { quirk: 'always_hungry', weight: 0.4, description: 'Isst ständig etwas' },
      { quirk: 'superstitious', weight: 0.3, description: 'Abergläubisch' },
      { quirk: 'tells_stories', weight: 0.3, description: 'Erzählt gern Geschichten' },
    ],
    activities: ['traveling', 'camp', 'patrol', 'guard', 'resting', 'ambush'],
    goals: [
      { goal: 'survive', weight: 0.8, description: 'Überleben' },
      { goal: 'profit', weight: 0.6, description: 'Profit machen' },
      { goal: 'protect_family', weight: 0.6, description: 'Familie schützen' },
      { goal: 'gain_respect', weight: 0.4, description: 'Respekt erlangen' },
      { goal: 'find_meaning', weight: 0.3, description: 'Sinn finden' },
    ],
    values: {
      priorities: ['survival', 'family', 'community'],
      taboos: ['betrayal', 'oath_breaking'],
      greetings: ['Guten Tag.', 'Was führt Euch her?', 'Seid gegrüßt.', 'Hallo.'],
    },
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
      common: [
        { trait: 'mindless', weight: 0.8 },
        { trait: 'relentless', weight: 0.7 },
        { trait: 'obedient', weight: 0.9 },
        { trait: 'tireless', weight: 0.7 },
      ],
      rare: [
        { trait: 'echo_of_life', weight: 0.1 },
        { trait: 'sorrowful', weight: 0.05 },
      ],
    },
    activities: ['patrol', 'guard', 'resting', 'wandering'],
    goals: [
      { goal: 'obey_master', weight: 1.0, description: 'Meister gehorchen' },
      { goal: 'guard_location', weight: 0.8, description: 'Ort bewachen' },
      { goal: 'destroy_intruders', weight: 0.7, description: 'Eindringlinge vernichten' },
      { goal: 'patrol', weight: 0.6, description: 'Patrouillieren' },
    ],
    values: {
      priorities: ['command', 'duty'],
      taboos: [],
      greetings: ['...', '*Knochenknirschen*', '*leeres Starren*'],
    },
    speech: {
      dialect: 'hollow',
      commonPhrases: ['...', '*Klappern*', '*Knochenknirschen*', '*mechanisches Greifen*'],
      accent: 'hohl, rasselnd, leer',
    },
  },
};

export default speciesPresets;
