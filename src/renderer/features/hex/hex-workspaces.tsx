import { formatMessage, message } from '../../i18n/hex-runtime.de.js'
import { useMemo } from 'react'
import { HexMapCanvas } from './hex-map-canvas.js'
import './hex-travel.css'
import type {
  HexRouteEvaluation,
  HexTravelSnapshot
} from '../../../shared/contracts/hex.js'
import type { HexTravelController } from './hex-travel-provider-port.js'
import { mergeHexBiomeCatalog } from './hex-chunk-cache.js'

const multipliers = [1, 2, 5, 10] as const
const activeTravelStatuses = new Set(['travelling', 'paused', 'blocked'])

export function TravelScenario(props: {
  openMap: () => void
  mapActive: boolean
  controller: HexTravelController
}) {
  const state = useHexTravelViewModel(props.controller)
  if (props.controller.state.lifecycle === 'error')
    return (
      <section className="travel-console" aria-label={message('ui.reise')}>
        <p className="travel-route-message" role="alert">
          {props.controller.state.error}
        </p>
      </section>
    )
  const selectedTile = state.selected
    ? (state.map?.tiles.find(
        (tile) => tile.q === state.selected!.q && tile.r === state.selected!.r
      ) ?? null)
    : null
  const selectedBiome = selectedTile
    ? (state.biomes?.biomes.find(
        (biome) => biome.id === selectedTile.biomeId
      ) ?? null)
    : null
  const pauseOrResume =
    state.travel?.status === 'paused' || state.travel?.status === 'blocked'
  const travelActive = activeTravelStatuses.has(state.travel?.status ?? '')
  const mutationsEnabled = props.controller.state.lifecycle === 'ready'
  const multiplierIndex = multipliers.indexOf(state.multiplier)
  const currentLocation =
    state.travel?.locationName ||
    state.travel?.currentLabel ||
    message('ui.kein.ort.gesetzt')
  const currentHex = state.selected
    ? selectedTile && selectedBiome
      ? formatMessage('hex.status.tileBiomeCost', {
          q: state.selected.q,
          r: state.selected.r,
          biome: selectedBiome.label,
          cost: formatNumber(selectedBiome.travelCost)
        })
      : formatMessage('hex.status.emptyTile', {
          q: state.selected.q,
          r: state.selected.r
        })
    : message('hex.status.noSelection')
  const evaluation = state.evaluation
  const routeValues =
    evaluation?.status === 'ready'
      ? {
          duration: formatShortDuration(evaluation.totalGameSeconds),
          hexes: Math.max(0, evaluation.path.length - 1).toString(),
          cost: formatMessage('hex.costPoints', {
            value: formatNumber(evaluation.totalTravelCost)
          })
        }
      : { duration: '—', hexes: '—', cost: '—' }

  const activateMapMode = (action: () => void) => {
    action()
    if (!props.mapActive) props.openMap()
  }

  return (
    <section className="travel-console" aria-label={message('ui.reise')}>
      <div className="travel-console-head">
        <select
          aria-label={message('ui.hex.karte')}
          value={state.map?.map.id ?? ''}
          disabled={!state.catalog || state.catalog.maps.length === 0}
          onChange={(event) => void state.selectMap(event.target.value)}
        >
          {!state.catalog ? (
            <option value="">{message('hex.loading')}</option>
          ) : state.catalog.maps.length === 0 ? (
            <option value="">{message('hex.none')}</option>
          ) : (
            state.catalog.maps.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.displayName}
              </option>
            ))
          )}
        </select>

        <div className="travel-current-location">
          <p>{message('ui.aktuelle.location')}</p>
          <strong>{currentLocation}</strong>
        </div>

        {!props.mapActive && (
          <button className="travel-open-map" onClick={props.openMap}>
            {message('ui.karte.oeffnen')}
          </button>
        )}

        <div className="travel-route-actions">
          <button
            className="primary-action"
            aria-pressed={state.mode === 'plan'}
            disabled={!state.map}
            onClick={() => activateMapMode(state.togglePlanning)}
          >
            {message('ui.route.planen')}
          </button>
          <button
            disabled={state.waypoints.length === 0 && !state.evaluation}
            onClick={state.clearRoute}
          >
            {message('ui.loeschen')}
          </button>
          <button
            className="travel-icon-button travel-position-button"
            aria-label={message('ui.party.platzieren')}
            aria-pressed={state.mode === 'position'}
            disabled={!state.map || !mutationsEnabled}
            onClick={() => activateMapMode(state.togglePositioning)}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="8" />
              <circle className="travel-party-center" cx="12" cy="12" r="3" />
            </svg>
          </button>
        </div>

        <div
          className="travel-transport"
          role="group"
          aria-label={message('ui.reisesteuerung')}
        >
          <TravelIconButton
            kind="play"
            label={message('ui.reise.starten')}
            primary
            disabled={!mutationsEnabled || state.evaluation?.status !== 'ready'}
            onClick={() => void state.start()}
          />
          <TravelIconButton
            kind={pauseOrResume ? 'play' : 'pause'}
            label={
              pauseOrResume ? message('ui.fortsetzen') : message('ui.pause')
            }
            disabled={!mutationsEnabled || !travelActive}
            onClick={() => void state.pauseOrResume()}
          />
          <TravelIconButton
            kind="stop"
            label={message('ui.stopp')}
            disabled={!mutationsEnabled || !travelActive}
            onClick={() => void state.abort()}
          />
          <span className="travel-transport-separator" aria-hidden="true" />
          <TravelIconButton
            kind="slower"
            label={message('ui.langsamer')}
            disabled={!mutationsEnabled || multiplierIndex <= 0}
            onClick={() => void state.stepMultiplier(-1)}
          />
          <span className="travel-multiplier">
            {formatMessage('hex.multiplier', { value: state.multiplier })}
          </span>
          <TravelIconButton
            kind="faster"
            label={message('ui.schneller')}
            disabled={
              !mutationsEnabled || multiplierIndex >= multipliers.length - 1
            }
            onClick={() => void state.stepMultiplier(1)}
          />
        </div>
      </div>

      <div className="travel-console-body">
        {state.travel && (
          <p className="travel-route-message" role="status">
            {travelHint(state.travel.hintCode)}
          </p>
        )}
        <div className="travel-route-facts">
          <TravelFact
            label={message('ui.dauer')}
            value={routeValues.duration}
          />
          <TravelFact label={message('ui.hex')} value={routeValues.hexes} />
          <TravelFact label={message('ui.kosten')} value={routeValues.cost} />
        </div>
        {evaluation?.status === 'rejected' && (
          <p className="travel-route-message" role="status">
            {routeFailureMessage(evaluation)}
          </p>
        )}
        {props.controller.state.lifecycle === 'stale' && (
          <p className="travel-warning" role="status">
            {props.controller.state.error ?? message('hex.travel.stale')}
          </p>
        )}
        <p className="travel-current-hex">{currentHex}</p>
        {state.travel?.assumedSpeedMemberNames.length ? (
          <p className="travel-warning">
            {formatMessage('hex.assumedSpeed', {
              names: state.travel.assumedSpeedMemberNames.join(', ')
            })}
          </p>
        ) : null}
      </div>
    </section>
  )
}

