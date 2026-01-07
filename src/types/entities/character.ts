// Vault-persistierte Character-Entity (Player Characters)
// Siehe: docs/features/Character-System.md

import { z } from 'zod';
import { actionSchema } from './action';
import { abilityScoresSchema, abilityNameSchema } from './creature';
import { probabilityDistributionSchema } from '@/utils/probability';

// ============================================================================
// ZOD SCHEMA
// ============================================================================

/**
 * Character-Schema für Player Characters.
 * Enthält Felder für Encounter-Balancing, Travel-Berechnung und Perception.
 */
export const characterSchema = z.object({
  id: z.string(),
  name: z.string(),
  level: z.number().int().min(1).max(20),
  class: z.string(),

  // Combat-Stats
  maxHp: z.number().int().positive(),
  // currentHp ist ProbabilityDistribution für Combat-Simulation
  // Für konkreten Wert: getExpectedValue(currentHp)
  currentHp: probabilityDistributionSchema,
  ac: z.number().int().positive(),

  // Perception (für Encounter-Distance)
  passivePerception: z.number().int(),
  passiveStealth: z.number().int(),

  // Movement (für Travel)
  speed: z.number().int().positive(),

  // Ability Scores (D&D 5e Standard)
  abilities: abilityScoresSchema,

  // Save-Proficiencies (welche Saves der Character proficient ist)
  // z.B. Fighter: ['str', 'con'], Wizard: ['int', 'wis']
  saveProficiencies: z.array(abilityNameSchema).optional(),

  // Inventory (simplified für MVP)
  inventory: z.array(z.unknown()),

  // Combat Actions (für PMF-Simulation)
  // Optional: Falls nicht gesetzt, werden Default-Actions basierend auf Level/Class generiert
  actions: z.array(actionSchema).optional(),
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type Character = z.infer<typeof characterSchema>;
export type CharacterId = string;
