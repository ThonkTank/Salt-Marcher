import { message } from '../../i18n/messages.de.js'
import type { Creature } from '../../../shared/contracts/encounter.js'
import { IlluminatedHeading } from '../../shell/illuminated-heading.js'
import './catalog.css'

export function CreatureInspector(props: {
  creature: Creature
  close?: () => void
  embedded?: boolean
}) {
  const c = props.creature
  const ability = (label: string, value: number) => (
    <div>
      <strong>{label}</strong>
      <span>
        {value} ({Math.floor((value - 10) / 2) >= 0 ? '+' : ''}
        {Math.floor((value - 10) / 2)})
      </span>
    </div>
  )
  return (
    <aside
      className={`creature-inspector${props.embedded ? ' embedded' : ''}`}
      aria-label={message('ui.monster.details')}
    >
      <header>
        <div>
          <IlluminatedHeading title={c.name} />
        </div>
        {props.close && (
          <button
            aria-label={message('ui.monster.details.schliessen')}
            onClick={props.close}
          >
            ×
          </button>
        )}
      </header>
      <p className="stat-meta">
        {c.size} {c.type}
        {c.subtype ? ` (${c.subtype})` : ''}, {c.alignment} ·{' '}
        {message('ui.herausforderung')} {c.challengeRating} (
        {c.xp.toLocaleString()} {message('ui.xp')}
      </p>
      <hr />
      <div className="ability-grid">
        {ability('STR', c.abilities.str)}
        {ability('DEX', c.abilities.dex)}
        {ability('CON', c.abilities.con)}
        {ability('INT', c.abilities.int)}
        {ability('WIS', c.abilities.wis)}
        {ability('CHA', c.abilities.cha)}
      </div>
      <div className="stat-vitals">
        <p>
          <strong>{message('ui.ruestungsklasse')}</strong> {c.ac}
        </p>
        <p>
          <strong>{message('ui.trefferpunkte')}</strong> {c.hp} ({c.hitDice})
        </p>
        <p>
          <strong>{message('ui.bewegung')}</strong> {c.speed}
        </p>
      </div>
      {c.traits.length > 0 && (
        <>
          <h3>{message('ui.merkmale')}</h3>
          {c.traits.map((trait) => (
            <p key={trait.name}>
              <strong>{trait.name}.</strong> {trait.description}
            </p>
          ))}
        </>
      )}
      <h3>{message('ui.aktionen')}</h3>
      {c.actions.map((action) => (
        <p key={action.name}>
          <strong>{action.name}.</strong> {action.description}
        </p>
      ))}
      {c.legendaryActions.length > 0 && (
        <>
          <h3>{message('ui.legendaere.aktionen')}</h3>
          {c.legendaryActions.map((action) => (
            <p key={action.name}>
              <strong>{action.name}.</strong> {action.description}
            </p>
          ))}
        </>
      )}
      <div className="stat-extras">
        <p>
          <strong>{message('ui.rettungswuerfe')}</strong>{' '}
          {c.savingThrows || '—'}
        </p>
        <p>
          <strong>{message('ui.fertigkeiten')}</strong> {c.skills || '—'}
        </p>
        <p>
          <strong>{message('ui.sinne')}</strong> {c.senses || '—'}
        </p>
        <p>
          <strong>{message('ui.sprachen')}</strong> {c.languages || '—'}
        </p>
      </div>
    </aside>
  )
}
