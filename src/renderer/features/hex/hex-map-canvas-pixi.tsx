import { message } from '../../i18n/hex-runtime.de.js'
import {
  Container,
  WebGLRenderer
} from '../../spatial-2d/pixi-webgl-runtime.js'
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactElement
} from 'react'
import type {
  AxialCoordinate,
  HexMapView,
  HexBiomeCatalog,
  HexBiomeId
} from '../../../shared/contracts/hex.js'
import { center, pixelToAxial } from './hex-canvas-geometry.js'
import {
  rememberCamera,
  resetCamera,
  viewportMetrics
} from './hex-pixi-camera.js'
import { attachHexCanvasGestures } from './hex-canvas-gesture-controller.js'
import { hexCanvasKeyboardCommand } from './hex-canvas-keyboard-controller.js'
import {
  HexLocationMarkerOverlay,
  type HexLocationMarkerOverlayHandle
} from './hex-location-marker-overlay.js'
import './hex-canvas.css'
import {
  RafRenderScheduler,
  type RenderInvalidationReason
} from './raf-render-scheduler.js'
import {
  clearHexPixiLayer,
  createHexPixiLayers,
  drawHexGrid,
  drawHexTransientLayers,
  synchronizeHexScene,
  type HexPixiChunk,
  type HexPixiLayers,
  type TravelOverlay
} from './hex-pixi-layers.js'

type CanvasState = {
  application: WebGLRenderer
  world: Container
  element: HTMLDivElement
  scheduler: RafRenderScheduler
  renderCount: number
  renderReasonCounts: Record<RenderInvalidationReason, number>
  mapId: string
  cameraByMap: Map<string, Readonly<{ x: number; y: number; scale: number }>>
  destroyed: boolean
  chunks: Map<string, HexPixiChunk>
  layers: HexPixiLayers
}

export type HexMapCanvasProps = {
  snapshot: HexMapView
  biomes: HexBiomeCatalog
  selected: AxialCoordinate | null
  token?: AxialCoordinate | null
  route?: readonly AxialCoordinate[]
  overlays?: readonly TravelOverlay[]
  interaction?: 'select' | 'paint' | 'erase' | 'location'
  brushRadius?: number
  brushBiomeId?: HexBiomeId
  resetViewSignal?: number
  onTileClick?: (coordinate: AxialCoordinate) => void
  onTileNavigate?: (coordinate: AxialCoordinate) => void
  onTileActivate?: (coordinate: AxialCoordinate) => void
  draggableToken?: AxialCoordinate | null
  onTokenDrag?: (coordinate: AxialCoordinate | null) => void
  onTokenDrop?: (coordinate: AxialCoordinate) => void
  onStrokeComplete?: (path: readonly AxialCoordinate[]) => void
  onViewportChange?: (center: AxialCoordinate, halfExtent: number) => void
  ariaLabel: string
  onRendererFailure?: (phase: 'bootstrap' | 'canvas', error: Error) => void
}

