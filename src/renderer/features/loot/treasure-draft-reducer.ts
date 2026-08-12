import type {
  EditableTreasureContainer,
  EditableTreasureDraft,
  EditableTreasureItem
} from './treasure-draft.js'

export type TreasureDraftPolicy = 'manual' | 'catalog'

export type TreasureItemPatch = Partial<
  Pick<
    EditableTreasureItem,
    'name' | 'quantity' | 'unitValueCp' | 'stackable' | 'containerId'
  >
>

export type TreasureContainerPatch = Partial<
  Pick<EditableTreasureContainer, 'name' | 'capacity'>
>

export type TreasureDraftCommand<
  Item extends EditableTreasureItem = EditableTreasureItem,
  Container extends EditableTreasureContainer = EditableTreasureContainer
> =
  | { kind: 'set-label'; label: string }
  | { kind: 'patch-item'; id: string; patch: TreasureItemPatch }
  | { kind: 'remove-item'; id: string }
  | { kind: 'patch-container'; id: string; patch: TreasureContainerPatch }
  | { kind: 'remove-container'; id: string }
  | { kind: 'add-item'; item: Item }
  | { kind: 'add-container'; container: Container }
  | { kind: 'insert-item'; item: Item; index: number }
  | { kind: 'insert-container'; container: Container; index: number }
  | {
      kind: 'batch'
      commands: readonly TreasureDraftCommand<Item, Container>[]
    }

export type TreasureDraftOperation<
  Item extends EditableTreasureItem = EditableTreasureItem,
  Container extends EditableTreasureContainer = EditableTreasureContainer
> = Readonly<{
  forward: readonly TreasureDraftCommand<Item, Container>[]
  backward: readonly TreasureDraftCommand<Item, Container>[]
}>

export function reduceTreasureDraft<
  Item extends EditableTreasureItem,
  Container extends EditableTreasureContainer
>(
  draft: EditableTreasureDraft<Item, Container>,
  command: TreasureDraftCommand<Item, Container>,
  policy: TreasureDraftPolicy
): EditableTreasureDraft<Item, Container> {
  switch (command.kind) {
    case 'set-label':
      return command.label === draft.label
        ? draft
        : { ...draft, label: command.label }
    case 'patch-item':
      return updateItem(draft, command.id, command.patch)
    case 'remove-item':
      return draft.items.length === 1 ||
        !draft.items.some((item) => item.draftId === command.id)
        ? draft
        : {
            ...draft,
            items: draft.items.filter((item) => item.draftId !== command.id)
          }
    case 'patch-container':
      return updateContainer(draft, command.id, command.patch)
    case 'remove-container':
      if (!draft.containers.some((entry) => entry.draftId === command.id))
        return draft
      return {
        ...draft,
        containers: draft.containers.filter(
          (container) => container.draftId !== command.id
        ),
        items: draft.items.map((item) =>
          item.containerId === command.id
            ? ({ ...item, containerId: null } as Item)
            : item
        )
      }
    case 'add-item':
      return policy === 'manual'
        ? insertItem(draft, command.item, draft.items.length)
        : draft
    case 'add-container':
      return policy === 'manual'
        ? insertContainer(draft, command.container, draft.containers.length)
        : draft
    case 'insert-item':
      return insertItem(draft, command.item, command.index)
    case 'insert-container':
      return insertContainer(draft, command.container, command.index)
    case 'batch':
      return command.commands.reduce(
        (current, child) => reduceTreasureDraft(current, child, policy),
        draft
      )
  }
}

export function planTreasureDraftOperation<
  Item extends EditableTreasureItem,
  Container extends EditableTreasureContainer
>(
  draft: EditableTreasureDraft<Item, Container>,
  command: TreasureDraftCommand<Item, Container>,
  policy: TreasureDraftPolicy
): TreasureDraftOperation<Item, Container> | null {
  if (command.kind === 'batch') {
    let current = draft
    const operations: TreasureDraftOperation<Item, Container>[] = []
    for (const child of command.commands) {
      const operation = planTreasureDraftOperation(current, child, policy)
      if (!operation) continue
      operations.push(operation)
      current = applyTreasureDraftOperation(
        current,
        operation,
        'forward',
        policy
      )
    }
    return operations.length === 0
      ? null
      : {
          forward: operations.flatMap((operation) => operation.forward),
          backward: operations
            .toReversed()
            .flatMap((operation) => operation.backward)
        }
  }
  if (command.kind === 'set-label')
    return command.label === draft.label
      ? null
      : {
          forward: [command],
          backward: [{ kind: 'set-label', label: draft.label }]
        }
  if (command.kind === 'patch-item') {
    const item = draft.items.find((entry) => entry.draftId === command.id)
    if (!item) return null
    const patch = changedItemPatch(item, command.patch)
    if (!patch) return null
    return {
      forward: [{ ...command, patch: patch.forward }],
      backward: [{ kind: 'patch-item', id: command.id, patch: patch.backward }]
    }
  }
  if (command.kind === 'patch-container') {
    const container = draft.containers.find(
      (entry) => entry.draftId === command.id
    )
    if (!container) return null
    const patch = changedContainerPatch(container, command.patch)
    if (!patch) return null
    return {
      forward: [{ ...command, patch: patch.forward }],
      backward: [
        { kind: 'patch-container', id: command.id, patch: patch.backward }
      ]
    }
  }
  if (command.kind === 'remove-item') {
    if (draft.items.length === 1) return null
    const index = draft.items.findIndex((entry) => entry.draftId === command.id)
    if (index < 0) return null
    return {
      forward: [command],
      backward: [{ kind: 'insert-item', item: draft.items[index]!, index }]
    }
  }
  if (command.kind === 'remove-container') {
    const index = draft.containers.findIndex(
      (entry) => entry.draftId === command.id
    )
    if (index < 0) return null
    const assignments = draft.items
      .filter((item) => item.containerId === command.id)
      .map((item): TreasureDraftCommand<Item, Container> => ({
        kind: 'patch-item',
        id: item.draftId,
        patch: { containerId: command.id }
      }))
    return {
      forward: [command],
      backward: [
        {
          kind: 'insert-container',
          container: draft.containers[index]!,
          index
        },
        ...assignments
      ]
    }
  }
  if (command.kind === 'add-item') {
    if (policy !== 'manual') return null
    return {
      forward: [command],
      backward: [{ kind: 'remove-item', id: command.item.draftId }]
    }
  }
  if (command.kind === 'add-container') {
    if (policy !== 'manual') return null
    return {
      forward: [command],
      backward: [{ kind: 'remove-container', id: command.container.draftId }]
    }
  }
  if (command.kind === 'insert-item')
    return draft.items.some((item) => item.draftId === command.item.draftId)
      ? null
      : {
          forward: [command],
          backward: [{ kind: 'remove-item', id: command.item.draftId }]
        }
  return draft.containers.some(
    (container) => container.draftId === command.container.draftId
  )
    ? null
    : {
        forward: [command],
        backward: [{ kind: 'remove-container', id: command.container.draftId }]
      }
}

