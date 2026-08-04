import { useState } from 'react'
import type { LiveSessionSnapshot } from '../../../shared/contracts/live-session.js'
import { capabilityErrorText } from '../../capabilities/capability-errors.js'
import { message } from '../../i18n/messages.de.js'
import { sessionCapabilities } from './session-capabilities.js'
import { ModalDialog } from '../../shell/modal-dialog.js'

export function ScenePartyCard(props: {
  snapshot: LiveSessionSnapshot
  sceneId: string
  setSnapshot: (snapshot: LiveSessionSnapshot) => void
  onError: (message: string) => void
}) {
  const [open, setOpen] = useState(false)
  const activeMembers = props.snapshot.party.members.filter(
    (member) => member.active
  )
  const scene = props.snapshot.scene.scenes.find(
    (entry) => entry.id === props.sceneId
  )!
  const assignedMembers = activeMembers.filter((member) =>
    scene.partyMemberIds.includes(member.id)
  )

  async function assign(memberId: string, assigned: boolean) {
    try {
      props.setSnapshot(
        await sessionCapabilities().scene.assignPartyMember(
          props.sceneId,
          memberId,
          assigned,
          props.snapshot.scene.revision
        )
      )
    } catch (cause) {
      props.onError(capabilityErrorText(cause))
    }
  }

  return (
    <>
      <article className="group-card disposition-allied scene-party-card">
        <div className="group-card-title">
          <span className="group-mark" aria-hidden="true" />
          <strong>{message('ui.party')}</strong>
          <span className="group-meta">
            {assignedMembers.length} {message('ui.in.dieser.scene')}
          </span>
          <div className="row-actions">
            <button type="button" onClick={() => setOpen(true)}>
              {message('ui.bearbeiten')}
            </button>
          </div>
        </div>
        <div className="group-members">
          {assignedMembers.length === 0 ? (
            <span className="empty-group-label">
              {message('encounter.noAssignedParty')}
            </span>
          ) : (
            assignedMembers.map((member) => (
              <span key={member.id}>
                {member.name} {message('ui.lv')} {member.level ?? '—'}
              </span>
            ))
          )}
        </div>
      </article>

      {open && (
        <ModalDialog
          className="scene-party-dialog"
          labelledBy="scene-party-dialog-title"
          onClose={() => setOpen(false)}
        >
          <header>
            <div>
              <p className="section-kicker">{message('ui.party')}</p>
              <h2 id="scene-party-dialog-title">
                {message('party.sceneManage')}
              </h2>
            </div>
            <button
              type="button"
              className="compact"
              aria-label={message('ui.dialog.schliessen')}
              onClick={() => setOpen(false)}
            >
              ×
            </button>
          </header>
          <p className="panel-hint">{message('party.sceneManageHint')}</p>
          {activeMembers.length === 0 ? (
            <p className="empty-state">
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
                      onClick={() => void assign(member.id, !assigned)}
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
            <button type="button" onClick={() => setOpen(false)}>
              {message('action.close')}
            </button>
          </footer>
        </ModalDialog>
      )}
    </>
  )
}
