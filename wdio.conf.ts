import { cpSync, mkdirSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { waitForGmRendererReady } from './tests/e2e/support/e2e-ready.js'
import type { Browser as WdioBrowser } from 'webdriverio'
import { browser } from '@wdio/globals'
import {
  e2eSuite,
  e2eSuiteRegistry,
  isE2eSuiteName
} from './scripts/e2e-suite-registry.js'
import {
  isConfirmedTabCrash,
  shouldAttemptFailureScreenshot
} from './scripts/e2e-failure-diagnostics.js'
import { electronTestApplication } from './scripts/electron-test-application.js'

const packageRequire = createRequire(import.meta.url)

const requestedSuite =
  process.env['SALT_MARCHER_E2E_SUITE'] ?? argumentAfter('--suite') ?? 'all'
if (requestedSuite !== 'all' && !isE2eSuiteName(requestedSuite))
  throw new Error(`Unknown E2E suite: ${requestedSuite}`)
const suite = requestedSuite
const fixture =
  suite === 'all' ? 'v1/empty-installation' : e2eSuite(suite).fixture
const runId = process.env['SALT_MARCHER_E2E_RUN_ID'] ?? `${process.pid}`
const userData = join(
  process.cwd(),
  '.tmp',
  'wdio-user-data',
  `${suite}-${runId}-${process.pid}`
)
process.env['SALT_MARCHER_E2E'] = 'true'
process.env['SALT_MARCHER_E2E_SUITE'] = suite
if (suite === 'sessionGeneration')
  process.env['SALT_MARCHER_E2E_PREPARATION_STAGE_DELAY_MS'] ??= '1000'
rmSync(userData, { recursive: true, force: true })
mkdirSync(userData, { recursive: true })
cpSync(join(process.cwd(), 'tests', 'e2e', 'fixtures', fixture), userData, {
  recursive: true
})
const materialized = spawnSync(
  process.execPath,
  [
    packageRequire.resolve('tsx/cli'),
    'scripts/materialize-e2e-fixture.ts',
    '--user-data',
    userData
  ],
  { cwd: process.cwd(), encoding: 'utf8' }
)
if (materialized.error) throw materialized.error
if (materialized.status !== 0)
  throw new Error(
    `Could not materialize E2E fixture ${fixture}: ${materialized.stderr}`
  )

const testApplication = electronTestApplication(
  join(process.cwd(), 'out', 'main', 'index.js'),
  [
    '--no-sandbox',
    '--salt-marcher-e2e-runtime',
    `--user-data-dir=${userData}`,
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader'
  ]
)
let rendererUnavailable = false

export const config = {
  runner: 'local',
  specs: ['./tests/e2e/**/*.e2e.ts'],
  suites: Object.fromEntries(
    e2eSuiteRegistry.map((entry) => [entry.name, [entry.spec]])
  ),
  maxInstances: 1,
  autoXvfb: true,
  services: [
    ['electron', { captureMainProcessLogs: true, mainProcessLogLevel: 'error' }]
  ],
  capabilities: [
    {
      browserName: 'electron',
      'wdio:electronServiceOptions': testApplication
    }
  ],
  logLevel: process.env['WDIO_LOG_LEVEL'] ?? 'warn',
  framework: 'mocha',
  reporters: ['spec'],
  before: async (
    _capabilities: unknown,
    _specs: readonly string[],
    client: WdioBrowser
  ) => {
    await waitForGmRendererReady(client)
  },
  afterTest: async (
    test: { title: string },
    _context: unknown,
    result: { passed: boolean; error?: unknown }
  ) => {
    if (result.passed) return
    if (!shouldAttemptFailureScreenshot(rendererUnavailable, result.error)) {
      rendererUnavailable = true
      return
    }
    const directory =
      process.env['SALT_MARCHER_E2E_ARTIFACT_DIR'] ??
      join(process.cwd(), '.tmp', 'visual-diffs')
    mkdirSync(directory, { recursive: true })
    const title = test.title.replaceAll(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 80)
    try {
      await browser.saveScreenshot(join(directory, `${suite}-${title}.png`))
    } catch (error) {
      rendererUnavailable ||= isConfirmedTabCrash(error)
    }
  },
  mochaOpts: {
    ui: 'bdd',
    timeout:
      suite === 'sessionGeneration'
        ? 360_000
        : suite === 'campaignQualification'
          ? 300_000
          : 180_000,
    ...(process.env['SALT_MARCHER_E2E_GREP']
      ? { grep: process.env['SALT_MARCHER_E2E_GREP'] }
      : {})
  }
}

function argumentAfter(name: string): string | undefined {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}
