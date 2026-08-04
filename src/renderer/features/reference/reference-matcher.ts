import type {
  ReferenceCandidate,
  ReferenceIndex,
  ReferenceTarget,
  ReferenceTerm
} from '../../../shared/contracts/reference.js'

type TrieNode = {
  readonly next: Map<string, TrieNode>
  readonly outputs: ReferenceTerm[]
}

export type CompiledReferenceIndex = Readonly<{
  revision: string
  exact: TrieNode
  folded: TrieNode
}>

export type ReferenceMatch = Readonly<{
  start: number
  end: number
  text: string
  candidates: readonly ReferenceCandidate[]
}>

export function compileReferenceIndex(
  index: ReferenceIndex
): CompiledReferenceIndex {
  const exact = node()
  const folded = node()
  for (const term of index.terms) {
    const root = term.matchMode === 'exact' ? exact : folded
    const normalized = normalize(term.term, term.matchMode)
    if (!normalized) continue
    let current = root
    for (const character of normalized) {
      const next = current.next.get(character) ?? node()
      current.next.set(character, next)
      current = next
    }
    current.outputs.push(term)
  }
  return { revision: index.revision, exact, folded }
}

export function matchReferenceText(
  compiled: CompiledReferenceIndex,
  originalText: string,
  excludedTargets: readonly ReferenceTarget[] = []
): readonly ReferenceMatch[] {
  if (!originalText) return []
  const excluded = new Set(excludedTargets.map(referenceTargetKey))
  const raw = [
    ...matchesFor(compiled.exact, originalText, 'exact', excluded),
    ...matchesFor(compiled.folded, originalText, 'folded', excluded)
  ].sort(
    (left, right) =>
      left.start - right.start ||
      right.end - left.end ||
      left.text.localeCompare(right.text)
  )

  const result: ReferenceMatch[] = []
  let cursor = 0
  for (let index = 0; index < raw.length;) {
    const first = raw[index]!
    if (first.start < cursor) {
      index += 1
      continue
    }
    const candidates = new Map<string, ReferenceCandidate>()
    let sameSpanIndex = index
    while (
      sameSpanIndex < raw.length &&
      raw[sameSpanIndex]!.start === first.start &&
      raw[sameSpanIndex]!.end === first.end
    ) {
      for (const candidate of raw[sameSpanIndex]!.candidates)
        candidates.set(referenceTargetKey(candidate.target), candidate)
      sameSpanIndex += 1
    }
    result.push({
      start: first.start,
      end: first.end,
      text: originalText.slice(first.start, first.end),
      candidates: [...candidates.values()].toSorted(candidateOrder)
    })
    cursor = first.end
    while (index < raw.length && raw[index]!.start === first.start) index += 1
  }
  return result
}

export function referenceTargetKey(target: ReferenceTarget): string {
  return `${target.kind}:${target.id}:${target.sectionId ?? ''}`
}

function matchesFor(
  root: TrieNode,
  originalText: string,
  mode: 'exact' | 'folded',
  excluded: ReadonlySet<string>
): ReferenceMatch[] {
  const projection = normalizedProjection(originalText, mode)
  const text = projection.characters
  const matches: ReferenceMatch[] = []
  for (let start = 0; start < text.length; start += 1) {
    if (start > 0 && isWordCharacter(text[start - 1]!)) continue
    let current = root
    for (let end = start; end < text.length; end += 1) {
      const next = current.next.get(text[end]!)
      if (!next) break
      current = next
      if (current.outputs.length === 0) continue
      const matchEnd = end + 1
      if (matchEnd < text.length && isWordCharacter(text[matchEnd]!)) continue
      for (const output of current.outputs) {
        const candidates = output.candidates.filter(
          (candidate) => !excluded.has(referenceTargetKey(candidate.target))
        )
        if (candidates.length === 0) continue
        const originalStart = projection.starts[start]!
        const originalEnd = projection.ends[matchEnd - 1]!
        matches.push({
          start: originalStart,
          end: originalEnd,
          text: originalText.slice(originalStart, originalEnd),
          candidates
        })
      }
    }
  }
  return matches
}

function normalize(value: string, mode: 'exact' | 'folded'): string {
  const normalized = value.normalize('NFKC')
  return mode === 'folded' ? normalized.toLocaleLowerCase('en-US') : normalized
}

function isWordCharacter(value: string): boolean {
  return /[\p{L}\p{M}\p{N}_]/u.test(value)
}

const graphemeSegmenter = new Intl.Segmenter('en', {
  granularity: 'grapheme'
})

function normalizedProjection(
  original: string,
  mode: 'exact' | 'folded'
): Readonly<{
  characters: readonly string[]
  starts: readonly number[]
  ends: readonly number[]
}> {
  const characters: string[] = []
  const starts: number[] = []
  const ends: number[] = []
  for (const segment of graphemeSegmenter.segment(original)) {
    const normalized = normalize(segment.segment, mode)
    for (const character of normalized) {
      characters.push(character)
      starts.push(segment.index)
      ends.push(segment.index + segment.segment.length)
    }
  }
  return { characters, starts, ends }
}

function node(): TrieNode {
  return { next: new Map(), outputs: [] }
}

function candidateOrder(
  left: ReferenceCandidate,
  right: ReferenceCandidate
): number {
  return (
    (left.context ?? '').localeCompare(right.context ?? '') ||
    left.title.localeCompare(right.title) ||
    referenceTargetKey(left.target).localeCompare(
      referenceTargetKey(right.target)
    )
  )
}
