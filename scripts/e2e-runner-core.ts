import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  createWriteStream,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync
} from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import type { E2eSuiteName } from './e2e-suite-registry.js'
import {
  initializeE2eResults,
  recordE2eAttempt,
  validateE2eResumeIdentity,
  type E2eRunSummary,
  type E2eSuiteResult
} from './e2e-run-receipt.js'

const packageRequire = createRequire(import.meta.url)
const wdioEntry = join(
  dirname(packageRequire.resolve('@wdio/cli')),
  '..',
  'bin',
  'wdio.js'
)

export type E2eRunMode = 'functional' | 'visual'

export async function executeE2eRun(input: {
  mode: E2eRunMode
  selectedSuites: readonly E2eSuiteName[]
  registry: unknown
  resumePath?: string
  grepBySuite?: ReadonlyMap<E2eSuiteName, string>
}): Promise<void> {
  const buildIdentity = fingerprintFiles([
    'out/main/index.js',
    'out/renderer/.vite/manifest.json'
  ])
  const registryIdentity = sha256(
    JSON.stringify({
      mode: input.mode,
      registry: input.registry,
      greps: [...(input.grepBySuite?.entries() ?? [])]
    })
  )
  const resumed = input.resumePath
    ? readSummary(resolve(input.resumePath))
    : null
  if (resumed)
    validateE2eResumeIdentity(resumed, {
      buildIdentity,
      registryIdentity,
      selectedSuites: input.selectedSuites
    })

  const runId = resumed?.runId ?? `${input.mode}-${Date.now()}-${process.pid}`
  const summaryPath = input.resumePath
    ? resolve(input.resumePath)
    : resolve('.tmp', 'e2e-runs', runId, 'summary.json')
  const resultDirectory = join(dirname(summaryPath), 'suites')
  let results = initializeE2eResults(input.selectedSuites, resumed)
  writeSummary()

  for (const suite of input.selectedSuites) {
    const current = results.find((result) => result.name === suite)!
    if (resumed && current.status === 'passed') {
      console.log(`Skipping passed ${input.mode} E2E suite ${suite}.`)
      continue
    }
    const startedAt = Date.now()
    const attempt = current.attempts.length + 1
    const paths = suiteAttemptPaths(resultDirectory, suite, attempt)
    const execution = await runWdioSuite({
      suite,
      runId,
      mode: input.mode,
      logPath: paths.logPath,
      ...(input.grepBySuite?.get(suite)
        ? { grep: input.grepBySuite.get(suite)! }
        : {})
    })
    results = recordE2eAttempt(results, suite, {
      attempt,
      status: execution.exitCode === 0 ? 'passed' : 'failed',
      exitCode: execution.exitCode,
      durationMs: Date.now() - startedAt,
      failureKind: execution.failureKind,
      knownNoise: execution.knownNoise,
      ...paths
    })
    writeSuiteResult(results.find((result) => result.name === suite)!)
    writeSummary()
  }

  const failures = results.filter((result) => result.status !== 'passed')
  if (failures.length > 0) {
    console.error(
      `${input.mode} E2E failures: ${failures
        .map((failure) => {
          const kind = failure.attempts.at(-1)?.failureKind ?? 'product'
          return `${failure.name} (${kind})`
        })
        .join(', ')}`
    )
    console.error(`Resume with: --resume ${summaryPath}`)
    process.exitCode =
      failures.find((failure) => failure.exitCode)?.exitCode ?? 1
  } else {
    console.log(`All ${input.mode} E2E suites passed. Summary: ${summaryPath}`)
  }

  function writeSummary(): void {
    const summary: E2eRunSummary<E2eSuiteName> = {
      version: 2,
      runId,
      buildIdentity,
      registryIdentity,
      selectedSuites: input.selectedSuites,
      updatedAt: new Date().toISOString(),
      results
    }
    writeJsonAtomically(summaryPath, summary)
  }

  function writeSuiteResult(result: E2eSuiteResult<E2eSuiteName>): void {
    writeJsonAtomically(join(resultDirectory, `${result.name}.json`), {
      version: 1,
      mode: input.mode,
      runId,
      buildIdentity,
      registryIdentity,
      updatedAt: new Date().toISOString(),
      result
    })
  }
}

