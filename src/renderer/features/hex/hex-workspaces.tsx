import { formatMessage, message } from '../../i18n/messages.de.js'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { LiveSessionSnapshot } from '../../../shared/contracts/live-session.js'
import type { WorldLocation } from '../../../shared/contracts/world-location.js'
import type {
  AxialCoordinate,
  HexMapCatalogSnapshot,
  HexMapView,
  HexRouteEvaluation,
  HexBiomeCatalog,
  HexTravelSnapshot
} from '../../../shared/contracts/hex.js'
import { HexMapCanvas } from './hex-map-canvas.js'
import { HexChunkCache, mergeHexBiomeCatalog } from './hex-chunk-cache.js'
import './hex.css'
import { hexCapabilities } from './hex-capabilities.js'
import {
  capabilityErrorText,
  reportCapabilityError
} from '../../capabilities/capability-errors.js'
import { travelSegmentProgress, useTravelClock } from './use-travel-clock.js'
import { ModalDialog } from '../../shell/modal-dialog.js'
import { createHexLocationPlacementController } from './hex-location-placement-controller.js'
import { useCapabilityApi } from '../../capabilities/use-capability-api.js'

export function TravelScenario(props: {
  snapshot: LiveSessionSnapshot
  setSnapshot: (snapshot: LiveSessionSnapshot) => void
  openMap: () => void
  onError: (message: string) => void
}) {
  const api = useCapabilityApi()
  const capabilities = useMemo(() => hexCapabilities(api), [api])
  const focusedSceneId = props.snapshot.scene.focusedSceneId
  const onError = props.onError
  const setSnapshot = props.setSnapshot
  const [travel, setTravel] = useState<HexTravelSnapshot | null>(null)
  const clockNow = useTravelClock(travel)
  const refresh = useCallback(async () => {
    const next = await capabilities.hexTravel.read(focusedSceneId)
    setTravel(next)
    setSnapshot(await capabilities.session.read())
  }, [capabilities, focusedSceneId, setSnapshot])
  useEffect(() => {
    void Promise.resolve().then(refresh).catch(reportCapabilityError(onError))
  }, [onError, refresh])
  useEffect(() => {
    return capabilities.session.onChanged((notice) => {
      if (notice.sceneId !== focusedSceneId) return
      void refresh().catch(reportCapabilityError(onError))
    })
  }, [capabilities, focusedSceneId, onError, refresh])
  const mutate = async (action: 'pause' | 'resume' | 'abort') => {
    if (!travel) return
    try {
      setTravel(
        await capabilities.hexTravel[action](focusedSceneId, travel.revision)
      )
      props.setSnapshot(await capabilities.session.read())
    } catch (cause) {
      props.onError(capabilityErrorText(cause))
    }
  }
  const context = props.snapshot.travel
  return (
    <section className="scenario-content travel-context">
      <p className="section-kicker">{message('ui.reise')}</p>
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
                aria-label={message(
                  'ui.fortschritt.des.aktuellen.reiseabschnitts'
                )}
                max={1}
                value={travelSegmentProgress(
                  travel.segmentStartedAt,
                  travel.segmentEndsAt,
                  clockNow
                )}
              />
            )}
          <dl className="travel-facts">
            <div>
              <dt>{message('ui.status')}</dt>
              <dd>{context.status}</dd>
            </div>
            <div>
              <dt>{message('ui.tempo')}</dt>
              <dd>
                {context.effectiveSpeedFeet} {message('ui.ft.runde')}
              </dd>
            </div>
            <div>
              <dt>{message('ui.rest')}</dt>
              <dd>{formatDuration(context.remainingGameSeconds)}</dd>
            </div>
          </dl>
          {context.assumedSpeedMemberNames.length > 0 && (
            <p className="travel-warning">
              {formatMessage('hex.assumedSpeed', {
                names: context.assumedSpeedMemberNames.join(', ')
              })}
            </p>
          )}
          {travel && (
            <label>
              {message('ui.darstellungstempo')}
              <select
                value={travel.multiplier}
                onChange={(event) =>
                  void capabilities.hexTravel
                    .setMultiplier(
                      focusedSceneId,
                      Number(event.target.value) as 1 | 2 | 5 | 10,
                      travel.revision
                    )
                    .then(setTravel)
                    .catch(reportCapabilityError(props.onError))
                }
              >
                {[1, 2, 5, 10].map((value) => (
                  <option key={value} value={value}>
                    {formatMessage('hex.multiplier', { value })}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="row-actions">
            <button onClick={props.openMap}>
              {message('ui.karte.oeffnen')}
            </button>
            {travel?.status === 'travelling' && (
              <button onClick={() => void mutate('pause')}>
                {message('ui.pause')}
              </button>
            )}
            {(travel?.status === 'paused' || travel?.status === 'blocked') && (
              <button onClick={() => void mutate('resume')}>
                {message('ui.fortsetzen')}
              </button>
            )}
            {travel &&
              ['travelling', 'paused', 'blocked'].includes(travel.status) && (
                <button className="danger" onClick={() => void mutate('abort')}>
                  {message('action.cancel')}
                </button>
              )}
          </div>
        </>
      ) : (
        <>
          <p>{context.hint}</p>
          <button onClick={props.openMap}>{message('ui.karte.oeffnen')}</button>
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
  const api = useCapabilityApi()
  const capabilities = useMemo(() => hexCapabilities(api), [api])
  const chunkCache = useRef(
    new HexChunkCache((mapId, keys) => capabilities.hex.readChunks(mapId, keys))
  )
  const mapRefreshRequest = useRef(0)
  const biomeRefreshRequest = useRef(0)
  const sceneId = props.snapshot.scene.focusedSceneId
  const onError = props.onError
  const setSnapshot = props.setSnapshot
  const [catalog, setCatalog] = useState<HexMapCatalogSnapshot | null>(null)
  const [biomes, setBiomes] = useState<HexBiomeCatalog | null>(null)
  const [map, setMap] = useState<HexMapView | null>(null)
  const [travel, setTravel] = useState<HexTravelSnapshot | null>(null)
  const [selected, setSelected] = useState<AxialCoordinate | null>(null)
  const [mode, setMode] = useState<'inspect' | 'position' | 'plan'>('inspect')
  const [waypoints, setWaypoints] = useState<AxialCoordinate[]>([])
  const [evaluation, setEvaluation] = useState<HexRouteEvaluation | null>(null)
  const applyMap = useCallback((next: HexMapView | null) => {
    setMap(next)
    if (next)
      setBiomes((current) =>
        current ? mergeHexBiomeCatalog(current, next.biomes) : current
      )
  }, [])
  useEffect(() => () => chunkCache.current.clear(), [])

  useEffect(() => {
    void Promise.all([
      capabilities.hex.catalog(),
      capabilities.hex.biomeCatalog(),
      capabilities.hexTravel.read(sceneId)
    ])
      .then(async ([nextCatalog, nextBiomes, nextTravel]) => {
        setCatalog(nextCatalog)
        setBiomes(nextBiomes)
        setTravel(nextTravel)
        const mapId = nextTravel.mapId ?? nextCatalog.maps[0]?.id
        const summary = nextCatalog.maps.find((entry) => entry.id === mapId)
        applyMap(summary ? await chunkCache.current.readMapView(summary) : null)
      })
      .catch(reportCapabilityError(onError))
  }, [applyMap, capabilities, onError, sceneId])

  useEffect(
    () =>
      capabilities.session.onChanged((notice) => {
        if (notice.sceneId !== sceneId) return
        void Promise.all([
          capabilities.hexTravel.read(sceneId),
          capabilities.session.read()
        ])
          .then(([nextTravel, nextSession]) => {
            setTravel(nextTravel)
            setSnapshot(nextSession)
          })
          .catch(reportCapabilityError(onError))
      }),
    [capabilities, onError, sceneId, setSnapshot]
  )

  useEffect(
    () =>
      capabilities.biomes.onChanged(() => {
        const request = ++biomeRefreshRequest.current
        if (map) chunkCache.current.invalidateMap(map.map.id)
        void Promise.all([
          capabilities.hex.biomeCatalog(),
          map ? chunkCache.current.readMapView(map.map, map.center, true) : null
        ])
          .then(([baseline, nextMap]) => {
            if (request !== biomeRefreshRequest.current) return
            setBiomes(
              nextMap
                ? mergeHexBiomeCatalog(baseline, nextMap.biomes)
                : baseline
            )
            if (nextMap) setMap(nextMap)
          })
          .catch(reportCapabilityError(onError))
      }),
    [capabilities.biomes, capabilities.hex, map, onError]
  )

  useEffect(
    () =>
      capabilities.hex.onChanged((notice) => {
        if (!map || !notice.mapIds.includes(map.map.id)) return
        const request = ++mapRefreshRequest.current
        const changedKeys = notice.changedChunks
          .filter((chunk) => chunk.mapId === map.map.id)
          .map((chunk) => chunk.key)
        chunkCache.current.invalidateChunks(map.map.id, changedKeys)
        void capabilities.hex
          .catalog()
          .then(async (nextCatalog) => {
            const summary = nextCatalog.maps.find(
              (candidate) => candidate.id === map.map.id
            )
            if (!summary) return null
            const nextMap = await chunkCache.current.readMapView(
              summary,
              map.center
            )
            return { nextCatalog, nextMap }
          })
          .then((result) => {
            if (!result || request !== mapRefreshRequest.current) return
            setCatalog(result.nextCatalog)
            applyMap(result.nextMap)
          })
          .catch(reportCapabilityError(onError))
      }),
    [applyMap, capabilities.hex, map, onError]
  )

  useEffect(() => {
    if (!map || mode !== 'plan' || waypoints.length === 0) return
    void Promise.resolve()
      .then(() =>
        capabilities.hexTravel.evaluate(sceneId, map.map.id, waypoints)
      )
      .then(setEvaluation)
      .catch(reportCapabilityError(onError))
  }, [capabilities, map, mode, onError, sceneId, waypoints])

  const selectMap = async (mapId: string) => {
    try {
      const summary = catalog?.maps.find((entry) => entry.id === mapId)
      if (!summary) return
      applyMap(await chunkCache.current.readMapView(summary))
      setSelected(null)
      setWaypoints([])
    } catch (cause) {
      props.onError(capabilityErrorText(cause))
    }
  }
  const clickTile = (coordinate: AxialCoordinate) => {
    setSelected(coordinate)
    const authored = map?.tiles.some(
      (tile) => tile.q === coordinate.q && tile.r === coordinate.r
    )
    if (mode === 'plan' && authored) {
      setEvaluation(null)
      setWaypoints((current) => [...current, coordinate])
    }
  }
  const placeParty = async () => {
    if (!map || !selected) return
    try {
      setTravel(
        await capabilities.hexTravel.position(
          sceneId,
          map.map.id,
          selected,
          props.snapshot.scene.revision
        )
      )
      props.setSnapshot(await capabilities.session.read())
      setMode('inspect')
    } catch (cause) {
      props.onError(capabilityErrorText(cause))
    }
  }
  const start = async () => {
    if (!map || !travel || !evaluation?.canStart) return
    try {
      setTravel(
        await capabilities.hexTravel.start(
          sceneId,
          map.map.id,
          waypoints,
          travel.multiplier,
          travel.revision
        )
      )
      props.setSnapshot(await capabilities.session.read())
      setMode('inspect')
      setWaypoints([])
    } catch (cause) {
      props.onError(capabilityErrorText(cause))
    }
  }

  if (!catalog || !biomes)
    return <div className="session-map-empty">{message('hex.loading')}</div>
  if (catalog.maps.length === 0)
    return (
      <div className="session-map-empty">
        <strong>{message('hex.none')}</strong>
        <p>{message('ui.lege.zuerst.im.hex.editor.eine.karte.an')}</p>
      </div>
    )
  if (!map)
    return <div className="session-map-empty">{message('hex.loading')}</div>
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
          aria-label={message('ui.hex.karte')}
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
          {message('ui.auswahl')}
        </button>
        <button
          aria-pressed={mode === 'position'}
          onClick={() => setMode('position')}
        >
          {message('ui.party.platzieren')}
        </button>
        <button
          aria-pressed={mode === 'plan'}
          onClick={() => {
            setMode('plan')
            setWaypoints([])
            setEvaluation(null)
          }}
        >
          {message('ui.reise.planen')}
        </button>
        {mode === 'plan' && (
          <button
            disabled={waypoints.length === 0}
            onClick={() => {
              setEvaluation(null)
              setWaypoints((current) => current.slice(0, -1))
            }}
          >
            {message('ui.letzten.punkt.entfernen')}
          </button>
        )}
      </div>
      <HexMapCanvas
        snapshot={map}
        biomes={biomes}
        selected={selected}
        token={token}
        route={route}
        onTileClick={clickTile}
        onViewportChange={(center) =>
          void chunkCache.current
            .readMapView(map.map, center)
            .then(applyMap)
            .catch(reportCapabilityError(props.onError))
        }
        ariaLabel={formatMessage('hex.canvas.mapLabel', {
          name: map.map.displayName
        })}
      />
      <div className="hex-map-status">
        <span>
          {selectedTile
            ? formatMessage(
                selectedTile.location
                  ? 'hex.status.tileBiomeLocation'
                  : 'hex.status.tileBiome',
                {
                  q: selectedTile.q,
                  r: selectedTile.r,
                  biome:
                    biomes.biomes.find(
                      (biome) => biome.id === selectedTile.biomeId
                    )?.label ?? '',
                  location: selectedTile.location?.displayName ?? ''
                }
              )
            : (travel?.hint ?? message('hex.selectTile'))}
        </span>
        {mode === 'position' && (
          <button disabled={!selectedTile} onClick={() => void placeParty()}>
            {message('ui.party.hier.platzieren')}
          </button>
        )}
        {mode === 'plan' && (
          <>
            <span>{evaluation?.message ?? message('hex.chooseWaypoints')}</span>
            {evaluation && (
              <span>{formatDuration(evaluation.totalGameSeconds)}</span>
            )}
            <button
              disabled={!evaluation?.canStart}
              onClick={() => void start()}
            >
              {message('ui.reise.starten')}
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
  const api = useCapabilityApi()
  const capabilities = useMemo(() => hexCapabilities(api), [api])
  const chunkCache = useRef(
    new HexChunkCache((mapId, keys) => capabilities.hex.readChunks(mapId, keys))
  )
  const placementController = useRef(
    createHexLocationPlacementController(capabilities.hex)
  )
  const mapRefreshRequest = useRef(0)
  const biomeRefreshRequest = useRef(0)
  const onError = props.onError
  const [catalog, setCatalog] = useState<HexMapCatalogSnapshot | null>(null)
  const [biomes, setBiomes] = useState<HexBiomeCatalog | null>(null)
  const [map, setMap] = useState<HexMapView | null>(null)
  const [selected, setSelected] = useState<AxialCoordinate | null>(null)
  const [existing, setExisting] = useState<{
    mapId: string
    contentRevision: number
  } | null>(null)
  const applyMap = useCallback((next: HexMapView | null) => {
    setMap(next)
    if (next)
      setBiomes((current) =>
        current ? mergeHexBiomeCatalog(current, next.biomes) : current
      )
  }, [])
  useEffect(() => () => chunkCache.current.clear(), [])
  useEffect(() => {
    void Promise.all([
      capabilities.hex.catalog(),
      capabilities.hex.biomeCatalog(),
      capabilities.hex.locateLocation(props.location.id)
    ])
      .then(async ([nextCatalog, nextBiomes, placement]) => {
        setCatalog(nextCatalog)
        setBiomes(nextBiomes)
        const summary = placement
          ? nextCatalog.maps.find((entry) => entry.id === placement.mapId)
          : nextCatalog.maps[0]
        const initial = summary
          ? await chunkCache.current.readMapView(summary, placement?.coordinate)
          : null
        applyMap(initial)
        if (placement) {
          setSelected(placement.coordinate)
          setExisting({
            mapId: placement.mapId,
            contentRevision: placement.contentRevision
          })
        }
      })
      .catch(reportCapabilityError(onError))
  }, [applyMap, capabilities, onError, props.location.id])
  useEffect(
    () =>
      capabilities.biomes.onChanged(() => {
        const request = ++biomeRefreshRequest.current
        if (map) chunkCache.current.invalidateMap(map.map.id)
        void Promise.all([
          capabilities.hex.biomeCatalog(),
          map ? chunkCache.current.readMapView(map.map, map.center, true) : null
        ])
          .then(([baseline, nextMap]) => {
            if (request !== biomeRefreshRequest.current) return
            setBiomes(
              nextMap
                ? mergeHexBiomeCatalog(baseline, nextMap.biomes)
                : baseline
            )
            if (nextMap) setMap(nextMap)
          })
          .catch(reportCapabilityError(onError))
      }),
    [capabilities.biomes, capabilities.hex, map, onError]
  )
  useEffect(
    () =>
      capabilities.hex.onChanged((notice) => {
        if (!map || !notice.mapIds.includes(map.map.id)) return
        const request = ++mapRefreshRequest.current
        chunkCache.current.invalidateChunks(
          map.map.id,
          notice.changedChunks
            .filter((chunk) => chunk.mapId === map.map.id)
            .map((chunk) => chunk.key)
        )
        void Promise.all([
          capabilities.hex.catalog(),
          capabilities.hex.locateLocation(props.location.id)
        ])
          .then(async ([nextCatalog, placement]) => {
            const mapId = placement?.mapId ?? map.map.id
            const summary = nextCatalog.maps.find(
              (candidate) => candidate.id === mapId
            )
            if (!summary) return null
            const nextMap = await chunkCache.current.readMapView(
              summary,
              placement?.coordinate ?? map.center
            )
            return { nextCatalog, nextMap, placement }
          })
          .then((result) => {
            if (!result || request !== mapRefreshRequest.current) return
            setCatalog(result.nextCatalog)
            applyMap(result.nextMap)
            setExisting(
              result.placement
                ? {
                    mapId: result.placement.mapId,
                    contentRevision: result.placement.contentRevision
                  }
                : null
            )
            if (result.placement) setSelected(result.placement.coordinate)
          })
          .catch(reportCapabilityError(onError))
      }),
    [applyMap, capabilities.hex, map, onError, props.location.id]
  )
  const changeMap = async (mapId: string) => {
    const summary = catalog?.maps.find((entry) => entry.id === mapId)
    if (summary) applyMap(await chunkCache.current.readMapView(summary))
    setSelected(null)
  }
  const place = async () => {
    if (!map || !selected) return
    const commandId = crypto.randomUUID()
    try {
      await placementController.current.place({
        commandId,
        mapId: map.map.id,
        locationId: props.location.id,
        coordinate: selected,
        expectedContentRevision: map.map.contentRevision
      })
      props.onPlaced()
      props.close()
    } catch (cause) {
      props.onError(capabilityErrorText(cause))
    }
  }
  const remove = async () => {
    if (!existing) return
    const commandId = crypto.randomUUID()
    try {
      await placementController.current.remove({
        commandId,
        mapId: existing.mapId,
        locationId: props.location.id,
        expectedContentRevision: existing.contentRevision
      })
      props.onPlaced()
      props.close()
    } catch (cause) {
      props.onError(capabilityErrorText(cause))
    }
  }
  return (
    <ModalDialog
      className="hex-placement-dialog"
      ariaLabel={message('ui.ort.auf.hex.karte.platzieren')}
      onClose={props.close}
    >
      <header>
        <div>
          <p className="section-kicker">{message('ui.ort.platzieren')}</p>
          <h2>{props.location.displayName}</h2>
        </div>
        <button aria-label={message('action.close')} onClick={props.close}>
          ×
        </button>
      </header>
      {!catalog || !biomes ? (
        <p>{message('ui.karten.werden.geladen')}</p>
      ) : catalog.maps.length === 0 ? (
        <p>{message('ui.lege.zuerst.eine.hex.karte.an')}</p>
      ) : map ? (
        <>
          <select
            aria-label={message('ui.zielkarte')}
            value={map.map.id}
            onChange={(event) =>
              void changeMap(event.target.value).catch(
                reportCapabilityError(props.onError)
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
            biomes={biomes}
            selected={selected}
            onTileClick={setSelected}
            onViewportChange={(center) =>
              void chunkCache.current
                .readMapView(map.map, center)
                .then(applyMap)
                .catch(reportCapabilityError(props.onError))
            }
            ariaLabel={formatMessage('hex.canvas.placementLabel', {
              name: props.location.displayName
            })}
          />
          <footer>
            <button onClick={props.close}>{message('action.cancel')}</button>
            {existing && (
              <button className="danger" onClick={() => void remove()}>
                {message('ui.von.karte.entfernen')}
              </button>
            )}
            <button
              disabled={
                !selected ||
                !map.tiles.some(
                  (tile) => tile.q === selected.q && tile.r === selected.r
                )
              }
              onClick={() => void place()}
            >
              {message('ui.hier.platzieren')}
            </button>
          </footer>
        </>
      ) : null}
    </ModalDialog>
  )
}

function formatDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  return formatMessage('hex.duration', { hours, minutes })
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
  return formatMessage('hex.gameTime', { day, hours, minutes })
}
