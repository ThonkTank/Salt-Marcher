import type { GroupRewardTreasureDraft } from '../../shared/contracts/loot.js'
import type { GeneratedTreasure } from '../../shared/contracts/session-generation.js'
import { CapabilityError } from '../../shared/errors/capability-error.js'
import type {
  CapabilityIssue,
  CapabilityIssueCode
} from '../../shared/errors/capability-issue.js'
import type {
  MaterializedTreasure,
  MaterializedTreasureContainer,
  MaterializedTreasureItem
} from './materialized-treasure.js'

export type MaterializedGroupRewardContainer = MaterializedTreasureContainer
export type MaterializedGroupRewardItem = MaterializedTreasureItem
export type MaterializedGroupRewardTreasureDraft = MaterializedTreasure

export function materializeGroupRewardTreasureDraft(
  generated: GeneratedTreasure,
  draft: GroupRewardTreasureDraft
): MaterializedGroupRewardTreasureDraft {
  validateDraftIdentities(draft)
  const generatedContainers = new Map(
    generated.containers.map((container) => [container.id, container])
  )
  const generatedItems = new Map(generated.items.map((item) => [item.id, item]))
  const usedGeneratedContainers = new Set<string>()
  const usedGeneratedItems = new Set<string>()

  const containers = draft.containers.map((container) => {
    const path = ['containers', container.id, 'origin'] as const
    const origin = container.origin
    if (origin.kind === 'generator') {
      const source = generatedContainers.get(origin.sourceContainerId)
      if (!source)
        invalid('generator_container_unknown', path, {
          sourceContainerId: origin.sourceContainerId
        })
      if (usedGeneratedContainers.has(origin.sourceContainerId))
        invalid('generator_container_duplicate', path, {
          sourceContainerId: origin.sourceContainerId
        })
      if (
        container.name.trim() !== source.name ||
        container.capacity !== source.capacity
      )
        invalid('generator_container_unknown', path, {
          sourceContainerId: origin.sourceContainerId
        })
      usedGeneratedContainers.add(origin.sourceContainerId)
      return {
        draftId: container.id,
        sourceContainerId: source.id,
        catalogContainerId: source.catalogContainerId,
        name: container.name.trim(),
        capacity: container.capacity
      }
    }
    invalid('generator_container_unknown', path, {
      sourceContainerId: 'missing'
    })
  })

  const missingGeneratedContainer = generated.containers.find(
    (container) => !usedGeneratedContainers.has(container.id)
  )
  if (missingGeneratedContainer)
    invalid('generator_container_unknown', ['containers'], {
      sourceContainerId: missingGeneratedContainer.id
    })

  const containerDraftIds = new Set(
    containers.map((container) => container.draftId)
  )
  const items = draft.items.map((item) => {
    if (item.containerId && !containerDraftIds.has(item.containerId))
      invalid(
        'container_assignment_unknown',
        ['items', item.id, 'containerId'],
        { containerId: item.containerId }
      )
    const path = ['items', item.id, 'itemReference'] as const
    if (item.sourceLineId) {
      const source = generatedItems.get(item.sourceLineId)
      if (!source)
        invalid('generator_item_unknown', path, {
          sourceLineId: item.sourceLineId
        })
      if (usedGeneratedItems.has(item.sourceLineId))
        invalid('generator_item_duplicate', path, {
          sourceLineId: item.sourceLineId
        })
      usedGeneratedItems.add(item.sourceLineId)
      if (
        source.itemReference.kind !== 'generated' ||
        item.itemReference.kind !== 'generated' ||
        source.itemReference.runId !== item.itemReference.runId ||
        source.itemReference.definitionId !== item.itemReference.definitionId
      )
        invalid('generator_item_unknown', path, {
          sourceLineId: item.sourceLineId
        })
      return materializedItem(item, source.id)
    }
    invalid('generator_item_unknown', path, { sourceLineId: 'missing' })
  })

  const missingGeneratedItem = generated.items.find(
    (item) => !usedGeneratedItems.has(item.id)
  )
  if (missingGeneratedItem)
    invalid('generator_item_unknown', ['items'], {
      sourceLineId: missingGeneratedItem.id
    })

  return deepFreeze({ label: draft.label.trim(), containers, items })
}

function materializedItem(
  item: GroupRewardTreasureDraft['items'][number],
  sourceLineId: string | null
): MaterializedGroupRewardItem {
  return {
    draftId: item.id,
    sourceLineId,
    itemReference: item.itemReference,
    quantity: item.quantity,
    containerDraftId: item.containerId
  }
}

function validateDraftIdentities(draft: GroupRewardTreasureDraft): void {
  const ids = new Set<string>()
  for (const [kind, entries] of [
    ['containers', draft.containers],
    ['items', draft.items]
  ] as const)
    for (const entry of entries) {
      if (ids.has(entry.id))
        invalid('duplicate_draft_id', [kind, entry.id, 'id'], {
          draftId: entry.id
        })
      ids.add(entry.id)
    }
}

function invalid(
  code: CapabilityIssueCode,
  path: CapabilityIssue['path'],
  parameters: CapabilityIssue['parameters']
): never {
  throw new CapabilityError('validation_failed', false, [
    { code, path, parameters }
  ])
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value as Record<string, unknown>))
      deepFreeze(child)
  }
  return value
}
