import { readFileSync } from 'node:fs'
import { expect } from 'vitest'
import { rawSourceRegexViolations } from '../../scripts/architecture/raw-source-regex-boundary.js'
import { sessionPreparationFailureSchema } from '../../src/shared/contracts/session-planner.js'
import {
  architectureGate,
  legitimateLiteralGate,
  legitimateLiteralMetadataViolations
} from './support/architecture-gate.js'
import {
  codeFiles,
  hasCall,
  hasImport,
  importCycles,
  parseTypeScriptModule,
  readTypeScriptModule,
  relativeImportGraph,
  scope
} from './support/typescript-module.js'

legitimateLiteralGate({
  name: 'keeps the focused Planner and Loot feedback loop complete',
  path: 'package.json',
  owner: 'developer-feedback',
  rationale:
    'The focused command is a package-manager configuration contract whose ordered tools and paths are literals.',
  inspect: (content) => {
    const manifest = JSON.parse(content) as { scripts: Record<string, string> }
    const check = manifest.scripts['check:planner-loot'] ?? ''
    for (const required of [
      'pnpm typecheck',
      'vitest run',
      'tests/architecture',
      'tests/integration/generated-run-store.test.ts',
      'tests/integration/session-planner-vertical-slice.test.ts',
      'tests/integration/loot-projection-store.test.ts',
      'pnpm build',
      'pnpm test:bundle-budget'
    ])
      expect(check).toContain(required)
  }
})

architectureGate(
  'import-dependency-boundary',
  'contains no raw regex assertions over TypeScript source',
  () => {
    const sources = Object.fromEntries(
      codeFiles('tests').map((path) => [path, readFileSync(path, 'utf8')])
    )
    expect(rawSourceRegexViolations(sources)).toEqual([])
  }
)

architectureGate(
  'import-dependency-boundary',
  'keeps local installation responsibilities directed and acyclic',
  () => {
    const internal = codeFiles('scripts/local-installation')
    expect(
      importCycles(
        relativeImportGraph(['scripts/local-app-installation.ts', ...internal])
      )
    ).toEqual([])

    const campaignModules = internal
      .filter((path) => path.includes('/campaign-'))
      .map(readTypeScriptModule)
    for (const module of campaignModules) {
      expect(hasImport(module, './deployment.js')).toBe(false)
      expect(hasImport(module, './recovery.js')).toBe(false)
    }

    const deployment = readTypeScriptModule(
      'scripts/local-installation/deployment.ts'
    )
    for (const campaignModule of [
      './campaign-backup.js',
      './campaign-file-inventory.js',
      './campaign-migration.js'
    ])
      expect(hasImport(deployment, campaignModule)).toBe(false)
  }
)

architectureGate(
  'behavior-integration',
  'snapshots live SQLite databases through the online backup API',
  () => {
    const backup = readTypeScriptModule(
      'scripts/local-installation/campaign-backup.ts'
    )
    const snapshot = scope(backup, 'snapshotCampaignDataWithDatabases')
    expect(snapshot?.calls).toContain('onlineBackupDatabase')
    expect(snapshot?.calls).toContain('copyTreeWithHashes')
    expect(snapshot?.identifiers.has('owned')).toBe(true)

    const worker = readTypeScriptModule(
      'scripts/sqlite-online-backup-worker.ts'
    )
    expect(hasImport(worker, 'better-sqlite3')).toBe(true)
    expect(hasCall(worker, 'database.backup')).toBe(true)

    const inventory = readTypeScriptModule(
      'scripts/local-installation/campaign-file-inventory.ts'
    )
    expect(inventory.declarations.has('sqliteOwnedBackupInventory')).toBe(true)
    expect(
      scope(inventory, 'sqliteOwnedBackupInventory')?.identifiers.has('bytes')
    ).toBe(false)
  }
)

legitimateLiteralGate({
  name: 'pins one exact Node runtime across reusable-build CI jobs',
  path: '.github/workflows/check.yml',
  owner: 'candidate-artifact-toolchain',
  rationale:
    'The reusable build receipt includes the Node patch version, so every producer and consumer job must resolve the same literal runtime.',
  inspect: (workflow) => {
    const versions = [...workflow.matchAll(/node-version:\s*([^, }\n]+)/g)].map(
      (match) => match[1]
    )
    expect(versions.length).toBeGreaterThan(0)
    expect(new Set(versions)).toEqual(new Set(['22.23.2']))
  }
})

architectureGate(
  'typed-contract',
  'preserves the public local installation module surface',
  async () => {
    const installation = await import('../../scripts/local-app-installation.js')
    expect(Object.keys(installation).sort()).toEqual([
      'LocalInstallCrashForTest',
      'LocalInstallationError',
      'advanceLocalAppInstallation',
      'inspectLocalAppInstallation',
      'installLocalApp',
      'isInstalledLocalAppRunning',
      'localInstallationPaths',
      'localInstallationTargets'
    ])
  }
)

architectureGate(
  'behavior-integration',
  'detects controlled mutations for every semantic replacement type',
  () => {
    const astMutation = parseTypeScriptModule(
      'mutation.ts',
      "import { api } from './forbidden.js'; api.write()"
    )
    expect(astMutation.imports).toContainEqual(
      expect.objectContaining({ specifier: './forbidden.js' })
    )
    expect(astMutation.calls).toContain('api.write')

    expect(
      importCycles(
        new Map([
          ['a.ts', ['b.ts']],
          ['b.ts', ['a.ts']]
        ])
      )
    ).toEqual([['a.ts', 'b.ts', 'a.ts']])

    expect(
      sessionPreparationFailureSchema.safeParse({
        stage: 'generation',
        code: 'mutated',
        retryable: true,
        parameters: { invalid: { nested: true } }
      }).success
    ).toBe(false)

    expect(
      rawSourceRegexViolations({
        'mutation.test.ts': `
          import { readFileSync } from 'node:fs'
          import { expect } from 'vitest'
          const source = readFileSync('src/mutated.ts', 'utf8')
          expect(source).not.toMatch(/forbidden/)
        `
      })
    ).toEqual([{ path: 'mutation.test.ts', line: 5, matcher: 'toMatch' }])

    expect(
      legitimateLiteralMetadataViolations({ owner: '', rationale: 'short' })
    ).toEqual(['owner', 'rationale'])
  }
)
