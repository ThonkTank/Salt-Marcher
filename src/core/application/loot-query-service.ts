import {
  lootInboxInputSchema,
  lootInboxPageSchema,
  lootSceneProjectionSchema,
  type LootInboxPage,
  type LootSceneProjection
} from '../../shared/contracts/loot.js'
import type { PartySnapshot } from '../../shared/contracts/party.js'
import type { SceneSnapshot } from '../../shared/contracts/scene.js'
import { CapabilityError } from '../../shared/errors/capability-error.js'

type LocationCatalog = Readonly<{
  locations: readonly Readonly<{ id: string }>[]
}>

export type LootQueryContext = Readonly<{
  party: Readonly<{ read(): PartySnapshot }>
  scenes: Readonly<{
    snapshot(members: PartySnapshot['members']): SceneSnapshot
  }>
  locations: Readonly<{ read(): LocationCatalog }>
  projections: Readonly<{
    scene(
      sceneId: string,
      locationId: string | null,
      groupIds: readonly string[]
    ): LootSceneProjection
    inbox(
      input: unknown,
      references: {
        locationIds: ReadonlySet<string>
        sceneGroups: ReadonlyMap<string, ReadonlySet<string>>
      }
    ): LootInboxPage
  }>
}>

export class LootQueryService {
  constructor(private readonly context: () => LootQueryContext) {}

  scene(sceneId: string): LootSceneProjection {
    const context = this.context()
    const party = context.party.read()
    const scene = context.scenes
      .snapshot(party.members)
      .scenes.find((candidate) => candidate.id === sceneId)
    if (!scene) throw new CapabilityError('not_found', false)
    return lootSceneProjectionSchema.parse(
      context.projections.scene(
        scene.id,
        scene.locationId,
        scene.groups.map((group) => group.id)
      )
    )
  }

  inbox(input: unknown): LootInboxPage {
    const parsed = lootInboxInputSchema.parse(input)
    const context = this.context()
    const party = context.party.read()
    const scenes = context.scenes.snapshot(party.members).scenes
    const locations = context.locations.read().locations
    return lootInboxPageSchema.parse(
      context.projections.inbox(parsed, {
        locationIds: new Set(locations.map((location) => location.id)),
        sceneGroups: new Map(
          scenes.map((scene) => [
            scene.id,
            new Set(scene.groups.map((group) => group.id))
          ])
        )
      })
    )
  }
}
