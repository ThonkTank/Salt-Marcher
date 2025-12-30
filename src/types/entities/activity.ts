// Vault-persistierte Activity-Definition
// Siehe: docs/entities/activity.md

import { z } from 'zod';

// ============================================================================
// ACTIVITY SCHEMA
// ============================================================================

/**
 * Context-Tags bestimmen, wann eine Activity anwendbar ist:
 * - 'active': Nur wenn Kreatur zur aktuellen Tageszeit aktiv ist
 * - 'resting': Nur wenn Kreatur zur aktuellen Tageszeit ruht
 * - 'movement': Bewegungs-Activity
 * - 'stealth': Versteckte Activity
 * - 'aquatic': Nur bei Wasser-Terrain
 *
 * Activities mit beiden Tags ('active' + 'resting') sind immer anwendbar.
 */
export const activitySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  awareness: z.number().min(0).max(100),
  detectability: z.number().min(0).max(100),
  contextTags: z.array(z.string()),
  description: z.string().optional(),
});

export type Activity = z.infer<typeof activitySchema>;
export type ActivityId = string;
