import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect } from 'vitest'
import {
  lintPartitions,
  lintPartitionsFor
} from '../../scripts/lint-partitions.js'
import {
  hasCall,
  hasImport,
  readTypeScriptModule
} from '../architecture/support/typescript-module.js'
import { architectureGate } from '../architecture/support/architecture-gate.js'

describe('developer feedback partitions', () => {
  architectureGate(
    'behavior-integration',
    'assigns every top-level source owner to exactly one lint process',
    () => {
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
    }
  )

  architectureGate(
    'behavior-integration',
    'assigns every relevant TypeScript file to exactly one lint process',
    () => {
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
    }
  )

  architectureGate(
    'typed-contract',
    'keeps tests and scripts in explicit isolated partitions',
    () => {
      expect(
        lintPartitions.find((partition) => partition.name === 'tests')?.targets
      ).toEqual(['tests'])
      expect(
        lintPartitions
          .find((partition) => partition.name === 'electron-tooling')
          ?.targets.includes('scripts')
      ).toBe(true)
    }
  )

  architectureGate(
    'import-dependency-boundary',
    'starts package CLIs through Node instead of Windows command shims',
    () => {
      const lintRunner = readTypeScriptModule('scripts/run-lint-partitions.ts')
      const e2eRunner = readTypeScriptModule('scripts/run-e2e-suites.ts')
      const e2eCore = readTypeScriptModule('scripts/e2e-runner-core.ts')
      const e2eConfiguration = readTypeScriptModule('wdio.conf.ts')
      const buildRunner = readTypeScriptModule('scripts/package-cli.ts')
      const applicationBuild = readTypeScriptModule('scripts/build-app.ts')
      expect(lintRunner.stringLiterals).toContain('eslint/package.json')
      expect(hasCall(lintRunner, 'spawn')).toBe(true)
      expect(lintRunner.identifiers.has('process')).toBe(true)
      expect(lintRunner.stringLiterals).not.toContain('eslint.cmd')
      expect(e2eCore.stringLiterals).toContain('@wdio/cli')
      expect(hasCall(e2eCore, 'spawn')).toBe(true)
      expect([
        ...e2eRunner.stringLiterals,
        ...e2eCore.stringLiterals
      ]).not.toContain('wdio.cmd')
      expect(e2eConfiguration.stringLiterals).toContain('tsx/cli')
      expect(hasCall(e2eConfiguration, 'spawnSync')).toBe(true)
      expect(e2eConfiguration.stringLiterals).not.toContain('.bin')
      expect(buildRunner.stringLiterals).toEqual(
        expect.arrayContaining(['tsx/cli', 'electron-vite/package.json'])
      )
      expect(hasCall(buildRunner, 'spawnSync')).toBe(true)
      expect(applicationBuild.stringLiterals).not.toContain('corepack')
    }
  )

  architectureGate(
    'behavior-integration',
    'normalizes discovered repository paths across operating systems',
    () => {
      expect(repositoryPath('src\\core\\loot\\loot-store.ts')).toBe(
        'src/core/loot/loot-store.ts'
      )
    }
  )
})

describe('group Loot architecture refactor', () => {
  architectureGate(
    'import-dependency-boundary',
    'separates the capability adapter from pure GroupManager views',
    () => {
      const dialog = readTypeScriptModule(
        'src/renderer/features/session/group-dialog.tsx'
      )
      const view = readTypeScriptModule(
        'src/renderer/features/session/group-manager-view.tsx'
      )
      expect(hasCall(dialog, 'useGroupManagerCapabilityPorts')).toBe(true)
      expect(view.identifiers.has('useCapabilityApi')).toBe(false)
      expect(
        view.imports.some(({ specifier }) =>
          ['live-session', 'session-surface'].some((part) =>
            specifier.includes(part)
          )
        )
      ).toBe(false)
    }
  )

  architectureGate(
    'import-dependency-boundary',
    'keeps generated SQL in one writer',
    () => {
      const entry = readTypeScriptModule('src/utility/index.ts')
      expect(hasImport(entry, './application.js', 'dynamic')).toBe(true)
      expect(entry.identifiers.has('coreStartupFailureSchema')).toBe(true)
      const generatedSqlOwners = typescriptFiles('src/core/loot').filter(
        (file) =>
          readTypeScriptModule(file).stringLiterals.some((value) =>
            /INSERT INTO loot_(?:treasure|container|item)/.test(value)
          )
      )
      expect(generatedSqlOwners).toContain(
        'src/core/loot/treasure-aggregate-writer.ts'
      )
      expect(
        hasCall(
          readTypeScriptModule('src/core/loot/loot-store.ts'),
          'this.aggregateWriter.insertGenerated'
        )
      ).toBe(true)
    }
  )

  architectureGate(
    'behavior-integration',
    'keeps E2E evidence resumable, atomic, and free of hidden retries',
    () => {
      const runner = readTypeScriptModule('scripts/run-e2e-suites.ts')
      const core = readTypeScriptModule('scripts/e2e-runner-core.ts')
      expect(hasCall(runner, 'argumentAfter')).toBe(true)
      expect(runner.stringLiterals).toContain('--resume')
      expect(hasCall(runner, 'repeatedArguments')).toBe(true)
      expect(runner.stringLiterals).toContain('--suite')
      expect(hasCall(core, 'validateE2eResumeIdentity')).toBe(true)
      expect(hasCall(core, 'writeSuiteResult')).toBe(true)
      expect(hasCall(core, 'renameSync')).toBe(true)
      expect(
        [...runner.identifiers, ...core.identifiers].filter((name) =>
          ['retry', 'retries'].includes(name.toLowerCase())
        )
      ).toEqual([])
    }
  )

  architectureGate(
    'behavior-integration',
    'publishes catalog artifacts without overwriting or implicit activation',
    () => {
      const importer = readTypeScriptModule(
        'scripts/import-session-generation-catalog.ts'
      )
      expect(hasCall(importer, 'existsSync')).toBe(true)
      expect(hasCall(importer, 'arguments_.includes')).toBe(true)
      expect(importer.stringLiterals).toContain('--activate')
      expect(hasCall(importer, 'renameSync')).toBe(true)
    }
  )
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
