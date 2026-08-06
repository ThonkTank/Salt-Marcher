import { useEffect, useEffectEvent, useMemo, useState } from 'react'
import type {
  AxialCoordinate,
  HexHistoryState,
  HexMapCatalogSnapshot,
  HexMapView,
  HexTerrainCatalog,
  HexTerrainId
} from '../../../shared/contracts/hex.js'
import type {
  WorldLocationMapPresentation,
  WorldLocationSnapshot
} from '../../../shared/contracts/world-location.js'
import type {
  LocationSymbolDeleteImpact,
  LocationSymbolPage,
  LocationSymbol
} from '../../../shared/contracts/location-symbol.js'
import { formatMessage, message } from '../../i18n/messages.de.js'
import { HexMapCanvas } from './hex-map-canvas.js'
import type {
  EditorOverlay,
  EditorTool,
  TerrainMode
} from './use-hex-editor-controller.js'
import {
  allLocationSymbols,
  builtinLocationSymbols
} from './location-symbols.js'
import { ModalDialog } from '../../shell/modal-dialog.js'
import { HexSlider } from './hex-slider.js'
import { HexScrollArea } from './hex-scroll-area.js'
import { brushLevelToRadius } from './hex-brush.js'

export function HexCatalogPane(props: {
  catalog: HexMapCatalogSnapshot
  map: HexMapView | null
  tool: EditorTool
  name: string
  history: HexHistoryState
  onCreate: () => void
  onEditValueChange: (value: string) => void
  onSave: () => void
  onSelectMap: (mapId: string) => void
  onSelectTool: (tool: EditorTool) => void
  onHistory: (direction: 'undo' | 'redo') => void
}) {
  const [renaming, setRenaming] = useState(false)
  return (
    <header className="hex-map-bar">
      <span className="hex-map-label">{message('ui.karte')}</span>
      {renaming ? (
        <input
          className="hex-map-name-input"
          aria-label={message('hex.editor.mapName')}
          autoFocus
          value={props.name}
          onChange={(event) => props.onEditValueChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && props.name.trim()) {
              props.onSave()
              setRenaming(false)
            }
            if (event.key === 'Escape') setRenaming(false)
          }}
        />
      ) : (
        <select
          aria-label={message('ui.hex.karte')}
          value={props.map?.map.id ?? ''}
          onChange={(event) => props.onSelectMap(event.target.value)}
        >
          {props.catalog.maps.length === 0 && (
            <option value="">{message('hex.none')}</option>
          )}
          {props.catalog.maps.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.displayName}
            </option>
          ))}
        </select>
      )}
      <button onClick={props.onCreate}>{message('hex.editor.newMap')}</button>
      <button
        disabled={!props.map}
        onClick={() => {
          if (renaming && props.name.trim()) props.onSave()
          setRenaming((current) => !current)
        }}
      >
        {renaming
          ? message('hex.editor.saveMap')
          : message('hex.editor.renameMap')}
      </button>
      <span className="hex-map-divider" aria-hidden="true" />
      <button
        disabled={!props.history.canUndo}
        title={props.history.undoLabel ?? undefined}
        onClick={() => props.onHistory('undo')}
      >
        {message('hex.history.undo')}
      </button>
      <button
        disabled={!props.history.canRedo}
        title={props.history.redoLabel ?? undefined}
        onClick={() => props.onHistory('redo')}
      >
        {message('hex.editor.forward')}
      </button>
      <div className="hex-tool-segments" aria-label={message('hex.tools')}>
        <ToolButton
          active={props.tool === 'select'}
          onClick={() => props.onSelectTool('select')}
        >
          {message('hex.editor.selectTool')}
        </ToolButton>
        <ToolButton
          active={props.tool === 'terrain'}
          onClick={() => props.onSelectTool('terrain')}
        >
          {message('hex.editor.terrainTool')}
        </ToolButton>
        <ToolButton
          active={props.tool === 'location'}
          onClick={() => props.onSelectTool('location')}
        >
          {message('hex.editor.locationTool')}
        </ToolButton>
      </div>
    </header>
  )
}

function ToolButton(props: {
  active: boolean
  onClick: () => void
  children: string
}) {
  return (
    <button aria-pressed={props.active} onClick={props.onClick}>
      {props.children}
    </button>
  )
}

