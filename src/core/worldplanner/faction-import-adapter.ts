import { randomUUID } from 'node:crypto'
import type { CampaignImportBundle } from '../../shared/contracts/campaign-import.js'
import {
  duplicateConflicts,
  importedEntity,
  planSection,
  previousEntityId,
  type CampaignImportConflict,
  type CampaignImportSectionAdapter
} from '../campaign-import/campaign-import-section-adapter.js'
import { WorldFactionStore } from './faction-store.js'

type FactionImportValue = CampaignImportBundle['factions'][number]

const noEncounterReferences = {
  containsTable: () => false,
  containsCreature: () => false
}

export class FactionImportAdapter implements CampaignImportSectionAdapter<FactionImportValue> {
  readonly section = 'factions' as const
  readonly dependencies = [] as const

  select(bundle: CampaignImportBundle) {
    return bundle.factions
  }

  validate(values: readonly FactionImportValue[]): CampaignImportConflict[] {
    const records = values as readonly Record<string, unknown>[]
    return [
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
  }

  diff: CampaignImportSectionAdapter<FactionImportValue>['diff'] = (
    _currentProjection,
    values,
    context
  ) => planSection(this.section, values, context)

  apply: CampaignImportSectionAdapter<FactionImportValue>['apply'] = (
    database,
    plan,
    context
  ) => {
    const factions = new WorldFactionStore(database, noEncounterReferences)
    if (context.phase === 'remove') {
      for (const mapping of plan.removed)
        if (factions.contains(mapping.internalId))
          factions.delete(
            randomUUID(),
            mapping.internalId,
            factions.read().revision
          )
      return []
    }
    return plan.values.map((faction, index) => {
      const draft = {
        displayName: faction.displayName,
        notes: faction.notes,
        disposition: faction.disposition,
        primaryEncounterTableId: null,
        inventory: []
      }
      const existingId = previousEntityId(
        context,
        this.section,
        faction.externalKey
      )
      const receipt =
        existingId && factions.contains(existingId)
          ? factions.update(
              randomUUID(),
              existingId,
              draft,
              factions.read().revision
            )
          : factions.create(randomUUID(), draft, factions.read().revision)
      context.resolvedIds.set(
        `${this.section}:${faction.externalKey}`,
        receipt.saved.id
      )
      return importedEntity(
        this.section,
        faction,
        receipt.saved.id,
        `factions.${index}`
      )
    })
  }

  readBack: CampaignImportSectionAdapter<FactionImportValue>['readBack'] = (
    database,
    plan,
    _context,
    entities
  ) => {
    const snapshot = new WorldFactionStore(
      database,
      noEncounterReferences
    ).read()
    const expected = plan.values.map((value) => value.externalKey).sort()
    const ids = new Map(
      entities.map((entity) => [entity.externalKey, entity.internalId])
    )
    const actual = plan.values
      .filter((value) =>
        snapshot.factions.some(
          (faction) => faction.id === ids.get(value.externalKey)
        )
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

  summarize: CampaignImportSectionAdapter<FactionImportValue>['summarize'] = (
    readBack
  ) => {
    return Array.isArray(readBack.actual) ? readBack.actual.length : 0
  }
}
