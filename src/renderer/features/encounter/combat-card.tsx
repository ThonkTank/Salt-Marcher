import { useState } from 'react'
import type {
  CombatCondition,
  CombatSnapshot,
  LiveSessionSnapshot
} from '../../../shared/contracts/live-session.js'
import { combatConditions } from '../../../shared/contracts/live-session.js'
import { formatMessage, message } from '../../i18n/messages.de.js'
import { encounterCapabilities } from './encounter-capabilities.js'

export function CombatCardView(props: {
  card: CombatSnapshot['cards'][number]
  combat: CombatSnapshot
  action: (operation: () => Promise<LiveSessionSnapshot>) => Promise<void>
}) {
  const [amount, setAmount] = useState(1)
  const [initiative, setInitiative] = useState(props.card.initiative)
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

  function adjustInitiative() {
    if (initiative === card.initiative) return
    void props.action(() =>
      encounterCapabilities().combat.adjustInitiative(
        card.id,
        initiative,
        props.combat.revision
      )
    )
  }

  function changeHp(healing: boolean) {
    void props.action(() =>
      encounterCapabilities().combat.changeHp(
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
        <input
          className="initiative-gutter"
          aria-label={formatMessage('encounter.initiativeFor', {
            name: card.name
          })}
          type="number"
          min="-10"
          max="40"
          value={initiative}
          onChange={(event) => setInitiative(Number(event.target.value))}
          onBlur={adjustInitiative}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur()
          }}
        />
        <button
          className="combat-card-body body"
          aria-label={formatMessage('encounter.hpDialog', { name: card.name })}
          onClick={() => setDialogOpen(true)}
        >
          <span className="combat-name-line name-line">
            <span className="status-mark" aria-hidden="true">
              {card.active ? '◆' : card.alive ? '◇' : '†'}
            </span>
            <strong>{displayName}</strong>
            <span className="armor-class">
              {message('ui.ac.2')} {card.armorClass}
            </span>
          </span>
          {!card.playerCharacter && (
            <span className="combat-value-line value-line">
              <span className="hp-bar" data-band={hpBand} aria-hidden="true">
                <span style={{ width: `${hpPercentage}%` }} />
              </span>
              <span className="hp-value">
                {message('ui.hp')}{' '}
                {formatMessage('encounter.hpSummary', {
                  current: card.currentHp,
                  maximum: card.maxHp
                })}
              </span>
            </span>
          )}
          {card.conditions.length > 0 && (
            <ul className="combat-conditions conditions">
              {card.conditions.map((condition) => (
                <li key={condition}>{condition}</li>
              ))}
            </ul>
          )}
        </button>
      </li>
      {dialogOpen && (
        <div className="hp-dialog-backdrop">
          <section
            className="hp-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={formatMessage('encounter.hpDialog', {
              name: card.name
            })}
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
              <button
                className="icon-action"
                aria-label={message('action.close')}
                onClick={() => setDialogOpen(false)}
              >
                ×
              </button>
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
            <h3>{message('encounter.conditions')}</h3>
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
                          encounterCapabilities().combat.toggleCondition(
                            card.id,
                            condition,
                            !active,
                            props.combat.revision
                          )
                        )
                      }
                    >
                      {condition}
                    </button>
                  )
                })}
            </div>
          </section>
        </div>
      )}
    </>
  )
}
