import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  lintPartitions,
  lintPartitionsFor
} from '../../scripts/lint-partitions.js'

describe('developer feedback partitions', () => {
  it('assigns every top-level source owner to exactly one lint process', () => {
    const sourceTargets = lintPartitions
      .flatMap((partition) => partition.targets)
      .filter((target) => target.startsWith('src/'))
    const sourceOwners = readdirSync('src', { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => `src/${entry.name}`)
    for (const owner of sourceOwners) {
      const matches = sourceTargets.filter(
        (target) => owner === target || owner.startsWith(`${target}/`)
      )
      expect(matches, `${owner} has no unique lint partition`).toHaveLength(1)
    }
    expect(sourceTargets).toContain('src/renderer')
    expect(sourceTargets).toContain('src/utility')
  })

  it('assigns every relevant TypeScript file to exactly one lint process', () => {
    const files = [
      ...typescriptFiles('src'),
      ...typescriptFiles('scripts'),
      ...typescriptFiles('tests'),
      'electron.vite.config.ts',
      'vitest.config.ts',
      'wdio.conf.ts',
      'wdio.passive.conf.ts'
    ]
    for (const file of files)
      expect(
        lintPartitionsFor(file),
        `${file} must have exactly one lint owner`
      ).toHaveLength(1)
  })

  it('keeps tests and scripts in explicit isolated partitions', () => {
    expect(
      lintPartitions.find((partition) => partition.name === 'tests')?.targets
    ).toEqual(['tests'])
    expect(
      lintPartitions
        .find((partition) => partition.name === 'electron-tooling')
        ?.targets.includes('scripts')
    ).toBe(true)
  })

  it('starts package CLIs through Node instead of Windows command shims', () => {
    const lintRunner = readFileSync('scripts/run-lint-partitions.ts', 'utf8')
    const e2eRunner = readFileSync('scripts/run-e2e-suites.ts', 'utf8')
    expect(lintRunner).toContain(
      "packageRequire.resolve('eslint/package.json')"
    )
    expect(lintRunner).toContain('spawn(\n      process.execPath')
    expect(lintRunner).not.toContain('eslint.cmd')
    expect(e2eRunner).toContain("packageRequire.resolve('@wdio/cli')")
    expect(e2eRunner).toContain('spawn(\n      process.execPath')
    expect(e2eRunner).not.toContain('wdio.cmd')
  })

  it('normalizes discovered repository paths across operating systems', () => {
    expect(repositoryPath('src\\core\\loot\\loot-store.ts')).toBe(
      'src/core/loot/loot-store.ts'
    )
  })

  it('keeps E2E evidence resumable, atomic, and free of hidden retries', () => {
    const runner = readFileSync('scripts/run-e2e-suites.ts', 'utf8')
    expect(runner).toContain("argumentAfter('--resume')")
    expect(runner).toContain("repeatedArguments('--suite')")
    expect(runner).toContain('buildIdentity !== buildIdentity')
    expect(runner).toContain('writeSuiteResult(')
    expect(runner).toContain('renameSync(temporary, path)')
    expect(runner).not.toMatch(/retry|retries/i)
  })
})

function typescriptFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name)
    if (entry.isDirectory()) return typescriptFiles(path)
    return /\.tsx?$/.test(entry.name) ? [repositoryPath(path)] : []
  })
}

function repositoryPath(path: string): string {
  return path.replaceAll('\\', '/')
}
