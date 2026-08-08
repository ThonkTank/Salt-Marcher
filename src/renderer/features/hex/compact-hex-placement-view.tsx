import type { AxialCoordinate } from '../../../shared/contracts/hex.js'
import { formatMessage, message } from '../../i18n/hex-runtime.de.js'
import type { WorldLocationPlacementSelection } from '../worldplanner/world-location-editor-types.js'
import { HexMapCanvas } from './hex-map-canvas.js'
import type { HexPlacementProjectionState } from './use-hex-location-placement-draft.js'
import './hex-location-placement.css'

export function CompactHexPlacementView(props: {
  state: HexPlacementProjectionState
  locationName: string
  disabled: boolean
  selection: WorldLocationPlacementSelection | null
  errorText: string | null
  changeMap: (mapId: string) => Promise<void>
  choose: (coordinate: AxialCoordinate) => void
  loadViewport: (center: AxialCoordinate, halfExtent: number) => void
  expand: () => void
  showExpandedButton: boolean
  createMap?: () => void
  removeSelection?: () => void
}) {
  const data =
    props.state.status === 'ready' || props.state.status === 'degraded'
      ? props.state.data
      : null
  const selected =
    props.selection && props.selection.mapId === data?.map?.map.id
      ? props.selection.coordinate
      : null
  const tile = selected
    ? data?.map?.tiles.find(
        (candidate) => candidate.q === selected.q && candidate.r === selected.r
      )
    : null
  const biome = tile
    ? data?.biomes.biomes.find((entry) => entry.id === tile.biomeId)
    : null

  return (
    <section className="location-map-section">
      <h3>{message('ui.hexkarte')}</h3>
      {props.errorText && <p role="alert">{props.errorText}</p>}
      {props.state.status === 'loading' ? (
        <p role="status">{message('ui.karten.werden.geladen')}</p>
      ) : props.state.status === 'failed' || !data ? null : (
        <>
          <div className="location-map-selection-row">
            {data.catalog.maps.length > 0 && data.map ? (
              <select
                aria-label={message('ui.hexkarte')}
                disabled={props.disabled}
                value={data.map.map.id}
                onChange={(event) => void props.changeMap(event.target.value)}
              >
                {data.catalog.maps.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.displayName}
                  </option>
                ))}
              </select>
            ) : (
              <span>{message('ui.lege.zuerst.eine.hex.karte.an')}</span>
            )}
            {props.createMap && (
              <button
                type="button"
                disabled={props.disabled}
                className="location-inline-create"
                onClick={props.createMap}
              >
                {message('ui.neue.karte')}
              </button>
            )}
          </div>
          {data.map && (
            <>
              <div className="location-map-frame">
                <HexMapCanvas
                  snapshot={data.map}
                  biomes={data.biomes}
                  selected={selected}
                  interaction="location"
                  onTileClick={props.choose}
                  onViewportChange={props.loadViewport}
                  ariaLabel={formatMessage('hex.canvas.placementLabel', {
                    name: props.locationName
                  })}
                />
              </div>
              <div className="location-map-status">
                <span>
                  {selected && biome
                    ? formatMessage('hex.status.tileBiome', {
                        q: selected.q,
                        r: selected.r,
                        biome: biome.label
                      })
                    : message('ui.nicht.platziert')}
                </span>
                <span className="location-map-actions">
                  {props.removeSelection && (
                    <button
                      type="button"
                      disabled={props.disabled}
                      onClick={props.removeSelection}
                    >
                      {message('hex.removePlacement')}
                    </button>
                  )}
                  {props.showExpandedButton && (
                    <button
                      type="button"
                      disabled={props.disabled}
                      onClick={props.expand}
                    >
                      {message('ui.grosse.karte')}
                    </button>
                  )}
                </span>
              </div>
            </>
          )}
        </>
      )}
    </section>
  )
}
