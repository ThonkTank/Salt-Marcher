export const workspaceInputClasses = [
  'app-build',
  'qualification',
  'delivery-tooling',
  'documentation'
] as const

export type WorkspaceInputClass = (typeof workspaceInputClasses)[number]

const documentationRoots = ['docs/'] as const
const documentationFiles = new Set(['AGENTS.md', 'NOTICE', 'README.md'])

const appBuildRoots = ['src/', 'resources/'] as const
const appBuildFiles = new Set([
  'electron-builder.development.yml',
  'electron-builder.local.yml',
  'electron-builder.release.yml',
  'electron-builder.yml',
  'electron.vite.config.ts',
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'scripts/build-app.ts',
  'scripts/build-identity.ts',
  'scripts/build-passive-preload.ts',
  'scripts/build-qualification.ts',
  'scripts/build-receipt.ts',
  'scripts/file-hash.ts',
  'scripts/package-app.ts',
  'scripts/package-cli.ts',
  'scripts/prepare-build-output.ts',
  'scripts/workspace-input-classification.ts',
  'scripts/write-build-info.ts',
  'scripts/write-build-receipt.ts',
  'tsconfig.json',
  'tsconfig.renderer.json'
])

const qualificationRoots = ['tests/'] as const
const qualificationFiles = new Set([
  '.prettierignore',
  '.prettierrc.json',
  'eslint.config.js',
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'scripts/build-qualification.ts',
  'scripts/installed-runtime-verification.ts',
  'tsconfig.json',
  'tsconfig.renderer.json',
  'vitest.config.ts',
  'wdio.conf.ts',
  'wdio.passive.conf.ts'
])

const deliveryFiles = new Set([
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'scripts/assert-built-workspace.ts',
  'scripts/candidate-delivery.ts',
  'scripts/delivery-contract.ts',
  'scripts/handoff-local-app.ts',
  'scripts/install-local-app.ts',
  'scripts/installed-runtime-verification.ts',
  'scripts/local-app-installation.ts',
  'scripts/local-install-journal.ts',
  'scripts/promote-candidate.ts',
  'scripts/verify-candidate.ts',
  'scripts/verify-main-push.ts',
  'scripts/verify-post-promotion.ts',
  'scripts/workspace-input-classification.ts',
  'scripts/write-local-artifact-manifest.ts'
])

const qualificationScriptPatterns = [
  /^scripts\/architecture\//,
  /^scripts\/check-/,
  /^scripts\/e2e-/,
  /^scripts\/generate-render-qualification-/,
  /^scripts\/lint-/,
  /^scripts\/materialize-e2e-/,
  /^scripts\/packaged-smoke\./,
  /^scripts\/qualify-/,
  /^scripts\/require-platform\./,
  /^scripts\/run-(e2e-suites|focused-check|lint-partitions|render-qualification|smoke|visual-suites)\.ts$/,
  /^scripts\/test-manifests\//,
  /^scripts\/validate-render-qualification\./,
  /^scripts\/update-(reference-goldens|renderer-bundle-baseline|visual-golden)\.ts$/,
  /^scripts\/visual-golden-/,
  /^scripts\/(bundle-baseline-update|bundle-budget-policy|bundle-manifest-entry)\.ts$/
] as const

/**
 * Classifies repository inputs by the behavior they can invalidate. Classes
 * intentionally overlap: for example the lockfile affects both emitted app
 * bytes and the tools used to qualify and deliver those bytes.
 */
export function classifyWorkspaceInput(
  path: string
): readonly WorkspaceInputClass[] {
  if (
    documentationFiles.has(path) ||
    documentationRoots.some((root) => path.startsWith(root))
  )
    return ['documentation']

  const classes = new Set<WorkspaceInputClass>()
  if (
    appBuildFiles.has(path) ||
    appBuildRoots.some((root) => path.startsWith(root))
  )
    classes.add('app-build')
  if (
    qualificationFiles.has(path) ||
    qualificationRoots.some((root) => path.startsWith(root)) ||
    qualificationScriptPatterns.some((pattern) => pattern.test(path))
  )
    classes.add('qualification')
  if (
    deliveryFiles.has(path) ||
    path.startsWith('.github/workflows/') ||
    path.startsWith('scripts/delivery/')
  )
    classes.add('delivery-tooling')

  // Scripts not involved in the app build or qualification are administrative
  // tooling. Keeping this default fail-closed prevents new delivery helpers
  // from silently escaping the delivery identity.
  if (path.startsWith('scripts/') && classes.size === 0)
    classes.add('delivery-tooling')

  return workspaceInputClasses.filter((candidate) => classes.has(candidate))
}

const appBuildPackageScripts = new Set([
  'build',
  'build:development',
  'build:local',
  'build:qualification',
  'build:release',
  'package',
  'package:built',
  'package:development:built',
  'package:local',
  'package:local:built',
  'package:qualification',
  'package:release',
  'package:release:built'
])

const appBuildDevDependencies = new Set([
  '@electron-toolkit/utils',
  'electron',
  'electron-builder',
  'electron-vite',
  'tsx',
  'typescript',
  'vite'
])

/**
 * package.json is a mixed manifest, so hashing the whole file would make an
 * unrelated script alias look like an app input. Each fingerprint receives a
 * canonical semantic projection instead.
 */
export function projectWorkspaceInput(
  path: string,
  content: Buffer,
  inputClass: WorkspaceInputClass
): Buffer {
  if (path !== 'package.json' || inputClass === 'documentation') return content
  const manifest = asRecord(JSON.parse(content.toString('utf8')))
  const scripts = asRecord(manifest['scripts'])
  const devDependencies = asRecord(manifest['devDependencies'])
  let projection: Record<string, unknown>

  if (inputClass === 'app-build')
    projection = {
      name: manifest['name'],
      version: manifest['version'],
      type: manifest['type'],
      main: manifest['main'],
      packageManager: manifest['packageManager'],
      dependencies: manifest['dependencies'],
      devDependencies: selectKeys(devDependencies, appBuildDevDependencies),
      scripts: selectKeys(scripts, appBuildPackageScripts),
      pnpm: manifest['pnpm']
    }
  else if (inputClass === 'qualification')
    projection = {
      packageManager: manifest['packageManager'],
      devDependencies,
      scripts: selectEntries(scripts, ([name]) =>
        /^(check|format|lint|qualify|test|typecheck)(:|$)/.test(name)
      ),
      pnpm: manifest['pnpm']
    }
  else
    projection = {
      version: manifest['version'],
      packageManager: manifest['packageManager'],
      scripts,
      pnpm: manifest['pnpm']
    }

  return Buffer.from(JSON.stringify(canonicalize(projection)))
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function selectKeys(
  source: Record<string, unknown>,
  keys: ReadonlySet<string>
): Record<string, unknown> {
  return selectEntries(source, ([key]) => keys.has(key))
}

function selectEntries(
  source: Record<string, unknown>,
  predicate: (entry: readonly [string, unknown]) => boolean
): Record<string, unknown> {
  return Object.fromEntries(Object.entries(source).filter(predicate))
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (typeof value !== 'object' || value === null) return value
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right, 'en'))
      .map(([key, entry]) => [key, canonicalize(entry)])
  )
}
