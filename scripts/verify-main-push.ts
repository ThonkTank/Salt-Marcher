import { spawnSync } from 'node:child_process'

const result = spawnSync(
  'corepack',
  ['pnpm', 'delivery:verify-post-promotion'],
  {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit'
  }
)
if (result.error) throw result.error
if (result.status !== 0)
  throw new Error(`Post-promotion verification exited with ${result.status}`)
