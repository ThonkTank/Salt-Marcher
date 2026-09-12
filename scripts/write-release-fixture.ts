import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { z } from 'zod'
import {
  releaseManifestSchema,
  releaseRepository
} from '../src/shared/contracts/release.js'
import { inspectReleaseFile } from './release/bundle.js'
import { comparisonFixtureReceiptSchema } from './release/comparison-fixture.js'
import { digestReleaseDocument } from './release/qualification.js'

const directory = resolve(z.string().min(1).parse(process.argv[2]))
const environment = z
  .object({
    GITHUB_REPOSITORY: z.literal(releaseRepository),
    GITHUB_REF: z.literal('refs/heads/main'),
    GITHUB_EVENT_NAME: z.literal('workflow_dispatch'),
    GITHUB_WORKFLOW_REF: z.literal(
      `${releaseRepository}/.github/workflows/release-fixtures.yml@refs/heads/main`
    ),
    GITHUB_SHA: z.string().regex(/^[a-f0-9]{40}$/),
    GITHUB_RUN_ID: z.string().regex(/^[1-9][0-9]*$/),
    GITHUB_RUN_ATTEMPT: z.string().regex(/^[1-9][0-9]*$/)
  })
  .parse(process.env)
if (
  execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim() !==
  environment.GITHUB_SHA
)
  throw new Error('Fixture workflow checkout differs from its run commit.')
const historical = inspectReleaseFile(
  join(directory, 'historical-artifact.json'),
  4 * 1024 * 1024,
  true
)
const origin = z
  .object({
    formatVersion: z.literal(1),
    evidence: z.literal('historical-test-artifact-not-public-release'),
    version: z.string(),
    source: z.object({
      commit: z.string(),
      schemaVersions: releaseManifestSchema.shape.schemaVersions
    }),
    artifact: releaseManifestSchema.shape.artifact
  })
  .parse(JSON.parse(historical.content.toString('utf8')))
const manifest = releaseManifestSchema.parse({
  formatVersion: 1,
  repository: releaseRepository,
  version: origin.version,
  commit: origin.source.commit,
  platform: 'linux',
  arch: 'x64',
  schemaVersions: origin.source.schemaVersions,
  artifact: origin.artifact
})
const image = inspectReleaseFile(
  join(directory, manifest.artifact.name),
  manifest.artifact.bytes,
  false
)
if (
  image.bytes !== manifest.artifact.bytes ||
  image.sha256 !== manifest.artifact.sha256
)
  throw new Error('Historical fixture bytes differ from their build receipt.')
const manifestBytes = Buffer.from(JSON.stringify(manifest, null, 2) + '\n')
const receipt = comparisonFixtureReceiptSchema.parse({
  formatVersion: 1,
  kind: 'historical-qualification-fixture',
  manifest,
  manifestSha256: digestReleaseDocument(manifestBytes),
  historicalReceiptSha256: historical.sha256,
  workflow: {
    runId: Number(environment.GITHUB_RUN_ID),
    attempt: Number(environment.GITHUB_RUN_ATTEMPT),
    commit: environment.GITHUB_SHA
  }
})
writeFileSync(join(directory, 'release-manifest.json'), manifestBytes, {
  flag: 'wx'
})
writeFileSync(
  join(directory, 'comparison-fixture.json'),
  JSON.stringify(receipt, null, 2) + '\n',
  { flag: 'wx' }
)
console.info(
  `Recorded fixture ${manifest.version} from historical source ${manifest.commit}; not a public release.`
)
