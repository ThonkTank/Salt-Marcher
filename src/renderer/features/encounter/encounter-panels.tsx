import { useCombatDraft } from './use-combat-draft.js'
import type { CombatCommands } from './use-combat-commands.js'
import { formatMessage, message } from '../../i18n/session-runtime.de.js'
import {
  formatInteger,
  formatPercent
} from '../../i18n/domain-formatters.de.js'
import { useState } from 'react'
import type { Creature } from '../../../shared/contracts/encounter.js'
import type {
  CombatSnapshot,
  LiveSessionSnapshot
} from '../../../shared/contracts/live-session.js'
import './encounter.css'
import { CombatCardView } from './combat-card.js'
import { useEncounterEvaluation } from './use-encounter-evaluation.js'
import { DifficultySummary } from './encounter-tuning.js'
import type {
  LootSceneProjection,
  Treasure
} from '../../../shared/contracts/loot.js'
import { encounterXpMultiplier } from '../../../shared/encounter-xp.js'

type ScenarioProps = {
  commands: CombatCommands
  snapshot: LiveSessionSnapshot
  loot: LootSceneProjection
  setSnapshot: (snapshot: LiveSessionSnapshot) => void
  onError: (message: string) => void
  manageGroups?: () => void
  reinforce?: () => void
  distribute?: (treasure: Treasure) => void
}

