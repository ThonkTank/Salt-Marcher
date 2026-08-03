import { useCallback, useEffect, useState } from 'react'
import type { LiveSessionSnapshot } from '../../../shared/contracts/live-session.js'
import type { WorldLocation } from '../../../shared/contracts/world-location.js'
import type {
  AxialCoordinate,
  HexMapCatalogSnapshot,
  HexMapView,
  HexRouteEvaluation,
  HexTerrainCatalog,
  HexTravelSnapshot
} from '../../../shared/contracts/hex.js'
import { HexMapCanvas } from './hex-map-canvas.js'
import { readHexMapView } from './hex-chunk-cache.js'
import { capabilityErrorMessage } from '../../i18n/messages.de.js'
import { capabilityErrorCode } from '../../../shared/errors/capability-error.js'
import './hex.css'

export function TravelScenario(props: {
  snapshot: LiveSessionSnapshot
  setSnapshot: (snapshot: LiveSessionSnapshot) => void
  openMap: () => void
  onError: (message: string) => void
}) {
  const focusedSceneId = props.snapshot.scene.focusedSceneId
  const onError = props.onError
  const setSnapshot = props.setSnapshot
  const [travel, setTravel] = useState<HexTravelSnapshot | null>(null)
  const [clockNow, setClockNow] = useState(0)
  const refresh = useCallback(async () => {
    const next = await window.saltMarcher.hexTravel.read(focusedSceneId)
    setTravel(next)
    setSnapshot(await window.saltMarcher.session.read())
  }, [focusedSceneId, setSnapshot])
  useEffect(() => {
    void Promise.resolve().then(refresh).catch(showError(onError))
  }, [onError, refresh])
  useEffect(() => {
    if (
      travel?.status !== 'travelling' ||
      travel.segmentStartedAt === null ||
      travel.segmentEndsAt === null
    )
      return
    const timer = window.setInterval(() => setClockNow(Date.now()), 250)
    return () => window.clearInterval(timer)
  }, [travel?.segmentEndsAt, travel?.segmentStartedAt, travel?.status])
  useEffect(() => {
    return window.saltMarcher.session.onChanged((notice) => {
      if (notice.sceneId !== focusedSceneId) return
      void refresh().catch(showError(onError))
    })
  }, [focusedSceneId, onError, refresh])
  const mutate = async (action: 'pause' | 'resume' | 'abort') => {
    if (!travel) return
    try {
      setTravel(
        await window.saltMarcher.hexTravel[action](
          focusedSceneId,
          travel.revision
        )
      )
      props.setSnapshot(await window.saltMarcher.session.read())
    } catch (cause) {
      props.onError(errorText(cause))
    }
  }
  const context = props.snapshot.travel
  return (
    <section className="scenario-content travel-context">
      <p className="section-kicker">Reise</p>
      <h2>
        {context.kind === 'hex'
          ? context.locationName || context.currentLabel
          : context.label}
      </h2>
      {context.kind === 'hex' ? (
        <>
          <p>
            {context.mapName} · {formatGameTime(context.gameTimeSeconds)}
          </p>
          <p>{context.hint}</p>
          {travel &&
            travel.segmentStartedAt !== null &&
            travel.segmentEndsAt !== null && (
              <progress
                aria-label="Fortschritt des aktuellen Reiseabschnitts"
                max={1}
                value={Math.max(
                  0,
                  Math.min(
                    1,
                    (clockNow - travel.segmentStartedAt) /
                      Math.max(
                        1,
                        travel.segmentEndsAt - travel.segmentStartedAt
                      )
                  )
                )}
              />
            )}
          <dl className="travel-facts">
            <div>
              <dt>Status</dt>
              <dd>{context.status}</dd>
            </div>
            <div>
              <dt>Tempo</dt>
              <dd>{context.effectiveSpeedFeet} ft/Runde</dd>
            </div>
            <div>
              <dt>Rest</dt>
              <dd>{formatDuration(context.remainingGameSeconds)}</dd>
            </div>
          </dl>
          {context.assumedSpeedMemberNames.length > 0 && (
            <p className="travel-warning">
              30 ft angenommen für {context.assumedSpeedMemberNames.join(', ')}.
            </p>
          )}
          {travel && (
            <label>
              Darstellungstempo
              <select
                value={travel.multiplier}
                onChange={(event) =>
                  void window.saltMarcher.hexTravel
                    .setMultiplier(
                      focusedSceneId,
                      Number(event.target.value) as 1 | 2 | 5 | 10,
                      travel.revision
                    )
                    .then(setTravel)
                    .catch(showError(props.onError))
                }
              >
                {[1, 2, 5, 10].map((value) => (
                  <option key={value} value={value}>
                    {value}×
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="row-actions">
            <button onClick={props.openMap}>Karte öffnen</button>
            {travel?.status === 'travelling' && (
              <button onClick={() => void mutate('pause')}>Pause</button>
            )}
            {(travel?.status === 'paused' || travel?.status === 'blocked') && (
              <button onClick={() => void mutate('resume')}>Fortsetzen</button>
            )}
            {travel &&
              ['travelling', 'paused', 'blocked'].includes(travel.status) && (
                <button className="danger" onClick={() => void mutate('abort')}>
                  Abbrechen
                </button>
              )}
          </div>
        </>
      ) : (
        <>
          <p>{context.hint}</p>
          <button onClick={props.openMap}>Karte öffnen</button>
        </>
      )}
    </section>
  )
}

export function SessionHexMap(props: {
  snapshot: LiveSessionSnapshot
  setSnapshot: (snapshot: LiveSessionSnapshot) => void
  onError: (message: string) => void
}) {
  const sceneId = props.snapshot.scene.focusedSceneId
  const onError = props.onError
  const setSnapshot = props.setSnapshot
  const [catalog, setCatalog] = useState<HexMapCatalogSnapshot | null>(null)
  const [terrains, setTerrains] = useState<HexTerrainCatalog | null>(null)
  const [map, setMap] = useState<HexMapView | null>(null)
  const [travel, setTravel] = useState<HexTravelSnapshot | null>(null)
  const [selected, setSelected] = useState<AxialCoordinate | null>(null)
  const [mode, setMode] = useState<'inspect' | 'position' | 'plan'>('inspect')
  const [waypoints, setWaypoints] = useState<AxialCoordinate[]>([])
  const [evaluation, setEvaluation] = useState<HexRouteEvaluation | null>(null)

  useEffect(() => {
    void Promise.all([
      window.saltMarcher.hex.catalog(),
      window.saltMarcher.hex.terrainCatalog(),
      window.saltMarcher.hexTravel.read(sceneId)
    ])
      .then(async ([nextCatalog, nextTerrains, nextTravel]) => {
        setCatalog(nextCatalog)
        setTerrains(nextTerrains)
        setTravel(nextTravel)
        const mapId = nextTravel.mapId ?? nextCatalog.maps[0]?.id
        const summary = nextCatalog.maps.find((entry) => entry.id === mapId)
        setMap(summary ? await readHexMapView(summary) : null)
      })
      .catch(showError(onError))
  }, [onError, sceneId])

  useEffect(
    () =>
      window.saltMarcher.session.onChanged((notice) => {
        if (notice.sceneId !== sceneId) return
        void Promise.all([
          window.saltMarcher.hexTravel.read(sceneId),
          window.saltMarcher.session.read()
        ])
          .then(([nextTravel, nextSession]) => {
            setTravel(nextTravel)
            setSnapshot(nextSession)
          })
          .catch(showError(onError))
      }),
    [onError, sceneId, setSnapshot]
  )

  useEffect(() => {
    if (!map || mode !== 'plan' || waypoints.length === 0) return
    void Promise.resolve()
      .then(() =>
        window.saltMarcher.hexTravel.evaluate(sceneId, map.map.id, waypoints)
      )
      .then(setEvaluation)
      .catch(showError(onError))
  }, [map, mode, onError, sceneId, waypoints])

  const selectMap = async (mapId: string) => {
    try {
      const summary = catalog?.maps.find((entry) => entry.id === mapId)
      if (!summary) return
      setMap(await readHexMapView(summary))
      setSelected(null)
      setWaypoints([])
    } catch (cause) {
      props.onError(errorText(cause))
    }
  }
  const clickTile = (coordinate: AxialCoordinate) => {
    setSelected(coordinate)
    if (mode === 'plan') {
      setEvaluation(null)
      setWaypoints((current) => [...current, coordinate])
    }
  }
  const placeParty = async () => {
    if (!map || !selected) return
    try {
      setTravel(
        await window.saltMarcher.hexTravel.position(
          sceneId,
          map.map.id,
          selected,
          props.snapshot.scene.revision
        )
      )
      props.setSnapshot(await window.saltMarcher.session.read())
      setMode('inspect')
    } catch (cause) {
      props.onError(errorText(cause))
    }
  }
  const start = async () => {
    if (!map || !travel || !evaluation?.canStart) return
    try {
      setTravel(
        await window.saltMarcher.hexTravel.start(
          sceneId,
          map.map.id,
          waypoints,
          travel.multiplier,
          travel.revision
        )
      )
      props.setSnapshot(await window.saltMarcher.session.read())
      setMode('inspect')
      setWaypoints([])
    } catch (cause) {
      props.onError(errorText(cause))
    }
  }

  if (!catalog || !terrains)
    return <div className="session-map-empty">Karte wird geladen …</div>
  if (catalog.maps.length === 0)
    return (
      <div className="session-map-empty">
        <strong>Keine Hex-Karte</strong>
        <p>Lege zuerst im Hex-Editor eine Karte an.</p>
      </div>
    )
  if (!map) return <div className="session-map-empty">Karte wird geladen …</div>
  const token = travel?.mapId === map.map.id ? travel.current : null
  const route =
    evaluation?.path ?? (travel?.mapId === map.map.id ? travel.path : [])
  const selectedTile = selected
    ? map.tiles.find((tile) => tile.q === selected.q && tile.r === selected.r)
    : null
  return (
    <div className="session-hex-map">
      <div className="hex-map-toolbar">
        <select
          aria-label="Hex-Karte"
          value={map.map.id}
          onChange={(event) => void selectMap(event.target.value)}
        >
          {catalog.maps.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.displayName}
            </option>
          ))}
        </select>
        <button
          aria-pressed={mode === 'inspect'}
          onClick={() => setMode('inspect')}
        >
          Auswahl
        </button>
        <button
          aria-pressed={mode === 'position'}
          onClick={() => setMode('position')}
        >
          Party platzieren
        </button>
        <button
          aria-pressed={mode === 'plan'}
          onClick={() => {
            setMode('plan')
            setWaypoints([])
            setEvaluation(null)
          }}
        >
          Reise planen
        </button>
        {mode === 'plan' && (
          <button
            disabled={waypoints.length === 0}
            onClick={() => {
              setEvaluation(null)
              setWaypoints((current) => current.slice(0, -1))
            }}
          >
            Letzten Punkt entfernen
          </button>
        )}
      </div>
      <HexMapCanvas
        snapshot={map}
        terrains={terrains}
        selected={selected}
        token={token}
        route={route}
        onTileClick={clickTile}
        onViewportChange={(center) =>
          void readHexMapView(map.map, center)
            .then(setMap)
            .catch(showError(props.onError))
        }
        ariaLabel={`Hex-Karte ${map.map.displayName}`}
      />
      <div className="hex-map-status">
        <span>
          {selectedTile
            ? `${selectedTile.label} · ${terrains.terrains.find((terrain) => terrain.id === selectedTile.terrainId)?.label}${selectedTile.location ? ` · ${selectedTile.location.displayName}` : ''}`
            : (travel?.hint ?? 'Hexfeld auswählen.')}
        </span>
        {mode === 'position' && (
          <button disabled={!selected} onClick={() => void placeParty()}>
            Party hier platzieren
          </button>
        )}
        {mode === 'plan' && (
          <>
            <span>
              {evaluation?.message ?? 'Wegpunkte auf der Karte wählen.'}
            </span>
            {evaluation && (
              <span>{formatDuration(evaluation.totalGameSeconds)}</span>
            )}
            <button
              disabled={!evaluation?.canStart}
              onClick={() => void start()}
            >
              Reise starten
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export function HexLocationPlacementDialog(props: {
  location: WorldLocation
  close: () => void
  onPlaced: () => void
  onError: (message: string) => void
}) {
  const onError = props.onError
  const [catalog, setCatalog] = useState<HexMapCatalogSnapshot | null>(null)
  const [terrains, setTerrains] = useState<HexTerrainCatalog | null>(null)
  const [map, setMap] = useState<HexMapView | null>(null)
  const [selected, setSelected] = useState<AxialCoordinate | null>(null)
  const [existing, setExisting] = useState<{
    mapId: string
    contentRevision: number
  } | null>(null)
  useEffect(() => {
    void Promise.all([
      window.saltMarcher.hex.catalog(),
      window.saltMarcher.hex.terrainCatalog(),
      window.saltMarcher.hex.locateLocation(props.location.id)
    ])
      .then(async ([nextCatalog, nextTerrains, placement]) => {
        setCatalog(nextCatalog)
        setTerrains(nextTerrains)
        const summary = placement
          ? nextCatalog.maps.find((entry) => entry.id === placement.mapId)
          : nextCatalog.maps[0]
        const initial = summary
          ? await readHexMapView(summary, placement?.coordinate)
          : null
        setMap(initial)
        if (placement) {
          setSelected(placement.coordinate)
          setExisting({
            mapId: placement.mapId,
            contentRevision: placement.contentRevision
          })
        }
      })
      .catch(showError(onError))
  }, [onError, props.location.id])
  const changeMap = async (mapId: string) => {
    const summary = catalog?.maps.find((entry) => entry.id === mapId)
    if (summary) setMap(await readHexMapView(summary))
    setSelected(null)
  }
  const place = async () => {
    if (!map || !selected) return
    try {
      await window.saltMarcher.hex.placeLocation(
        map.map.id,
        props.location.id,
        selected,
        map.map.contentRevision
      )
      props.onPlaced()
      props.close()
    } catch (cause) {
      props.onError(errorText(cause))
    }
  }
  const remove = async () => {
    if (!existing) return
    try {
      await window.saltMarcher.hex.removeLocation(
        existing.mapId,
        props.location.id,
        existing.contentRevision
      )
      props.onPlaced()
      props.close()
    } catch (cause) {
      props.onError(errorText(cause))
    }
  }
  return (
    <div className="modal-backdrop" role="presentation">
      <section
        className="hex-placement-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Ort auf Hex-Karte platzieren"
      >
        <header>
          <div>
            <p className="section-kicker">Ort platzieren</p>
            <h2>{props.location.displayName}</h2>
          </div>
          <button aria-label="Schließen" onClick={props.close}>
            ×
          </button>
        </header>
        {!catalog || !terrains ? (
          <p>Karten werden geladen …</p>
        ) : catalog.maps.length === 0 ? (
          <p>Lege zuerst eine Hex-Karte an.</p>
        ) : map ? (
          <>
            <select
              aria-label="Zielkarte"
              value={map.map.id}
              onChange={(event) =>
                void changeMap(event.target.value).catch(
                  showError(props.onError)
                )
              }
            >
              {catalog.maps.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.displayName}
                </option>
              ))}
            </select>
            <HexMapCanvas
              snapshot={map}
              terrains={terrains}
              selected={selected}
              onTileClick={setSelected}
              onViewportChange={(center) =>
                void readHexMapView(map.map, center)
                  .then(setMap)
                  .catch(showError(props.onError))
              }
              ariaLabel={`Platzierung von ${props.location.displayName}`}
            />
            <footer>
              <button onClick={props.close}>Abbrechen</button>
              {existing && (
                <button className="danger" onClick={() => void remove()}>
                  Von Karte entfernen
                </button>
              )}
              <button disabled={!selected} onClick={() => void place()}>
                Hier platzieren
              </button>
            </footer>
          </>
        ) : null}
      </section>
    </div>
  )
}

function formatDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  return `${hours} Std. ${minutes} Min.`
}

function formatGameTime(totalSeconds: number) {
  const day = Math.floor(totalSeconds / 86400) + 1
  const inDay = totalSeconds % 86400
  const hours = Math.floor(inDay / 3600)
    .toString()
    .padStart(2, '0')
  const minutes = Math.floor((inDay % 3600) / 60)
    .toString()
    .padStart(2, '0')
  return `Tag ${day}, ${hours}:${minutes}`
}
function errorText(cause: unknown): string {
  if (capabilityErrorCode(cause) === 'outcome_unknown')
    window.dispatchEvent(new Event('saltmarcher:readback'))
  return capabilityErrorMessage(cause)
}

function showError(setError: (message: string) => void) {
  return (cause: unknown) => setError(errorText(cause))
}