export function applyTreasureDraftOperation<
  Item extends EditableTreasureItem,
  Container extends EditableTreasureContainer
>(
  draft: EditableTreasureDraft<Item, Container>,
  operation: TreasureDraftOperation<Item, Container>,
  direction: 'forward' | 'backward',
  policy: TreasureDraftPolicy
): EditableTreasureDraft<Item, Container> {
  return (
    direction === 'forward' ? operation.forward : operation.backward
  ).reduce(
    (current, command) => reduceTreasureDraft(current, command, policy),
    draft
  )
}

function updateItem<
  Item extends EditableTreasureItem,
  Container extends EditableTreasureContainer
>(
  draft: EditableTreasureDraft<Item, Container>,
  id: string,
  patch: TreasureItemPatch
): EditableTreasureDraft<Item, Container> {
  const index = draft.items.findIndex((item) => item.draftId === id)
  if (index < 0) return draft
  const item = draft.items[index]!
  if (!changedItemPatch(item, patch)) return draft
  const items = [...draft.items]
  items[index] = { ...item, ...patch } as Item
  return { ...draft, items }
}

function updateContainer<
  Item extends EditableTreasureItem,
  Container extends EditableTreasureContainer
>(
  draft: EditableTreasureDraft<Item, Container>,
  id: string,
  patch: TreasureContainerPatch
): EditableTreasureDraft<Item, Container> {
  const index = draft.containers.findIndex(
    (container) => container.draftId === id
  )
  if (index < 0) return draft
  const container = draft.containers[index]!
  if (!changedContainerPatch(container, patch)) return draft
  const containers = [...draft.containers]
  containers[index] = { ...container, ...patch } as Container
  return { ...draft, containers }
}

function insertItem<
  Item extends EditableTreasureItem,
  Container extends EditableTreasureContainer
>(
  draft: EditableTreasureDraft<Item, Container>,
  item: Item,
  index: number
): EditableTreasureDraft<Item, Container> {
  if (draft.items.some((entry) => entry.draftId === item.draftId)) return draft
  const items = [...draft.items]
  items.splice(clampIndex(index, items.length), 0, item)
  return { ...draft, items }
}

function insertContainer<
  Item extends EditableTreasureItem,
  Container extends EditableTreasureContainer
>(
  draft: EditableTreasureDraft<Item, Container>,
  container: Container,
  index: number
): EditableTreasureDraft<Item, Container> {
  if (draft.containers.some((entry) => entry.draftId === container.draftId))
    return draft
  const containers = [...draft.containers]
  containers.splice(clampIndex(index, containers.length), 0, container)
  return { ...draft, containers }
}

function changedItemPatch(
  item: EditableTreasureItem,
  patch: TreasureItemPatch
): { forward: TreasureItemPatch; backward: TreasureItemPatch } | null {
  return changedPatch(item, patch)
}

function changedContainerPatch(
  container: EditableTreasureContainer,
  patch: TreasureContainerPatch
): {
  forward: TreasureContainerPatch
  backward: TreasureContainerPatch
} | null {
  return changedPatch(container, patch)
}

function changedPatch<
  Source extends object,
  Patch extends Partial<Record<keyof Source, unknown>>
>(source: Source, patch: Patch): { forward: Patch; backward: Patch } | null {
  const forward: Partial<Record<keyof Source, unknown>> = {}
  const backward: Partial<Record<keyof Source, unknown>> = {}
  for (const key of Object.keys(patch) as Array<keyof Source>) {
    if (Object.is(source[key] as unknown, patch[key] as unknown)) continue
    forward[key] = patch[key]
    backward[key] = source[key]
  }
  return Object.keys(forward).length === 0
    ? null
    : { forward: forward as Patch, backward: backward as Patch }
}

function clampIndex(index: number, length: number): number {
  return Math.max(0, Math.min(length, index))
}
