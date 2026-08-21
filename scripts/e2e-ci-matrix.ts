import {
  e2eSuiteRegistry,
  functionalE2eCiShards,
  visualE2eCiShards,
  type E2eSuiteName,
  type E2eSuiteType,
  type FunctionalE2eCiShard,
  type VisualE2eCiShard
} from './e2e-suite-registry.js'

export type E2eCiShard = FunctionalE2eCiShard | VisualE2eCiShard

export type E2eCiMatrix<Shard extends E2eCiShard = E2eCiShard> = Readonly<{
  include: readonly Readonly<{ shard: Shard }>[]
}>

export function e2eCiMatrix(
  type: 'functional'
): E2eCiMatrix<FunctionalE2eCiShard>
export function e2eCiMatrix(type: 'visual'): E2eCiMatrix<VisualE2eCiShard>
export function e2eCiMatrix(type: E2eSuiteType): E2eCiMatrix {
  const shards =
    type === 'functional' ? functionalE2eCiShards : visualE2eCiShards
  return { include: shards.map((shard) => ({ shard })) }
}

export function e2eCiSuites(
  type: E2eSuiteType,
  shard: string
): readonly E2eSuiteName[] {
  if (!isE2eCiShard(type, shard))
    throw new Error(`Unknown ${type} E2E CI shard: ${shard}`)
  const suites = e2eSuiteRegistry
    .filter((suite) =>
      type === 'functional'
        ? suite.ci.functional.shard === shard
        : 'visual' in suite.ci && suite.ci.visual.shard === shard
    )
    .map((suite) => suite.name)
  if (suites.length === 0)
    throw new Error(`${type} E2E CI shard has no suites: ${shard}`)
  return suites
}

export function measuredE2eCiSeconds(
  type: E2eSuiteType,
  shard: string
): number {
  return e2eSuiteRegistry.reduce((total, suite) => {
    if (type === 'functional')
      return suite.ci.functional.shard === shard
        ? total + suite.ci.functional.measuredSeconds
        : total
    return 'visual' in suite.ci && suite.ci.visual.shard === shard
      ? total + suite.ci.visual.measuredSeconds
      : total
  }, 0)
}

export function isE2eCiShard(
  type: E2eSuiteType,
  value: string
): value is E2eCiShard {
  const shards: readonly string[] =
    type === 'functional' ? functionalE2eCiShards : visualE2eCiShards
  return shards.includes(value)
}
