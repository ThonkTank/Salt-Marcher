import {
  biomeDeleteImpactSchema,
  biomeDraftSchema,
  biomeIdSchema,
  customBiomeIdSchema,
  placeholderBiomeId,
  type BiomeDraft,
  type BiomeId
} from '../../shared/contracts/biome.js'
import { CapabilityError } from '../../shared/errors/capability-error.js'
import type { CampaignStore } from '../persistence/sqlite/campaign-store.js'
import { BiomeCatalogStore } from '../biomes/biome-catalog.js'
import {
  BiomeHexUsageStore,
  type BiomeMapChange
} from '../hex/biome-hex-usage-store.js'
import {
  hexBiomeCatalogSchema,
  type HexBiomeCatalog,
  type HexBiomeDefinition
} from '../../shared/contracts/hex.js'
import { BiomeDeletionJournal } from '../biomes/biome-deletion-journal.js'

export type { BiomeMapChange } from '../hex/biome-hex-usage-store.js'

export class BiomeCatalogService {
  readonly catalog: BiomeCatalogStore
  private projectionRevision = -1
  private readonly projections = new Map<string, HexBiomeDefinition>()
  private readonly deletionJournal: BiomeDeletionJournal

  constructor(private readonly campaigns: CampaignStore) {
    const owners = campaigns
      .installationPersistenceAccess()
      .use((installation) => ({
        deletionJournal: new BiomeDeletionJournal(installation),
        catalog: new BiomeCatalogStore(installation)
      }))
    this.deletionJournal = owners.deletionJournal
    this.catalog = owners.catalog
  }

  search(input: unknown) {
    return this.catalog.search(input)
  }

  detail(id: unknown) {
    return this.catalog.require(biomeIdSchema.parse(id))
  }

  hexCatalog(ids?: readonly string[]): HexBiomeCatalog {
    const definitions = ids
      ? this.catalog.resolve(
          [...new Set(ids)].map((id) => biomeIdSchema.parse(id))
        )
      : this.catalog.systemDefinitions()
    return hexBiomeCatalogSchema.parse({
      revision: this.catalog.revision(),
      biomes: definitions.map((biome) => ({
        id: biome.id,
        label: biome.displayName,
        color: biome.color,
        passable: biome.passable,
        travelCost: biome.travelCost
      }))
    })
  }

  hexDefinition(id: BiomeId): HexBiomeDefinition {
    const known = this.projections.get(id)
    if (known) return known
    const revision = this.catalog.revision()
    if (revision !== this.projectionRevision) {
      this.projections.clear()
      this.projectionRevision = revision
    }
    const definition = this.hexCatalog([id]).biomes[0]
    if (!definition) throw new CapabilityError('not_found', false)
    this.projections.set(id, definition)
    return definition
  }

  create(commandId: string, biome: BiomeDraft, expectedRevision: number) {
    const result = this.catalog.create(
      commandId,
      biomeDraftSchema.parse(biome),
      expectedRevision
    )
    this.projections.clear()
    return result
  }

  update(
    commandId: string,
    id: BiomeId,
    biome: BiomeDraft,
    expectedRevision: number
  ) {
    const result = this.catalog.update(
      commandId,
      biomeIdSchema.parse(id),
      biomeDraftSchema.parse(biome),
      expectedRevision
    )
    this.projections.clear()
    return result
  }

  deleteImpact(rawId: string) {
    const id = customBiomeIdSchema.parse(rawId)
    const biome = this.catalog.require(id)
    const usages = this.campaigns
      .visitCampaignDatabases((campaign) => {
        const maps = new BiomeHexUsageStore(
          campaign.database,
          campaign.id
        ).usage(id)
        return maps.length === 0
          ? null
          : {
              campaignId: campaign.id,
              campaignName: campaign.name,
              trashed: campaign.trashed,
              maps
            }
      })
      .filter((usage) => usage !== null)
    return biomeDeleteImpactSchema.parse({
      biomeId: id,
      biomeName: biome.displayName,
      totalMaps: usages.reduce((sum, usage) => sum + usage.maps.length, 0),
      totalTiles: usages.reduce(
        (sum, usage) =>
          sum + usage.maps.reduce((mapSum, map) => mapSum + map.tileCount, 0),
        0
      ),
      usages
    })
  }

  delete(
    commandId: string,
    rawId: string,
    expectedRevision: number
  ): Readonly<{
    result: ReturnType<BiomeCatalogStore['remove']>
    changes: readonly BiomeMapChange[]
  }> {
    const id = customBiomeIdSchema.parse(rawId)
    if (this.catalog.get(id) && this.catalog.revision() !== expectedRevision)
      throw new CapabilityError('stale', true)
    this.deletionJournal.begin({ commandId, biomeId: id, expectedRevision })

    const changes = this.campaigns.visitCampaignDatabases((campaign) => {
      if (!this.deletionJournal.beginCampaign(commandId, campaign.id)) return []
      const changed = new BiomeHexUsageStore(
        campaign.database,
        campaign.id
      ).replace(id, placeholderBiomeId)
      this.deletionJournal.completeCampaign(commandId, campaign.id)
      return changed
    })
    const result = this.catalog.remove(commandId, id, expectedRevision)
    this.projections.clear()
    this.deletionJournal.complete(commandId)
    return { result, changes: changes.flat() }
  }

  replaceMapPlaceholder(input: {
    mapId: string
    replacementBiomeId: BiomeId
    expectedContentRevision: number
  }): readonly BiomeMapChange[] {
    const replacement = biomeIdSchema.parse(input.replacementBiomeId)
    const definition = this.catalog.require(replacement)
    if (definition.kind === 'placeholder')
      throw new CapabilityError('validation_failed', false)
    return this.campaigns
      .activeCampaignPersistence()
      .use((database) =>
        new BiomeHexUsageStore(
          database,
          this.campaigns.activeCampaignId()
        ).replaceOnMap(
          placeholderBiomeId,
          replacement,
          input.mapId,
          input.expectedContentRevision
        )
      )
  }

  recoverPendingDeletions(): void {
    for (const row of this.deletionJournal.pending())
      this.delete(row.commandId, row.biomeId, row.expectedRevision)
  }
}
