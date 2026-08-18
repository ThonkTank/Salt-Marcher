import type Database from 'better-sqlite3'
import type {
  CampaignImportBundle,
  CampaignImportReport,
  CampaignImportSection
} from '../../shared/contracts/campaign-import.js'
import { fingerprint as fingerprintValue } from '../fingerprint.js'
import type { CreatureReferenceResolver } from '../worldplanner/npc-store.js'
import type { CampaignImportEntityMapping } from './campaign-import-store.js'

export type CampaignImportConflict = CampaignImportReport['conflicts'][number]

export type ImportedCampaignEntity = Readonly<{
  kind: CampaignImportSection
  externalKey: string
  internalId: string
  sourcePath: string
  contentHash: string
}>

export type CampaignImportDomainReadback = Readonly<{
  name: string
  expected: unknown
  actual: unknown
  passed: boolean
}>

export type CampaignImportSectionPlan<Value = unknown> = Readonly<{
  section: CampaignImportSection
  values: readonly Value[]
  removed: readonly CampaignImportEntityMapping[]
  changedExternalKeys: readonly string[]
}>

export interface CampaignImportAdapterContext {
  readonly bundle: CampaignImportBundle
  readonly sourceId: string
  readonly creatures: CreatureReferenceResolver
  readonly previousMappings: readonly CampaignImportEntityMapping[]
  readonly previousHashes: ReadonlyMap<string, string>
  readonly resolvedIds: Map<string, string>
}

export interface CampaignImportSectionAdapter<Value = unknown> {
  readonly section: CampaignImportSection
  readonly dependencies: readonly CampaignImportSection[]
  select(bundle: CampaignImportBundle): readonly Value[]
  validate(
    bundleSection: readonly Value[],
    context: CampaignImportAdapterContext
  ): readonly CampaignImportConflict[]
  diff(
    currentProjection: ReadonlyMap<string, string>,
    bundleSection: readonly Value[],
    context: CampaignImportAdapterContext
  ): CampaignImportSectionPlan<Value>
  apply(
    stagedDatabase: Database.Database,
    plan: CampaignImportSectionPlan<Value>,
    context: CampaignImportAdapterContext & {
      readonly phase: 'remove' | 'upsert'
    }
  ): readonly ImportedCampaignEntity[]
  readBack(
    stagedDatabase: Database.Database,
    plan: CampaignImportSectionPlan<Value>,
    context: CampaignImportAdapterContext,
    entities: readonly ImportedCampaignEntity[]
  ): CampaignImportDomainReadback
  summarize(readBack: CampaignImportDomainReadback): number
}

export function planSection<Value extends { externalKey: string }>(
  section: CampaignImportSection,
  values: readonly Value[],
  context: CampaignImportAdapterContext
): CampaignImportSectionPlan<Value> {
  const incoming = new Set(values.map((value) => value.externalKey))
  return {
    section,
    values,
    removed: context.previousMappings.filter(
      (mapping) =>
        mapping.kind === section && !incoming.has(mapping.externalKey)
    ),
    changedExternalKeys: values
      .filter(
        (value) =>
          context.previousHashes.get(`${section}:${value.externalKey}`) !==
          entityContentHash(value)
      )
      .map((value) => value.externalKey)
  }
}

export function previousEntityId(
  context: CampaignImportAdapterContext,
  section: CampaignImportSection,
  externalKey: string
): string | undefined {
  return context.previousMappings.find(
    (mapping) => mapping.kind === section && mapping.externalKey === externalKey
  )?.internalId
}

export function entityContentHash(value: unknown): string {
  // Kept here so every adapter and the persisted provenance use one canonical
  // content identity without coupling adapters to one another.
  return fingerprintValue(value)
}

export function importedEntity(
  section: CampaignImportSection,
  value: { externalKey: string },
  internalId: string,
  sourcePath: string
): ImportedCampaignEntity {
  return {
    kind: section,
    externalKey: value.externalKey,
    internalId,
    sourcePath,
    contentHash: entityContentHash(value)
  }
}

export function duplicateConflicts(
  values: readonly Record<string, unknown>[],
  field: string,
  section: CampaignImportSection,
  code: 'duplicate_external_key' | 'duplicate_display_name'
): CampaignImportConflict[] {
  const conflicts: CampaignImportConflict[] = []
  const seen = new Map<string, number>()
  values.forEach((value, index) => {
    const canonical = String(value[field]).trim().toLocaleLowerCase()
    const first = seen.get(canonical)
    if (first === undefined) seen.set(canonical, index)
    else
      conflicts.push({
        code,
        path: `${section}.${index}.${field}`,
        sourcePath: `${section}.${index}.${field}`,
        parameters: { first }
      })
  })
  return conflicts
}
