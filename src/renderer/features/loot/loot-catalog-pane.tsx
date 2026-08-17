import type {
  LootCatalogEntry,
  LootCatalogPage,
  LootCatalogQuery,
  LootRarity
} from '../../../shared/contracts/loot.js'
import { formatMessage, message } from '../../i18n/session-runtime.de.js'
import { formatCopper } from '../../presenters/money.js'

const emptyOptions: LootCatalogPage['filterOptions'] = {
  types: [],
  categories: [],
  rarities: []
}

export function LootCatalogPane(props: {
  query: Omit<LootCatalogQuery, 'runId' | 'catalogContentHash'>
  page: LootCatalogPage | null
  error: string
  queryChanged: (
    patch: Partial<Omit<LootCatalogQuery, 'runId' | 'catalogContentHash'>>,
    preserveOffset?: boolean
  ) => void
  add: (entry: LootCatalogEntry) => void
  readOnly?: boolean
}) {
  const options = props.page?.filterOptions ?? emptyOptions
  const update = props.queryChanged
  return (
    <section
      className="loot-catalog-pane group-manager-catalog"
      aria-label={message('loot.catalog')}
      data-loot-catalog-ready={props.page === null ? 'false' : 'true'}
    >
      <div className="loot-catalog-filters">
        <label>
          <span>{message('loot.catalogSearch')}</span>
          <input
            type="search"
            value={props.query.search}
            onChange={(event) => update({ search: event.target.value })}
          />
        </label>
        <label>
          <span>{message('loot.catalogType')}</span>
          <select
            value={props.query.types[0] ?? ''}
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
            value={props.query.categories[0] ?? ''}
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
            value={props.query.rarities[0] ?? ''}
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
      {props.error && (
        <p className="group-loot-inline-error" role="alert">
          {props.error}
        </p>
      )}
      <div className="creature-collection-table-wrap">
        <table className="creature-collection-table loot-catalog-table">
          <thead>
            <tr>
              <th>{message('loot.item')}</th>
              <th>{message('loot.catalogType')}</th>
              <th>{message('loot.catalogFacts')}</th>
              {!props.readOnly && <th>{message('loot.catalogAdd')}</th>}
            </tr>
          </thead>
          <tbody>
            {props.page?.entries.map((entry) => (
              <tr key={`${entry.kind}:${entry.id}`}>
                <td>
                  <strong>{entry.defaultName}</strong>
                  <small>{kindLabel(entry)}</small>
                </td>
                <td>{entry.type}</td>
                <td>{entryFacts(entry)}</td>
                {!props.readOnly && (
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
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {props.page?.entries.length === 0 && (
          <p className="creature-collection-empty">
            {message('loot.catalogEmpty')}
          </p>
        )}
      </div>
      <footer className="creature-collection-pane-footer">
        <span>
          {formatMessage('loot.catalogCount', {
            count: props.page?.total ?? 0
          })}
        </span>
        <div>
          <button
            type="button"
            disabled={props.query.offset === 0}
            onClick={() =>
              update(
                {
                  offset: Math.max(0, props.query.offset - props.query.limit)
                },
                true
              )
            }
          >
            {message('loot.catalogPrevious')}
          </button>
          <span>{Math.floor(props.query.offset / props.query.limit) + 1}</span>
          <button
            type="button"
            disabled={
              !props.page ||
              props.query.offset + props.query.limit >= props.page.total
            }
            onClick={() =>
              update({ offset: props.query.offset + props.query.limit }, true)
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
