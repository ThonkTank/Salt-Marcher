import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { appendFileSync, mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { z } from 'zod'
import {
  releaseRepository,
  releaseVersionSchema
} from '../src/shared/contracts/release.js'
import { readReleaseVersion } from './release/release-version.js'
import { inspectReleaseFile } from './release/bundle.js'
import { verifyQualificationDocuments } from './release/qualification.js'
import { resolveQualificationOrigin } from './release/qualification-origin.js'

const version = releaseVersionSchema.parse(process.env['RELEASE_VERSION'])
const directory = resolve(z.string().min(1).parse(process.argv[2]))
const found = readReleaseVersion(version)
assert(found, 'No release draft exists for this version')
const release = z
  .object({
    draft: z.literal(true),
    prerelease: z.literal(false),
    tag_name: z.literal(`v${version}`),
    target_commitish: z.string().regex(/^[a-f0-9]{40}$/),
    assets: z.array(
      z.object({
        name: z.string(),
        size: z.number().int().positive(),
        state: z.literal('uploaded')
      })
    )
  })
  .parse(found)
const controls = [
  'release-request.json',
  'release-manifest.json',
  'update-qualification.json'
]
for (const name of controls) {
  const matches = release.assets.filter((asset) => asset.name === name)
  assert.equal(matches.length, 1)
  assert(matches[0]!.size <= 4 * 1024 * 1024)
}
mkdirSync(directory)
execFileSync(
  'gh',
  [
    'release',
    'download',
    `v${version}`,
    '--repo',
    releaseRepository,
    '--dir',
    directory,
    ...controls.flatMap((name) => ['--pattern', name])
  ],
  { timeout: 180_000, maxBuffer: 1024 * 1024, stdio: 'pipe' }
)
const read = (name: string) =>
  inspectReleaseFile(join(directory, name), 4 * 1024 * 1024, true).content
const qualified = verifyQualificationDocuments(
  read(controls[0]!),
  read(controls[1]!),
  read(controls[2]!)
)
assert.equal(qualified.target.version, version)
assert.equal(qualified.target.commit, release.target_commitish)
const origin = resolveQualificationOrigin(qualified.workflow, 'publish')
const output = z.string().min(1).parse(process.env['GITHUB_OUTPUT'])
appendFileSync(
  output,
  `commit=${qualified.target.commit}\nrun_id=${origin.workflow.runId}\nartifact_name=${origin.artifact.name}\n`
)
console.info(
  `Resolved qualified draft ${version} at ${qualified.target.commit}`
)
