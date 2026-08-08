import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { parseBundleBaselineUpdateArguments } from './bundle-baseline-update.js'

const rationale = parseBundleBaselineUpdateArguments(process.argv.slice(2))
const checker = join(process.cwd(), 'node_modules', '.bin', 'tsx')
const result = spawnSync(
  checker,
  ['scripts/check-bundle-budget.ts', '--measure-only'],
  { cwd: process.cwd(), encoding: 'utf8', stdio: 'inherit' }
)
if (result.error) throw result.error
if (result.status !== 0)
  throw new Error(
    `Bundle measurement failed with exit status ${result.status ?? 'unknown'}. The baseline was not changed.`
  )

const measurement = JSON.parse(
  readFileSync(
    join(process.cwd(), '.tmp', 'renderer-bundle-measurements.json'),
    'utf8'
  )
) as { graphs: Record<string, number> }
const baselinePath = join(
  process.cwd(),
  'docs',
  'project',
  'architecture',
  'renderer-bundle-baseline.json'
)
writeFileSync(
  baselinePath,
  `${JSON.stringify(
    {
      recordedAt: new Date().toISOString().slice(0, 10),
      ...rationale,
      graphs: measurement.graphs
    },
    null,
    2
  )}\n`
)
console.log(
  `Updated ${baselinePath}. Review the measured graph changes before committing.`
)
