import { formatMessage, message } from '../../i18n/session-runtime.de.js'
import { AccessibleTruncatedText } from '../shared/accessible-truncated-text.js'
import { ExpandableRegisterRow } from '../shared/compact-register.js'
import type {
  SessionRegisterRow,
  SessionWorkspaceActions
} from './session-workspace-model.js'

type PartyRow = Extract<SessionRegisterRow, { kind: 'party' }>

export function ScenePartyCard(props: {
  row: PartyRow
  actions: SessionWorkspaceActions
}) {
  return (
    <ExpandableRegisterRow
      className={`group-row disposition-allied scene-party-card${
        props.row.expanded ? ' focused' : ''
      }`}
      expanded={props.row.expanded}
      expandLabel={formatMessage(
        props.row.expanded ? 'group.collapse' : 'group.expand',
        { name: props.row.name }
      )}
      toggle={() => props.actions.toggleRow({ kind: 'party' })}
      cells={[
        <span
          key="mark"
          className="group-mark"
          role="img"
          aria-label={message('group.disposition.allied')}
        />,
        <AccessibleTruncatedText
          key="name"
          className="group-name"
          value={props.row.name}
        />,
        <span key="count" className="count">
          {props.row.count}
        </span>,
        <span key="xp" className="xp">
          —
        </span>
      ]}
    >
      <div className="group-members scene-party-expanded">
        {props.row.members.length === 0 ? (
          <span className="empty-group-label">
            {message('encounter.noAssignedParty')}
          </span>
        ) : (
          props.row.members.map((member) => (
            <button
              type="button"
              className="scene-party-member"
              key={member.id}
              aria-label={`${message('loot.ledgerOpen')}: ${member.name}`}
              onClick={() => props.actions.openLedger(member)}
            >
              {member.name} {message('ui.lv')} {member.level ?? '—'}
            </button>
          ))
        )}
        <div className="row-actions">
          <button type="button" onClick={props.actions.editParty}>
            {message('ui.bearbeiten')}
          </button>
        </div>
      </div>
    </ExpandableRegisterRow>
  )
}
