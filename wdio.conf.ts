import { cpSync, mkdirSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'

const suite =
  process.env['SALT_MARCHER_E2E_SUITE'] ?? argumentAfter('--suite') ?? 'all'
const fixtures: Record<string, string> = {
  restart: 'editor-data'
}
const fixture = fixtures[suite] ?? 'empty-installation'
const runId = process.env['SALT_MARCHER_E2E_RUN_ID'] ?? `${process.pid}`
const userData = join(
  process.cwd(),
  '.tmp',
  'wdio-user-data',
  `${suite}-${runId}-${process.pid}`
)
process.env['SALT_MARCHER_E2E'] = 'true'
process.env['SALT_MARCHER_E2E_SUITE'] = suite
rmSync(userData, { recursive: true, force: true })
mkdirSync(userData, { recursive: true })
cpSync(
  join(process.cwd(), 'tests', 'e2e', 'fixtures', 'v1', fixture),
  userData,
  { recursive: true }
)
const materialized = spawnSync(
  join(process.cwd(), 'node_modules', '.bin', 'tsx'),
  ['scripts/materialize-e2e-fixture.ts', '--user-data', userData],
  { cwd: process.cwd(), encoding: 'utf8' }
)
if (materialized.error) throw materialized.error
if (materialized.status !== 0)
  throw new Error(
    `Could not materialize E2E fixture ${fixture}: ${materialized.stderr}`
  )

export const config = {
  runner: 'local',
  specs: ['./tests/e2e/**/*.e2e.ts'],
  suites: {
    create: ['./tests/e2e/campaign-walking.e2e.ts'],
    hexLocation: ['./tests/e2e/hex-location-workflow.e2e.ts'],
    restart: ['./tests/e2e/campaign-restart.e2e.ts'],
    dialogs: ['./tests/e2e/dialog-architecture.e2e.ts'],
    sessionGeneration: ['./tests/e2e/session-generation.e2e.ts'],
    workspaces: ['./tests/e2e/workspace-isolation.e2e.ts']
  },
  maxInstances: 1,
  autoXvfb: true,
  services: [
    [
      'electron',
      { captureMainProcessLogs: false, mainProcessLogLevel: 'error' }
    ]
  ],
  capabilities: [
    {
      browserName: 'electron',
      'wdio:electronServiceOptions': {
        appEntryPoint: join(process.cwd(), 'out', 'main', 'index.js'),
        appArgs: [
          '--no-sandbox',
          '--salt-marcher-e2e-runtime',
          `--user-data-dir=${userData}`,
          '--use-angle=swiftshader',
          '--enable-unsafe-swiftshader'
        ]
      }
    }
  ],
  logLevel: process.env['WDIO_LOG_LEVEL'] ?? 'warn',
  framework: 'mocha',
  reporters: ['spec'],
  mochaOpts: { ui: 'bdd', timeout: 120_000 }
}

function argumentAfter(name: string): string | undefined {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}
