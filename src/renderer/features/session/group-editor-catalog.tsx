import { message, formatMessage } from '../../i18n/session-runtime.de.js'
import { CreatureFilters, FilterChips } from '../creatures/creature-controls.js'
import { EncounterTableCreatureCatalogTable } from '../creature-collection/creature-collection.js'
import { LootCatalogPane } from '../loot/loot-catalog-pane.js'
import type { GroupManagerController } from './use-group-manager-controller.js'

export function GroupEditorCatalog({
  controller: c
}: {
  controller: GroupManagerController
}) {
  const catalog = c.state.creatureCatalog
  if (c.state.workspaceMode === 'loot')
    return (
      <LootCatalogPane
        compact
        query={c.state.lootCatalog.query}
        page={c.state.lootCatalog.page}
        error={c.state.lootCatalog.error}
        queryChanged={c.setLootQuery}
        add={c.addLoot}
      />
    )
  return (
    <div className="group-editor-catalog">
      <input
        type="search"
        aria-label={message('ui.monster.suchen')}
        placeholder={message('ui.monster.suchen')}
        value={catalog.query.name}
        onChange={(e) =>
          c.setCreatureQuery({
            ...catalog.query,
            name: e.target.value,
            offset: 0
          })
        }
      />
      <details>
        <summary>{message('groupEditor.filters')}</summary>
        <CreatureFilters
          query={catalog.query}
          options={catalog.options}
          searchBiomeOptions={c.searchBiomeOptions}
          changed={c.setCreatureQuery}
          compact
          hideName
          allReferenceFilters
        />
      </details>
      <FilterChips
        query={catalog.query}
        options={catalog.options}
        changed={c.setCreatureQuery}
      />
      {catalog.error && <p role="alert">{catalog.error}</p>}
      <EncounterTableCreatureCatalogTable
        query={catalog.query}
        options={catalog.options}
        page={catalog.page}
        changed={c.setCreatureQuery}
        add={c.addCreature}
        inspect={(creature) => void c.inspectCreature(creature)}
        quantities={c.group.quantities}
        controls={false}
        disabled={c.busy}
        footerStatus={formatMessage('loot.catalogCount', {
          count: catalog.page?.total ?? 0
        })}
      />
    </div>
  )
}
