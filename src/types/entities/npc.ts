// Vault-persistierte NPC-Entity
// Siehe: docs/entities/npc.md

import { z } from 'zod';
import { hexCoordinateSchema } from './map';
import { gameDateTimeSchema } from '../time';
import { NPC_STATUSES } from '../../constants/npc';
import { reputationEntrySchema } from '../common/reputation';

// ============================================================================
// SUB-SCHEMAS
// ============================================================================

// Verschoben von creature.ts - authoritative Definition
export const creatureLootItemSchema = z.object({
  id: z.string().min(1),
  quantity: z.number().int().positive(),
});
export type CreatureLootItem = z.infer<typeof creatureLootItemSchema>;

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

  // HP (werden beim Encounter gesetzt, im Vault persistiert)
  currentHp: z.number().int(),
  maxHp: z.number().int().positive(),

  // Besitztümer (alle Items die NPC besitzt, im Vault persistiert)
  possessions: z.array(creatureLootItemSchema).optional().default([]),

  // Carried Possessions (ephemer: was NPC gerade dabei hat, wird pro Encounter berechnet)
  // NICHT persistiert - selectCarriedItems() berechnet aus possessions + carryCapacity
  carriedPossessions: z.array(creatureLootItemSchema).optional(),

  // Lagerort der possessions (Hideout, Lager, etc.)
  storedLootContainerId: z.string().optional(),

  gmNotes: z.string().optional(),
});

export type NPC = z.infer<typeof npcSchema>;
export type NPCId = NPC['id'];
