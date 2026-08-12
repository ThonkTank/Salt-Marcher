import { message } from '../../i18n/session-runtime.de.js'
import type {
  EditableTreasureContainer,
  EditableTreasureDraft,
  EditableTreasureItem
} from './treasure-draft.js'

export function TreasureDraftFields<
  Item extends EditableTreasureItem,
  Container extends EditableTreasureContainer
>(props: {
  draft: EditableTreasureDraft<Item, Container>
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
}) {
  return (
    <div className="treasure-draft-fields">
      <label className="loot-label-field">
        {message('loot.label')}
        <input
          value={props.draft.label}
          onChange={(event) => props.labelChanged(event.target.value)}
        />
      </label>
      <div className="treasure-container-editor">
        <div className="treasure-container-editor-head" aria-hidden="true">
          <span>{message('loot.container')}</span>
          <span>{message('loot.capacity')}</span>
          <span />
        </div>
        {props.draft.containers.map((container) => (
          <div
            className="treasure-container-editor-row"
            key={container.draftId}
          >
            <label>
              <span>{message('loot.container')}</span>
              <input
                aria-label={message('loot.container')}
                value={container.name}
                onChange={(event) =>
                  props.patchContainer(container.draftId, {
                    name: event.target.value
                  })
                }
              />
            </label>
            <label>
              <span>{message('loot.capacity')}</span>
              <input
                aria-label={message('loot.capacity')}
                type="number"
                min={0}
                value={container.capacity}
                onChange={(event) =>
                  props.patchContainer(container.draftId, {
                    capacity: Math.max(0, Number(event.target.value) || 0)
                  })
                }
              />
            </label>
            <button
              type="button"
              aria-label={message('loot.removeContainer')}
              onClick={() => props.removeContainer(container.draftId)}
            >
              −
            </button>
          </div>
        ))}
      </div>
      {props.addContainer && (
        <button
          type="button"
          className="loot-add-row"
          onClick={props.addContainer}
        >
          {message('loot.addContainer')}
        </button>
      )}
      <div className="treasure-item-editor">
        <div className="treasure-item-editor-head" aria-hidden="true">
          <span>{message('loot.item')}</span>
          <span>{message('loot.quantity')}</span>
          <span>{message('loot.valueCopper')}</span>
          <span>{message('loot.stackable')}</span>
          <span>{message('loot.container')}</span>
          <span />
        </div>
        {props.draft.items.map((item) => (
          <div className="treasure-item-editor-row" key={item.draftId}>
            <label className="treasure-item-name-field">
              <span>{message('loot.item')}</span>
              <input
                aria-label={message('loot.item')}
                value={item.name}
                onChange={(event) =>
                  props.patchItem(item.draftId, { name: event.target.value })
                }
              />
              {item.detail && <small>{item.detail}</small>}
            </label>
            <label>
              <span>{message('loot.quantity')}</span>
              <input
                aria-label={message('loot.quantity')}
                type="number"
                min={1}
                value={item.quantity}
                onChange={(event) =>
                  props.patchItem(item.draftId, {
                    quantity: Math.max(1, Number(event.target.value) || 1)
                  })
                }
              />
            </label>
            <label>
              <span>{message('loot.valueCopper')}</span>
              <input
                aria-label={message('loot.valueCopperLabel')}
                type="number"
                min={0}
                value={item.unitValueCp}
                onChange={(event) =>
                  props.patchItem(item.draftId, {
                    unitValueCp: Math.max(0, Number(event.target.value) || 0)
                  })
                }
              />
            </label>
            <label className="treasure-item-stackable-field">
              <span>{message('loot.stackable')}</span>
              <input
                aria-label={message('loot.stackable')}
                type="checkbox"
                checked={item.stackable}
                onChange={(event) =>
                  props.patchItem(item.draftId, {
                    stackable: event.target.checked
                  })
                }
              />
            </label>
            <label>
              <span>{message('loot.container')}</span>
              <select
                aria-label={message('loot.container')}
                value={item.containerId ?? ''}
                onChange={(event) =>
                  props.patchItem(item.draftId, {
                    containerId: event.target.value || null
                  })
                }
              >
                <option value="">{message('loot.noContainer')}</option>
                {props.draft.containers.map((container) => (
                  <option key={container.draftId} value={container.draftId}>
                    {container.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              aria-label={message('loot.removeItem')}
              disabled={props.draft.items.length === 1}
              onClick={() => props.removeItem(item.draftId)}
            >
              −
            </button>
          </div>
        ))}
      </div>
      {props.addItem && (
        <button type="button" className="loot-add-row" onClick={props.addItem}>
          {message('loot.addItem')}
        </button>
      )}
    </div>
  )
}
