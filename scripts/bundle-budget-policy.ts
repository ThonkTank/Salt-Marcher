export const bundleGrowthAllowanceBytes = 16 * 1024

export type BundleGraphBaseline = Readonly<Record<string, number>>

export function bundleGraphGrowth(
  current: BundleGraphBaseline,
  baseline: BundleGraphBaseline
): ReadonlyArray<{
  graph: string
  bytes: number
  baseline: number
  growth: number
}> {
  return Object.entries(current)
    .map(([graph, bytes]) => ({
      graph,
      bytes,
      baseline: baseline[graph] ?? 0,
      growth: bytes - (baseline[graph] ?? 0)
    }))
    .filter((entry) => entry.growth > 0)
    .toSorted((left, right) => right.growth - left.growth)
}

export function excessiveBundleGrowth(
  current: BundleGraphBaseline,
  baseline: BundleGraphBaseline,
  allowance = bundleGrowthAllowanceBytes
) {
  return bundleGraphGrowth(current, baseline).filter(
    (entry) => entry.growth > allowance
  )
}

export function bundleGraphRatchets(
  current: BundleGraphBaseline,
  baseline: BundleGraphBaseline
) {
  return Object.entries(current)
    .map(([graph, bytes]) => ({
      graph,
      bytes,
      baseline: baseline[graph] ?? 0,
      reduction: (baseline[graph] ?? 0) - bytes
    }))
    .filter((entry) => entry.reduction > 0)
    .toSorted((left, right) => right.reduction - left.reduction)
}
