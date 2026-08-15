import { spawnSync } from 'node:child_process'

run(['pnpm', 'exec', 'tsx', 'scripts/prepare-build-output.ts'])
run(['pnpm', 'exec', 'electron-vite', 'build'], {
  SALT_MARCHER_BUILD_TARGET: 'qualification'
})
run(['pnpm', 'exec', 'tsx', 'scripts/build-passive-preload.ts'])
run([
  'pnpm',
  'exec',
  'tsx',
  'scripts/write-build-info.ts',
  '--channel',
  'release'
])
run(['pnpm', 'exec', 'tsx', 'scripts/write-build-receipt.ts'])

function run(
  arguments_: readonly string[],
  extraEnvironment: Readonly<Record<string, string>> = {}
): void {
  const result = spawnSync('corepack', arguments_, {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: { ...process.env, ...extraEnvironment }
  })
  if (result.error) throw result.error
  if (result.status !== 0)
    throw new Error(`${arguments_.join(' ')} failed with ${result.status}`)
}
