import type { ReactNode } from 'react'
import type {
  AxialCoordinate,
  HexHistoryState,
  HexMapCatalogSnapshot,
  HexMapView,
  HexTerrainCatalog,
  HexTerrainId
} from '../../../shared/contracts/hex.js'
import type { WorldLocationSnapshot } from '../../../shared/contracts/world-location.js'
import { message } from '../../i18n/messages.de.js'
import { CatalogCrudControlsView } from '../../shell/catalog-crud-controls-view.js'
import { HexMapCanvas } from './hex-map-canvas.js'
import type { EditorOverlay, EditorTool } from './use-hex-editor-controller.js'

export function HexCatalogPane(props: {
  catalog: HexMapCatalogSnapshot
  terrains: HexTerrainCatalog
  locations: WorldLocationSnapshot
  map: HexMapView | null
  tool: EditorTool
  terrainId: HexTerrainId
  radius: number
  locationId: string
  newName: string
  name: string
  history: HexHistoryState
  onCreateValueChange: (value: string) => void
  onCreate: () => void
  onEditValueChange: (value: string) => void
  onSave: () => void
  onSelectMap: (mapId: string) => void
  onSelectTool: (tool: EditorTool) => void
  onRadiusChange: (radius: number) => void
  onTerrainChange: (terrainId: HexTerrainId) => void
  onLocationChange: (locationId: string) => void
  onResetView: () => void
  onHistory: (direction: 'undo' | 'redo') => void
}) {
  return (
    <aside className="hex-editor-controls">
      <CatalogCrudControlsView
        title={message('ui.hex.karten')}
        items={props.catalog.maps.map((entry) => ({
          id: entry.id,
          label: entry.displayName
        }))}
        selectedId={props.map?.map.id ?? ''}
        emptyLabel={message('ui.keine.karte')}
        selectLabel={message('ui.karte')}
        createLabel={message('ui.neue.karte')}
        createValue={props.newName}
        createButtonLabel={message('ui.neu')}
        editLabel={message('ui.name')}
        editValue={props.name}
        saveButtonLabel={message('ui.kartendaten.speichern')}
        onCreateValueChange={props.onCreateValueChange}
        onCreate={props.onCreate}
        onEditValueChange={props.onEditValueChange}
        onSave={props.onSave}
        onSelect={props.onSelectMap}
      >
        {props.map && (
          <HexToolControls {...props} onHistory={props.onHistory} />
        )}
      </CatalogCrudControlsView>
    </aside>
  )
}

function HexToolControls(props: {
  terrains: HexTerrainCatalog
  locations: WorldLocationSnapshot
  tool: EditorTool
  terrainId: HexTerrainId
  radius: number
  locationId: string
  history: HexHistoryState
  onSelectTool: (tool: EditorTool) => void
  onRadiusChange: (radius: number) => void
  onTerrainChange: (terrainId: HexTerrainId) => void
  onLocationChange: (locationId: string) => void
  onResetView: () => void
  onHistory: (direction: 'undo' | 'redo') => void
}) {
  return (
    <>
      <div className="tool-row" aria-label={message('hex.tools')}>
        {(['select', 'paint', 'erase', 'location'] as const).map((tool) => (
          <button
            key={tool}
            aria-pressed={props.tool === tool}
            onClick={() => props.onSelectTool(tool)}
          >
            {toolLabel(tool)}
          </button>
        ))}
      </div>
      {(props.tool === 'paint' || props.tool === 'erase') && (
        <label>
          {message('hex.brushRadius')}: {props.radius}
          <input
            aria-label={message('hex.brushRadius')}
            type="range"
            min="0"
            max="10"
            value={props.radius}
            onChange={(event) =>
              props.onRadiusChange(Number(event.target.value))
            }
          />
        </label>
      )}
      {props.tool === 'paint' && (
        <label>
          {message('ui.terrain')}
          <select
            value={props.terrainId}
            onChange={(event) =>
              props.onTerrainChange(event.target.value as HexTerrainId)
            }
          >
            {props.terrains.terrains.map((terrain) => (
              <option key={terrain.id} value={terrain.id}>
                {terrain.label} ·{' '}
                {terrain.passable
                  ? `${terrain.travelCost}×`
                  : message('hex.impassable')}
              </option>
            ))}
          </select>
        </label>
      )}
      {props.tool === 'location' && (
        <label>
          {message('ui.ort.platzieren')}
          <select
            value={props.locationId}
            onChange={(event) => props.onLocationChange(event.target.value)}
          >
            <option value="">{message('hex.noLocationSelected')}</option>
            {props.locations.locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.displayName}
              </option>
            ))}
          </select>
        </label>
      )}
      <button onClick={props.onResetView}>{message('hex.resetView')}</button>
      <div className="tool-row" aria-label={message('hex.history')}>
        <HistoryButton
          direction="undo"
          enabled={props.history.canUndo}
          label={props.history.undoLabel}
          onHistory={props.onHistory}
        />
        <HistoryButton
          direction="redo"
          enabled={props.history.canRedo}
          label={props.history.redoLabel}
          onHistory={props.onHistory}
        />
      </div>
    </>
  )
}

