import { createHash } from 'node:crypto'
import { readFileSync, renameSync, writeFileSync } from 'node:fs'
import { basename, resolve } from 'node:path'
import { localArtifactManifestSchema } from '../src/shared/contracts/build-info.js'
import { localPersistenceFormatVersions } from '../src/shared/contracts/local-persistence-format-versions.js'
import { sha256File } from './file-hash.js'
import { verifyBuildReceipt } from './build-receipt.js'

const workspaceRoot = process.cwd()
const packageJson = JSON.parse(
  readFileSync(resolve(workspaceRoot, 'package.json'), 'utf8')
) as { version?: unknown }
if (typeof packageJson.version !== 'string')
  throw new Error('package.json does not contain a version')
const artifactPath = resolve(
  workspaceRoot,
  'release',
  'local',
  `SaltMarcher-Local-${packageJson.version}.AppImage`
)
const receipt = verifyBuildReceipt(resolve(workspaceRoot, 'out'))
if (receipt.build.channel !== 'local')
  throw new Error('Local packaging requires a local-channel build')
const manifest = localArtifactManifestSchema.parse({
  formatVersion: localPersistenceFormatVersions.localArtifactManifest,
  artifactFile: basename(artifactPath),
  artifactSha256: sha256File(artifactPath),
  receiptSha256: createHash('sha256')
    .update(JSON.stringify(receipt))
    .digest('hex'),
  receipt
})
const target = `${artifactPath}.manifest.json`
const temporary = `${target}.next`
writeFileSync(temporary, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
renameSync(temporary, target)
console.info(
  JSON.stringify({
    component: 'local-artifact',
    event: 'manifest-written',
    artifact: artifactPath,
    fingerprint: receipt.build.workspaceFingerprint
  })
)
