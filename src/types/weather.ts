// Ziel: Faktorbasiertes Weather-System mit Event-Matching
// Siehe: docs/services/Weather.md
//
// Konzept:
//   1. WeatherFactors: Fundamentale Wetter-Parameter (temperature, humidity, etc.)
//   2. WeatherEvent: Entity mit Preconditions und Gameplay-Effekten
//   3. Weather: Kombination aus Faktoren + gematchtem Event

import { z } from 'zod';

// ============================================================================
// WEATHER FACTORS (generierte Werte)
// ============================================================================

/**
 * Fundamentale Wetter-Parameter.
 * Werden aus Terrain-Ranges + Modifiern (Season, Time, Elevation) generiert.
 */
export interface WeatherFactors {
  /** Temperatur in °C (-40 bis +50) */
  temperature: number;
  /** Luftfeuchtigkeit in % (0-100) */
  humidity: number;
  /** Windgeschwindigkeit in km/h (0-120) */
  wind: number;
  /** Luftdruck (-1 bis +1, Tiefdruck bis Hochdruck) */
  pressure: number;
  /** Bewölkung (0-1, klar bis bedeckt) */
  cloudCover: number;
}

export const weatherFactorsSchema = z.object({
  temperature: z.number().min(-50).max(60),
  humidity: z.number().min(0).max(100),
  wind: z.number().min(0).max(150),
  pressure: z.number().min(-1).max(1),
  cloudCover: z.number().min(0).max(1),
});

// ============================================================================
// WEATHER EVENT (Vault-persistiert)
// ============================================================================

/**
 * Range-Bedingung für einen Faktor.
 * Mindestens min oder max muss gesetzt sein.
 */
export const factorRangeSchema = z.object({
  min: z.number().optional(),
  max: z.number().optional(),
});
export type FactorRange = z.infer<typeof factorRangeSchema>;

/**
 * Preconditions für ein Weather-Event.
 * Nur gesetzte Felder werden geprüft.
 */
export const weatherPreconditionsSchema = z.object({
  temperature: factorRangeSchema.optional(),
  humidity: factorRangeSchema.optional(),
  wind: factorRangeSchema.optional(),
  pressure: factorRangeSchema.optional(),
  cloudCover: factorRangeSchema.optional(),
  /** Terrain-IDs in denen dieses Event auftreten kann (leer = alle) */
  terrains: z.array(z.string()).optional(),
});
export type WeatherPreconditions = z.infer<typeof weatherPreconditionsSchema>;

/**
 * Gameplay-Effekte eines Weather-Events.
 */
export const weatherEffectsSchema = z.object({
  /** Sichtweiten-Modifikator (0.1 = 10%, 1.0 = 100%) */
  visibilityModifier: z.number().min(0.1).max(1),
  /** Reisegeschwindigkeits-Modifikator */
  travelSpeedModifier: z.number().min(0.1).max(1).default(1),
  /** Passive Perception Modifikator (negativ = Malus) */
  perceptionModifier: z.number().optional(),
  /** Fernkampf-Modifikator (negativ = Malus) */
  rangedAttackModifier: z.number().optional(),
  /** Erschöpfungs-Risiko bei längerer Exposition */
  exhaustionRisk: z.boolean().optional(),
});
export type WeatherEffects = z.infer<typeof weatherEffectsSchema>;

/**
 * Weather-Event Entity.
 * Vault-persistiert, wird über Preconditions gematcht.
 * Priorität wird dynamisch aus Precondition-Spezifität berechnet.
 */
export const weatherEventSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  /** Bedingungen unter denen dieses Event eintritt */
  preconditions: weatherPreconditionsSchema,
  /** Gameplay-Effekte */
  effects: weatherEffectsSchema,
  /** Beschreibung für GM/Spieler */
  description: z.string(),
  /** Tags für Filterung/Gruppierung */
  tags: z.array(z.string()),
});
export type WeatherEvent = z.infer<typeof weatherEventSchema>;

// ============================================================================
// WEATHER (Runtime-Objekt)
// ============================================================================

