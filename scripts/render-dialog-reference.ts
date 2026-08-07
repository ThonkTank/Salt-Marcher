import { createHash } from 'node:crypto'
import { cpSync, mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const root = process.cwd()
const referenceDirectory = join(root, 'docs', 'project', 'references')
const outputDirectory = join(root, '.tmp', 'dialog-reference')
const sources = [
  {
    source: 'world-location-dialog-reference.html',
    target: 'index.html'
  },
  {
    source: 'world-location-dialog-support.js',
    target: 'support.js'
  }
] as const
const checksums = new Map(
  readFileSync(
    join(referenceDirectory, 'world-location-dialog-reference.sha256'),
    'utf8'
  )
    .trim()
    .split('\n')
    .map((line) => {
      const [checksum, name] = line.trim().split(/\s+/, 2)
      if (!checksum || !name)
        throw new Error(`Invalid reference checksum: ${line}`)
      return [name, checksum]
    })
)
mkdirSync(outputDirectory, { recursive: true })
for (const entry of sources) {
  const source = join(referenceDirectory, entry.source)
  const actual = createHash('sha256').update(readFileSync(source)).digest('hex')
  if (actual !== checksums.get(entry.source))
    throw new Error(`Reference checksum mismatch for ${entry.source}`)
  cpSync(source, join(outputDirectory, entry.target))
}
const output = join(outputDirectory, 'world-location-dialog.png')
const result = spawnSync(
  join(root, 'node_modules', '.bin', 'electron'),
  [
    'scripts/render-dialog-reference-electron.cjs',
    '--html',
    join(outputDirectory, 'index.html'),
    '--tokens',
    join(root, 'src', 'renderer', 'shell', 'tokens.css'),
    '--output',
    output
  ],
  {
    cwd: root,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '' },
    stdio: 'inherit'
  }
)
if (result.error) throw result.error
if (result.status !== 0)
  throw new Error(
    `Reference renderer failed with status ${result.status ?? 'unknown'}`
  )
console.log(`Rendered approved dialog reference to ${output}`)
