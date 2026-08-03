import { useEffect, useState } from 'react'
import type { Creature } from '../../../shared/contracts/encounter.js'
import type { EncounterTuning } from '../../../shared/contracts/encounter-tuning.js'
import type { EncounterSelectionEvaluation } from '../../../shared/contracts/scene.js'
import type {
  CombatSnapshot,
  LiveSessionSnapshot
} from '../../../shared/contracts/live-session.js'
import { errorText } from '../catalog/catalog-state.js'

type ScenarioProps = {
  snapshot: LiveSessionSnapshot
  setSnapshot: (snapshot: LiveSessionSnapshot) => void
  close: () => void
  onError: (message: string) => void
}

export function SessionEncounterPanel(
  props: ScenarioProps & { inspect: (creature: Creature) => void }
) {
  const [selected, setSelected] = useState<string[]>([])
  const [evaluation, setEvaluation] =
    useState<EncounterSelectionEvaluation | null>(null)
  const onError = props.onError
  const focused = props.snapshot.scene.scenes.find(
    (scene) => scene.id === props.snapshot.scene.focusedSceneId
  )!
  const assignedParty = props.snapshot.party.members.filter(
    (member) => member.active && focused.partyMemberIds.includes(member.id)
  )
  useEffect(() => {
    let current = true
    void window.saltMarcher.encounter
      .evaluate(focused.id, selected, props.snapshot.scene.revision)
      .then((value) => {
        if (current) setEvaluation(value)
      })
      .catch((cause) => {
        if (current) onError(errorText(cause))
      })
    return () => {
      current = false
    }
  }, [focused.id, props.snapshot.scene.revision, selected, onError])
  if (props.snapshot.combat) return <CombatScenario {...props} />
  async function direct() {
    await scenarioAction(props, () =>
      window.saltMarcher.combat.prepare(
        focused.id,
        selected,
        props.snapshot.scene.revision
      )
    )
  }
  return (
    <div className="scenario-scroll">
      <section className="scenario-content combat-setup">
        <p className="section-kicker">Encounter</p>
        <h2>Gruppen aus {focused.title}</h2>
        <label className="scenario-choice locked">
          <input type="checkbox" checked readOnly /> Scene-Party (
          {assignedParty.length})
        </label>
        {focused.groups.map((group) => (
          <label className="scenario-choice" key={group.id}>
            <input
              type="checkbox"
              checked={selected.includes(group.id)}
              onChange={(event) =>
                setSelected(
                  event.target.checked
                    ? [...selected, group.id]
                    : selected.filter((id) => id !== group.id)
                )
              }
            />
            {group.name}
          </label>
        ))}
        {focused.groups.length === 0 && (
          <p className="empty-state">
            Lege zuerst eine Gruppe in dieser Scene an.
          </p>
        )}
        {evaluation && <DifficultySummary evaluation={evaluation} />}
        <footer>
          <button onClick={props.close}>Schließen</button>
          <button
            disabled={!evaluation?.canStart}
            onClick={() => void direct()}
          >
            Initiative vorbereiten
          </button>
        </footer>
      </section>
    </div>
  )
}

export function DifficultySummary(props: {
  evaluation: Pick<
    EncounterSelectionEvaluation,
    | 'difficultyLabel'
    | 'adjustedXp'
    | 'baseXp'
    | 'partyThresholds'
    | 'creatureCount'
    | 'message'
  >
  meter?: boolean
}) {
  const evaluation = props.evaluation
  const meterMaximum = Math.max(1, evaluation.partyThresholds[3] * 1.5)
  const meterPosition = Math.min(
    100,
    Math.round((evaluation.adjustedXp / meterMaximum) * 100)
  )
  return (
    <div className="difficulty-summary" aria-live="polite">
      <strong>{evaluation.difficultyLabel}</strong>
      <span>
        {evaluation.adjustedXp.toLocaleString()} adjusted XP ·{' '}
        {evaluation.baseXp.toLocaleString()} base XP ·{' '}
        {evaluation.creatureCount} Monster
      </span>
      <small>
        Easy {evaluation.partyThresholds[0]} · Medium{' '}
        {evaluation.partyThresholds[1]} · Hard {evaluation.partyThresholds[2]} ·
        Deadly {evaluation.partyThresholds[3]}
      </small>
      {props.meter && (
        <div className="difficulty-meter" aria-hidden="true">
          <span style={{ width: `${meterPosition}%` }} />
        </div>
      )}
      <small>{evaluation.message}</small>
    </div>
  )
}

