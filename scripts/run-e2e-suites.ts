import {
  e2eSuiteRegistry,
  isE2eSuiteName,
  type E2eSuiteName
} from './e2e-suite-registry.js'
import { e2eCiSuites } from './e2e-ci-matrix.js'
import { executeE2eRun } from './e2e-runner-core.js'
import { shuffledSuiteOrder } from './e2e-suite-order.js'

const arguments_ = process.argv.slice(2).filter((entry) => entry !== '--')
const resumePath = argumentAfter('--resume')
const shuffleSeedValue = argumentAfter('--shuffle-seed')
const ciShard = argumentAfter('--ci-shard')
const requested = repeatedArguments('--suite')
if (ciShard && requested.length > 0)
  throw new Error('--ci-shard and --suite cannot be combined')
for (const name of requested)
  if (!isE2eSuiteName(name)) throw new Error(`Unknown E2E suite: ${name}`)
const registeredSuites = (
  ciShard
    ? e2eCiSuites('functional', ciShard)
    : requested.length > 0
      ? [...new Set(requested)]
      : e2eSuiteRegistry.map((suite) => suite.name)
) as E2eSuiteName[]
const selectedSuites = shuffleSeedValue
  ? shuffledSuiteOrder(registeredSuites, Number(shuffleSeedValue))
  : registeredSuites

await executeE2eRun({
  mode: 'functional',
  selectedSuites,
  registry: e2eSuiteRegistry,
  ...(ciShard ? { ciShard } : {}),
  ...(resumePath ? { resumePath } : {})
})

function argumentAfter(name: string): string | undefined {
  const index = arguments_.indexOf(name)
  if (index < 0) return undefined
  const value = arguments_[index + 1]
  if (!value || value.startsWith('--')) throw new Error(`${name} needs a value`)
  return value
}

function repeatedArguments(name: string): string[] {
  const values: string[] = []
  for (let index = 0; index < arguments_.length; index += 1) {
    if (arguments_[index] !== name) continue
    const value = arguments_[index + 1]
    if (!value || value.startsWith('--'))
      throw new Error(`${name} needs a value`)
    values.push(value)
    index += 1
  }
  return values
}
