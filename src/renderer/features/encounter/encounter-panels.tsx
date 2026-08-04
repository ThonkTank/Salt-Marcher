import { formatMessage, message } from '../../i18n/messages.de.js'
import { useState } from 'react'
import type { Creature } from '../../../shared/contracts/encounter.js'
import type {
  CombatSnapshot,
  CombatCommandResult,
  LiveSessionSnapshot
} from '../../../shared/contracts/live-session.js'
import { capabilityErrorText } from '../../capabilities/capability-errors.js'
import './encounter.css'
import { encounterCapabilities } from './encounter-capabilities.js'
import { CombatCardView } from './combat-card.js'
import { useEncounterEvaluation } from './use-encounter-evaluation.js'
import { DifficultySummary } from './encounter-tuning.js'
import { applyCombatCommandResult } from '../session/session-patches.js'

type ScenarioProps = {
  snapshot: LiveSessionSnapshot
  setSnapshot: (snapshot: LiveSessionSnapshot) => void
  close: () => void
  onError: (message: string) => void
  manageGroups?: () => void
  reinforce?: () => void
}

export function SessionEncounterPanel(
  props: ScenarioProps & { inspect: (creature: Creature) => void }
) {
  const [selected, setSelected] = useState<string[]>([])
  const focused = props.snapshot.scene.scenes.find(
    (scene) => scene.id === props.snapshot.scene.focusedSceneId
  )!
  const assignedParty = props.snapshot.party.members.filter(
    (member) => member.active && focused.partyMemberIds.includes(member.id)
  )
  const activeGroups = focused.groups.filter((group) => !group.archived)
  const evaluation = useEncounterEvaluation(
    focused.id,
    selected,
    props.snapshot.scene.revision,
    props.onError
  )
  if (props.snapshot.combat) return <CombatScenario {...props} />
  async function direct() {
    await scenarioAction(props, () =>
      encounterCapabilities().combat.prepare(
        focused.id,
        selected,
        props.snapshot.scene.revision
      )
    )
  }
  return (
    <>
      <div className="scenario-scroll">
        <section className="scenario-content combat-setup">
          <section className="selection-section">
            <h2>{message('encounter.assignedParty')}</h2>
            <div className="assigned-party">
              {assignedParty.map((member) => (
                <span key={member.id}>{member.name}</span>
              ))}
              {assignedParty.length === 0 && (
                <span>{message('encounter.noAssignedParty')}</span>
              )}
            </div>
          </section>
          <section className="selection-section">
            <h2>{message('encounter.groupsInScene')}</h2>
            <div className="encounter-group-choices">
              {activeGroups.map((group) => (
                <label className="encounter-group-choice" key={group.id}>
                  <input
                    type="checkbox"
                    disabled={
                      group.entries.reduce(
                        (total, entry) => total + entry.aliveQuantity,
                        0
                      ) === 0
                    }
                    checked={selected.includes(group.id)}
                    onChange={(event) =>
                      setSelected(
                        event.target.checked
                          ? [...selected, group.id]
                          : selected.filter((id) => id !== group.id)
                      )
                    }
                  />
                  <span
                    className={`status-mark disposition-${group.disposition}`}
                    aria-hidden="true"
                  >
                    ◆
                  </span>
                  <strong>{group.name}</strong>
                  <span>
                    {Math.round(
                      group.baseXp * (evaluation?.multiplier ?? 1)
                    ).toLocaleString()}
                  </span>
                </label>
              ))}
            </div>
          </section>
          {activeGroups.length === 0 && (
            <div className="scenario-empty-state">
              <h2>{message('encounter.noneGroupsTitle')}</h2>
              <p>{message('encounter.noneGroupsHint')}</p>
              {props.manageGroups && (
                <button className="primary-action" onClick={props.manageGroups}>
                  {message('ui.gruppen.managen')}
                </button>
              )}
            </div>
          )}
          {evaluation && <DifficultySummary evaluation={evaluation} meter />}
          <footer>
            <button
              className="primary-action"
              disabled={!evaluation?.canStart}
              onClick={() => void direct()}
            >
              {message('ui.initiative.vorbereiten')}
            </button>
          </footer>
        </section>
      </div>
    </>
  )
}

