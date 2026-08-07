import type { Creature } from '../../../shared/contracts/encounter.js'
import { message } from '../../i18n/catalog-runtime.de.js'
import { EncounterTableDialog } from './encounter-table-manager.js'
import type { EncounterTableCatalogController } from './encounter-table-catalog-controller.js'
import type { CreatureCapabilityPort } from '../creatures/creatures-capabilities.js'
import type { BiomeOptionSearchPort } from '../creatures/biome-option-search-port.js'
import { TextActionButton } from '../../shell/text-action-button.js'

export function EncounterTableCatalogSection(props: {
  controller: EncounterTableCatalogController
  onError: (message: string) => void
  inspect: (creature: Creature) => void
  creatures: CreatureCapabilityPort
  biomes: BiomeOptionSearchPort
}) {
  const controller = props.controller
  return (
    <>
      <div className="catalog-filters">
        <input
          aria-label={message('ui.encounter.tabellen.suchen')}
          placeholder={message('ui.encounter.tabellen.suchen.2')}
          value={controller.search}
          onChange={(event) => controller.setSearch(event.target.value)}
        />
        <button onClick={() => controller.setEditing(null)}>
          {message('ui.erstellen')}
        </button>
      </div>
      <div className="catalog-table-wrap">
        <table className="catalog-table">
          <thead>
            <tr>
              <th>{message('ui.name')}</th>
              <th>{message('encounterTable.scope')}</th>
              <th>{message('ui.eintraege')}</th>
              <th>{message('ui.beschreibung')}</th>
              <th>{message('ui.aktionen')}</th>
            </tr>
          </thead>
          <tbody>
            {controller.visible.map((table) => (
              <tr key={table.id}>
                <td>
                  <TextActionButton
                    onClick={() => controller.setEditing(table)}
                  >
                    {table.displayName}
                  </TextActionButton>
                </td>
                <td>
                  {table.scope === 'installation'
                    ? message('encounterTable.scopeInstallation')
                    : message('encounterTable.scopeCampaign')}
                  {table.protected
                    ? ` · ${message('encounterTable.standard')}`
                    : ''}
                </td>
                <td>{table.entries.length}</td>
                <td>{table.description || '—'}</td>
                <td className="row-actions">
                  {table.protected ? (
                    <span className="muted">
                      {message('encounterTable.protected')}
                    </span>
                  ) : controller.deleteId === table.id ? (
                    <>
                      <button onClick={() => controller.setDeleteId(null)}>
                        {message('action.cancel')}
                      </button>
                      <button
                        className="danger"
                        onClick={() => void controller.remove(table.id)}
                      >
                        {message('ui.bestaetigen')}
                      </button>
                    </>
                  ) : (
                    <button
                      className="danger"
                      onClick={() => controller.setDeleteId(table.id)}
                    >
                      {message('ui.loeschen')}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <footer className="catalog-footer">
        <span>
          {controller.visible.length} {message('ui.encounter.tabellen')}
        </span>
      </footer>
      {controller.editing !== undefined && (
        <EncounterTableDialog
          key={controller.editing?.id ?? 'new'}
          table={controller.editing}
          close={() => controller.setEditing(undefined)}
          save={controller.save}
          saved={(result) => {
            controller.setSnapshot(result.snapshot)
            controller.setEditing(undefined)
          }}
          onError={props.onError}
          inspect={props.inspect}
          creaturePort={props.creatures}
          biomePort={props.biomes}
          invocation={{ kind: 'catalog' }}
        />
      )}
    </>
  )
}
