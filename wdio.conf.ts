import { mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const userData = join(process.cwd(), '.tmp', 'wdio-user-data')
process.env['SALT_MARCHER_E2E'] = 'true'
if (!process.argv.includes('restart')) {
  rmSync(userData, { recursive: true, force: true })
}
mkdirSync(userData, { recursive: true })

export const config = {
  runner: 'local',
  specs: ['./tests/e2e/**/*.e2e.ts'],
  suites: {
    create: ['./tests/e2e/campaign-walking.e2e.ts'],
    restart: ['./tests/e2e/campaign-restart.e2e.ts'],
    dialogs: ['./tests/e2e/dialog-architecture.e2e.ts']
  },
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
