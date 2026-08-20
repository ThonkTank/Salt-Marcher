import { mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { electronTestApplication } from './scripts/electron-test-application.js'
import {
  evaluateE2eResourcePreflight,
  readE2eResourceSnapshot
} from './scripts/e2e-resource-preflight.js'

const resourcePreflight = evaluateE2eResourcePreflight(
  readE2eResourceSnapshot()
)
if (resourcePreflight.status === 'failed')
  throw new Error(
    `Electron E2E resource preflight failed: ${resourcePreflight.reason}`
  )

const userData = join(process.cwd(), '.tmp', 'wdio-passive-user-data')
rmSync(userData, { recursive: true, force: true })
mkdirSync(userData, { recursive: true })

const testApplication = electronTestApplication(
  join(process.cwd(), 'out', 'main', 'index.js'),
  [
    '--no-sandbox',
    '--salt-marcher-e2e-runtime',
    '--passive-e2e',
    `--user-data-dir=${userData}`,
    '--disable-gpu'
  ]
)

export const config = {
  runner: 'local',
  specs: ['./tests/e2e/passive-window.e2e.ts'],
  maxInstances: 1,
  autoXvfb: true,
  services: [
    ['electron', { captureMainProcessLogs: true, mainProcessLogLevel: 'debug' }]
  ],
  capabilities: [
    {
      browserName: 'electron',
      'wdio:electronServiceOptions': testApplication
    }
  ],
  // The service's dpkg package-name hints are not linkage checks. This direct
  // path keeps actionable startup/CDP failures while the real binary is still
  // validated and exercised above.
  logLevel: process.env['WDIO_LOG_LEVEL'] ?? 'error',
  framework: 'mocha',
  reporters: ['spec'],
  mochaOpts: { ui: 'bdd', timeout: 30_000 }
}
