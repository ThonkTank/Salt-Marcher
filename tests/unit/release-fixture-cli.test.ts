import { execFileSync, spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { bytes } from '../fixtures/release-qualification.js'
import { comparisonArtifactSchema } from '../../scripts/release/request.js'
import { digestReleaseDocument } from '../../scripts/release/qualification.js'
import { verifyComparisonFiles } from '../../scripts/release/comparison-fixture.js'

const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true })
})
function setup() {
  const directory = mkdtempSync(join(tmpdir(), 'release-fixture-cli-'))
  roots.push(directory)
  const image = Buffer.from('inert historical fixture for CLI contract test')
  const origin = {
    formatVersion: 1,
    evidence: 'historical-test-artifact-not-public-release',
    version: '0.0.170',
    source: {
      commit: 'a'.repeat(40),
      schemaVersions: { installation: 43, campaign: 43 }
    },
    artifact: {
      name: 'SaltMarcher-0.0.170-x64.AppImage',
      bytes: image.length,
      sha256: digestReleaseDocument(image)
    }
  }
  writeFileSync(join(directory, 'historical-artifact.json'), bytes(origin))
  writeFileSync(join(directory, origin.artifact.name), image)
  const env = {
    ...process.env,
    GITHUB_REPOSITORY: 'ThonkTank/Salt-Marcher',
    GITHUB_REF: 'refs/heads/main',
    GITHUB_EVENT_NAME: 'workflow_dispatch',
    GITHUB_WORKFLOW_REF:
      'ThonkTank/Salt-Marcher/.github/workflows/release-fixtures.yml@refs/heads/main',
    GITHUB_SHA: execFileSync('git', ['rev-parse', 'HEAD'], {
      encoding: 'utf8'
    }).trim(),
    GITHUB_RUN_ID: '10',
    GITHUB_RUN_ATTEMPT: '1'
  }
  return { directory, origin, env }
}
function run(value: ReturnType<typeof setup>) {
  return spawnSync(
    process.execPath,
    ['--import', 'tsx', 'scripts/write-release-fixture.ts', value.directory],
    { env: value.env, encoding: 'utf8', timeout: 20_000 }
  )
}
it('writes a receipt that the actual comparison consumer verifies, without overwriting it', () => {
  const value = setup()
  const result = run(value)
  expect(result.status, result.stderr).toBe(0)
  const manifestBytes = readFileSync(
    join(value.directory, 'release-manifest.json')
  )
  const expected = comparisonArtifactSchema.parse({
    manifest: JSON.parse(manifestBytes.toString('utf8')) as unknown,
    manifestSha256: digestReleaseDocument(manifestBytes),
    source: {
      kind: 'qualification-fixture',
      workflowRunId: 10,
      workflowRunAttempt: 1,
      workflowCommit: value.env.GITHUB_SHA,
      artifactId: 20,
      artifactName: 'fixture-170-10-1'
    }
  })
  expect(verifyComparisonFiles(value.directory, expected)).toEqual(
    expected.manifest
  )
  expect(run(value).status).not.toBe(0)
  expect(readFileSync(join(value.directory, 'release-manifest.json'))).toEqual(
    manifestBytes
  )
})
it('requires the dedicated Main workflow and matching checkout', () => {
  const value = setup()
  value.env.GITHUB_REF = 'refs/heads/candidate'
  expect(run(value).status).not.toBe(0)
  value.env.GITHUB_REF = 'refs/heads/main'
  value.env.GITHUB_SHA = 'b'.repeat(40)
  expect(run(value).stderr).toContain('checkout differs')
  expect(existsSync(join(value.directory, 'release-manifest.json'))).toBe(false)
})
it('rejects corrupt original artifact bytes before producing a manifest', () => {
  const value = setup()
  writeFileSync(join(value.directory, value.origin.artifact.name), 'corrupt')
  expect(run(value).stderr).toContain('bytes differ')
  expect(existsSync(join(value.directory, 'release-manifest.json'))).toBe(false)
})
it('rejects the old implicit baseline invocation before any build or download', () => {
  const result = spawnSync(
    process.execPath,
    ['--import', 'tsx', 'scripts/package-release-baseline.ts'],
    { encoding: 'utf8', timeout: 20_000 }
  )
  expect(result.status).not.toBe(0)
  expect(result.stderr).toContain('No implicit baseline is supported')
})