export function HexMapCanvasPixi(props: HexMapCanvasProps): ReactElement {
  const host = useRef<HTMLDivElement>(null)
  const markerOverlay = useRef<HexLocationMarkerOverlayHandle>(null)
  const state = useRef<CanvasState | null>(null)
  const latest = useRef(props)
  const previewRef = useRef<readonly AxialCoordinate[]>([])
  const cameraMemory = useRef(
    new Map<string, Readonly<{ x: number; y: number; scale: number }>>()
  )
  const [renderError, setRenderError] = useState(false)
  const [renderAttempt, setRenderAttempt] = useState(0)
  useEffect(() => {
    latest.current = props
  }, [props])

  const reportRendererFailure = useCallback(
    (phase: 'bootstrap' | 'canvas', cause: unknown) => {
      const error = cause instanceof Error ? cause : new Error(String(cause))
      latest.current.onRendererFailure?.(phase, error)
      setRenderError(true)
    },
    []
  )

  const invalidateRender = useCallback((reason: RenderInvalidationReason) => {
    const current = state.current
    if (!current || current.destroyed) return
    current.scheduler.invalidate(reason)
  }, [])

  const syncCamera = useCallback(() => {
    const current = state.current
    if (!current || current.destroyed) return
    markerOverlay.current?.setCamera({
      x: current.world.position.x,
      y: current.world.position.y,
      scale: current.world.scale.x,
      width: Math.max(1, current.element.clientWidth),
      height: Math.max(1, current.element.clientHeight)
    })
  }, [])

  const redrawGrid = useCallback(() => {
    const current = state.current
    if (!current || current.destroyed) return
    drawHexGrid(current, current.layers.grid)
    invalidateRender('scene')
  }, [invalidateRender])

  const redrawTransientLayers = useCallback(() => {
    const current = state.current
    if (!current || current.destroyed) return
    const currentProps = latest.current
    drawHexTransientLayers(current.layers, {
      biomes: currentProps.biomes,
      selected: currentProps.selected,
      interaction: currentProps.interaction,
      brushRadius: currentProps.brushRadius,
      brushBiomeId: currentProps.brushBiomeId,
      preview: previewRef.current
    })
    invalidateRender('overlay')
  }, [invalidateRender])

  const redraw = useCallback(() => {
    const current = state.current
    if (!current || current.destroyed) return
    const currentProps = latest.current
    redrawGrid()
    synchronizeHexScene({
      snapshot: currentProps.snapshot,
      biomes: currentProps.biomes,
      token: currentProps.token,
      route: currentProps.route,
      overlays: currentProps.overlays,
      layers: current.layers,
      chunks: current.chunks
    })
    redrawTransientLayers()
  }, [redrawGrid, redrawTransientLayers])

  const redrawSafely = useCallback(() => {
    try {
      redraw()
    } catch (cause) {
      reportRendererFailure('canvas', cause)
    }
  }, [redraw, reportRendererFailure])

  const redrawTransientLayersSafely = useCallback(() => {
    try {
      redrawTransientLayers()
    } catch (cause) {
      reportRendererFailure('canvas', cause)
    }
  }, [redrawTransientLayers, reportRendererFailure])

  useEffect(() => {
    const element = host.current
    if (!element) return
    setRenderError(false)
    const application = new WebGLRenderer()
    const world = new Container()
    const layers = createHexPixiLayers()
    let disposed = false
    let resizeObserver: ResizeObserver | null = null
    let lastViewportNotice = 0
    let detachGestures: (() => void) | undefined

    const notifyViewport = () => {
      const current = state.current
      if (!current) return
      const now = performance.now()
      if (now - lastViewportNotice < 75) return
      lastViewportNotice = now
      redrawGrid()
      const metrics = viewportMetrics(current)
      latest.current.onViewportChange?.(metrics.center, metrics.halfExtent)
    }

    const destroy = () => {
      const current = state.current
      if (!current || current.application !== application || current.destroyed)
        return
      current.destroyed = true
      resizeObserver?.disconnect()
      current.scheduler.dispose()
      try {
        world.destroy({ children: true })
        application.destroy(true)
      } catch {
        // Renderer cleanup must never prevent navigation away from the map.
      }
      state.current = null
    }

    void application
      .init({
        manageImports: false,
        width: Math.max(1, element.clientWidth),
        height: Math.max(1, element.clientHeight),
        background: '#101a18',
        antialias: true
      })
      .then(() => {
        if (disposed) {
          application.destroy(true)
          return
        }
        element.append(application.canvas)
        world.addChild(
          layers.grid,
          layers.biome,
          layers.overlays,
          layers.preview,
          layers.selection
        )
        const scheduler = new RafRenderScheduler((reasons) => {
          const current = state.current
          if (
            !current ||
            current.application !== application ||
            current.destroyed
          )
            return
          try {
            current.application.render(current.world)
            current.renderCount += 1
            for (const reason of reasons)
              current.renderReasonCounts[reason] += 1
            current.element.dataset['renderCount'] = String(current.renderCount)
            current.element.dataset['lastRenderReasons'] = [...reasons].join(
              ','
            )
            current.element.dataset['renderReasonCounts'] = JSON.stringify(
              current.renderReasonCounts
            )
          } catch (cause) {
            reportRendererFailure('canvas', cause)
          }
        })
        const current: CanvasState = {
          application,
          world,
          element,
          scheduler,
          renderCount: 0,
          renderReasonCounts: {
            scene: 0,
            camera: 0,
            overlay: 0,
            resize: 0
          },
          mapId: latest.current.snapshot.map.id,
          cameraByMap: cameraMemory.current,
          destroyed: false,
          chunks: new Map(),
          layers
        }
        element.dataset['renderCount'] = '0'
        element.dataset['renderReasonCounts'] = JSON.stringify(
          current.renderReasonCounts
        )
        state.current = current
        resetCamera(state.current, { q: 0, r: 0 })
        syncCamera()
        redrawSafely()

        const canvas = application.canvas
        const coordinateFor = (event: PointerEvent | MouseEvent) => {
          const bounds = canvas.getBoundingClientRect()
          return pixelToAxial(
            (event.clientX - bounds.left - world.position.x) / world.scale.x,
            (event.clientY - bounds.top - world.position.y) / world.scale.y
          )
        }
        detachGestures = attachHexCanvasGestures({
          canvas,
          interaction: () => latest.current.interaction,
          draggableToken: () => latest.current.draggableToken ?? null,
          coordinateFor,
          onPan: (deltaX, deltaY) => {
            world.position.x += deltaX
            world.position.y += deltaY
            rememberCamera(state.current!)
            syncCamera()
            invalidateRender('camera')
            notifyViewport()
          },
          onPanEnd: () => {
            redrawGrid()
            const metrics = viewportMetrics(state.current!)
            latest.current.onViewportChange?.(
              metrics.center,
              metrics.halfExtent
            )
          },
          onStrokePreview: (path) => {
            previewRef.current = path
            redrawTransientLayersSafely()
          },
          onStrokeComplete: (path) => latest.current.onStrokeComplete?.(path),
          onStrokeCancel: () => {
            previewRef.current = []
            redrawTransientLayersSafely()
          },
          onSelect: (coordinate) => latest.current.onTileClick?.(coordinate),
          onTokenPreview: (coordinate) =>
            latest.current.onTokenDrag?.(coordinate),
          onTokenDrop: (coordinate) => latest.current.onTokenDrop?.(coordinate),
          onZoom: (event) => {
            const bounds = canvas.getBoundingClientRect()
            const worldX =
              (event.clientX - bounds.left - world.position.x) / world.scale.x
            const worldY =
              (event.clientY - bounds.top - world.position.y) / world.scale.y
            const next = Math.max(
              0.35,
              Math.min(2.5, world.scale.x * (event.deltaY > 0 ? 0.9 : 1.1))
            )
            world.scale.set(next)
            world.position.set(
              event.clientX - bounds.left - worldX * next,
              event.clientY - bounds.top - worldY * next
            )
            invalidateRender('camera')
            redrawGrid()
            rememberCamera(state.current!)
            syncCamera()
            const metrics = viewportMetrics(state.current!)
            latest.current.onViewportChange?.(
              metrics.center,
              metrics.halfExtent
            )
          }
        })
        if (typeof ResizeObserver !== 'undefined') {
          let renderedWidth = Math.max(1, element.clientWidth)
          let renderedHeight = Math.max(1, element.clientHeight)
          resizeObserver = new ResizeObserver(() => {
            const width = Math.max(1, element.clientWidth)
            const height = Math.max(1, element.clientHeight)
            if (width === renderedWidth && height === renderedHeight) return
            renderedWidth = width
            renderedHeight = height
            application.resize(width, height)
            syncCamera()
            invalidateRender('resize')
            redrawGrid()
          })
          resizeObserver.observe(element)
        }
      })
      .catch((cause: unknown) => {
        try {
          application.destroy(true)
        } catch {
          // A failed partial initialization still needs best-effort cleanup.
        }
        if (!disposed) {
          reportRendererFailure('bootstrap', cause)
        }
      })

    return () => {
      disposed = true
      detachGestures?.()
      destroy()
    }
  }, [
    redrawGrid,
    redrawSafely,
    redrawTransientLayersSafely,
    renderAttempt,
    reportRendererFailure,
    syncCamera,
    invalidateRender
  ])

  useEffect(() => {
    const current = state.current
    if (!current) return
    if (current.mapId !== props.snapshot.map.id) {
      rememberCamera(current)
      current.chunks.clear()
      clearHexPixiLayer(current.layers.biome)
      current.mapId = props.snapshot.map.id
      const remembered = current.cameraByMap.get(current.mapId)
      if (remembered) {
        current.world.scale.set(remembered.scale)
        current.world.position.set(remembered.x, remembered.y)
      } else resetCamera(current, { q: 0, r: 0 })
      syncCamera()
    }
    redrawSafely()
  }, [
    props.snapshot,
    props.biomes,
    props.token,
    props.route,
    props.overlays,
    redrawSafely,
    syncCamera
  ])

  useEffect(() => {
    let active = true
    queueMicrotask(() => {
      if (active) redrawTransientLayersSafely()
    })
    return () => {
      active = false
    }
  }, [
    props.selected,
    props.interaction,
    props.brushRadius,
    props.brushBiomeId,
    redrawTransientLayersSafely
  ])

  useEffect(() => {
    const current = state.current
    if (!current || props.resetViewSignal === undefined) return
    resetCamera(current, { q: 0, r: 0 })
    rememberCamera(current)
    syncCamera()
    invalidateRender('camera')
    redrawGrid()
  }, [props.resetViewSignal, redrawGrid, syncCamera, invalidateRender])

  const keyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const selected = latest.current.selected ?? latest.current.snapshot.center
    const command = hexCanvasKeyboardCommand({
      key: event.key,
      selected,
      interaction: latest.current.interaction
    })
    if (!command) return
    event.preventDefault()
    if (command.kind === 'navigate') {
      ;(latest.current.onTileNavigate ?? latest.current.onTileClick)?.(
        command.coordinate
      )
      const current = state.current
      if (current) {
        const point = center(command.coordinate)
        const screenX =
          current.world.position.x + point.x * current.world.scale.x
        const screenY =
          current.world.position.y + point.y * current.world.scale.y
        const margin = 48
        if (
          screenX < margin ||
          screenY < margin ||
          screenX > current.element.clientWidth - margin ||
          screenY > current.element.clientHeight - margin
        ) {
          current.world.position.set(
            current.element.clientWidth / 2 - point.x * current.world.scale.x,
            current.element.clientHeight / 2 - point.y * current.world.scale.y
          )
          rememberCamera(current)
          syncCamera()
          redrawGrid()
          const metrics = viewportMetrics(current)
          latest.current.onViewportChange?.(metrics.center, metrics.halfExtent)
        }
      }
      return
    }
    if (command.kind === 'stroke') {
      latest.current.onStrokeComplete?.([command.coordinate])
      return
    }
    ;(latest.current.onTileActivate ?? latest.current.onTileClick)?.(
      command.coordinate
    )
  }

  const selectedTile = props.selected
    ? props.snapshot.tiles.find(
        (tile) => tile.q === props.selected!.q && tile.r === props.selected!.r
      )
    : null
  return (
    <div className="hex-canvas-shell">
      <div
        className="hex-canvas"
        ref={host}
        role="region"
        tabIndex={0}
        aria-label={props.ariaLabel}
        onKeyDown={keyDown}
      />
      <HexLocationMarkerOverlay ref={markerOverlay} snapshot={props.snapshot} />
      <span className="sr-only" aria-live="polite">
        {props.selected
          ? `Hex q=${props.selected.q}, r=${props.selected.r}${selectedTile ? `, ${selectedTile.biomeId}${selectedTile.location ? `, ${selectedTile.location.displayName}` : ''}` : ', leer'}`
          : ''}
      </span>
      {renderError && (
        <div className="hex-canvas-render-error" role="alert">
          <p>
            {message(
              'ui.die.kartenansicht.konnte.nicht.initialisiert.werden.navigation.und'
            )}
          </p>
          <button
            type="button"
            onClick={() => setRenderAttempt((attempt) => attempt + 1)}
          >
            {message('ui.kartenansicht.erneut.laden')}
          </button>
        </div>
      )}
    </div>
  )
}
