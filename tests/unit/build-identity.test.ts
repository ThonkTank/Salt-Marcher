import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { afterEach, describe, expect, it } from 'vitest'
import {
  computeAppBuildInputFingerprint,
  computeAppBuildInputFingerprintAtRef,
  computeWorkspaceFingerprint
} from '../../scripts/build-identity.js'
import {
  buildInfoSchema,
  shortBuildFingerprint
} from '../../src/shared/contracts/build-info.js'

const roots: string[] = []

afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true })
})

describe('build identity', () => {
  it('fingerprints tracked and untracked sources but ignores ignored output', () => {
    const root = mkdtempSync(join(tmpdir(), 'salt-marcher-identity-'))
    roots.push(root)
    git(root, 'init')
    writeFileSync(join(root, '.gitignore'), 'out/\n')
    writeFileSync(join(root, 'tracked.ts'), 'first')
    git(root, 'add', '.gitignore', 'tracked.ts')
    const first = computeWorkspaceFingerprint(root)

    mkdirSync(join(root, 'out'))
    writeFileSync(join(root, 'out', 'artifact.js'), 'ignored')
    expect(computeWorkspaceFingerprint(root)).toBe(first)

    writeFileSync(join(root, 'untracked.ts'), 'source')
    expect(computeWorkspaceFingerprint(root)).not.toBe(first)
  })

  it('represents deleted tracked files without requiring them on disk', () => {
    const root = mkdtempSync(join(tmpdir(), 'salt-marcher-identity-'))
    roots.push(root)
    git(root, 'init')
    const path = join(root, 'deleted.ts')
    writeFileSync(path, 'tracked')
    git(root, 'add', 'deleted.ts')
    const before = computeWorkspaceFingerprint(root)
    rmSync(path)

    expect(computeWorkspaceFingerprint(root)).not.toBe(before)
  })

  it('separates actual app build inputs from unrelated workspace files', () => {
    const root = mkdtempSync(join(tmpdir(), 'salt-marcher-identity-'))
    roots.push(root)
    git(root, 'init')
    mkdirSync(join(root, 'src'))
    mkdirSync(join(root, 'docs'))
    writeFileSync(join(root, 'src', 'app.ts'), 'first')
    writeFileSync(join(root, 'docs', 'note.md'), 'first')
    git(root, 'add', 'src/app.ts', 'docs/note.md')
    const firstApp = computeAppBuildInputFingerprint(root)
    const firstWorkspace = computeWorkspaceFingerprint(root)

    writeFileSync(join(root, 'docs', 'note.md'), 'second')
    expect(computeAppBuildInputFingerprint(root)).toBe(firstApp)
    expect(computeWorkspaceFingerprint(root)).not.toBe(firstWorkspace)

    writeFileSync(join(root, 'src', 'app.ts'), 'second')
    expect(computeAppBuildInputFingerprint(root)).not.toBe(firstApp)
  })

  it('compares app inputs across immutable application and evidence commits', () => {
    const root = mkdtempSync(join(tmpdir(), 'salt-marcher-ref-identity-'))
    roots.push(root)
    git(root, 'init')
    mkdirSync(join(root, 'src'))
    mkdirSync(join(root, 'docs'))
    writeFileSync(join(root, 'src', 'app.ts'), 'first')
    writeFileSync(join(root, 'docs', 'evidence.json'), '{}')
    git(root, 'add', 'src/app.ts', 'docs/evidence.json')
    git(
      root,
      '-c',
      'user.name=Test',
      '-c',
      'user.email=test@example.com',
      'commit',
      '-m',
      'application'
    )
    const application = gitOutput(root, 'rev-parse', 'HEAD')

    writeFileSync(join(root, 'docs', 'evidence.json'), '{"complete":true}')
    git(root, 'add', 'docs/evidence.json')
    git(
      root,
      '-c',
      'user.name=Test',
      '-c',
      'user.email=test@example.com',
      'commit',
      '-m',
      'evidence'
    )
    const evidence = gitOutput(root, 'rev-parse', 'HEAD')
    expect(computeAppBuildInputFingerprintAtRef(root, evidence)).toBe(
      computeAppBuildInputFingerprintAtRef(root, application)
    )

    writeFileSync(join(root, 'src', 'app.ts'), 'second')
    git(root, 'add', 'src/app.ts')
    git(
      root,
      '-c',
      'user.name=Test',
      '-c',
      'user.email=test@example.com',
      'commit',
      '-m',
      'changed app'
    )
    expect(computeAppBuildInputFingerprintAtRef(root, 'HEAD')).not.toBe(
      computeAppBuildInputFingerprintAtRef(root, application)
    )
  })

  it('validates and abbreviates embedded build information', () => {
    const info = buildInfoSchema.parse({
      channel: 'local',
      commit: 'a'.repeat(40),
      dirty: true,
      workspaceFingerprint: 'b'.repeat(64),
      appBuildInputFingerprint: 'c'.repeat(64),
      builtAt: '2026-08-15T12:00:00.000Z',
      schemaVersions: { installation: 28, campaign: 28 },
      migrationRegistryVersion: 1,
      toolchain: testToolchain()
    })
    expect(shortBuildFingerprint(info)).toBe('b'.repeat(12))
  })
})

function testToolchain() {
  return {
    node: 'v22.19.0',
    pnpm: '10.15.1',
    electron: '43.2.0',
    electronVite: '5.0.0',
    electronBuilder: '26.15.3',
    platform: 'linux',
    arch: 'x64'
  }
}

function git(root: string, ...arguments_: string[]): void {
  const result = spawnSync('git', arguments_, { cwd: root, encoding: 'utf8' })
  if (result.status !== 0) throw new Error(result.stderr)
}

function gitOutput(root: string, ...arguments_: string[]): string {
  const result = spawnSync('git', arguments_, { cwd: root, encoding: 'utf8' })
  if (result.status !== 0) throw new Error(result.stderr)
  return result.stdout.trim()
}
