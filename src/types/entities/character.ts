// Vault-persistierte Character-Entity (Player Characters)
// Siehe: docs/features/Character-System.md

import { z } from 'zod';
import { actionSchema } from './action';

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
  currentHp: z.number().int().min(0),
  ac: z.number().int().positive(),

  // Perception (für Encounter-Distance)
  passivePerception: z.number().int(),
  passiveStealth: z.number().int(),

  // Movement (für Travel)
  speed: z.number().int().positive(),

  // Attributes (für Encumbrance)
  strength: z.number().int().min(1).max(30),

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