export function TuningControls(props: {
  tuning: EncounterTuning
  changed: (tuning: EncounterTuning) => void
}) {
  const select = <K extends keyof EncounterTuning>(
    field: K,
    values: readonly EncounterTuning[K][]
  ) => (
    <select
      aria-label={field}
      value={props.tuning[field]}
      onChange={(event) =>
        props.changed({
          ...props.tuning,
          [field]: event.target.value as EncounterTuning[K]
        })
      }
    >
      {values.map((value) => (
        <option key={value} value={value}>
          {tuningLabel(value)}
        </option>
      ))}
    </select>
  )
  return (
    <div className="tuning-controls">
      <label>
        Schwierigkeit
        {select('difficulty', ['auto', 'easy', 'medium', 'hard', 'deadly'])}
      </label>
      <label>
        Menge
        {select('amount', ['auto', 'few', 'standard', 'many'])}
      </label>
      <label>
        Balance
        {select('balance', ['auto', 'even', 'varied'])}
      </label>
      <label>
        Vielfalt
        {select('diversity', ['auto', 'low', 'high'])}
      </label>
    </div>
  )
}

function tuningLabel(value: string): string {
  return (
    {
      auto: 'Auto',
      easy: 'Leicht',
      medium: 'Mittel',
      hard: 'Schwer',
      deadly: 'Tödlich',
      few: 'Wenige',
      standard: 'Standard',
      many: 'Viele',
      even: 'Ausgeglichen',
      varied: 'Variiert',
      low: 'Niedrig',
      high: 'Hoch'
    }[value] ?? value
  )
}

function CombatScenario(props: ScenarioProps) {
  if (!props.snapshot.combat)
    return <p className="scenario-empty">Kein aktiver Encounter.</p>
  if (props.snapshot.combat.phase === 'initiative')
    return <InitiativePanel {...props} combat={props.snapshot.combat} />
  if (props.snapshot.combat.phase === 'combat')
    return <CombatPanel {...props} combat={props.snapshot.combat} />
  return <ResolutionPanel {...props} combat={props.snapshot.combat} />
}

