// Item-Konstanten
// Siehe: docs/types/item.md

// ============================================================================
// ITEM CATEGORIES (funktional - was macht das Item?)
// ============================================================================

export const ITEM_CATEGORIES = [
  'weapon',     // Waffen
  'armor',      // Ruestungen
  'shield',     // Schilde
  'consumable', // Traenke, Schriftrollen
  'gear',       // Werkzeug, Ausruestung
  'container',  // Truhen, Wagen, Rucksaecke
  'treasure',   // Edelsteine, Kunst
  'currency',   // Muenzen
] as const;

export type ItemCategory = (typeof ITEM_CATEGORIES)[number];

// ============================================================================
// ITEM RARITY
// ============================================================================

export const ITEM_RARITIES = [
  'common',
  'uncommon',
  'rare',
  'very_rare',
  'legendary',
  'artifact',
] as const;

export type ItemRarity = (typeof ITEM_RARITIES)[number];

// ============================================================================
// ITEM TAGS (Flavour - Loot-Matching mit Creatures/Factions)
// ============================================================================

export const ITEM_TAGS = {
  // Kreatur-/Kultur-Tags
  tribal: 'tribal',
  undead: 'undead',
  beast: 'beast',
  humanoid: 'humanoid',
  arcane: 'arcane',
  // Umgebungs-Tags
  underwater: 'underwater',
  volcanic: 'volcanic',
  frozen: 'frozen',
  // Fraktions-Tags (Beispiele)
  military: 'military',
  noble: 'noble',
  criminal: 'criminal',
} as const;

export type ItemTag = (typeof ITEM_TAGS)[keyof typeof ITEM_TAGS];
