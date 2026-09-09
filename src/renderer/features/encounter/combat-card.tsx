import { useCombatDraft } from './use-combat-draft.js'
import type { CombatCommands } from './use-combat-commands.js'
import { useDraftTransition } from '../../shell/use-draft-transition.js'
import { useState } from 'react'
import type {
  CombatCondition,
  CombatSnapshot
} from '../../../shared/contracts/live-session.js'
import { combatConditions } from '../../../shared/values/combat-values.js'
import { formatMessage, message } from '../../i18n/session-runtime.de.js'
import { ModalDialog } from '../../shell/modal-dialog.js'
import { ReadOnlyProse } from '../reference/read-only-prose.js'

export function CombatCardView(props: {
  card: CombatSnapshot['cards'][number]
  combat: CombatSnapshot
  commands: CombatCommands
}) {
  const amountDraft = useCombatDraft(
    props.commands,
    'Trefferpunkte',
    1,
    props.combat.revision
  )
  const amount = amountDraft.value
  const closeTransition = useDraftTransition(
    `${props.combat.id}:${props.card.id}`
  )
  const [dialogOpen, setDialogOpen] = useState(false)
  const card = props.card
  const hpPercentage =
    card.maxHp <= 0 ? 0 : Math.round((card.currentHp / card.maxHp) * 100)
  const hpBand =
    hpPercentage > 50
      ? 'healthy'
      : hpPercentage > 25
        ? 'wounded'
        : hpPercentage > 0
          ? 'critical'
          : 'down'
  const displayName =
    card.count > 1
      ? formatMessage('encounter.mobSummary', {
          name: card.name,
          alive: card.aliveCount,
          total: card.count
        })
      : card.name
  const activeStatusCount =
    card.conditions.length +
    Number(card.concentrating) +
    Number(card.exhaustionLevel > 0)

  function changeHp(healing: boolean) {
    void props.commands.perform(
      (current) =>
        current.combat
          ? {
              kind: 'changeHp',
              input: {
                cardId: card.id,
                amount,
                healing,
                expectedRevision: current.combat.revision
              }
            }
          : null,
      amountDraft.clear
    )
  }

  return (
    <>
      <li
        className={`combat-card${card.active ? ' active' : ''}${card.done ? ' done' : ''}${!card.alive ? ' dead' : ''}${card.playerCharacter ? ' player-character' : ''}`}
      >
        <span className="initiative-gutter">{card.initiative}</span>
        <div className="combat-card-body body">
          <span className="combat-name-line name-line">
            <span className="status-mark" aria-hidden="true">
              {card.active ? '◆' : card.alive ? '◇' : '†'}
            </span>
            <strong title={displayName} aria-label={displayName} tabIndex={0}>
              <ReadOnlyProse>{displayName}</ReadOnlyProse>
            </strong>
            <span className="armor-class">
              {message('ui.ac.2')} {card.armorClass}
            </span>
          </span>
          {!card.playerCharacter && (
            <span className="combat-value-line value-line">
              <button
                className="hp-bar"
                data-band={hpBand}
                aria-label={formatMessage('encounter.hpDialog', {
                  name: card.name
                })}
                onClick={() => setDialogOpen(true)}
              >
                <span style={{ width: `${hpPercentage}%` }} />
              </button>
              <span className="hp-value">
                {message('ui.hp')}{' '}
                {formatMessage('encounter.hpSummary', {
                  current: card.currentHp,
                  maximum: card.maxHp
                })}
              </span>
            </span>
          )}
          {(activeStatusCount > 0 || card.exhaustionLevel > 0) && (
            <ul className="combat-conditions conditions">
              {card.conditions.map((condition) => (
                <li key={condition}>
                  <ReadOnlyProse>{conditionLabel(condition)}</ReadOnlyProse>
                </li>
              ))}
              {card.concentrating && (
                <li>
                  <ReadOnlyProse>
                    {message('encounter.concentration')}
                  </ReadOnlyProse>
                </li>
              )}
              {card.exhaustionLevel > 0 && (
                <li>
                  <ReadOnlyProse>
                    {message('encounter.exhaustion')}
                  </ReadOnlyProse>{' '}
                  {card.exhaustionLevel}
                </li>
              )}
            </ul>
          )}
        </div>
      </li>
      {dialogOpen && (
        <ModalDialog
          backdropClassName="hp-dialog-backdrop"
          className="hp-dialog"
          ariaLabel={formatMessage('encounter.hpDialog', { name: card.name })}
          onClose={() => closeTransition.request(() => setDialogOpen(false))}
          busy={props.commands.busy}
        >
          {props.commands.notice}
          <header>
            <span>{displayName}</span>
            {!card.playerCharacter && (
              <output>
                {message('ui.hp')}{' '}
                {formatMessage('encounter.hpSummary', {
                  current: card.currentHp,
                  maximum: card.maxHp
                })}
              </output>
            )}
          </header>
          {!card.playerCharacter && (
            <div className="hp-dialog-controls amount">
              <input
                aria-label={formatMessage('encounter.hpChange', {
                  name: card.name
                })}
                type="number"
                min="1"
                disabled={props.commands.busy}
                value={amount}
                onChange={(event) =>
                  amountDraft.set(
                    Math.min(
                      Number.MAX_SAFE_INTEGER,
                      Math.max(1, Number(event.target.value) || 1)
                    )
                  )
                }
                onKeyDown={(event) => {
                  if (event.key === 'Enter') changeHp(false)
                }}
              />
              <button
                className="damage"
                aria-label={message('encounter.damage')}
                disabled={props.commands.busy || !card.alive}
                onClick={() => changeHp(false)}
              >
                −
              </button>
              <button
                className="heal"
                aria-label={message('encounter.heal')}
                disabled={props.commands.busy || !card.alive}
                onClick={() => changeHp(true)}
              >
                +
              </button>
            </div>
          )}
          <p className="hp-dialog-hint">{message('encounter.hpHint')}</p>
          <h3>
            {message('encounter.conditions')}
            <span>
              {formatMessage('encounter.conditionCount', {
                count: activeStatusCount,
                total: combatConditions.length + 2
              })}
            </span>
          </h3>
          <div className="condition-grid">
            {[...combatConditions]
              .sort(
                (left, right) =>
                  Number(card.conditions.includes(right)) -
                  Number(card.conditions.includes(left))
              )
              .map((condition: CombatCondition) => {
                const active = card.conditions.includes(condition)
                return (
                  <button
                    key={condition}
                    disabled={props.commands.busy}
                    className={active ? 'active' : undefined}
                    aria-pressed={active}
                    onClick={() =>
                      void props.commands.perform((current) =>
                        current.combat
                          ? {
                              kind: 'toggleCondition',
                              input: {
                                cardId: card.id,
                                condition,
                                active: !active,
                                expectedRevision: current.combat.revision
                              }
                            }
                          : null
                      )
                    }
                  >
                    <span className="condition-mark" aria-hidden="true">
                      {active ? '◆' : '◇'}
                    </span>
                    {conditionLabel(condition)}
                  </button>
                )
              })}
          </div>
          <div className="condition-grid">
            <button
              className={card.concentrating ? 'active' : undefined}
              aria-pressed={card.concentrating}
              disabled={props.commands.busy}
              onClick={() =>
                void props.commands.perform((current) =>
                  current.combat
                    ? {
                        kind: 'setConcentration',
                        input: {
                          cardId: card.id,
                          concentrating: !card.concentrating,
                          expectedRevision: current.combat.revision
                        }
                      }
                    : null
                )
              }
            >
              <span className="condition-mark" aria-hidden="true">
                {card.concentrating ? '◆' : '◇'}
              </span>
              {message('encounter.concentration')}
            </button>
            <label>
              {message('encounter.exhaustionLevel')}
              <select
                value={card.exhaustionLevel}
                disabled={props.commands.busy}
                onChange={(event) =>
                  void props.commands.perform((current) =>
                    current.combat
                      ? {
                          kind: 'setExhaustion',
                          input: {
                            cardId: card.id,
                            exhaustionLevel: Number(event.target.value),
                            expectedRevision: current.combat.revision
                          }
                        }
                      : null
                  )
                }
              >
                {[0, 1, 2, 3, 4, 5, 6].map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button
            className="hp-dialog-close"
            onClick={() => closeTransition.request(() => setDialogOpen(false))}
          >
            {message('action.close')}
          </button>
        </ModalDialog>
      )}
      {closeTransition.dialog}
    </>
  )
}

function conditionLabel(condition: CombatCondition): string {
  return `${condition[0]!.toLocaleUpperCase('en-US')}${condition.slice(1)}`
}
