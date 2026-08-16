import { useState } from 'react'
import type { SceneGroup } from '../../../shared/contracts/scene.js'
import type { Treasure } from '../../../shared/contracts/loot.js'
import { formatInteger } from '../../i18n/domain-formatters.de.js'
import { formatMessage, message } from '../../i18n/session-runtime.de.js'
import { ReadOnlyProse } from '../reference/read-only-prose.js'
import { LootTreasureCard } from '../loot/loot-treasure-card.js'

export function SessionGroupCard(props: {
  group: SceneGroup
  inspect: (creatureId: string) => void
  edit?: () => void
  restore?: () => void
  deleteRequested?: () => void
  deleteConfirming?: boolean
  cancelDelete?: () => void
  deleteGroup?: () => void
  treasures?: readonly Treasure[]
  createLoot?: () => void
  editLoot?: (treasure: Treasure) => void
  distribute?: (treasure: Treasure) => void
  expanded: boolean
  toggle: () => void
}) {
  const [lootOpen, setLootOpen] = useState(false)
  const count = props.group.entries.reduce(
    (total, entry) => total + entry.quantity,
    0
  )
  const disposition = {
    hostile: message('group.disposition.hostile'),
    neutral: message('group.disposition.neutral'),
    allied: message('group.disposition.allied')
  }[props.group.disposition]
  return (
    <>
      <div
        className={`group-row disposition-${props.group.disposition}${
          props.group.archived ? ' archived' : ''
        }${props.expanded ? ' focused' : ''}`}
      >
        <span
          className="group-mark"
          role="img"
          aria-label={disposition}
          title={disposition}
        />
        <span className="group-name" title={props.group.name}>
          {props.group.name}
        </span>
        <span className="count">{count}</span>
        <span className="xp">
          {props.group.baseXp ? formatInteger(props.group.baseXp) : '—'}
        </span>
        <button
          type="button"
          className="group-expand"
          aria-expanded={props.expanded}
          aria-label={formatMessage(
            props.expanded ? 'group.collapse' : 'group.expand',
            { name: props.group.name }
          )}
          onClick={props.toggle}
        >
          <span aria-hidden="true">{props.expanded ? '⌄' : '›'}</span>
        </button>
      </div>
      {props.expanded && (
        <div className="group-expanded">
          <div className="group-members">
            {props.group.entries.length === 0 ? (
              <span className="empty-group-label">
                {message('group.empty')}
              </span>
            ) : (
              props.group.entries.map((entry) => (
                <button
                  key={entry.id}
                  className={entry.available ? '' : 'unavailable'}
                  disabled={!entry.available}
                  title={entry.displayName}
                  onClick={() => props.inspect(entry.creatureId)}
                >
                  {entry.aliveQuantity > 1 ? `${entry.aliveQuantity}× ` : ''}
                  {entry.aliveQuantity > 0 ? entry.displayName : ''}
                  {entry.aliveQuantity > 0 && entry.deadQuantity > 0
                    ? ' · '
                    : ''}
                  {entry.deadQuantity > 0
                    ? `${entry.deadQuantity}× ${entry.displayName} (tot)`
                    : ''}
                </button>
              ))
            )}
            <div className="row-actions">
              {(props.treasures?.length || props.createLoot) && (
                <button
                  type="button"
                  aria-expanded={lootOpen}
                  onClick={() => setLootOpen((open) => !open)}
                >
                  {formatMessage('loot.groupCount', {
                    count: props.treasures?.length ?? 0
                  })}
                </button>
              )}
              {props.edit && (
                <button onClick={props.edit}>{message('ui.bearbeiten')}</button>
              )}
              {props.restore && (
                <button onClick={props.restore}>
                  {message('group.restore')}
                </button>
              )}
              {props.deleteRequested && (
                <button className="danger" onClick={props.deleteRequested}>
                  {message('ui.loeschen')}
                </button>
              )}
            </div>
          </div>
          {props.group.note && (
            <p className="group-note">
              <ReadOnlyProse>{props.group.note}</ReadOnlyProse>
            </p>
          )}
          {lootOpen && (props.treasures?.length || props.createLoot) && (
            <div className="group-loot-list">
              {props.treasures?.map((treasure) => {
                return (
                  <LootTreasureCard
                    key={treasure.id}
                    treasure={treasure}
                    edit={(value) => props.editLoot?.(value)}
                    distribute={(value) => props.distribute?.(value)}
                  />
                )
              })}
              {props.createLoot && (
                <button className="group-loot-add" onClick={props.createLoot}>
                  {message('loot.add')}
                </button>
              )}
            </div>
          )}
          {props.deleteConfirming && (
            <div className="group-delete-confirm" role="alert">
              <span>
                {formatMessage('group.deleteConfirm', {
                  name: props.group.name
                })}
              </span>
              <button onClick={props.cancelDelete}>
                {message('action.cancel')}
              </button>
              <button className="danger" onClick={props.deleteGroup}>
                {message('ui.wirklich.loeschen')}
              </button>
            </div>
          )}
        </div>
      )}
    </>
  )
}
