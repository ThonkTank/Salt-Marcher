import { readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { releaseManifestSchema } from '../src/shared/contracts/release.js'
import { sha256 } from '../src/shared/maintenance/files.js'
const root = process.argv[2] ?? 'release/release'
const manifest = releaseManifestSchema.parse(
  JSON.parse(readFileSync(join(root, 'release-manifest.json'), 'utf8'))
)
const file = join(root, manifest.artifact.name)
if (
  statSync(file).size !== manifest.artifact.bytes ||
  sha256(file) !== manifest.artifact.sha256
)
  throw new Error('Release artifact differs from manifest')
if (
  process.env['RELEASE_SHA'] &&
  manifest.commit !== process.env['RELEASE_SHA']
)
  throw new Error('Release commit mismatch')
if (
  process.env['RELEASE_VERSION'] &&
  manifest.version !== process.env['RELEASE_VERSION']
)
  throw new Error('Release version mismatch')
console.info(
  JSON.stringify({
    version: manifest.version,
    commit: manifest.commit,
    sha256: manifest.artifact.sha256
  })
)
