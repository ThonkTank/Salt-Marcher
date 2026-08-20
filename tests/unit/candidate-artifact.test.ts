import { createHash } from 'node:crypto'
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  acquireCandidateArtifact,
  candidateArtifactName,
  candidateArtifactReceiptFile,
  candidateArtifactReceiptSchema,
  createCandidateArtifactReceipt,
  verifyCandidateArtifactDirectory,
  type CandidateArtifactExpectation
} from '../../scripts/candidate-artifact.js'

const roots: string[] = []
const sha = 'a'.repeat(40)
const workspaceFingerprint = 'b'.repeat(64)
const appBuildInputFingerprint = 'c'.repeat(64)
const expected: CandidateArtifactExpectation = {
  repository: 'ThonkTank/Salt-Marcher',
  workflowName: 'Check',
  workflowRunId: 42,
  workflowRunAttempt: 2,
  applicationSha: sha,
  workspaceFingerprint,
  appBuildInputFingerprint
}

afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true })
})

describe('candidate Local artifact', () => {
  it('binds the closed artifact inventory to the exact workflow and Build Receipt', () => {
    const root = fixture()
    const artifact = verifyCandidateArtifactDirectory(root, expected)

    expect(artifact.receipt).toMatchObject({
      artifactName: candidateArtifactName(sha, 2),
      workflowRunId: 42,
      workflowRunAttempt: 2,
      applicationSha: sha,
      workspaceFingerprint,
      appBuildInputFingerprint
    })
    expect(readdirSync(root).sort()).toEqual(
      [
        'SaltMarcher-Local-0.1.0.AppImage',
        'SaltMarcher-Local-0.1.0.AppImage.manifest.json',
        candidateArtifactReceiptFile
      ].sort()
    )
  })

  it.each([
    ['repository', 'Elsewhere/Salt-Marcher'],
    ['workflowRunId', 41],
    ['workflowRunAttempt', 1],
    ['applicationSha', 'd'.repeat(40)],
    ['workspaceFingerprint', 'd'.repeat(64)],
    ['appBuildInputFingerprint', 'd'.repeat(64)]
  ] as const)('rejects a mismatched %s', (field, value) => {
    const root = fixture()
    mutateReceipt(root, { [field]: value })
    expect(() => verifyCandidateArtifactDirectory(root, expected)).toThrow(
      /another run or workspace/
    )
  })

  it('rejects extra files, changed artifact bytes, and a forged toolchain', () => {
    const extra = fixture()
    writeFileSync(join(extra, 'unproved.txt'), 'no')
    expect(() => verifyCandidateArtifactDirectory(extra, expected)).toThrow(
      /exactly its three proved files/
    )

    const changed = fixture()
    writeFileSync(join(changed, 'SaltMarcher-Local-0.1.0.AppImage'), 'changed')
    expect(() => verifyCandidateArtifactDirectory(changed, expected)).toThrow(
      /hash chain/
    )

    const forged = fixture()
    const receipt = readReceipt(forged)
    mutateReceipt(forged, {
      toolchain: { ...receipt.toolchain, node: 'v0.0.0' }
    })
    expect(() => verifyCandidateArtifactDirectory(forged, expected)).toThrow(
      /hash chain/
    )
  })

  it('reuses a valid cache without downloading', () => {
    const root = fixture()
    const artifactPath = join(root, 'SaltMarcher-Local-0.1.0.AppImage')
    const download = vi.fn()
    expect(
      acquireCandidateArtifact({
        destinationRoot: root,
        expected,
        download
      }).receipt.applicationSha
    ).toBe(sha)
    expect(download).not.toHaveBeenCalled()
    expect(statSync(artifactPath).mode & 0o111).toBe(0o111)
  })

  it('atomically replaces stale generated cache only after download verifies', () => {
    const parent = temporaryRoot()
    const source = fixture()
    const destination = join(parent, 'local')
    mkdirSync(destination)
    writeFileSync(join(destination, 'partial'), 'stale')

    const artifact = acquireCandidateArtifact({
      destinationRoot: destination,
      expected,
      download: (target) => copyFiles(source, target)
    })

    expect(artifact.receipt.workflowRunId).toBe(42)
    expect(readdirSync(destination)).not.toContain('partial')
  })

  it('does not destroy stale cache when a replacement fails validation', () => {
    const parent = temporaryRoot()
    const destination = join(parent, 'local')
    mkdirSync(destination)
    writeFileSync(join(destination, 'partial'), 'stale')

    expect(() =>
      acquireCandidateArtifact({
        destinationRoot: destination,
        expected,
        download: (target) => writeFileSync(join(target, 'unproved'), 'bad')
      })
    ).toThrow()
    expect(readFileSync(join(destination, 'partial'), 'utf8')).toBe('stale')
  })
})

function fixture(): string {
  const root = temporaryRoot()
  const artifactFile = 'SaltMarcher-Local-0.1.0.AppImage'
  const artifactPath = join(root, artifactFile)
  writeFileSync(artifactPath, 'candidate-appimage')
  const receipt = {
    formatVersion: 2 as const,
    build: {
      channel: 'local' as const,
      commit: sha,
      dirty: false,
      workspaceFingerprint,
      appBuildInputFingerprint,
      builtAt: '2026-08-20T00:00:00.000Z',
      schemaVersions: { installation: 1, campaign: 35 },
      migrationRegistryVersion: 35,
      toolchain: {
        node: 'v22.19.0',
        pnpm: '10.15.1',
        electron: '43.2.0',
        electronVite: '5.0.0',
        electronBuilder: '26.15.3',
        platform: 'linux',
        arch: 'x64'
      }
    },
    outputHash: 'd'.repeat(64),
    files: [
      {
        path: 'main/index.js',
        bytes: 3,
        sha256: 'e'.repeat(64)
      }
    ]
  }
  const manifest = {
    formatVersion: 2 as const,
    artifactFile,
    artifactSha256: hash('candidate-appimage'),
    receiptSha256: hash(JSON.stringify(receipt)),
    receipt
  }
  writeFileSync(
    join(root, `${artifactFile}.manifest.json`),
    JSON.stringify(manifest)
  )
  const candidateReceipt = createCandidateArtifactReceipt({
    root,
    repository: expected.repository,
    workflowName: expected.workflowName,
    workflowRunId: expected.workflowRunId,
    workflowRunAttempt: expected.workflowRunAttempt,
    applicationSha: expected.applicationSha
  })
  writeFileSync(
    join(root, candidateArtifactReceiptFile),
    JSON.stringify(candidateReceipt)
  )
  return root
}

function temporaryRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'salt-marcher-candidate-artifact-'))
  roots.push(root)
  return root
}

function readReceipt(root: string) {
  return candidateArtifactReceiptSchema.parse(
    JSON.parse(readFileSync(join(root, candidateArtifactReceiptFile), 'utf8'))
  )
}

function mutateReceipt(root: string, patch: Record<string, unknown>): void {
  writeFileSync(
    join(root, candidateArtifactReceiptFile),
    JSON.stringify({ ...readReceipt(root), ...patch })
  )
}

function copyFiles(source: string, destination: string): void {
  for (const entry of readdirSync(source))
    copyFileSync(join(source, entry), join(destination, entry))
}

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}
