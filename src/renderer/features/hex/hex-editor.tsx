import { message } from '../../i18n/messages.de.js'
import { useEffect, useState, type FormEvent } from 'react'
import type {
  AxialCoordinate,
  HexMapCatalogSnapshot,
  HexMapView,
  HexTerrainCatalog,
  HexTerrainId
} from '../../../shared/contracts/hex.js'
import {
  absorbChunk,
  chunkRevision,
  invalidateHexMap,
  readHexMapView
} from './hex-chunk-cache.js'
import { HexMapCanvas } from './hex-map-canvas.js'
import './hex.css'
import { hexCapabilities } from './hex-capabilities.js'
import {
  capabilityErrorText,
  reportCapabilityError
} from '../../capabilities/capability-errors.js'

export default function HexEditor(props: {
  onError: (message: string) => void
}) {
  const [catalog, setCatalog] = useState<HexMapCatalogSnapshot | null>(null)
  const [terrains, setTerrains] = useState<HexTerrainCatalog | null>(null)
  const [map, setMap] = useState<HexMapView | null>(null)
  const [selected, setSelected] = useState<AxialCoordinate | null>(null)
  const [tool, setTool] = useState<'select' | 'paint'>('select')
  const [terrainId, setTerrainId] = useState<HexTerrainId>('grassland')
  const [newName, setNewName] = useState('Neue Hex-Karte')
  const [name, setName] = useState('')

  const refreshCatalog = async (preferred?: string) => {
    const next = await hexCapabilities().hex.catalog()
    setCatalog(next)
    const mapId = preferred ?? map?.map.id ?? next.maps[0]?.id
    const summary = next.maps.find((entry) => entry.id === mapId)
    if (!summary) {
      setMap(null)
      return
    }
    const nextMap = await readHexMapView(summary)
    setMap(nextMap)
    setName(nextMap.map.displayName)
  }

  useEffect(() => {
    void Promise.all([
      hexCapabilities().hex.catalog(),
      hexCapabilities().hex.terrainCatalog()
    ])
      .then(async ([nextCatalog, nextTerrains]) => {
        setCatalog(nextCatalog)
        setTerrains(nextTerrains)
        const first = nextCatalog.maps[0]
        if (first) {
          const nextMap = await readHexMapView(first)
          setMap(nextMap)
          setName(nextMap.map.displayName)
        }
      })
      .catch(reportCapabilityError(props.onError))
  }, [props.onError])

  const create = async (event: FormEvent) => {
    event.preventDefault()
    if (!catalog) return
    try {
      const created = await hexCapabilities().hex.create(
        newName,
        catalog.revision
      )
      await refreshCatalog(created.id)
    } catch (cause) {
      props.onError(capabilityErrorText(cause))
    }
  }

  const saveMetadata = async () => {
    if (!map) return
    try {
      const next = await hexCapabilities().hex.updateMetadata(
        map.map.id,
        name,
        map.map.metadataRevision
      )
      await refreshCatalog(next.id)
    } catch (cause) {
      props.onError(capabilityErrorText(cause))
    }
  }

  const tileClick = async (coordinate: AxialCoordinate) => {
    setSelected(coordinate)
    if (!map || tool !== 'paint') return
    try {
      const chunk = await hexCapabilities().hex.paint(
        map.map.id,
        coordinate,
        terrainId,
        chunkRevision(map.map.id, coordinate)
      )
      absorbChunk(map.map.id, chunk)
      invalidateHexMap(map.map.id)
      const nextCatalog = await hexCapabilities().hex.catalog()
      setCatalog(nextCatalog)
      const summary = nextCatalog.maps.find((entry) => entry.id === map.map.id)
      if (summary) setMap(await readHexMapView(summary, map.center, true))
    } catch (cause) {
      props.onError(capabilityErrorText(cause))
    }
  }

  if (!catalog || !terrains)
    return (
      <section className="workspace-panel">
        {message('ui.hex.editor.wird.geladen')}
      </section>
    )
  const tile =
    selected && map
      ? map.tiles.find(
          (candidate) =>
            candidate.q === selected.q && candidate.r === selected.r
        )
      : null
  return (
    <section className="hex-editor-workspace">
      <aside className="hex-editor-controls">
        <form onSubmit={(event) => void create(event)}>
          <h2>{message('ui.hex.karten')}</h2>
          <input
            aria-label={message('ui.neue.karte')}
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
          />
          <button disabled={!newName.trim()}>{message('ui.neu')}</button>
        </form>
        <label>
          {message('ui.karte')}
          <select
            value={map?.map.id ?? ''}
            onChange={(event) =>
              void refreshCatalog(event.target.value).catch(
                reportCapabilityError(props.onError)
              )
            }
          >
            <option value="">{message('ui.keine.karte')}</option>
            {catalog.maps.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.displayName}
              </option>
            ))}
          </select>
        </label>
        {map && (
          <>
            <label>
              {message('ui.name')}
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <button onClick={() => void saveMetadata()}>
              {message('ui.kartendaten.speichern')}
            </button>
            <div className="tool-row">
              <button
                aria-pressed={tool === 'select'}
                onClick={() => setTool('select')}
              >
                {message('ui.auswahl')}
              </button>
              <button
                aria-pressed={tool === 'paint'}
                onClick={() => setTool('paint')}
              >
                {message('ui.terrain.malen')}
              </button>
            </div>
            <label>
              {message('ui.terrain')}
              <select
                value={terrainId}
                onChange={(event) =>
                  setTerrainId(event.target.value as HexTerrainId)
                }
              >
                {terrains.terrains.map((terrain) => (
                  <option key={terrain.id} value={terrain.id}>
                    {terrain.label} ·{' '}
                    {terrain.passable
                      ? `${terrain.travelCost}×`
                      : message('hex.impassable')}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
      </aside>
      <section
        className="hex-editor-map"
        aria-label={message('ui.kartenansicht')}
      >
        {map ? (
          <HexMapCanvas
            snapshot={map}
            terrains={terrains}
            selected={selected}
            onTileClick={(coordinate) => void tileClick(coordinate)}
            onViewportChange={(center) =>
              void readHexMapView(map.map, center)
                .then(setMap)
                .catch(reportCapabilityError(props.onError))
            }
            ariaLabel={`Hex-Editor ${map.map.displayName}`}
          />
        ) : (
          <div className="session-map-empty">
            {message('ui.erstelle.eine.hex.karte')}
          </div>
        )}
      </section>
      <aside className="hex-editor-state">
        <h2>{message('ui.hexfeld')}</h2>
        {tile ? (
          <>
            <strong>{tile.label}</strong>
            <p>
              {
                terrains.terrains.find(
                  (terrain) => terrain.id === tile.terrainId
                )?.label
              }
            </p>
            <p>
              {tile.location?.displayName ?? message('hex.noNamedLocation')}
            </p>
          </>
        ) : (
          <p>{message('ui.waehle.ein.hexfeld.aus')}</p>
        )}
      </aside>
    </section>
  )
}