function HistoryButton(props: {
  direction: 'undo' | 'redo'
  enabled: boolean
  label: string | null
  onHistory: (direction: 'undo' | 'redo') => void
}) {
  return (
    <button
      disabled={!props.enabled}
      onClick={() => props.onHistory(props.direction)}
    >
      {message(`hex.history.${props.direction}`)}
      {props.label ? `: ${historyLabel(props.label)}` : ''}
    </button>
  )
}

export function HexCanvasSurface(props: {
  map: HexMapView | null
  terrains: HexTerrainCatalog
  selected: AxialCoordinate | null
  overlays: readonly EditorOverlay[]
  tool: EditorTool
  radius: number
  terrainId: HexTerrainId
  resetViewSignal: number
  onSelect: (coordinate: AxialCoordinate) => void
  onStroke: (path: readonly AxialCoordinate[]) => void
  onViewportChange: (center: AxialCoordinate, halfExtent: number) => void
}) {
  return (
    <section
      className="hex-editor-map"
      aria-label={message('ui.kartenansicht')}
    >
      {props.map ? (
        <HexMapCanvas
          snapshot={props.map}
          terrains={props.terrains}
          selected={props.selected}
          overlays={props.overlays}
          interaction={props.tool}
          brushRadius={props.radius}
          brushTerrainId={props.terrainId}
          resetViewSignal={props.resetViewSignal}
          onTileClick={props.onSelect}
          onStrokeComplete={props.onStroke}
          onViewportChange={props.onViewportChange}
          ariaLabel={`Hex-Editor ${props.map.map.displayName}`}
        />
      ) : (
        <div className="session-map-empty">
          {message('ui.erstelle.eine.hex.karte')}
        </div>
      )}
    </section>
  )
}

export function HexStatePane(props: {
  selected: AxialCoordinate | null
  tile: HexMapView['tiles'][number] | null
  terrains: HexTerrainCatalog
  tool: EditorTool
  locationId: string
  targetOccupiedByOtherLocation: boolean
  onPlaceLocation: () => void
  onRemoveLocation: () => void
}) {
  let content: ReactNode = <p>{message('ui.waehle.ein.hexfeld.aus')}</p>
  if (props.selected) {
    content = (
      <>
        <strong>{`Hex q=${props.selected.q}, r=${props.selected.r}`}</strong>
        {props.tile ? (
          <>
            <p>
              {
                props.terrains.terrains.find(
                  (terrain) => terrain.id === props.tile?.terrainId
                )?.label
              }
            </p>
            <p>
              {props.tile.location?.displayName ??
                message('hex.noNamedLocation')}
            </p>
          </>
        ) : (
          <p>{message('hex.emptyTile')}</p>
        )}
        {props.tool === 'location' && (
          <>
            {props.targetOccupiedByOtherLocation && (
              <p role="alert">{message('hex.locationOccupied')}</p>
            )}
            <button
              disabled={
                !props.tile ||
                !props.locationId ||
                props.targetOccupiedByOtherLocation
              }
              onClick={props.onPlaceLocation}
            >
              {message('ui.hier.platzieren')}
            </button>
            {props.tile?.location && (
              <button className="danger" onClick={props.onRemoveLocation}>
                {message('hex.removeLocation')}
              </button>
            )}
          </>
        )}
      </>
    )
  }
  return (
    <aside className="hex-editor-state">
      <h2>{message('ui.hexfeld')}</h2>
      {content}
    </aside>
  )
}

function toolLabel(tool: EditorTool): string {
  switch (tool) {
    case 'select':
      return message('ui.auswahl')
    case 'paint':
      return message('ui.terrain.malen')
    case 'erase':
      return message('hex.eraser')
    case 'location':
      return message('ui.ort.platzieren')
  }
}

function historyLabel(code: string): string {
  switch (code) {
    case 'paint':
      return message('hex.history.paint')
    case 'erase':
      return message('hex.history.erase')
    case 'location_place':
      return message('hex.history.locationPlace')
    case 'location_move':
      return message('hex.history.locationMove')
    case 'location_remove':
      return message('hex.history.locationRemove')
    default:
      return code
  }
}
