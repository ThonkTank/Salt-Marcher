/**
 * Brush Math Utilities
 *
 * Provides falloff curves and value application for brush tools.
 * Used only within the Cartographer workmode.
 */

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

/**
 * Falloff curve type
 */
export type FalloffType = 'none' | 'linear' | 'smooth' | 'gaussian';

/**
 * Brush operation mode
 */
export type BrushMode = 'set' | 'sculpt' | 'smooth' | 'noise';

// ═══════════════════════════════════════════════════════════════
// Falloff Functions
// ═══════════════════════════════════════════════════════════════

/**
 * Calculate falloff value based on distance and curve type
 *
 * @param distance - Distance from center (0 = center)
 * @param radius - Brush radius
 * @param falloff - Falloff curve type
 * @returns Falloff factor (0-1, where 1 = full strength)
 */
export function calculateFalloff(
  distance: number,
  radius: number,
  falloff: FalloffType
): number {
  if (distance > radius) return 0;
  if (radius === 0) return distance === 0 ? 1 : 0;

  const t = distance / radius; // Normalized distance (0-1)

  switch (falloff) {
    case 'none':
      return 1;

    case 'linear':
      return 1 - t;

    case 'smooth':
      // Smoothstep: 3t² - 2t³
      return 1 - (t * t * (3 - 2 * t));

    case 'gaussian':
      // Gaussian approximation: e^(-3t²)
      return Math.exp(-3 * t * t);

    default:
      return 1;
  }
}

/**
 * Get all falloff types
 */
export function getFalloffTypes(): FalloffType[] {
  return ['none', 'linear', 'smooth', 'gaussian'];
}

/**
 * Get display label for falloff type
 */
export function getFalloffLabel(falloff: FalloffType): string {
  const labels: Record<FalloffType, string> = {
    none: 'None (Flat)',
    linear: 'Linear',
    smooth: 'Smooth',
    gaussian: 'Gaussian',
  };
  return labels[falloff];
}

// ═══════════════════════════════════════════════════════════════
// Value Application
// ═══════════════════════════════════════════════════════════════

/**
 * Apply brush mode to a numeric value
 *
 * @param currentValue - Current value of the tile property
 * @param targetValue - Target value (or delta for sculpt)
 * @param strength - Brush strength (0-100)
 * @param falloff - Falloff factor at this point (0-1)
 * @param mode - Brush operation mode
 * @param min - Minimum allowed value
 * @param max - Maximum allowed value
 * @returns New value after brush application
 */
export function applyBrushValue(
  currentValue: number,
  targetValue: number,
  strength: number,
  falloff: number,
  mode: BrushMode,
  min: number,
  max: number
): number {
  // Convert strength to 0-1 range
  const s = (strength / 100) * falloff;

  let result: number;

  switch (mode) {
    case 'set':
      // Interpolate toward target value
      result = currentValue + (targetValue - currentValue) * s;
      break;

    case 'sculpt':
      // Add/subtract delta
      result = currentValue + targetValue * s;
      break;

    case 'smooth':
      // Move toward local average (targetValue should be neighbor average)
      result = currentValue + (targetValue - currentValue) * s * 0.5;
      break;

    case 'noise':
      // Add random noise
      const noise = (Math.random() - 0.5) * 2 * targetValue;
      result = currentValue + noise * s;
      break;

    default:
      result = currentValue;
  }

  // Clamp to valid range
  return Math.max(min, Math.min(max, result));
}

/**
 * Apply brush to integer value (for climate properties)
 *
 * @param currentValue - Current integer value
 * @param targetValue - Target value or delta
 * @param strength - Brush strength (0-100)
 * @param falloff - Falloff factor (0-1)
 * @param mode - Brush mode
 * @param min - Minimum (default 1)
 * @param max - Maximum (default 12)
 * @returns New integer value
 */
export function applyBrushIntValue(
  currentValue: number,
  targetValue: number,
  strength: number,
  falloff: number,
  mode: BrushMode,
  min = 1,
  max = 12
): number {
  const result = applyBrushValue(
    currentValue,
    targetValue,
    strength,
    falloff,
    mode,
    min,
    max
  );
  return Math.round(result);
}

/**
 * Get all brush modes
 */
export function getBrushModes(): BrushMode[] {
  return ['set', 'sculpt', 'smooth', 'noise'];
}

/**
 * Get display label for brush mode
 */
export function getBrushModeLabel(mode: BrushMode): string {
  const labels: Record<BrushMode, string> = {
    set: 'Set',
    sculpt: 'Sculpt',
    smooth: 'Smooth',
    noise: 'Noise',
  };
  return labels[mode];
}

// ═══════════════════════════════════════════════════════════════
// Neighbor Averaging (for smooth mode)
// ═══════════════════════════════════════════════════════════════

/**
 * Calculate average of values (for smooth brush)
 *
 * @param values - Array of neighbor values
 * @returns Average value
 */
export function calculateAverage(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Calculate weighted average (for smooth brush with falloff)
 *
 * @param values - Array of [value, weight] pairs
 * @returns Weighted average
 */
export function calculateWeightedAverage(
  values: Array<[value: number, weight: number]>
): number {
  if (values.length === 0) return 0;

  let totalWeight = 0;
  let weightedSum = 0;

  for (const [value, weight] of values) {
    weightedSum += value * weight;
    totalWeight += weight;
  }

  return totalWeight > 0 ? weightedSum / totalWeight : 0;
}
