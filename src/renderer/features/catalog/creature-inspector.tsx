import { formatMessage, message } from '../../i18n/messages.de.js'
import type { Creature } from '../../../shared/contracts/encounter.js'
import { IlluminatedHeading } from '../../shell/illuminated-heading.js'
import type { ReferenceTarget } from '../../../shared/contracts/reference.js'
import { ReferenceLink, ReferenceText } from '../reference/reference-ui.js'
import './catalog.css'

export function CreatureInspector(props: {
  creature: Creature
  close?: () => void
  embedded?: boolean
  compact?: boolean
  referencePath?: readonly ReferenceTarget[]
}) {
  const c = props.creature
  const creatureTarget: ReferenceTarget = { kind: 'creature', id: c.id }
  const path = props.referencePath ?? [creatureTarget]
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
      className={`creature-inspector${props.embedded ? ' embedded' : ''}${props.compact ? ' compact' : ''}`}
      aria-label={message('ui.monster.details')}
    >
      {!props.compact && (
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
      )}
      <p className="stat-meta">
        <ReferenceText path={path}>{`${c.size} ${c.type}`}</ReferenceText>
        {c.subtype ? (
          <ReferenceText path={path}>{` (${c.subtype})`}</ReferenceText>
        ) : null}
        {', '}
        <ReferenceText path={path}>{c.alignment}</ReferenceText> ·{' '}
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
              <strong>
                <ReferenceLink
                  text={trait.name}
                  path={path}
                  candidate={{
                    target: {
                      kind: 'action',
                      id: c.id,
                      sectionId: `trait:${c.traits.indexOf(trait)}`
                    },
                    title: trait.name,
                    context: formatMessage('reference.context.trait', {
                      name: c.name
                    })
                  }}
                />
                .
              </strong>{' '}
              <ReferenceText path={path}>{trait.description}</ReferenceText>
            </p>
          ))}
        </>
      )}
      <h3>{message('ui.aktionen')}</h3>
      {c.actions.map((action) => (
        <p key={action.name}>
          <strong>
            <ReferenceLink
              text={action.name}
              path={path}
              candidate={{
                target: {
                  kind: 'action',
                  id: c.id,
                  sectionId: `action:${c.actions.indexOf(action)}`
                },
                title: action.name,
                context: formatMessage('reference.context.action', {
                  name: c.name
                })
              }}
            />
            .
          </strong>{' '}
          <ReferenceText path={path}>{action.description}</ReferenceText>
        </p>
      ))}
      {c.legendaryActions.length > 0 && (
        <>
          <h3>{message('ui.legendaere.aktionen')}</h3>
          {c.legendaryActions.map((action) => (
            <p key={action.name}>
              <strong>
                <ReferenceLink
                  text={action.name}
                  path={path}
                  candidate={{
                    target: {
                      kind: 'action',
                      id: c.id,
                      sectionId: `legendary:${c.legendaryActions.indexOf(action)}`
                    },
                    title: action.name,
                    context: formatMessage(
                      'reference.context.legendaryAction',
                      { name: c.name }
                    )
                  }}
                />
                .
              </strong>{' '}
              <ReferenceText path={path}>{action.description}</ReferenceText>
            </p>
          ))}
        </>
      )}
      <div className="stat-extras">
        <p>
          <strong>{message('ui.rettungswuerfe')}</strong>{' '}
          <ReferenceText path={path}>{c.savingThrows || '—'}</ReferenceText>
        </p>
        <p>
          <strong>{message('ui.fertigkeiten')}</strong>{' '}
          <ReferenceText path={path}>{c.skills || '—'}</ReferenceText>
        </p>
        <p>
          <strong>{message('ui.sinne')}</strong>{' '}
          <ReferenceText path={path}>{c.senses || '—'}</ReferenceText>
        </p>
        <p>
          <strong>{message('ui.sprachen')}</strong>{' '}
          <ReferenceText path={path}>{c.languages || '—'}</ReferenceText>
        </p>
        {c.damageVulnerabilities && (
          <p>
            <strong>{message('reference.damageVulnerabilities')}</strong>{' '}
            <ReferenceText path={path}>{c.damageVulnerabilities}</ReferenceText>
          </p>
        )}
        {c.damageResistances && (
          <p>
            <strong>{message('reference.damageResistances')}</strong>{' '}
            <ReferenceText path={path}>{c.damageResistances}</ReferenceText>
          </p>
        )}
        {c.damageImmunities && (
          <p>
            <strong>{message('reference.damageImmunities')}</strong>{' '}
            <ReferenceText path={path}>{c.damageImmunities}</ReferenceText>
          </p>
        )}
        {c.conditionImmunities && (
          <p>
            <strong>{message('reference.conditionImmunities')}</strong>{' '}
            <ReferenceText path={path}>{c.conditionImmunities}</ReferenceText>
          </p>
        )}
      </div>
    </aside>
  )
}
