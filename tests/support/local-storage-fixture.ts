import { createHash } from 'node:crypto'
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { BuildInfo } from '../../src/shared/contracts/build-info.js'
import { databaseSchemaVersions } from '../../src/core/persistence/sqlite/database.js'
import { sha256File } from '../../scripts/file-hash.js'
import { createInstallJournal } from '../../scripts/local-install-journal.js'
import { localInstallationPaths } from '../../scripts/local-app-installation.js'
import { hashTree } from '../../scripts/local-installation/campaign-file-inventory.js'

export interface LocalStorageFixture {
  readonly root: string
  readonly paths: ReturnType<typeof localInstallationPaths>
  readonly iconSourcePath: string
  readonly receiptDirectory: string
  readonly cleanup: () => void
  readonly deployment: (character: string, builtAt: string) => string
  readonly activate: (fingerprint: string) => void
  readonly protectWithJournal: (fingerprint: string) => void
  readonly backup: (name: string, createdAt: string, content?: string) => string
}

export function createLocalStorageFixture(): LocalStorageFixture {
  const root = mkdtempSync(join(tmpdir(), 'salt-marcher-storage-'))
  const xdg = join(root, 'xdg')
  const paths = localInstallationPaths(xdg)
  const iconSourcePath = join(root, 'icon.png')
  const receiptDirectory = join(root, 'receipts')
  mkdirSync(paths.deployments, { recursive: true })
  mkdirSync(paths.backups, { recursive: true })
  mkdirSync(receiptDirectory, { recursive: true })
  writeFileSync(iconSourcePath, 'canonical-icon')

  return {
    root,
    paths,
    iconSourcePath,
    receiptDirectory,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
    deployment(character, builtAt) {
      const fingerprint = character.repeat(64)
      const path = join(paths.deployments, fingerprint)
      mkdirSync(path)
      const artifact = `artifact-${character}`
      const receipt = {
        formatVersion: 2 as const,
        build: build(character, builtAt),
        outputHash: 'f'.repeat(64),
        files: []
      }
      writeFileSync(join(path, 'SaltMarcher.AppImage'), artifact)
      writeFileSync(join(path, 'icon.png'), 'canonical-icon')
      writeFileSync(
        join(path, 'artifact-manifest.json'),
        JSON.stringify({
          formatVersion: 2,
          artifactFile: 'SaltMarcher.AppImage',
          artifactSha256: hash(artifact),
          receiptSha256: hash(JSON.stringify(receipt)),
          receipt
        })
      )
      return fingerprint
    },
    activate(fingerprint) {
      symlinkSync(join('deployments', fingerprint), paths.current)
    },
    protectWithJournal(fingerprint) {
      const timestamp = () => new Date('2026-01-10T12:00:00.000Z')
      const journal = createInstallJournal(
        {
          applicationSha: 'a'.repeat(40),
          buildFingerprint: fingerprint,
          appBuildInputFingerprint: fingerprint,
          artifactSha256: 'b'.repeat(64)
        },
        timestamp
      )
      writeFileSync(
        paths.journal,
        JSON.stringify({
          ...journal,
          phase: 'deployment-staged',
          deploymentPath: join(paths.deployments, fingerprint)
        })
      )
    },
    backup(name, createdAt, content = `backup-${name}`) {
      const path = join(paths.backups, name)
      mkdirSync(path)
      writeFileSync(join(path, 'campaign.sqlite'), content)
      writeFileSync(
        join(path, 'backup-manifest.json'),
        JSON.stringify({
          formatVersion: 2,
          snapshotMethod: 'sqlite-online-backup',
          createdAt,
          sourceDataHash: hash(JSON.stringify(hashTree(path))),
          databases: [{ path: 'campaign.sqlite' }],
          files: hashTree(path)
        })
      )
      return sha256File(join(path, 'backup-manifest.json'))
    }
  }
}

function build(character: string, builtAt: string): BuildInfo {
  return {
    channel: 'local',
    commit: character.repeat(40),
    dirty: false,
    workspaceFingerprint: character.repeat(64),
    appBuildInputFingerprint: character.repeat(64),
    builtAt,
    schemaVersions: databaseSchemaVersions,
    migrationRegistryVersion: 1,
    toolchain: {
      node: 'v22.19.0',
      pnpm: '10.15.1',
      electron: '43.2.0',
      electronVite: '5.0.0',
      electronBuilder: '26.15.3',
      platform: 'linux',
      arch: 'x64'
    }
  }
}

function hash(content: string): string {
  return createHash('sha256').update(content).digest('hex')
}
