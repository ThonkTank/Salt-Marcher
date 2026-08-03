import { mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const userData = join(process.cwd(), '.tmp', 'wdio-passive-user-data')
rmSync(userData, { recursive: true, force: true })
mkdirSync(userData, { recursive: true })

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
      'wdio:electronServiceOptions': {
        appEntryPoint: join(process.cwd(), 'out', 'main', 'index.js'),
        appArgs: [
          '--no-sandbox',
          '--salt-marcher-e2e-runtime',
          '--passive-e2e',
          `--user-data-dir=${userData}`,
          '--disable-gpu'
        ]
      }
    }
  ],
  logLevel: process.env['WDIO_LOG_LEVEL'] ?? 'warn',
  framework: 'mocha',
  reporters: ['spec'],
  mochaOpts: { ui: 'bdd', timeout: 30_000 }
}
