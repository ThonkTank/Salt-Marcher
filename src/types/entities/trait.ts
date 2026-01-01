// Vault-persistierte Trait-Definition
// Siehe: docs/entities/culture-data.md
//
// Traits werden zentral definiert und in CultureData per ID referenziert.
// Alle Traits sind immer im Pool verfügbar:
// - In culture.traits gelistet  → 5x Gewicht (bevorzugt)
// - Neutral (nicht gelistet)    → 1x Gewicht
// - In culture.forbidden        → 0.2x Gewicht (benachteiligt)

import { z } from 'zod';

// ============================================================================
// TRAIT SCHEMA
// ============================================================================

export const traitSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
});

export type Trait = z.infer<typeof traitSchema>;
