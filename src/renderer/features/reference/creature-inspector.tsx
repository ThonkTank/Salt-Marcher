import { message } from '../../i18n/reference-runtime.de.js'
import {
  formatChallengeRating,
  formatInteger
} from '../../i18n/domain-formatters.de.js'
import type { Creature } from '../../../shared/contracts/encounter.js'
import { IlluminatedHeading } from '../../shell/illuminated-heading.js'
import type { ReferenceTarget } from '../../../shared/contracts/reference.js'
import { ReferenceLink } from '../reference/reference-text.js'
import { ReadOnlyProse } from '../reference/read-only-prose.js'

export function CreatureInspector(props: {
  creature: Creature
  close?: () => void
  embedded?: boolean
  compact?: boolean
  referencePath?: readonly ReferenceTarget[]
}) {
  const c = props.creature
  const creatureTarget: ReferenceTarget = {
    scope: 'creature',
    creatureId: c.id
  }
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
        <ReadOnlyProse path={path}>{`${c.size} ${c.type}`}</ReadOnlyProse>
        {c.subtype ? (
          <ReadOnlyProse path={path}>{` (${c.subtype})`}</ReadOnlyProse>
        ) : null}
        {', '}
        <ReadOnlyProse path={path}>{c.alignment}</ReadOnlyProse> ·{' '}
        {message('ui.herausforderung')}{' '}
        {formatChallengeRating(c.challengeRating)} ({formatInteger(c.xp)}{' '}
        {message('ui.xp')}
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
                      scope: 'creature-part',
                      creatureId: c.id,
                      partKind: 'trait',
                      partId: trait.id
                    },
                    title: trait.name
                  }}
                />
                .
              </strong>{' '}
              <ReadOnlyProse path={path}>{trait.description}</ReadOnlyProse>
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
                  scope: 'creature-part',
                  creatureId: c.id,
                  partKind: 'action',
                  partId: action.id
                },
                title: action.name
              }}
            />
            .
          </strong>{' '}
          <ReadOnlyProse path={path}>{action.description}</ReadOnlyProse>
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
                      scope: 'creature-part',
                      creatureId: c.id,
                      partKind: 'legendary-action',
                      partId: action.id
                    },
                    title: action.name
                  }}
                />
                .
              </strong>{' '}
              <ReadOnlyProse path={path}>{action.description}</ReadOnlyProse>
            </p>
          ))}
        </>
      )}
      <div className="stat-extras">
        <p>
          <strong>{message('ui.rettungswuerfe')}</strong>{' '}
          <ReadOnlyProse path={path}>{c.savingThrows || '—'}</ReadOnlyProse>
        </p>
        <p>
          <strong>{message('ui.fertigkeiten')}</strong>{' '}
          <ReadOnlyProse path={path}>{c.skills || '—'}</ReadOnlyProse>
        </p>
        <p>
          <strong>{message('ui.sinne')}</strong>{' '}
          <ReadOnlyProse path={path}>{c.senses || '—'}</ReadOnlyProse>
        </p>
        <p>
          <strong>{message('ui.sprachen')}</strong>{' '}
          <ReadOnlyProse path={path}>{c.languages || '—'}</ReadOnlyProse>
        </p>
        {c.damageVulnerabilities && (
          <p>
            <strong>{message('reference.damageVulnerabilities')}</strong>{' '}
            <ReadOnlyProse path={path}>{c.damageVulnerabilities}</ReadOnlyProse>
          </p>
        )}
        {c.damageResistances && (
          <p>
            <strong>{message('reference.damageResistances')}</strong>{' '}
            <ReadOnlyProse path={path}>{c.damageResistances}</ReadOnlyProse>
          </p>
        )}
        {c.damageImmunities && (
          <p>
            <strong>{message('reference.damageImmunities')}</strong>{' '}
            <ReadOnlyProse path={path}>{c.damageImmunities}</ReadOnlyProse>
          </p>
        )}
        {c.conditionImmunities && (
          <p>
            <strong>{message('reference.conditionImmunities')}</strong>{' '}
            <ReadOnlyProse path={path}>{c.conditionImmunities}</ReadOnlyProse>
          </p>
        )}
      </div>
    </aside>
  )
}
