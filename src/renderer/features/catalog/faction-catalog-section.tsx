import { message } from '../../i18n/catalog-runtime.de.js'
import { TextActionButton } from '../../shell/text-action-button.js'
import type { FactionCatalogController } from './faction-catalog-controller.js'

export function FactionCatalogSection(props: {
  controller: FactionCatalogController
}) {
  const controller = props.controller
  return (
    <>
      <div className="catalog-filters">
        <input
          aria-label={message('ui.fraktionen.suchen')}
          placeholder={message('ui.fraktionen.suchen.2')}
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
              <th>{message('ui.gesinnung')}</th>
              <th>{message('ui.primaertabelle')}</th>
              <th>{message('ui.bestand')}</th>
              <th>{message('ui.aktionen')}</th>
            </tr>
          </thead>
          <tbody>
            {controller.visible.map((faction) => (
              <tr key={faction.id}>
                <td>
                  <TextActionButton
                    onClick={() => controller.setEditing(faction)}
                  >
                    {faction.displayName}
                  </TextActionButton>
                </td>
                <td>{faction.disposition}</td>
                <td>
                  {controller.tables.find(
                    (table) => table.id === faction.primaryEncounterTableId
                  )?.displayName ?? message('catalog.none')}
                </td>
                <td>
                  {faction.inventory.length} {message('ui.grenzen')}
                </td>
                <td className="row-actions">
                  {controller.deleteId === faction.id ? (
                    <>
                      <button onClick={() => controller.setDeleteId(null)}>
                        {message('action.cancel')}
                      </button>
                      <button
                        className="danger"
                        onClick={() =>
                          void controller.removeFaction(faction.id)
                        }
                      >
                        {message('ui.bestaetigen')}
                      </button>
                    </>
                  ) : (
                    <button
                      className="danger"
                      onClick={() => controller.setDeleteId(faction.id)}
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
          {controller.visible.length} {message('ui.fraktionen')}
        </span>
      </footer>
    </>
  )
}
