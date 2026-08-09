import { Fragment } from 'react'
import type {
  GeneratorPresetConfigV3,
  GeneratorRole
} from '../../../shared/contracts/generator-presets.js'
import { generatorRoles } from '../../../shared/generator/generator-config-model.js'
import { formatMessage, message } from '../../i18n/generator-runtime.de.js'
import { roleName, roleShort } from './generator-presentation.js'

type Boundary = GeneratorPresetConfigV3['composition']['monsters']['min']

export function GeneratorRoleQuantities(props: {
  config: GeneratorPresetConfigV3
  changed: (config: GeneratorPresetConfigV3) => void
}) {
  const quantities = props.config.composition.roleQuantities
  const setQuantity = (
    role: GeneratorRole,
    side: 'min' | 'max',
    value: number
  ) => {
    const current = quantities[role]
    const next = {
      ...current,
      [side]: clamp(Math.round(value), 1, 99)
    }
    if (next.min > next.max) {
      if (side === 'min') next.max = next.min
      else next.min = next.max
    }
    props.changed(
      updateComposition(props.config, {
        roleQuantities: {
          ...quantities,
          [role]: next
        }
      })
    )
  }
  return (
    <section className="role-quantity-rules">
      <h4>{message('g.quantities')}</h4>
      <div className="quantity-table quantity-header">
        <span>{message('g.role')}</span>
        <span>{message('g.minimum')}</span>
        <span>{message('g.maximum')}</span>
      </div>
      {generatorRoles.map((role) => (
        <div className="quantity-table" key={role}>
          <span className={`role-label role-${role}`}>
            <i />
            {roleName(role)}
          </span>
          {(['min', 'max'] as const).map((side) => (
            <input
              key={side}
              type="number"
              min={1}
              max={99}
              aria-label={`${roleName(role)} ${side === 'min' ? 'Minimum' : 'Maximum'}`}
              value={quantities[role][side]}
              onChange={(event) =>
                setQuantity(role, side, Number(event.target.value))
              }
            />
          ))}
        </div>
      ))}
    </section>
  )
}

export function GeneratorCompositionRules(props: {
  config: GeneratorPresetConfigV3
  partySize: number
  changed: (config: GeneratorPresetConfigV3) => void
}) {
  const composition = props.config.composition
  const resolvedMonsters = resolveScaled(composition.monsters, props.partySize)
  const resolvedInitiative = resolveScaled(
    composition.initiativeSlots,
    props.partySize
  )
  const setIntegerRange = (
    key: 'statblocks' | 'crBlocks',
    side: 'min' | 'max',
    value: number
  ) => {
    const next = {
      ...composition[key],
      [side]: clamp(Math.round(value), 1, 999)
    }
    if (next.min > next.max) {
      if (side === 'min') next.max = next.min
      else next.min = next.max
    }
    props.changed(updateComposition(props.config, { [key]: next }))
  }
  const setScaled = (
    key: 'monsters' | 'initiativeSlots',
    side: 'min' | 'max',
    boundary: Boundary
  ) => {
    const otherSide = side === 'min' ? 'max' : 'min'
    const range = { ...composition[key], [side]: boundary }
    const resolved = resolveScaled(range, props.partySize)
    if (resolved.min > resolved.max) {
      const other = range[otherSide]
      range[otherSide] = {
        ...other,
        value:
          (side === 'min' ? resolved.min : resolved.max) /
          (other.perPlayer ? Math.max(1, props.partySize) : 1)
      }
    }
    props.changed(updateComposition(props.config, { [key]: range }))
  }
  return (
    <section className="generator-rule-column composition-rules">
      <h4>{message('g.composition')}</h4>
      <div className="composition-list">
        {(
          [
            ['statblocks', message('g.statblocks')],
            ['crBlocks', message('g.crBlocks')]
          ] as const
        ).map(([key, label]) => (
          <RangeRow
            key={key}
            label={label}
            range={composition[key]}
            changed={(side, value) => setIntegerRange(key, side, value)}
          />
        ))}
        {(
          [
            ['monsters', message('g.monsters')],
            ['initiativeSlots', message('g.initiativeSlots')]
          ] as const
        ).map(([key, label]) => (
          <ScaledRangeRow
            key={key}
            label={label}
            range={composition[key]}
            changed={(side, value) => setScaled(key, side, value)}
          />
        ))}
        <label className="composition-select-row">
          <span>{message('g.mixing')}</span>
          <select
            value={composition.mixing}
            onChange={(event) =>
              props.changed(
                updateComposition(props.config, {
                  mixing: event.target
                    .value as GeneratorPresetConfigV3['composition']['mixing']
                })
              )
            }
          >
            <option value="mixed-within-cr-block">
              {message('g.mixing.mixed')}
            </option>
            <option value="one-per-cr-block">
              {message('g.mixing.single')}
            </option>
          </select>
        </label>
        <label className="mob-row">
          <span>{message('g.mobThreshold')}</span>
          <input
            type="number"
            aria-label={message('g.mobThreshold')}
            min={0}
            max={999}
            value={props.config.combat.mobThreshold}
            onChange={(event) =>
              props.changed({
                ...props.config,
                combat: {
                  mobThreshold: clamp(
                    Math.round(Number(event.target.value)),
                    0,
                    999
                  )
                }
              })
            }
          />
          <em>{message('g.same')}</em>
        </label>
      </div>
      <p className="resolved-ranges">
        {formatMessage('g.resolvedRanges', {
          count: props.partySize,
          monsters: formatRange(resolvedMonsters),
          initiative: formatRange(resolvedInitiative)
        })}
      </p>
    </section>
  )
}

