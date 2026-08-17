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
    const e2eConfiguration = readFileSync('wdio.conf.ts', 'utf8')
    const buildRunner = readFileSync('scripts/package-cli.ts', 'utf8')
    const applicationBuild = readFileSync('scripts/build-app.ts', 'utf8')
    expect(lintRunner).toContain(
      "packageRequire.resolve('eslint/package.json')"
    )
    expect(lintRunner).toContain('spawn(\n      process.execPath')
    expect(lintRunner).not.toContain('eslint.cmd')
    expect(e2eRunner).toContain("packageRequire.resolve('@wdio/cli')")
    expect(e2eRunner).toContain('spawn(\n      process.execPath')
    expect(e2eRunner).not.toContain('wdio.cmd')
    expect(e2eConfiguration).toContain("packageRequire.resolve('tsx/cli')")
    expect(e2eConfiguration).toContain('spawnSync(\n  process.execPath')
    expect(e2eConfiguration).not.toContain("'.bin', 'tsx'")
    expect(buildRunner).toContain("packageRequire.resolve('tsx/cli')")
    expect(buildRunner).toContain(
      "packageRequire.resolve('electron-vite/package.json')"
    )
    expect(buildRunner).toContain('spawnSync(process.execPath')
    expect(applicationBuild).not.toContain('corepack')
  })

  it('normalizes discovered repository paths across operating systems', () => {
    expect(repositoryPath('src\\core\\loot\\loot-store.ts')).toBe(
      'src/core/loot/loot-store.ts'
    )
  })
})

describe('group Loot architecture refactor', () => {
  it('keeps one React reducer as the sole GroupManager state owner', () => {
    const owners = typescriptFiles('src/renderer/features/session')
      .filter((file) => /group-|use-group-/.test(file))
      .filter((file) => readFileSync(file, 'utf8').includes('useReducer('))
    expect(owners).toEqual([
      'src/renderer/features/session/use-group-manager-controller.ts'
    ])
    const controller = readFileSync(owners[0]!, 'utf8')
    expect(controller).not.toMatch(/useState|useRef/)
    expect(
      readFileSync(
        'src/renderer/features/session/group-manager-state.ts',
        'utf8'
      )
    ).toMatch(/sessions:[\s\S]*pendingIntent:[\s\S]*requests:/)
  })

  it('separates the capability adapter from pure GroupManager views', () => {
    const dialog = readFileSync(
      'src/renderer/features/session/group-dialog.tsx',
      'utf8'
    )
    const view = readFileSync(
      'src/renderer/features/session/group-manager-view.tsx',
      'utf8'
    )
    expect(dialog.split('\n').length).toBeLessThan(40)
    expect(dialog).toContain('useGroupManagerCapabilityPorts')
    expect(view).not.toMatch(/useCapabilityApi|live-session|session-surface/)
  })

  it('keeps utility bootstrap tiny and generated SQL in one writer', () => {
    const entry = readFileSync('src/utility/index.ts', 'utf8')
    expect(entry.split('\n').length).toBeLessThan(20)
    expect(entry).toContain("import('./application.js')")
    expect(entry).toContain('coreStartupFailureSchema')
    const application = readFileSync('src/utility/application.ts', 'utf8')
    expect(application.split('\n').length).toBeLessThan(900)
    for (const module of [
      'biome',
      'campaign',
      'hex',
      'live-play',
      'loot',
      'reference',
      'session-planner',
      'travel',
      'world-planner'
    ])
      expect(
        readFileSync(`src/utility/composition/${module}.ts`, 'utf8')
      ).toContain('Pick<CoreHandlers')
    expect(application).not.toContain("'campaign.list':")
    expect(application).not.toContain("'loot.catalog':")
    expect(application).not.toContain("'hex.editorBootstrap':")
    const generatedSqlOwners = typescriptFiles('src/core/loot').filter((file) =>
      /INSERT INTO loot_(?:treasure|container|item)/.test(
        readFileSync(file, 'utf8')
      )
    )
    expect(generatedSqlOwners).toContain(
      'src/core/loot/treasure-aggregate-writer.ts'
    )
    const store = readFileSync('src/core/loot/loot-store.ts', 'utf8')
    expect(store).toContain('this.aggregateWriter.insertGenerated')
  })

  it('keeps E2E evidence resumable, atomic, and free of hidden retries', () => {
    const runner = readFileSync('scripts/run-e2e-suites.ts', 'utf8')
    expect(runner).toContain("argumentAfter('--resume')")
    expect(runner).toContain("repeatedArguments('--suite')")
    expect(runner).toContain('validateE2eResumeIdentity(resumed')
    expect(runner).toContain('writeSuiteResult(')
    expect(runner).toContain('renameSync(temporary, path)')
    expect(runner).not.toMatch(/retry|retries/i)
  })

  it('publishes catalog artifacts without overwriting or implicit activation', () => {
    const importer = readFileSync(
      'scripts/import-session-generation-catalog.ts',
      'utf8'
    )
    expect(importer).toContain('if (existsSync(destinationRoot))')
    expect(importer).toContain("arguments_.includes('--activate')")
    expect(importer).toContain(
      'renameSync(temporaryDestinationRoot, destinationRoot)'
    )
    expect(importer).toContain(
      'renameSync(temporaryRegistryPath, registryPath)'
    )
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
