import { formatMessage, message } from '../../i18n/catalog-runtime.de.js'
import type { ReactNode } from 'react'
import type {
  CreatureCatalogQuery,
  CreatureFilterOptions
} from '../../../shared/contracts/encounter.js'
import { emptyQuery } from './creature-state.js'
import './creatures.css'
import {
  SearchableSelect,
  type SearchableSelectOption
} from '../../shell/searchable-select.js'

export function CreatureFilters(props: {
  query: CreatureCatalogQuery
  options: CreatureFilterOptions
  changed: (query: CreatureCatalogQuery) => void
  searchBiomeOptions?:
    ((query: string) => Promise<readonly SearchableSelectOption[]>) | undefined
  compact?: boolean
  clustered?: boolean
}) {
  const q = props.query
  const update = (values: Partial<CreatureCatalogQuery>) =>
    props.changed({ ...q, ...values, offset: 0 })
  if (props.clustered)
    return (
      <div className="creatures-filter-trays">
        <FilterTray label={message('catalog.searchAndStrength')}>
          <div className="creatures-filter-grid creatures-filter-strength">
            <FilterField label={message('ui.name')} active={Boolean(q.name)}>
              <input
                aria-label={message('ui.monster.suchen')}
                placeholder={message('ui.monster.suchen.2')}
                value={q.name}
                onChange={(event) => update({ name: event.target.value })}
                onKeyDown={(event) => {
                  if (event.key === 'Enter')
                    update({ name: event.currentTarget.value })
                }}
              />
            </FilterField>
            <FilterField
              label={message('catalog.crFrom')}
              active={q.crMin !== undefined}
            >
              <select
                aria-label={message('ui.cr.minimum')}
                value={q.crMin ?? ''}
                onChange={(event) =>
                  update({
                    crMin: event.target.value
                      ? Number(event.target.value)
                      : undefined
                  })
                }
              >
                <option value="">{message('catalog.all')}</option>
                {props.options.challengeRatings.map((value) => (
                  <option key={value} value={crNumber(value)}>
                    {value}
                  </option>
                ))}
              </select>
            </FilterField>
            <FilterField
              label={message('catalog.crTo')}
              active={q.crMax !== undefined}
            >
              <select
                aria-label={message('ui.cr.maximum')}
                value={q.crMax ?? ''}
                onChange={(event) =>
                  update({
                    crMax: event.target.value
                      ? Number(event.target.value)
                      : undefined
                  })
                }
              >
                <option value="">{message('catalog.all')}</option>
                {props.options.challengeRatings.map((value) => (
                  <option key={value} value={crNumber(value)}>
                    {value}
                  </option>
                ))}
              </select>
            </FilterField>
          </div>
        </FilterTray>
        <FilterTray label={message('catalog.creatureTraits')}>
          <div className="creatures-filter-grid creatures-filter-creature">
            <AdditiveSelect
              label={message('catalog.size')}
              options={props.options.sizes}
              selected={q.sizes}
              changed={(sizes) => update({ sizes })}
            />
            <AdditiveSelect
              label={message('ui.typ')}
              options={props.options.types}
              selected={q.types}
              changed={(types) => update({ types })}
            />
            <AdditiveSelect
              label={message('catalog.subtype')}
              options={props.options.subtypes}
              selected={q.subtypes}
              changed={(subtypes) => update({ subtypes })}
            />
          </div>
        </FilterTray>
        <FilterTray label={message('catalog.origin')}>
          <div className="creatures-filter-grid creatures-filter-origin">
            <SearchableMultiFilter
              label={message('catalog.environment')}
              options={props.options.biomes}
              selected={q.biomes}
              searchOptions={props.searchBiomeOptions}
              changed={(biomes) => update({ biomes })}
            />
            <AdditiveSelect
              label={message('catalog.alignment')}
              options={props.options.alignments}
              selected={q.alignments}
              changed={(alignments) => update({ alignments })}
            />
            <ReferenceAdditiveSelect
              label={message('catalog.table')}
              options={props.options.encounterTables}
              selected={q.encounterTableIds}
              changed={(encounterTableIds) => update({ encounterTableIds })}
            />
            <ReferenceAdditiveSelect
              label={message('group.disposition')}
              options={props.options.factions}
              selected={q.factionIds}
              changed={(factionIds) => update({ factionIds })}
            />
            <FilterField
              label={message('ui.ort')}
              active={Boolean(q.locationId)}
            >
              <select
                aria-label={message('ui.ort')}
                value={q.locationId ?? ''}
                onChange={(event) =>
                  update({ locationId: event.target.value || null })
                }
              >
                <option value="">{message('catalog.noLocation')}</option>
                {props.options.locations.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </FilterField>
          </div>
        </FilterTray>
      </div>
    )
  return (
    <div
      className={`creatures-filters${props.compact ? ' creatures-filters--compact' : ''}`}
    >
      <input
        aria-label={message('ui.monster.suchen')}
        placeholder={message('ui.monster.suchen.2')}
        value={q.name}
        onChange={(event) => update({ name: event.target.value })}
        onKeyDown={(event) => {
          if (event.key === 'Enter') update({ name: event.currentTarget.value })
        }}
      />
      <select
        aria-label={message('ui.cr.minimum')}
        value={q.crMin ?? ''}
        onChange={(event) =>
          update({
            crMin: event.target.value ? Number(event.target.value) : undefined
          })
        }
      >
        <option value="">{message('ui.cr.min')}</option>
        {props.options.challengeRatings.map((value) => (
          <option key={value} value={crNumber(value)}>
            {value}
          </option>
        ))}
      </select>
      <select
        aria-label={message('ui.cr.maximum')}
        value={q.crMax ?? ''}
        onChange={(event) =>
          update({
            crMax: event.target.value ? Number(event.target.value) : undefined
          })
        }
      >
        <option value="">{message('ui.cr.max')}</option>
        {props.options.challengeRatings.map((value) => (
          <option key={value} value={crNumber(value)}>
            {value}
          </option>
        ))}
      </select>
      <SearchableMultiFilter
        label={message('catalog.size')}
        options={textOptions(props.options.sizes)}
        selected={q.sizes}
        changed={(sizes) => update({ sizes })}
      />
      <SearchableMultiFilter
        label={message('ui.typ')}
        options={textOptions(props.options.types)}
        selected={q.types}
        changed={(types) => update({ types })}
      />
      <SearchableMultiFilter
        label={message('catalog.subtype')}
        options={textOptions(props.options.subtypes)}
        selected={q.subtypes}
        changed={(subtypes) => update({ subtypes })}
      />
      <SearchableMultiFilter
        label={message('catalog.environment')}
        options={props.options.biomes}
        selected={q.biomes}
        searchOptions={props.searchBiomeOptions}
        changed={(biomes) => update({ biomes })}
      />
      <SearchableMultiFilter
        label={message('catalog.alignment')}
        options={textOptions(props.options.alignments)}
        selected={q.alignments}
        changed={(alignments) => update({ alignments })}
      />
      {props.options.encounterTables.length > 0 && (
        <SearchableMultiFilter
          label={message('catalog.table')}
          options={props.options.encounterTables}
          selected={q.encounterTableIds}
          changed={(encounterTableIds) => update({ encounterTableIds })}
        />
      )}
      {props.options.factions.length > 0 && (
        <SearchableMultiFilter
          label={message('ui.fraktionen')}
          options={props.options.factions}
          selected={q.factionIds}
          changed={(factionIds) => update({ factionIds })}
        />
      )}
      {props.options.locations.length > 0 && (
        <SearchableSelect
          mode="single"
          label={message('ui.ort')}
          options={props.options.locations}
          value={q.locationId ?? null}
          emptyText={message('ui.ort')}
          searchPlaceholder={formatMessage('catalog.searchFilter', {
            filter: message('ui.ort')
          })}
          noResultsText={message('catalog.noFilterMatch')}
          popupMinWidth={224}
          changed={(locationId) => update({ locationId })}
        />
      )}
    </div>
  )
}

function FilterTray(props: { label: string; children: ReactNode }) {
  return (
    <section className="creatures-filter-tray">
      <span className="creatures-filter-kicker">{props.label}</span>
      {props.children}
    </section>
  )
}

function FilterField(props: {
  label: string
  active: boolean
  children: ReactNode
}) {
  return (
    <label className={props.active ? 'creatures-filter-active' : undefined}>
      <span>{props.label}</span>
      {props.children}
    </label>
  )
}

function AdditiveSelect(props: {
  label: string
  options: readonly string[]
  selected: readonly string[]
  changed: (values: string[]) => void
}) {
  return (
    <FilterField label={props.label} active={props.selected.length > 0}>
      <select
        aria-label={props.label}
        value=""
        onChange={(event) => {
          const value = event.target.value
          if (value && !props.selected.includes(value))
            props.changed([...props.selected, value])
        }}
      >
        <option value="">
          {props.selected.length > 0
            ? formatMessage('catalog.selectedCount', {
                count: props.selected.length
              })
            : message('catalog.all')}
        </option>
        {props.options
          .filter((option) => !props.selected.includes(option))
          .map((option) => (
            <option key={option}>{option}</option>
          ))}
      </select>
    </FilterField>
  )
}

function ReferenceAdditiveSelect(props: {
  label: string
  options: readonly { id: string; label: string }[]
  selected: readonly string[]
  changed: (values: string[]) => void
}) {
  return (
    <FilterField label={props.label} active={props.selected.length > 0}>
      <select
        aria-label={props.label}
        value=""
        onChange={(event) => {
          const value = event.target.value
          if (value && !props.selected.includes(value))
            props.changed([...props.selected, value])
        }}
      >
        <option value="">
          {props.selected.length > 0
            ? formatMessage('catalog.selectedCount', {
                count: props.selected.length
              })
            : message('catalog.all')}
        </option>
        {props.options
          .filter((option) => !props.selected.includes(option.id))
          .map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
      </select>
    </FilterField>
  )
}

function SearchableMultiFilter(props: {
  label: string
  options: readonly SearchableSelectOption[]
  selected: readonly string[]
  searchOptions?:
    ((query: string) => Promise<readonly SearchableSelectOption[]>) | undefined
  changed: (values: string[]) => void
}) {
  return (
    <SearchableSelect
      mode="multiple"
      label={props.label}
      options={props.options}
      searchOptions={props.searchOptions}
      values={props.selected}
      emptyText={props.label}
      selectedText={(count) => `${props.label} (${String(count)})`}
      searchPlaceholder={formatMessage('catalog.searchFilter', {
        filter: props.label
      })}
      noResultsText={message('catalog.noFilterMatch')}
      popupMinWidth={224}
      changed={props.changed}
    />
  )
}

function textOptions(values: readonly string[]): SearchableSelectOption[] {
  return values.map((value) => ({ id: value, label: value }))
}

export function FilterChips(props: {
  query: CreatureCatalogQuery
  changed: (query: CreatureCatalogQuery) => void
  options?: CreatureFilterOptions
}) {
  const chips: { label: string; clear: () => void }[] = []
  const q = props.query
  if (q.name)
    chips.push({
      label: formatMessage('catalog.searchChip', { name: q.name }),
      clear: () => props.changed({ ...q, name: '', offset: 0 })
    })
  if (q.crMin !== undefined || q.crMax !== undefined)
    chips.push({
      label: formatMessage('catalog.challengeChip', {
        minimum: q.crMin ?? '0',
        maximum: q.crMax ?? '∞'
      }),
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
        label: filterValueLabel(field, value, props.options),
        clear: () =>
          props.changed({
            ...q,
            [field]: values.filter((entry) => entry !== value),
            offset: 0
          })
      })
  if (q.locationId)
    chips.push({
      label: formatMessage('catalog.locationChip', {
        location:
          props.options?.locations.find((option) => option.id === q.locationId)
            ?.label ?? q.locationId
      }),
      clear: () => props.changed({ ...q, locationId: null, offset: 0 })
    })
  return (
    <>
      {chips.map((chip, index) => (
        <button
          key={`${chip.label}-${index}`}
          className="creatures-filter-chip"
          onClick={chip.clear}
        >
          {chip.label} ×
        </button>
      ))}
      {chips.length > 0 && (
        <button
          className="creatures-filter-reset"
          onClick={() =>
            props.changed({ ...emptyQuery, limit: props.query.limit })
          }
        >
          {message('ui.filter.zuruecksetzen')}
        </button>
      )}
    </>
  )
}

function filterValueLabel(
  field:
    | 'sizes'
    | 'types'
    | 'subtypes'
    | 'biomes'
    | 'alignments'
    | 'encounterTableIds'
    | 'factionIds',
  value: string,
  options?: CreatureFilterOptions
): string {
  if (field === 'encounterTableIds')
    return (
      options?.encounterTables.find((option) => option.id === value)?.label ??
      value
    )
  if (field === 'factionIds')
    return (
      options?.factions.find((option) => option.id === value)?.label ?? value
    )
  if (field === 'biomes')
    return options?.biomes.find((option) => option.id === value)?.label ?? value
  return value
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
        className="creatures-sort-header"
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
