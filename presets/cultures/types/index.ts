// Type-Presets für Culture-Resolution
// Siehe: docs/services/npcs/Culture-Resolution.md
//
// Fallback-Kulturen für Creature-Types ohne Species-Culture.
// Diese Presets werden verwendet, wenn keine Faction-Culture existiert.
//
// Struktur: LayerTraitConfig mit add[] und optional unwanted[]
// - add[]: Fügt Attribute mit vollem Layer-Gewicht hinzu
// - unwanted[]: Viertelt bisherigen akkumulierten Wert

import { z } from 'zod';
import { cultureDataSchema } from '../../../src/types/entities/faction';

// ============================================================================
// PRESET-SCHEMA
// ============================================================================

export const typeCulturePresetSchema = cultureDataSchema;
export type TypeCulturePreset = z.infer<typeof typeCulturePresetSchema>;

// ============================================================================
// TYPE-PRESETS
// ============================================================================

/**
 * Basis-Kulturen für D&D Creature-Types.
 * Key = Creature-Tag (aus creature.tags[0])
 */
export const typePresets: Record<string, TypeCulturePreset> = {
  // ──────────────────────────────────────────────────────────────────────────
  // Humanoid - Zivilisierte, sprachfähige Wesen
  // ──────────────────────────────────────────────────────────────────────────
  humanoid: {
    naming: {
      patterns: ['{root}', '{prefix} {root}', '{root} {title}'],
      prefixes: ['Old', 'Young', 'Tall', 'Short', 'Scarred', 'One-Eyed'],
      roots: ['John', 'Mary', 'Tom', 'Anna', 'Erik', 'Sara', 'Rolf', 'Greta'],
      titles: ['the Wanderer', 'the Bold', 'the Quiet', 'the Swift'],
    },
    personality: {
      add: ['cautious', 'curious', 'practical', 'suspicious', 'greedy', 'heroic', 'generous'],
      unwanted: ['mindless', 'predatory'],
    },
    values: {
      add: ['survival', 'family', 'wealth', 'honor', 'freedom'],
    },
    quirks: {
      add: ['nervous_tic', 'always_hungry', 'superstitious', 'talks_to_self', 'whistles_tune'],
    },
    appearance: {
      add: ['scarred_face', 'weathered_skin', 'tattoos', 'long_hair', 'bald'],
    },
    goals: {
      add: ['survive', 'profit', 'protect_family', 'gain_respect', 'find_meaning'],
    },
    activities: ['traveling', 'camp', 'patrol', 'guard', 'resting', 'feeding'],
    speech: {
      dialect: 'normal',
      commonPhrases: ['Das ist mir zu riskant.', 'Was springt für mich dabei raus?'],
      accent: 'neutral',
    },
    lootPool: ['shortsword', 'dagger', 'leather-armor', 'gold-piece', 'silver-piece', 'rations'],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Beast - Tiere, instinktgesteuert
  // ──────────────────────────────────────────────────────────────────────────
  beast: {
    naming: {
      patterns: ['{root}', 'The {root}'],
      roots: ['Growler', 'Fang', 'Shadow', 'Swift', 'Claw', 'Howler', 'Stalker'],
    },
    personality: {
      add: ['territorial', 'hungry', 'cautious', 'aggressive', 'curious', 'predatory'],
      unwanted: ['greedy', 'ambitious', 'manipulative'],
    },
    values: {
      add: ['survival', 'territory', 'freedom'],
      unwanted: ['wealth', 'honor', 'knowledge'],
    },
    quirks: {
      add: ['territorial_marking', 'always_hungry', 'limps', 'scarred_hide'],
    },
    appearance: {
      add: ['matted_fur', 'patchy_fur', 'missing_eye', 'scarred_body', 'long_claws'],
    },
    goals: {
      add: ['hunt', 'protect_territory', 'feed_young', 'find_shelter', 'survive'],
    },
    activities: ['feeding', 'resting', 'wandering', 'lair', 'sleeping'],
    lootPool: [],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Undead - Untote, oft fremdgesteuert oder rachsüchtig
  // ──────────────────────────────────────────────────────────────────────────
  undead: {
    naming: {
      patterns: ['{root}', 'The {root}', '{root} {title}'],
      roots: ['Hollow', 'Bones', 'Whisper', 'Dust', 'Shadow', 'Grave', 'Remnant'],
      titles: ['the Forgotten', 'the Restless', 'the Bound', 'the Watcher'],
    },
    personality: {
      add: ['mindless', 'relentless', 'hateful', 'bound', 'sorrowful', 'vengeful'],
      unwanted: ['curious', 'playful', 'generous', 'naive'],
    },
    values: {
      add: ['revenge', 'domination', 'destruction'],
      unwanted: ['friendship', 'family', 'peace'],
    },
    quirks: {
      add: ['limps', 'missing_eye', 'paranoid_glances'],
    },
    appearance: {
      add: ['rotting', 'skeletal', 'glowing_eyes', 'milky_eyes', 'missing_limb'],
    },
    goals: {
      add: ['serve_master', 'destroy_living', 'guard_location', 'find_rest', 'consume_living'],
    },
    activities: ['patrol', 'guard', 'resting', 'wandering'],
    speech: {
      dialect: 'hollow',
      commonPhrases: ['...', '*Stöhnen*', '*Knochenknirschen*'],
      accent: 'hohl, rasselnd',
    },
    lootPool: ['dagger', 'club', 'gold-piece', 'silver-piece'],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Monstrosity - Monster, oft intelligent aber fremd
  // ──────────────────────────────────────────────────────────────────────────
  monstrosity: {
    naming: {
      patterns: ['{root}', 'The {root}', '{root} {title}'],
      roots: ['Terror', 'Lurker', 'Hunter', 'Fury', 'Dread', 'Nightmare', 'Render'],
      titles: ['of the Deep', 'the Hungry', 'the Patient', 'the Ancient'],
    },
    personality: {
      add: ['aggressive', 'cunning', 'territorial', 'predatory', 'curious', 'playful'],
      unwanted: ['cowardly', 'naive', 'trusting'],
    },
    values: {
      add: ['territory', 'power', 'survival'],
      unwanted: ['friendship', 'honesty', 'mercy'],
    },
    quirks: {
      add: ['territorial_marking', 'always_hungry', 'limps', 'scarred_hide'],
    },
    appearance: {
      add: ['long_claws', 'sharp_teeth', 'glowing_eyes', 'unusual_skin_color', 'scaly_patches'],
    },
    goals: {
      add: ['hunt', 'protect_lair', 'expand_territory', 'hoard_treasure'],
    },
    activities: ['hunt', 'lair', 'feeding', 'ambush', 'wandering'],
    lootPool: [],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Goblinoid - Goblins, Hobgoblins, Bugbears
  // ──────────────────────────────────────────────────────────────────────────
  goblinoid: {
    naming: {
      patterns: ['{prefix}{root}', '{root}{suffix}', '{root}'],
      prefixes: ['Grik', 'Snag', 'Muk', 'Zit', 'Borg', 'Skrag'],
      roots: ['nak', 'gob', 'rik', 'snik', 'mug', 'zak'],
      suffixes: ['le', 'ik', 'az', 'uz', 'ak', 'ug'],
    },
    personality: {
      add: ['cunning', 'cowardly', 'greedy', 'cruel', 'brave', 'loyal', 'nervous', 'clever'],
      unwanted: ['heroic', 'honorable', 'generous', 'naive'],
    },
    values: {
      add: ['survival', 'wealth', 'power'],
      unwanted: ['honesty', 'mercy', 'justice'],
    },
    quirks: {
      add: ['nervous_laugh', 'hoards_shiny', 'bites_nails', 'talks_fast', 'fidgets'],
    },
    appearance: {
      add: ['sharp_teeth', 'missing_teeth', 'missing_ear', 'crooked_nose', 'war_paint'],
    },
    goals: {
      add: ['loot', 'survive', 'please_boss', 'avoid_work', 'get_food'],
    },
    activities: ['ambush', 'scavenge', 'camp', 'patrol', 'feeding'],
    speech: {
      dialect: 'broken',
      commonPhrases: ['Nicht töten!', 'Boss sagt...', 'Wir mehr als du!', 'Hab gesehen, hab gesehen!'],
      accent: 'hoch, schnell, nervös',
    },
    lootPool: ['club', 'dagger', 'crude-spear', 'goblin-totem', 'silver-piece'],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Dragon - Drachen, intelligent und arrogant
  // ──────────────────────────────────────────────────────────────────────────
  dragon: {
    naming: {
      patterns: ['{root}', '{root}{suffix}', '{prefix}{root}'],
      prefixes: ['Vor', 'Kal', 'Mor', 'Sar', 'Dra'],
      roots: ['kath', 'gon', 'rax', 'shen', 'thor', 'myr'],
      suffixes: ['ix', 'ax', 'or', 'us', 'ion'],
      titles: ['the Ancient', 'the Terrible', 'the Wise', 'Bane of Kingdoms'],
    },
    personality: {
      add: ['arrogant', 'greedy', 'cunning', 'patient', 'merciful', 'curious', 'proud'],
      unwanted: ['cowardly', 'naive', 'obedient'],
    },
    values: {
      add: ['wealth', 'power', 'legacy', 'knowledge'],
      unwanted: ['friendship', 'mercy'],
    },
    quirks: {
      add: ['hoards_shiny', 'tells_stories'],
    },
    appearance: {
      add: ['glowing_eyes', 'long_claws', 'scaly_patches', 'unusual_skin_color'],
    },
    goals: {
      add: ['hoard_treasure', 'dominate', 'acquire_knowledge', 'protect_lair', 'expand_territory'],
    },
    activities: ['lair', 'guard', 'hunt', 'intimidate', 'resting'],
    speech: {
      dialect: 'archaic',
      commonPhrases: [
        'Ihr wagt es, vor mich zu treten?',
        'Interessant...',
        'Das gehört nun mir.',
      ],
      accent: 'donnernd, langsam, bedrohlich',
    },
    lootPool: ['gold-piece', 'healing-potion', 'plate-armor', 'longsword'],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Fiend - Dämonen und Teufel
  // ──────────────────────────────────────────────────────────────────────────
  fiend: {
    naming: {
      patterns: ['{root}', '{prefix}{root}', '{root} {title}'],
      prefixes: ['Bal', 'Meph', 'Gor', 'Bel', 'Zar'],
      roots: ['garath', 'istoth', 'nazak', 'morth', 'xul'],
      titles: ['the Tempter', 'the Flayer', 'the Corruptor', 'the Bound'],
    },
    personality: {
      add: ['manipulative', 'cruel', 'patient', 'deceitful', 'honorable', 'cunning'],
      unwanted: ['naive', 'trusting', 'cowardly', 'generous'],
    },
    values: {
      add: ['power', 'domination', 'cruelty'],
      unwanted: ['mercy', 'friendship', 'honesty'],
    },
    quirks: {
      add: ['compulsive_liar', 'excessive_politeness'],
    },
    appearance: {
      add: ['curved_horns', 'glowing_eyes', 'red_eyes', 'forked_tongue', 'unusual_smell'],
    },
    goals: {
      add: ['corrupt_souls', 'fulfill_contract', 'power', 'spread_chaos', 'dominate'],
    },
    activities: ['ambush', 'intimidate', 'guard', 'patrol', 'lair'],
    speech: {
      dialect: 'formal',
      commonPhrases: [
        'Wir könnten einen Deal machen...',
        'Alles hat seinen Preis.',
        'Wie... interessant.',
      ],
      accent: 'glatt, verführerisch',
    },
    lootPool: ['gold-piece', 'healing-potion'],
  },
};

export default typePresets;
