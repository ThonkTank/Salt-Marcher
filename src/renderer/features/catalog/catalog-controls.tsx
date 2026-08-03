import type {
  CreatureCatalogQuery,
  CreatureFilterOptions
} from '../../../shared/contracts/encounter.js'
import { emptyQuery } from './catalog-state.js'

export function CreatureFilters(props: {
  query: CreatureCatalogQuery
  options: CreatureFilterOptions
  changed: (query: CreatureCatalogQuery) => void
  compact?: boolean
}) {
  const q = props.query
  const update = (values: Partial<CreatureCatalogQuery>) =>
    props.changed({ ...q, ...values, offset: 0 })
  return (
    <div
      className={`catalog-filters${props.compact ? ' compact-filters' : ''}`}
    >
      <input
        aria-label="Monster suchen"
        placeholder="Monster suchen …"
        value={q.name}
        onChange={(event) => update({ name: event.target.value })}
        onKeyDown={(event) => {
          if (event.key === 'Enter') update({ name: event.currentTarget.value })
        }}
      />
      <select
        aria-label="CR minimum"
        value={q.crMin ?? ''}
        onChange={(event) =>
          update({
            crMin: event.target.value ? Number(event.target.value) : undefined
          })
        }
      >
        <option value="">CR min</option>
        {props.options.challengeRatings.map((value) => (
          <option key={value} value={crNumber(value)}>
            {value}
          </option>
        ))}
      </select>
      <select
        aria-label="CR maximum"
        value={q.crMax ?? ''}
        onChange={(event) =>
          update({
            crMax: event.target.value ? Number(event.target.value) : undefined
          })
        }
      >
        <option value="">CR max</option>
        {props.options.challengeRatings.map((value) => (
          <option key={value} value={crNumber(value)}>
            {value}
          </option>
        ))}
      </select>
      <MultiSelect
        label="Größe"
        options={props.options.sizes}
        selected={q.sizes}
        changed={(sizes) => update({ sizes })}
      />
      <MultiSelect
        label="Typ"
        options={props.options.types}
        selected={q.types}
        changed={(types) => update({ types })}
      />
      <MultiSelect
        label="Unterart"
        options={props.options.subtypes}
        selected={q.subtypes}
        changed={(subtypes) => update({ subtypes })}
      />
      <MultiSelect
        label="Umgebung"
        options={props.options.biomes}
        selected={q.biomes}
        changed={(biomes) => update({ biomes })}
      />
      <MultiSelect
        label="Gesinnung"
        options={props.options.alignments}
        selected={q.alignments}
        changed={(alignments) => update({ alignments })}
      />
      {props.options.encounterTables.length > 0 && (
        <ReferenceMultiSelect
          label="Tabelle"
          options={props.options.encounterTables}
          selected={q.encounterTableIds}
          changed={(encounterTableIds) => update({ encounterTableIds })}
        />
      )}
      {props.options.factions.length > 0 && (
        <ReferenceMultiSelect
          label="Fraktionen"
          options={props.options.factions}
          selected={q.factionIds}
          changed={(factionIds) => update({ factionIds })}
        />
      )}
      {props.options.locations.length > 0 && (
        <select
          aria-label="Ort"
          value={q.locationId ?? ''}
          onChange={(event) =>
            update({ locationId: event.target.value || null })
          }
        >
          <option value="">Ort</option>
          {props.options.locations.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      )}
      <button onClick={() => props.changed({ ...emptyQuery, limit: q.limit })}>
        Filter zurücksetzen
      </button>
    </div>
  )
}

function MultiSelect(props: {
  label: string
  options: readonly string[]
  selected: readonly string[]
  changed: (values: string[]) => void
}) {
  return (
    <label className="multi-filter">
      <span>
        {props.label}
        {props.selected.length ? ` (${props.selected.length})` : ''}
      </span>
      <select
        multiple
        aria-label={props.label}
        value={[...props.selected]}
        onChange={(event) =>
          props.changed(
            Array.from(
              event.currentTarget.selectedOptions,
              (option) => option.value
            )
          )
        }
      >
        {props.options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </label>
  )
}

export function ReferenceMultiSelect(props: {
  label: string
  options: readonly { id: string; label: string }[]
  selected: readonly string[]
  changed: (values: string[]) => void
}) {
  return (
    <label className="multi-filter">
      <span>
        {props.label}
        {props.selected.length ? ` (${props.selected.length})` : ''}
      </span>
      <select
        multiple
        aria-label={props.label}
        value={[...props.selected]}
        onChange={(event) =>
          props.changed(
            Array.from(
              event.currentTarget.selectedOptions,
              (option) => option.value
            )
          )
        }
      >
        {props.options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export function FilterChips(props: {
  query: CreatureCatalogQuery
  changed: (query: CreatureCatalogQuery) => void
}) {
  const chips: { label: string; clear: () => void }[] = []
  const q = props.query
  if (q.name)
    chips.push({
      label: `Suche: ${q.name}`,
      clear: () => props.changed({ ...q, name: '', offset: 0 })
    })
  if (q.crMin !== undefined || q.crMax !== undefined)
    chips.push({
      label: `CR ${q.crMin ?? '0'}–${q.crMax ?? '∞'}`,
      clear: () => {
        const { crMin, crMax, ...rest } = q
        void crMin
        void crMax
        props.changed({ ...rest, offset: 0 })
      }
    })
  const groups = [
    ['sizes', q.sizes],
    ['types', q.types],
    ['subtypes', q.subtypes],
    ['biomes', q.biomes],
    ['alignments', q.alignments],
    ['encounterTableIds', q.encounterTableIds],
    ['factionIds', q.factionIds]
  ] as const
  for (const [field, values] of groups)
    for (const value of values)
      chips.push({
        label: value,
        clear: () =>
          props.changed({
            ...q,
            [field]: values.filter((entry) => entry !== value),
            offset: 0
          })
      })
  if (q.locationId)
    chips.push({
      label: `Ort: ${q.locationId}`,
      clear: () => props.changed({ ...q, locationId: null, offset: 0 })
    })
  return (
    <>
      {chips.map((chip, index) => (
        <button
          key={`${chip.label}-${index}`}
          className="filter-chip"
          onClick={chip.clear}
        >
          {chip.label} ×
        </button>
      ))}
    </>
  )
}

export function SortHeader(props: {
  label: string
  field: 'name' | 'cr' | 'xp'
  query: CreatureCatalogQuery
  changed: (query: CreatureCatalogQuery) => void
}) {
  const active = props.query.sort === props.field
  return (
    <th>
      <button
        className="sort-header"
        onClick={() =>
          props.changed({
            ...props.query,
            sort: props.field,
            direction:
              active && props.query.direction === 'asc' ? 'desc' : 'asc',
            offset: 0
          })
        }
      >
        {props.label}{' '}
        {active ? (props.query.direction === 'asc' ? '▲' : '▼') : ''}
      </button>
    </th>
  )
}

function crNumber(value: string): number {
  const [left, right] = value.split('/')
  return right ? Number(left) / Number(right) : Number(value)
}
