// Vault-persistierte Species-Entity
// Siehe: docs/types/species.md
//
// Species definiert biologische/physische Merkmale einer Kreaturenart.
// Alle Creatures einer Species teilen diese Merkmale.
//
// Konzept-Trennung:
// - Species: Biologisch/physisch (appearance, size)
// - Culture: Erlernt/sozial (naming, personality, values, speech)
// - Faction: Organisatorisch (influence, goals)

import { z } from 'zod';
import { layerTraitConfigSchema } from '../common/layerTraitConfig';
import { CREATURE_SIZES } from '../../constants/creature';

// ============================================================================
// SPECIES SCHEMA
// ============================================================================

export const speciesSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),

  // Physische Merkmale (von allen Kreaturen dieser Species geteilt)
  // Pool fuer zufaellige Auswahl bei NPC-Generierung
  appearance: layerTraitConfigSchema.optional(),

  // Basis-Groesse (kann von Creature ueberschrieben werden)
  defaultSize: z.enum(CREATURE_SIZES).optional(),

  // Default-Culture fuer diese Species (Fallback bei Culture-Resolution)
  // Referenziert Culture-ID, z.B. 'species:goblin'
  defaultCulture: z.string().optional(),

  // Beschreibung fuer GM-Referenz
  description: z.string().optional(),
});

export type Species = z.infer<typeof speciesSchema>;
export type SpeciesId = Species['id'];
