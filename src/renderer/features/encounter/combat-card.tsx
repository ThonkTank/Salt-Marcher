import { useState } from 'react'
import type {
  CombatCondition,
  CombatCommandResult,
  CombatSnapshot
} from '../../../shared/contracts/live-session.js'
import { combatConditions } from '../../../shared/contracts/live-session.js'
import { formatMessage, message } from '../../i18n/session-runtime.de.js'
import { encounterCapabilities } from './encounter-capabilities.js'
import { ModalDialog } from '../../shell/modal-dialog.js'
import { ReadOnlyProse } from '../reference/read-only-prose.js'
import { useCapabilityApi } from '../../capabilities/use-capability-api.js'

export function CombatCardView(props: {
  card: CombatSnapshot['cards'][number]
  combat: CombatSnapshot
  action: (operation: () => Promise<CombatCommandResult>) => Promise<void>
}) {
  const api = useCapabilityApi()
  const [amount, setAmount] = useState(1)
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
    void props.action(() =>
      encounterCapabilities(api).combat.changeHp(
        card.id,
        amount,
        healing,
        props.combat.revision
      )
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
            <strong>
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
          onClose={() => setDialogOpen(false)}
        >
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
                value={amount}
                onChange={(event) =>
                  setAmount(Math.max(1, Number(event.target.value) || 1))
                }
                onKeyDown={(event) => {
                  if (event.key === 'Enter') changeHp(false)
                }}
              />
              <button
                className="damage"
                aria-label={message('encounter.damage')}
                title={message('encounter.damage')}
                disabled={!card.alive}
                onClick={() => changeHp(false)}
              >
                −
              </button>
              <button
                className="heal"
                aria-label={message('encounter.heal')}
                title={message('encounter.heal')}
                disabled={!card.alive}
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
                    className={active ? 'active' : undefined}
                    aria-pressed={active}
                    onClick={() =>
                      void props.action(() =>
                        encounterCapabilities(api).combat.toggleCondition(
                          card.id,
                          condition,
                          !active,
                          props.combat.revision
                        )
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
              onClick={() =>
                void props.action(() =>
                  encounterCapabilities(api).combat.setConcentration(
                    card.id,
                    !card.concentrating,
                    props.combat.revision
                  )
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
                onChange={(event) =>
                  void props.action(() =>
                    encounterCapabilities(api).combat.setExhaustion(
                      card.id,
                      Number(event.target.value),
                      props.combat.revision
                    )
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
            onClick={() => setDialogOpen(false)}
          >
            {message('action.close')}
          </button>
        </ModalDialog>
      )}
    </>
  )
}

function conditionLabel(condition: CombatCondition): string {
  return `${condition[0]!.toLocaleUpperCase('en-US')}${condition.slice(1)}`
}
