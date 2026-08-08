import { useMemo, useState } from 'react'
import type { EncounterTableSummary } from '../../../shared/contracts/encounter-source.js'
import { formatMessage, message } from '../../i18n/worldplanner-runtime.de.js'
import { AnchoredPopup } from '../../shell/anchored-popup.js'
import { formatChallengeRatingRange } from '../../i18n/domain-formatters.de.js'

export function FactionTablePicker(props: {
  summaries: readonly EncounterTableSummary[]
  value: string | null
  disabled: boolean
  changed: (id: string | null) => void
  createTable: () => void
}) {
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [biome, setBiome] = useState('')
  const selected = props.summaries.find((table) => table.id === props.value)
  const views = useMemo(() => props.summaries.map(tableView), [props.summaries])
  const biomes = useMemo(
    () => [...new Set(views.flatMap((view) => view.biomes))].toSorted(),
    [views]
  )
  const needle = normalize(query)
  const matches = views.filter(
    (view) =>
      (!needle || normalize(view.table.displayName).includes(needle)) &&
      (!biome || view.biomes.includes(biome))
  )
  const selectedView = views.find((view) => view.table.id === props.value)
  const close = () => {
    setOpen(false)
    setQuery('')
    setBiome('')
  }
  const choose = (id: string | null) => {
    props.changed(id)
    close()
  }

  return (
    <div className="faction-table-picker">
      <button
        ref={setAnchor}
        type="button"
        className="faction-table-card"
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={props.disabled}
        onClick={() => setOpen((current) => !current)}
      >
        <span>
          <strong>
            {selected?.displayName ?? message('ui.keine.primaere.tabelle')}
          </strong>
          <small>
            {selectedView?.meta ?? message('faction.tablePickerHint')}
          </small>
        </span>
        <span aria-hidden="true">▾</span>
      </button>
      <AnchoredPopup
        open={open}
        anchor={anchor}
        onDismiss={close}
        className="faction-table-popup"
        minWidth={320}
      >
        <div className="faction-table-popup-header">
          <strong>{message('faction.chooseTable')}</strong>
          <button
            type="button"
            aria-label={message('faction.closeTablePicker')}
            onClick={close}
          >
            ×
          </button>
        </div>
        <input
          autoFocus
          aria-label={message('faction.searchTable')}
          placeholder={message('faction.searchTable')}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <select
          aria-label={message('faction.filterEnvironment')}
          value={biome}
          onChange={(event) => setBiome(event.target.value)}
        >
          <option value="">{message('faction.allEnvironments')}</option>
          {biomes.map((entry) => (
            <option key={entry}>{entry}</option>
          ))}
        </select>
        <div
          className="faction-table-options"
          role="listbox"
          aria-label={message('ui.primaere.encounter.tabelle')}
        >
          <button
            type="button"
            role="option"
            aria-selected={props.value === null}
            onClick={() => choose(null)}
          >
            <em>{message('ui.keine.primaere.tabelle')}</em>
          </button>
          {matches.map((view) => {
            const current = view.table.id === props.value
            return (
              <button
                type="button"
                role="option"
                aria-selected={current}
                className={current ? 'current' : undefined}
                key={view.table.id}
                onClick={() => choose(view.table.id)}
              >
                <span>{view.table.displayName}</span>
                <small>
                  {view.meta}
                  {current ? ` · ${message('faction.current')}` : ''}
                </small>
              </button>
            )
          })}
        </div>
        <button
          type="button"
          className="faction-create-table"
          onClick={() => {
            close()
            props.createTable()
          }}
        >
          {message('ui.neue.encounter.tabelle')}
        </button>
      </AnchoredPopup>
    </div>
  )
}

function tableView(table: EncounterTableSummary) {
  const range = table.challengeRatingRange
    ? formatChallengeRatingRange(
        table.challengeRatingRange.minimum,
        table.challengeRatingRange.maximum
      )
    : '—'
  return {
    table,
    biomes: table.biomes,
    meta: formatMessage('faction.tableMeta', {
      count: table.entryCount,
      range
    })
  }
}

function normalize(value: string) {
  return value
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('de')
    .trim()
}
