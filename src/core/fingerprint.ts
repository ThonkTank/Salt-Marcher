import { createHash } from 'node:crypto'
import { canonicalJson } from '../shared/canonical-json.js'

export function fingerprint(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value)).digest('hex')
}

export function fingerprintExcluding(
  value: object,
  excludedKeys: readonly string[]
): string {
  const excluded = new Set(excludedKeys)
  return fingerprint(
    Object.fromEntries(
      Object.entries(value).filter(([key]) => !excluded.has(key))
    )
  )
}
