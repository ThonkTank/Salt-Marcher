import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import electron from 'electron'

const userData = mkdtempSync(join(tmpdir(), 'salt-marcher-smoke-'))
const qualification = process.argv.includes('--qualification')
try {
  const result = spawnSync(
    electron as unknown as string,
    [
      join(process.cwd(), 'out', 'main', 'index.js'),
      '--smoke-test',
      ...(qualification ? ['--m1-qualification'] : []),
      '--no-sandbox',
      `--user-data-dir=${userData}`
    ],
    { stdio: 'inherit' }
  )
  if (result.error) throw result.error
  if (result.status !== 0)
    throw new Error(`Electron smoke test exited with ${result.status}`)
} finally {
  rmSync(userData, { recursive: true, force: true })
}
