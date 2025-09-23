// src/apps/library/entry-presets.ts
export type EntryPreset = { key: string; label: string; entry: any };
export const PRESETS: EntryPreset[] = [
    { key: 'multiattack', label: 'Multiattack (Aktion)', entry: { category: 'action', name: 'Multiattack', text: 'The creature makes two attacks.' }},
    { key: 'bite', label: 'Bite (Aktion)', entry: { category: 'action', name: 'Bite', kind: 'Melee Weapon Attack', to_hit_from: { ability: 'str', proficient: true }, range: 'reach 5 ft.', target: 'one target', damage_from: { dice: '1d8', ability: 'str', bonus: 'piercing' } }},
    { key: 'claws', label: 'Claws (Aktion)', entry: { category: 'action', name: 'Claws', kind: 'Melee Weapon Attack', to_hit_from: { ability: 'str', proficient: true }, range: 'reach 5 ft.', target: 'one target', damage_from: { dice: '2d6', ability: 'str', bonus: 'slashing' } }},
    { key: 'slam', label: 'Slam (Aktion)', entry: { category: 'action', name: 'Slam', kind: 'Melee Weapon Attack', to_hit_from: { ability: 'str', proficient: true }, range: 'reach 5 ft.', target: 'one target', damage_from: { dice: '1d8', ability: 'str', bonus: 'bludgeoning' } }},
    { key: 'tail', label: 'Tail (Aktion)', entry: { category: 'action', name: 'Tail', kind: 'Melee Weapon Attack', to_hit_from: { ability: 'str', proficient: true }, range: 'reach 10 ft.', target: 'one target', damage_from: { dice: '1d8', ability: 'str', bonus: 'bludgeoning' } }},
    { key: 'shortbow', label: 'Shortbow (range 80/320)', entry: { category: 'action', name: 'Shortbow', kind: 'Ranged Weapon Attack', to_hit_from: { ability: 'dex', proficient: true }, range: 'range 80/320 ft.', target: 'one target', damage_from: { dice: '1d6', ability: 'dex', bonus: 'piercing' } }},
    { key: 'longsword', label: 'Longsword (versatile 1d10)', entry: { category: 'action', name: 'Longsword', kind: 'Melee Weapon Attack', to_hit_from: { ability: 'str', proficient: true }, range: 'reach 5 ft.', target: 'one target', damage_from: { dice: '1d8', ability: 'str', bonus: 'slashing' } }},
    { key: 'breath', label: 'Breath Weapon (Aktion)', entry: { category: 'action', name: 'Breath Weapon', range: '15-foot cone', save_ability: 'DEX', save_dc: 12, save_effect: 'half on save', damage: '6d6 [type]', recharge: 'Recharge 5–6', text: 'Each creature in the area must make a saving throw.' }},
    { key: 'pack_tactics', label: 'Pack Tactics (Trait)', entry: { category: 'trait', name: 'Pack Tactics', text: "The creature has advantage on an attack roll against a creature if at least one of the creature's allies is within 5 feet of the creature and the ally isn't incapacitated." }},
    { key: 'keen_senses', label: 'Keen Senses (Trait)', entry: { category: 'trait', name: 'Keen Senses', text: 'The creature has advantage on Wisdom (Perception) checks that rely on sight, hearing, or smell.' }},
    { key: 'amphibious', label: 'Amphibious (Trait)', entry: { category: 'trait', name: 'Amphibious', text: 'The creature can breathe air and water.' }},
    { key: 'magic_resistance', label: 'Magic Resistance (Trait)', entry: { category: 'trait', name: 'Magic Resistance', text: 'The creature has advantage on saving throws against spells and other magical effects.' }},
    { key: 'magic_weapons', label: 'Magic Weapons (Trait)', entry: { category: 'trait', name: 'Magic Weapons', text: "The creature's weapon attacks are magical." }},
    { key: 'legendary_resistance', label: 'Legendary Resistance (3/Day) (Legendär)', entry: { category: 'legendary', name: 'Legendary Resistance (3/Day)', text: 'If the creature fails a saving throw, it can choose to succeed instead.' }},
];

