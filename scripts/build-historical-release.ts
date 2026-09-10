import { execFileSync } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import { parseArgs } from 'node:util'
import { build } from 'vite'
import { z } from 'zod'
import { releaseVersionSchema } from '../src/shared/contracts/release.js'
import {
  historicalReleaseSources,
  inspectHistoricalSource
} from './qualification/historical-release-sources.js'

const { values } = parseArgs({
  options: {
    source: { type: 'string' },
    version: { type: 'string' },
    output: { type: 'string' },
    fixture: { type: 'string' },
    'maintenance-interruption': { type: 'boolean', default: false }
  }
})
const selected = historicalReleaseSources.find(({ id }) => id === values.source)
if (!selected || !values.output)
  throw new Error(
    'Use --source <id> --version <test-version> --output <new-directory>'
  )
if (process.platform !== 'linux' || process.arch !== 'x64')
  throw new Error('Historical artifact qualification requires Linux x86_64')
const version = releaseVersionSchema.parse(values.version)
const workspace = process.cwd()
const output = resolve(values.output)
if (existsSync(output))
  throw new Error('Historical artifact output already exists')
const source = inspectHistoricalSource(workspace, selected)
const fixture = z
  .enum(['loot', 'world'])
  .parse(
    values.fixture ??
      (['loot30', 'loot31'].includes(selected.id) ? 'loot' : 'world')
  )
const harnessRoot = join(workspace, 'scripts/qualification/historical-runtime')
const digest = (path: string) =>
  createHash('sha256').update(readFileSync(path)).digest('hex')
const harness = readdirSync(harnessRoot)
  .filter((path) => path.endsWith('.ts'))
  .sort()
  .map((path) => ({
    path,
    sha256: digest(join(harnessRoot, path))
  }))
const builderSha256 = digest(
  join(workspace, 'scripts/build-historical-release.ts')
)
const checkout = join(
  workspace,
  '.tmp',
  `historical-${selected.id}-${randomUUID()}`
)
execFileSync('git', ['worktree', 'add', '--detach', checkout, source.commit], {
  cwd: workspace,
  stdio: 'inherit'
})
const run = (args: string[]) =>
  execFileSync('corepack', ['pnpm', ...args], {
    cwd: checkout,
    stdio: 'inherit'
  })
