import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync, writeSync } from 'node:fs'
import { join } from 'node:path'
import {
  advanceLocalAppInstallation,
  localInstallationPaths
} from '../../../scripts/local-app-installation.js'
import { MaintenanceCoordinator } from '../../../src/shared/maintenance/coordinator.js'
import { CampaignStore } from '../../../src/core/persistence/sqlite/campaign-store.js'
import { PartyStore } from '../../../src/core/party/party-store.js'
import { databaseSchemaVersions } from '../../../src/core/persistence/sqlite/database.js'
import type { BuildInfo } from '../../../src/shared/contracts/build-info.js'

const [root, action, boundary] = process.argv.slice(2)
if (!root || !action) throw new Error('Missing Local process fixture arguments')
const paths = localInstallationPaths(join(root, 'xdg'))
const workspaceRoot = join(root, 'workspace')
mkdirSync(workspaceRoot, { recursive: true })
const version = action === 'init' || action === 'recover' ? 'a' : 'b'
const currentBuild = build(version)
const artifactPath = join(workspaceRoot, 'SaltMarcher-Local-0.1.0.AppImage')
const artifactManifestPath = artifactPath + '.manifest.json'
const iconSourcePath = join(workspaceRoot, 'icon.png')
writeArtifact(artifactPath, artifactManifestPath, currentBuild)
writeFileSync(iconSourcePath, 'icon-' + version)
const stop = (at: string) => {
  if (at !== boundary) return
  writeSync(1, `BOUNDARY:${at}\n`)
  process.kill(process.pid, 'SIGKILL')
  throw new Error('SIGKILL did not stop the worker')
}
const options = {
  workspaceRoot,
  xdgDataHome: join(root, 'xdg'),
  artifactPath,
  artifactManifestPath,
  iconSourcePath,
  readWorkspaceIdentity: () => identity(currentBuild),
  isAppRunning: () => false,
  // Inert artifact and helper: this tests the installer, not app execution.
  readLauncherForTest: () => Buffer.from('// fixture helper'),
  afterMaintenanceBoundaryForTest: stop
}
if (action === 'commit') {
  const coordinator = new MaintenanceCoordinator(paths.root, stop)
  coordinator.commit(coordinator.read()!.id)
} else {
  advanceLocalAppInstallation(
    options,
    action === 'recover' ? 'backup-created' : 'activated'
  )
  if (action === 'init' || action === 'accept') {
    // Explicit simulation of target runtime acceptance, not a runtime proof.
    const coordinator = new MaintenanceCoordinator(paths.root)
    coordinator.commit(coordinator.read()!.id)
  }
  if (action === 'init') seed()
}
function seed() {
  const store = new CampaignStore(paths.campaignData)
  try {
    const ids = ['Active coast', 'Inactive camp', 'Recoverable ruins'].map(
      (name, index) => {
        const id = store.create(name).activeCampaignId!
        store.visitCampaignDatabase(id, (database) => {
          const party = new PartyStore(database)
          const created = party.create(
            {
              name: `Mara ${index + 1}`,
              playerName: 'Local acceptance',
              species: 'Mensch',
              characterClass: 'Waldläufer',
              languages: ['Gemeinsprache'],
              level: 3,
              passivePerception: 14,
              passiveInvestigation: 12,
              passiveInsight: 13,
              armorClass: 16,
              movementSpeedFeet: 30
            },
            party.read().revision
          )
          const member = created.members[0]!
          const active = party.setMembership(member.id, true, created.revision)
          party.adjustXp(member.id, 75 + index, active.revision)
        })
        return id
      }
    )
    store.trash(ids[2]!)
    store.activate(ids[0]!)
    store.updateSettings({ theme: 'dark' }, store.readSettings().revision)
  } finally {
    store.close()
  }
  mkdirSync(join(paths.profile, 'own-content', 'empty'), { recursive: true })
  writeFileSync(
    join(paths.profile, 'own-content', 'map.bin'),
    Buffer.from([0, 255, 17, 128, 42])
  )
  writeFileSync(
    join(paths.profile, 'preferences.json'),
    JSON.stringify({ panel: 'notes', scale: 1.25 })
  )
}
function hash(content: Buffer): string {
  return createHash('sha256').update(content).digest('hex')
}

function writeArtifact(
  artifactPath: string,
  manifestPath: string,
  buildInfo: BuildInfo
): void {
  const content = `artifact-${buildInfo.workspaceFingerprint[0]}`
  const receipt = {
    formatVersion: 2 as const,
    build: buildInfo,
    outputHash: 'f'.repeat(64),
    files: []
  }
  writeFileSync(artifactPath, content)
  writeFileSync(
    manifestPath,
    JSON.stringify({
      formatVersion: 2,
      artifactFile: 'SaltMarcher-Local-0.1.0.AppImage',
      artifactSha256: hash(Buffer.from(content)),
      receiptSha256: createHash('sha256')
        .update(JSON.stringify(receipt))
        .digest('hex'),
      receipt
    })
  )
}

function build(character: string): BuildInfo {
  return {
    channel: 'local',
    commit: character.repeat(40),
    dirty: true,
    workspaceFingerprint: character.repeat(64),
    appBuildInputFingerprint: character.repeat(64),
    builtAt: '2026-08-15T12:00:00.000Z',
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

function identity(buildInfo: BuildInfo) {
  return {
    commit: buildInfo.commit,
    dirty: buildInfo.dirty,
    workspaceFingerprint: buildInfo.workspaceFingerprint,
    appBuildInputFingerprint: buildInfo.appBuildInputFingerprint
  }
}
