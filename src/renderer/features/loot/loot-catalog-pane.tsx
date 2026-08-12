import { useEffect, useRef, useState } from 'react'
import type {
  LootCatalogEntry,
  LootCatalogPage,
  LootCatalogQuery,
  LootRarity
} from '../../../shared/contracts/loot.js'
import { capabilityErrorText } from '../../capabilities/capability-errors.js'
import { formatMessage, message } from '../../i18n/session-runtime.de.js'
import { formatCopper } from '../../presenters/money.js'
import { useLootCatalogPort } from './use-loot-ports.js'

const emptyOptions: LootCatalogPage['filterOptions'] = {
  types: [],
  categories: [],
  rarities: []
}

export function LootCatalogPane(props: {
  catalogContentHash: string
  add: (entry: LootCatalogEntry) => void
}) {
  const port = useLootCatalogPort()
  const [query, setQuery] = useState<
    Omit<LootCatalogQuery, 'catalogContentHash'>
  >({
    search: '',
    types: [],
    categories: [],
    rarities: [],
    offset: 0,
    limit: 30
  })
  const [page, setPage] = useState<LootCatalogPage | null>(null)
  const [error, setError] = useState('')
  const request = useRef(0)

  useEffect(() => {
    const token = ++request.current
    void port
      .catalog({ ...query, catalogContentHash: props.catalogContentHash })
      .then((result) => {
        if (request.current !== token) return
        setPage(result)
        setError('')
      })
      .catch((cause) => {
        if (request.current !== token) return
        setError(capabilityErrorText(cause))
      })
  }, [port, props.catalogContentHash, query])

  const options = page?.filterOptions ?? emptyOptions
  const update = (
    patch: Partial<Omit<LootCatalogQuery, 'catalogContentHash'>>
  ) => setQuery((current) => ({ ...current, ...patch, offset: 0 }))
  return (
    <section
      className="loot-catalog-pane group-manager-catalog"
      aria-label={message('loot.catalog')}
    >
      <div className="loot-catalog-filters">
        <label>
          <span>{message('loot.catalogSearch')}</span>
          <input
            type="search"
            value={query.search}
            onChange={(event) => update({ search: event.target.value })}
          />
        </label>
        <label>
          <span>{message('loot.catalogType')}</span>
          <select
            value={query.types[0] ?? ''}
            onChange={(event) =>
              update({ types: event.target.value ? [event.target.value] : [] })
            }
          >
            <option value="">{message('loot.catalogAll')}</option>
            {options.types.map((type) => (
              <option key={type} value={type}>
                {type === 'container' ? message('loot.container') : type}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>{message('loot.catalogCategory')}</span>
          <select
            value={query.categories[0] ?? ''}
            onChange={(event) =>
              update({
                categories: event.target.value ? [event.target.value] : []
              })
            }
          >
            <option value="">{message('loot.catalogAll')}</option>
            {options.categories.map((category) => (
              <option key={category}>{category}</option>
            ))}
          </select>
        </label>
        <label>
          <span>{message('loot.catalogRarity')}</span>
          <select
            value={query.rarities[0] ?? ''}
            onChange={(event) =>
              update({
                rarities: event.target.value
                  ? [event.target.value as LootRarity]
                  : []
              })
            }
          >
            <option value="">{message('loot.catalogAll')}</option>
            {options.rarities.map((rarity) => (
              <option key={rarity}>{rarity}</option>
            ))}
          </select>
        </label>
      </div>
      {error && (
        <p className="group-loot-inline-error" role="alert">
          {error}
        </p>
      )}
      <div className="creature-collection-table-wrap">
        <table className="creature-collection-table loot-catalog-table">
          <thead>
            <tr>
              <th>{message('loot.item')}</th>
              <th>{message('loot.catalogType')}</th>
              <th>{message('loot.catalogFacts')}</th>
              <th>{message('loot.catalogAdd')}</th>
            </tr>
          </thead>
          <tbody>
            {page?.entries.map((entry) => (
              <tr key={`${entry.kind}:${entry.id}`}>
                <td>
                  <strong>{entry.defaultName}</strong>
                  <small>{kindLabel(entry)}</small>
                </td>
                <td>{entry.type}</td>
                <td>{entryFacts(entry)}</td>
                <td>
                  <button
                    type="button"
                    aria-label={formatMessage('loot.catalogAddNamed', {
                      name: entry.defaultName
                    })}
                    onClick={() => props.add(entry)}
                  >
                    +
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {page?.entries.length === 0 && (
          <p className="creature-collection-empty">
            {message('loot.catalogEmpty')}
          </p>
        )}
      </div>
      <footer className="creature-collection-pane-footer">
        <span>
          {formatMessage('loot.catalogCount', { count: page?.total ?? 0 })}
        </span>
        <div>
          <button
            type="button"
            disabled={query.offset === 0}
            onClick={() =>
              setQuery((current) => ({
                ...current,
                offset: Math.max(0, current.offset - current.limit)
              }))
            }
          >
            {message('loot.catalogPrevious')}
          </button>
          <span>{Math.floor(query.offset / query.limit) + 1}</span>
          <button
            type="button"
            disabled={!page || query.offset + query.limit >= page.total}
            onClick={() =>
              setQuery((current) => ({
                ...current,
                offset: current.offset + current.limit
              }))
            }
          >
            {message('loot.catalogNext')}
          </button>
        </div>
      </footer>
    </section>
  )
}

function kindLabel(entry: LootCatalogEntry): string {
  if (entry.kind === 'container') return message('loot.catalogContainer')
  if (entry.kind === 'magic_item') return message('loot.catalogMagic')
  return message('loot.catalogNormal')
}

function entryFacts(entry: LootCatalogEntry): string {
  if (entry.kind === 'container')
    return formatMessage('loot.catalogCapacity', { capacity: entry.capacity })
  if (entry.magic)
    return formatMessage('loot.magicRarity', { rarity: entry.rarity })
  return `${formatCopper(entry.unitValueCp)}${
    entry.stackable ? ` · ${message('loot.stackable')}` : ''
  }`
}
