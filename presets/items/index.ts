// Item-Presets für CLI-Testing und Plugin-Bundling
// Siehe: docs/types/item.md

import { z } from 'zod';

// ============================================================================
// PRESET-SCHEMA
// ============================================================================

export const itemPresetSchema = z.object({
  id: z.string(),
  name: z.string(),
  value: z.number(),
  pounds: z.number().optional(), // physical weight in lb
  tags: z.array(z.string()).optional(),
  rarity: z.enum(['common', 'uncommon', 'rare', 'very_rare', 'legendary']).optional(),
  category: z.enum(['weapon', 'armor', 'shield', 'consumable', 'gear', 'container', 'treasure', 'currency']).optional(),
  carryCapacityMultiplier: z.number().optional(), // Multipliziert Kreatur-Tragkapazität (z.B. 1.2 = +20%)
});

export const itemPresetsSchema = z.array(itemPresetSchema);

// ============================================================================
// PRESET-DATEN
// ============================================================================

export const itemPresets = itemPresetsSchema.parse([
  // Waffen (verschiedene Scores für Tag-Tests)
  { id: 'shortsword', name: 'Kurzschwert', value: 10, pounds: 2, tags: ['weapon', 'martial', 'metal'] },
  { id: 'dagger', name: 'Dolch', value: 2, pounds: 1, tags: ['weapon', 'simple', 'metal'] },
  { id: 'club', name: 'Knüppel', value: 1, pounds: 2, tags: ['weapon', 'simple', 'wood'] },

  // Rüstung
  { id: 'leather-armor', name: 'Lederrüstung', value: 10, pounds: 10, tags: ['armor', 'light'] },
  { id: 'chain-shirt', name: 'Kettenhemd', value: 50, pounds: 20, tags: ['armor', 'medium', 'metal'] },

  // Consumables
  { id: 'healing-potion', name: 'Heiltrank', value: 50, pounds: 0.5, tags: ['consumable', 'magic'], rarity: 'common' },
  { id: 'rations', name: 'Rationen', value: 1, pounds: 2, tags: ['consumable', 'supplies'] },

  // Tribal/Goblin Items (für Creature-Tag-Matching)
  { id: 'goblin-totem', name: 'Goblin-Totem', value: 5, pounds: 1, tags: ['tribal', 'goblinoid'] },
  { id: 'crude-spear', name: 'Primitiver Speer', value: 1, pounds: 3, tags: ['weapon', 'simple', 'tribal'] },

  // Currency (50 Münzen = 1 lb)
  { id: 'gold-piece', name: 'Goldmünze', value: 1, pounds: 0.02, tags: ['currency'] },
  { id: 'silver-piece', name: 'Silbermünze', value: 0.1, pounds: 0.02, tags: ['currency'] },

  // Teure Items (für Budget-Tests)
  { id: 'plate-armor', name: 'Plattenpanzer', value: 1500, pounds: 65, tags: ['armor', 'heavy', 'metal'] },
  { id: 'longsword', name: 'Langschwert', value: 15, pounds: 3, tags: ['weapon', 'martial', 'metal'] },

  // Container mit carryCapacityMultiplier (erhöhen Kreatur-Tragkapazität)
  // Multiplikator wirkt auf die Kreatur, die das Item erhält
  { id: 'backpack', name: 'Rucksack', value: 2, pounds: 5, category: 'gear', tags: ['gear', 'humanoid'], carryCapacityMultiplier: 1.2 },
  { id: 'saddlebags', name: 'Satteltaschen', value: 4, pounds: 8, category: 'gear', tags: ['gear', 'humanoid'], carryCapacityMultiplier: 1.25 },

  // Stationäre Container (ohne Multiplikator - müssen getragen werden)
  { id: 'chest', name: 'Truhe', value: 5, pounds: 25, category: 'container', tags: ['container'] },
  { id: 'barrel', name: 'Fass', value: 2, pounds: 70, category: 'container', tags: ['container'] },

  // Großer Transportcontainer (mit Zugtieren)
  { id: 'wagon', name: 'Wagen', value: 35, pounds: 400, category: 'container', tags: ['container', 'humanoid'], carryCapacityMultiplier: 5.0 },
]);

// Default-Export für einfachen Import
export default itemPresets;
