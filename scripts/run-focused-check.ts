import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { z } from 'zod'

const focusedCheckManifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    name: z.string().regex(/^[a-z][a-z0-9-]+$/),
    typecheck: z.boolean(),
    tests: z.array(z.string().regex(/^(tests|scripts)\//)).min(1),
    maxWorkers: z.number().int().positive().max(8)
  })
  .strict()

const name = process.argv[2]
if (!name || !/^[a-z][a-z0-9-]+$/.test(name))
  throw new Error('Usage: run-focused-check.ts <manifest-name>')

const manifestPath = resolve('scripts', 'test-manifests', `${name}.json`)
const manifest = focusedCheckManifestSchema.parse(
  JSON.parse(readFileSync(manifestPath, 'utf8'))
)
if (manifest.name !== name)
  throw new Error(`Focused check manifest identity differs: ${manifest.name}`)

if (manifest.typecheck) run(['pnpm', 'typecheck'])
run([
  'pnpm',
  'exec',
  'vitest',
  'run',
  ...manifest.tests,
  `--maxWorkers=${manifest.maxWorkers}`
])

function run(args: readonly string[]): void {
  const result = spawnSync('corepack', args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: 'inherit'
  })
  if (result.error) throw result.error
  if (result.status !== 0)
    throw new Error(
      `Focused check ${manifest.name} failed: corepack ${args.join(' ')}`
    )
}