export function SessionEncounterPanel(
  props: ScenarioProps & {
    inspect: (creature: Creature) => void
    selection?: readonly string[]
    selectionChanged?: (ids: readonly string[]) => void
  }
) {
  const [localSelection, setLocalSelection] = useState<readonly string[]>([])
  const selected = props.selection ?? localSelection
  const setSelected = props.selectionChanged ?? setLocalSelection
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
    props.onError,
    !props.snapshot.combat && !props.commands.busy
  )
  if (props.snapshot.combat) return <CombatScenario {...props} />
  function direct() {
    props.commands.request((current) => ({
      kind: 'prepare',
      input: {
        sceneId: current.scene.focusedSceneId,
        groupIds: [...selected],
        expectedSceneRevision: current.scene.revision
      }
    }))
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
                      props.commands.busy ||
                      group.entries.reduce(
                        (total, entry) => total + entry.aliveQuantity,
                        0
                      ) === 0
                    }
                    checked={selected.includes(group.id)}
                    onChange={(event) =>
                      !props.commands.blocked() &&
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
                    {formatInteger(
                      Math.round(group.baseXp * (evaluation?.multiplier ?? 1))
                    )}
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
              disabled={props.commands.busy || !evaluation?.canStart}
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

  function returnTo(target: 'selection' | 'initiative' | 'combat') {
    if (target === phase) return
    props.commands.request((current) =>
      current.combat
        ? {
            kind: 'moveToPhase',
            input: { target, expectedRevision: current.combat.revision }
          }
        : null
    )
  }

  return (
    <nav className="scenario-crumbs" aria-label={message('ui.encounter')}>
      {phases.map((candidate, index) => (
        <button
          key={candidate.id}
          className={index === currentIndex ? 'current' : undefined}
          aria-current={index === currentIndex ? 'step' : undefined}
          disabled={props.commands.busy || index >= currentIndex}
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
  const draft = useCombatDraft(
    props.commands,
    'Initiative',
    Object.fromEntries(
      props.combat.initiativeRows.map((row) => [row.id, row.initiative])
    ),
    props.combat.revision,
    (values, current) => ({
      kind: 'saveInitiative',
      input: {
        values: Object.entries(values).map(([id, initiative]) => ({
          id,
          initiative
        })),
        expectedRevision: current.combat!.revision
      }
    })
  )
  const values = draft.value
  const partyRows = props.combat.initiativeRows.filter(
    (row) => row.kind === 'party'
  )
  const monsterRows = props.combat.initiativeRows.filter(
    (row) => row.kind === 'monster'
  )

  function rollMonsters() {
    props.commands.request((current) =>
      current.combat
        ? {
            kind: 'rollInitiative',
            input: { expectedRevision: current.combat.revision }
          }
        : null
    )
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
            disabled={props.commands.busy}
            type="number"
            min="-10"
            max="40"
            value={values[row.id] ?? row.initiative}
            onChange={(event) =>
              draft.set({ ...values, [row.id]: Number(event.target.value) })
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
            <button
              disabled={props.commands.busy}
              onClick={() => void rollMonsters()}
            >
              {message('encounter.rollMonsters')}
            </button>
          </header>
          {rows(monsterRows)}
        </section>
      </div>
      <footer>
        <button
          className="primary-action"
          disabled={props.commands.busy}
          onClick={() =>
            props.commands.request((current) =>
              current.combat
                ? {
                    kind: 'confirmInitiative',
                    input: {
                      values: current.combat.initiativeRows.map((row) => ({
                        id: row.id,
                        initiative: row.initiative
                      })),
                      expectedRevision: current.combat.revision
                    }
                  }
                : null
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
            disabled={props.commands.busy || !undoLabel}
            title={
              undoLabel
                ? formatMessage('encounter.undoNamed', { label: undoLabel })
                : message('encounter.undo')
            }
            onClick={() =>
              void props.commands.perform((current) =>
                current.combat
                  ? {
                      kind: 'retreatTurn',
                      input: { expectedRevision: current.combat.revision }
                    }
                  : null
              )
            }
          >
            {message('encounter.previousTurn')}
          </button>
          <button
            className="primary-action advance"
            disabled={props.commands.busy}
            onClick={() =>
              void props.commands.perform((current) =>
                current.combat
                  ? {
                      kind: 'advanceTurn',
                      input: { expectedRevision: current.combat.revision }
                    }
                  : null
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
            key={card.id}
            card={card}
            combat={props.combat}
            commands={props.commands}
          />
        ))}
      </ul>
      <footer className="tool-row">
        <button
          disabled={props.commands.busy || !undoLabel}
          onClick={() =>
            void props.commands.perform((current) =>
              current.combat
                ? {
                    kind: 'undo',
                    input: { expectedRevision: current.combat.revision }
                  }
                : null
            )
          }
        >
          {undoLabel
            ? formatMessage('encounter.undoNamed', { label: undoLabel })
            : message('encounter.undo')}
        </button>
        <button disabled={props.commands.busy} onClick={props.reinforce}>
          {message('encounter.reinforcement')}
        </button>
        <button
          disabled={props.commands.busy}
          className={
            props.combat.allEnemiesDefeated
              ? 'primary-action accent'
              : 'primary-action'
          }
          onClick={() =>
            props.commands.request((current) =>
              current.combat
                ? {
                    kind: 'end',
                    input: { expectedRevision: current.combat.revision }
                  }
                : null
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
  const draft = useCombatDraft(
    props.commands,
    'Kampfergebnis',
    {
      selected: (resolution?.enemies ?? [])
        .filter((enemy) => enemy.selected)
        .map((enemy) => enemy.id),
      mode: resolution?.mode ?? 'defeated',
      fraction: resolution?.xpFraction ?? 1
    },
    props.combat.revision,
    (value, current) => ({
      kind: 'updateResolution',
      input: {
        selectedEnemyIds: value.selected,
        mode: value.mode,
        xpFraction: value.fraction,
        expectedRevision: current.combat!.revision
      }
    })
  )
  const { selected, mode, fraction } = draft.value
  const setSelected = (selected: string[]) =>
    draft.set({ ...draft.value, selected })
  if (!resolution) return null
  const treasures = [
    ...props.loot.locationTreasures,
    ...props.loot.groupTreasures.flatMap((entry) => entry.treasures)
  ].filter((treasure) => resolution.treasureIds.includes(treasure.id))
  function complete() {
    props.commands.request((current) => {
      const combat = current.combat
      const result = combat?.resolution
      if (!combat || !result) return null
      return {
        kind: 'finishResolution',
        input: {
          selectedEnemyIds: result.enemies
            .filter((enemy) => enemy.selected)
            .map((enemy) => enemy.id),
          mode: result.mode,
          xpFraction: result.xpFraction,
          expectedRevision: combat.revision,
          expectedCampaignRulesRevision: result.campaignRulesRevision
        }
      }
    })
  }
  const eligible = resolution.enemies
    .filter((enemy) => selected.includes(enemy.id))
    .reduce((total, enemy) => total + enemy.xp, 0)
  const adjusted = Math.round(
    eligible * encounterXpMultiplier(selected.length, resolution.partySize)
  )
  const rewardEligible =
    resolution.rewardXpBasis === 'adjusted' ? adjusted : eligible
  const awarded = Math.floor(rewardEligible * fraction)
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
                  disabled={props.commands.busy || resolution.xpAwarded}
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
                  {formatInteger(enemy.xp)} {message('ui.xp.2')}
                </span>
              </li>
            ))}
        </ul>
      </section>
      <section className="resolution-controls">
        <label>
          {message('encounter.threshold')}
          <select
            disabled={props.commands.busy || resolution.xpAwarded}
            value={mode}
            onChange={(event) => {
              const next = event.target.value as 'defeated' | 'manual'
              draft.set({
                ...draft.value,
                mode: next,
                selected:
                  next === 'defeated'
                    ? resolution.enemies
                        .filter((enemy) => !enemy.alive)
                        .map((enemy) => enemy.id)
                    : selected
              })
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
            disabled={props.commands.busy || resolution.xpAwarded}
            type="text"
            inputMode="numeric"
            value={formatPercent(Math.round(fraction * 100))}
            onChange={(event) => {
              const percentage = Number(event.target.value.replace(/\D/g, ''))
              draft.set({
                ...draft.value,
                fraction: Math.max(0, Math.min(1, percentage / 100))
              })
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
          <dd>{formatInteger(eligible)}</dd>
        </div>
        <div>
          <dt>{message('ui.gesamt')}</dt>
          <dd>{formatInteger(awarded)}</dd>
        </div>
        <div>
          <dt>{message('ui.xp.pro.spieler')}</dt>
          <dd>{formatInteger(perPlayer)}</dd>
        </div>
      </dl>
      <div className="loot-summary">
        {treasures.length === 0 ? (
          <span>{message('loot.noneEncounter')}</span>
        ) : (
          treasures.map((treasure) => (
            <button
              type="button"
              key={treasure.id}
              onClick={() => props.distribute?.(treasure)}
            >
              {formatMessage('loot.distributeNamed', { name: treasure.label })}
            </button>
          ))
        )}
      </div>
      <footer>
        <button
          className="primary-action"
          disabled={props.commands.busy}
          onClick={() => void complete()}
        >
          {message('encounter.complete')}
        </button>
      </footer>
    </section>
  )
}
