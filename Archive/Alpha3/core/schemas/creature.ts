/**
 * Creature Schema
 * Minimales Schema für Encounter-Generation, erweiterbar für Combat
 *
 * @module core/schemas/creature
 */

import { z } from 'zod';

// ═══════════════════════════════════════════════════════════════
// Creature Data Schema
// ═══════════════════════════════════════════════════════════════

/**
 * Minimales Creature Schema für Encounter-Generation
 * Struktur ist erweiterbar für spätere Combat-Features
 */
export const CreatureDataSchema = z.object({
  // ─────────────────────────────────────────────────────────────
  // Identity
  // ─────────────────────────────────────────────────────────────
  name: z.string(),
  size: z.string().optional(),
  type: z.string().optional(),
  typeTags: z.array(z.string()).optional(),
  alignmentLawChaos: z.string().optional(),
  alignmentGoodEvil: z.string().optional(),

  // ─────────────────────────────────────────────────────────────
  // Combat Basics
  // ─────────────────────────────────────────────────────────────
  ac: z.string().optional(),
  hp: z.string().optional(),
  hitDice: z.string().optional(),
  initiative: z.string().optional(),
  cr: z.string().optional(),
  xp: z.string().optional(),

  // ─────────────────────────────────────────────────────────────
  // Habitat Preferences (für Encounter-Generation)
  // ─────────────────────────────────────────────────────────────
  terrainPreference: z.array(z.string()).optional(),
  // Später erweiterbar:
  // floraPreference: z.array(z.string()).optional(),
  // moisturePreference: z.array(z.string()).optional(),
  // temperaturePreference: z.array(z.string()).optional(),
  // elevationRange: z.object({ min: z.number(), max: z.number() }).optional(),
});

export type CreatureData = z.infer<typeof CreatureDataSchema>;

// ═══════════════════════════════════════════════════════════════
// Validation Helper
// ═══════════════════════════════════════════════════════════════

/**
 * Validiert und parst Creature-Daten aus Frontmatter
 * @returns Validated CreatureData or null if invalid
 */
export function parseCreatureData(data: unknown): CreatureData | null {
  const result = CreatureDataSchema.safeParse(data);
  if (result.success) {
    return result.data;
  }
  console.warn('[CreatureSchema] Validation failed:', result.error.format());
  return null;
}

// ═══════════════════════════════════════════════════════════════
// CR Utilities
// ═══════════════════════════════════════════════════════════════

/**
 * Konvertiert CR-String zu numerischem Wert
 * Unterstützt Brüche wie "1/4", "1/2", "1/8"
 */
export function parseCR(cr: string | undefined): number {
  if (!cr) return 0;

  const trimmed = cr.trim();

  // Brüche
  if (trimmed === '1/8') return 0.125;
  if (trimmed === '1/4') return 0.25;
  if (trimmed === '1/2') return 0.5;

  // Generische Brüche
  const fractionMatch = trimmed.match(/^(\d+)\/(\d+)$/);
  if (fractionMatch) {
    return parseInt(fractionMatch[1]) / parseInt(fractionMatch[2]);
  }

  // Integer
  const parsed = parseFloat(trimmed);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Prüft ob ein CR-Wert in einem Bereich liegt
 */
export function isCRInRange(
  cr: string | undefined,
  minCR: number,
  maxCR: number
): boolean {
  const numericCR = parseCR(cr);
  return numericCR >= minCR && numericCR <= maxCR;
}
