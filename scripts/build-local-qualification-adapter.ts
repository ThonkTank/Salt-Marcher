import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync
} from 'node:fs'
import { createRequire } from 'node:module'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { z } from 'zod'
import { localArtifactManifestSchema } from '../src/shared/contracts/build-info.js'
import { sha256 } from '../src/shared/maintenance/files.js'
import { readWorkspaceIdentity } from './build-identity.js'

const { values } = parseArgs({
  options: {
    source: { type: 'string' },
    artifact: { type: 'string' },
    output: { type: 'string' }
  }
})
const source = resolve(z.string().parse(values.source))
const artifact = resolve(z.string().parse(values.artifact))
const output = resolve(z.string().parse(values.output))
assert(!existsSync(output), 'Adapter output must be new')
const manifestPath = `${artifact}.manifest.json`
const manifest = localArtifactManifestSchema.parse(
  JSON.parse(readFileSync(manifestPath, 'utf8'))
)
assert.equal(sha256(artifact), manifest.artifactSha256)
const expected = manifest.receipt.build
const identity = readWorkspaceIdentity(source)
assert.deepEqual(identity, {
  commit: expected.commit,
  dirty: false,
  workspaceFingerprint: expected.workspaceFingerprint,
  appBuildInputFingerprint: expected.appBuildInputFingerprint
})
assert.equal(expected.channel, 'local')
const inputs = [
  'scripts/local-app-installation.ts',
  'scripts/local-installation/runtime-start.ts',
  'scripts/build-identity.ts'
]
const entry = inputs
  .map(
    (path, index) =>
      `export { ${
        [
          'advanceLocalAppInstallation, localInstallationPaths',
          'verifyLocalRuntimeStartup',
          'readWorkspaceIdentity'
        ][index]
      } } from ${JSON.stringify(join(source, path))};`
  )
  .join('\n')
const require = createRequire(import.meta.url)
const esbuild = createRequire(require.resolve('vite/package.json')).resolve(
  'esbuild/bin/esbuild'
)
mkdirSync(output)
const adapter = join(output, 'adapter.mjs')
execFileSync(
  process.execPath,
  [
    esbuild,
    '--bundle',
    '--platform=node',
    '--format=esm',
    '--target=node22',
    '--external:better-sqlite3',
    `--outfile=${adapter}`,
    '--sourcefile=qualification-adapter.js',
    '--banner:js=import {createRequire as makeRequire} from "node:module"; const require=makeRequire(import.meta.url);'
  ],
  {
    cwd: source,
    input: entry,
    stdio: ['pipe', 'inherit', 'inherit'],
    env: { ...process.env, NODE_PATH: join(process.cwd(), 'node_modules') }
  }
)
assert.deepEqual(
  readWorkspaceIdentity(source),
  identity,
  'Original source changed during bundling'
)
copyFileSync(
  join(source, 'resources/icons/salt-marcher.png'),
  join(output, 'icon.png')
)
writeFileSync(
  join(output, 'adapter-manifest.json'),
  JSON.stringify(
    {
      formatVersion: 1,
      evidence:
        'original-local-installer-test-adapter-not-runtime-qualification-or-handoff',
      sourceIdentity: identity,
      artifactSha256: manifest.artifactSha256,
      artifactManifestSha256: sha256(manifestPath),
      schemaVersions: expected.schemaVersions,
      adapterSha256: sha256(adapter),
      iconSha256: sha256(join(output, 'icon.png')),
      inputs: inputs.map((path) => ({
        path,
        sha256: sha256(join(source, path))
      })),
      externalNativeDependency: 'better-sqlite3',
      nodeVersion: process.versions.node
    },
    null,
    2
  ),
  { flag: 'wx' }
)
console.info(
  `Original Local adapter built for ${identity.commit}; runtime qualification remains required.`
)
