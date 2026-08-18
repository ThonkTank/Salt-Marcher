import { randomUUID } from 'node:crypto'
import type { CampaignImportBundle } from '../../shared/contracts/campaign-import.js'
import {
  duplicateConflicts,
  importedEntity,
  planSection,
  previousEntityId,
  type CampaignImportAdapterContext,
  type CampaignImportConflict,
  type CampaignImportSectionAdapter
} from '../campaign-import/campaign-import-section-adapter.js'
import { WorldFactionStore } from './faction-store.js'
import { WorldNpcStore } from './npc-store.js'

type NpcImportValue = CampaignImportBundle['npcs'][number]

const noEncounterReferences = {
  containsTable: () => false,
  containsCreature: () => false
}

export class NpcImportAdapter implements CampaignImportSectionAdapter<NpcImportValue> {
  readonly section = 'npcs' as const
  readonly dependencies = ['locations', 'factions'] as const

  select(bundle: CampaignImportBundle) {
    return bundle.npcs
  }

  validate(
    values: readonly NpcImportValue[],
    context: CampaignImportAdapterContext
  ): CampaignImportConflict[] {
    const records = values as readonly Record<string, unknown>[]
    const conflicts: CampaignImportConflict[] = [
      ...duplicateConflicts(
        records,
        'externalKey',
        this.section,
        'duplicate_external_key'
      ),
      ...duplicateConflicts(
        records,
        'displayName',
        this.section,
        'duplicate_display_name'
      )
    ]
    const locations = new Set(
      context.bundle.locations.map((value) => value.externalKey)
    )
    const factions = new Set(
      context.bundle.factions.map((value) => value.externalKey)
    )
    const resolutions = new Map(
      context.bundle.resolutions.map((decision) => [decision.path, decision])
    )
    values.forEach((npc, index) => {
      if (!context.creatures.resolve(npc.creature.resolvedId))
        conflicts.push(
          conflict('unknown_statblock', `npcs.${index}.creature.resolvedId`, {
            value: npc.creature.resolvedId
          })
        )
      requireResolution(
        resolutions,
        `npcs.${index}.creature`,
        'statblock',
        npc.creature.resolvedId,
        conflicts
      )
      if (
        npc.locationExternalKey !== null &&
        !locations.has(npc.locationExternalKey)
      )
        conflicts.push(
          conflict('unknown_location', `npcs.${index}.locationExternalKey`, {
            value: npc.locationExternalKey
          })
        )
      if (npc.locationExternalKey !== null)
        requireResolution(
          resolutions,
          `npcs.${index}.locationExternalKey`,
          'location',
          npc.locationExternalKey,
          conflicts
        )
      if (
        npc.factionExternalKey !== null &&
        !factions.has(npc.factionExternalKey)
      )
        conflicts.push(
          conflict('unknown_faction', `npcs.${index}.factionExternalKey`, {
            value: npc.factionExternalKey
          })
        )
      if (npc.factionExternalKey !== null)
        requireResolution(
          resolutions,
          `npcs.${index}.factionExternalKey`,
          'faction',
          npc.factionExternalKey,
          conflicts
        )
    })
    return conflicts
  }

  diff: CampaignImportSectionAdapter<NpcImportValue>['diff'] = (
    _currentProjection,
    values,
    context
  ) => planSection(this.section, values, context)

  apply: CampaignImportSectionAdapter<NpcImportValue>['apply'] = (
    database,
    plan,
    context
  ) => {
    const factions = new WorldFactionStore(database, noEncounterReferences)
    const npcs = new WorldNpcStore(database, context.creatures)
    if (context.phase === 'remove') {
      for (const mapping of plan.removed)
        if (npcs.detail(mapping.internalId))
          npcs.delete(
            randomUUID(),
            mapping.internalId,
            npcs.currentRevision(),
            factions.read().revision,
            factions
          )
      return []
    }
    return plan.values.map((npc, index) => {
      const draft = {
        displayName: npc.displayName,
        creatureId: npc.creature.resolvedId,
        lifecycle: npc.lifecycle,
        appearance: npc.appearance,
        behavior: npc.behavior,
        history: npc.history,
        notes: npc.notes,
        dispositionModifier: npc.dispositionModifier,
        factionId:
          npc.factionExternalKey === null
            ? null
            : requireResolvedId(context, `factions:${npc.factionExternalKey}`),
        locationId:
          npc.locationExternalKey === null
            ? null
            : requireResolvedId(context, `locations:${npc.locationExternalKey}`)
      }
      const existingId = previousEntityId(
        context,
        this.section,
        npc.externalKey
      )
      const receipt =
        existingId && npcs.detail(existingId)
          ? npcs.update(
              randomUUID(),
              existingId,
              draft,
              npcs.currentRevision(),
              factions.read().revision,
              factions
            )
          : npcs.create(
              randomUUID(),
              draft,
              npcs.currentRevision(),
              npc.factionExternalKey === null ? null : factions.read().revision,
              factions
            )
      context.resolvedIds.set(
        `${this.section}:${npc.externalKey}`,
        receipt.saved.id
      )
      return importedEntity(
        this.section,
        npc,
        receipt.saved.id,
        `npcs.${index}`
      )
    })
  }

  readBack: CampaignImportSectionAdapter<NpcImportValue>['readBack'] = (
    database,
    plan,
    context,
    entities
  ) => {
    const snapshot = new WorldNpcStore(
      database,
      context.creatures
    ).readAllForReferences()
    const expected = plan.values.map((value) => value.externalKey).sort()
    const ids = new Map(
      entities.map((entity) => [entity.externalKey, entity.internalId])
    )
    const actual = plan.values
      .filter((value) =>
        snapshot.npcs.some((npc) => npc.id === ids.get(value.externalKey))
      )
      .map((value) => value.externalKey)
      .sort()
    return {
      name: this.section,
      expected,
      actual,
      passed: expected.length === actual.length
    }
  }

  summarize: CampaignImportSectionAdapter<NpcImportValue>['summarize'] = (
    readBack
  ) => {
    return Array.isArray(readBack.actual) ? readBack.actual.length : 0
  }
}

function requireResolvedId(
  context: CampaignImportAdapterContext,
  key: string
): string {
  const value = context.resolvedIds.get(key)
  if (!value) throw new Error(`Import reference was not mapped: ${key}`)
  return value
}

function conflict(
  code: CampaignImportConflict['code'],
  path: string,
  parameters: CampaignImportConflict['parameters']
): CampaignImportConflict {
  return { code, path, sourcePath: path, parameters }
}

function requireResolution(
  decisions: ReadonlyMap<string, CampaignImportBundle['resolutions'][number]>,
  path: string,
  kind: CampaignImportBundle['resolutions'][number]['kind'],
  resolvedValue: string,
  conflicts: CampaignImportConflict[]
): void {
  const decision = decisions.get(path)
  if (
    !decision ||
    decision.kind !== kind ||
    decision.resolvedValue !== resolvedValue
  )
    conflicts.push(
      conflict('missing_resolution', path, { kind, resolvedValue })
    )
}