/**
 * Vollständiges Weather-Objekt.
 * Kombination aus generierten Faktoren und gematchtem Event.
 */
export interface Weather {
  /** Generierte Wetter-Faktoren */
  factors: WeatherFactors;
  /** Gematchtes Weather-Event */
  event: WeatherEvent;
  /** Convenience: Sichtweiten-Modifikator aus Event */
  visibilityModifier: number;
  /** Convenience: Reisegeschwindigkeits-Modifikator aus Event */
  travelSpeedModifier: number;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Prüft ob ein Wert innerhalb einer FactorRange liegt.
 */
export function isInRange(value: number, range: FactorRange | undefined): boolean {
  if (!range) return true;
  if (range.min !== undefined && value < range.min) return false;
  if (range.max !== undefined && value > range.max) return false;
  return true;
}

/**
 * Prüft ob alle Preconditions eines Events erfüllt sind.
 */
export function checkPreconditions(
  preconditions: WeatherPreconditions,
  factors: WeatherFactors,
  terrainId?: string
): boolean {
  // Faktor-Ranges prüfen
  if (!isInRange(factors.temperature, preconditions.temperature)) return false;
  if (!isInRange(factors.humidity, preconditions.humidity)) return false;
  if (!isInRange(factors.wind, preconditions.wind)) return false;
  if (!isInRange(factors.pressure, preconditions.pressure)) return false;
  if (!isInRange(factors.cloudCover, preconditions.cloudCover)) return false;

  // Terrain-Einschränkung prüfen
  if (preconditions.terrains && preconditions.terrains.length > 0) {
    if (!terrainId || !preconditions.terrains.includes(terrainId)) {
      return false;
    }
  }

  return true;
}

// ============================================================================
// SPECIFICITY CALCULATION
// ============================================================================

/** Max-Werte für Faktor-Normalisierung */
const FACTOR_RANGES = {
  temperature: 100,  // -50 bis +50
  humidity: 100,     // 0-100
  wind: 150,         // 0-150
  pressure: 2,       // -1 bis +1
  cloudCover: 1,     // 0-1
} as const;

/**
 * Berechnet die Spezifität einer FactorRange.
 * - Beide min+max gesetzt: 1.0-2.0 (je enger, desto höher)
 * - Nur min oder max: 0.5
 * - Nicht gesetzt: 0
 */
function calculateRangeSpecificity(
  range: FactorRange | undefined,
  factorMax: number
): number {
  if (!range) return 0;

  const hasMin = range.min !== undefined;
  const hasMax = range.max !== undefined;

  if (hasMin && hasMax) {
    // Je enger der Bereich, desto spezifischer
    const rangeSize = range.max! - range.min!;
    const normalized = Math.max(0, Math.min(1, rangeSize / factorMax));
    return 1 + (1 - normalized);  // 1.0 - 2.0
  }

  if (hasMin || hasMax) {
    return 0.5;  // Halb-offene Range
  }

  return 0;
}

/**
 * Berechnet die Gesamt-Spezifität eines Weather-Events.
 * Höhere Werte = spezifischere Preconditions = höhere Priorität.
 */
export function calculateSpecificity(preconditions: WeatherPreconditions): number {
  let specificity = 0;

  // Faktor-Ranges
  specificity += calculateRangeSpecificity(preconditions.temperature, FACTOR_RANGES.temperature);
  specificity += calculateRangeSpecificity(preconditions.humidity, FACTOR_RANGES.humidity);
  specificity += calculateRangeSpecificity(preconditions.wind, FACTOR_RANGES.wind);
  specificity += calculateRangeSpecificity(preconditions.pressure, FACTOR_RANGES.pressure);
  specificity += calculateRangeSpecificity(preconditions.cloudCover, FACTOR_RANGES.cloudCover);

  // Terrain-Einschränkung ist sehr spezifisch
  if (preconditions.terrains && preconditions.terrains.length > 0) {
    specificity += 3;
  }

  return specificity;
}
