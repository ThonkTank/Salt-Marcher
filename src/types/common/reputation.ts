// Ziel: Gemeinsames Schema für Beziehungen zwischen Entities
// Siehe: docs/architecture/types.md#ReputationEntry

import { z } from 'zod';

export const reputationEntrySchema = z.object({
  entityType: z.enum(['party', 'faction', 'npc']),
  entityId: z.string(),
  value: z.number().min(-100).max(100),
});

export type ReputationEntry = z.infer<typeof reputationEntrySchema>;
