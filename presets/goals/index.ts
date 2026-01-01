// Goal-Presets für NPC-Generierung
// Siehe: docs/services/npcs/NPC-Generation.md#PersonalGoal-Pool-Hierarchie
//
// Goals werden per ID in Culture referenziert.
// personalityBonus definiert Multiplikatoren für passende Personality-Traits.
// Generic Goals sind immer im Pool verfügbar (nicht nur durch Culture).

import { z } from 'zod';
import { goalSchema, type Goal } from '../../src/types/entities/goal';

// ============================================================================
// PRESET-SCHEMA
// ============================================================================

export const goalPresetSchema = goalSchema;
export const goalPresetsSchema = z.array(goalPresetSchema);

// ============================================================================
// GENERIC GOALS (immer verfügbar)
// ============================================================================

export const GENERIC_GOAL_IDS = [
  'survive',
  'profit',
  'power',
  'freedom',
  'revenge',
] as const;

export type GenericGoalId = typeof GENERIC_GOAL_IDS[number];

// ============================================================================
// PRESET-DATEN
// ============================================================================

export const goalPresets: Goal[] = goalPresetsSchema.parse([
  // ──────────────────────────────────────────────────────────────────────────
  // Generic Goals (immer im Pool)
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'survive',
    name: 'Überleben',
    description: 'Am Leben bleiben um jeden Preis',
    personalityBonus: [
      { trait: 'cowardly', multiplier: 1.5 },
      { trait: 'cautious', multiplier: 1.3 },
    ],
  },
  {
    id: 'profit',
    name: 'Profit',
    description: 'Profit machen, Reichtum anhäufen',
    personalityBonus: [
      { trait: 'greedy', multiplier: 2.0 },
      { trait: 'ambitious', multiplier: 1.3 },
      { trait: 'calculating', multiplier: 1.2 },
    ],
  },
  {
    id: 'power',
    name: 'Macht',
    description: 'Macht und Einfluss erlangen',
    personalityBonus: [
      { trait: 'ambitious', multiplier: 2.0 },
      { trait: 'dominant', multiplier: 1.5 },
      { trait: 'ruthless', multiplier: 1.3 },
    ],
  },
  {
    id: 'freedom',
    name: 'Freiheit',
    description: 'Freiheit bewahren, Kontrolle vermeiden',
    personalityBonus: [
      { trait: 'independent', multiplier: 1.5 },
      { trait: 'rebellious', multiplier: 1.5 },
      { trait: 'wild', multiplier: 1.3 },
    ],
  },
  {
    id: 'revenge',
    name: 'Rache',
    description: 'Rache nehmen für erlittenes Unrecht',
    personalityBonus: [
      { trait: 'vengeful', multiplier: 2.0 },
      { trait: 'aggressive', multiplier: 1.3 },
      { trait: 'bitter', multiplier: 1.3 },
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Goblinoid Goals
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'loot',
    name: 'Beute',
    description: 'Beute machen, plündern',
    personalityBonus: [
      { trait: 'greedy', multiplier: 2.0 },
      { trait: 'opportunistic', multiplier: 1.5 },
    ],
  },
  {
    id: 'please_boss',
    name: 'Boss zufriedenstellen',
    description: 'Den Boss zufriedenstellen, Bestrafung vermeiden',
    personalityBonus: [
      { trait: 'loyal', multiplier: 1.5 },
      { trait: 'cowardly', multiplier: 1.3 },
      { trait: 'submissive', multiplier: 1.5 },
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Händler/Schmuggler Goals
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'expand_influence',
    name: 'Einfluss erweitern',
    description: 'Einflussbereich und Macht ausbauen',
    personalityBonus: [
      { trait: 'ambitious', multiplier: 1.5 },
      { trait: 'calculating', multiplier: 1.3 },
    ],
  },
  {
    id: 'maintain_network',
    name: 'Netzwerk pflegen',
    description: 'Kontakte und Beziehungen aufrechterhalten',
    personalityBonus: [
      { trait: 'loyal', multiplier: 1.3 },
      { trait: 'patient', multiplier: 1.3 },
      { trait: 'diplomatic', multiplier: 1.3 },
    ],
  },
  {
    id: 'avoid_guards',
    name: 'Wachen vermeiden',
    description: 'Konfrontation mit Autoritäten vermeiden',
    personalityBonus: [
      { trait: 'cowardly', multiplier: 1.5 },
      { trait: 'cautious', multiplier: 1.5 },
      { trait: 'suspicious', multiplier: 1.2 },
    ],
  },
  {
    id: 'expand_network',
    name: 'Netzwerk erweitern',
    description: 'Neue Kontakte und Verbindungen aufbauen',
    personalityBonus: [
      { trait: 'ambitious', multiplier: 1.3 },
      { trait: 'opportunistic', multiplier: 1.3 },
      { trait: 'charismatic', multiplier: 1.2 },
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Beast/Predator Goals
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'hunt',
    name: 'Jagen',
    description: 'Beute jagen und erlegen',
    personalityBonus: [
      { trait: 'predatory', multiplier: 2.0 },
      { trait: 'patient', multiplier: 1.3 },
      { trait: 'aggressive', multiplier: 1.2 },
    ],
  },
  {
    id: 'protect_territory',
    name: 'Territorium verteidigen',
    description: 'Das eigene Revier vor Eindringlingen schützen',
    personalityBonus: [
      { trait: 'territorial', multiplier: 2.0 },
      { trait: 'aggressive', multiplier: 1.3 },
      { trait: 'protective', multiplier: 1.3 },
    ],
  },
  {
    id: 'protect_pack',
    name: 'Rudel beschützen',
    description: 'Die Gruppe/das Rudel beschützen',
    personalityBonus: [
      { trait: 'loyal', multiplier: 1.5 },
      { trait: 'protective', multiplier: 2.0 },
      { trait: 'brave', multiplier: 1.2 },
    ],
  },
  {
    id: 'find_food',
    name: 'Nahrung finden',
    description: 'Nahrungsquellen finden und sichern',
    personalityBonus: [
      { trait: 'hungry', multiplier: 2.0 },
      { trait: 'opportunistic', multiplier: 1.3 },
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Undead Goals
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'serve_master',
    name: 'Meister dienen',
    description: 'Den Befehlen des Erschaffers folgen',
    personalityBonus: [
      { trait: 'loyal', multiplier: 2.0 },
      { trait: 'obedient', multiplier: 2.0 },
    ],
  },
  {
    id: 'obey_master',
    name: 'Meister gehorchen',
    description: 'Befehle des Meisters ausführen ohne Frage',
    personalityBonus: [
      { trait: 'obedient', multiplier: 2.0 },
      { trait: 'mindless', multiplier: 1.5 },
    ],
  },
  {
    id: 'guard_location',
    name: 'Ort bewachen',
    description: 'Einen bestimmten Ort vor Eindringlingen schützen',
    personalityBonus: [
      { trait: 'vigilant', multiplier: 1.5 },
      { trait: 'territorial', multiplier: 1.3 },
    ],
  },
  {
    id: 'consume_living',
    name: 'Lebende verzehren',
    description: 'Lebensenergie oder Fleisch der Lebenden konsumieren',
    personalityBonus: [
      { trait: 'hungry', multiplier: 2.0 },
      { trait: 'predatory', multiplier: 1.5 },
    ],
  },
  {
    id: 'destroy_living',
    name: 'Lebende vernichten',
    description: 'Alles Lebende zerstören aus Hass',
    personalityBonus: [
      { trait: 'hateful', multiplier: 2.0 },
      { trait: 'vengeful', multiplier: 1.5 },
    ],
  },
  {
    id: 'destroy_intruders',
    name: 'Eindringlinge vernichten',
    description: 'Eindringlinge ohne Gnade eliminieren',
    personalityBonus: [
      { trait: 'territorial', multiplier: 1.5 },
      { trait: 'aggressive', multiplier: 1.3 },
    ],
  },
  {
    id: 'find_rest',
    name: 'Ruhe finden',
    description: 'Endlich Frieden und ewige Ruhe finden',
    personalityBonus: [
      { trait: 'sorrowful', multiplier: 2.0 },
      { trait: 'weary', multiplier: 1.5 },
    ],
  },
  {
    id: 'patrol',
    name: 'Patrouillieren',
    description: 'Das Gebiet auf Eindringlinge überwachen',
    personalityBonus: [
      { trait: 'vigilant', multiplier: 1.5 },
      { trait: 'disciplined', multiplier: 1.3 },
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Goblinoid Goals
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'avoid_work',
    name: 'Arbeit vermeiden',
    description: 'Jede Arbeit vermeiden wenn möglich',
    personalityBonus: [
      { trait: 'lazy', multiplier: 2.0 },
      { trait: 'cowardly', multiplier: 1.2 },
    ],
  },
  {
    id: 'get_food',
    name: 'Essen beschaffen',
    description: 'Nahrung für sich selbst finden',
    personalityBonus: [
      { trait: 'hungry', multiplier: 1.5 },
      { trait: 'greedy', multiplier: 1.2 },
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Hobgoblin/Militär Goals
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'conquer',
    name: 'Erobern',
    description: 'Gebiete erobern und unterwerfen',
    personalityBonus: [
      { trait: 'ambitious', multiplier: 2.0 },
      { trait: 'ruthless', multiplier: 1.5 },
    ],
  },
  {
    id: 'rise_in_rank',
    name: 'Im Rang aufsteigen',
    description: 'Höheren Rang in der Hierarchie erreichen',
    personalityBonus: [
      { trait: 'ambitious', multiplier: 2.0 },
      { trait: 'proud', multiplier: 1.3 },
    ],
  },
  {
    id: 'prove_worth',
    name: 'Wert beweisen',
    description: 'Den eigenen Wert durch Taten beweisen',
    personalityBonus: [
      { trait: 'proud', multiplier: 1.5 },
      { trait: 'brave', multiplier: 1.3 },
    ],
  },
  {
    id: 'follow_orders',
    name: 'Befehle ausführen',
    description: 'Befehle der Vorgesetzten ausführen',
    personalityBonus: [
      { trait: 'disciplined', multiplier: 2.0 },
      { trait: 'loyal', multiplier: 1.5 },
    ],
  },
  {
    id: 'crush_weakness',
    name: 'Schwäche vernichten',
    description: 'Schwäche bei anderen und sich selbst eliminieren',
    personalityBonus: [
      { trait: 'ruthless', multiplier: 2.0 },
      { trait: 'cruel', multiplier: 1.3 },
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Human/Allgemeine Goals
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'protect_family',
    name: 'Familie schützen',
    description: 'Die eigene Familie beschützen',
    personalityBonus: [
      { trait: 'protective', multiplier: 2.0 },
      { trait: 'loyal', multiplier: 1.5 },
    ],
  },
  {
    id: 'gain_respect',
    name: 'Respekt erlangen',
    description: 'Respekt und Anerkennung von anderen erlangen',
    personalityBonus: [
      { trait: 'proud', multiplier: 1.5 },
      { trait: 'ambitious', multiplier: 1.3 },
    ],
  },
  {
    id: 'find_meaning',
    name: 'Sinn finden',
    description: 'Einen tieferen Sinn im Leben finden',
    personalityBonus: [
      { trait: 'idealistic', multiplier: 1.5 },
      { trait: 'curious', multiplier: 1.3 },
    ],
  },
  {
    id: 'gain_power',
    name: 'Macht erlangen',
    description: 'Persönliche Macht und Einfluss gewinnen',
    personalityBonus: [
      { trait: 'ambitious', multiplier: 2.0 },
      { trait: 'ruthless', multiplier: 1.3 },
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Beast Goals (zusätzliche)
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'feed_young',
    name: 'Junge füttern',
    description: 'Nahrung für den Nachwuchs beschaffen',
    personalityBonus: [
      { trait: 'protective', multiplier: 2.0 },
      { trait: 'parental', multiplier: 2.0 },
    ],
  },
  {
    id: 'find_shelter',
    name: 'Unterschlupf suchen',
    description: 'Einen sicheren Unterschlupf finden',
    personalityBonus: [
      { trait: 'cautious', multiplier: 1.5 },
      { trait: 'territorial', multiplier: 1.2 },
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Monstrosity/Dragon Goals
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'protect_lair',
    name: 'Höhle verteidigen',
    description: 'Das eigene Lager oder die Höhle verteidigen',
    personalityBonus: [
      { trait: 'territorial', multiplier: 2.0 },
      { trait: 'aggressive', multiplier: 1.3 },
    ],
  },
  {
    id: 'expand_territory',
    name: 'Territorium erweitern',
    description: 'Das eigene Territorium vergrößern',
    personalityBonus: [
      { trait: 'ambitious', multiplier: 1.5 },
      { trait: 'territorial', multiplier: 1.5 },
    ],
  },
  {
    id: 'hoard_treasure',
    name: 'Schätze horten',
    description: 'Gold und Schätze sammeln und horten',
    personalityBonus: [
      { trait: 'greedy', multiplier: 2.0 },
      { trait: 'possessive', multiplier: 1.5 },
    ],
  },
  {
    id: 'dominate',
    name: 'Dominieren',
    description: 'Über andere herrschen und dominieren',
    personalityBonus: [
      { trait: 'dominant', multiplier: 2.0 },
      { trait: 'arrogant', multiplier: 1.5 },
    ],
  },
  {
    id: 'acquire_knowledge',
    name: 'Wissen sammeln',
    description: 'Wissen und Geheimnisse sammeln',
    personalityBonus: [
      { trait: 'curious', multiplier: 2.0 },
      { trait: 'patient', multiplier: 1.3 },
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Fiend Goals
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'corrupt_souls',
    name: 'Seelen verderben',
    description: 'Sterbliche Seelen ins Verderben führen',
    personalityBonus: [
      { trait: 'manipulative', multiplier: 2.0 },
      { trait: 'cruel', multiplier: 1.5 },
    ],
  },
  {
    id: 'fulfill_contract',
    name: 'Vertrag erfüllen',
    description: 'Einen teuflischen Vertrag einhalten',
    personalityBonus: [
      { trait: 'honorable', multiplier: 1.5 },
      { trait: 'patient', multiplier: 1.3 },
    ],
  },
  {
    id: 'spread_chaos',
    name: 'Chaos verbreiten',
    description: 'Chaos und Zerstörung in der Welt säen',
    personalityBonus: [
      { trait: 'chaotic', multiplier: 2.0 },
      { trait: 'cruel', multiplier: 1.3 },
    ],
  },
]);

export default goalPresets;
