import { spawn } from 'node:child_process'
import { join } from 'node:path'
import {
  e2eSuiteRegistry,
  type E2eSuiteName
} from '../tests/e2e/support/e2e-suite-registry.js'

const suites = e2eSuiteRegistry.map((suite) => suite.name)
// Native Electron window control and visual-golden geometry are not isolated
// reliably across concurrent electron-service instances on the same display.
const concurrency = 1
let nextSuite = 0
let failed = false

await Promise.all(
  Array.from({ length: concurrency }, async () => {
    while (!failed) {
      const suite = suites[nextSuite]
      nextSuite += 1
      if (!suite) return
      const status = await runSuite(suite)
      if (status !== 0) {
        failed = true
        process.exitCode = status
        return
      }
    }
  })
)

function runSuite(suite: E2eSuiteName): Promise<number> {
  return new Promise((resolve) => {
    const executable = join(process.cwd(), 'node_modules', '.bin', 'wdio')
    const child = spawn(executable, ['run', 'wdio.conf.ts', '--suite', suite], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        SALT_MARCHER_E2E_SUITE: suite,
        SALT_MARCHER_E2E_RUN_ID: `${process.pid}`
      },
      stdio: 'inherit'
    })
    child.once('error', (error) => {
      console.error(error)
      resolve(1)
    })
    child.once('exit', (code) => resolve(code ?? 1))
  })
}
