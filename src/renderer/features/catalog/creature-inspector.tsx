import type { Creature } from '../../../shared/contracts/encounter.js'
import { IlluminatedHeading } from '../../shell/illuminated-heading.js'

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
      aria-label="Monster Details"
    >
      <header>
        <div>
          <p className="section-kicker">Statblock</p>
          <IlluminatedHeading title={c.name} />
        </div>
        {props.close && (
          <button aria-label="Monster Details schließen" onClick={props.close}>
            ×
          </button>
        )}
      </header>
      <p className="stat-meta">
        {c.size} {c.type}
        {c.subtype ? ` (${c.subtype})` : ''}, {c.alignment}
      </p>
      <hr />
      <p>
        <strong>Rüstungsklasse</strong> {c.ac}
      </p>
      <p>
        <strong>Trefferpunkte</strong> {c.hp} ({c.hitDice})
      </p>
      <p>
        <strong>Bewegung</strong> {c.speed}
      </p>
      <div className="ability-grid">
        {ability('STR', c.abilities.str)}
        {ability('DEX', c.abilities.dex)}
        {ability('CON', c.abilities.con)}
        {ability('INT', c.abilities.int)}
        {ability('WIS', c.abilities.wis)}
        {ability('CHA', c.abilities.cha)}
      </div>
      <p>
        <strong>Rettungswürfe</strong> {c.savingThrows || '—'}
      </p>
      <p>
        <strong>Fertigkeiten</strong> {c.skills || '—'}
      </p>
      <p>
        <strong>Sinne</strong> {c.senses || '—'}
      </p>
      <p>
        <strong>Sprachen</strong> {c.languages || '—'}
      </p>
      <p>
        <strong>Herausforderung</strong> {c.challengeRating} (
        {c.xp.toLocaleString()} XP)
      </p>
      {c.traits.length > 0 && (
        <>
          <h3>Merkmale</h3>
          {c.traits.map((trait) => (
            <p key={trait.name}>
              <strong>{trait.name}.</strong> {trait.description}
            </p>
          ))}
        </>
      )}
      <h3>Aktionen</h3>
      {c.actions.map((action) => (
        <p key={action.name}>
          <strong>{action.name}.</strong> {action.description}
        </p>
      ))}
      {c.legendaryActions.length > 0 && (
        <>
          <h3>Legendäre Aktionen</h3>
          {c.legendaryActions.map((action) => (
            <p key={action.name}>
              <strong>{action.name}.</strong> {action.description}
            </p>
          ))}
        </>
      )}
    </aside>
  )
}
