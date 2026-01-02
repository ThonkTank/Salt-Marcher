// Ziel: Vault-persistierte LootContainer-Entity für stored Loot
// Siehe: docs/types/LootContainer.md

import { z } from 'zod';
import { creatureLootItemSchema } from './npc';
import { gameDateTimeSchema } from '../time';

// ============================================================================
// LOOT CONTAINER STATUS
// ============================================================================

export const LOOT_CONTAINER_STATUSES = ['pristine', 'partially_looted', 'looted'] as const;
export const lootContainerStatusSchema = z.enum(LOOT_CONTAINER_STATUSES);
export type LootContainerStatus = z.infer<typeof lootContainerStatusSchema>;

// ============================================================================
// LOOT CONTAINER SCHEMA
// ============================================================================

/**
 * Persistente Loot-Instanz in der Spielwelt.
 * MVP: orts-unspezifisch (locationRef optional), verlinkt mit ownerNpcId.
 * Später: locationRef auf POI/Landmark setzen.
 */
export const lootContainerSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),

  // Location (MVP: optional für orts-unspezifische Container)
  locationRef: z.string().optional(),

  // Inhalt
  items: z.array(creatureLootItemSchema),
  totalValue: z.number().min(0),

  // Status
  status: lootContainerStatusSchema,

  // Besitzer-NPC (für Verlinkung)
  ownerNpcId: z.string().optional(),

  // Lock/Trap (optional)
  locked: z.boolean().optional(),
  lockDC: z.number().int().positive().optional(),
  trapped: z.boolean().optional(),
  trapRef: z.string().optional(),

  // Timestamps
  discoveredAt: gameDateTimeSchema.optional(),
  lootedAt: gameDateTimeSchema.optional(),

  // GM-Notizen
  description: z.string().optional(),
  gmNotes: z.string().optional(),
});

export type LootContainer = z.infer<typeof lootContainerSchema>;
export type LootContainerId = LootContainer['id'];
