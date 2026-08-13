import { readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { lintPartitions } from '../../scripts/lint-partitions.js'

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
})
