import { useContext, useState } from 'react'
import type { LiveSessionSnapshot } from '../../../shared/contracts/live-session.js'
import { CapabilityContext } from '../../capabilities/capability-context.js'
import { useCapabilityApi } from '../../capabilities/use-capability-api.js'
import { capabilityErrorText } from '../../capabilities/capability-errors.js'
import { useAsyncCommandCoordinator } from '../../async/use-async-command-coordinator.js'
import { AnchoredPopup } from '../../shell/anchored-popup.js'
import { message } from '../../i18n/session-runtime.de.js'
export function DesktopRestAction(props: {
  campaignId: string
  sceneId: string
  snapshot: LiveSessionSnapshot
}) {
  const api = useCapabilityApi()
  const workspace = useContext(CapabilityContext)!.campaignWorkspace
  const commands = useAsyncCommandCoordinator()
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const [selected, setSelected] = useState<string[] | null>(null)
  const [confirmation, setConfirmation] = useState<{
    type: 'short' | 'long'
    revision: number
    sceneRevision: number
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const scene = props.snapshot.scene.scenes.find(
    (scene) => scene.id === props.sceneId
  )!
  const members = props.snapshot.party.members.filter((member) =>
    scene.partyMemberIds.includes(member.id)
  )
  const target = {
    scope: 'desktop-rest',
    entityKey: `${props.campaignId}:${props.sceneId}`
  }
  const busy = commands.state(target).status === 'pending'
  const confirming =
    confirmation?.revision === props.snapshot.party.revision &&
    confirmation.sceneRevision === props.snapshot.scene.revision
      ? confirmation.type
      : null
  function dismiss() {
    setSelected(null)
    setConfirmation(null)
    setError(null)
  }
  async function rest(type: 'short' | 'long') {
    if (!selected?.length || commands.state(target).status === 'pending') return
    if (confirming !== type) {
      setConfirmation({
        type,
        revision: props.snapshot.party.revision,
        sceneRevision: props.snapshot.scene.revision
      })
      return
    }
    setConfirmation(null)
    setError(null)
    const outcome = await commands.run({
      ...target,
      mode: 'latest-only',
      execute: async () => {
        const result = await api.party.restSelected({
          sceneId: props.sceneId,
          memberIds: selected,
          type,
          expectedRevision: props.snapshot.party.revision,
          expectedSceneRevision: props.snapshot.scene.revision
        })
        workspace.publishSession(props.campaignId, (current) =>
          result.revision < current.party.revision
            ? current
            : { ...current, party: result }
        )
        return result
      }
    })
    if (outcome.status === 'failure')
      setError(capabilityErrorText(outcome.cause))
  }
  return (
    <>
      <button
        disabled={!members.length}
        onClick={(event) => {
          setAnchor(event.currentTarget)
          setSelected(members.map((member) => member.id))
          setConfirmation(null)
          setError(null)
        }}
      >
        {message('rest.action')}
      </button>
      <AnchoredPopup
        open={selected !== null}
        anchor={anchor}
        onDismiss={dismiss}
        className="desktop-roster-popup"
      >
        <div className="desktop-roster-list">
          {members.map((member) => (
            <label key={member.id}>
              <input
                type="checkbox"
                checked={selected?.includes(member.id) ?? false}
                onChange={(event) => {
                  setSelected(
                    event.target.checked
                      ? [...(selected ?? []), member.id]
                      : (selected ?? []).filter((id) => id !== member.id)
                  )
                  setConfirmation(null)
                }}
              />
              <span>
                {member.name}
                <small>{member.playerName ?? '—'}</small>
              </span>
            </label>
          ))}
        </div>
        {error && <p role="alert">{error}</p>}
        <footer>
          {(['short', 'long'] as const).map((type) => (
            <button
              key={type}
              disabled={busy || !selected?.length}
              onClick={() => void rest(type)}
            >
              {message(
                confirming === type
                  ? type === 'short'
                    ? 'rest.confirmShort'
                    : 'rest.confirmLong'
                  : type === 'short'
                    ? 'rest.short'
                    : 'rest.long'
              )}
            </button>
          ))}
        </footer>
      </AnchoredPopup>
    </>
  )
}
