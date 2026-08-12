import { lazy, Suspense } from 'react'
import type {
  Creature,
  CreatureCatalogPage,
  CreatureCatalogQuery,
  CreatureFilterOptions
} from '../../../shared/contracts/encounter.js'
import type { LootCatalogEntry } from '../../../shared/contracts/loot.js'
import type { GroupRewardGeneratedRun } from '../../../shared/contracts/session-generation.js'
import type { SearchableSelectOption } from '../../shell/searchable-select.js'
import { message } from '../../i18n/session-runtime.de.js'
import { CreatureBuilderCatalogTable } from '../creature-collection/creature-collection.js'
import { CreatureFilters, FilterChips } from '../creatures/creature-controls.js'

const LazyLootCatalogPane = lazy(async () => {
  const module = await import('../loot/loot-catalog-pane.js')
  return { default: module.LootCatalogPane }
})

export type GroupCatalogMode = 'creatures' | 'loot'

export function GroupManagerCatalogTools(props: {
  mode: GroupCatalogMode
  lootAvailable: boolean
  query: CreatureCatalogQuery
  options: CreatureFilterOptions
  searchBiomeOptions?:
    ((query: string) => Promise<readonly SearchableSelectOption[]>) | undefined
  queryChanged: (query: CreatureCatalogQuery) => void
  modeChanged: (mode: GroupCatalogMode) => void
  filterSummary: string
  busy: boolean
  canGenerate: boolean
  generate: (mode: 'fill' | 'replace') => void
}) {
  return (
    <div>
      <div
        className="group-catalog-mode-tabs"
        role="tablist"
        aria-label={message('loot.catalogMode')}
      >
        <button
          type="button"
          role="tab"
          aria-selected={props.mode === 'creatures'}
          onClick={() => props.modeChanged('creatures')}
        >
          {message('loot.catalogCreatures')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={props.mode === 'loot'}
          disabled={!props.lootAvailable}
          onClick={() => props.modeChanged('loot')}
        >
          {message('loot.catalogLoot')}
        </button>
      </div>
      {props.mode === 'creatures' && (
        <CreatureFilters
          query={props.query}
          options={props.options}
          searchBiomeOptions={props.searchBiomeOptions}
          changed={props.queryChanged}
          clustered
        />
      )}
      <div className="group-tool-row">
        <div className="group-filter-summary">
          {props.mode === 'creatures' ? (
            <>
              <FilterChips
                query={props.query}
                changed={props.queryChanged}
                options={props.options}
              />
              <span>{props.filterSummary}</span>
            </>
          ) : (
            <span>{message('loot.catalogHint')}</span>
          )}
        </div>
        <section
          className="group-generator-card"
          aria-label={message('group.generator')}
        >
          <strong>{message('group.generator')}</strong>
          <div className="group-generator-actions">
            <button
              type="button"
              disabled={props.busy || !props.canGenerate}
              onClick={() => props.generate('fill')}
            >
              {message('ui.auffuellen')}
            </button>
            <button
              type="button"
              disabled={props.busy || !props.canGenerate}
              onClick={() => props.generate('replace')}
            >
              {message('ui.neu.generieren')}
            </button>
          </div>
          {!props.canGenerate && (
            <small>
              {message(
                'ui.zum.generieren.braucht.die.scene.eine.zugewiesene.party'
              )}
            </small>
          )}
        </section>
      </div>
    </div>
  )
}

export function GroupManagerCatalogPane(props: {
  mode: GroupCatalogMode
  run: GroupRewardGeneratedRun | null
  query: CreatureCatalogQuery
  options: CreatureFilterOptions
  page: CreatureCatalogPage | null
  queryChanged: (query: CreatureCatalogQuery) => void
  addCreature: (creature: Creature) => void
  inspectCreature: (creature: Creature) => void
  quantities: Readonly<Record<string, number>>
  footerStatus: string
  addLoot: (entry: LootCatalogEntry) => void
}) {
  if (props.mode === 'creatures' || !props.run)
    return (
      <CreatureBuilderCatalogTable
        className="group-manager-catalog"
        query={props.query}
        options={props.options}
        page={props.page}
        changed={props.queryChanged}
        add={props.addCreature}
        inspect={props.inspectCreature}
        quantities={props.quantities}
        controls={false}
        showBiome
        footerStatus={props.footerStatus}
      />
    )

  return (
    <Suspense fallback={null}>
      <LazyLootCatalogPane
        key={props.run.catalogContentHash}
        runId={props.run.id}
        catalogContentHash={props.run.catalogContentHash}
        add={props.addLoot}
      />
    </Suspense>
  )
}
