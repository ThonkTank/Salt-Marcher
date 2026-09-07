import Database from 'better-sqlite3'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { CampaignRegistryRepository } from './campaign-registry-repository.js'
import { InstallationSettingsStore } from './installation-settings-store.js'
import { isSafeCampaignId } from './campaign-filesystem.js'
import { PartyStore } from '../../party/party-store.js'
import { SceneStore } from '../../scene/scene-store.js'
/** Read-only aggregate readback after schema migration, including recoverable trash. */
export function readbackProfile(root: string): void {
  const path = join(root, 'installation.sqlite')
  if (!existsSync(path)) return
  const installation = new Database(path, {
    readonly: true,
    fileMustExist: true
  })
  try {
    new InstallationSettingsStore(installation).read()
    const registry = new CampaignRegistryRepository(installation).snapshot()
    for (const campaign of [
      ...registry.campaigns,
      ...registry.trashedCampaigns
    ]) {
      if (!isSafeCampaignId(campaign.id))
        throw new Error('Invalid campaign registry identity')
      const trashed = registry.trashedCampaigns.some(
        (entry) => entry.id === campaign.id
      )
      const directory = trashed
        ? join(root, 'campaigns', '.trash', campaign.id)
        : join(root, 'campaigns', campaign.id)
      const database = new Database(join(directory, 'campaign.sqlite'), {
        readonly: true,
        fileMustExist: true
      })
      try {
        const party = new PartyStore(database).read()
        new SceneStore(database).snapshot(party.members)
      } finally {
        database.close()
      }
    }
  } finally {
    installation.close()
  }
}
