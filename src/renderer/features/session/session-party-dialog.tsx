import type { LiveSessionSnapshot } from '../../../shared/contracts/live-session.js'
import { message } from '../../i18n/session-runtime.de.js'
import { ModalDialog } from '../../shell/modal-dialog.js'

export function SessionPartyDialog(props: {
  snapshot: LiveSessionSnapshot
  sceneId: string
  assign: (memberId: string, assigned: boolean) => void
  close: () => void
}) {
  const activeMembers = props.snapshot.party.members.filter(
    (member) => member.active
  )
  const scene = props.snapshot.scene.scenes.find(
    (entry) => entry.id === props.sceneId
  )!
  return (
    <ModalDialog
      className="scene-party-dialog"
      labelledBy="scene-party-dialog-title"
      onClose={props.close}
    >
      <header>
        <div>
          <p className="section-kicker">{message('ui.party')}</p>
          <h2 id="scene-party-dialog-title">{message('party.sceneManage')}</h2>
        </div>
        <button
          type="button"
          className="compact"
          aria-label={message('ui.dialog.schliessen')}
          onClick={props.close}
        >
          ×
        </button>
      </header>
      <p className="panel-hint">{message('party.sceneManageHint')}</p>
      {activeMembers.length === 0 ? (
        <p className="session-empty-state">
          {message('ui.keine.aktiven.mitglieder')}
        </p>
      ) : (
        <ul className="scene-party-list">
          {activeMembers.map((member) => {
            const assigned = scene.partyMemberIds.includes(member.id)
            return (
              <li key={member.id}>
                <span>
                  <strong>{member.name}</strong>
                  <small>
                    {message('ui.lv')} {member.level ?? '—'}
                  </small>
                </span>
                <button
                  type="button"
                  onClick={() => props.assign(member.id, !assigned)}
                >
                  {assigned
                    ? message('ui.entfernen')
                    : message('session.assignToScene')}
                </button>
              </li>
            )
          })}
        </ul>
      )}
      <footer>
        <button type="button" onClick={props.close}>
          {message('action.close')}
        </button>
      </footer>
    </ModalDialog>
  )
}
