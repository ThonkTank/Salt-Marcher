import type {
  ReferenceCandidate,
  ReferenceIndex,
  ReferenceTarget,
  ReferenceTerm
} from '../../../shared/contracts/reference.js'
import { referenceTargetKey } from '../../../shared/reference/reference-target-key.js'

type AutomatonOutput = Readonly<{
  length: number
  term: ReferenceTerm
}>

type AutomatonNode = {
  readonly next: Map<string, number>
  failure: number
  readonly outputs: AutomatonOutput[]
}

type Automaton = Readonly<{
  mode: 'exact' | 'folded'
  nodes: readonly AutomatonNode[]
}>

export type CompiledReferenceIndex = Readonly<{
  revision: string
  exact: Automaton
  folded: Automaton
}>

export type ReferenceMatch = Readonly<{
  start: number
  end: number
  text: string
  candidates: readonly ReferenceCandidate[]
}>

/** Compile once per index revision. Matching then walks each input exactly once. */
export function compileReferenceIndex(
  index: ReferenceIndex
): CompiledReferenceIndex {
  return {
    revision: index.revision,
    exact: buildAutomaton(index.terms, 'exact'),
    folded: buildAutomaton(index.terms, 'folded')
  }
}

export function compileReferenceIndices(
  indices: readonly ReferenceIndex[]
): readonly CompiledReferenceIndex[] {
  return indices.map(compileReferenceIndex)
}

export function matchReferenceText(
  compiled: CompiledReferenceIndex | readonly CompiledReferenceIndex[],
  originalText: string,
  excludedTargets: readonly ReferenceTarget[] = []
): readonly ReferenceMatch[] {
  if (!originalText) return []
  const excluded = new Set(excludedTargets.map(referenceTargetKey))
  const indices: readonly CompiledReferenceIndex[] = isCompiledIndex(compiled)
    ? [compiled]
    : compiled
  const raw = indices
    .flatMap((index) => [
      ...matchesFor(index.exact, originalText, excluded),
      ...matchesFor(index.folded, originalText, excluded)
    ])
    .sort(
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

function isCompiledIndex(
  value: CompiledReferenceIndex | readonly CompiledReferenceIndex[]
): value is CompiledReferenceIndex {
  return !Array.isArray(value)
}

export { referenceTargetKey }

function buildAutomaton(
  terms: readonly ReferenceTerm[],
  mode: 'exact' | 'folded'
): Automaton {
  const nodes: AutomatonNode[] = [automatonNode()]
  for (const term of terms) {
    if (term.matchMode !== mode) continue
    const characters = [...normalize(term.term, mode)]
    if (characters.length === 0) continue
    let state = 0
    for (const character of characters) {
      const existing = nodes[state]!.next.get(character)
      if (existing !== undefined) {
        state = existing
        continue
      }
      const next = nodes.length
      nodes.push(automatonNode())
      nodes[state]!.next.set(character, next)
      state = next
    }
    nodes[state]!.outputs.push({ length: characters.length, term })
  }

  const queue: number[] = []
  for (const child of nodes[0]!.next.values()) queue.push(child)
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const state = queue[cursor]!
    for (const [character, child] of nodes[state]!.next) {
      queue.push(child)
      let failure = nodes[state]!.failure
      while (failure !== 0 && !nodes[failure]!.next.has(character))
        failure = nodes[failure]!.failure
      nodes[child]!.failure = nodes[failure]!.next.get(character) ?? 0
      nodes[child]!.outputs.push(...nodes[nodes[child]!.failure]!.outputs)
    }
  }
  return { mode, nodes }
}

function matchesFor(
  automaton: Automaton,
  originalText: string,
  excluded: ReadonlySet<string>
): ReferenceMatch[] {
  const projection = normalizedProjection(originalText, automaton.mode)
  const matches: ReferenceMatch[] = []
  let state = 0
  for (let end = 0; end < projection.characters.length; end += 1) {
    const character = projection.characters[end]!
    while (state !== 0 && !automaton.nodes[state]!.next.has(character))
      state = automaton.nodes[state]!.failure
    state = automaton.nodes[state]!.next.get(character) ?? 0
    for (const output of automaton.nodes[state]!.outputs) {
      const start = end - output.length + 1
      if (start < 0) continue
      if (start > 0 && isWordCharacter(projection.characters[start - 1]!))
        continue
      const matchEnd = end + 1
      if (
        matchEnd < projection.characters.length &&
        isWordCharacter(projection.characters[matchEnd]!)
      )
        continue
      const candidates = output.term.candidates.filter(
        (candidate) => !excluded.has(referenceTargetKey(candidate.target))
      )
      if (candidates.length === 0) continue
      const originalStart = projection.starts[start]!
      const originalEnd = projection.ends[end]!
      matches.push({
        start: originalStart,
        end: originalEnd,
        text: originalText.slice(originalStart, originalEnd),
        candidates
      })
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

const graphemeSegmenter = new Intl.Segmenter('en', { granularity: 'grapheme' })

function normalizedProjection(
  original: string,
  mode: 'exact' | 'folded'
): Readonly<{
  characters: readonly string[]
  starts: readonly number[]
  ends: readonly number[]
}> {
  if (isAscii(original)) {
    const characters = [...normalize(original, mode)]
    return {
      characters,
      starts: characters.map((_, index) => index),
      ends: characters.map((_, index) => index + 1)
    }
  }
  const characters: string[] = []
  const starts: number[] = []
  const ends: number[] = []
  for (const segment of graphemeSegmenter.segment(original)) {
    for (const character of normalize(segment.segment, mode)) {
      characters.push(character)
      starts.push(segment.index)
      ends.push(segment.index + segment.segment.length)
    }
  }
  return { characters, starts, ends }
}

function isAscii(value: string): boolean {
  for (let index = 0; index < value.length; index += 1)
    if (value.charCodeAt(index) > 0x7f) return false
  return true
}

function automatonNode(): AutomatonNode {
  return { next: new Map(), failure: 0, outputs: [] }
}

function candidateOrder(
  left: ReferenceCandidate,
  right: ReferenceCandidate
): number {
  return (
    left.title.localeCompare(right.title) ||
    referenceTargetKey(left.target).localeCompare(
      referenceTargetKey(right.target)
    )
  )
}
