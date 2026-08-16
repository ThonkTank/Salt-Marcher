import { lazy, Suspense, useState } from 'react'
import type { LiveSessionSnapshot } from '../../../shared/contracts/live-session.js'
import { capabilityErrorText } from '../../capabilities/capability-errors.js'
import { formatMessage, message } from '../../i18n/session-runtime.de.js'
import { sessionCapabilities } from './session-capabilities.js'
import { ModalDialog } from '../../shell/modal-dialog.js'
import { useCapabilityApi } from '../../capabilities/use-capability-api.js'
import './session-dialogs.css'
import type { PartyCharacter } from '../../../shared/contracts/party.js'

const LazyCharacterLootLedgerDialog = lazy(async () => {
  const module = await import('../loot/character-loot-ledger-dialog.js')
  return { default: module.CharacterLootLedgerDialog }
})

export function ScenePartyCard(props: {
  snapshot: LiveSessionSnapshot
  sceneId: string
  setSnapshot: (snapshot: LiveSessionSnapshot) => void
  onError: (message: string) => void
  expanded: boolean
  toggle: () => void
}) {
  const api = useCapabilityApi()
  const [open, setOpen] = useState(false)
  const [ledgerCharacter, setLedgerCharacter] = useState<PartyCharacter | null>(
    null
  )
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
        await sessionCapabilities(api).scene.assignPartyMember(
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
      <div
        className={`group-row disposition-allied scene-party-card${
          props.expanded ? ' focused' : ''
        }`}
      >
        <span
          className="group-mark"
          role="img"
          aria-label={message('group.disposition.allied')}
          title={message('group.disposition.allied')}
        />
        <span className="group-name" title={message('ui.party')}>
          {message('ui.party')}
        </span>
        <span className="count">{assignedMembers.length}</span>
        <span className="xp">—</span>
        <button
          type="button"
          className="group-expand"
          aria-expanded={props.expanded}
          aria-label={formatMessage(
            props.expanded ? 'group.collapse' : 'group.expand',
            { name: message('ui.party') }
          )}
          onClick={props.toggle}
        >
          <span aria-hidden="true">{props.expanded ? '⌄' : '›'}</span>
        </button>
      </div>
      {props.expanded && (
        <div className="group-expanded scene-party-expanded">
          <div className="group-members">
            {assignedMembers.length === 0 ? (
              <span className="empty-group-label">
                {message('encounter.noAssignedParty')}
              </span>
            ) : (
              assignedMembers.map((member) => (
                <button
                  type="button"
                  className="scene-party-member"
                  key={member.id}
                  title={`${message('loot.ledgerOpen')}: ${member.name}`}
                  aria-label={`${message('loot.ledgerOpen')}: ${member.name}`}
                  onClick={() => setLedgerCharacter(member)}
                >
                  {member.name} {message('ui.lv')} {member.level ?? '—'}
                </button>
              ))
            )}
            <div className="row-actions">
              <button type="button" onClick={() => setOpen(true)}>
                {message('ui.bearbeiten')}
              </button>
            </div>
          </div>
        </div>
      )}

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
      <Suspense fallback={null}>
        {ledgerCharacter && (
          <LazyCharacterLootLedgerDialog
            character={ledgerCharacter}
            close={() => setLedgerCharacter(null)}
            onError={props.onError}
          />
        )}
      </Suspense>
    </>
  )
}
