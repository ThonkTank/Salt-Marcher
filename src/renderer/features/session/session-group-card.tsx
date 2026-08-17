import { useState } from 'react'
import type { Treasure } from '../../../shared/contracts/loot.js'
import { formatInteger } from '../../i18n/domain-formatters.de.js'
import { formatMessage, message } from '../../i18n/session-runtime.de.js'
import { LootTreasureCard } from '../loot/loot-treasure-card.js'
import { ReadOnlyProse } from '../reference/read-only-prose.js'
import { AccessibleTruncatedText } from '../shared/accessible-truncated-text.js'
import { ExpandableRegisterRow } from '../shared/compact-register.js'
import type {
  SessionRegisterRow,
  SessionWorkspaceActions
} from './session-workspace-model.js'

type GroupRow = Extract<
  SessionRegisterRow,
  { kind: 'active-group' | 'archived-group' }
>

export function SessionGroupCard(props: {
  row: GroupRow
  actions: SessionWorkspaceActions
}) {
  const [lootOpen, setLootOpen] = useState(false)
  const { group } = props.row
  const disposition = {
    hostile: message('group.disposition.hostile'),
    neutral: message('group.disposition.neutral'),
    allied: message('group.disposition.allied')
  }[group.disposition]
  const toggle = () =>
    props.actions.toggleRow({ kind: 'group', groupId: group.id })
  return (
    <ExpandableRegisterRow
      className={`group-row disposition-${group.disposition}${
        props.row.kind === 'archived-group' ? ' archived' : ''
      }${props.row.expanded ? ' focused' : ''}`}
      expanded={props.row.expanded}
      expandLabel={formatMessage(
        props.row.expanded ? 'group.collapse' : 'group.expand',
        { name: group.name }
      )}
      toggle={toggle}
      cells={[
        <span
          key="mark"
          className="group-mark"
          role="img"
          aria-label={disposition}
        />,
        <AccessibleTruncatedText
          key="name"
          className="group-name"
          value={group.name}
        />,
        <span key="count" className="count">
          {props.row.count}
        </span>,
        <span key="xp" className="xp">
          {group.baseXp ? formatInteger(group.baseXp) : '—'}
        </span>
      ]}
    >
      <div className="group-members">
        {group.entries.length === 0 ? (
          <span className="empty-group-label">{message('group.empty')}</span>
        ) : (
          group.entries.map((entry) => (
            <button
              key={entry.id}
              className={entry.available ? '' : 'unavailable'}
              disabled={!entry.available}
              aria-label={memberLabel(entry)}
              onClick={() =>
                props.actions.inspectCreature(entry.creatureId, group.name)
              }
            >
              {memberLabel(entry)}
            </button>
          ))
        )}
        <div className="row-actions">
          {(props.row.treasures.length > 0 ||
            props.row.kind === 'active-group') && (
            <button
              type="button"
              aria-expanded={lootOpen}
              onClick={() => setLootOpen((open) => !open)}
            >
              {formatMessage('loot.groupCount', {
                count: props.row.treasures.length
              })}
            </button>
          )}
          {props.row.kind === 'active-group' ? (
            <button onClick={() => props.actions.editGroup(group)}>
              {message('ui.bearbeiten')}
            </button>
          ) : (
            <>
              <button onClick={() => props.actions.restoreGroup(group)}>
                {message('group.restore')}
              </button>
              <button
                className="danger"
                onClick={() => props.actions.requestGroupDelete(group.id)}
              >
                {message('ui.loeschen')}
              </button>
            </>
          )}
        </div>
      </div>
      {group.note && (
        <p className="group-note">
          <ReadOnlyProse>{group.note}</ReadOnlyProse>
        </p>
      )}
      {lootOpen && (
        <GroupLoot
          row={props.row}
          edit={props.actions.editLoot}
          distribute={props.actions.distribute}
          create={() =>
            props.actions.createLoot({
              kind: 'group',
              sceneId: props.row.sceneId,
              groupId: group.id,
              lastKnownLabel: group.name
            })
          }
        />
      )}
      {props.row.kind === 'archived-group' &&
        props.row.deleteState === 'confirming' && (
          <div className="group-delete-confirm" role="alert">
            <span>
              {formatMessage('group.deleteConfirm', { name: group.name })}
            </span>
            <button onClick={props.actions.cancelGroupDelete}>
              {message('action.cancel')}
            </button>
            <button
              className="danger"
              onClick={() => props.actions.confirmGroupDelete(group)}
            >
              {message('ui.wirklich.loeschen')}
            </button>
          </div>
        )}
    </ExpandableRegisterRow>
  )
}

function GroupLoot(props: {
  row: GroupRow
  edit: (treasure: Treasure) => void
  distribute: (treasure: Treasure) => void
  create: () => void
}) {
  return (
    <div className="group-loot-list">
      {props.row.treasures.map((treasure) => (
        <LootTreasureCard
          key={treasure.id}
          treasure={treasure}
          edit={props.edit}
          distribute={props.distribute}
        />
      ))}
      {props.row.kind === 'active-group' && (
        <button className="group-loot-add" onClick={props.create}>
          {message('loot.add')}
        </button>
      )}
    </div>
  )
}

function memberLabel(entry: GroupRow['group']['entries'][number]): string {
  return [
    entry.aliveQuantity > 0
      ? `${entry.aliveQuantity > 1 ? `${entry.aliveQuantity}× ` : ''}${entry.displayName}`
      : '',
    entry.deadQuantity > 0
      ? `${entry.deadQuantity}× ${entry.displayName} (${message('encounter.dead')})`
      : ''
  ]
    .filter(Boolean)
    .join(' · ')
}
