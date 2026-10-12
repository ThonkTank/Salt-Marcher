/** Search is forgiving; inline recognition keeps its separate exact-name rules. */
export function referenceSearchWords(query: string): readonly string[] {
  return normalizeReferenceSearch(query).trim().split(/\s+/u).filter(Boolean)
}

export function normalizeReferenceSearch(text: string): string {
  return text.normalize('NFKC').toLocaleLowerCase('de-DE')
}

export function matchesReferenceSearch(
  words: readonly string[],
  text: string
): boolean {
  const normalized = normalizeReferenceSearch(text)
  return words.length > 0 && words.every((word) => normalized.includes(word))
}

/** Map a useful query phrase back to original text, including decomposed Unicode. */
export function referenceSearchSpan(text: string, query: string, title = '') {
  const titleText = normalizeReferenceSearch(title)
  const words = referenceSearchWords(query).filter(
    (word) => !titleText.includes(word)
  )
  if (words.length === 0) return null
  let normalized = ''
  const starts: number[] = [],
    ends: number[] = []
  const segments = new Intl.Segmenter('de', { granularity: 'grapheme' })
  for (const segment of segments.segment(text)) {
    for (const character of normalizeReferenceSearch(segment.segment)) {
      const value = /\s/u.test(character) ? ' ' : character
      if (value === ' ' && normalized.endsWith(' ')) continue
      normalized += value
      for (let index = 0; index < value.length; index++) {
        starts.push(segment.index)
        ends.push(segment.index + segment.segment.length)
      }
    }
  }
  for (let length = words.length; length > 0; length--) {
    for (let index = 0; index <= words.length - length; index++) {
      const phrase = words.slice(index, index + length).join(' ')
      const start = normalized.indexOf(phrase)
      if (start !== -1)
        return { start: starts[start]!, end: ends[start + phrase.length - 1]! }
    }
  }
  return null
}
