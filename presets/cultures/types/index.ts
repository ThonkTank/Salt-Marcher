// Type-Presets für Culture-Resolution
// Siehe: docs/services/NPCs/Culture-Resolution.md
//
// Fallback-Kulturen für Creature-Types ohne Species-Culture.
// Diese Presets werden verwendet, wenn keine Faction-Culture existiert.

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
      common: [
        { trait: 'cautious', weight: 0.5 },
        { trait: 'curious', weight: 0.5 },
        { trait: 'practical', weight: 0.6 },
        { trait: 'suspicious', weight: 0.4 },
        { trait: 'greedy', weight: 0.4 },
      ],
      rare: [
        { trait: 'heroic', weight: 0.1 },
        { trait: 'cruel', weight: 0.15 },
        { trait: 'generous', weight: 0.1 },
      ],
    },
    quirks: [
      { quirk: 'nervous_tic', weight: 0.3, description: 'Nervöses Zucken' },
      { quirk: 'always_hungry', weight: 0.4, description: 'Isst ständig' },
      { quirk: 'superstitious', weight: 0.3, description: 'Abergläubisch' },
    ],
    activities: ['traveling', 'camp', 'patrol', 'guard', 'resting', 'feeding'],
    goals: [
      { goal: 'survive', weight: 0.8, description: 'Überleben' },
      { goal: 'profit', weight: 0.6, description: 'Profit machen' },
      { goal: 'protect_family', weight: 0.5, description: 'Familie schützen' },
      { goal: 'gain_power', weight: 0.3, description: 'Macht erlangen' },
    ],
    values: {
      priorities: ['survival', 'family', 'gold'],
      taboos: ['betrayal'],
      greetings: ['Hallo.', 'Was willst du?', 'Guten Tag.'],
    },
    speech: {
      dialect: 'normal',
      commonPhrases: ['Das ist mir zu riskant.', 'Was springt für mich dabei raus?'],
      accent: 'neutral',
    },
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
      common: [
        { trait: 'territorial', weight: 0.7 },
        { trait: 'hungry', weight: 0.6 },
        { trait: 'cautious', weight: 0.5 },
        { trait: 'aggressive', weight: 0.4 },
      ],
      rare: [{ trait: 'curious', weight: 0.1 }],
    },
    activities: ['feeding', 'resting', 'wandering', 'lair', 'sleeping'],
    goals: [
      { goal: 'hunt', weight: 0.9, description: 'Beute jagen' },
      { goal: 'protect_territory', weight: 0.7, description: 'Territorium verteidigen' },
      { goal: 'feed_young', weight: 0.5, description: 'Junge füttern' },
      { goal: 'find_shelter', weight: 0.4, description: 'Unterschlupf suchen' },
    ],
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
      common: [
        { trait: 'mindless', weight: 0.6 },
        { trait: 'relentless', weight: 0.7 },
        { trait: 'hateful', weight: 0.5 },
        { trait: 'bound', weight: 0.6 },
      ],
      rare: [
        { trait: 'sorrowful', weight: 0.1 },
        { trait: 'vengeful', weight: 0.15 },
      ],
    },
    activities: ['patrol', 'guard', 'resting', 'wandering'],
    goals: [
      { goal: 'obey_master', weight: 0.8, description: 'Meister gehorchen' },
      { goal: 'destroy_living', weight: 0.6, description: 'Lebende vernichten' },
      { goal: 'guard_location', weight: 0.7, description: 'Ort bewachen' },
      { goal: 'find_rest', weight: 0.2, description: 'Ruhe finden' },
    ],
    speech: {
      dialect: 'hollow',
      commonPhrases: ['...', '*Stöhnen*', '*Knochenknirschen*'],
      accent: 'hohl, rasselnd',
    },
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
      common: [
        { trait: 'aggressive', weight: 0.7 },
        { trait: 'cunning', weight: 0.5 },
        { trait: 'territorial', weight: 0.6 },
        { trait: 'predatory', weight: 0.7 },
      ],
      rare: [
        { trait: 'curious', weight: 0.1 },
        { trait: 'playful', weight: 0.05 },
      ],
    },
    activities: ['hunt', 'lair', 'feeding', 'ambush', 'wandering'],
    goals: [
      { goal: 'hunt', weight: 0.8, description: 'Beute jagen' },
      { goal: 'protect_lair', weight: 0.7, description: 'Höhle verteidigen' },
      { goal: 'expand_territory', weight: 0.4, description: 'Territorium erweitern' },
      { goal: 'hoard_treasure', weight: 0.3, description: 'Schätze horten' },
    ],
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
      common: [
        { trait: 'cunning', weight: 0.7 },
        { trait: 'cowardly', weight: 0.6 },
        { trait: 'greedy', weight: 0.8 },
        { trait: 'cruel', weight: 0.5 },
      ],
      rare: [
        { trait: 'brave', weight: 0.1 },
        { trait: 'loyal', weight: 0.15 },
      ],
    },
    quirks: [
      { quirk: 'nervous_laugh', weight: 0.4, description: 'Kichert nervös' },
      { quirk: 'hoards_shiny', weight: 0.5, description: 'Sammelt Glänzendes' },
      { quirk: 'bites_nails', weight: 0.3, description: 'Kaut an Krallen' },
    ],
    activities: ['ambush', 'scavenge', 'camp', 'patrol', 'feeding'],
    goals: [
      { goal: 'loot', weight: 0.9, description: 'Beute machen' },
      { goal: 'survive', weight: 0.8, description: 'Überleben' },
      { goal: 'please_boss', weight: 0.6, description: 'Boss zufriedenstellen' },
      { goal: 'avoid_work', weight: 0.5, description: 'Arbeit vermeiden' },
    ],
    values: {
      priorities: ['survival', 'loot', 'tribe'],
      taboos: ['direct_confrontation', 'sharing_treasure'],
      greetings: ['Was du wollen?', 'Nicht hauen!', 'Hab Schatz!'],
    },
    speech: {
      dialect: 'broken',
      commonPhrases: ['Nicht töten!', 'Boss sagt...', 'Wir mehr als du!', 'Hab gesehen, hab gesehen!'],
      accent: 'hoch, schnell, nervös',
    },
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
      common: [
        { trait: 'arrogant', weight: 0.8 },
        { trait: 'greedy', weight: 0.9 },
        { trait: 'cunning', weight: 0.7 },
        { trait: 'patient', weight: 0.6 },
      ],
      rare: [
        { trait: 'merciful', weight: 0.05 },
        { trait: 'curious', weight: 0.1 },
      ],
    },
    activities: ['lair', 'guard', 'hunt', 'intimidate', 'resting'],
    goals: [
      { goal: 'hoard_treasure', weight: 0.9, description: 'Schätze horten' },
      { goal: 'dominate', weight: 0.7, description: 'Dominieren' },
      { goal: 'acquire_knowledge', weight: 0.5, description: 'Wissen sammeln' },
      { goal: 'protect_lair', weight: 0.8, description: 'Hort verteidigen' },
    ],
    speech: {
      dialect: 'archaic',
      commonPhrases: [
        'Ihr wagt es, vor mich zu treten?',
        'Interessant...',
        'Das gehört nun mir.',
      ],
      accent: 'donnernd, langsam, bedrohlich',
    },
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
      common: [
        { trait: 'manipulative', weight: 0.8 },
        { trait: 'cruel', weight: 0.7 },
        { trait: 'patient', weight: 0.6 },
        { trait: 'deceitful', weight: 0.8 },
      ],
      rare: [{ trait: 'honorable', weight: 0.1 }],
    },
    activities: ['ambush', 'intimidate', 'guard', 'patrol', 'lair'],
    goals: [
      { goal: 'corrupt_souls', weight: 0.8, description: 'Seelen verderben' },
      { goal: 'fulfill_contract', weight: 0.7, description: 'Vertrag erfüllen' },
      { goal: 'gain_power', weight: 0.6, description: 'Macht erlangen' },
      { goal: 'spread_chaos', weight: 0.5, description: 'Chaos verbreiten' },
    ],
    speech: {
      dialect: 'formal',
      commonPhrases: [
        'Wir könnten einen Deal machen...',
        'Alles hat seinen Preis.',
        'Wie... interessant.',
      ],
      accent: 'glatt, verführerisch',
    },
  },
};

export default typePresets;