const assertOriginal = () => {
  const changed = execFileSync(
    'git',
    ['status', '--porcelain', '--untracked-files=no'],
    { cwd: checkout, encoding: 'utf8' }
  )
  const head = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: checkout,
    encoding: 'utf8'
  }).trim()
  if (changed || head !== source.commit)
    throw new Error('Historical source tree changed during build')
}
assertOriginal()
run(['install', '--frozen-lockfile'])
run(['build:release'])
assertOriginal()
const harnessModules = new Map<string, string>()
for (const entry of ['main', 'worker']) {
  await build({
    configFile: false,
    root: checkout,
    plugins: [
      {
        name: 'historical-harness-source-evidence',
        transform(_code, id) {
          const path = id.split('?')[0]!
          if (
            path.startsWith(workspace + sep) &&
            !path.startsWith(checkout + sep) &&
            existsSync(path) &&
            statSync(path).isFile()
          ) {
            const hash = digest(path)
            const previous = harnessModules.get(path)
            if (previous && previous !== hash)
              throw new Error('Harness dependency changed between bundles')
            harnessModules.set(path, hash)
          }
        }
      }
    ],
    resolve: {
      alias: {
        '@qualification/profile': join(
          harnessRoot,
          fixture === 'loot' ? 'loot-profile.ts' : 'profile.ts'
        ),
        '@historical/legacy-generation': join(
          checkout,
          'src/utility/session-generation/session-generation-service.ts'
        ),
        '@historical/legacy-catalog': join(
          checkout,
          'src/utility/session-generation/catalog-provider.ts'
        ),
        '@historical/legacy-entropy': join(
          checkout,
          'src/utility/session-generation/sha256-entropy.ts'
        ),
        '@historical/legacy-generated-runs': join(
          checkout,
          'src/core/session-generation/generated-run-store.ts'
        ),
        '@historical/loot-service': join(
          checkout,
          'src/core/application/loot-service.ts'
        ),
        '@historical/schema-owner': join(
          checkout,
          'src/core/persistence/sqlite/database.ts'
        ),
        '@historical/legacy-campaign-store': join(
          checkout,
          'src/core/persistence/sqlite/campaign-store.ts'
        ),
        '@historical/campaign-store': join(
          checkout,
          'src/core/persistence/sqlite/campaign-store.ts'
        ),
        '@historical/party-store': join(
          checkout,
          'src/core/party/party-store.ts'
        ),
        '@historical/preflight': join(
          checkout,
          'src/core/persistence/sqlite/persistence-preflight.ts'
        ),
        '@historical/migrations': join(
          checkout,
          'src/core/persistence/sqlite/schema-migrations.ts'
        ),
        '@historical/live-play': join(
          checkout,
          'src/core/encounter/live-combat.ts'
        ),
        '@historical/database-access': join(
          checkout,
          'src/core/persistence/sqlite/database-access.ts'
        ),
        '@historical/tables': join(
          checkout,
          'src/core/encounter/encounter-table-store.ts'
        ),
        '@historical/factions': join(
          checkout,
          'src/core/worldplanner/faction-store.ts'
        ),
        '@historical/npc-service': join(
          checkout,
          'src/core/application/world-npc-application-service.ts'
        ),
        '@historical/creatures': join(
          checkout,
          'src/core/creatures/catalog.ts'
        ),
        '@historical/hex-maps': join(checkout, 'src/core/hex/hex-map-store.ts'),
        '@historical/hex-travel': join(checkout, 'src/core/hex/hex-travel.ts'),
        '@historical/locations': join(
          checkout,
          'src/core/worldplanner/location-store.ts'
        )
      }
    },
    ssr: { noExternal: true },
    build: {
      emptyOutDir: false,
      outDir: join(checkout, 'out/qualification'),
      ssr: join(harnessRoot, `${entry}.ts`),
      rollupOptions: {
        external: ['electron', 'better-sqlite3'],
        output: {
          format: 'cjs',
          entryFileNames: `${entry}.cjs`,
          inlineDynamicImports: true
        }
      }
    }
  })
}
let maintenanceInterruption: {
  originalSha256: string
  wrapperSha256: string
} | null = null
if (values['maintenance-interruption']) {
  const original = join(checkout, 'out/main/maintenance.js')
  const originalSha256 = digest(original)
  renameSync(original, join(checkout, 'out/main/maintenance-original.js'))
  await build({
    configFile: false,
    root: checkout,
    ssr: { noExternal: true },
    build: {
      target: 'es2022',
      emptyOutDir: false,
      outDir: join(checkout, 'out/main'),
      ssr: join(harnessRoot, 'maintenance-interruption.ts'),
      rollupOptions: {
        external: ['better-sqlite3'],
        output: {
          format: 'es',
          entryFileNames: 'maintenance.js',
          inlineDynamicImports: true
        }
      }
    }
  })
  if (
    digest(join(checkout, 'out/main/maintenance-original.js')) !==
    originalSha256
  )
    throw new Error('Original maintenance entry changed')
  maintenanceInterruption = { originalSha256, wrapperSha256: digest(original) }
}
for (const [path, hash] of harnessModules)
  if (digest(path) !== hash)
    throw new Error('Harness dependency changed during build')
for (const file of harness)
  if (digest(join(harnessRoot, file.path)) !== file.sha256)
    throw new Error('Historical harness changed during build')
if (
  digest(join(workspace, 'scripts/build-historical-release.ts')) !==
  builderSha256
)
  throw new Error('Historical builder changed during build')
mkdirSync(output, { recursive: true })
run([
  'exec',
  'electron-builder',
  '--config',
  'electron-builder.yml',
  `--config.directories.output=${output}`,
  '--config.extraMetadata.main=out/qualification/main.cjs',
  `--config.extraMetadata.version=${version}`,
  '--config.artifactName=SaltMarcher-${version}-x64.AppImage',
  '--linux',
  'AppImage',
  '--x64',
  '--publish',
  'never'
])
assertOriginal()
const names = readdirSync(output).filter((name) => name.endsWith('.AppImage'))
if (names.length !== 1)
  throw new Error('Expected exactly one historical AppImage')
const name = names[0]!
writeFileSync(
  join(output, 'historical-artifact.json'),
  JSON.stringify(
    {
      formatVersion: 1,
      evidence: 'historical-test-artifact-not-public-release',
      fixture,
      source,
      version,
      builderSha256,
      maintenanceInterruption,
      harness,
      harnessModules: [...harnessModules]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([path, sha256]) => ({ path: relative(workspace, path), sha256 })),
      bundledHarness: ['main.cjs', 'worker.cjs'].map((path) => ({
        path,
        sha256: digest(join(checkout, 'out/qualification', path))
      })),
      nodeVersion: process.versions.node,
      viteVersion: z
        .object({ version: z.string().min(1) })
        .parse(
          JSON.parse(
            readFileSync(
              join(workspace, 'node_modules/vite/package.json'),
              'utf8'
            )
          )
        ).version,
      artifact: {
        name,
        bytes: statSync(join(output, name)).size,
        sha256: digest(join(output, name))
      },
      checkout
    },
    null,
    2
  ),
  { flag: 'wx' }
)
// The immutable source and receipts retain provenance; dependencies are rebuildable.
rmSync(join(checkout, 'node_modules'), { recursive: true, force: true })
console.info(
  `Historical test artifact built at ${output}; runtime qualification remains required`
)