export function SessionHexMap(props: { controller: HexTravelController }) {
  const state = useHexTravelViewModel(props.controller)
  const travel = state.travel
  const token =
    travel && travel.mapId === state.map?.map.id ? travel.current : null
  const route =
    state.evaluation?.path ??
    (travel && travel.mapId === state.map?.map.id ? travel.path : [])
  const visibleToken = state.tokenPreview ?? token
  const mapLabel = useMemo(
    () =>
      state.map
        ? formatMessage('hex.canvas.mapLabel', {
            name: state.map.map.displayName
          })
        : '',
    [state.map]
  )

  if (props.controller.state.lifecycle === 'error')
    return (
      <div className="hex-travel-map-empty" role="alert">
        {props.controller.state.error}
      </div>
    )
  if (!state.catalog || !state.biomes)
    return <div className="hex-travel-map-empty">{message('hex.loading')}</div>
  if (state.catalog.maps.length === 0)
    return (
      <div className="hex-travel-map-empty">
        <strong>{message('hex.none')}</strong>
        <p>{message('ui.lege.zuerst.im.hex.editor.eine.karte.an')}</p>
      </div>
    )
  if (!state.map)
    return <div className="hex-travel-map-empty">{message('hex.loading')}</div>

  return (
    <div className="hex-travel-map">
      <HexMapCanvas
        snapshot={state.map}
        biomes={state.biomes}
        selected={state.selected}
        token={visibleToken}
        route={route}
        overlays={state.map.overlays.filter((overlay) => !overlay.focused)}
        draggableToken={
          props.controller.state.lifecycle === 'ready' ? token : null
        }
        onTokenDrag={state.previewToken}
        onTokenDrop={state.dropToken}
        onTileClick={state.activateTile}
        onTileNavigate={state.selectTile}
        onTileActivate={state.activateTile}
        onViewportChange={(center) => void state.readViewport(center)}
        ariaLabel={mapLabel}
      />
    </div>
  )
}

