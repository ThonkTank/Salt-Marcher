// devkit/testing/fixtures/equipment.ts
// Reusable equipment test data

/**
 * Minimal equipment for basic testing
 */
export const minimalEquipment = {
  name: "Test Club",
  type: "Simple Melee Weapon",
  cost: "1 sp",
  weight: 2,
};

/**
 * Simple weapon
 */
export const simpleWeapon = {
  name: "Test Longsword",
  type: "Martial Melee Weapon",
  cost: "15 gp",
  damage: "1d8 slashing",
  weight: 3,
  properties: ["Versatile (1d10)"],
};

/**
 * Ranged weapon
 */
export const rangedWeapon = {
  name: "Test Longbow",
  type: "Martial Ranged Weapon",
  cost: "50 gp",
  damage: "1d8 piercing",
  weight: 2,
  range: "150/600",
  properties: ["Ammunition", "Heavy", "Two-Handed"],
};

/**
 * Light armor
 */
export const lightArmor = {
  name: "Test Leather Armor",
  type: "Light Armor",
  cost: "10 gp",
  armorClass: "11 + Dex modifier",
  weight: 10,
  stealthDisadvantage: false,
};

/**
 * Heavy armor
 */
export const heavyArmor = {
  name: "Test Plate Armor",
  type: "Heavy Armor",
  cost: "1,500 gp",
  armorClass: "18",
  strengthRequired: 15,
  weight: 65,
  stealthDisadvantage: true,
};

/**
 * Shield
 */
export const shield = {
  name: "Test Shield",
  type: "Shield",
  cost: "10 gp",
  armorClass: "+2",
  weight: 6,
};

/**
 * Tool
 */
export const tool = {
  name: "Test Thieves' Tools",
  type: "Tool",
  cost: "25 gp",
  weight: 1,
  description: "This set of tools includes a small file, a set of lock picks, a small mirror mounted on a metal handle, a set of narrow-bladed scissors, and a pair of pliers. Proficiency with these tools lets you add your proficiency bonus to any ability checks you make to disarm traps or open locks.",
};

/**
 * Adventuring gear
 */
export const adventuringGear = {
  name: "Test Rope, Hempen (50 feet)",
  type: "Adventuring Gear",
  cost: "1 gp",
  weight: 10,
  description: "Rope, whether made of hemp or silk, has 2 hit points and can be burst with a DC 17 Strength check.",
};

/**
 * Complex weapon with multiple properties
 */
export const complexWeapon = {
  name: "Test Hand Crossbow",
  type: "Martial Ranged Weapon",
  cost: "75 gp",
  damage: "1d6 piercing",
  weight: 3,
  range: "30/120",
  properties: ["Ammunition", "Light", "Loading"],
  description: "Because of the time required to load this weapon, you can fire only one piece of ammunition from it when you use an action, bonus action, or reaction to fire it, regardless of the number of attacks you can normally make.",
};

/**
 * Mount
 */
export const mount = {
  name: "Test Warhorse",
  type: "Mount",
  cost: "400 gp",
  speed: "60 ft.",
  carryingCapacity: "540 lb.",
  description: "A warhorse is trained for battle.",
};

/**
 * Vehicle
 */
export const vehicle = {
  name: "Test Rowboat",
  type: "Vehicle (Water)",
  cost: "50 gp",
  speed: "1.5 mph",
  capacity: "2 passengers",
  description: "A rowboat can be rowed or towed.",
};

/**
 * All equipment fixtures for easy import
 */
export const equipment = {
  minimal: minimalEquipment,
  simpleWeapon: simpleWeapon,
  rangedWeapon: rangedWeapon,
  lightArmor: lightArmor,
  heavyArmor: heavyArmor,
  shield: shield,
  tool: tool,
  adventuringGear: adventuringGear,
  complexWeapon: complexWeapon,
  mount: mount,
  vehicle: vehicle,
};
