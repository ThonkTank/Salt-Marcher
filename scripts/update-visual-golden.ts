import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import {
  parseVisualGoldenUpdateArguments,
  type VisualGoldenEntry
} from './visual-golden-policy.js'

const manifest = JSON.parse(
  readFileSync(
    join(process.cwd(), 'tests', 'e2e', 'goldens', 'manifest.json'),
    'utf8'
  )
) as { version: 1; goldens: VisualGoldenEntry[] }
const selection = parseVisualGoldenUpdateArguments(
  process.argv.slice(2),
  manifest.goldens
)
if (!selection.reuseBuild) run('corepack', ['pnpm', 'build'])
run(
  join(process.cwd(), 'node_modules', '.bin', 'wdio'),
  ['run', 'wdio.conf.ts', '--suite', selection.suite],
  {
    UPDATE_VISUAL_GOLDENS: [...selection.names].join(','),
    SALT_MARCHER_E2E_SUITE: selection.suite,
    SALT_MARCHER_E2E_RUN_ID: `golden-${process.pid}`
  }
)

function run(
  command: string,
  arguments_: readonly string[],
  environment: Readonly<Record<string, string>> = {}
): void {
  const result = spawnSync(command, arguments_, {
    cwd: process.cwd(),
    env: { ...process.env, ...environment },
    stdio: 'inherit'
  })
  if (result.error) throw result.error
  if (result.status !== 0)
    throw new Error(
      `${command} failed with exit status ${result.status ?? 'unknown'}`
    )
}
