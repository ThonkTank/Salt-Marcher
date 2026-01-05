// Ziel: Clamp-Utility für Wertebereich-Begrenzung
// Siehe: docs/architecture/constants.md

/**
 * Begrenzt einen Wert auf den Bereich [min, max].
 *
 * @example
 * clamp(0.5, 0, 1)   // → 0.5
 * clamp(-0.5, 0, 1)  // → 0
 * clamp(1.5, 0, 1)   // → 1
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Begrenzt einen Wert auf den Bereich [0, 1].
 * Alias für clamp(value, 0, 1).
 */
export function clamp01(value: number): number {
  return clamp(value, 0, 1);
}
