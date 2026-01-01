// Values-Presets für NPC-Generierung
// Siehe: docs/services/npcs/NPC-Generation.md
//
// Werte definieren, was dem NPC wichtig ist.
// Werden per ID in Culture.values referenziert.

import { z } from 'zod';

// ============================================================================
// SCHEMA
// ============================================================================

export const valueAttributeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
});

export type ValueAttribute = z.infer<typeof valueAttributeSchema>;

// ============================================================================
// PRESET-DATEN
// ============================================================================

export const valuePresets: ValueAttribute[] = [
  // ──────────────────────────────────────────────────────────────────────────
  // Soziale Werte
  // ──────────────────────────────────────────────────────────────────────────
  { id: 'friendship', name: 'Freundschaft', description: 'Tiefe Bindungen zu anderen' },
  { id: 'family', name: 'Familie', description: 'Blutsbande und Verwandtschaft' },
  { id: 'loyalty', name: 'Loyalität', description: 'Treue zu Verbündeten und Gruppe' },
  { id: 'honor', name: 'Ehre', description: 'Persönliche und familiäre Ehre' },
  { id: 'respect', name: 'Respekt', description: 'Anerkennung von anderen' },
  { id: 'tradition', name: 'Tradition', description: 'Bewahrung alter Bräuche' },

  // ──────────────────────────────────────────────────────────────────────────
  // Materielle Werte
  // ──────────────────────────────────────────────────────────────────────────
  { id: 'wealth', name: 'Reichtum', description: 'Gold, Schätze, materielle Güter' },
  { id: 'power', name: 'Macht', description: 'Einfluss und Kontrolle über andere' },
  { id: 'territory', name: 'Territorium', description: 'Land und Besitz' },
  { id: 'comfort', name: 'Komfort', description: 'Annehmlichkeiten und Luxus' },

  // ──────────────────────────────────────────────────────────────────────────
  // Persönliche Werte
  // ──────────────────────────────────────────────────────────────────────────
  { id: 'freedom', name: 'Freiheit', description: 'Unabhängigkeit und Selbstbestimmung' },
  { id: 'survival', name: 'Überleben', description: 'Am Leben bleiben über allem' },
  { id: 'strength', name: 'Stärke', description: 'Physische oder mentale Stärke' },
  { id: 'knowledge', name: 'Wissen', description: 'Lernen und Verstehen' },
  { id: 'pleasure', name: 'Vergnügen', description: 'Genuss und Unterhaltung' },
  { id: 'peace', name: 'Frieden', description: 'Ruhe und Harmonie' },

  // ──────────────────────────────────────────────────────────────────────────
  // Moralische Werte
  // ──────────────────────────────────────────────────────────────────────────
  { id: 'honesty', name: 'Ehrlichkeit', description: 'Wahrheit und Aufrichtigkeit' },
  { id: 'justice', name: 'Gerechtigkeit', description: 'Fairness und Ausgleich' },
  { id: 'mercy', name: 'Barmherzigkeit', description: 'Gnade gegenüber anderen' },
  { id: 'order', name: 'Ordnung', description: 'Struktur und Regeln' },
  { id: 'chaos', name: 'Chaos', description: 'Veränderung und Unberechenbarkeit' },

  // ──────────────────────────────────────────────────────────────────────────
  // Spirituelle/Abstrakte Werte
  // ──────────────────────────────────────────────────────────────────────────
  { id: 'faith', name: 'Glaube', description: 'Religiöse oder spirituelle Überzeugung' },
  { id: 'nature', name: 'Natur', description: 'Verbundenheit mit der natürlichen Welt' },
  { id: 'art', name: 'Kunst', description: 'Schönheit und kreativer Ausdruck' },
  { id: 'legacy', name: 'Vermächtnis', description: 'Hinterlassen eines Erbes' },

  // ──────────────────────────────────────────────────────────────────────────
  // Negative/Dunkle Werte
  // ──────────────────────────────────────────────────────────────────────────
  { id: 'revenge', name: 'Rache', description: 'Vergeltung für erlittenes Unrecht' },
  { id: 'domination', name: 'Dominanz', description: 'Unterwerfung anderer' },
  { id: 'destruction', name: 'Zerstörung', description: 'Vernichtung und Chaos' },
  { id: 'cruelty', name: 'Grausamkeit', description: 'Freude am Leid anderer' },
];

export default valuePresets;