export function classifyE2eLogLine(line: string): 'known-noise' | 'diagnostic' {
  return /(?:Browser\.getWindowForTarget.*(?:not supported|unsupported|fallback)|unknown command:\s*'Browser\.getWindowForTarget' wasn't found)/i.test(
    line
  )
    ? 'known-noise'
    : 'diagnostic'
}

export function classifyE2eFailure(
  exitCode: number,
  log: string
): 'product' | 'infrastructure' | null {
  if (exitCode === 0) return null
  return /(?:session not created|operation was aborted due to timeout[^\n]*\/session[^\n]*method "POST"|ECONNREFUSED|ENOSPC|Xvfb|Electron[^\n]*exited before|unable to connect[^\n]*webdriver)/i.test(
    log
  )
    ? 'infrastructure'
    : 'product'
}

async function runWdioSuite(input: {
  suite: E2eSuiteName
  runId: string
  mode: E2eRunMode
  logPath: string
  grep?: string
}): Promise<
  Readonly<{
    exitCode: number
    failureKind: 'product' | 'infrastructure' | null
    knownNoise: number
  }>
> {
  return new Promise((resolveExit) => {
    mkdirSync(dirname(input.logPath), { recursive: true })
    const log = createWriteStream(input.logPath, { flags: 'w' })
    let diagnosticTail = ''
    let knownNoise = 0
    const child = spawn(
      process.execPath,
      [wdioEntry, 'run', 'wdio.conf.ts', '--suite', input.suite],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          SALT_MARCHER_E2E_SUITE: input.suite,
          SALT_MARCHER_E2E_RUN_ID: input.runId,
          ...(input.mode === 'visual'
            ? {
                SALT_MARCHER_VISUAL_MODE: 'true',
                SALT_MARCHER_E2E_GREP: input.grep
              }
            : {})
        },
        stdio: ['inherit', 'pipe', 'pipe']
      }
    )
    const forward = (chunk: Buffer, target: NodeJS.WriteStream): void => {
      log.write(chunk)
      const value = chunk.toString()
      diagnosticTail = `${diagnosticTail}${value}`.slice(-200_000)
      const visible = value
        .split('\n')
        .filter((line) => {
          if (classifyE2eLogLine(line) === 'diagnostic') return true
          knownNoise += 1
          return false
        })
        .join('\n')
      if (visible.length > 0) target.write(visible)
    }
    child.stdout.on('data', (chunk: Buffer) => forward(chunk, process.stdout))
    child.stderr.on('data', (chunk: Buffer) => forward(chunk, process.stderr))
    child.once('error', (error) => {
      diagnosticTail = `${diagnosticTail}\n${error.stack ?? error.message}`
      log.end(`${error.stack ?? error.message}\n`, () =>
        resolveExit({
          exitCode: 1,
          failureKind: 'infrastructure',
          knownNoise
        })
      )
    })
    child.once('exit', (code) => {
      const exitCode = code ?? 1
      log.end(() =>
        resolveExit({
          exitCode,
          failureKind: classifyE2eFailure(exitCode, diagnosticTail),
          knownNoise
        })
      )
    })
  })
}

function suiteAttemptPaths(
  resultDirectory: string,
  suite: E2eSuiteName,
  attempt: number
): Readonly<{ logPath: string; artifactDirectory: string }> {
  return {
    logPath: join(resultDirectory, `${suite}.attempt-${attempt}.log`),
    artifactDirectory: resolve('.tmp', 'visual-diffs')
  }
}

function fingerprintFiles(paths: readonly string[]): string {
  const hash = createHash('sha256')
  for (const path of paths) hash.update(path).update(readFileSync(path))
  return hash.digest('hex')
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function readSummary(path: string): E2eRunSummary<E2eSuiteName> {
  const value = JSON.parse(
    readFileSync(path, 'utf8')
  ) as E2eRunSummary<E2eSuiteName>
  if (value.version !== 2) throw new Error('Unsupported E2E summary version.')
  return value
}

function writeJsonAtomically(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true })
  const temporary = `${path}.tmp-${process.pid}`
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`)
  renameSync(temporary, path)
}
