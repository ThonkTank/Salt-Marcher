import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { afterEach, describe, expect, it } from 'vitest'
import {
  computeAppBuildInputFingerprint,
  computeAppBuildInputFingerprintAtRef,
  computeDeliveryInputFingerprint,
  computeQualificationInputFingerprint,
  computeWorkspaceFingerprint
} from '../../scripts/build-identity.js'
import { classifyWorkspaceInput } from '../../scripts/workspace-input-classification.js'
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

  it('classifies build, qualification, delivery, and documentation inputs explicitly', () => {
    expect(classifyWorkspaceInput('src/main/index.ts')).toEqual(['app-build'])
    expect(classifyWorkspaceInput('resources/catalog/items.json')).toEqual([
      'app-build'
    ])
    expect(classifyWorkspaceInput('tests/unit/build.test.ts')).toEqual([
      'qualification'
    ])
    expect(
      classifyWorkspaceInput(
        'scripts/qualification/current-format-root-readback.ts'
      )
    ).toEqual(['qualification'])
    expect(classifyWorkspaceInput('.github/workflows/check.yml')).toEqual([
      'delivery-tooling'
    ])
    expect(classifyWorkspaceInput('scripts/candidate-artifact.ts')).toEqual([
      'delivery-tooling'
    ])
    expect(classifyWorkspaceInput('docs/project/vision.md')).toEqual([
      'documentation'
    ])
    expect(
      classifyWorkspaceInput(
        'docs/project/evidence/frontend-robustness-current-format-root-fixture.v1.json'
      )
    ).toEqual(['qualification', 'documentation'])
    expect(classifyWorkspaceInput('pnpm-lock.yaml')).toEqual([
      'app-build',
      'qualification',
      'delivery-tooling'
    ])
  })

  it('changes only the fingerprints affected by representative mutations', () => {
    const cases: readonly Readonly<{
      path: string
      changed: readonly ('app' | 'qualification' | 'delivery')[]
    }>[] = [
      { path: 'src/app.ts', changed: ['app'] },
      { path: 'resources/catalog.json', changed: ['app'] },
      { path: 'electron-builder.local.yml', changed: ['app'] },
      { path: 'tests/unit/app.test.ts', changed: ['qualification'] },
      { path: 'vitest.config.ts', changed: ['qualification'] },
      { path: 'scripts/candidate-delivery.ts', changed: ['delivery'] },
      { path: '.github/workflows/check.yml', changed: ['delivery'] },
      { path: 'docs/note.md', changed: [] },
      {
        path: 'pnpm-lock.yaml',
        changed: ['app', 'qualification', 'delivery']
      }
    ]

    for (const mutation of cases) {
      const root = classifiedFixture()
      const before = inputFingerprints(root)
      writeFileSync(join(root, mutation.path), 'mutated')
      const after = inputFingerprints(root)
      expect(changedFingerprints(before, after), mutation.path).toEqual(
        mutation.changed
      )
    }
  })

  it('projects package metadata semantically for each input class', () => {
    const productionRoot = classifiedFixture()
    const productionBefore = inputFingerprints(productionRoot)
    writePackage(productionRoot, {
      dependencies: { react: '20.0.0' }
    })
    expect(
      changedFingerprints(productionBefore, inputFingerprints(productionRoot))
    ).toEqual(['app'])

    const administrativeRoot = classifiedFixture()
    const administrativeBefore = inputFingerprints(administrativeRoot)
    writePackage(administrativeRoot, {
      scripts: { maintenance: 'tsx scripts/maintenance.ts' }
    })
    expect(
      changedFingerprints(
        administrativeBefore,
        inputFingerprints(administrativeRoot)
      )
    ).toEqual(['delivery'])

    const qualificationRoot = classifiedFixture()
    const qualificationBefore = inputFingerprints(qualificationRoot)
    writePackage(qualificationRoot, {
      scripts: { test: 'vitest run --changed' }
    })
    expect(
      changedFingerprints(
        qualificationBefore,
        inputFingerprints(qualificationRoot)
      )
    ).toEqual(['qualification', 'delivery'])
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

  it('uses the semantic package projection at immutable refs', () => {
    const root = classifiedFixture()
    git(
      root,
      '-c',
      'user.name=Test',
      '-c',
      'user.email=test@example.com',
      'commit',
      '-m',
      'baseline'
    )
    const baseline = gitOutput(root, 'rev-parse', 'HEAD')

    writePackage(root, { scripts: { maintenance: 'tsx scripts/other.ts' } })
    git(root, 'add', 'package.json')
    git(
      root,
      '-c',
      'user.name=Test',
      '-c',
      'user.email=test@example.com',
      'commit',
      '-m',
      'administrative alias'
    )
    const administrative = gitOutput(root, 'rev-parse', 'HEAD')
    expect(computeAppBuildInputFingerprintAtRef(root, administrative)).toBe(
      computeAppBuildInputFingerprintAtRef(root, baseline)
    )

    writePackage(root, { dependencies: { react: '20.0.0' } })
    git(root, 'add', 'package.json')
    git(
      root,
      '-c',
      'user.name=Test',
      '-c',
      'user.email=test@example.com',
      'commit',
      '-m',
      'production dependency'
    )
    expect(computeAppBuildInputFingerprintAtRef(root, 'HEAD')).not.toBe(
      computeAppBuildInputFingerprintAtRef(root, administrative)
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
    expect(shortBuildFingerprint(info)).toBe('c'.repeat(12))
  })
})

function classifiedFixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'salt-marcher-classification-'))
  roots.push(root)
  git(root, 'init')
  for (const directory of [
    'src',
    'resources',
    'tests/unit',
    'docs',
    'scripts',
    '.github/workflows'
  ])
    mkdirSync(join(root, directory), { recursive: true })
  writeFileSync(join(root, 'src/app.ts'), 'app')
  writeFileSync(join(root, 'resources/catalog.json'), '{}')
  writeFileSync(join(root, 'tests/unit/app.test.ts'), 'test')
  writeFileSync(join(root, 'docs/note.md'), 'documentation')
  writeFileSync(join(root, 'scripts/candidate-delivery.ts'), 'delivery')
  writeFileSync(join(root, '.github/workflows/check.yml'), 'workflow')
  writeFileSync(join(root, 'electron-builder.local.yml'), 'extends: base')
  writeFileSync(join(root, 'vitest.config.ts'), 'qualification')
  writeFileSync(join(root, 'pnpm-lock.yaml'), 'lockfileVersion: 9')
  writeFileSync(join(root, 'pnpm-workspace.yaml'), 'packages: []')
  writePackage(root)
  git(root, 'add', '.')
  return root
}

