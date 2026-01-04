// Species-Presets fuer CLI-Testing und Plugin-Bundling
// Siehe: docs/types/species.md
//
// Species definiert biologische/physische Merkmale.
// Appearance-Daten werden von Creatures dieser Species geerbt.

import { z } from 'zod';
import { speciesSchema, type Species } from '../../src/types/entities/species';

// ============================================================================
// SPECIES-PRESETS
// ============================================================================

export const speciesPresets: Species[] = z.array(speciesSchema).parse([
  // ──────────────────────────────────────────────────────────────────────────
  // Goblin - Kleine, grueene, scharfzaehnige Kreaturen
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'goblin',
    name: 'Goblin',
    appearance: {
      add: ['sharp_teeth', 'missing_teeth', 'yellow_eyes', 'crooked_nose', 'missing_ear'],
    },
    defaultSize: 'small',
    defaultCulture: 'species:goblin',
    description: 'Kleine, hinterlistige Humanoide mit gruener Haut und spitzen Ohren.',
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Hobgoblin - Groessere, militaerisch organisierte Goblinoide
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'hobgoblin',
    name: 'Hobgoblin',
    appearance: {
      add: ['scarred_face', 'muscular', 'sharp_teeth', 'yellow_eyes'],
    },
    defaultSize: 'medium',
    defaultCulture: 'species:hobgoblin',
    description: 'Disziplinierte, militaerisch organisierte Goblinoide.',
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Human - Vielseitige, anpassungsfaehige Humanoide
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'human',
    name: 'Human',
    appearance: {
      add: ['scarred_face', 'weathered_skin', 'long_hair', 'bald', 'muscular'],
    },
    defaultSize: 'medium',
    defaultCulture: 'species:human',
    description: 'Vielseitige Humanoide mit grosser kultureller Diversitaet.',
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Wolf - Rudeltiere mit scharfen Sinnen
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'wolf',
    name: 'Wolf',
    appearance: {
      add: ['matted_fur', 'patchy_fur', 'scarred_body', 'long_claws', 'missing_eye'],
    },
    defaultSize: 'medium',
    description: 'Intelligente Rudeltiere mit ausgezeichnetem Geruchssinn.',
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Owlbear - Baer-Eulen-Hybride
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'owlbear',
    name: 'Owlbear',
    appearance: {
      add: ['long_claws', 'sharp_teeth', 'matted_fur', 'glowing_eyes', 'scarred_body'],
    },
    defaultSize: 'large',
    description: 'Magisch erschaffene Kreaturen mit Baerenkraft und Eulensinnen.',
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Skeleton - Untote Knochengerüste
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'skeleton',
    name: 'Skeleton',
    appearance: {
      add: ['skeletal', 'rotting', 'glowing_eyes', 'missing_limb', 'milky_eyes'],
    },
    defaultSize: 'medium',
    defaultCulture: 'species:skeleton',
    description: 'Untote Knochengerueste, oft durch Nekromantie animiert.',
  },
]);

// Default-Export fuer CLI-Generator
export default speciesPresets;
