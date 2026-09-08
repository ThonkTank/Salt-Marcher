import { useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { LiveSessionSnapshot } from '../../../shared/contracts/live-session.js'
import { AnchoredPopup } from '../../shell/anchored-popup.js'
import { message } from '../../i18n/session-runtime.de.js'
import type { ScenePartyCommand } from '../../../shared/contracts/scene-party-command.js'
import { maintenanceDraftCoordinator } from '../../shell/maintenance-draft-coordinator.js'
import { useMaintenanceDraft } from '../../shell/maintenance-drafts.js'
import { ScenePartyCommandController } from './scene-party-command-controller.js'
import { useScenePartyCommandPort } from './use-scene-party-command-port.js'
export function DesktopRestAction(props: {
  campaignId: string
  sceneId: string
  snapshot: LiveSessionSnapshot
}) {
  const port = useScenePartyCommandPort(props.campaignId)
  const [controller] = useState(() => new ScenePartyCommandController(port))
  const command = useSyncExternalStore(
    controller.subscribe,
    controller.snapshot
  )
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const [open, setOpen] = useState(false)
  const [selected, renderSelected] = useState<string[] | null>(null)
  const selectedRef = useRef<string[] | null>(null)
  const intent = useRef<ScenePartyCommand | null>(null)
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
  function setSelected(value: string[] | null) {
    selectedRef.current = value
    renderSelected(value)
  }
  function clear() {
    setSelected(null)
    intent.current = null
    setConfirmation(null)
    setError(null)
    setOpen(false)
  }
  useLayoutEffect(() => {
    controller.attach(clear)
  })
  useLayoutEffect(() => controller.detach, [controller])
  const blocked = useMaintenanceDraft({
    label: `Rast: ${scene.title}`,
    isDirty: () => controller.unresolved() || selectedRef.current !== null,
    save: async () => {
      if (!(await controller.settle())) return false
      if (!selectedRef.current) return true
      if (intent.current && !controller.snapshot().conflict)
        return controller.execute({
          ...intent.current,
          commandId: crypto.randomUUID()
        })
      setError(message('rest.confirmBeforeSave'))
      throw new Error(message('rest.confirmBeforeSave'))
    },
    discard: async () => {
      if (!(await controller.settle()) || !controller.reset()) return false
      clear()
      return true
    }
  })
  const busy = blocked || command.busy || command.uncertain || command.conflict
  const publicBlocked = () =>
    maintenanceDraftCoordinator.isLocked() ||
    controller.unresolved() ||
    controller.snapshot().conflict
  const confirming =
    confirmation?.revision === props.snapshot.party.revision &&
    confirmation.sceneRevision === props.snapshot.scene.revision
      ? confirmation.type
      : null
  async function rest(type: 'short' | 'long') {
    if (!selectedRef.current?.length || publicBlocked()) return
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
    const input: ScenePartyCommand = {
      commandId: crypto.randomUUID(),
      command: {
        kind: 'rest-selected',
        input: {
          sceneId: props.sceneId,
          memberIds: [...selectedRef.current],
          type,
          expectedRevision: props.snapshot.party.revision,
          expectedSceneRevision: props.snapshot.scene.revision
        }
      }
    }
    intent.current = input
    await controller.execute(input)
  }
  return (
    <>
      <button
        disabled={blocked || command.busy || (!selected && !members.length)}
        onClick={(event) => {
          if (maintenanceDraftCoordinator.isLocked() || command.busy) return
          setAnchor(event.currentTarget)
          if (!selectedRef.current)
            setSelected(members.map((member) => member.id))
          setOpen(true)
        }}
      >
        {message('rest.action')}
      </button>
      <AnchoredPopup
        open={open}
        anchor={anchor}
        onDismiss={() => {
          if (
            !maintenanceDraftCoordinator.isLocked() &&
            !controller.unresolved()
          )
            setOpen(false)
        }}
        className="desktop-roster-popup"
      >
        <div className="desktop-roster-list">
          {members.map((member) => (
            <label key={member.id}>
              <input
                disabled={busy}
                type="checkbox"
                checked={selected?.includes(member.id) ?? false}
                onChange={(event) => {
                  if (publicBlocked()) return
                  intent.current = null
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
        {(command.error || error) && (
          <p role="alert">{command.error || error}</p>
        )}
        {command.uncertain && (
          <button
            disabled={blocked || command.busy}
            onClick={() => {
              if (!maintenanceDraftCoordinator.isLocked())
                void controller.settle()
            }}
          >
            {message('character.checkSavedState')}
          </button>
        )}
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
