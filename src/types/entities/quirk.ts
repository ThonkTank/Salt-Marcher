// Ziel: Vault-persistierte Quirk-Definition
// Siehe: docs/services/npcs/NPC-Generation.md#Quirk-Generierung
//
// Quirks sind NPC-Eigenheiten, die aus dem globalen Pool ausgewählt werden.
// Culture referenziert Quirks nur per ID (keine Gewichtung).
// compatibleTags filtert nach Creature-Kompatibilität (Task #55).

import { z } from 'zod';

/**
 * Quirk-Schema für NPC-Eigenheiten.
 *
 * - id: Eindeutiger Identifier (z.B. 'nervous_laugh')
 * - name: Anzeigename (z.B. 'Nervöses Lachen')
 * - description: Beschreibung für GM (z.B. 'Kichert nervös in Stresssituationen')
 * - compatibleTags: Creature-Tags für Kompatibilitätsfilter (leer = alle)
 */
export const quirkSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  compatibleTags: z.array(z.string()).optional(),
});

export type Quirk = z.infer<typeof quirkSchema>;