export function HexCanvasSurface(props: {
  map: HexMapView | null
  terrains: HexTerrainCatalog
  selected: AxialCoordinate | null
  overlays: readonly EditorOverlay[]
  tool: EditorTool
  terrainMode: TerrainMode
  brushLevel: number
  terrainId: HexTerrainId
  resetViewSignal: number
  onSelect: (coordinate: AxialCoordinate) => void
  onStroke: (path: readonly AxialCoordinate[]) => void
  onViewportChange: (center: AxialCoordinate, halfExtent: number) => void
}) {
  const tile = props.selected
    ? props.map?.tiles.find(
        (entry) =>
          entry.q === props.selected!.q && entry.r === props.selected!.r
      )
    : null
  const terrain = tile
    ? props.terrains.terrains.find((entry) => entry.id === tile.terrainId)
    : null
  const toolStatus =
    props.tool === 'terrain'
      ? props.terrainMode === 'paint'
        ? formatMessage('hex.editor.paintStatus', {
            terrain:
              props.terrains.terrains.find(
                (entry) => entry.id === props.terrainId
              )?.label ?? ''
          })
        : message('hex.editor.eraseStatus')
      : props.tool === 'location'
        ? message('hex.editor.locationStatus')
        : message('hex.editor.selectStatus')
  return (
    <section
      className="hex-editor-map"
      aria-label={message('ui.kartenansicht')}
    >
      <div className="hex-map-stage">
        {props.map ? (
          <HexMapCanvas
            snapshot={props.map}
            terrains={props.terrains}
            selected={props.selected}
            overlays={props.overlays}
            interaction={
              props.tool === 'terrain' ? props.terrainMode : props.tool
            }
            brushRadius={brushLevelToRadius(props.brushLevel)}
            brushTerrainId={props.terrainId}
            resetViewSignal={props.resetViewSignal}
            onTileClick={props.onSelect}
            onStrokeComplete={props.onStroke}
            onViewportChange={props.onViewportChange}
            ariaLabel={formatMessage('hex.editor.canvasLabel', {
              name: props.map.map.displayName
            })}
          />
        ) : (
          <div className="session-map-empty">
            {message('ui.erstelle.eine.hex.karte')}
          </div>
        )}
      </div>
      <footer className="hex-editor-status">
        <span>
          {props.selected
            ? formatMessage('hex.editor.coordinateStatus', {
                q: props.selected.q,
                r: props.selected.r,
                terrain: terrain?.label ?? message('hex.editor.emptyHex'),
                location: tile?.location
                  ? ` · ${tile.location.marker.title}`
                  : ''
              })
            : message('hex.selectTile')}
        </span>
        <span>{toolStatus}</span>
      </footer>
    </section>
  )
}

export function HexStatePane(props: {
  selected: AxialCoordinate | null
  tile: HexMapView['tiles'][number] | null
  terrains: HexTerrainCatalog
  locations: WorldLocationSnapshot
  symbols: LocationSymbolPage
  selectedCustomSymbol: LocationSymbol | null
  tool: EditorTool
  terrainMode: TerrainMode
  terrainId: HexTerrainId
  brushLevel: number
  locationId: string
  onPaintMode: (mode: TerrainMode) => void
  onBrushLevelChange: (level: number) => void
  onTerrainChange: (terrainId: HexTerrainId) => void
  onLocationChange: (locationId: string) => void
  onCreateLocation: () => void
  locationDialogOpen: boolean
  onPresentationChange: (
    locationId: string,
    presentation: WorldLocationMapPresentation
  ) => void
  onPresentationCommit: (locationId: string) => void
  onImportSymbol: (displayName: string) => void
  onSymbolSearch: (query: string) => void
  onSymbolPage: (offset: number) => void
  onRenameSymbol: (symbolId: string, displayName: string) => void
  onInspectSymbolDelete: (
    symbolId: string
  ) => Promise<LocationSymbolDeleteImpact>
  onDeleteSymbol: (symbolId: string) => void
  onRemoveLocation: () => void
}) {
  return (
    <aside className="hex-editor-state">
      {props.tool === 'select' ? (
        <SelectionPanel {...props} />
      ) : props.tool === 'terrain' ? (
        <PaintPanel {...props} />
      ) : (
        <LocationPanel {...props} />
      )}
    </aside>
  )
}

