import type { CapabilityIssue } from '../../../shared/errors/capability-issue.js'
import type {
  EditableTreasureContainer,
  EditableTreasureDraft,
  EditableTreasureItem
} from './treasure-draft.js'
import type { TreasureDraftPolicy } from './treasure-draft-reducer.js'

export type TreasureDraftEditorMessages = Readonly<{
  label: string
  container: string
  capacity: string
  item: string
  quantity: string
  valueCopper: string
  valueCopperLabel: string
  stackable: string
  noContainer: string
  removeContainer: string
  removeItem: string
  addContainer: string
  addItem: string
  invalidField: string
}>

export function TreasureDraftFields<
  Item extends EditableTreasureItem,
  Container extends EditableTreasureContainer
>(props: {
  draft: EditableTreasureDraft<Item, Container>
  policy: TreasureDraftPolicy
  messages: TreasureDraftEditorMessages
  issues?: readonly CapabilityIssue[]
  labelChanged: (label: string) => void
  patchItem: (id: string, patch: Partial<EditableTreasureItem>) => void
  removeItem: (id: string) => void
  patchContainer: (
    id: string,
    patch: Partial<EditableTreasureContainer>
  ) => void
  removeContainer: (id: string) => void
  addItem?: () => void
  addContainer?: () => void
  beginEdit?: (key: string) => void
  endEdit?: () => void
}) {
  const m = props.messages
  return (
    <div className="treasure-draft-fields">
      <label className="loot-label-field">
        {m.label}
        <input
          value={props.draft.label}
          aria-invalid={hasIssue(props.issues, 'label') || undefined}
          onFocus={() => props.beginEdit?.('label')}
          onBlur={props.endEdit}
          onChange={(event) => props.labelChanged(event.target.value)}
        />
      </label>
      <div className="treasure-container-editor">
        <div className="treasure-container-editor-head" aria-hidden="true">
          <span>{m.container}</span>
          <span>{m.capacity}</span>
          <span />
        </div>
        {props.draft.containers.map((container) => (
          <div
            className="treasure-container-editor-row"
            key={container.draftId}
          >
            <label>
              <span>{m.container}</span>
              <input
                aria-label={m.container}
                aria-invalid={
                  hasIssue(
                    props.issues,
                    'containers',
                    container.draftId,
                    'name'
                  ) || undefined
                }
                value={container.name}
                onFocus={() =>
                  props.beginEdit?.(`containers.${container.draftId}.name`)
                }
                onBlur={props.endEdit}
                onChange={(event) =>
                  props.patchContainer(container.draftId, {
                    name: event.target.value
                  })
                }
              />
            </label>
            <label>
              <span>{m.capacity}</span>
              <input
                aria-label={m.capacity}
                aria-invalid={
                  hasIssue(
                    props.issues,
                    'containers',
                    container.draftId,
                    'capacity'
                  ) || undefined
                }
                type="number"
                min={0}
                value={container.capacity}
                onFocus={() =>
                  props.beginEdit?.(`containers.${container.draftId}.capacity`)
                }
                onBlur={props.endEdit}
                onChange={(event) =>
                  props.patchContainer(container.draftId, {
                    capacity: Math.max(0, Number(event.target.value) || 0)
                  })
                }
              />
            </label>
            <button
              type="button"
              aria-label={m.removeContainer}
              onClick={() => props.removeContainer(container.draftId)}
            >
              −
            </button>
          </div>
        ))}
      </div>
      {props.policy === 'manual' && props.addContainer && (
        <button
          type="button"
          className="loot-add-row"
          onClick={props.addContainer}
        >
          {m.addContainer}
        </button>
      )}
      <div className="treasure-item-editor">
        <div className="treasure-item-editor-head" aria-hidden="true">
          <span>{m.item}</span>
          <span>{m.quantity}</span>
          <span>{m.valueCopper}</span>
          <span>{m.stackable}</span>
          <span>{m.container}</span>
          <span />
        </div>
        {props.draft.items.map((item) => (
          <div className="treasure-item-editor-row" key={item.draftId}>
            <label className="treasure-item-name-field">
              <span>{m.item}</span>
              <input
                aria-label={m.item}
                aria-invalid={
                  hasIssue(props.issues, 'items', item.draftId, 'name') ||
                  undefined
                }
                value={item.name}
                onFocus={() => props.beginEdit?.(`items.${item.draftId}.name`)}
                onBlur={props.endEdit}
                onChange={(event) =>
                  props.patchItem(item.draftId, { name: event.target.value })
                }
              />
              {item.detail && <small>{item.detail}</small>}
            </label>
            <label>
              <span>{m.quantity}</span>
              <input
                aria-label={m.quantity}
                aria-invalid={
                  hasIssue(props.issues, 'items', item.draftId, 'quantity') ||
                  undefined
                }
                type="number"
                min={1}
                value={item.quantity}
                onFocus={() =>
                  props.beginEdit?.(`items.${item.draftId}.quantity`)
                }
                onBlur={props.endEdit}
                onChange={(event) =>
                  props.patchItem(item.draftId, {
                    quantity: Math.max(1, Number(event.target.value) || 1)
                  })
                }
              />
            </label>
            <label>
              <span>{m.valueCopper}</span>
              <input
                aria-label={m.valueCopperLabel}
                aria-invalid={
                  hasIssue(
                    props.issues,
                    'items',
                    item.draftId,
                    'unitValueCp'
                  ) || undefined
                }
                type="number"
                min={0}
                value={item.unitValueCp}
                onFocus={() =>
                  props.beginEdit?.(`items.${item.draftId}.unitValueCp`)
                }
                onBlur={props.endEdit}
                onChange={(event) =>
                  props.patchItem(item.draftId, {
                    unitValueCp: Math.max(0, Number(event.target.value) || 0)
                  })
                }
              />
            </label>
            <label className="treasure-item-stackable-field">
              <span>{m.stackable}</span>
              <input
                aria-label={m.stackable}
                type="checkbox"
                checked={item.stackable}
                onFocus={() =>
                  props.beginEdit?.(`items.${item.draftId}.stackable`)
                }
                onBlur={props.endEdit}
                onChange={(event) =>
                  props.patchItem(item.draftId, {
                    stackable: event.target.checked
                  })
                }
              />
            </label>
            <label>
              <span>{m.container}</span>
              <select
                aria-label={m.container}
                aria-invalid={
                  hasIssue(
                    props.issues,
                    'items',
                    item.draftId,
                    'containerId'
                  ) || undefined
                }
                value={item.containerId ?? ''}
                onFocus={() =>
                  props.beginEdit?.(`items.${item.draftId}.containerId`)
                }
                onBlur={props.endEdit}
                onChange={(event) =>
                  props.patchItem(item.draftId, {
                    containerId: event.target.value || null
                  })
                }
              >
                <option value="">{m.noContainer}</option>
                {props.draft.containers.map((container) => (
                  <option key={container.draftId} value={container.draftId}>
                    {container.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              aria-label={m.removeItem}
              disabled={props.draft.items.length === 1}
              onClick={() => props.removeItem(item.draftId)}
            >
              −
            </button>
          </div>
        ))}
      </div>
      {props.policy === 'manual' && props.addItem && (
        <button type="button" className="loot-add-row" onClick={props.addItem}>
          {m.addItem}
        </button>
      )}
    </div>
  )
}

function hasIssue(
  issues: readonly CapabilityIssue[] | undefined,
  ...path: readonly string[]
): boolean {
  return (
    issues?.some((issue) =>
      path.every((segment, index) => issue.path[index] === segment)
    ) ?? false
  )
}
