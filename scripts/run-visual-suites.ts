import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  e2eSuiteRegistry,
  isE2eSuiteName,
  type E2eSuiteName
} from './e2e-suite-registry.js'
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
for (const suite of requestedSuites)
  if (!isE2eSuiteName(suite) || !grepBySuite.has(suite))
    throw new Error(`Unknown visual E2E suite: ${suite}`)
const selectedSuites =
  requestedSuites.length > 0
    ? ([...new Set(requestedSuites)] as E2eSuiteName[])
    : [...grepBySuite.keys()]
const resumeIndex = process.argv.indexOf('--resume')
const resumePath = resumeIndex >= 0 ? process.argv[resumeIndex + 1] : undefined
if (resumeIndex >= 0 && !resumePath) throw new Error('--resume needs a value')

await executeE2eRun({
  mode: 'visual',
  selectedSuites,
  registry: e2eSuiteRegistry,
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
