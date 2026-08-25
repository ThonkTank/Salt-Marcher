import { createHash } from 'node:crypto'

export function replaceSemanticIdentities(
  value: unknown,
  identities: ReadonlyMap<string, string>
): unknown {
  if (Array.isArray(value))
    return value.map((entry) => replaceSemanticIdentities(entry, identities))
  if (typeof value === 'object' && value !== null)
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        replaceSemanticIdentities(entry, identities)
      ])
    )
  if (typeof value !== 'string') return value
  let projected = value
  for (const [id, semanticKey] of [...identities].sort(
    ([left], [right]) => right.length - left.length
  ))
    projected = projected.replaceAll(id, semanticKey)
  return projected
}

export function assertNoRawUuid(value: unknown, label: string): void {
  const serialized = JSON.stringify(value)
  const match = serialized.match(
    /[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i
  )
  if (match)
    throw new Error(
      `${label} semantic projection left raw identity ${match[0]}.`
    )
}

export function semanticHash(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(canonicalize(value)))
    .digest('hex')
}

export function collectUuids(value: unknown): Set<string> {
  const matches = JSON.stringify(value).match(
    /[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi
  )
  return new Set(matches ?? [])
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (typeof value !== 'object' || value === null) return value
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalize(entry)])
  )
}
