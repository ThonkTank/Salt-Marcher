import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, resolve } from 'node:path'
import { inspectReleaseFile } from './release/bundle.js'
import {
  qualificationRunnerNames,
  qualificationRunnersSchema,
  verifyQualificationRunners
} from './release/qualification-runners.js'

const root = resolve(process.argv[2] ?? 'release/qualification-runners')
assert(!existsSync(root), 'Qualification runner output must be new')
const git = (...args: string[]) =>
  execFileSync('git', args, { encoding: 'utf8' }).trim()
assert.equal(
  git('status', '--porcelain'),
  '',
  'Qualification runners require a clean checkout'
)
const commit = git('rev-parse', 'HEAD')
const require = createRequire(import.meta.url)
const esbuild = createRequire(require.resolve('vite/package.json')).resolve(
  'esbuild/bin/esbuild'
)
mkdirSync(root, { recursive: true })
const entries = [
  'scripts/qualify-release-update.ts',
  'scripts/qualify-historical-ui-update.ts',
  'scripts/qualify-historical-first-install.ts'
]
for (const [index, name] of qualificationRunnerNames.entries())
  execFileSync(
    esbuild,
    [
      entries[index]!,
      '--bundle',
      '--platform=node',
      '--format=esm',
      '--target=node22',
      '--external:electron',
      '--external:better-sqlite3',
      '--banner:js=import { createRequire as qualificationCreateRequire } from "node:module"; import { fileURLToPath as qualificationFilePath } from "node:url"; import { dirname as qualificationDirname } from "node:path"; const require=qualificationCreateRequire(import.meta.url); const __filename=qualificationFilePath(import.meta.url); const __dirname=qualificationDirname(__filename);',
      `--outfile=${join(root, name)}`
    ],
    { stdio: 'inherit', timeout: 120_000 }
  )
assert.equal(git('rev-parse', 'HEAD'), commit)
assert.equal(
  git('status', '--porcelain'),
  '',
  'Sources changed while bundling qualification runners'
)
const manifest = qualificationRunnersSchema.parse({
  formatVersion: 1,
  sourceCommit: commit,
  files: qualificationRunnerNames.map((name) => {
    const file = inspectReleaseFile(join(root, name), 64 * 1024 * 1024, false)
    return { name, bytes: file.bytes, sha256: file.sha256 }
  })
})
writeFileSync(
  join(root, 'qualification-runners.json'),
  JSON.stringify(manifest, null, 2) + '\n',
  { flag: 'wx' }
)
verifyQualificationRunners(root, commit)
console.info(`Bundled immutable qualification runners for ${commit}: ${root}`)
