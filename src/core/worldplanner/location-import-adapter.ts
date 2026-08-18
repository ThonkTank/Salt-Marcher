import type { CampaignImportBundle } from '../../shared/contracts/campaign-import.js'
import {
  duplicateConflicts,
  importedEntity,
  planSection,
  previousEntityId,
  type CampaignImportConflict,
  type CampaignImportSectionAdapter
} from '../campaign-import/campaign-import-section-adapter.js'
import { WorldLocationStore } from './location-store.js'

type LocationImportValue = CampaignImportBundle['locations'][number]

export class LocationImportAdapter implements CampaignImportSectionAdapter<LocationImportValue> {
  readonly section = 'locations' as const
  readonly dependencies = [] as const

  select(bundle: CampaignImportBundle) {
    return bundle.locations
  }

  validate(values: readonly LocationImportValue[]): CampaignImportConflict[] {
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

  diff: CampaignImportSectionAdapter<LocationImportValue>['diff'] = (
    _currentProjection,
    values,
    context
  ) => planSection(this.section, values, context)

  apply: CampaignImportSectionAdapter<LocationImportValue>['apply'] = (
    database,
    plan,
    context
  ) => {
    const locations = new WorldLocationStore(database)
    if (context.phase === 'remove') {
      for (const mapping of plan.removed)
        if (locations.exists(mapping.internalId))
          locations.delete(mapping.internalId, locations.read().revision)
      return []
    }
    return plan.values.map((location, index) => {
      const draft = {
        displayName: location.displayName,
        tags: location.tags,
        readAloud: location.readAloud,
        notes: location.notes,
        factionIds: [],
        encounterTableIds: []
      }
      const existingId = previousEntityId(
        context,
        this.section,
        location.externalKey
      )
      const receipt =
        existingId && locations.exists(existingId)
          ? locations.update(existingId, draft, locations.read().revision)
          : locations.create(draft, locations.read().revision)
      context.resolvedIds.set(
        `${this.section}:${location.externalKey}`,
        receipt.saved.id
      )
      return importedEntity(
        this.section,
        location,
        receipt.saved.id,
        `locations.${index}`
      )
    })
  }

  readBack: CampaignImportSectionAdapter<LocationImportValue>['readBack'] = (
    database,
    plan,
    _context,
    entities
  ) => {
    const snapshot = new WorldLocationStore(database).read()
    const expected = plan.values.map((value) => value.externalKey).sort()
    const ids = new Map(
      entities.map((entity) => [entity.externalKey, entity.internalId])
    )
    const actual = plan.values
      .filter((value) =>
        snapshot.locations.some(
          (location) => location.id === ids.get(value.externalKey)
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

  summarize: CampaignImportSectionAdapter<LocationImportValue>['summarize'] = (
    readBack
  ) => {
    return Array.isArray(readBack.actual) ? readBack.actual.length : 0
  }
}
