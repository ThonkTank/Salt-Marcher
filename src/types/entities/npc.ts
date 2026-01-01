// Vault-persistierte NPC-Entity
// Siehe: docs/entities/npc.md
//
// TASKS:
// |  # | Status | Domain | Layer    | Beschreibung                              |  Prio  | MVP? | Deps | Spec                        | Imp.                           |
// |--:|:----:|:-----|:-------|:----------------------------------------|:----:|:--:|:---|:--------------------------|:-----------------------------|
// | 63 |   ✅    | NPCs   | entities | NPC-Schema: reputations Array hinzufuegen | mittel | Nein | #59  | entities/npc.md#reputations | types/entities/npc.ts [ändern] |

import { z } from 'zod';
import { hexCoordinateSchema } from './map';
import { gameDateTimeSchema } from '../time';
import { NPC_STATUSES } from '../../constants/npc';
import { reputationEntrySchema } from '../common/reputation';

// ============================================================================
// SUB-SCHEMAS
// ============================================================================

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
  personality: z.string().min(1),
  value: z.string().min(1),
  quirk: z.string().optional(),
  appearance: z.string().optional(),
  goal: z.string().min(1),
  status: npcStatusSchema,
  firstEncounter: gameDateTimeSchema,
  lastEncounter: gameDateTimeSchema,
  encounterCount: z.number().int().min(0),
  lastKnownPosition: hexCoordinateSchema.optional(),
  lastSeenAt: gameDateTimeSchema.optional(),
  currentPOI: z.string().min(1).optional(),
  reputations: z.array(reputationEntrySchema).optional().default([]),
  gmNotes: z.string().optional(),
});

export type NPC = z.infer<typeof npcSchema>;
export type NPCId = NPC['id'];
