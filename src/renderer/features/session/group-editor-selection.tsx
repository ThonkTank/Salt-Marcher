import type { GroupManagerController } from './use-group-manager-controller.js'
import type { GroupLootDraftItem } from '../loot/group-loot-draft.js'
import { message, formatMessage } from '../../i18n/session-runtime.de.js'
import { GroupEditorQuantity } from './group-editor-quantity.js'
import { GroupEditorBalance } from './group-editor-balance.js'
import { formatCopper } from '../../presenters/money.js'

export function GroupEditorSelection({
  controller: c
}: {
  controller: GroupManagerController
}) {
  const lootMode = c.state.workspaceMode === 'loot'
  return (
    <section
      className="group-editor-selection"
      data-group-workspace-mode={c.state.workspaceMode}
      data-group-loot-phase={c.loot.phase}
      data-group-draft-ready={c.loot.draft ? 'true' : 'false'}
      aria-label={
        lootMode ? message('loot.catalogLoot') : message('ui.aktuelle.gruppe')
      }
    >
      <div className="group-editor-line">
        <strong>
          {lootMode
            ? message('loot.catalogLoot')
            : message('ui.aktuelle.gruppe')}
        </strong>
        <div className="group-history-actions">
          <button
            type="button"
            aria-label={message('group.undo')}
            disabled={
              c.busy ||
              !(lootMode ? c.loot.canUndo : c.group.history.past.length)
            }
            onClick={() =>
              lootMode ? c.loot.undo() : c.moveRosterHistory('undo-roster')
            }
          >
            ‹
          </button>
          <button
            type="button"
            aria-label={message('group.redo')}
            disabled={
              c.busy ||
              !(lootMode ? c.loot.canRedo : c.group.history.future.length)
            }
            onClick={() =>
              lootMode ? c.loot.redo() : c.moveRosterHistory('redo-roster')
            }
          >
            ›
          </button>
        </div>
      </div>
      <div className="group-editor-selection-scroll">
        {c.session?.externalConflict && (
          <p role="alert">{message('group.externalConflict')}</p>
        )}
        {c.group.message && <p role="status">{c.group.message}</p>}
        {lootMode ? (
          <LootSelection controller={c} />
        ) : (
          <ul className="group-editor-rows">
            {c.entries.map((entry) => {
              const fact = c.group.facts[entry.creatureId],
                name = fact?.displayName ?? entry.creatureId
              return (
                <li key={entry.creatureId}>
                  <span>
                    <strong>{name}</strong>
                    <small>
                      {message('ui.cr')} {fact?.cr ?? '—'}
                      {entry.deadQuantity
                        ? ` · ${entry.deadQuantity} ${message('group.dead')}`
                        : ''}
                    </small>
                  </span>
                  <GroupEditorQuantity
                    name={name}
                    quantity={entry.quantity}
                    disabled={c.busy}
                    change={(delta) =>
                      c.changeQuantity(entry.creatureId, delta)
                    }
                    remove={() => c.removeCreature(entry.creatureId)}
                  />
                </li>
              )
            })}
          </ul>
        )}
      </div>
      <GroupEditorBalance controller={c} />
    </section>
  )
}
function LootSelection({
  controller: c
}: {
  controller: GroupManagerController
}) {
  const draft = c.loot.draft
  if (!draft) return null
  const coins = draft.items.filter((i) => i.coin)
  return (
    <>
      <div className="group-editor-line">
        <select
          aria-label={message('loot.catalogLoot')}
          value={c.session?.lootSelection ?? 'new'}
          onChange={(e) => c.selectTreasure(e.target.value)}
        >
          {Object.entries(c.editorTreasures).map(([key, value]) => (
            <option key={key} value={key}>
              {value.history?.draft.label ?? message('groupEditor.newLoot')}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => c.selectTreasure(crypto.randomUUID())}
        >
          {message('groupEditor.newLoot')}
        </button>
      </div>
      <input
        aria-label={message('loot.label')}
        value={draft.label}
        onFocus={() => c.loot.beginEdit('label')}
        onBlur={c.loot.endEdit}
        maxLength={200}
        onChange={(e) => c.loot.patchLabel(e.target.value)}
      />
      {c.loot.error && <p role="alert">{c.loot.error}</p>}
      <ul className="group-editor-rows">
        {draft.items
          .filter((i) => !i.coin)
          .map((item) => (
            <LootRow key={item.draftId} item={item} controller={c} />
          ))}
      </ul>
      {coins.length > 0 && (
        <details>
          <summary>{message('groupEditor.coins')}</summary>
          <ul className="group-editor-rows">
            {coins.map((item) => (
              <LootRow key={item.draftId} item={item} controller={c} />
            ))}
          </ul>
        </details>
      )}
      <details>
        <summary>
          {message('groupEditor.containers')} ({draft.containers.length})
        </summary>
        {draft.containers.map((container) => (
          <div className="group-editor-line" key={container.draftId}>
            <input
              aria-label={message('loot.container')}
              value={container.name}
              onFocus={() =>
                c.loot.beginEdit(`container:${container.draftId}:name`)
              }
              onBlur={c.loot.endEdit}
              onChange={(e) =>
                c.loot.patchContainer(container.draftId, {
                  name: e.target.value
                })
              }
            />
            <input
              type="number"
              aria-label={message('loot.capacity')}
              min={0}
              value={container.capacity}
              onFocus={() =>
                c.loot.beginEdit(`container:${container.draftId}:capacity`)
              }
              onBlur={c.loot.endEdit}
              onChange={(e) =>
                c.loot.patchContainer(container.draftId, {
                  capacity: Number(e.target.value)
                })
              }
            />
            <button
              type="button"
              aria-label={formatMessage('groupEditor.remove', {
                name: container.name
              })}
              onClick={() => c.loot.removeContainer(container.draftId)}
            >
              ×
            </button>
          </div>
        ))}
        {draft.items.map((item) => (
          <label className="group-editor-line" key={item.draftId}>
            {item.name}
            <select
              value={item.containerId ?? ''}
              onChange={(e) =>
                c.loot.patchItem(item.draftId, {
                  containerId: e.target.value || null
                })
              }
            >
              <option value="">{message('groupEditor.unassigned')}</option>
              {draft.containers.map((container) => (
                <option key={container.draftId} value={container.draftId}>
                  {container.name}
                </option>
              ))}
            </select>
          </label>
        ))}
      </details>
    </>
  )
}
function LootRow({
  item,
  controller: c
}: {
  item: GroupLootDraftItem
  controller: GroupManagerController
}) {
  return (
    <li>
      <span>
        <strong>{item.name}</strong>
        <small>
          {item.magic ? item.rarity : formatCopper(item.unitValueCp)}
          {item.allocatedQuantity
            ? ` · ${message('groupEditor.allocated')}: ${item.allocatedQuantity}`
            : ''}
        </small>
      </span>
      <GroupEditorQuantity
        name={item.name}
        quantity={item.quantity}
        minimum={Math.max(1, item.allocatedQuantity ?? 0)}
        maximum={item.stackable ? 999999 : 1}
        disabled={c.busy}
        canRemove={!item.allocatedQuantity}
        change={(delta) =>
          c.loot.patchItem(item.draftId, { quantity: item.quantity + delta })
        }
        remove={() => c.loot.removeItem(item.draftId)}
      />
    </li>
  )
}
