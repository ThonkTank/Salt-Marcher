// src/apps/library/create/creature/entry-presets.ts
// Häufig verwendete Einträge (Traits, Aktionen, etc.) als Presets

import type { CreatureEntryCategory } from "./presets";

export type EntryPreset = {
  category: CreatureEntryCategory;
  name: string;
  kind?: string;
  range?: string;
  target?: string;
  to_hit?: string;
  damage?: string;
  // Auto-calculation helpers
  to_hit_ability?: string; // ability for to_hit calculation
  to_hit_proficient?: boolean;
  damage_dice?: string;
  damage_ability?: string; // ability for damage calculation
  damage_type?: string;
  save_ability?: string;
  save_dc?: number;
  save_effect?: string;
  recharge?: string;
  text?: string;
};

export const ENTRY_PRESETS: readonly EntryPreset[] = [
  // === Traits ===
  {
    category: "trait",
    name: "Amphibious",
    text: "The creature can breathe air and water.",
  },
  {
    category: "trait",
    name: "Magic Resistance",
    text: "The creature has Advantage on saving throws against spells and other magical effects.",
  },
  {
    category: "trait",
    name: "Legendary Resistance (3/Day)",
    text: "If the creature fails a saving throw, it can choose to succeed instead.",
  },
  {
    category: "trait",
    name: "Pack Tactics",
    text: "The creature has Advantage on an attack roll against a creature if at least one of its allies is within 5 feet of the creature and the ally doesn't have the Incapacitated condition.",
  },
  {
    category: "trait",
    name: "Spider Climb",
    text: "The creature can climb difficult surfaces, including along ceilings, without needing to make an ability check.",
  },
  {
    category: "trait",
    name: "Keen Hearing and Smell",
    text: "The creature has Advantage on Wisdom (Perception) checks that rely on hearing or smell.",
  },
  {
    category: "trait",
    name: "Keen Sight",
    text: "The creature has Advantage on Wisdom (Perception) checks that rely on sight.",
  },
  {
    category: "trait",
    name: "Undead Fortitude",
    text: "If damage reduces the creature to 0 Hit Points, it makes a Constitution saving throw (DC 5 plus the damage taken) unless the damage is Radiant or from a Critical Hit. On a successful save, the creature drops to 1 Hit Point instead.",
  },
  {
    category: "trait",
    name: "Immutable Form",
    text: "The creature can't shape-shift.",
  },
  {
    category: "trait",
    name: "Sunlight Sensitivity",
    text: "While in Sunlight, the creature has Disadvantage on attack rolls, as well as on Wisdom (Perception) checks that rely on sight.",
  },

  // === Actions ===
  {
    category: "action",
    name: "Multiattack",
    text: "The creature makes two attacks.",
  },
  {
    category: "action",
    name: "Bite",
    kind: "Melee Attack Roll",
    range: "reach 5 ft.",
    target: "one target",
    to_hit_ability: "str",
    to_hit_proficient: true,
    damage_dice: "1d6",
    damage_ability: "str",
    damage_type: "piercing",
  },
  {
    category: "action",
    name: "Claw",
    kind: "Melee Attack Roll",
    range: "reach 5 ft.",
    target: "one target",
    to_hit_ability: "str",
    to_hit_proficient: true,
    damage_dice: "1d4",
    damage_ability: "str",
    damage_type: "slashing",
  },
  {
    category: "action",
    name: "Slam",
    kind: "Melee Attack Roll",
    range: "reach 5 ft.",
    target: "one target",
    to_hit_ability: "str",
    to_hit_proficient: true,
    damage_dice: "1d6",
    damage_ability: "str",
    damage_type: "bludgeoning",
  },
  {
    category: "action",
    name: "Longsword",
    kind: "Melee Attack Roll",
    range: "reach 5 ft.",
    target: "one target",
    to_hit_ability: "str",
    to_hit_proficient: true,
    damage_dice: "1d8",
    damage_ability: "str",
    damage_type: "slashing",
  },
  {
    category: "action",
    name: "Shortsword",
    kind: "Melee Attack Roll",
    range: "reach 5 ft.",
    target: "one target",
    to_hit_ability: "best_of_str_dex",
    to_hit_proficient: true,
    damage_dice: "1d6",
    damage_ability: "best_of_str_dex",
    damage_type: "piercing",
  },
  {
    category: "action",
    name: "Scimitar",
    kind: "Melee Attack Roll",
    range: "reach 5 ft.",
    target: "one target",
    to_hit_ability: "best_of_str_dex",
    to_hit_proficient: true,
    damage_dice: "1d6",
    damage_ability: "best_of_str_dex",
    damage_type: "slashing",
  },
  {
    category: "action",
    name: "Spear",
    kind: "Melee or Ranged Attack Roll",
    range: "reach 5 ft. or range 20/60 ft.",
    target: "one target",
    to_hit_ability: "str",
    to_hit_proficient: true,
    damage_dice: "1d6",
    damage_ability: "str",
    damage_type: "piercing",
  },
  {
    category: "action",
    name: "Shortbow",
    kind: "Ranged Attack Roll",
    range: "range 80/320 ft.",
    target: "one target",
    to_hit_ability: "dex",
    to_hit_proficient: true,
    damage_dice: "1d6",
    damage_ability: "dex",
    damage_type: "piercing",
  },
  {
    category: "action",
    name: "Longbow",
    kind: "Ranged Attack Roll",
    range: "range 150/600 ft.",
    target: "one target",
    to_hit_ability: "dex",
    to_hit_proficient: true,
    damage_dice: "1d8",
    damage_ability: "dex",
    damage_type: "piercing",
  },
  {
    category: "action",
    name: "Fire Breath",
    kind: "Dexterity Saving Throw",
    range: "15-foot Cone or 30-foot Line",
    save_ability: "DEX",
    save_dc: 10,
    save_effect: "Half damage",
    recharge: "Recharge 5–6",
    damage: "2d6 fire",
    damage_dice: "2d6",
    damage_type: "fire",
    text: "*Failure:* damage. *Success:* Half damage.",
  },
  {
    category: "action",
    name: "Poison Breath",
    kind: "Constitution Saving Throw",
    range: "15-foot Cone",
    save_ability: "CON",
    save_dc: 10,
    save_effect: "Half damage",
    recharge: "Recharge 5–6",
    damage: "2d6 poison",
    damage_dice: "2d6",
    damage_type: "poison",
    text: "*Failure:* damage. *Success:* Half damage.",
  },

  // === Bonus Actions ===
  {
    category: "bonus",
    name: "Nimble Escape",
    text: "The creature takes the Disengage or Hide action.",
  },
  {
    category: "bonus",
    name: "Cunning Action",
    text: "The creature takes the Dash, Disengage, or Hide action.",
  },

  // === Reactions ===
  {
    category: "reaction",
    name: "Parry",
    text: "The creature adds 2 to its AC against one melee attack that would hit it. To do so, the creature must see the attacker and be wielding a melee weapon.",
  },
  {
    category: "reaction",
    name: "Shield",
    text: "The creature casts *Shield* in response to being hit by an attack.",
  },

  // === Legendary Actions ===
  {
    category: "legendary",
    name: "Detect",
    text: "The creature makes a Wisdom (Perception) check.",
  },
  {
    category: "legendary",
    name: "Move",
    text: "The creature moves up to its Speed without provoking Opportunity Attacks.",
  },
  {
    category: "legendary",
    name: "Attack",
    text: "The creature makes one attack.",
  },
] as const;

export function findEntryPresets(query: string, category?: CreatureEntryCategory): EntryPreset[] {
  const lowerQuery = query.toLowerCase().trim();
  if (!lowerQuery) return [];

  return ENTRY_PRESETS.filter((preset) => {
    if (category && preset.category !== category) return false;
    return preset.name.toLowerCase().includes(lowerQuery);
  }).slice(0, 10);
}