function RangeRow(props: {
  label: string
  range: Readonly<{ min: number; max: number }>
  changed: (side: 'min' | 'max', value: number) => void
}) {
  return (
    <div className="range-row">
      <span>{props.label}</span>
      {(['min', 'max'] as const).map((side, index) => (
        <Fragment key={side}>
          {index === 1 && <em>{message('g.to')}</em>}
          <input
            type="number"
            min={1}
            value={props.range[side]}
            aria-label={`${props.label} ${side === 'min' ? 'Minimum' : 'Maximum'}`}
            onChange={(event) =>
              props.changed(side, Number(event.target.value))
            }
          />
        </Fragment>
      ))}
    </div>
  )
}

function ScaledRangeRow(props: {
  label: string
  range: GeneratorPresetConfigV3['composition']['monsters']
  changed: (side: 'min' | 'max', value: Boundary) => void
}) {
  const field = (side: 'min' | 'max') => {
    const boundary = props.range[side]
    return (
      <>
        <button
          type="button"
          className="scale-toggle"
          aria-pressed={boundary.perPlayer}
          onClick={() =>
            props.changed(side, { ...boundary, perPlayer: !boundary.perPlayer })
          }
        >
          {boundary.perPlayer
            ? message('g.scale.perPlayer')
            : message('g.scale.fixed')}
        </button>
        <input
          type="number"
          min={0}
          step={boundary.perPlayer ? 0.5 : 1}
          value={boundary.value}
          aria-label={`${props.label} ${side === 'min' ? 'Minimum' : 'Maximum'}`}
          onChange={(event) =>
            props.changed(side, {
              ...boundary,
              value: Math.max(0, Number(event.target.value))
            })
          }
        />
      </>
    )
  }
  return (
    <div className="scaled-range-row">
      <span>{props.label}</span>
      {field('min')}
      <em>{message('g.to')}</em>
      {field('max')}
    </div>
  )
}

export function GeneratorRoleCombinations(props: {
  config: GeneratorPresetConfigV3
  draft: GeneratorRole[]
  setDraft: (roles: GeneratorRole[]) => void
  changed: (config: GeneratorPresetConfigV3) => void
}) {
  const combinations = props.config.composition.roleCombinations
  const normalizedDraft = generatorRoles.filter((role) =>
    props.draft.includes(role)
  )
  const key = normalizedDraft.join('|')
  const exists = combinations.some((roles) => roles.join('|') === key)
  const addDisabled =
    normalizedDraft.length === 0 ||
    normalizedDraft.length > 3 ||
    combinations.length >= 32 ||
    exists
  return (
    <section className="generator-rule-column combination-rules">
      <header>
        <h4>{message('g.combinations')}</h4>
        <span>
          {formatMessage('g.combinationCount', {
            count: combinations.length
          })}
        </span>
      </header>
      <div className="combination-picker">
        {generatorRoles.map((role) => (
          <button
            type="button"
            key={role}
            className={`role-control role-${role}`}
            aria-pressed={props.draft.includes(role)}
            onClick={() =>
              props.setDraft(
                props.draft.includes(role)
                  ? props.draft.filter((entry) => entry !== role)
                  : [...props.draft, role]
              )
            }
          >
            <i />
            {roleName(role)}
          </button>
        ))}
        <button
          type="button"
          className="primary"
          disabled={addDisabled}
          onClick={() => {
            props.changed(
              updateComposition(props.config, {
                roleCombinations: [...combinations, normalizedDraft]
              })
            )
            props.setDraft([])
          }}
        >
          {message('g.add')}
        </button>
      </div>
      <div className="combination-list">
        {combinations.length === 0 ? (
          <p>{message('g.combinationsEmpty')}</p>
        ) : (
          combinations.map((roles, index) => (
            <span className="combination-chip" key={index}>
              {roles.map((role) => (
                <i className={`role-${role}`} key={role}>
                  <b />
                  {roleShort(role)}
                </i>
              ))}
              <button
                type="button"
                aria-label={`Kombination ${roles.map(roleName).join(', ')} entfernen`}
                onClick={() =>
                  props.changed(
                    updateComposition(props.config, {
                      roleCombinations: combinations.filter(
                        (_, candidate) => candidate !== index
                      )
                    })
                  )
                }
              >
                ×
              </button>
            </span>
          ))
        )}
      </div>
    </section>
  )
}

function resolveScaled(
  range: GeneratorPresetConfigV3['composition']['monsters'],
  partySize: number
): { min: number; max: number } {
  return {
    min: range.min.value * (range.min.perPlayer ? partySize : 1),
    max: range.max.value * (range.max.perPlayer ? partySize : 1)
  }
}

function formatRange(range: { min: number; max: number }): string {
  const format = (value: number) =>
    new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 }).format(value)
  return `${format(range.min)}–${format(range.max)}`
}

function updateComposition(
  config: GeneratorPresetConfigV3,
  patch: Partial<GeneratorPresetConfigV3['composition']>
): GeneratorPresetConfigV3 {
  return {
    ...config,
    composition: { ...config.composition, ...patch }
  }
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(
    minimum,
    Math.min(maximum, Number.isFinite(value) ? value : minimum)
  )
}
