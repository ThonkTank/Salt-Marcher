// Vault-persistierte Landmark-Definition
// Siehe: docs/entities/landmark.md

import { z } from 'zod';
import { hexCoordinateSchema } from './map';

// ============================================================================
// LANDMARK SCHEMA
// ============================================================================
// Einfacher Typ für Overworld-Orte.
// Modelliert Dörfer, Ruinen, Schreine und andere bemerkenswerte Orte.
// Kann optional zu Sub-Maps führen.

export const landmarkSchema = z.object({
  id: z.string().min(1),
  mapId: z.string().min(1),
  position: hexCoordinateSchema,
  name: z.string().min(1),
  icon: z.string().optional(),
  visible: z.boolean(),
  height: z.number().min(0).optional(),
  glowsAtNight: z.boolean().optional(),
  description: z.string().optional(),
  gmNotes: z.string().optional(),
  // Optional: Führt zu Sub-Map
  linkedMapId: z.string().optional(),
  spawnPosition: hexCoordinateSchema.optional(),
});

export type Landmark = z.infer<typeof landmarkSchema>;
