import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { VisualGoldenEntry } from './visual-golden-policy.js'

const manifest = JSON.parse(
  readFileSync(
    join(process.cwd(), 'tests', 'e2e', 'goldens', 'manifest.json'),
    'utf8'
  )
) as { version: 1; goldens: VisualGoldenEntry[] }
const bySuite = new Map<string, Set<string>>()
for (const golden of manifest.goldens) {
  const patterns = bySuite.get(golden.suite) ?? new Set<string>()
  patterns.add(golden.testPattern)
  bySuite.set(golden.suite, patterns)
}
for (const [suite, patterns] of bySuite) {
  const result = spawnSync(
    join(process.cwd(), 'node_modules', '.bin', 'wdio'),
    ['run', 'wdio.conf.ts', '--suite', suite],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        SALT_MARCHER_E2E_GREP: [...patterns]
          .map(escapeRegularExpression)
          .join('|'),
        SALT_MARCHER_E2E_SUITE: suite,
        SALT_MARCHER_E2E_RUN_ID: `visual-${process.pid}-${suite}`,
        SALT_MARCHER_VISUAL_MODE: 'true'
      },
      stdio: 'inherit'
    }
  )
  if (result.error) throw result.error
  if (result.status !== 0)
    throw new Error(
      `Visual suite ${suite} failed with exit status ${result.status ?? 'unknown'}`
    )
}

function escapeRegularExpression(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
