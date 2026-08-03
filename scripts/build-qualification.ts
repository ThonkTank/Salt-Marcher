import { spawnSync } from 'node:child_process'

const result = spawnSync(
  'corepack',
  ['pnpm', 'exec', 'electron-vite', 'build'],
  {
    stdio: 'inherit',
    env: { ...process.env, SALT_MARCHER_BUILD_TARGET: 'qualification' },
    shell: process.platform === 'win32'
  }
)
if (result.error) throw result.error
if (result.status !== 0)
  throw new Error(`Qualification build exited with ${result.status}`)
