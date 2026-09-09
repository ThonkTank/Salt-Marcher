import { useDraftTransition } from '../../shell/use-draft-transition.js'
import { capabilityErrorText } from '../../capabilities/capability-errors.js'
import { DesktopRestAction } from './desktop-rest-action.js'
import { useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { LiveSessionSnapshot } from '../../../shared/contracts/live-session.js'
import { AnchoredPopup } from '../../shell/anchored-popup.js'
import { message } from '../../i18n/session-runtime.de.js'
import { characterShortId } from '../party/character-profile.js'

import {
  draftConcern,
  maintenanceDraftCoordinator
} from '../../shell/maintenance-draft-coordinator.js'
import { useMaintenanceDraft } from '../../shell/maintenance-drafts.js'
import { ScenePartyCommandController } from './scene-party-command-controller.js'
import { useScenePartyCommandPort } from './use-scene-party-command-port.js'

function rosterBasis(snapshot: LiveSessionSnapshot): string {
  return JSON.stringify(
    snapshot.party.members
      .map((member) => [member.id, member.active])
      .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
  )
}
type Draft = {
  kind: 'roster' | 'move'
  anchor: HTMLElement
  selected: string[]
  query: string
  target: string
  title: string
  revision: number
  partyRevision: number
  rosterBasis: string
  submitted: boolean
}
export function DesktopRosterActions(props: {
  singleCharacter?: { id: string; name: string }
  characterDraftIds?: readonly string[]
  windowId?: string
  campaignId: string
  sceneId: string
  snapshot: LiveSessionSnapshot
}) {
  const port = useScenePartyCommandPort(props.campaignId)
  const transition = useDraftTransition(
    `${props.campaignId}:${props.sceneId}`,
    {
      title: message('desktop.confirmRosterChange'),
      text: message('desktop.resolveBeforeRosterChange')
    },
    {
      kind: 'concerns',
      concerns: [draftConcern.party(props.sceneId)]
    }
  )
  const [error, setError] = useState<string | null>(null)
  const [controller] = useState(() => new ScenePartyCommandController(port))
  const command = useSyncExternalStore(
    controller.subscribe,
    controller.snapshot
  )
  const [draft, renderDraft] = useState<Draft | null>(null)
  const draftRef = useRef<Draft | null>(null)
  const [visiblePopup, setVisiblePopup] = useState(false)
  const source = props.snapshot.scene.scenes.find(
    (scene) => scene.id === props.sceneId
  )!
  function editDraft(value: Draft) {
    if (!publicBlocked()) setDraft(value)
  }
  function setDraft(value: Draft | null) {
    setError(null)
    draftRef.current = value
    renderDraft(value)
  }
  useLayoutEffect(() => {
    controller.attach(() => {
      setDraft(null)
      setVisiblePopup(false)
    })
  })
  useLayoutEffect(() => controller.detach, [controller])
  const blocked = useMaintenanceDraft({
    label: `Besetzung: ${source.title}`,
    concerns: [
      draftConcern.party(props.sceneId),
      draftConcern.scene(props.sceneId),
      ...(props.windowId ? [draftConcern.window(props.windowId)] : [])
    ],
    get dependsOn() {
      if (!controller.unresolved() && draftRef.current === null) return []
      return (props.characterDraftIds ?? []).filter((id) =>
        maintenanceDraftCoordinator.hasDirty({ kind: 'ids', ids: [id] })
      )
    },
    isDirty: () => controller.unresolved() || draftRef.current !== null,
    save: async () => {
      if (!(await controller.settle())) return false
      return !draftRef.current || apply(true)
    },
    discard: async () => {
      if (!(await controller.settle()) || !controller.reset()) return false
      setDraft(null)
      setVisiblePopup(false)
      return true
    }
  })
  const busy = blocked || command.busy || command.uncertain || command.conflict
  const publicBlocked = () =>
    maintenanceDraftCoordinator.isLocked() ||
    controller.unresolved() ||
    controller.snapshot().conflict
  const available = props.snapshot.party.members.filter(
    (member) =>
      source.partyMemberIds.includes(member.id) ||
      (draft?.kind === 'roster' &&
        (!member.active ||
          props.snapshot.scene.unassignedPartyMemberIds.includes(member.id)))
  )
  const visible = available.filter((member) =>
    `${member.name} ${member.playerName ?? ''} ${member.id}`
      .toLocaleLowerCase('de-DE')
      .includes(draft?.query.trim().toLocaleLowerCase('de-DE') ?? '')
  )
  function open(kind: Draft['kind'], anchor: HTMLElement) {
    if (maintenanceDraftCoordinator.isLocked() || command.busy) return
    if (draftRef.current) {
      setDraft({ ...draftRef.current, anchor })
      setVisiblePopup(true)
      return
    }
    setDraft({
      kind,
      anchor,
      selected: props.singleCharacter
        ? [props.singleCharacter.id]
        : kind === 'roster'
          ? [...source.partyMemberIds]
          : [],
      query: '',
      target: props.singleCharacter
        ? ''
        : (props.snapshot.scene.scenes.find((scene) => scene.id !== source.id)
            ?.id ?? ''),
      title: '',
      revision: props.snapshot.scene.revision,
      partyRevision: props.snapshot.party.revision,
      rosterBasis: rosterBasis(props.snapshot),
      submitted: false
    })
    setVisiblePopup(true)
  }
  async function apply(maintenance = false): Promise<boolean> {
    const original = draftRef.current
    if (!original) return true
    if (
      (!maintenance && publicBlocked()) ||
      controller.unresolved() ||
      controller.snapshot().conflict
    )
      return false
    if (
      original.kind === 'move' &&
      (!original.selected.length ||
        (!original.target && !original.title.trim()))
    )
      return false
    if (
      !maintenance &&
      maintenanceDraftCoordinator.hasDirty({
        kind: 'ids',
        ids: props.characterDraftIds ?? []
      })
    ) {
      transition.request(() => {})
      return false
    }
    let partyRevision = original.partyRevision
    if (!original.submitted) {
      try {
        const current = port.current()
        if (
          current.scene.revision !== original.revision ||
          rosterBasis(current) !== original.rosterBasis
        ) {
          setError(message('sceneParty.commandConflict'))
          return false
        }
        partyRevision = current.party.revision
      } catch (cause) {
        setError(capabilityErrorText(cause))
        return false
      }
    }
    original.partyRevision = partyRevision
    original.submitted = true
    const input = {
      sceneId: props.sceneId,
      memberIds: original.selected,
      expectedRevision: original.revision,
      expectedPartyRevision: partyRevision
    }
    return controller.execute({
      commandId: crypto.randomUUID(),
      command:
        original.kind === 'roster'
          ? { kind: 'set-roster', input }
          : {
              kind: 'move-roster',
              input: {
                ...input,
                target: original.target
                  ? { kind: 'existing', sceneId: original.target }
                  : { kind: 'new', title: original.title }
              }
            }
    })
  }
  return (
    <div className="desktop-roster-actions">
      {props.singleCharacter ? (
        <button
          disabled={
            blocked || command.busy || props.snapshot.scene.scenes.length < 2
          }
          aria-label={`${props.singleCharacter.name} verschieben`}
          onClick={(event) => open('move', event.currentTarget)}
        >
          {message('partyWindow.move')}
        </button>
      ) : (
        <>
          <button
            disabled={blocked || command.busy}
            onClick={(event) => open('roster', event.currentTarget)}
          >
            {message('roster.manage')}
          </button>
          <button
            disabled={
              blocked ||
              command.busy ||
              (!draft && !source.partyMemberIds.length)
            }
            onClick={(event) => open('move', event.currentTarget)}
          >
            {message('roster.move')}
          </button>
          <DesktopRestAction {...props} />
        </>
      )}
      <AnchoredPopup
        open={visiblePopup && !!draft}
        anchor={draft?.anchor ?? null}
        onDismiss={() => {
          if (
            !maintenanceDraftCoordinator.isLocked() &&
            !controller.unresolved()
          ) {
            setVisiblePopup(false)
            if (props.singleCharacter && controller.reset()) setDraft(null)
          }
        }}
        className="desktop-roster-popup"
      >
        {draft && (
          <>
            {props.singleCharacter ? (
              <>
                <h3>{message('partyWindow.target')}</h3>
                {props.snapshot.scene.scenes
                  .filter((scene) => scene.id !== source.id)
                  .map((scene) => (
                    <button
                      key={scene.id}
                      disabled={busy}
                      onClick={() => {
                        editDraft({ ...draft, target: scene.id })
                        void apply()
                      }}
                    >
                      {scene.title}
                    </button>
                  ))}
              </>
            ) : (
              <>
                <input
                  disabled={busy}
                  aria-label={message('roster.search')}
                  placeholder={message('roster.search')}
                  value={draft.query}
                  onChange={(event) =>
                    editDraft({ ...draft, query: event.target.value })
                  }
                />
                <button
                  disabled={busy}
                  onClick={() =>
                    editDraft({
                      ...draft,
                      selected:
                        draft.kind === 'roster'
                          ? []
                          : available.map((member) => member.id)
                    })
                  }
                >
                  {message(
                    draft.kind === 'roster' ? 'roster.clear' : 'roster.all'
                  )}
                </button>
                <div className="desktop-roster-list">
                  {visible.map((member) => (
                    <label key={member.id}>
                      <input
                        disabled={busy}
                        type="checkbox"
                        checked={draft.selected.includes(member.id)}
                        onChange={(event) =>
                          editDraft({
                            ...draft,
                            selected: event.target.checked
                              ? [...draft.selected, member.id]
                              : draft.selected.filter((id) => id !== member.id)
                          })
                        }
                      />
                      <span>
                        {member.name}
                        <small>
                          {member.playerName ?? '—'}
                          {available.some(
                            (other) =>
                              other.id !== member.id &&
                              other.name === member.name &&
                              other.playerName === member.playerName
                          )
                            ? ` · ${characterShortId(member, available)}`
                            : ''}
                        </small>
                      </span>
                    </label>
                  ))}
                  {!visible.length && <p>{message('roster.noResults')}</p>}
                </div>
                {draft.kind === 'move' && (
                  <>
                    <select
                      disabled={busy}
                      aria-label={message('roster.destination')}
                      value={draft.target}
                      onChange={(event) =>
                        editDraft({ ...draft, target: event.target.value })
                      }
                    >
                      {props.snapshot.scene.scenes
                        .filter((scene) => scene.id !== source.id)
                        .map((scene) => (
                          <option key={scene.id} value={scene.id}>
                            {scene.title}
                          </option>
                        ))}
                      <option value="">{message('roster.newScene')}</option>
                    </select>
                    {!draft.target && (
                      <input
                        disabled={busy}
                        aria-label={message('roster.sceneName')}
                        placeholder={message('roster.sceneName')}
                        value={draft.title}
                        onChange={(event) =>
                          editDraft({ ...draft, title: event.target.value })
                        }
                      />
                    )}
                  </>
                )}
              </>
            )}
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
            {!props.singleCharacter && (
              <footer>
                <button
                  disabled={
                    busy ||
                    (draft.kind === 'move' &&
                      (!draft.selected.length ||
                        (!draft.target && !draft.title.trim())))
                  }
                  onClick={() => void apply()}
                >
                  {message('roster.apply')}
                </button>
              </footer>
            )}
          </>
        )}
      </AnchoredPopup>
      {transition.dialog}
    </div>
  )
}
