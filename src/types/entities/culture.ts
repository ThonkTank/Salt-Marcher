// Vault-persistierte Culture-Entity
// Siehe: docs/types/culture.md
//
// Culture ist von Creature und Faction entkoppelt:
// - Physische Attribute → Creature.appearance
// - Kulturelle Marker → Culture.styling
// - Persönlichkeit → Culture (personality, values, quirks, goals)
// - Fraktions-Einfluss → Faction.influence (erweitert Pools, überschreibt nicht)

import { z } from 'zod';
import { layerTraitConfigSchema } from '../common/layerTraitConfig';
import { namingConfigSchema, speechConfigSchema } from './faction';

// ============================================================================
// CULTURE SCHEMA
// ============================================================================

export const cultureSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),

  // Kultur-Hierarchie (wie Faction)
  parentId: z.string().optional(),

  // Species-Kompatibilität für Culture-Selection
  usualSpecies: z.array(z.string()).optional(),
  tolerance: z.number().min(0).max(1).default(0.3),

  // Kulturelle Marker (Kleidung, Schmuck, Tattoos)
  styling: layerTraitConfigSchema.optional(),

  // NPC-Attribute (LayerTraitConfig: add[] + unwanted[])
  personality: layerTraitConfigSchema.optional(),
  values: layerTraitConfigSchema.optional(),
  quirks: layerTraitConfigSchema.optional(),
  goals: layerTraitConfigSchema.optional(),

  // Naming
  naming: namingConfigSchema.optional(),

  // Speech (RP-Hinweise)
  speech: speechConfigSchema.optional(),

  // Aktivitäten (für Encounter)
  activities: z.array(z.string()).optional(),

  // Beschreibung
  description: z.string().optional(),
});

export type Culture = z.infer<typeof cultureSchema>;
export type CultureId = Culture['id'];
