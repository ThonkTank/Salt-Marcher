// Trait-Presets für NPC-Generierung
// Siehe: docs/types/culture.md
//
// Traits werden zentral definiert und in CultureData per ID referenziert.
// Alle Traits sind immer im Pool verfügbar:
// - In culture.traits gelistet  → 5x Gewicht (bevorzugt)
// - Neutral (nicht gelistet)    → 1x Gewicht
// - In culture.forbidden        → 0.2x Gewicht (benachteiligt)

import { z } from 'zod';
import { traitSchema } from '../../src/types/entities/trait';

// ============================================================================
// PRESET-SCHEMA
// ============================================================================

export const traitPresetSchema = traitSchema;
export const traitPresetsSchema = z.array(traitPresetSchema);

// ============================================================================
// TRAIT-PRESETS
// ============================================================================

export const traitPresets = traitPresetsSchema.parse([
  // ──────────────────────────────────────────────────────────────────────────
  // Allgemein - Für alle Creature-Types anwendbar
  // ──────────────────────────────────────────────────────────────────────────
  { id: 'cautious', name: 'Vorsichtig', description: 'Handelt bedacht, meidet Risiken' },
  { id: 'curious', name: 'Neugierig', description: 'Interessiert sich für Unbekanntes' },
  { id: 'practical', name: 'Praktisch', description: 'Fokussiert auf das Wesentliche' },
  { id: 'suspicious', name: 'Misstrauisch', description: 'Vertraut nicht leicht' },
  { id: 'greedy', name: 'Gierig', description: 'Will immer mehr haben' },
  { id: 'heroic', name: 'Heldenhaft', description: 'Stellt sich Gefahren für andere' },
  { id: 'cruel', name: 'Grausam', description: 'Genießt das Leid anderer' },
  { id: 'generous', name: 'Großzügig', description: 'Teilt bereitwillig mit anderen' },
  { id: 'brave', name: 'Mutig', description: 'Stellt sich Gefahren ohne Zögern' },
  { id: 'loyal', name: 'Loyal', description: 'Steht zu den Seinen' },
  { id: 'patient', name: 'Geduldig', description: 'Wartet auf den richtigen Moment' },
  { id: 'honorable', name: 'Ehrenhaft', description: 'Hält Wort und folgt einem Kodex' },

  // ──────────────────────────────────────────────────────────────────────────
  // Beast/Predator - Tierische und räuberische Instinkte
  // ──────────────────────────────────────────────────────────────────────────
  { id: 'territorial', name: 'Territorial', description: 'Verteidigt sein Gebiet aggressiv' },
  { id: 'hungry', name: 'Hungrig', description: 'Ständig auf Nahrungssuche' },
  { id: 'aggressive', name: 'Aggressiv', description: 'Schnell zum Angriff bereit' },
  { id: 'predatory', name: 'Räuberisch', description: 'Sieht andere als Beute' },
  { id: 'playful', name: 'Verspielt', description: 'Spielt mit Beute oder Objekten' },

  // ──────────────────────────────────────────────────────────────────────────
  // Undead - Untote Wesenszüge
  // ──────────────────────────────────────────────────────────────────────────
  { id: 'mindless', name: 'Geistlos', description: 'Handelt ohne eigenen Willen' },
  { id: 'relentless', name: 'Unerbittlich', description: 'Gibt niemals auf' },
  { id: 'hateful', name: 'Hasserfüllt', description: 'Voller Hass auf alles Lebende' },
  { id: 'bound', name: 'Gebunden', description: 'An einen Ort oder Meister gefesselt' },
  { id: 'sorrowful', name: 'Traurig', description: 'Trauert um verlorenes Leben' },
  { id: 'vengeful', name: 'Rachsüchtig', description: 'Sucht Vergeltung für erlittenes Unrecht' },

  // ──────────────────────────────────────────────────────────────────────────
  // Goblinoid/Cunning - List und Feigheit
  // ──────────────────────────────────────────────────────────────────────────
  { id: 'cunning', name: 'Listig', description: 'Schlau und hinterhältig' },
  { id: 'cowardly', name: 'Feige', description: 'Flieht vor direkter Konfrontation' },

  // ──────────────────────────────────────────────────────────────────────────
  // Dragon/Fiend - Drachen und Dämonen
  // ──────────────────────────────────────────────────────────────────────────
  { id: 'arrogant', name: 'Arrogant', description: 'Hält sich für überlegen' },
  { id: 'manipulative', name: 'Manipulativ', description: 'Beeinflusst andere für eigene Zwecke' },
  { id: 'deceitful', name: 'Hinterlistig', description: 'Lügt und täuscht ohne Skrupel' },
  { id: 'merciful', name: 'Barmherzig', description: 'Zeigt Gnade gegenüber Schwächeren' },

  // ──────────────────────────────────────────────────────────────────────────
  // Social - Soziale Eigenschaften
  // ──────────────────────────────────────────────────────────────────────────
  { id: 'opportunistic', name: 'Opportunistisch', description: 'Nutzt jede Gelegenheit aus' },
  { id: 'naive', name: 'Naiv', description: 'Glaubt leicht, was man ihm sagt' },
  { id: 'trusting', name: 'Vertrauensselig', description: 'Vertraut Fremden zu schnell' },

  // ──────────────────────────────────────────────────────────────────────────
  // Species-spezifisch - Aus Species-Presets
  // ──────────────────────────────────────────────────────────────────────────
  { id: 'nervous', name: 'Nervös', description: 'Ständig angespannt und unruhig' },
  { id: 'clever', name: 'Schlau', description: 'Findet kreative Lösungen' },
  { id: 'disciplined', name: 'Diszipliniert', description: 'Folgt Regeln und Ordnung strikt' },
  { id: 'ruthless', name: 'Rücksichtslos', description: 'Kennt keine Gnade' },
  { id: 'tactical', name: 'Taktisch', description: 'Plant jeden Schritt voraus' },
  { id: 'proud', name: 'Stolz', description: 'Schätzt die eigene Ehre hoch' },
  { id: 'ambitious', name: 'Ehrgeizig', description: 'Strebt nach Höherem' },
  { id: 'obedient', name: 'Gehorsam', description: 'Folgt Befehlen ohne Fragen' },
  { id: 'tireless', name: 'Unermüdlich', description: 'Kennt keine Erschöpfung' },
  { id: 'echo_of_life', name: 'Lebensecho', description: 'Spur des früheren Selbst' },
  { id: 'idealistic', name: 'Idealistisch', description: 'Glaubt an höhere Ideale' },
]);

export default traitPresets;
