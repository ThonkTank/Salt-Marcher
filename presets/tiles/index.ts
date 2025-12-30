// Tile-Presets für CLI-Testing und Plugin-Bundling
// Siehe: docs/entities/overworld-tile.md

import { z } from 'zod';
import { overworldTileSchema } from '../../src/types/entities/overworldTile';

// ============================================================================
// PRESET-SCHEMA
// ============================================================================

export const tilePresetSchema = overworldTileSchema;
export const tilePresetsSchema = z.array(tilePresetSchema);

// ============================================================================
// PRESET-DATEN: Küstendorf mit Bergen
// ============================================================================
//
// Hex-Koordinaten (axial):
// - q+ = Ost, q- = West
// - r+ = Nordwest, r- = Südost
//
// Geographie:
// - Zentrum: Dorf (sicher)
// - Nord (hohe r): Bergkette (Bergstamm-Goblins)
// - West (niedrige q): Küste (Küstenschmuggler)
// - Ost (hohe q): Felder und Hügel
//
// Fraktionen:
// - bergstamm: Goblins in Bergen + angrenzenden Wäldern
// - schmuggler: Banditen an der Küste

export const tilePresets = tilePresetsSchema.parse([
  // ──────────────────────────────────────────────────────────────────────────
  // Ring 0 - Dorf (sicher)
  // ──────────────────────────────────────────────────────────────────────────
  { coordinate: { q: 0, r: 0 }, terrain: 'grassland', crBudget: 5 },

  // ──────────────────────────────────────────────────────────────────────────
  // Ring 1 - Dorfumgebung (keine Fraktionen)
  // ──────────────────────────────────────────────────────────────────────────
  { coordinate: { q: -1, r: 1 }, terrain: 'grassland' },
  { coordinate: { q: 0, r: 1 }, terrain: 'grassland' },
  { coordinate: { q: 1, r: 0 }, terrain: 'grassland' },
  { coordinate: { q: 1, r: -1 }, terrain: 'grassland' },
  { coordinate: { q: 0, r: -1 }, terrain: 'coast' },
  { coordinate: { q: -1, r: 0 }, terrain: 'coast' },

  // ──────────────────────────────────────────────────────────────────────────
  // Ring 2 - Übergangszone
  // ──────────────────────────────────────────────────────────────────────────
  // Nordwest: Wald (Goblin-Einfluss)
  {
    coordinate: { q: -2, r: 2 },
    terrain: 'forest',
    factionPresence: [{ factionId: 'bergstamm', weight: 1.0 }],
  },
  {
    coordinate: { q: -1, r: 2 },
    terrain: 'forest',
    factionPresence: [{ factionId: 'bergstamm', weight: 1.0 }],
  },
  // Nord: Vorberge (leichter Goblin-Einfluss)
  {
    coordinate: { q: 0, r: 2 },
    terrain: 'hill',
    factionPresence: [{ factionId: 'bergstamm', weight: 0.5 }],
  },
  {
    coordinate: { q: 1, r: 1 },
    terrain: 'hill',
    factionPresence: [{ factionId: 'bergstamm', weight: 0.5 }],
  },
  // Ost: Felder (neutral)
  { coordinate: { q: 2, r: 0 }, terrain: 'grassland' },
  { coordinate: { q: 2, r: -1 }, terrain: 'grassland' },
  { coordinate: { q: 2, r: -2 }, terrain: 'grassland' },
  { coordinate: { q: 1, r: -2 }, terrain: 'grassland' },
  // Süd/West: Küste (Schmuggler-Einfluss)
  {
    coordinate: { q: 0, r: -2 },
    terrain: 'coast',
    factionPresence: [{ factionId: 'schmuggler', weight: 1.0 }],
  },
  {
    coordinate: { q: -1, r: -1 },
    terrain: 'coast',
    factionPresence: [{ factionId: 'schmuggler', weight: 1.0 }],
  },
  {
    coordinate: { q: -2, r: 0 },
    terrain: 'coast',
    factionPresence: [{ factionId: 'schmuggler', weight: 1.5 }],
  },
  // Nordwest: Küstenwald (neutral)
  { coordinate: { q: -2, r: 1 }, terrain: 'forest' },

  // ──────────────────────────────────────────────────────────────────────────
  // Ring 3 - Wildnis (Fraktions-Kerngebiete)
  // ──────────────────────────────────────────────────────────────────────────
  // Nordwest: Dichter Wald (Goblin-Einfluss)
  {
    coordinate: { q: -3, r: 3 },
    terrain: 'forest',
    factionPresence: [{ factionId: 'bergstamm', weight: 1.5 }],
  },
  // Nord: Bergkette (Goblin-Kerngebiet)
  {
    coordinate: { q: -2, r: 3 },
    terrain: 'mountain',
    crBudget: 30,
    factionPresence: [{ factionId: 'bergstamm', weight: 2.5 }],
  },
  {
    coordinate: { q: -1, r: 3 },
    terrain: 'mountain',
    crBudget: 30,
    factionPresence: [{ factionId: 'bergstamm', weight: 3.0 }],
  },
  {
    coordinate: { q: 0, r: 3 },
    terrain: 'mountain',
    crBudget: 30,
    factionPresence: [{ factionId: 'bergstamm', weight: 3.0 }],
  },
  {
    coordinate: { q: 1, r: 2 },
    terrain: 'mountain',
    crBudget: 30,
    factionPresence: [{ factionId: 'bergstamm', weight: 2.5 }],
  },
  // Nordost: Vorberge (Goblin-Randgebiet)
  {
    coordinate: { q: 2, r: 1 },
    terrain: 'hill',
    factionPresence: [{ factionId: 'bergstamm', weight: 1.0 }],
  },
  // Ost: Hügel und Felder (neutral)
  { coordinate: { q: 3, r: 0 }, terrain: 'hill' },
  { coordinate: { q: 3, r: -1 }, terrain: 'grassland' },
  { coordinate: { q: 3, r: -2 }, terrain: 'grassland' },
  // Südost: Felder (neutral)
  { coordinate: { q: 3, r: -3 }, terrain: 'grassland' },
  { coordinate: { q: 2, r: -3 }, terrain: 'grassland' },
  // Süd: Küste (Schmuggler-Einfluss)
  {
    coordinate: { q: 1, r: -3 },
    terrain: 'coast',
    factionPresence: [{ factionId: 'schmuggler', weight: 1.5 }],
  },
  {
    coordinate: { q: 0, r: -3 },
    terrain: 'coast',
    factionPresence: [{ factionId: 'schmuggler', weight: 2.0 }],
  },
  {
    coordinate: { q: -1, r: -2 },
    terrain: 'coast',
    factionPresence: [{ factionId: 'schmuggler', weight: 2.0 }],
  },
  // West: Küste (Schmuggler-Kerngebiet)
  {
    coordinate: { q: -2, r: -1 },
    terrain: 'coast',
    factionPresence: [{ factionId: 'schmuggler', weight: 2.5 }],
  },
  {
    coordinate: { q: -3, r: 0 },
    terrain: 'coast',
    factionPresence: [{ factionId: 'schmuggler', weight: 2.5 }],
  },
  {
    coordinate: { q: -3, r: 1 },
    terrain: 'coast',
    factionPresence: [{ factionId: 'schmuggler', weight: 2.0 }],
  },
  // Nordwest: Küstenwald (neutral)
  { coordinate: { q: -3, r: 2 }, terrain: 'forest' },
]);

export default tilePresets;
