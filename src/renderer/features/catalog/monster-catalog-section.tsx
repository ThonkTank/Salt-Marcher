import { formatMessage, message } from '../../i18n/catalog-runtime.de.js'
import {
  formatChallengeRating,
  formatInteger
} from '../../i18n/domain-formatters.de.js'
import { TextActionButton } from '../../shell/text-action-button.js'
import {
  CreatureFilters,
  FilterChips,
  SortHeader
} from '../creatures/creature-controls.js'
import type { MonsterCatalogController } from './monster-catalog-controller.js'

export function MonsterCatalogSection(props: {
  controller: MonsterCatalogController
}) {
  const { query } = props.controller
  return (
    <>
      <CreatureFilters
        query={query}
        options={props.controller.options}
        searchBiomeOptions={props.controller.searchBiomeOptions}
        changed={props.controller.setQuery}
      />
      <div className="creatures-filter-chips">
        <FilterChips
          query={query}
          options={props.controller.options}
          changed={props.controller.setQuery}
        />
      </div>
      <div className="catalog-table-wrap">
        <table className="catalog-table">
          <thead>
            <tr>
              <SortHeader
                label={message('ui.name')}
                field="name"
                query={query}
                changed={props.controller.setQuery}
              />
              <SortHeader
                label={message('ui.cr')}
                field="cr"
                query={query}
                changed={props.controller.setQuery}
              />
              <th>{message('ui.typ')}</th>
              <th>{message('ui.groesse')}</th>
              <SortHeader
                label={message('ui.xp.2')}
                field="xp"
                query={query}
                changed={props.controller.setQuery}
              />
            </tr>
          </thead>
          <tbody>
            {props.controller.page?.rows.map((creature) => (
              <tr key={creature.id} className="catalog-row">
                <td>
                  <TextActionButton
                    onClick={() => void props.controller.open(creature)}
                  >
                    {creature.name}
                  </TextActionButton>
                </td>
                <td>{formatChallengeRating(creature.challengeRating)}</td>
                <td>
                  {creature.type}
                  {creature.subtype ? ` (${creature.subtype})` : ''}
                </td>
                <td>{creature.size}</td>
                <td>{formatInteger(creature.xp)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <footer className="catalog-footer">
        <span>
          {props.controller.loading
            ? message('catalog.monstersUpdating')
            : props.controller.page?.message ||
              formatMessage('catalog.monsterCount', {
                count: props.controller.page?.total ?? 0
              })}
        </span>
        <div>
          <button
            disabled={!props.controller.page || query.offset === 0}
            onClick={() =>
              props.controller.setQuery({
                ...query,
                offset: Math.max(0, query.offset - query.limit)
              })
            }
          >
            {message('ui.zurueck')}
          </button>
          <span>{Math.floor(query.offset / query.limit) + 1}</span>
          <button
            disabled={
              !props.controller.page ||
              query.offset + query.limit >= props.controller.page.total
            }
            onClick={() =>
              props.controller.setQuery({
                ...query,
                offset: query.offset + query.limit
              })
            }
          >
            {message('ui.weiter')}
          </button>
        </div>
      </footer>
    </>
  )
}