function PaintPanel(props: Parameters<typeof HexStatePane>[0]) {
  const radius = brushLevelToRadius(props.brushLevel)
  const fields = 3 * radius * (radius + 1) + 1
  return (
    <div className="hex-panel-content">
      <h2>{message('hex.editor.brush')}</h2>
      <div
        className="hex-wide-segments hex-brush-segments"
        aria-label={message('hex.editor.brushMode')}
      >
        <ToolButton
          active={props.terrainMode === 'paint'}
          onClick={() => props.onPaintMode('paint')}
        >
          {message('hex.editor.paint')}
        </ToolButton>
        <ToolButton
          active={props.terrainMode === 'erase'}
          onClick={() => props.onPaintMode('erase')}
        >
          {message('hex.editor.erase')}
        </ToolButton>
      </div>
      <div className="hex-value-row">
        <span>
          {formatMessage('hex.editor.radius', { level: props.brushLevel })}
        </span>
        <small>
          {fields === 1
            ? message('hex.editor.oneField')
            : formatMessage('hex.editor.manyFields', { count: fields })}
        </small>
      </div>
      <HexSlider
        ariaLabel={message('hex.brushRadius')}
        min={1}
        max={10}
        ticks={10}
        value={props.brushLevel}
        onChange={props.onBrushLevelChange}
      />
      <h2>{message('ui.terrain')}</h2>
      <div className="hex-terrain-grid">
        {props.terrains.terrains.map((terrain) => (
          <button
            key={terrain.id}
            aria-pressed={props.terrainId === terrain.id}
            className="hex-terrain-tile"
            style={{ background: terrain.color }}
            onClick={() => props.onTerrainChange(terrain.id)}
          >
            <span>{terrain.label}</span>
            <small>{terrain.passable ? `${terrain.travelCost}×` : '—'}</small>
          </button>
        ))}
        <button
          className="hex-terrain-new"
          disabled
          title={message('hex.editor.terrainCatalogDeferred')}
        >
          {message('hex.editor.newTerrain')}
        </button>
      </div>
    </div>
  )
}

function SelectionPanel(props: Parameters<typeof HexStatePane>[0]) {
  const terrain = props.tile
    ? props.terrains.terrains.find(
        (entry) => entry.id === props.tile!.terrainId
      )
    : null
  const location = props.tile?.location
    ? props.locations.locations.find(
        (entry) => entry.id === props.tile!.location!.locationId
      )
    : null
  return (
    <div className="hex-panel-content">
      <h2>{message('ui.hexfeld')}</h2>
      {!props.selected ? (
        <p className="hex-muted">{message('hex.editor.chooseTile')}</p>
      ) : !props.tile ? (
        <div className="hex-selection-card">
          <strong>
            q {props.selected.q} · r {props.selected.r}
          </strong>
          <p className="hex-muted">{message('hex.editor.unauthoredTile')}</p>
        </div>
      ) : (
        <div className="hex-selection-card">
          <strong>
            q {props.selected.q} · r {props.selected.r}
          </strong>
          <div className="hex-terrain-fact">
            <span style={{ background: terrain?.color }} />
            <span>{terrain?.label}</span>
            <small>
              {terrain?.passable
                ? `${terrain.travelCost}×`
                : message('hex.impassable')}
            </small>
          </div>
          <p className="hex-muted">
            {location?.mapPresentation.titleOverride ??
              location?.displayName ??
              message('hex.noNamedLocation')}
          </p>
        </div>
      )}
    </div>
  )
}

