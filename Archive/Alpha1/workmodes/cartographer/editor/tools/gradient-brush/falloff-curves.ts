/**
 * Falloff curve algorithms for gradient brush
 *
 * Calculates distance-based falloff for smooth gradient transitions.
 */

/**
 * Available falloff curve types
 * - linear: Straight linear falloff
 * - quadratic: Accelerating falloff (stronger at edges)
 * - smooth: Cosine-based falloff (smoothest transition)
 */
export type FalloffCurve = "linear" | "quadratic" | "smooth";

/**
 * Calculates falloff multiplier based on distance from center
 *
 * @param distance - Distance from brush center in hexes
 * @param radius - Brush radius in hexes
 * @param curve - Falloff curve type (default: "smooth")
 * @returns Multiplier between 0.0 (edge) and 1.0 (center)
 *
 * @example
 * ```typescript
 * // At center (distance = 0), always returns 1.0
 * calculateFalloff(0, 5, "smooth") // 1.0
 *
 * // At edge (distance = radius), always returns 0.0
 * calculateFalloff(5, 5, "smooth") // 0.0
 *
 * // Mid-distance varies by curve
 * calculateFalloff(2.5, 5, "linear")    // 0.5
 * calculateFalloff(2.5, 5, "quadratic") // 0.75
 * calculateFalloff(2.5, 5, "smooth")    // ~0.707
 * ```
 */
export function calculateFalloff(
    distance: number,
    radius: number,
    curve: FalloffCurve = "smooth"
): number {
    // Edge case: zero radius means full strength everywhere
    if (radius === 0) return 1.0;

    // Outside radius: no effect
    if (distance > radius) return 0.0;

    // Normalize distance to 0-1 range
    const normalized = distance / radius;

    switch (curve) {
        case "linear":
            // Simple linear falloff: 1 - x
            return 1 - normalized;

        case "quadratic":
            // Accelerating falloff: 1 - x²
            // Stronger effect near center, sharper dropoff at edge
            return 1 - (normalized * normalized);

        case "smooth":
            // Cosine falloff: cos(x * π/2)
            // Smoothest transition, no harsh edges
            return Math.cos(normalized * Math.PI / 2);

        default:
            // Fallback to linear
            return 1 - normalized;
    }
}
