import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import electron from 'electron'

const build = spawnSync('corepack', ['pnpm', 'build:qualification'], {
  stdio: 'inherit',
  env: process.env
})
if (build.error) throw build.error
if (build.status !== 0)
  throw new Error(`Qualification build exited with ${build.status}`)

const userData = mkdtempSync(join(tmpdir(), 'salt-marcher-qualification-'))
try {
  const result = spawnSync(
    electron as unknown as string,
    [
      join(process.cwd(), 'out', 'main', 'index.js'),
      '--m1-qualification',
      ...(process.platform === 'linux' ? ['--no-sandbox'] : []),
      `--user-data-dir=${userData}`
    ],
    { stdio: 'inherit' }
  )
  if (result.error) throw result.error
  if (result.status !== 0)
    throw new Error(`Qualification application exited with ${result.status}`)
} finally {
  rmSync(userData, { recursive: true, force: true })
}