function CombatScenario(props: ScenarioProps) {
  if (!props.snapshot.combat)
    return (
      <p className="scenario-empty">{message('ui.kein.aktiver.encounter')}</p>
    )
  return (
    <>
      <div className="scenario-scroll">
        {props.snapshot.combat.phase === 'initiative' ? (
          <InitiativePanel {...props} combat={props.snapshot.combat} />
        ) : props.snapshot.combat.phase === 'combat' ? (
          <CombatPanel {...props} combat={props.snapshot.combat} />
        ) : (
          <ResolutionPanel {...props} combat={props.snapshot.combat} />
        )}
      </div>
    </>
  )
}

export function EncounterCrumbs(props: ScenarioProps) {
  const phase = props.snapshot.combat?.phase ?? 'selection'
  const phases = [
    { id: 'selection', label: message('encounter.selection') },
    { id: 'initiative', label: message('ui.initiative') },
    { id: 'combat', label: message('encounter.combat') },
    { id: 'resolution', label: message('encounter.resolution') }
  ] as const
  const currentIndex = phases.findIndex((candidate) => candidate.id === phase)

  async function returnTo(target: 'selection' | 'initiative' | 'combat') {
    const combat = props.snapshot.combat
    if (!combat || target === phase) return
    try {
      if (target === 'selection') {
        props.setSnapshot(
          applyCombatCommandResult(
            props.snapshot,
            await encounterCapabilities().combat.moveToPhase(
              'selection',
              combat.revision
            )
          )
        )
        return
      }
      props.setSnapshot(
        applyCombatCommandResult(
          props.snapshot,
          await encounterCapabilities().combat.moveToPhase(
            target,
            combat.revision
          )
        )
      )
    } catch (cause) {
      props.onError(capabilityErrorText(cause))
    }
  }

  return (
    <nav className="scenario-crumbs" aria-label={message('ui.encounter')}>
      {phases.map((candidate, index) => (
        <button
          key={candidate.id}
          className={index === currentIndex ? 'current' : undefined}
          aria-current={index === currentIndex ? 'step' : undefined}
          disabled={index > currentIndex}
          onClick={() =>
            void returnTo(candidate.id as 'selection' | 'initiative' | 'combat')
          }
        >
          {candidate.label}
        </button>
      ))}
    </nav>
  )
}

function InitiativePanel(props: ScenarioProps & { combat: CombatSnapshot }) {
  const [values, setValues] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      props.combat.initiativeRows.map((row) => [row.id, row.initiative])
    )
  )
  const partyRows = props.combat.initiativeRows.filter(
    (row) => row.kind === 'party'
  )
  const monsterRows = props.combat.initiativeRows.filter(
    (row) => row.kind === 'monster'
  )

  async function rollMonsters() {
    try {
      const updated = await encounterCapabilities().combat.rollInitiative(
        props.combat.revision
      )
      if (updated.combat) {
        setValues(
          Object.fromEntries(
            updated.combat.initiativeRows.map((row) => [row.id, row.initiative])
          )
        )
      }
      props.setSnapshot(applyCombatCommandResult(props.snapshot, updated))
    } catch (cause) {
      props.onError(capabilityErrorText(cause))
    }
  }

  const rows = (initiativeRows: typeof partyRows) => (
    <ul className="initiative-list">
      {initiativeRows.map((row) => (
        <li key={row.id}>
          <span>{row.label}</span>
          <input
            aria-label={formatMessage('encounter.initiativeFor', {
              name: row.label
            })}
            type="number"
            min="-10"
            max="40"
            value={values[row.id] ?? row.initiative}
            onChange={(event) =>
              setValues({ ...values, [row.id]: Number(event.target.value) })
            }
          />
        </li>
      ))}
    </ul>
  )

  return (
    <section className="scenario-content initiative-panel">
      <div className="initiative-groups">
        <section>
          <header>
            <span>{message('encounter.partyInitiative')}</span>
            <small className="hint">
              {message('encounter.partyInitiativeHint')}
            </small>
          </header>
          {rows(partyRows)}
        </section>
        <section>
          <header>
            <span>{message('encounter.monsterInitiative')}</span>
            <button onClick={() => void rollMonsters()}>
              {message('encounter.rollMonsters')}
            </button>
          </header>
          {rows(monsterRows)}
        </section>
      </div>
      <footer>
        <button
          className="primary-action"
          onClick={() =>
            void scenarioAction(props, () =>
              encounterCapabilities().combat.confirmInitiative(
                props.combat.initiativeRows.map((row) => ({
                  id: row.id,
                  initiative: values[row.id] ?? row.initiative
                })),
                props.combat.revision
              )
            )
          }
        >
          {message('ui.kampf.starten')}
        </button>
      </footer>
    </section>
  )
}

