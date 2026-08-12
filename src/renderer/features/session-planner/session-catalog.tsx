import type {
  SaveSessionPlanInput,
  SessionPlannerWorkspace
} from '../../../shared/contracts/session-planner.js'
import { formatMessage, message } from '../../i18n/session-runtime.de.js'

export function SessionCatalog(props: {
  workspace: SessionPlannerWorkspace
  draft: SaveSessionPlanInput
  dirty: boolean
  participantsOpen: boolean
  seed: number
  preparationRunning: boolean
  openSession: (sessionId: string) => void
  createSession: () => void
  renameSession: () => void
  deleteSession: () => void
  toggleParticipants: () => void
  mutate: (
    update: (draft: SaveSessionPlanInput) => SaveSessionPlanInput
  ) => void
  setSeed: (seed: number) => void
  save: () => void
  prepare: () => void
  cancelPreparation: () => void
}) {
  return (
    <header className="planner-toolbar">
      <div className="planner-session-actions">
        <label>
          <span>{message('planner.session')}</span>
          <select
            value={props.workspace.session.id}
            onChange={(event) => props.openSession(event.target.value)}
          >
            {props.workspace.sessions.map((session) => (
              <option key={session.id} value={session.id}>
                {session.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          aria-label={message('planner.sessionCreate')}
          onClick={props.createSession}
        >
          +
        </button>
        <button type="button" onClick={props.renameSession}>
          {message('planner.rename')}
        </button>
        <button type="button" onClick={props.deleteSession}>
          {message('planner.delete')}
        </button>
      </div>
      <button
        type="button"
        className="planner-participant-summary"
        aria-expanded={props.participantsOpen}
        onClick={props.toggleParticipants}
      >
        {formatMessage('planner.participants', {
          count: props.draft.participantIds.length,
          indicator: props.participantsOpen ? '▴' : '▾'
        })}
      </button>
      <label>
        <span>{message('planner.dayFraction')}</span>
        <input
          aria-label={message('planner.dayFractionLabel')}
          inputMode="decimal"
          value={props.draft.adventureDayFraction}
          onChange={(event) =>
            props.mutate((current) => ({
              ...current,
              adventureDayFraction: event.target.value
            }))
          }
        />
      </label>
      <label>
        <span>{message('planner.encounters')}</span>
        <input
          aria-label={message('planner.encounterCountLabel')}
          type="number"
          min={1}
          max={10}
          placeholder={message('planner.auto')}
          value={props.draft.encounterCount ?? ''}
          onChange={(event) =>
            props.mutate((current) => ({
              ...current,
              encounterCount: event.target.value
                ? Number(event.target.value)
                : null
            }))
          }
        />
      </label>
      <label>
        <span>{message('planner.seed')}</span>
        <input
          aria-label={message('planner.seedLabel')}
          type="number"
          min={0}
          value={props.seed}
          onChange={(event) =>
            props.setSeed(Math.max(0, Number(event.target.value) || 0))
          }
        />
      </label>
      <div className="planner-primary-actions">
        <button type="button" disabled={!props.dirty} onClick={props.save}>
          {message('action.save')}
        </button>
        <button
          type="button"
          className="primary-action"
          disabled={
            props.preparationRunning || props.draft.participantIds.length === 0
          }
          onClick={props.prepare}
        >
          {message('planner.prepare')}
        </button>
        {props.preparationRunning && (
          <button type="button" onClick={props.cancelPreparation}>
            {message('action.cancel')}
          </button>
        )}
      </div>
      {props.participantsOpen && (
        <div className="planner-participants">
          {props.workspace.availableParticipants.map((participant) => (
            <label key={participant.id}>
              <input
                type="checkbox"
                checked={props.draft.participantIds.includes(participant.id)}
                disabled={participant.level === null}
                onChange={(event) =>
                  props.mutate((current) => ({
                    ...current,
                    participantIds: event.target.checked
                      ? [...current.participantIds, participant.id]
                      : current.participantIds.filter(
                          (id) => id !== participant.id
                        )
                  }))
                }
              />
              <span>
                {participant.name}
                {participant.level
                  ? ` · ${formatMessage('planner.level', {
                      level: participant.level
                    })}`
                  : ` · ${message('planner.noLevel')}`}
                {participant.partyMember
                  ? ` · ${message('planner.party')}`
                  : ''}
              </span>
            </label>
          ))}
        </div>
      )}
    </header>
  )
}
