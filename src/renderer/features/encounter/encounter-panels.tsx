import { message } from '../../i18n/messages.de.js'
import { useState } from 'react'
import type { Creature } from '../../../shared/contracts/encounter.js'
import type { EncounterTuning } from '../../../shared/contracts/encounter-tuning.js'
import type { EncounterSelectionEvaluation } from '../../../shared/contracts/scene.js'
import type {
  CombatSnapshot,
  LiveSessionSnapshot
} from '../../../shared/contracts/live-session.js'
import { capabilityErrorText } from '../../capabilities/capability-errors.js'
import './encounter.css'
import { encounterCapabilities } from './encounter-capabilities.js'
import { useEncounterEvaluation } from './use-encounter-evaluation.js'

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
  const focused = props.snapshot.scene.scenes.find(
    (scene) => scene.id === props.snapshot.scene.focusedSceneId
  )!
  const assignedParty = props.snapshot.party.members.filter(
    (member) => member.active && focused.partyMemberIds.includes(member.id)
  )
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
    <div className="scenario-scroll">
      <section className="scenario-content combat-setup">
        <p className="section-kicker">{message('ui.encounter')}</p>
        <h2>
          {message('ui.gruppen.aus')} {focused.title}
        </h2>
        <label className="scenario-choice locked">
          <input type="checkbox" checked readOnly /> {message('ui.scene.party')}
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
            {message('ui.lege.zuerst.eine.gruppe.in.dieser.scene.an')}
          </p>
        )}
        {evaluation && <DifficultySummary evaluation={evaluation} />}
        <footer>
          <button onClick={props.close}>{message('action.close')}</button>
          <button
            disabled={!evaluation?.canStart}
            onClick={() => void direct()}
          >
            {message('ui.initiative.vorbereiten')}
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
        {evaluation.adjustedXp.toLocaleString()} {message('ui.adjusted.xp')}{' '}
        {evaluation.baseXp.toLocaleString()} {message('ui.base.xp')}{' '}
        {evaluation.creatureCount} {message('ui.monster')}
      </span>
      <small>
        {message('ui.easy')} {evaluation.partyThresholds[0]}{' '}
        {message('ui.medium')} {evaluation.partyThresholds[1]}{' '}
        {message('ui.hard')} {evaluation.partyThresholds[2]}{' '}
        {message('ui.deadly')} {evaluation.partyThresholds[3]}
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
        {message('ui.schwierigkeit')}
        {select('difficulty', ['auto', 'easy', 'medium', 'hard', 'deadly'])}
      </label>
      <label>
        {message('ui.menge')}
        {select('amount', ['auto', 'few', 'standard', 'many'])}
      </label>
      <label>
        {message('ui.balance')}
        {select('balance', ['auto', 'even', 'varied'])}
      </label>
      <label>
        {message('ui.vielfalt')}
        {select('diversity', ['auto', 'low', 'high'])}
      </label>
    </div>
  )
}

function tuningLabel(value: string): string {
  return (
    {
      auto: message('encounter.tuning.auto'),
      easy: message('encounter.tuning.easy'),
      medium: message('encounter.tuning.medium'),
      hard: message('encounter.tuning.hard'),
      deadly: message('encounter.tuning.deadly'),
      few: message('encounter.tuning.few'),
      standard: message('encounter.tuning.standard'),
      many: message('encounter.tuning.many'),
      even: message('encounter.tuning.even'),
      varied: message('encounter.tuning.varied'),
      low: message('encounter.tuning.low'),
      high: message('encounter.tuning.high')
    }[value] ?? value
  )
}

function CombatScenario(props: ScenarioProps) {
  if (!props.snapshot.combat)
    return (
      <p className="scenario-empty">{message('ui.kein.aktiver.encounter')}</p>
    )
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
      <h2>{message('ui.initiative')}</h2>
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
              encounterCapabilities().combat.rollInitiative(
                props.combat.revision
              )
            )
          }
        >
          {message('ui.alle.wuerfeln')}
        </button>
        <button
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
  const [confirmEnd, setConfirmEnd] = useState(false)
  return (
    <section className="scenario-content">
      <h2>
        {message('ui.runde')} {props.combat.round}
      </h2>
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
            encounterCapabilities().combat.advanceTurn(props.combat.revision)
          )
        }
      >
        {message('ui.weiter.2')}
      </button>
      {!confirmEnd ? (
        <button
          className={props.combat.allEnemiesDefeated ? 'accent' : ''}
          onClick={() => setConfirmEnd(true)}
        >
          {message('ui.kampf.beenden')}
        </button>
      ) : (
        <div className="confirm-row">
          <button onClick={() => setConfirmEnd(false)}>
            {message('ui.abbruch')}
          </button>
          <button
            onClick={() =>
              void scenarioAction(props, () =>
                encounterCapabilities().combat.end(props.combat.revision)
              )
            }
          >
            {message('ui.bestaetigen')}
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
            {message('ui.hp')} {card.currentHp}/{card.maxHp} {message('ui.ac')}{' '}
            {card.armorClass}
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
                  encounterCapabilities().combat.changeHp(
                    card.id,
                    amount,
                    false,
                    props.combat.revision
                  )
                )
              }
            >
              {message('ui.hp.2')}
            </button>
            <button
              disabled={!card.alive}
              onClick={() =>
                void props.action(() =>
                  encounterCapabilities().combat.changeHp(
                    card.id,
                    amount,
                    true,
                    props.combat.revision
                  )
                )
              }
            >
              {message('ui.hp.3')}
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
              encounterCapabilities().combat.adjustInitiative(
                card.id,
                initiative,
                props.combat.revision
              )
            )
          }
        >
          {message('ui.init')}
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
    encounterCapabilities().combat.updateResolution(
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
        await encounterCapabilities().combat.awardXp(updated.combat.revision)
      )
    } catch (cause) {
      props.onError(capabilityErrorText(cause))
    }
  }
  async function complete() {
    try {
      const updated = await saveResolution()
      if (!updated.combat) throw new Error('Combat nicht verfügbar')
      props.setSnapshot(
        await encounterCapabilities().combat.complete(updated.combat.revision)
      )
      props.close()
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
      <h2>{message('ui.kampfergebnis')}</h2>
      <p>
        {selected.length} {message('ui.gegner.besiegt')} {eligible}{' '}
        {message('ui.xp.2')}
      </p>
      <p>
        <strong>
          {perPlayer} {message('ui.xp.pro.spieler')}
        </strong>{' '}
        ({awarded} {message('ui.gesamt')}
      </p>
      <label>
        {message('ui.besiegungsschwelle')}{' '}
        <span>{Math.round(threshold * 100)}%</span>
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
        {message('ui.xp.anteil')} <span>{Math.round(fraction * 100)}%</span>
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
              {enemy.name} (
              {enemy.alive
                ? message('encounter.alive')
                : message('encounter.dead')}
              ) · {enemy.xp} {message('ui.xp.2')}
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
          {resolution.xpAwarded
            ? message('encounter.xpAwarded')
            : message('encounter.awardXp')}
        </button>
        <button onClick={() => void complete()}>
          {message('ui.zum.planer')}
        </button>
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
    props.onError(capabilityErrorText(cause))
  }
}
