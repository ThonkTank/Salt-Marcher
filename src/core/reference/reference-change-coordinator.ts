import type {
  ReferenceIndex,
  ReferenceTarget
} from '../../shared/contracts/reference.js'

export type ReferenceDependencyKind = 'creature' | 'faction' | 'location'

export type NpcReferenceDependencies = Readonly<{
  npcId: string
  creatureId: string
  factionId: string | null
  locationId: string | null
}>

export type ReferenceChangeDescriptor =
  | Readonly<{ kind: 'campaign' }>
  | Readonly<{ kind: 'npc'; id: string }>
  | Readonly<{ kind: ReferenceDependencyKind; id: string }>

export class ReferenceDependencyIndex {
  private readonly records = new Map<string, NpcReferenceDependencies>()
  private readonly reverse = new Map<string, Set<string>>()

  replace(record: NpcReferenceDependencies): void {
    this.remove(record.npcId)
    this.records.set(record.npcId, record)
    for (const key of dependencyKeys(record)) {
      const ids = this.reverse.get(key) ?? new Set<string>()
      ids.add(record.npcId)
      this.reverse.set(key, ids)
    }
  }

  remove(npcId: string): void {
    const previous = this.records.get(npcId)
    if (!previous) return
    for (const key of dependencyKeys(previous)) {
      const ids = this.reverse.get(key)
      ids?.delete(npcId)
      if (ids?.size === 0) this.reverse.delete(key)
    }
    this.records.delete(npcId)
  }

  dependents(kind: ReferenceDependencyKind, id: string): readonly string[] {
    return [...(this.reverse.get(`${kind}:${id}`) ?? [])].toSorted()
  }

  clear(): void {
    this.records.clear()
    this.reverse.clear()
  }
}

export class ReferenceChangeCoordinator {
  private readonly dependencies = new ReferenceDependencyIndex()
  private indexedCampaignId: string | null = null

  constructor(
    private readonly activeCampaignId: () => string,
    private readonly campaignIndex: (campaignId: string) => ReferenceIndex,
    private readonly npcDependencies: Readonly<{
      all(): readonly NpcReferenceDependencies[]
      one(id: string): NpcReferenceDependencies | null
    }>,
    private readonly publish: (notice: {
      campaignId: string
      revision: string
      changedTargets: readonly ReferenceTarget[]
    }) => void
  ) {}

  record(changes: readonly ReferenceChangeDescriptor[]): void {
    const campaignId = this.activeCampaignId()
    this.ensureCampaign(campaignId)
    const targets = new Map<string, ReferenceTarget>()
    const add = (target: ReferenceTarget) =>
      targets.set(JSON.stringify(target), target)

    for (const change of changes) {
      if (change.kind === 'campaign') {
        this.rebuild(campaignId)
        for (const term of this.campaignIndex(campaignId).terms)
          for (const candidate of term.candidates) add(candidate.target)
        continue
      }
      if (change.kind === 'npc') {
        add(campaignTarget(campaignId, 'npc', change.id))
        const current = this.npcDependencies.one(change.id)
        if (current) this.dependencies.replace(current)
        else this.dependencies.remove(change.id)
        continue
      }
      if (change.kind === 'creature')
        add({ scope: 'creature', creatureId: change.id })
      else add(campaignTarget(campaignId, change.kind, change.id))
      for (const npcId of this.dependencies.dependents(
        change.kind,
        change.id
      )) {
        add(campaignTarget(campaignId, 'npc', npcId))
        const current = this.npcDependencies.one(npcId)
        if (current) this.dependencies.replace(current)
        else this.dependencies.remove(npcId)
      }
    }

    const index = this.campaignIndex(campaignId)
    this.publish({
      campaignId,
      revision: index.revision,
      changedTargets: [...targets.values()]
    })
  }

  private ensureCampaign(campaignId: string): void {
    if (this.indexedCampaignId !== campaignId) this.rebuild(campaignId)
  }

  private rebuild(campaignId: string): void {
    this.dependencies.clear()
    for (const record of this.npcDependencies.all())
      this.dependencies.replace(record)
    this.indexedCampaignId = campaignId
  }
}

function dependencyKeys(record: NpcReferenceDependencies): readonly string[] {
  return [
    `creature:${record.creatureId}`,
    ...(record.factionId ? [`faction:${record.factionId}`] : []),
    ...(record.locationId ? [`location:${record.locationId}`] : [])
  ]
}

function campaignTarget(
  campaignId: string,
  entityKind: 'npc' | 'faction' | 'location',
  entityId: string
): ReferenceTarget {
  return { scope: 'campaign', campaignId, entityKind, entityId }
}
