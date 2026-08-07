const integerFormatter = new Intl.NumberFormat('de-DE', {
  maximumFractionDigits: 0
})

const decimalFormatter = new Intl.NumberFormat('de-DE', {
  maximumFractionDigits: 2
})

export function formatInteger(value: number): string {
  return integerFormatter.format(value)
}

export function formatXp(value: number): string {
  return `${formatInteger(value)} XP`
}

export function formatPercent(value: number): string {
  return `${formatInteger(value)} %`
}

export function formatMultiplier(value: number): string {
  return decimalFormatter.format(value)
}

export function formatChallengeRating(value: string): string {
  return value
}

export function formatChallengeRatingLabel(value: string): string {
  return `CR ${value}`
}

export function formatChallengeRatingRange(
  minimum: string,
  maximum: string
): string {
  return minimum === maximum ? minimum : `${minimum}–${maximum}`
}
