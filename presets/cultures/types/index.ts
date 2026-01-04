// Type-Kulturen als eigenstaendige Culture-Entities
// Siehe: docs/types/culture.md
//
// Type-Cultures sind Fallback-Kulturen fuer Creature-Types ohne Species-Culture.
// Sie sind generischer als Species-Cultures und haben hoehere Toleranz.
//
// Physische Merkmale (appearance) sind NICHT hier - sie gehoeren zu Creature.
// Hier nur kulturelle Attribute: styling, personality, values, quirks, goals, naming, speech

import { z } from 'zod';
import { cultureSchema, type Culture } from '../../../src/types/entities/culture';

// ============================================================================
// TYPE-CULTURE-PRESETS
// ============================================================================

/**
 * Basis-Kulturen fuer D&D Creature-Types.
 * ID-Format: type:{creatureType}
 */
export const typeCulturePresets: Culture[] = z.array(cultureSchema).parse([
  // ──────────────────────────────────────────────────────────────────────────
  // Humanoid - Zivilisierte, sprachfaehige Wesen
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'type:humanoid',
    name: 'Humanoid-Basiskultur',
    usualSpecies: [],
    tolerance: 0.7,

    styling: {
      add: ['practical_clothes', 'simple_jewelry', 'regional_fashion'],
    },

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

    goals: {
      add: ['survive', 'profit', 'protect_family', 'gain_respect', 'find_meaning'],
    },

    activities: ['traveling', 'camp', 'patrol', 'guard', 'resting', 'feeding'],

    speech: {
      dialect: 'normal',
      commonPhrases: ['Das ist mir zu riskant.', 'Was springt fuer mich dabei raus?'],
      accent: 'neutral',
    },
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Beast - Tiere, instinktgesteuert
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'type:beast',
    name: 'Tier-Basiskultur',
    usualSpecies: [],
    tolerance: 0.5,

    styling: {
      add: [],
    },

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

    goals: {
      add: ['hunt', 'protect_territory', 'feed_young', 'find_shelter', 'survive'],
    },

    activities: ['feeding', 'resting', 'wandering', 'lair', 'sleeping'],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Undead - Untote, oft fremdgesteuert oder rachsuechtig
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'type:undead',
    name: 'Untoten-Basiskultur',
    usualSpecies: [],
    tolerance: 0.1,

    styling: {
      add: ['grave_clothes', 'ancient_rags', 'rusted_armor'],
    },

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

    goals: {
      add: ['serve_master', 'destroy_living', 'guard_location', 'find_rest', 'consume_living'],
    },

    activities: ['patrol', 'guard', 'resting', 'wandering'],

    speech: {
      dialect: 'hollow',
      commonPhrases: ['...', '*Stoehnen*', '*Knochenknirschen*'],
      accent: 'hohl, rasselnd',
    },
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Monstrosity - Monster, oft intelligent aber fremd
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'type:monstrosity',
    name: 'Monster-Basiskultur',
    usualSpecies: [],
    tolerance: 0.3,

    styling: {
      add: [],
    },

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

    goals: {
      add: ['hunt', 'protect_lair', 'expand_territory', 'hoard_treasure'],
    },

    activities: ['hunt', 'lair', 'feeding', 'ambush', 'wandering'],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Goblinoid - Goblins, Hobgoblins, Bugbears
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'type:goblinoid',
    name: 'Goblinoid-Basiskultur',
    usualSpecies: ['goblin', 'hobgoblin', 'bugbear'],
    tolerance: 0.3,

    styling: {
      add: ['tattered_clothes', 'tribal_paint', 'bone_jewelry'],
    },

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

    goals: {
      add: ['loot', 'survive', 'please_boss', 'avoid_work', 'get_food'],
    },

    activities: ['ambush', 'scavenge', 'camp', 'patrol', 'feeding'],

    speech: {
      dialect: 'broken',
      commonPhrases: ['Nicht toeten!', 'Boss sagt...', 'Wir mehr als du!', 'Hab gesehen, hab gesehen!'],
      accent: 'hoch, schnell, nervoes',
    },
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Dragon - Drachen, intelligent und arrogant
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'type:dragon',
    name: 'Drachen-Basiskultur',
    usualSpecies: [],
    tolerance: 0.2,

    styling: {
      add: [],
    },

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

    goals: {
      add: ['hoard_treasure', 'dominate', 'acquire_knowledge', 'protect_lair', 'expand_territory'],
    },

    activities: ['lair', 'guard', 'hunt', 'intimidate', 'resting'],

    speech: {
      dialect: 'archaic',
      commonPhrases: [
        'Ihr wagt es, vor mich zu treten?',
        'Interessant...',
        'Das gehoert nun mir.',
      ],
      accent: 'donnernd, langsam, bedrohlich',
    },
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Fiend - Daemonen und Teufel
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'type:fiend',
    name: 'Fiend-Basiskultur',
    usualSpecies: [],
    tolerance: 0.1,

    styling: {
      add: ['dark_robes', 'hellish_symbols', 'chains'],
    },

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

    goals: {
      add: ['corrupt_souls', 'fulfill_contract', 'power', 'spread_chaos', 'dominate'],
    },

    activities: ['ambush', 'intimidate', 'guard', 'patrol', 'lair'],

    speech: {
      dialect: 'formal',
      commonPhrases: [
        'Wir koennten einen Deal machen...',
        'Alles hat seinen Preis.',
        'Wie... interessant.',
      ],
      accent: 'glatt, verfuehrerisch',
    },
  },
]);

// Legacy-Export fuer Rueckwaertskompatibilitaet
// DEPRECATED: Verwende typeCulturePresets stattdessen
export const typePresets: Record<string, Culture> = Object.fromEntries(
  typeCulturePresets.map(c => [c.id.replace('type:', ''), c])
);

export default typeCulturePresets;