function CombatPanel(props: ScenarioProps & { combat: CombatSnapshot }) {
  const undoLabel = props.combat.undoLabel
  return (
    <section className="scenario-content combat-panel">
      <header className="round-bar combat-round-bar">
        <span>{message('ui.runde')}</span>
        <strong className="round-initial">{props.combat.round}</strong>
        <div className="round-actions turn-controls">
          <button
            className="step-back"
            disabled={!undoLabel}
            title={
              undoLabel
                ? formatMessage('encounter.undoNamed', { label: undoLabel })
                : message('encounter.undo')
            }
            onClick={() =>
              void scenarioAction(props, () =>
                encounterCapabilities().combat.retreatTurn(
                  props.combat.revision
                )
              )
            }
          >
            {message('encounter.previousTurn')}
          </button>
          <button
            className="primary-action advance"
            onClick={() =>
              void scenarioAction(props, () =>
                encounterCapabilities().combat.advanceTurn(
                  props.combat.revision
                )
              )
            }
          >
            {message('encounter.advanceTurn')}
          </button>
        </div>
      </header>
      <ul className="combat-cards">
        {props.combat.cards.map((card) => (
          <CombatCardView
            key={`${card.id}:${card.initiative}`}
            card={card}
            combat={props.combat}
            action={(operation) => scenarioAction(props, operation)}
          />
        ))}
      </ul>
      <footer className="tool-row">
        <button
          disabled={!undoLabel}
          onClick={() =>
            void scenarioAction(props, () =>
              encounterCapabilities().combat.undo(props.combat.revision)
            )
          }
        >
          {undoLabel
            ? formatMessage('encounter.undoNamed', { label: undoLabel })
            : message('encounter.undo')}
        </button>
        <button onClick={props.reinforce}>
          {message('encounter.reinforcement')}
        </button>
        <button
          className={
            props.combat.allEnemiesDefeated
              ? 'primary-action accent'
              : 'primary-action'
          }
          onClick={() =>
            void scenarioAction(props, () =>
              encounterCapabilities().combat.end(props.combat.revision)
            )
          }
        >
          {message('encounter.toResolution')}
        </button>
      </footer>
    </section>
  )
}