function InitiativePanel(props: ScenarioProps & { combat: CombatSnapshot }) {
  const [values, setValues] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      props.combat.initiativeRows.map((row) => [row.id, row.initiative])
    )
  )
  return (
    <section className="scenario-content">
      <h2>Initiative</h2>
      <ul className="initiative-list">
        {props.combat.initiativeRows.map((row) => (
          <li key={row.id}>
            <span>{row.label}</span>
            <input
              aria-label={`Initiative ${row.label}`}
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
      <footer>
        <button
          onClick={() =>
            void scenarioAction(props, () =>
              window.saltMarcher.combat.rollInitiative(props.combat.revision)
            )
          }
        >
          Alle würfeln
        </button>
        <button
          onClick={() =>
            void scenarioAction(props, () =>
              window.saltMarcher.combat.confirmInitiative(
                props.combat.initiativeRows.map((row) => ({
                  id: row.id,
                  initiative: values[row.id] ?? row.initiative
                })),
                props.combat.revision
              )
            )
          }
        >
          Kampf starten
        </button>
      </footer>
    </section>
  )
}

function CombatPanel(props: ScenarioProps & { combat: CombatSnapshot }) {
  const [confirmEnd, setConfirmEnd] = useState(false)
  return (
    <section className="scenario-content">
      <h2>Runde {props.combat.round}</h2>
      <ul className="combat-cards">
        {props.combat.cards.map((card) => (
          <CombatCardView
            key={card.id}
            card={card}
            combat={props.combat}
            action={(operation) => scenarioAction(props, operation)}
          />
        ))}
      </ul>
      <button
        className="primary-action"
        onClick={() =>
          void scenarioAction(props, () =>
            window.saltMarcher.combat.advanceTurn(props.combat.revision)
          )
        }
      >
        ▶ Weiter
      </button>
      {!confirmEnd ? (
        <button
          className={props.combat.allEnemiesDefeated ? 'accent' : ''}
          onClick={() => setConfirmEnd(true)}
        >
          Kampf beenden
        </button>
      ) : (
        <div className="confirm-row">
          <button onClick={() => setConfirmEnd(false)}>Abbruch</button>
          <button
            onClick={() =>
              void scenarioAction(props, () =>
                window.saltMarcher.combat.end(props.combat.revision)
              )
            }
          >
            Bestätigen
          </button>
        </div>
      )}
    </section>
  )
}

function CombatCardView(props: {
  card: CombatSnapshot['cards'][number]
  combat: CombatSnapshot
  action: (operation: () => Promise<LiveSessionSnapshot>) => Promise<void>
}) {
  const [amount, setAmount] = useState(1)
  const [initiative, setInitiative] = useState(props.card.initiative)
  const card = props.card
  return (
    <li
      className={`combat-card${card.active ? ' active' : ''}${!card.alive ? ' dead' : ''}`}
    >
      <header>
        <strong>
          {card.active ? '▶ ' : ''}
          {card.alive ? card.name : `† ${card.name}`}
          {card.count > 1 ? ` × ${card.count}` : ''}
        </strong>
      </header>
      {!card.playerCharacter && (
        <>
          <span>
            HP {card.currentHp}/{card.maxHp} · AC {card.armorClass}
          </span>
          <progress max={card.maxHp} value={card.currentHp} />
          <div className="card-controls">
            <input
              aria-label={`HP Änderung ${card.name}`}
              type="number"
              min="1"
              value={amount}
              onChange={(event) =>
                setAmount(Math.max(1, Number(event.target.value)))
              }
            />
            <button
              disabled={!card.alive}
              onClick={() =>
                void props.action(() =>
                  window.saltMarcher.combat.changeHp(
                    card.id,
                    amount,
                    false,
                    props.combat.revision
                  )
                )
              }
            >
              − HP
            </button>
            <button
              disabled={!card.alive}
              onClick={() =>
                void props.action(() =>
                  window.saltMarcher.combat.changeHp(
                    card.id,
                    amount,
                    true,
                    props.combat.revision
                  )
                )
              }
            >
              + HP
            </button>
          </div>
        </>
      )}
      <div className="card-controls">
        <input
          aria-label={`Initiative ändern ${card.name}`}
          type="number"
          min="-10"
          max="40"
          value={initiative}
          onChange={(event) => setInitiative(Number(event.target.value))}
        />
        <button
          onClick={() =>
            void props.action(() =>
              window.saltMarcher.combat.adjustInitiative(
                card.id,
                initiative,
                props.combat.revision
              )
            )
          }
        >
          Init
        </button>
      </div>
      <small>{card.detail}</small>
    </li>
  )
}

function ResolutionPanel(props: ScenarioProps & { combat: CombatSnapshot }) {
  const resolution = props.combat.resolution
  const [selected, setSelected] = useState(() =>
    (resolution?.enemies ?? [])
      .filter((enemy) => enemy.selected)
      .map((enemy) => enemy.id)
  )
  const [threshold, setThreshold] = useState(resolution?.thresholdFraction ?? 1)
  const [fraction, setFraction] = useState(resolution?.xpFraction ?? 1)
  if (!resolution) return null
  const saveResolution = () =>
    window.saltMarcher.combat.updateResolution(
      selected,
      threshold,
      fraction,
      props.combat.revision
    )
  async function award() {
    try {
      const updated = await saveResolution()
      if (!updated.combat) throw new Error('Combat nicht verfügbar')
      props.setSnapshot(
        await window.saltMarcher.combat.awardXp(updated.combat.revision)
      )
    } catch (cause) {
      props.onError(errorText(cause))
    }
  }
  async function complete() {
    try {
      const updated = await saveResolution()
      if (!updated.combat) throw new Error('Combat nicht verfügbar')
      props.setSnapshot(
        await window.saltMarcher.combat.complete(updated.combat.revision)
      )
      props.close()
    } catch (cause) {
      props.onError(errorText(cause))
    }
  }
  const eligible = resolution.enemies
    .filter((enemy) => selected.includes(enemy.id))
    .reduce((total, enemy) => total + enemy.xp, 0)
  const awarded = Math.floor(eligible * fraction)
  const perPlayer = Math.floor(awarded / Math.max(1, resolution.partySize))
  return (
    <section className="scenario-content resolution-panel">
      <h2>Kampfergebnis</h2>
      <p>
        {selected.length} Gegner besiegt · {eligible} XP
      </p>
      <p>
        <strong>{perPlayer} XP pro Spieler</strong> ({awarded} gesamt)
      </p>
      <label>
        Besiegungsschwelle <span>{Math.round(threshold * 100)}%</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={threshold}
          onChange={(event) => setThreshold(Number(event.target.value))}
        />
      </label>
      <label>
        XP-Anteil <span>{Math.round(fraction * 100)}%</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={fraction}
          onChange={(event) => setFraction(Number(event.target.value))}
        />
      </label>
      <ul className="result-enemies">
        {resolution.enemies.map((enemy) => (
          <li key={enemy.id}>
            <label>
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
              {enemy.name} ({enemy.alive ? 'Lebt' : 'Tot'}) · {enemy.xp} XP
            </label>
          </li>
        ))}
      </ul>
      <p className="loot-summary">{resolution.lootSummary}</p>
      <footer>
        <button
          disabled={resolution.xpAwarded || perPlayer <= 0}
          onClick={() => void award()}
        >
          {resolution.xpAwarded ? 'XP verteilt' : 'XP verteilen'}
        </button>
        <button onClick={() => void complete()}>Zum Planer</button>
      </footer>
    </section>
  )
}

async function scenarioAction(
  props: Pick<ScenarioProps, 'snapshot' | 'setSnapshot' | 'onError'>,
  operation: () => Promise<LiveSessionSnapshot>
): Promise<void> {
  try {
    props.setSnapshot(await operation())
  } catch (cause) {
    props.onError(errorText(cause))
  }
}
