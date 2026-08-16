import type { CapabilityIssue } from '../../../shared/errors/capability-issue.js'
import type {
  EditableTreasureContainer,
  EditableTreasureDraft,
  EditableTreasureItem
} from './treasure-draft.js'
import type {
  TreasureContainerPatch,
  TreasureDraftPolicy,
  TreasureItemPatch
} from './treasure-draft-reducer.js'

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
  patchItem: (id: string, patch: TreasureItemPatch) => void
  removeItem: (id: string) => void
  patchContainer: (id: string, patch: TreasureContainerPatch) => void
  removeContainer: (id: string) => void
  addItem?: () => void
  addContainer?: () => void
  beginEdit?: (key: string) => void
  endEdit?: () => void
  itemMetadata?: (item: Item) => ReactNode
  itemDefinitionReadOnly?: (item: Item) => boolean
  itemRemovalReadOnly?: (item: Item) => boolean
  containerDefinitionReadOnly?: (container: Container) => boolean
  containerRemovalReadOnly?: (container: Container) => boolean
}) {
  const m = props.messages
  return (
    <div className="treasure-draft-fields">
      <label className="loot-label-field">
        {m.label}
        <input
          value={props.draft.label}
          {...issueAttributes(props.issues, 'label')}
          onFocus={() => props.beginEdit?.('label')}
          onBlur={props.endEdit}
          onChange={(event) => props.labelChanged(event.target.value)}
        />
        <FieldIssue
          issues={props.issues}
          path={['label']}
          message={m.invalidField}
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
                readOnly={
                  props.containerDefinitionReadOnly?.(container) ?? false
                }
                {...issueAttributes(
                  props.issues,
                  'containers',
                  container.draftId,
                  'name'
                )}
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
              <FieldIssue
                issues={props.issues}
                path={['containers', container.draftId, 'name']}
                message={m.invalidField}
              />
            </label>
            <label>
              <span>{m.capacity}</span>
              <input
                aria-label={m.capacity}
                readOnly={
                  props.containerDefinitionReadOnly?.(container) ?? false
                }
                {...issueAttributes(
                  props.issues,
                  'containers',
                  container.draftId,
                  'capacity'
                )}
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
              <FieldIssue
                issues={props.issues}
                path={['containers', container.draftId, 'capacity']}
                message={m.invalidField}
              />
            </label>
            <button
              type="button"
              aria-label={m.removeContainer}
              disabled={props.containerRemovalReadOnly?.(container) ?? false}
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
                readOnly={props.itemDefinitionReadOnly?.(item) ?? false}
                {...issueAttributes(
                  props.issues,
                  'items',
                  item.draftId,
                  'name'
                )}
                value={item.name}
                onFocus={() => props.beginEdit?.(`items.${item.draftId}.name`)}
                onBlur={props.endEdit}
                onChange={(event) =>
                  props.patchItem(item.draftId, { name: event.target.value })
                }
              />
              {props.itemMetadata?.(item) ??
                (item.detail ? <small>{item.detail}</small> : null)}
              <FieldIssue
                issues={props.issues}
                path={['items', item.draftId, 'name']}
                message={m.invalidField}
              />
            </label>
            <label>
              <span>{m.quantity}</span>
              <input
                aria-label={m.quantity}
                {...issueAttributes(
                  props.issues,
                  'items',
                  item.draftId,
                  'quantity'
                )}
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
              <FieldIssue
                issues={props.issues}
                path={['items', item.draftId, 'quantity']}
                message={m.invalidField}
              />
            </label>
            <label>
              <span>{m.valueCopper}</span>
              <input
                aria-label={m.valueCopperLabel}
                readOnly={props.itemDefinitionReadOnly?.(item) ?? false}
                {...issueAttributes(
                  props.issues,
                  'items',
                  item.draftId,
                  'unitValueCp'
                )}
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
              <FieldIssue
                issues={props.issues}
                path={['items', item.draftId, 'unitValueCp']}
                message={m.invalidField}
              />
            </label>
            <label className="treasure-item-stackable-field">
              <span>{m.stackable}</span>
              <input
                aria-label={m.stackable}
                type="checkbox"
                disabled={props.itemDefinitionReadOnly?.(item) ?? false}
                checked={item.stackable}
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
                {...issueAttributes(
                  props.issues,
                  'items',
                  item.draftId,
                  'containerId'
                )}
                value={item.containerId ?? ''}
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
              <FieldIssue
                issues={props.issues}
                path={['items', item.draftId, 'containerId']}
                message={m.invalidField}
              />
            </label>
            <button
              type="button"
              aria-label={m.removeItem}
              disabled={
                props.draft.items.length === 1 ||
                (props.itemRemovalReadOnly?.(item) ?? false)
              }
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
  return issues?.some((issue) => issueMatchesControl(issue.path, path)) ?? false
}

function issueMatchesControl(
  issuePath: CapabilityIssue['path'],
  controlPath: readonly string[]
): boolean {
  if (controlPath.every((segment, index) => issuePath[index] === segment))
    return true
  const [collection, draftId, field] = controlPath
  if (
    field !== 'name' ||
    (collection !== 'items' && collection !== 'containers')
  )
    return false
  return (
    issuePath[0] === collection &&
    issuePath[1] === draftId &&
    (issuePath[2] === 'origin' || issuePath[2] === 'id')
  )
}

function issueAttributes(
  issues: readonly CapabilityIssue[] | undefined,
  ...path: readonly string[]
): Readonly<{
  'aria-invalid'?: true
  'aria-describedby'?: string
}> {
  return hasIssue(issues, ...path)
    ? {
        'aria-invalid': true,
        'aria-describedby': issueId(path)
      }
    : {}
}

function FieldIssue(props: {
  issues: readonly CapabilityIssue[] | undefined
  path: readonly string[]
  message: string
}) {
  return hasIssue(props.issues, ...props.path) ? (
    <small className="treasure-field-issue" id={issueId(props.path)}>
      {props.message}
    </small>
  ) : null
}

function issueId(path: readonly string[]): string {
  return `treasure-issue-${path.join('-').replace(/[^a-zA-Z0-9_-]/g, '-')}`
}
import type { ReactNode } from 'react'
