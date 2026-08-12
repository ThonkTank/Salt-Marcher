export type BundleManifestEntry = Readonly<{
  file: string
  name?: string
  src?: string
  isEntry?: boolean
  isDynamicEntry?: boolean
  imports?: readonly string[]
  dynamicImports?: readonly string[]
  css?: readonly string[]
  assets?: readonly string[]
}>

export function resolveBundleManifestEntry(
  manifest: Readonly<Record<string, BundleManifestEntry>>,
  identity: Readonly<{
    label: string
    src?: string
    name?: string
    isDynamicEntry?: boolean
  }>
): string {
  if (identity.src) {
    const sourceMatches = Object.entries(manifest).filter(
      ([, entry]) => entry.src === identity.src
    )
    if (sourceMatches.length === 1) return sourceMatches[0]![0]
    if (sourceMatches.length > 1)
      throw ambiguousEntry(identity.label, 'source', sourceMatches)
  }
  if (identity.name) {
    const nameMatches = Object.entries(manifest).filter(
      ([, entry]) =>
        entry.name === identity.name &&
        (identity.isDynamicEntry === undefined ||
          entry.isDynamicEntry === identity.isDynamicEntry)
    )
    if (nameMatches.length === 1) return nameMatches[0]![0]
    if (nameMatches.length > 1)
      throw ambiguousEntry(identity.label, 'name/dynamic-entry', nameMatches)
  }
  throw new Error(
    `Bundle graph entry is missing for ${identity.label}; tried src=${identity.src ?? '(none)'}, name=${identity.name ?? '(none)'}, isDynamicEntry=${identity.isDynamicEntry ?? '(any)'}.`
  )
}

function ambiguousEntry(
  label: string,
  strategy: string,
  matches: readonly (readonly [string, BundleManifestEntry])[]
): Error {
  return new Error(
    `Bundle graph entry for ${label} is ambiguous by ${strategy}: ${matches
      .map(
        ([key, entry]) =>
          `${key} -> ${entry.file} (src=${entry.src ?? '-'}, name=${entry.name ?? '-'}, dynamic=${entry.isDynamicEntry ?? false})`
      )
      .join('; ')}`
  )
}
