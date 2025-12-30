// Vault-persistierte NPC-Entity
// Siehe: docs/entities/npc.md
//
// TASKS:
// |  # | Status | Domain | Layer    | Beschreibung                              |  Prio  | MVP? | Deps | Spec                        | Imp.                           |
// |--:|:----:|:-----|:-------|:----------------------------------------|:----:|:--:|:---|:--------------------------|:-----------------------------|
// | 63 |   ⬜    | NPCs   | entities | NPC-Schema: reputations Array hinzufuegen | mittel | Nein | #59  | entities/npc.md#reputations | types/entities/npc.ts [ändern] |

import { z } from 'zod';
import { hexCoordinateSchema } from './map';
import { gameDateTimeSchema } from '../time';
import { NPC_STATUSES } from '../../constants/npc';

// ============================================================================
// SUB-SCHEMAS
// ============================================================================

export const personalityTraitsSchema = z.object({
  primary: z.string().min(1),
  secondary: z.string().min(1),
});
export type PersonalityTraits = z.infer<typeof personalityTraitsSchema>;

export const creatureRefSchema = z.object({
  type: z.string().min(1),
  id: z.string().min(1),
});
export type CreatureRef = z.infer<typeof creatureRefSchema>;

export const npcStatusSchema = z.enum(NPC_STATUSES);

// ============================================================================
// NPC (Vault-persistiert)
// ============================================================================

export const npcSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  creature: creatureRefSchema,
  factionId: z.string().min(1).optional(),
  personality: personalityTraitsSchema,
  quirk: z.string().optional(),
  personalGoal: z.string().min(1),
  status: npcStatusSchema,
  firstEncounter: gameDateTimeSchema,
  lastEncounter: gameDateTimeSchema,
  encounterCount: z.number().int().min(0),
  lastKnownPosition: hexCoordinateSchema.optional(),
  lastSeenAt: gameDateTimeSchema.optional(),
  currentPOI: z.string().min(1).optional(),
  gmNotes: z.string().optional(),
});

export type NPC = z.infer<typeof npcSchema>;
export type NPCId = NPC['id'];
