import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { releaseManifestSchema } from '../src/shared/contracts/release.js'
import { durableJson, sha256 } from '../src/shared/maintenance/files.js'
const target = releaseManifestSchema.parse(
  JSON.parse(readFileSync('release/release/release-manifest.json', 'utf8'))
)
// A pre-baseline package is only a qualification fixture, never a public release.
if (target.version !== '0.2.0') {
  execFileSync(
    'gh',
    [
      'release',
      'download',
      '--repo',
      'ThonkTank/Salt-Marcher',
      '--pattern',
      '*.AppImage',
      '--pattern',
      'release-manifest.json',
      '--dir',
      'release/baseline'
    ],
    { stdio: 'inherit' }
  )
  process.exit(0)
}
const version = '0.1.99'
execFileSync(
  'corepack',
  [
    'pnpm',
    'exec',
    'electron-builder',
    '--config',
    'electron-builder.release.yml',
    '--config.extraMetadata.version=' + version,
    '--config.directories.output=release/baseline',
    '--linux',
    'AppImage',
    '--x64',
    '--publish',
    'never'
  ],
  { stdio: 'inherit' }
)
const directory = 'release/baseline'
const name = readdirSync(directory).find((entry) =>
  entry.endsWith('.AppImage')
)!
durableJson(join(directory, 'release-manifest.json'), {
  ...target,
  version,
  artifact: {
    name,
    bytes: statSync(join(directory, name)).size,
    sha256: sha256(join(directory, name))
  }
})
