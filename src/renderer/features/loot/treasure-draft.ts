export type EditableTreasureItem = {
  draftId: string
  persistedId?: string
  name: string
  quantity: number
  unitValueCp: number
  stackable: boolean
  containerId: string | null
  detail?: string
}

export type EditableTreasureContainer = {
  draftId: string
  persistedId?: string
  catalogContainerId: string | null
  name: string
  capacity: number
}

export type EditableTreasureDraft<
  Item extends EditableTreasureItem = EditableTreasureItem,
  Container extends EditableTreasureContainer = EditableTreasureContainer
> = {
  label: string
  items: Item[]
  containers: Container[]
}

export function emptyEditableTreasureItem(): EditableTreasureItem {
  return {
    draftId: crypto.randomUUID(),
    name: '',
    quantity: 1,
    unitValueCp: 0,
    stackable: false,
    containerId: null
  }
}

export function emptyEditableTreasureContainer(): EditableTreasureContainer {
  return {
    draftId: crypto.randomUUID(),
    catalogContainerId: null,
    name: '',
    capacity: 0
  }
}

export function treasureDraftInvalid(draft: EditableTreasureDraft): boolean {
  return (
    !draft.label.trim() ||
    draft.items.length === 0 ||
    draft.items.some(
      (item) =>
        !item.name.trim() ||
        item.quantity < 1 ||
        item.unitValueCp < 0 ||
        (!item.stackable && item.quantity !== 1) ||
        (item.containerId !== null &&
          !draft.containers.some(
            (container) => container.draftId === item.containerId
          ))
    ) ||
    draft.containers.some(
      (container) => !container.name.trim() || container.capacity < 0
    )
  )
}
