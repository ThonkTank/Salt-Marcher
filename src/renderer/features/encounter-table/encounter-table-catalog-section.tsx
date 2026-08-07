import type { Creature } from '../../../shared/contracts/encounter.js'
import { message } from '../../i18n/messages.de.js'
import { EncounterTableManager } from './encounter-table-manager.js'
import type { EncounterTableCatalogController } from './encounter-table-catalog-controller.js'

export function EncounterTableCatalogSection(props: {
  controller: EncounterTableCatalogController
  onError: (message: string) => void
  inspect: (creature: Creature) => void
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
                  <button
                    className="link-button"
                    onClick={() => controller.setEditing(table)}
                  >
                    {table.displayName}
                  </button>
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
        <EncounterTableManager
          key={controller.editing?.id ?? 'new'}
          table={controller.editing}
          tables={controller.snapshot.tables}
          close={() => controller.setEditing(undefined)}
          select={controller.setEditing}
          save={controller.save}
          saved={(next) => {
            controller.setSnapshot(next)
            controller.setEditing(undefined)
          }}
          onError={props.onError}
          inspect={props.inspect}
          allowInstallationScope
        />
      )}
    </>
  )
}