function writePackage(
  root: string,
  patch: Readonly<{
    dependencies?: Readonly<Record<string, string>>
    scripts?: Readonly<Record<string, string>>
  }> = {}
): void {
  writeFileSync(
    join(root, 'package.json'),
    JSON.stringify({
      name: 'fixture',
      version: '1.0.0',
      type: 'module',
      main: 'out/main.js',
      packageManager: 'pnpm@10.15.1',
      scripts: {
        build: 'tsx scripts/build-app.ts',
        test: 'vitest run',
        ...patch.scripts
      },
      dependencies: { react: '19.0.0', ...patch.dependencies },
      devDependencies: {
        electron: '43.2.0',
        'electron-builder': '26.15.3',
        'electron-vite': '5.0.0',
        vitest: '4.1.10'
      }
    })
  )
}

function inputFingerprints(root: string) {
  return {
    app: computeAppBuildInputFingerprint(root),
    qualification: computeQualificationInputFingerprint(root),
    delivery: computeDeliveryInputFingerprint(root)
  }
}

function changedFingerprints(
  before: ReturnType<typeof inputFingerprints>,
  after: ReturnType<typeof inputFingerprints>
): ('app' | 'qualification' | 'delivery')[] {
  return (['app', 'qualification', 'delivery'] as const).filter(
    (name) => before[name] !== after[name]
  )
}

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
