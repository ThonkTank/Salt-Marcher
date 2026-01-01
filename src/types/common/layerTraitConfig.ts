// Ziel: Gemeinsame Konfiguration für NPC-Attribute in Culture-Layers
// Siehe: docs/services/npcs/Culture-Resolution.md

import { z } from 'zod';

/**
 * Konfiguration für ein NPC-Attribut innerhalb eines Culture-Layers.
 *
 * - add: IDs die mit vollem Layer-Gewicht hinzugefügt werden
 * - unwanted: IDs deren bisheriger akkumulierter Wert geviertelt wird
 *
 * Verarbeitung in accumulateWithUnwanted():
 * 1. Zuerst unwanted verarbeiten (viertelt bisherigen Wert)
 * 2. Dann add verarbeiten (addiert Layer-Gewicht)
 */
export const layerTraitConfigSchema = z.object({
  /** IDs die dieses Layer zum Pool hinzufügt (volles Layer-Gewicht) */
  add: z.array(z.string()).optional(),
  /** IDs deren bisheriger akkumulierter Wert geviertelt wird */
  unwanted: z.array(z.string()).optional(),
});

export type LayerTraitConfig = z.infer<typeof layerTraitConfigSchema>;
