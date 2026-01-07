// NPC-Presets für CLI-Testing
// Siehe: docs/entities/npc.md

import { z } from 'zod';
import { npcSchema } from '../../src/types/entities/npc';

// ============================================================================
// PRESET-SCHEMA
// ============================================================================

export const npcPresetSchema = npcSchema;
export const npcPresetsSchema = z.array(npcPresetSchema);

// ============================================================================
// PRESET-DATEN
// ============================================================================

export const npcPresets = npcPresetsSchema.parse([
  // ──────────────────────────────────────────────────────────────────────────
  // Bergstamm-Goblins
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'griknak',
    name: 'Griknak der Hinkende',
    creature: { type: 'goblin', id: 'goblin' },
    factionId: 'bergstamm',
    personality: 'cunning',
    value: 'survival',
    quirk: 'Hinkt auf dem linken Bein',
    goal: 'Will den Boss beeindrucken',
    status: 'alive',
    firstEncounter: { year: 1, month: 1, day: 1, hour: 10, segment: 'morning' },
    lastEncounter: { year: 1, month: 1, day: 5, hour: 14, segment: 'afternoon' },
    encounterCount: 2,
    lastKnownPosition: { q: 3, r: -2 },
    currentHp: [[7, 1]],
    maxHp: 7,
  },
  {
    id: 'snaggle',
    name: 'Snaggle Zahnlos',
    creature: { type: 'goblin', id: 'goblin' },
    factionId: 'bergstamm',
    personality: 'greedy',
    value: 'wealth',
    goal: 'Schatz finden',
    status: 'alive',
    firstEncounter: { year: 1, month: 1, day: 10, hour: 8, segment: 'morning' },
    lastEncounter: { year: 1, month: 1, day: 10, hour: 8, segment: 'morning' },
    encounterCount: 1,
    currentHp: [[7, 1]],
    maxHp: 7,
  },
  {
    id: 'borgrik',
    name: 'Borgrik Scharfauge',
    creature: { type: 'hobgoblin', id: 'hobgoblin' },
    factionId: 'bergstamm',
    personality: 'disciplined',
    value: 'power',
    quirk: 'Schärft ständig seine Waffe',
    goal: 'Beförderung zum Kriegshauptmann',
    status: 'alive',
    firstEncounter: { year: 1, month: 1, day: 3, hour: 12, segment: 'midday' },
    lastEncounter: { year: 1, month: 1, day: 7, hour: 18, segment: 'dusk' },
    encounterCount: 3,
    lastKnownPosition: { q: 5, r: -4 },
    currentHp: [[11, 1]],
    maxHp: 11,
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Küstenschmuggler
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'schwarzer-jack',
    name: 'Schwarzer Jack',
    creature: { type: 'bandit', id: 'bandit' },
    factionId: 'schmuggler',
    personality: 'suspicious',
    value: 'wealth',
    quirk: 'Zählt ständig seine Münzen',
    goal: 'Reich werden',
    status: 'alive',
    firstEncounter: { year: 1, month: 1, day: 3, hour: 16, segment: 'afternoon' },
    lastEncounter: { year: 1, month: 1, day: 8, hour: 20, segment: 'dusk' },
    encounterCount: 3,
    lastKnownPosition: { q: -5, r: 2 },
    currentHp: [[11, 1]],
    maxHp: 11,
  },
  {
    id: 'einaeugiger-pete',
    name: 'Einäugiger Pete',
    creature: { type: 'thug', id: 'thug' },
    factionId: 'schmuggler',
    personality: 'loyal',
    value: 'revenge',
    quirk: 'Reibt sich die Narbe über dem fehlenden Auge',
    goal: 'Den Verräter finden, der ihm das Auge genommen hat',
    status: 'alive',
    firstEncounter: { year: 1, month: 1, day: 5, hour: 22, segment: 'night' },
    lastEncounter: { year: 1, month: 1, day: 5, hour: 22, segment: 'night' },
    encounterCount: 1,
    currentHp: [[32, 1]],
    maxHp: 32,
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Fraktionslose NPCs (factionId weggelassen = undefined)
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'einsamer-wolf',
    name: 'Graufell',
    creature: { type: 'wolf', id: 'wolf' },
    // factionId weggelassen = undefined (nicht null)
    personality: 'territorial',
    value: 'survival',
    goal: 'Rudel finden',
    status: 'alive',
    firstEncounter: { year: 1, month: 1, day: 2, hour: 6, segment: 'dawn' },
    lastEncounter: { year: 1, month: 1, day: 2, hour: 6, segment: 'dawn' },
    encounterCount: 1,
    lastKnownPosition: { q: 2, r: 1 },
    currentHp: [[11, 1]],
    maxHp: 11,
  },
]);

export default npcPresets;
