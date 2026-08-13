import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import {
  e2eSuiteRegistry,
  isE2eSuiteName,
  type E2eSuiteName
} from '../tests/e2e/support/e2e-suite-registry.js'

type SuiteStatus = 'pending' | 'passed' | 'failed'
type SuiteResult = Readonly<{
  name: E2eSuiteName
  status: SuiteStatus
  exitCode: number | null
  durationMs: number | null
}>
type RunSummary = Readonly<{
  version: 1
  runId: string
  buildIdentity: string
  registryIdentity: string
  selectedSuites: readonly E2eSuiteName[]
  updatedAt: string
  results: readonly SuiteResult[]
}>

const arguments_ = process.argv.slice(2).filter((entry) => entry !== '--')
const resumePath = argumentAfter('--resume')
const requested = repeatedArguments('--suite')
for (const name of requested)
  if (!isE2eSuiteName(name)) throw new Error(`Unknown E2E suite: ${name}`)
const selectedSuites = (
  requested.length > 0
    ? [...new Set(requested)]
    : e2eSuiteRegistry.map((suite) => suite.name)
) as E2eSuiteName[]
const buildIdentity = fingerprintFiles([
  'out/main/index.js',
  'out/renderer/.vite/manifest.json'
])
const registryIdentity = sha256(JSON.stringify(e2eSuiteRegistry))
const resumed = resumePath ? readSummary(resolve(resumePath)) : null
if (
  resumed &&
  (resumed.buildIdentity !== buildIdentity ||
    resumed.registryIdentity !== registryIdentity ||
    JSON.stringify(resumed.selectedSuites) !== JSON.stringify(selectedSuites))
)
  throw new Error(
    'Cannot resume: build, suite registry, or selected suite set changed.'
  )

const runId = resumed?.runId ?? `${Date.now()}-${process.pid}`
const summaryPath = resumePath
  ? resolve(resumePath)
  : resolve('.tmp', 'e2e-runs', runId, 'summary.json')
const resultDirectory = join(dirname(summaryPath), 'suites')
let results = selectedSuites.map(
  (name): SuiteResult =>
    resumed?.results.find((result) => result.name === name) ?? {
      name,
      status: 'pending',
      exitCode: null,
      durationMs: null
    }
)
writeSummary()

for (const suite of selectedSuites) {
  const current = results.find((result) => result.name === suite)!
  if (resumed && current.status === 'passed') {
    console.log(`Skipping passed E2E suite ${suite}.`)
    continue
  }
  const startedAt = Date.now()
  const exitCode = await runSuite(suite, runId)
  results = results.map((result) =>
    result.name === suite
      ? {
          name: suite,
          status: exitCode === 0 ? 'passed' : 'failed',
          exitCode,
          durationMs: Date.now() - startedAt
        }
      : result
  )
  writeSuiteResult(results.find((result) => result.name === suite)!)
  writeSummary()
}

const failures = results.filter((result) => result.status !== 'passed')
if (failures.length > 0) {
  console.error(
    `E2E failures: ${failures.map((failure) => failure.name).join(', ')}`
  )
  console.error(`Resume with: pnpm test:e2e:built -- --resume ${summaryPath}`)
  process.exitCode = failures.find((failure) => failure.exitCode)?.exitCode ?? 1
} else {
  console.log(`All E2E suites passed. Summary: ${summaryPath}`)
}

function runSuite(suite: E2eSuiteName, id: string): Promise<number> {
  return new Promise((resolveExit) => {
    const executable = join(
      process.cwd(),
      'node_modules',
      '.bin',
      process.platform === 'win32' ? 'wdio.cmd' : 'wdio'
    )
    const child = spawn(executable, ['run', 'wdio.conf.ts', '--suite', suite], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        SALT_MARCHER_E2E_SUITE: suite,
        SALT_MARCHER_E2E_RUN_ID: id
      },
      stdio: 'inherit'
    })
    child.once('error', (error) => {
      console.error(error)
      resolveExit(1)
    })
    child.once('exit', (code) => resolveExit(code ?? 1))
  })
}

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

function fingerprintFiles(paths: readonly string[]): string {
  const hash = createHash('sha256')
  for (const path of paths) hash.update(path).update(readFileSync(path))
  return hash.digest('hex')
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function readSummary(path: string): RunSummary {
  const value = JSON.parse(readFileSync(path, 'utf8')) as RunSummary
  if (value.version !== 1) throw new Error('Unsupported E2E summary version.')
  return value
}

function writeSummary(): void {
  const summary: RunSummary = {
    version: 1,
    runId,
    buildIdentity,
    registryIdentity,
    selectedSuites,
    updatedAt: new Date().toISOString(),
    results
  }
  writeJsonAtomically(summaryPath, summary)
}

function writeSuiteResult(result: SuiteResult): void {
  writeJsonAtomically(join(resultDirectory, `${result.name}.json`), {
    version: 1,
    runId,
    buildIdentity,
    registryIdentity,
    updatedAt: new Date().toISOString(),
    result
  })
}

function writeJsonAtomically(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true })
  const temporary = `${path}.tmp-${process.pid}`
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`)
  renameSync(temporary, path)
}
