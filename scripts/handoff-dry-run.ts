import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  existsSync,
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync
} from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { localArtifactManifestSchema } from '../src/shared/contracts/build-info.js'
import { installedRuntimeEvidenceSchema } from './delivery-contract.js'
import { sha256File } from './file-hash.js'
import { localInstallationPaths } from './local-app-installation.js'
import { snapshotCampaignData } from './local-installation/campaign-backup.js'

export interface HandoffDryRunOptions {
  readonly workspaceRoot: string
  readonly sourceCampaignData: string
  readonly snapshot?: (source: string, destination: string) => unknown
  readonly run?: (
    phase: string,
    arguments_: readonly string[],
    environment: NodeJS.ProcessEnv
  ) => void
}

export interface HandoffDryRunResult {
  readonly sourceCampaignData: string
  readonly sourceDataHash: string
  readonly artifactSha256: string
  readonly installedSha256: string
  readonly runtimeEvidenceSha256: string
}

export interface HandoffDryRunCommand {
  readonly phase: string
  readonly arguments: readonly string[]
}

export function dryRunEnvironment(
  root: string,
  base: NodeJS.ProcessEnv = process.env
): NodeJS.ProcessEnv {
  return {
    ...base,
    COREPACK_HOME:
      base['COREPACK_HOME'] ?? join(homedir(), '.cache', 'node', 'corepack'),
    XDG_DATA_HOME: join(root, 'xdg-data'),
    XDG_CONFIG_HOME: join(root, 'xdg-config'),
    XDG_CACHE_HOME: join(root, 'xdg-cache'),
    XDG_STATE_HOME: join(root, 'xdg-state'),
    XDG_RUNTIME_DIR: join(root, 'xdg-runtime')
  }
}

export function dryRunCommands(
  runtimeEvidencePath: string
): readonly HandoffDryRunCommand[] {
  return [
    { phase: 'build', arguments: ['pnpm', 'build:local'] },
    {
      phase: 'package',
      arguments: ['pnpm', 'package:local:built']
    },
    {
      phase: 'packaged-smoke',
      arguments: ['pnpm', 'test:packaged-local-smoke:built']
    },
    {
      phase: 'isolated-install',
      arguments: ['pnpm', 'exec', 'tsx', 'scripts/install-local-app.ts']
    },
    {
      phase: 'isolated-runtime',
      arguments: [
        'pnpm',
        'exec',
        'tsx',
        'scripts/installed-runtime-verification.ts',
        '--evidence-path',
        runtimeEvidencePath
      ]
    }
  ]
}

export function runHandoffDryRun(
  options: HandoffDryRunOptions
): HandoffDryRunResult {
  if (!existsSync(options.sourceCampaignData))
    throw new Error(
      `Dry-run campaign data source does not exist: ${options.sourceCampaignData}`
    )
  const root = mkdtempSync(join(tmpdir(), 'salt-marcher-handoff-dry-run-'))
  const xdgDataHome = join(root, 'xdg-data')
  const paths = localInstallationPaths(xdgDataHome)
  const runtimeEvidencePath = join(root, 'installed-runtime-evidence.json')
  const snapshot = options.snapshot ?? snapshotCampaignData
  const run: NonNullable<HandoffDryRunOptions['run']> =
    options.run ?? runCommand(options.workspaceRoot)
  const environment = dryRunEnvironment(root)
  try {
    mkdirSync(root, { recursive: true })
    mkdirSync(dirname(paths.campaignData), { recursive: true })
    const inventory = snapshot(options.sourceCampaignData, paths.campaignData)
    const sourceDataHash = hashJson(inventory)
    for (const directory of [
      environment['XDG_CONFIG_HOME'],
      environment['XDG_CACHE_HOME'],
      environment['XDG_STATE_HOME'],
      environment['XDG_RUNTIME_DIR']
    ])
      if (directory) mkdirSync(directory, { recursive: true })
    chmodSync(environment['XDG_RUNTIME_DIR']!, 0o700)

    for (const command of dryRunCommands(runtimeEvidencePath))
      run(command.phase, command.arguments, environment)

    const manifest = localArtifactManifestSchema.parse(
      JSON.parse(readFileSync(paths.installedManifest, 'utf8'))
    )
    installedRuntimeEvidenceSchema.parse(
      JSON.parse(readFileSync(runtimeEvidencePath, 'utf8'))
    )
    const result: HandoffDryRunResult = {
      sourceCampaignData: resolve(options.sourceCampaignData),
      sourceDataHash,
      artifactSha256: manifest.artifactSha256,
      installedSha256: sha256File(paths.appImage),
      runtimeEvidenceSha256: sha256File(runtimeEvidencePath)
    }
    if (result.artifactSha256 !== result.installedSha256)
      throw new Error('Dry-run installation did not preserve the artifact hash')
    return result
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

function runCommand(
  workspaceRoot: string
): NonNullable<HandoffDryRunOptions['run']> {
  return (phase, arguments_, environment) => {
    const result = spawnSync('corepack', arguments_, {
      cwd: workspaceRoot,
      env: environment,
      stdio: 'inherit'
    })
    if (result.error) throw result.error
    if (result.status !== 0)
      throw new Error(
        `Dry-run handoff phase ${phase} failed with ${result.status}`
      )
  }
}

function hashJson(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}
