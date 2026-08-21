import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  e2eSuiteRegistry,
  e2eSuiteHasType,
  isE2eSuiteName,
  type E2eSuiteName
} from './e2e-suite-registry.js'
import { e2eCiSuites } from './e2e-ci-matrix.js'
import { executeE2eRun } from './e2e-runner-core.js'
import type { VisualGoldenEntry } from './visual-golden-policy.js'

const manifest = JSON.parse(
  readFileSync(
    join(process.cwd(), 'tests', 'e2e', 'goldens', 'manifest.json'),
    'utf8'
  )
) as { version: 1; goldens: VisualGoldenEntry[] }
const patternsBySuite = new Map<E2eSuiteName, Set<string>>()
for (const golden of manifest.goldens) {
  if (!isE2eSuiteName(golden.suite))
    throw new Error(`Unknown visual E2E suite: ${golden.suite}`)
  const patterns = patternsBySuite.get(golden.suite) ?? new Set<string>()
  patterns.add(golden.testPattern)
  patternsBySuite.set(golden.suite, patterns)
}
const grepBySuite = new Map(
  [...patternsBySuite].map(([suite, patterns]) => [
    suite,
    [...patterns].map(escapeRegularExpression).join('|')
  ])
)
const requestedSuites = repeatedArguments('--suite')
const ciShard = argumentAfter('--ci-shard')
if (ciShard && requestedSuites.length > 0)
  throw new Error('--ci-shard and --suite cannot be combined')
for (const suite of requestedSuites)
  if (!isE2eSuiteName(suite) || !grepBySuite.has(suite))
    throw new Error(`Unknown visual E2E suite: ${suite}`)
const selectedSuites = ciShard
  ? e2eCiSuites('visual', ciShard)
  : requestedSuites.length > 0
    ? ([...new Set(requestedSuites)] as E2eSuiteName[])
    : e2eSuiteRegistry
        .filter((suite) => e2eSuiteHasType(suite, 'visual'))
        .map((suite) => suite.name)
for (const suite of selectedSuites)
  if (!grepBySuite.has(suite))
    throw new Error(`Visual E2E suite has no golden patterns: ${suite}`)
const resumePath = argumentAfter('--resume')

await executeE2eRun({
  mode: 'visual',
  selectedSuites,
  registry: e2eSuiteRegistry,
  ...(ciShard ? { ciShard } : {}),
  grepBySuite,
  ...(resumePath ? { resumePath } : {})
})

function escapeRegularExpression(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function repeatedArguments(name: string): string[] {
  const values: string[] = []
  for (let index = 0; index < process.argv.length; index += 1) {
    if (process.argv[index] !== name) continue
    const value = process.argv[index + 1]
    if (!value || value.startsWith('--'))
      throw new Error(`${name} needs a value`)
    values.push(value)
    index += 1
  }
  return values
}

function argumentAfter(name: string): string | undefined {
  const index = process.argv.indexOf(name)
  if (index < 0) return undefined
  const value = process.argv[index + 1]
  if (!value || value.startsWith('--')) throw new Error(`${name} needs a value`)
  return value
}
