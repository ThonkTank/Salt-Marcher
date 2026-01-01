// Goal-Presets für NPC-Generierung
// Siehe: docs/services/npcs/NPC-Generation.md
//
// Goals definieren, was der NPC aktuell anstrebt.
// Werden per ID in Culture.goals referenziert.
// Alle Felder sind unabhängig - keine Personality-Bonusse.

import { z } from 'zod';

// ============================================================================
// SCHEMA
// ============================================================================

export const goalAttributeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
});

export type GoalAttribute = z.infer<typeof goalAttributeSchema>;

// ============================================================================
// PRESET-DATEN
// ============================================================================

export const goalPresets: GoalAttribute[] = [
  // ──────────────────────────────────────────────────────────────────────────
  // Grundlegende Ziele
  // ──────────────────────────────────────────────────────────────────────────
  { id: 'survive', name: 'Überleben', description: 'Am Leben bleiben um jeden Preis' },
  { id: 'profit', name: 'Profit machen', description: 'Reichtum anhäufen' },
  { id: 'power', name: 'Macht erlangen', description: 'Einfluss und Kontrolle gewinnen' },
  { id: 'freedom', name: 'Freiheit bewahren', description: 'Unabhängigkeit verteidigen' },
  { id: 'revenge', name: 'Rache nehmen', description: 'Vergeltung für erlittenes Unrecht' },

  // ──────────────────────────────────────────────────────────────────────────
  // Soziale Ziele
  // ──────────────────────────────────────────────────────────────────────────
  { id: 'find_love', name: 'Wahre Liebe finden', description: 'Einen Seelenverwandten finden' },
  { id: 'protect_family', name: 'Familie schützen', description: 'Die eigenen Angehörigen beschützen' },
  { id: 'gain_respect', name: 'Respekt erlangen', description: 'Anerkennung von anderen gewinnen' },
  { id: 'prove_worth', name: 'Wert beweisen', description: 'Den eigenen Wert durch Taten zeigen' },
  { id: 'please_boss', name: 'Boss zufriedenstellen', description: 'Bestrafung vermeiden, Belohnung bekommen' },

  // ──────────────────────────────────────────────────────────────────────────
  // Materielle Ziele
  // ──────────────────────────────────────────────────────────────────────────
  { id: 'good_deal', name: 'Guten Handel abschließen', description: 'Profitables Geschäft machen' },
  { id: 'loot', name: 'Beute machen', description: 'Wertvolles an sich nehmen' },
  { id: 'hoard_treasure', name: 'Schätze horten', description: 'Gold und Kostbarkeiten sammeln' },
  { id: 'find_food', name: 'Nahrung finden', description: 'Essen für sich oder die Gruppe beschaffen' },

  // ──────────────────────────────────────────────────────────────────────────
  // Territoriale Ziele
  // ──────────────────────────────────────────────────────────────────────────
  { id: 'protect_territory', name: 'Territorium verteidigen', description: 'Das eigene Gebiet schützen' },
  { id: 'expand_territory', name: 'Territorium erweitern', description: 'Mehr Land beanspruchen' },
  { id: 'protect_lair', name: 'Unterschlupf sichern', description: 'Das eigene Lager verteidigen' },
  { id: 'guard_location', name: 'Ort bewachen', description: 'Einen bestimmten Ort schützen' },

  // ──────────────────────────────────────────────────────────────────────────
  // Hierarchie/Status
  // ──────────────────────────────────────────────────────────────────────────
  { id: 'rise_in_rank', name: 'Im Rang aufsteigen', description: 'Höhere Position erreichen' },
  { id: 'follow_orders', name: 'Befehle ausführen', description: 'Gehorsam gegenüber Vorgesetzten' },
  { id: 'conquer', name: 'Erobern', description: 'Gebiete oder Gruppen unterwerfen' },
  { id: 'dominate', name: 'Dominieren', description: 'Über andere herrschen' },

  // ──────────────────────────────────────────────────────────────────────────
  // Jagd/Raubtier
  // ──────────────────────────────────────────────────────────────────────────
  { id: 'hunt', name: 'Jagen', description: 'Beute erlegen' },
  { id: 'protect_pack', name: 'Rudel schützen', description: 'Die eigene Gruppe verteidigen' },
  { id: 'feed_young', name: 'Junge füttern', description: 'Nachwuchs versorgen' },

  // ──────────────────────────────────────────────────────────────────────────
  // Untote/Gebundene
  // ──────────────────────────────────────────────────────────────────────────
  { id: 'serve_master', name: 'Meister dienen', description: 'Befehle des Erschaffers erfüllen' },
  { id: 'destroy_living', name: 'Lebende vernichten', description: 'Alles Lebende aus Hass zerstören' },
  { id: 'consume_living', name: 'Lebende verzehren', description: 'Lebensenergie oder Fleisch konsumieren' },
  { id: 'find_rest', name: 'Ruhe finden', description: 'Endlich Frieden und ewige Ruhe' },
  { id: 'patrol', name: 'Patrouillieren', description: 'Gebiet überwachen' },

  // ──────────────────────────────────────────────────────────────────────────
  // Netzwerk/Einfluss
  // ──────────────────────────────────────────────────────────────────────────
  { id: 'expand_influence', name: 'Einfluss erweitern', description: 'Macht und Reichweite ausbauen' },
  { id: 'maintain_network', name: 'Netzwerk pflegen', description: 'Kontakte aufrechterhalten' },
  { id: 'expand_network', name: 'Netzwerk erweitern', description: 'Neue Verbindungen aufbauen' },
  { id: 'avoid_guards', name: 'Wachen vermeiden', description: 'Autoritäten aus dem Weg gehen' },

  // ──────────────────────────────────────────────────────────────────────────
  // Persönliche Entwicklung
  // ──────────────────────────────────────────────────────────────────────────
  { id: 'find_meaning', name: 'Sinn finden', description: 'Tieferen Lebenssinn entdecken' },
  { id: 'acquire_knowledge', name: 'Wissen sammeln', description: 'Geheimnisse und Wissen anhäufen' },
  { id: 'crush_weakness', name: 'Schwäche vernichten', description: 'Eigene und fremde Schwächen eliminieren' },

  // ──────────────────────────────────────────────────────────────────────────
  // Dunkle Ziele
  // ──────────────────────────────────────────────────────────────────────────
  { id: 'corrupt_souls', name: 'Seelen verderben', description: 'Andere ins Verderben führen' },
  { id: 'spread_chaos', name: 'Chaos verbreiten', description: 'Unruhe und Zerstörung säen' },
  { id: 'fulfill_contract', name: 'Vertrag erfüllen', description: 'Einen dunklen Pakt einhalten' },

  // ──────────────────────────────────────────────────────────────────────────
  // Goblinoid-spezifisch
  // ──────────────────────────────────────────────────────────────────────────
  { id: 'avoid_work', name: 'Arbeit vermeiden', description: 'Jede Anstrengung umgehen' },
  { id: 'get_food', name: 'Essen beschaffen', description: 'Nahrung für sich finden' },
];

export default goalPresets;
