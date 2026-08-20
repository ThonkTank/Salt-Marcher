import { spawnSync } from 'node:child_process'

run(['pnpm', 'typecheck'])
run([
  'pnpm',
  'exec',
  'vitest',
  'run',
  'tests/unit/session-mutation-controller.test.tsx',
  'tests/unit/session-workspace-controller.test.tsx',
  'tests/unit/session-workspace-layout.test.tsx',
  'tests/unit/session-accessibility-primitives.test.tsx',
  'tests/unit/session-travel-console.test.tsx',
  'tests/unit/loot-ui.test.tsx',
  'tests/unit/session-style-ownership.test.ts',
  '--maxWorkers=2'
])
run(['pnpm', 'build'])
run([
  'pnpm',
  'exec',
  'tsx',
  'scripts/run-e2e-suites.ts',
  '--suite',
  'campaignPseudoLocale'
])
run([
  'pnpm',
  'exec',
  'tsx',
  'scripts/run-visual-suites.ts',
  '--suite',
  'travel'
])

function run(args: readonly string[]): void {
  const result = spawnSync('corepack', args, {
    cwd: process.cwd(),
    stdio: 'inherit'
  })
  if (result.error) throw result.error
  if (result.status !== 0)
    throw new Error(`Session UI check failed: corepack ${args.join(' ')}`)
}
