/** Canonical Challenge Rating parser. It accepts fractional and decimal
 * catalog spellings without relying on locale-specific number parsing. */
export function parseChallengeRating(value: string): number | null {
  const normalized = value.trim()
  const fraction = /^(\d+)\s*\/\s*(\d+)$/.exec(normalized)
  if (fraction) {
    const denominator = Number(fraction[2])
    if (denominator === 0) return null
    return Number(fraction[1]) / denominator
  }
  if (!/^(?:\d+)(?:\.\d+)?$/.test(normalized)) return null
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}
