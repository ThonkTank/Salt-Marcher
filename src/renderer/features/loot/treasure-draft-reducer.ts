import type {
  EditableTreasureContainer,
  EditableTreasureDraft,
  EditableTreasureItem
} from './treasure-draft.js'

export type TreasureDraftPolicy = 'manual' | 'catalog'

export type TreasureDraftCommand<
  Item extends EditableTreasureItem = EditableTreasureItem,
  Container extends EditableTreasureContainer = EditableTreasureContainer
> =
  | { kind: 'set-label'; label: string }
  | { kind: 'patch-item'; id: string; patch: Partial<EditableTreasureItem> }
  | { kind: 'remove-item'; id: string }
  | {
      kind: 'patch-container'
      id: string
      patch: Partial<EditableTreasureContainer>
    }
  | { kind: 'remove-container'; id: string }
  | { kind: 'add-item'; item: Item }
  | { kind: 'add-container'; container: Container }

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
      return { ...draft, label: command.label }
    case 'patch-item':
      return {
        ...draft,
        items: draft.items.map((item) =>
          item.draftId === command.id
            ? ({ ...item, ...command.patch } as Item)
            : item
        )
      }
    case 'remove-item':
      return draft.items.length === 1
        ? draft
        : {
            ...draft,
            items: draft.items.filter((item) => item.draftId !== command.id)
          }
    case 'patch-container':
      return {
        ...draft,
        containers: draft.containers.map((container) =>
          container.draftId === command.id
            ? ({ ...container, ...command.patch } as Container)
            : container
        )
      }
    case 'remove-container':
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
        ? { ...draft, items: [...draft.items, command.item] }
        : draft
    case 'add-container':
      return policy === 'manual'
        ? { ...draft, containers: [...draft.containers, command.container] }
        : draft
  }
}
