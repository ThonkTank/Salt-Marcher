// Ziel: Vault-persistierte Goal-Definition
// Siehe: docs/services/npcs/NPC-Generation.md#PersonalGoal-Pool-Hierarchie
//
// Goals sind persönliche Ziele für NPCs, aus globalem Pool ausgewählt.
// Culture referenziert Goals nur per ID (keine Gewichtung).
// personalityBonus definiert Multiplikatoren für Personality-Traits (Task #56).

import { z } from 'zod';

/**
 * Personality-Bonus für Goal-Gewichtung.
 * Wenn NPC-Personality (primary/secondary) matcht, wird Gewicht multipliziert.
 */
export const personalityBonusSchema = z.object({
  trait: z.string().min(1),
  multiplier: z.number().min(0),
});

export type PersonalityBonus = z.infer<typeof personalityBonusSchema>;

/**
 * Goal-Schema für NPC-Ziele.
 *
 * - id: Eindeutiger Identifier (z.B. 'survive', 'loot')
 * - name: Anzeigename (z.B. 'Überleben')
 * - description: Beschreibung für GM (z.B. 'Am Leben bleiben um jeden Preis')
 * - personalityBonus: Multiplikatoren für passende Personality-Traits
 */
export const goalSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  personalityBonus: z.array(personalityBonusSchema).optional(),
});

export type Goal = z.infer<typeof goalSchema>;
