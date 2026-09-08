import { DesktopRestAction } from './desktop-rest-action.js'
import { useContext, useState } from 'react'
import type { LiveSessionSnapshot } from '../../../shared/contracts/live-session.js'
import { CapabilityContext } from '../../capabilities/capability-context.js'
import { useCapabilityApi } from '../../capabilities/use-capability-api.js'
import { capabilityErrorText } from '../../capabilities/capability-errors.js'
import { useAsyncCommandCoordinator } from '../../async/use-async-command-coordinator.js'
import { AnchoredPopup } from '../../shell/anchored-popup.js'
import { message } from '../../i18n/session-runtime.de.js'
import { characterShortId } from '../party/character-profile.js'

type Draft = {
  kind: 'roster' | 'move'
  anchor: HTMLElement
  selected: string[]
  query: string
  target: string
  title: string
  revision: number
  partyRevision: number
}
export function DesktopRosterActions(props: {
  campaignId: string
  sceneId: string
  snapshot: LiveSessionSnapshot
}) {
  const api = useCapabilityApi()
  const workspace = useContext(CapabilityContext)!.campaignWorkspace
  const commands = useAsyncCommandCoordinator()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [error, setError] = useState<string | null>(null)
  const source = props.snapshot.scene.scenes.find(
    (scene) => scene.id === props.sceneId
  )!
  const target = {
    scope: 'desktop-roster',
    entityKey: `${props.campaignId}:${props.sceneId}`
  }
  const busy = commands.state(target).status === 'pending'
  const available = props.snapshot.party.members.filter(
    (member) =>
      source.partyMemberIds.includes(member.id) ||
      (draft?.kind === 'roster' && !member.active)
  )
  const visible = available.filter((member) =>
    `${member.name} ${member.playerName ?? ''} ${member.id}`
      .toLocaleLowerCase('de-DE')
      .includes(draft?.query.trim().toLocaleLowerCase('de-DE') ?? '')
  )
  function open(kind: Draft['kind'], anchor: HTMLElement) {
    setError(null)
    setDraft({
      kind,
      anchor,
      selected: kind === 'roster' ? [...source.partyMemberIds] : [],
      query: '',
      target:
        props.snapshot.scene.scenes.find((scene) => scene.id !== source.id)
          ?.id ?? '',
      title: '',
      revision: props.snapshot.scene.revision,
      partyRevision: props.snapshot.party.revision
    })
  }
  async function apply() {
    if (!draft || commands.state(target).status === 'pending') return
    setError(null)
    const input = {
      sceneId: source.id,
      memberIds: draft.selected,
      expectedRevision: draft.revision,
      expectedPartyRevision: draft.partyRevision
    }
    const outcome = await commands.run({
      ...target,
      mode: 'latest-only',
      execute: async () => {
        const result =
          draft.kind === 'roster'
            ? await api.scene.setRoster(input)
            : await api.scene.moveRoster({
                ...input,
                target: draft.target
                  ? { kind: 'existing', sceneId: draft.target }
                  : { kind: 'new', title: draft.title }
              })
        workspace.publishSession(props.campaignId, (current) =>
          result.party.revision < current.party.revision
            ? current
            : { ...current, party: result.party }
        )
        const refresh = await workspace.refreshActiveSession()
        return { result, refresh }
      },
      accept: ({ refresh }) => {
        if (refresh.status === 'failure')
          setError(capabilityErrorText(refresh.cause))
        else setDraft((current) => (current === draft ? null : current))
      }
    })
    if (outcome.status === 'failure')
      setError(capabilityErrorText(outcome.cause))
  }
  return (
    <div className="desktop-roster-actions">
      <button onClick={(event) => open('roster', event.currentTarget)}>
        {message('roster.manage')}
      </button>
      <button
        disabled={!source.partyMemberIds.length}
        onClick={(event) => open('move', event.currentTarget)}
      >
        {message('roster.move')}
      </button>
      <DesktopRestAction {...props} />
      <AnchoredPopup
        open={!!draft}
        anchor={draft?.anchor ?? null}
        onDismiss={() => setDraft(null)}
        className="desktop-roster-popup"
      >
        {draft && (
          <>
            <input
              aria-label={message('roster.search')}
              placeholder={message('roster.search')}
              value={draft.query}
              onChange={(event) =>
                setDraft({ ...draft, query: event.target.value })
              }
            />
            <button
              onClick={() =>
                setDraft({
                  ...draft,
                  selected:
                    draft.kind === 'roster'
                      ? []
                      : available.map((member) => member.id)
                })
              }
            >
              {message(draft.kind === 'roster' ? 'roster.clear' : 'roster.all')}
            </button>
            <div className="desktop-roster-list">
              {visible.map((member) => (
                <label key={member.id}>
                  <input
                    type="checkbox"
                    checked={draft.selected.includes(member.id)}
                    onChange={(event) =>
                      setDraft({
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
                  aria-label={message('roster.destination')}
                  value={draft.target}
                  onChange={(event) =>
                    setDraft({ ...draft, target: event.target.value })
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
                    aria-label={message('roster.sceneName')}
                    placeholder={message('roster.sceneName')}
                    value={draft.title}
                    onChange={(event) =>
                      setDraft({ ...draft, title: event.target.value })
                    }
                  />
                )}
              </>
            )}
            {error && <p role="alert">{error}</p>}
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
          </>
        )}
      </AnchoredPopup>
    </div>
  )
}
