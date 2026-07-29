import { mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const userData = join(process.cwd(), '.tmp', 'wdio-user-data')
process.env['SALT_MARCHER_E2E'] = 'true'
rmSync(userData, { recursive: true, force: true })
mkdirSync(userData, { recursive: true })

export const config = {
  runner: 'local',
  specs: ['./tests/e2e/**/*.e2e.ts'],
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
        appArgs: [`--user-data-dir=${userData}`, '--disable-gpu']
      }
    }
  ],
  logLevel: 'warn',
  framework: 'mocha',
  reporters: ['spec'],
  mochaOpts: { ui: 'bdd', timeout: 45_000 }
}
