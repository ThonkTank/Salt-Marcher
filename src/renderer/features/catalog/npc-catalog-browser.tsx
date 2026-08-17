import { message } from '../../i18n/catalog-runtime.de.js'
import { TextActionButton } from '../../shell/text-action-button.js'
import type { NpcCatalogController } from './npc-catalog-controller.js'

export function NpcCatalogBrowser(props: { controller: NpcCatalogController }) {
  const controller = props.controller
  return (
    <div className="npc-catalog-browser">
      <div className="catalog-filters npc-catalog-filters">
        <input
          aria-label={message('npc.search')}
          placeholder={message('npc.searchPlaceholder')}
          value={controller.searchInput}
          onChange={(event) => controller.setSearchInput(event.target.value)}
        />
        <select
          aria-label={message('npc.statusFilter')}
          value={controller.lifecycle}
          onChange={(event) =>
            controller.setLifecycle(
              event.target.value as NpcCatalogController['lifecycle']
            )
          }
        >
          <option value="all">{message('catalog.all')}</option>
          <option value="active">{message('npc.active')}</option>
          <option value="defeated">{message('npc.defeated')}</option>
        </select>
        <select
          aria-label={message('npc.factionFilter')}
          value={controller.factionId}
          onChange={(event) => controller.setFactionId(event.target.value)}
        >
          <option value="all">{message('npc.allFactions')}</option>
          <option value="none">{message('npc.noFaction')}</option>
          {controller.factions.map((faction) => (
            <option key={faction.id} value={faction.id}>
              {faction.displayName}
            </option>
          ))}
        </select>
        <select
          aria-label={message('npc.locationFilter')}
          value={controller.locationId}
          onChange={(event) => controller.setLocationId(event.target.value)}
        >
          <option value="all">{message('npc.allLocations')}</option>
          <option value="none">{message('npc.noLocation')}</option>
          {controller.locations.map((location) => (
            <option key={location.id} value={location.id}>
              {location.displayName}
            </option>
          ))}
        </select>
        <button onClick={() => controller.setEditing(null)}>
          {message('ui.erstellen')}
        </button>
      </div>
      <div className="catalog-table-wrap">
        <table className="catalog-table">
          <thead>
            <tr>
              <th>{message('ui.name')}</th>
              <th>{message('npc.statblock')}</th>
              <th>{message('ui.status')}</th>
              <th>{message('npc.faction')}</th>
              <th>{message('npc.location')}</th>
              <th>{message('ui.aktionen')}</th>
            </tr>
          </thead>
          <tbody>
            {controller.visible.map((npc) => (
              <tr
                key={npc.id}
                className={controller.selectedId === npc.id ? 'selected' : ''}
              >
                <td>
                  <TextActionButton onClick={() => controller.setSelected(npc)}>
                    {npc.displayName}
                  </TextActionButton>
                </td>
                <td>{npc.creatureDisplayName}</td>
                <td>
                  {npc.lifecycle === 'active'
                    ? message('npc.active')
                    : message('npc.defeated')}
                </td>
                <td>{npc.factionDisplayName ?? '—'}</td>
                <td>{npc.locationDisplayName ?? '—'}</td>
                <td className="row-actions">
                  {controller.deleteId === npc.id ? (
                    <>
                      <button onClick={() => controller.setDeleteId(null)}>
                        {message('action.cancel')}
                      </button>
                      <button
                        className="danger"
                        onClick={() => void controller.remove(npc.id)}
                      >
                        {message('ui.bestaetigen')}
                      </button>
                    </>
                  ) : (
                    <button
                      className="danger"
                      onClick={() => controller.setDeleteId(npc.id)}
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
          {controller.total} {message('ui.npcs')}
        </span>
      </footer>
    </div>
  )
}
