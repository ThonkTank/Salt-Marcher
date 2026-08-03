import { useEffect, useState, type FormEvent } from 'react'
import type {
  AxialCoordinate,
  HexMapCatalogSnapshot,
  HexMapView,
  HexTerrainCatalog,
  HexTerrainId
} from '../../../shared/contracts/hex.js'
import { capabilityErrorCode } from '../../../shared/errors/capability-error.js'
import { capabilityErrorMessage } from '../../i18n/messages.de.js'
import {
  absorbChunk,
  chunkRevision,
  invalidateHexMap,
  readHexMapView
} from './hex-chunk-cache.js'
import { HexMapCanvas } from './hex-map-canvas.js'
import './hex.css'

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
    const next = await window.saltMarcher.hex.catalog()
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
      window.saltMarcher.hex.catalog(),
      window.saltMarcher.hex.terrainCatalog()
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
      .catch(showError(props.onError))
  }, [props.onError])

  const create = async (event: FormEvent) => {
    event.preventDefault()
    if (!catalog) return
    try {
      const created = await window.saltMarcher.hex.create(
        newName,
        catalog.revision
      )
      await refreshCatalog(created.id)
    } catch (cause) {
      props.onError(errorText(cause))
    }
  }

  const saveMetadata = async () => {
    if (!map) return
    try {
      const next = await window.saltMarcher.hex.updateMetadata(
        map.map.id,
        name,
        map.map.metadataRevision
      )
      await refreshCatalog(next.id)
    } catch (cause) {
      props.onError(errorText(cause))
    }
  }

  const tileClick = async (coordinate: AxialCoordinate) => {
    setSelected(coordinate)
    if (!map || tool !== 'paint') return
    try {
      const chunk = await window.saltMarcher.hex.paint(
        map.map.id,
        coordinate,
        terrainId,
        chunkRevision(map.map.id, coordinate)
      )
      absorbChunk(map.map.id, chunk)
      invalidateHexMap(map.map.id)
      const nextCatalog = await window.saltMarcher.hex.catalog()
      setCatalog(nextCatalog)
      const summary = nextCatalog.maps.find((entry) => entry.id === map.map.id)
      if (summary) setMap(await readHexMapView(summary, map.center, true))
    } catch (cause) {
      props.onError(errorText(cause))
    }
  }

  if (!catalog || !terrains)
    return (
      <section className="workspace-panel">Hex-Editor wird geladen …</section>
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
          <h2>Hex-Karten</h2>
          <input
            aria-label="Neue Karte"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
          />
          <button disabled={!newName.trim()}>Neu</button>
        </form>
        <label>
          Karte
          <select
            value={map?.map.id ?? ''}
            onChange={(event) =>
              void refreshCatalog(event.target.value).catch(
                showError(props.onError)
              )
            }
          >
            <option value="">Keine Karte</option>
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
              Name
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <button onClick={() => void saveMetadata()}>
              Kartendaten speichern
            </button>
            <div className="tool-row">
              <button
                aria-pressed={tool === 'select'}
                onClick={() => setTool('select')}
              >
                Auswahl
              </button>
              <button
                aria-pressed={tool === 'paint'}
                onClick={() => setTool('paint')}
              >
                Terrain malen
              </button>
            </div>
            <label>
              Terrain
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
                      : 'unpassierbar'}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
      </aside>
      <section className="hex-editor-map" aria-label="Kartenansicht">
        {map ? (
          <HexMapCanvas
            snapshot={map}
            terrains={terrains}
            selected={selected}
            onTileClick={(coordinate) => void tileClick(coordinate)}
            onViewportChange={(center) =>
              void readHexMapView(map.map, center)
                .then(setMap)
                .catch(showError(props.onError))
            }
            ariaLabel={`Hex-Editor ${map.map.displayName}`}
          />
        ) : (
          <div className="session-map-empty">Erstelle eine Hex-Karte.</div>
        )}
      </section>
      <aside className="hex-editor-state">
        <h2>Hexfeld</h2>
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
            <p>{tile.location?.displayName ?? 'Kein benannter Ort'}</p>
          </>
        ) : (
          <p>Wähle ein Hexfeld aus.</p>
        )}
      </aside>
    </section>
  )
}

function errorText(cause: unknown): string {
  if (capabilityErrorCode(cause) === 'outcome_unknown')
    window.dispatchEvent(new Event('saltmarcher:readback'))
  return capabilityErrorMessage(cause)
}

function showError(setError: (message: string) => void) {
  return (cause: unknown) => setError(errorText(cause))
}
