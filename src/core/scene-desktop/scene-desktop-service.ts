import type { CampaignStore } from '../persistence/sqlite/campaign-store.js'
import { SceneStore } from '../scene/scene-store.js'
import { SceneDesktopStore } from './scene-desktop-store.js'
import { CapabilityError } from '../../shared/errors/capability-error.js'
import type {
  SaveSceneDesktopInput,
  SceneDesktopScope
} from '../../shared/contracts/scene-desktop.js'

/** Coordinates presentation cleanup using facts read through their aggregate owners. */
export class SceneDesktopService {
  private readonly store: SceneDesktopStore
  constructor(private readonly campaigns: CampaignStore) {
    this.store = new SceneDesktopStore(
      campaigns.installationPersistenceAccess()
    )
  }
  cleanupCampaigns(): void {
    const registry = this.campaigns.list()
    this.store.retainCampaigns(
      [...registry.campaigns, ...registry.trashedCampaigns].map(({ id }) => id)
    )
  }
  read(input: SceneDesktopScope) {
    this.validateScope(input)
    return this.store.read(input)
  }
  save(input: SaveSceneDesktopInput) {
    const ids = this.validateScope(input)
    return this.campaigns.installationPersistenceAccess().use((db) =>
      db.transaction(() => {
        const result = this.store.save(input)
        this.cleanupCampaigns()
        this.store.retainScenes(input.campaignId, ids)
        return result
      })()
    )
  }
  private validateScope(input: SceneDesktopScope): readonly string[] {
    if (
      !this.campaigns.list().campaigns.some(({ id }) => id === input.campaignId)
    )
      throw new CapabilityError('not_found', false)
    const ids = this.campaigns.visitCampaignDatabase(
      input.campaignId,
      (db) => new SceneStore(db).snapshot([]).scenes.map(({ id }) => id),
      'read'
    )
    if (!ids) throw new CapabilityError('not_found', false)
    if (!ids.includes(input.sceneId))
      throw new CapabilityError('not_found', false)
    return ids
  }
}
