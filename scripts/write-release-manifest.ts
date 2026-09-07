import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import {
  releaseManifestSchema,
  releaseRepository
} from '../src/shared/contracts/release.js'
import { buildReceiptSchema } from '../src/shared/contracts/build-info.js'
import { durableJson, sha256 } from '../src/shared/maintenance/files.js'
const directory = join(process.cwd(), 'release', 'release')
const artifacts = readdirSync(directory).filter((name) =>
  name.endsWith('.AppImage')
)
if (artifacts.length !== 1)
  throw new Error('Expected exactly one Release AppImage')
const name = artifacts[0]!
const receipt = buildReceiptSchema.parse(
  JSON.parse(readFileSync('out/build-receipt.json', 'utf8'))
)
if (receipt.build.channel !== 'release' || receipt.build.dirty)
  throw new Error('Release requires a clean Release-channel build')
const version = (
  JSON.parse(readFileSync('package.json', 'utf8')) as { version: string }
).version
const manifest = releaseManifestSchema.parse({
  formatVersion: 1,
  repository: releaseRepository,
  version,
  commit: receipt.build.commit,
  platform: 'linux',
  arch: 'x64',
  schemaVersions: receipt.build.schemaVersions,
  artifact: {
    name,
    bytes: statSync(join(directory, name)).size,
    sha256: sha256(join(directory, name))
  }
})
durableJson(join(directory, 'release-manifest.json'), manifest)
