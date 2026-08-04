import type { SceneGroup } from '../../../shared/contracts/scene.js'
import { formatMessage, message } from '../../i18n/messages.de.js'

export function SessionGroupCard(props: {
  group: SceneGroup
  inspect: (creatureId: string) => void
  edit?: () => void
  restore?: () => void
  deleteRequested?: () => void
  deleteConfirming?: boolean
  cancelDelete?: () => void
  deleteGroup?: () => void
}) {
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
    <article
      className={`group-card disposition-${props.group.disposition}${
        props.group.archived ? ' archived' : ''
      }`}
    >
      <div className="group-card-title">
        <span className="group-mark" aria-hidden="true" />
        <strong>{props.group.name}</strong>
        <span className="group-meta">
          {disposition} · {count} Wesen · {props.group.baseXp.toLocaleString()}{' '}
          XP
        </span>
        <div className="row-actions">
          {props.edit && (
            <button onClick={props.edit}>{message('ui.bearbeiten')}</button>
          )}
          {props.restore && (
            <button onClick={props.restore}>{message('group.restore')}</button>
          )}
          {props.deleteRequested && (
            <button className="danger" onClick={props.deleteRequested}>
              {message('ui.loeschen')}
            </button>
          )}
        </div>
      </div>
      <div className="group-members">
        {props.group.entries.length === 0 ? (
          <span className="empty-group-label">{message('group.empty')}</span>
        ) : (
          props.group.entries.map((entry) => (
            <button
              key={entry.id}
              className={entry.available ? '' : 'unavailable'}
              disabled={!entry.available}
              onClick={() => props.inspect(entry.creatureId)}
            >
              {entry.quantity > 1 ? `${entry.quantity}× ` : ''}
              {entry.displayName}
            </button>
          ))
        )}
      </div>
      {props.group.note && <p className="group-note">{props.group.note}</p>}
      {props.deleteConfirming && (
        <div className="group-delete-confirm" role="alert">
          <span>
            {formatMessage('group.deleteConfirm', { name: props.group.name })}
          </span>
          <button onClick={props.cancelDelete}>
            {message('action.cancel')}
          </button>
          <button className="danger" onClick={props.deleteGroup}>
            {message('ui.wirklich.loeschen')}
          </button>
        </div>
      )}
    </article>
  )
}
