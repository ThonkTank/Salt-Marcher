import { useState } from 'react'
import { formatMessage, message } from '../../i18n/session-runtime.de.js'
import { CompactRegister } from '../shared/compact-register.js'
import { SessionGroupCard } from '../session/session-group-card.js'
import type {
  SessionWorkspaceActions,
  SessionWorkspaceViewModel
} from '../session/session-workspace-model.js'
import '../session/session-groups-panel.css'

export function DesktopOverview({
  model,
  actions,
  openCharacters,
  busy = false
}: {
  model: SessionWorkspaceViewModel
  actions: SessionWorkspaceActions
  openCharacters: () => void
  busy?: boolean
}) {
  const [editingLocation, setEditingLocation] = useState(false)
  const focused = model.focused
  const members = model.snapshot.party.members.filter((member) =>
    focused.partyMemberIds.includes(member.id)
  )
  const groups = [...model.groups.activeRows, ...model.groups.archivedRows]
  return (
    <>
      <div className="desktop-scene-facts">
        {editingLocation ? (
          <select
            disabled={busy}
            autoFocus
            aria-label={message('ui.scene.ort')}
            value={focused.locationId ?? ''}
            onBlur={() => setEditingLocation(false)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setEditingLocation(false)
            }}
            onChange={(event) => {
              if (busy) return
              actions.setSceneLocation(event.target.value || null)
              setEditingLocation(false)
            }}
          >
            <option value="">{message('ui.kein.ort')}</option>
            {model.control.locationUnavailable && (
              <option value={focused.locationId!}>
                {model.control.focusedLocationLabel}
              </option>
            )}
            {model.control.locationChoices.map((choice) => (
              <option key={choice.id} value={choice.id}>
                {choice.displayName}
              </option>
            ))}
          </select>
        ) : (
          <button
            disabled={busy}
            onClick={() => {
              if (!busy) setEditingLocation(true)
            }}
          >
            {model.control.focusedLocationLabel}
          </button>
        )}
        <span>
          {formatMessage('desktop.time', {
            day: Math.floor(focused.gameTimeSeconds / 86400) + 1,
            hours: String(
              Math.floor(focused.gameTimeSeconds / 3600) % 24
            ).padStart(2, '0'),
            minutes: String(
              Math.floor(focused.gameTimeSeconds / 60) % 60
            ).padStart(2, '0')
          })}
        </span>
      </div>
      <div className="desktop-section-heading">
        <h3>{message('desktop.characters')}</h3>
        <button
          aria-label={message('desktop.openCharacters')}
          onClick={openCharacters}
        >
          {message('ui.bearbeiten')}
        </button>
      </div>
      <ul className="desktop-register">
        {members.map((member) => (
          <li key={member.id}>
            <span>
              {member.name}
              <small>
                {' '}
                · {member.playerName ?? '—'} · {message('ui.lv')}{' '}
                {member.level ?? '—'}
              </small>
            </span>
            <button onClick={() => actions.openLedger(member)}>
              {message('desktop.loot')}
            </button>
          </li>
        ))}
      </ul>
      {!members.length && (
        <p className="desktop-empty">{message('desktop.noCharacters')}</p>
      )}
      <div className="desktop-section-heading">
        <h3>{message('desktop.groups')}</h3>
        <button
          aria-label={message('desktop.editGroups')}
          onClick={actions.manageGroups}
        >
          {message('ui.bearbeiten')}
        </button>
      </div>
      <CompactRegister
        className="group-register"
        label={message('desktop.groups')}
        columns={(
          [
            'ui.status',
            'ui.gruppe',
            'ui.zahl',
            'ui.xp.2',
            'ui.aktionen'
          ] as const
        ).map((key) => message(key))}
      >
        {groups.map((row) =>
          row.kind === 'active-group' || row.kind === 'archived-group' ? (
            <SessionGroupCard key={row.key} row={row} actions={actions} />
          ) : null
        )}
      </CompactRegister>
    </>
  )
}