function ResolutionPanel(props: ScenarioProps & { combat: CombatSnapshot }) {
  const resolution = props.combat.resolution
  const [selected, setSelected] = useState(() =>
    (resolution?.enemies ?? [])
      .filter((enemy) => enemy.selected)
      .map((enemy) => enemy.id)
  )
  const [mode, setMode] = useState<'defeated' | 'manual'>(
    resolution?.mode ?? 'defeated'
  )
  const [fraction, setFraction] = useState(resolution?.xpFraction ?? 1)
  if (!resolution) return null
  const saveResolution = () =>
    encounterCapabilities().combat.updateResolution(
      selected,
      mode,
      fraction,
      props.combat.revision
    )
  async function complete() {
    try {
      let result = await saveResolution()
      let updated = applyCombatCommandResult(props.snapshot, result)
      if (!result.combat) throw new Error('Combat nicht verfügbar')
      if (!result.combat.resolution?.xpAwarded && perPlayer > 0) {
        result = await encounterCapabilities().combat.awardXp(
          result.combat.revision
        )
        updated = applyCombatCommandResult(updated, result)
      }
      if (!result.combat) throw new Error('Combat nicht verfügbar')
      props.setSnapshot(
        applyCombatCommandResult(
          updated,
          await encounterCapabilities().combat.complete(result.combat.revision)
        )
      )
    } catch (cause) {
      props.onError(capabilityErrorText(cause))
    }
  }
  const eligible = resolution.enemies
    .filter((enemy) => selected.includes(enemy.id))
    .reduce((total, enemy) => total + enemy.xp, 0)
  const awarded = Math.floor(eligible * fraction)
  const perPlayer = Math.floor(awarded / Math.max(1, resolution.partySize))
  return (
    <section className="scenario-content resolution-panel">
      <section className="resolution-section">
        <h2>{message('encounter.defeated')}</h2>
        <ul className="result-enemies">
          {resolution.enemies
            .filter((enemy) => mode === 'manual' || !enemy.alive)
            .map((enemy) => (
              <li key={enemy.id}>
                <input
                  type="checkbox"
                  checked={selected.includes(enemy.id)}
                  onChange={(event) =>
                    setSelected(
                      event.target.checked
                        ? [...selected, enemy.id]
                        : selected.filter((id) => id !== enemy.id)
                    )
                  }
                />
                <span>{enemy.name}</span>
                <small>
                  {enemy.alive
                    ? message('encounter.alive')
                    : message('encounter.dead')}
                </small>
                <span>
                  {enemy.xp.toLocaleString()} {message('ui.xp.2')}
                </span>
              </li>
            ))}
        </ul>
      </section>
      <section className="resolution-controls">
        <label>
          {message('encounter.threshold')}
          <select
            value={mode}
            onChange={(event) => {
              const next = event.target.value as 'defeated' | 'manual'
              setMode(next)
              if (next === 'defeated')
                setSelected(
                  resolution.enemies
                    .filter((enemy) => !enemy.alive)
                    .map((enemy) => enemy.id)
                )
            }}
          >
            <option value="defeated">
              {message('encounter.thresholdDefeated')}
            </option>
            <option value="manual">
              {message('encounter.thresholdManual')}
            </option>
          </select>
        </label>
        <label>
          {message('ui.xp.anteil')}
          <input
            type="text"
            inputMode="numeric"
            value={`${Math.round(fraction * 100)} %`}
            onChange={(event) => {
              const percentage = Number(event.target.value.replace(/\D/g, ''))
              setFraction(Math.max(0, Math.min(1, percentage / 100)))
            }}
          />
        </label>
      </section>
      <dl className="resolution-award">
        <div>
          <dt>{message('encounter.defeated')}</dt>
          <dd>{selected.length}</dd>
        </div>
        <div>
          <dt>{message('encounter.eligibleXp')}</dt>
          <dd>{eligible.toLocaleString()}</dd>
        </div>
        <div>
          <dt>{message('ui.gesamt')}</dt>
          <dd>{awarded.toLocaleString()}</dd>
        </div>
        <div>
          <dt>{message('ui.xp.pro.spieler')}</dt>
          <dd>{perPlayer.toLocaleString()}</dd>
        </div>
      </dl>
      <p className="loot-summary">{resolution.lootSummary}</p>
      <footer>
        <button
          className="primary-action"
          disabled={resolution.xpAwarded}
          onClick={() => void complete()}
        >
          {resolution.xpAwarded
            ? message('encounter.xpAwarded')
            : message('encounter.complete')}
        </button>
      </footer>
    </section>
  )
}

async function scenarioAction(
  props: Pick<ScenarioProps, 'snapshot' | 'setSnapshot' | 'onError'>,
  operation: () => Promise<CombatCommandResult>
): Promise<void> {
  try {
    props.setSnapshot(
      applyCombatCommandResult(props.snapshot, await operation())
    )
  } catch (cause) {
    props.onError(capabilityErrorText(cause))
  }
}