function useHexTravelViewModel(controller: HexTravelController) {
  const provider = controller.state.providerState
  const map = controller.state.map
  const biomes = useMemo(() => {
    if (!provider) return null
    return map
      ? mergeHexBiomeCatalog(provider.biomes, map.biomes)
      : provider.biomes
  }, [map, provider])
  return {
    catalog: provider?.catalog ?? null,
    biomes,
    map,
    travel: provider?.travel ?? null,
    selected: controller.state.selected,
    mode: controller.state.mode,
    waypoints: controller.state.waypoints,
    evaluation: controller.state.evaluation,
    multiplier: controller.state.multiplier,
    tokenPreview: controller.state.tokenPreview,
    selectMap: controller.selectMap,
    selectTile: controller.selectPosition,
    activateTile: controller.activatePosition,
    togglePlanning: controller.togglePlanning,
    togglePositioning: controller.togglePositioning,
    clearRoute: controller.clearRoute,
    readViewport: controller.readViewport,
    previewToken: controller.previewToken,
    dropToken: controller.dropToken,
    start: controller.start,
    pauseOrResume: controller.pauseOrResume,
    abort: controller.abort,
    stepMultiplier: controller.stepMultiplier
  }
}

function routeFailureMessage(
  evaluation: Extract<HexRouteEvaluation, { status: 'rejected' }>
) {
  const coordinate = evaluation.blockingCoordinate
  switch (evaluation.reason) {
    case 'outside-map':
      return formatMessage('hex.route.rejected.outside-map', {
        q: coordinate?.q ?? 0,
        r: coordinate?.r ?? 0
      })
    case 'impassable':
      return formatMessage('hex.route.rejected.impassable', {
        q: coordinate?.q ?? 0,
        r: coordinate?.r ?? 0
      })
    case 'party-unpositioned':
      return message('hex.route.rejected.party-unpositioned')
    case 'missing-waypoint':
      return message('hex.route.rejected.missing-waypoint')
    case 'route-too-long':
      return message('hex.route.rejected.route-too-long')
    case 'movement-speed-unavailable':
      return message('hex.route.rejected.movement-speed-unavailable')
    case 'same-as-start':
      return message('hex.route.rejected.same-as-start')
  }
}

function travelHint(code: HexTravelSnapshot['hintCode']) {
  return message(`hex.travel.hint.${code}`)
}

function TravelFact(props: { label: string; value: string }) {
  return (
    <div>
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </div>
  )
}

function TravelIconButton(props: {
  kind: 'play' | 'pause' | 'stop' | 'slower' | 'faster'
  label: string
  disabled: boolean
  primary?: boolean
  onClick: () => void
}) {
  return (
    <button
      className={`travel-icon-button${props.primary ? ' primary-action' : ''}`}
      aria-label={props.label}
      disabled={props.disabled}
      onClick={props.onClick}
    >
      <TravelIcon kind={props.kind} />
    </button>
  )
}

function TravelIcon(props: {
  kind: 'play' | 'pause' | 'stop' | 'slower' | 'faster'
}) {
  if (props.kind === 'pause')
    return (
      <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true">
        <rect x="6" y="5" width="4" height="14" />
        <rect x="14" y="5" width="4" height="14" />
      </svg>
    )
  if (props.kind === 'stop')
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true">
        <rect x="5" y="5" width="14" height="14" />
      </svg>
    )
  const paths =
    props.kind === 'play'
      ? ['M7 4l13 8-13 8z']
      : props.kind === 'slower'
        ? ['M11 5v14l-9-7z', 'M21 5v14l-9-7z']
        : ['M13 5v14l9-7z', 'M3 5v14l9-7z']
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true">
      {paths.map((path) => (
        <path key={path} d={path} />
      ))}
    </svg>
  )
}

function formatShortDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  return minutes === 0
    ? formatMessage('hex.durationHours', { hours })
    : formatMessage('hex.duration', { hours, minutes })
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 }).format(
    value
  )
}
