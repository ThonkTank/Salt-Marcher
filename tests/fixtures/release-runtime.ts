import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { artifact } from './release-request.js'
import { digestReleaseDocument } from '../../scripts/release/qualification.js'
import { readUpdateArtifact } from '../../scripts/qualification/update-artifact.js'
const roots: string[] = []
export function cleanupRuntimeFixtures() {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true })
}
export type RuntimeFixtureOptions = {
  version?: string
  commit?: string
  installation?: number
  campaign?: number
}
export function runtimeFixture(
  kind: 'release' | 'historical-fixture',
  options: RuntimeFixtureOptions = {}
) {
  const directory = mkdtempSync(join(tmpdir(), 'runtime-evidence-'))
  roots.push(directory)
  const manifest = artifact(
    options.version ?? (kind === 'release' ? '0.3.0' : '0.2.0'),
    options.commit ?? (kind === 'release' ? 'a' : 'b'),
    options.installation ?? 43,
    options.campaign ?? 43
  ).manifest
  const bytes = Buffer.from(
    `inert test bytes ${manifest.version} ${manifest.commit}`
  )
  manifest.artifact.bytes = bytes.length
  manifest.artifact.sha256 = digestReleaseDocument(bytes)
  writeFileSync(join(directory, manifest.artifact.name), bytes)
  writeFileSync(
    join(directory, 'release-manifest.json'),
    JSON.stringify(manifest)
  )
  if (kind === 'historical-fixture')
    writeFileSync(
      join(directory, 'historical-artifact.json'),
      JSON.stringify({
        formatVersion: 1,
        evidence: 'historical-test-artifact-not-public-release',
        version: manifest.version,
        artifact: manifest.artifact,
        source: {
          formatVersion: 1,
          evidence: 'source-inspection-only',
          id: 'test',
          commit: manifest.commit,
          schemaVersions: manifest.schemaVersions,
          tree: 'b'.repeat(40),
          packageVersion: '0.2.0',
          packageManager: 'pnpm@10.15.1',
          files: []
        }
      })
    )
  const target = readUpdateArtifact(directory)
  const requestId = '11111111-1111-4111-8111-111111111111'
  const report = {
    formatVersion: 1,
    artifactVersion: manifest.version,
    operation: 'identity',
    ...(kind === 'release'
      ? {
          build: {
            channel: 'release',
            commit: manifest.commit,
            dirty: false,
            workspaceFingerprint: 'b'.repeat(64),
            appBuildInputFingerprint: 'c'.repeat(64),
            builtAt: '2026-09-12T10:00:00Z',
            schemaVersions: manifest.schemaVersions,
            migrationRegistryVersion: 24,
            toolchain: {
              node: '22.23.2',
              pnpm: '10.15.1',
              electron: '43.2.0',
              electronVite: '5.0.0',
              electronBuilder: '26.15.3',
              platform: 'linux',
              arch: 'x64'
            }
          }
        }
      : {}),
    response: {
      ok: true,
      requestId,
      result: {
        schemaVersions: manifest.schemaVersions,
        nodeVersion: '24.18.0',
        electronVersion: '43.2.0'
      }
    }
  }
  const envelope = {
    formatVersion: 1,
    requestId,
    operation: 'identity',
    artifactSha256: manifest.artifact.sha256,
    sourceCommit: manifest.commit,
    resultSha256: digestReleaseDocument(Buffer.from(JSON.stringify(report))),
    exitCode: 0,
    result: report,
    ...(target.kind === 'release'
      ? {
          artifactKind: 'release',
          manifestSha256: target.provenance.manifestSha256
        }
      : { interruption: null, receiptSha256: target.provenance.receiptSha256 })
  }
  return { target, envelope }
}
