import { formatMessage, message } from '../../i18n/session-runtime.de.js'
import {
  formatInteger,
  formatPercent
} from '../../i18n/domain-formatters.de.js'
import { useState } from 'react'
import type { PartySnapshot } from '../../../shared/contracts/live-session.js'
import type { PartyCharacter } from '../../../shared/contracts/party.js'
import './party.css'
import { useAdventuringDayCalculation } from './use-adventuring-day-calculation.js'
export function AdventuringDayDropdown(props: {
  party: PartySnapshot
  open: boolean
  setOpen: (open: boolean) => void
  triggerLabel?: string
}) {
  const day = props.party.adventuringDay
  const [rows, setRows] = useState(() => partyRows(props.party))
  const [custom, setCustom] = useState(false)
  const [mode, setMode] = useState<'budget' | 'progress'>('budget')
  const [totalXp, setTotalXp] = useState(0)
  const calculation = useAdventuringDayCalculation(
    props.open,
    rows,
    mode,
    totalXp
  )
  return (
    <div className="party-dropdown day-dropdown">
      <button
        className="party-trigger"
        aria-expanded={props.open}
        onClick={() => {
          if (!props.open && !custom) setRows(partyRows(props.party))
          props.setOpen(!props.open)
        }}
      >
        {props.triggerLabel ??
          (!day.available
            ? message('party.noRestBudget')
            : formatMessage('party.restSummary', {
                shortRestXp: day.shortRestXp,
                longRestXp: day.longRestXp
              }))}
      </button>
      {props.open && (
        <section
          className="party-panel day-panel"
          aria-label={message('ui.adventuring.day')}
        >
          <header>
            <h2>{message('ui.adventuring.day.2')}</h2>
            <button onClick={() => props.setOpen(false)}>×</button>
          </header>
          {!day.available ? (
            <p className="empty-state">
              {message('ui.fuer.das.rastbudget.brauchen.alle.aktiven.sc.ein')}
            </p>
          ) : (
            <>
              <div className="party-rest-actions">
                <button
                  onClick={() => {
                    setRows(partyRows(props.party))
                    setCustom(false)
                  }}
                >
                  {message('ui.aktive.party')}
                </button>
                <button
                  onClick={() => {
                    setRows([...rows, { level: 1, count: 1 }])
                    setCustom(true)
                  }}
                >
                  {message('ui.zeile')}
                </button>
                <button
                  onClick={() => {
                    setRows([])
                    setCustom(true)
                  }}
                >
                  {message('ui.leeren')}
                </button>
              </div>
              <div className="party-rest-actions">
                <button
                  className={mode === 'budget' ? 'accent' : ''}
                  onClick={() => setMode('budget')}
                >
                  {message('ui.budget')}
                </button>
                <button
                  className={mode === 'progress' ? 'accent' : ''}
                  onClick={() => setMode('progress')}
                >
                  {message('ui.xp.tage')}
                </button>
              </div>
              <ul className="day-rows">
                {rows.map((row, index) => (
                  <li key={`${index}-${row.level}`}>
                    <label>
                      {message('ui.level')}
                      <input
                        type="number"
                        min="1"
                        max="20"
                        value={row.level}
                        onChange={(event) => {
                          const next = [...rows]
                          next[index] = {
                            ...row,
                            level: Number(event.target.value)
                          }
                          setRows(next)
                          setCustom(true)
                        }}
                      />
                    </label>
                    <label>
                      {message('ui.anzahl')}
                      <input
                        type="number"
                        min="1"
                        max="99"
                        value={row.count}
                        onChange={(event) => {
                          const next = [...rows]
                          next[index] = {
                            ...row,
                            count: Number(event.target.value)
                          }
                          setRows(next)
                          setCustom(true)
                        }}
                      />
                    </label>
                    <button
                      onClick={() => {
                        setRows(
                          rows.filter((_, position) => position !== index)
                        )
                        setCustom(true)
                      }}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
              {mode === 'progress' && (
                <input
                  aria-label={message('ui.gesamt.xp')}
                  type="number"
                  min="0"
                  placeholder={message('ui.gesamt.xp')}
                  value={totalXp}
                  onChange={(event) =>
                    setTotalXp(Math.max(0, Number(event.target.value)))
                  }
                />
              )}
              <div className="day-summary">
                <strong>
                  {formatInteger(calculation?.dailyBudget ?? 0)}{' '}
                  {message('ui.xp.2')}
                </strong>
                <span>
                  {custom
                    ? message('party.custom')
                    : formatMessage('party.activeSummary', {
                        partySize: day.partySize
                      })}
                </span>
                {mode === 'progress' && calculation && (
                  <span>
                    {calculation.completedDays} {message('ui.volle.tage')}{' '}
                    {formatPercent(Math.round(calculation.dayProgress * 100))}
                    {message('ui.aktueller.tag')} {calculation.shortRests}{' '}
                    {message('ui.sr')} {calculation.longRests}{' '}
                    {message('ui.lr')}
                  </span>
                )}
              </div>
              {mode === 'progress' && calculation && (
                <>
                  <progress max="1" value={calculation.dayProgress} />
                  <div className="day-timeline">
                    {calculation.timeline.map((entry) => (
                      <span key={entry}>{entry}</span>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </section>
      )}
    </div>
  )
}

function partyRows(party: PartySnapshot): { level: number; count: number }[] {
  const counts = new Map<number, number>()
  party.members
    .filter(
      (member): member is PartyCharacter & { level: number } =>
        member.active && member.level !== null
    )
    .forEach((member) =>
      counts.set(member.level, (counts.get(member.level) ?? 0) + 1)
    )
  return [...counts].map(([level, count]) => ({ level, count }))
}