function LocationPanel(props: Parameters<typeof HexStatePane>[0]) {
  const searchSymbols = useEffectEvent(props.onSymbolSearch)
  const [query, setQuery] = useState('')
  const [symbolQuery, setSymbolQuery] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [newSymbolName, setNewSymbolName] = useState('')
  const [deleteImpact, setDeleteImpact] =
    useState<LocationSymbolDeleteImpact | null>(null)
  const active = props.locations.locations.find(
    (entry) => entry.id === props.locationId
  )
  const needle = query.trim().toLocaleLowerCase('de')
  const hits = props.locations.locations.filter((location) =>
    `${location.displayName} ${location.kind} ${location.region}`
      .toLocaleLowerCase('de')
      .includes(needle)
  )
  const symbols = useMemo(
    () => allLocationSymbols(props.symbols.symbols),
    [props.symbols.symbols]
  )
  const symbolNeedle = symbolQuery.trim().toLocaleLowerCase('de')
  const symbolHits = symbols.filter((symbol) =>
    symbol.displayName.toLocaleLowerCase('de').includes(symbolNeedle)
  )
  const activeCustomSymbol =
    props.symbols.symbols.find(
      (symbol) => symbol.id === active?.mapPresentation.symbolId
    ) ?? props.selectedCustomSymbol
  useEffect(() => {
    const timer = setTimeout(() => searchSymbols(symbolQuery), 180)
    return () => clearTimeout(timer)
  }, [symbolQuery])
  const update = (patch: Partial<WorldLocationMapPresentation>) => {
    if (!active) return
    props.onPresentationChange(active.id, {
      ...active.mapPresentation,
      ...patch
    })
  }
  return (
    <div className="hex-panel-content hex-location-panel">
      <h2>{message('ui.ort')}</h2>
      <button
        className="hex-create-location"
        aria-haspopup="dialog"
        aria-expanded={props.locationDialogOpen}
        disabled={props.locationDialogOpen}
        onClick={props.onCreateLocation}
      >
        {message('catalog.createLocation')}
      </button>
      <label>
        {message('hex.editor.catalogSearch')}
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={message('hex.editor.locationSearchPlaceholder')}
        />
      </label>
      <HexScrollArea
        className="hex-location-list"
        role="listbox"
        ariaLabel={message('hex.editor.catalogLocations')}
      >
        {hits.map((location) => (
          <button
            key={location.id}
            role="option"
            aria-selected={location.id === props.locationId}
            onClick={() => props.onLocationChange(location.id)}
          >
            <span>{location.displayName}</span>
            <small>
              {location.kind ||
                location.region ||
                message('hex.editor.locationFallback')}
            </small>
          </button>
        ))}
      </HexScrollArea>
      {hits.length === 0 && (
        <p className="hex-muted">{message('hex.editor.noCatalogMatch')}</p>
      )}
      <label>
        {message('hex.editor.mapTitle')}
        <input
          disabled={!active}
          value={
            active
              ? (active.mapPresentation.titleOverride ?? active.displayName)
              : ''
          }
          onChange={(event) => {
            const value = event.target.value.trimStart()
            if (active && value.trim())
              update({
                titleOverride:
                  value.trim() === active.displayName ? null : value
              })
          }}
          onBlur={() => active && props.onPresentationCommit(active.id)}
        />
      </label>
      <div className="hex-symbol-heading">
        <span>{message('hex.editor.symbol')}</span>
        <small>
          {formatMessage('hex.editor.symbolCount', {
            visible: symbolHits.length,
            total: builtinSymbolCount(symbolNeedle) + props.symbols.total
          })}
        </small>
      </div>
      <input
        value={symbolQuery}
        onChange={(event) => setSymbolQuery(event.target.value)}
        placeholder={message('hex.editor.symbolFilter')}
        aria-label={message('hex.editor.symbolFilter')}
      />
      <HexScrollArea
        className="hex-symbol-grid"
        role="group"
        ariaLabel={message('hex.editor.symbol')}
      >
        {symbolHits.map((symbol) => (
          <button
            key={symbol.id}
            aria-label={symbol.displayName}
            aria-pressed={active?.mapPresentation.symbolId === symbol.id}
            disabled={!active}
            onClick={() => {
              update({ symbolId: symbol.id })
              if (active) props.onPresentationCommit(active.id)
            }}
          >
            <svg
              viewBox={`${symbol.viewBox.minX} ${symbol.viewBox.minY} ${symbol.viewBox.width} ${symbol.viewBox.height}`}
              aria-hidden="true"
            >
              <path d={symbol.pathData} />
            </svg>
          </button>
        ))}
        <button
          className="hex-add-symbol"
          aria-label={message('hex.editor.addSymbol')}
          aria-pressed={addOpen}
          disabled={!active}
          onClick={() => setAddOpen((current) => !current)}
        >
          +
        </button>
      </HexScrollArea>
      {props.symbols.total > 24 && (
        <div
          className="hex-symbol-pages"
          aria-label={message('hex.editor.symbolPages')}
        >
          <button
            disabled={props.symbols.offset === 0}
            onClick={() =>
              props.onSymbolPage(Math.max(0, props.symbols.offset - 24))
            }
          >
            {message('hex.editor.previousPage')}
          </button>
          <small>
            {formatMessage('hex.editor.pageStatus', {
              current: Math.floor(props.symbols.offset / 24) + 1,
              total: Math.ceil(props.symbols.total / 24)
            })}
          </small>
          <button
            disabled={
              props.symbols.offset + props.symbols.symbols.length >=
              props.symbols.total
            }
            onClick={() => props.onSymbolPage(props.symbols.offset + 24)}
          >
            {message('hex.editor.nextPage')}
          </button>
        </div>
      )}
      {addOpen && (
        <div className="hex-symbol-add-row">
          <input
            aria-label={message('hex.editor.newSymbolName')}
            placeholder={message('ui.name')}
            value={newSymbolName}
            onChange={(event) => setNewSymbolName(event.target.value)}
          />
          <button
            disabled={!newSymbolName.trim()}
            onClick={() => {
              props.onImportSymbol(newSymbolName.trim())
              setNewSymbolName('')
              setAddOpen(false)
            }}
          >
            {message('hex.editor.chooseSvg')}
          </button>
        </div>
      )}
      {activeCustomSymbol && (
        <div className="hex-symbol-management">
          <label>
            {message('hex.editor.renameCustomSymbol')}
            <input
              key={`${activeCustomSymbol.id}:${activeCustomSymbol.displayName}`}
              defaultValue={activeCustomSymbol.displayName}
              onBlur={(event) => {
                const value = event.target.value.trim()
                if (value && value !== activeCustomSymbol.displayName)
                  props.onRenameSymbol(activeCustomSymbol.id, value)
              }}
            />
          </label>
          <button
            className="danger"
            onClick={() =>
              void props
                .onInspectSymbolDelete(activeCustomSymbol.id)
                .then(setDeleteImpact)
                .catch(() => setDeleteImpact(null))
            }
          >
            {message('hex.editor.deleteSymbol')}
          </button>
        </div>
      )}
      {deleteImpact && (
        <ModalDialog
          className="hex-symbol-delete-confirm"
          ariaLabel={formatMessage('hex.editor.deleteSymbolConfirm', {
            name: deleteImpact.symbolName
          })}
          onClose={() => setDeleteImpact(null)}
        >
          <strong>
            {formatMessage('hex.editor.deleteSymbolConfirm', {
              name: deleteImpact.symbolName
            })}
          </strong>
          <p>
            {formatMessage('hex.editor.deleteSymbolImpact', {
              count: deleteImpact.totalLocations,
              campaignCount: deleteImpact.usages.length
            })}
          </p>
          <div className="hex-value-row">
            <button onClick={() => setDeleteImpact(null)}>
              {message('action.cancel')}
            </button>
            <button
              className="danger"
              onClick={() => {
                props.onDeleteSymbol(deleteImpact.symbolId)
                setDeleteImpact(null)
              }}
            >
              {message('hex.editor.deleteAndReplace')}
            </button>
          </div>
        </ModalDialog>
      )}
      <div className="hex-value-row">
        <span>{message('hex.editor.symbolSize')}</span>
        <small>
          {formatMessage('hex.editor.pixelValue', {
            value: active?.mapPresentation.symbolSize ?? 44
          })}
        </small>
      </div>
      <HexSlider
        ariaLabel={message('hex.editor.symbolSize')}
        min={24}
        max={80}
        disabled={!active}
        value={active?.mapPresentation.symbolSize ?? 44}
        onChange={(value) => update({ symbolSize: value })}
        onCommit={() => active && props.onPresentationCommit(active.id)}
      />
      <div className="hex-value-row">
        <span>{message('hex.editor.curve')}</span>
        <small>{curveHint(active?.mapPresentation.labelCurve ?? 0)}</small>
      </div>
      <HexSlider
        ariaLabel={message('hex.editor.labelCurve')}
        min={-40}
        max={40}
        centerMark
        disabled={!active}
        value={active?.mapPresentation.labelCurve ?? 0}
        onChange={(value) => update({ labelCurve: value })}
        onCommit={() => active && props.onPresentationCommit(active.id)}
      />
      <span className="hex-smallcaps">
        {message('hex.editor.labelPosition')}
      </span>
      <div
        className="hex-wide-segments"
        aria-label={message('hex.editor.labelPosition')}
      >
        {(
          [
            ['above', message('hex.editor.above')],
            ['below', message('hex.editor.below')],
            ['both', message('hex.editor.both')]
          ] as const
        ).map(([value, label]) => (
          <ToolButton
            key={value}
            active={active?.mapPresentation.labelPosition === value}
            onClick={() => {
              update({ labelPosition: value })
              if (active) props.onPresentationCommit(active.id)
            }}
          >
            {label}
          </ToolButton>
        ))}
      </div>
      {props.tile?.location && (
        <button
          className="hex-remove-location"
          onClick={props.onRemoveLocation}
        >
          {message('hex.editor.remove')}
        </button>
      )}
    </div>
  )
}

function curveHint(value: number): string {
  if (value === 0) return message('hex.editor.straight')
  return formatMessage(value > 0 ? 'hex.editor.arc' : 'hex.editor.dip', {
    value: Math.abs(value)
  })
}

function builtinSymbolCount(query: string): number {
  return builtinLocationSymbols.filter((symbol) =>
    symbol.displayName.toLocaleLowerCase('de').includes(query)
  ).length
}
