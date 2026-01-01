// Appearance-Presets für NPC-Generierung
// Siehe: docs/services/npcs/NPC-Generation.md
//
// Aussehen-Merkmale werden per ID in Culture.appearance referenziert.
// compatibleTags filtert nach Creature-Kompatibilität (leer = alle).

import { z } from 'zod';

// ============================================================================
// SCHEMA
// ============================================================================

export const appearanceAttributeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  compatibleTags: z.array(z.string()).optional(),
});

export type AppearanceAttribute = z.infer<typeof appearanceAttributeSchema>;

// ============================================================================
// PRESET-DATEN
// ============================================================================

export const appearancePresets: AppearanceAttribute[] = [
  // ──────────────────────────────────────────────────────────────────────────
  // Haare/Fell
  // ──────────────────────────────────────────────────────────────────────────
  { id: 'red_hair', name: 'Rote Haare', compatibleTags: ['humanoid'] },
  { id: 'black_hair', name: 'Schwarze Haare', compatibleTags: ['humanoid'] },
  { id: 'white_hair', name: 'Weiße Haare', compatibleTags: ['humanoid'] },
  { id: 'bald', name: 'Kahlköpfig', compatibleTags: ['humanoid'] },
  { id: 'long_hair', name: 'Lange Haare', compatibleTags: ['humanoid'] },
  { id: 'braided_hair', name: 'Geflochtene Haare', compatibleTags: ['humanoid'] },
  { id: 'matted_fur', name: 'Verfilztes Fell', compatibleTags: ['beast', 'monstrosity'] },
  { id: 'patchy_fur', name: 'Lückenhaftes Fell', compatibleTags: ['beast', 'monstrosity'] },

  // ──────────────────────────────────────────────────────────────────────────
  // Gesicht/Kopf
  // ──────────────────────────────────────────────────────────────────────────
  { id: 'scarred_face', name: 'Vernarbtes Gesicht', compatibleTags: ['humanoid'] },
  { id: 'missing_eye', name: 'Fehlendes Auge' },
  { id: 'missing_ear', name: 'Fehlendes Ohr' },
  { id: 'crooked_nose', name: 'Schiefe Nase', compatibleTags: ['humanoid'] },
  { id: 'sharp_teeth', name: 'Spitze Zähne' },
  { id: 'missing_teeth', name: 'Fehlende Zähne' },
  { id: 'gold_tooth', name: 'Goldzahn', compatibleTags: ['humanoid'] },
  { id: 'tattoo_face', name: 'Gesichtstätowierung', compatibleTags: ['humanoid'] },
  { id: 'pierced', name: 'Piercings', compatibleTags: ['humanoid'] },
  { id: 'thick_eyebrows', name: 'Buschige Augenbrauen', compatibleTags: ['humanoid'] },
  { id: 'no_eyebrows', name: 'Keine Augenbrauen', compatibleTags: ['humanoid'] },

  // ──────────────────────────────────────────────────────────────────────────
  // Körperbau
  // ──────────────────────────────────────────────────────────────────────────
  { id: 'tall', name: 'Überdurchschnittlich groß' },
  { id: 'short', name: 'Unterdurchschnittlich klein' },
  { id: 'muscular', name: 'Muskulös' },
  { id: 'thin', name: 'Dünn/Hager' },
  { id: 'stout', name: 'Gedrungen/Kräftig' },
  { id: 'hunched', name: 'Bucklig/Gebückt' },
  { id: 'limps', name: 'Hinkt' },
  { id: 'missing_limb', name: 'Fehlende Gliedmaße' },
  { id: 'extra_fingers', name: 'Zusätzliche Finger', compatibleTags: ['humanoid'] },

  // ──────────────────────────────────────────────────────────────────────────
  // Haut/Oberfläche
  // ──────────────────────────────────────────────────────────────────────────
  { id: 'pale_skin', name: 'Blasse Haut', compatibleTags: ['humanoid'] },
  { id: 'weathered_skin', name: 'Wettergegerbte Haut', compatibleTags: ['humanoid'] },
  { id: 'scarred_body', name: 'Vernarbter Körper' },
  { id: 'tattoos', name: 'Tätowierungen', compatibleTags: ['humanoid'] },
  { id: 'brands', name: 'Brandzeichen' },
  { id: 'unusual_skin_color', name: 'Ungewöhnliche Hautfarbe' },
  { id: 'scaly_patches', name: 'Schuppige Stellen' },
  { id: 'rotting', name: 'Verrottend', compatibleTags: ['undead'] },
  { id: 'skeletal', name: 'Skelettartig', compatibleTags: ['undead'] },

  // ──────────────────────────────────────────────────────────────────────────
  // Augen
  // ──────────────────────────────────────────────────────────────────────────
  { id: 'heterochromia', name: 'Verschiedenfarbige Augen' },
  { id: 'blind_eye', name: 'Blindes Auge' },
  { id: 'glowing_eyes', name: 'Leuchtende Augen' },
  { id: 'red_eyes', name: 'Rote Augen' },
  { id: 'yellow_eyes', name: 'Gelbe Augen' },
  { id: 'milky_eyes', name: 'Milchige Augen' },

  // ──────────────────────────────────────────────────────────────────────────
  // Besondere Merkmale
  // ──────────────────────────────────────────────────────────────────────────
  { id: 'curved_horns', name: 'Gebogene Hörner', compatibleTags: ['fiend', 'monstrosity'] },
  { id: 'broken_horn', name: 'Gebrochenes Horn', compatibleTags: ['fiend', 'monstrosity'] },
  { id: 'long_claws', name: 'Lange Krallen' },
  { id: 'filed_claws', name: 'Gefeilte Krallen' },
  { id: 'forked_tongue', name: 'Gespaltene Zunge' },
  { id: 'unusual_smell', name: 'Ungewöhnlicher Geruch' },
  { id: 'raspy_voice', name: 'Kratzige Stimme', compatibleTags: ['humanoid'] },
  { id: 'booming_voice', name: 'Dröhnende Stimme', compatibleTags: ['humanoid'] },

  // ──────────────────────────────────────────────────────────────────────────
  // Kleidung/Ausrüstung (als permanentes Merkmal)
  // ──────────────────────────────────────────────────────────────────────────
  { id: 'hooded', name: 'Immer mit Kapuze', compatibleTags: ['humanoid'] },
  { id: 'heavily_armored', name: 'Schwer gepanzert', compatibleTags: ['humanoid'] },
  { id: 'ragged_clothes', name: 'Zerlumpte Kleidung', compatibleTags: ['humanoid'] },
  { id: 'ornate_jewelry', name: 'Auffälliger Schmuck', compatibleTags: ['humanoid'] },
  { id: 'war_paint', name: 'Kriegsbemalung', compatibleTags: ['humanoid'] },
  { id: 'trophy_necklace', name: 'Trophäenkette' },
];

export default appearancePresets;
