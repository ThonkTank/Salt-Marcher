import { message } from '../../i18n/messages.de.js'
// Installs Pixi's static CSP-safe shader and uniform synchronizers.
import 'pixi.js/unsafe-eval'
import { Container, Graphics, Text, WebGLRenderer } from 'pixi.js'
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
import { expandHexBrush } from './hex-brush.js'
import {
  center,
  chunkId,
  hexSize,
  pixelToAxial,
  polygon,
  rootThree
} from './hex-canvas-geometry.js'
import {
  rememberCamera,
  resetCamera,
  viewportCenter,
  viewportMetrics
} from './hex-pixi-camera.js'
import { attachHexCanvasGestures } from './hex-canvas-gesture-controller.js'
import {
  HexLocationMarkerOverlay,
  type HexLocationMarkerOverlayHandle
} from './hex-location-marker-overlay.js'

type TravelOverlay = Readonly<{
  id: string
  label: string
  token: AxialCoordinate | null
  route: readonly AxialCoordinate[]
  focused?: boolean
}>

type CanvasState = {
  application: WebGLRenderer
  world: Container
  element: HTMLDivElement
  mapId: string
  cameraByMap: Map<string, Readonly<{ x: number; y: number; scale: number }>>
  destroyed: boolean
  chunks: Map<
    string,
    Readonly<{
      signature: string
      biome: Container
    }>
  >
  layers: Readonly<{
    grid: Container
    biome: Container
    overlays: Container
    preview: Container
    selection: Container
  }>
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

  const clearLayer = useCallback((layer: Container) => {
    for (const child of layer.removeChildren())
      child.destroy({ children: true })
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
    const { world, element, layers } = current
    clearLayer(layers.grid)
    const localCenter = viewportCenter(current)
    const spanQ =
      Math.ceil(
        element.clientWidth / (hexSize * rootThree * world.scale.x) / 2
      ) + 3
    const spanR =
      Math.ceil(element.clientHeight / (hexSize * 1.5 * world.scale.y) / 2) + 3
    const grid = new Graphics()
    for (let q = localCenter.q - spanQ; q <= localCenter.q + spanQ; q += 1)
      for (let r = localCenter.r - spanR; r <= localCenter.r + spanR; r += 1) {
        const point = center({ q, r })
        grid
          .poly(polygon(point.x, point.y, hexSize - 1))
          .stroke({ width: 1, color: '#263d38', alpha: 0.45 })
      }
    layers.grid.addChild(grid)
  }, [clearLayer])

  const redrawTransientLayers = useCallback(() => {
    const current = state.current
    if (!current || current.destroyed) return
    const currentProps = latest.current
    const { layers } = current
    clearLayer(layers.preview)
    clearLayer(layers.selection)
    const byBiome = new Map(
      currentProps.biomes.biomes.map((biome) => [biome.id, biome])
    )
    const radius = currentProps.brushRadius ?? 0
    if (previewRef.current.length > 0) {
      const preview = new Graphics()
      for (const coordinate of expandHexBrush(previewRef.current, radius) ??
        []) {
        const point = center(coordinate)
        preview.poly(polygon(point.x, point.y, hexSize - 3)).fill({
          color:
            currentProps.interaction === 'erase'
              ? '#d6594c'
              : (byBiome.get(currentProps.brushBiomeId ?? 'grassland')?.color ??
                '#ffffff'),
          alpha: 0.35
        })
      }
      layers.preview.addChild(preview)
    }
    if (currentProps.selected) {
      const point = center(currentProps.selected)
      const selection = new Graphics()
      selection
        .poly(polygon(point.x, point.y, hexSize - 2))
        .stroke({ width: 4, color: '#ffffff' })
      layers.selection.addChild(selection)
    }
  }, [clearLayer])

  const redraw = useCallback(() => {
    const current = state.current
    if (!current || current.destroyed) return
    const currentProps = latest.current
    const { layers } = current
    clearLayer(layers.overlays)
    redrawGrid()
    const byBiome = new Map(
      currentProps.biomes.biomes.map((biome) => [biome.id, biome])
    )
    const byChunk = new Map<string, HexMapView['tiles'][number][]>()
    for (const tile of currentProps.snapshot.tiles) {
      const id = chunkId(tile)
      const chunk = byChunk.get(id) ?? []
      chunk.push(tile)
      byChunk.set(id, chunk)
    }
    for (const [id, drawing] of current.chunks)
      if (!byChunk.has(id)) {
        layers.biome.removeChild(drawing.biome)
        drawing.biome.destroy({ children: true })
        current.chunks.delete(id)
      }
    for (const [id, chunk] of byChunk) {
      chunk.sort((left, right) => left.q - right.q || left.r - right.r)
      const signature = chunk
        .map((tile) => {
          const biome = byBiome.get(tile.biomeId)
          return `${tile.q}:${tile.r}:${tile.biomeId}:${biome?.color ?? ''}`
        })
        .join('|')
      if (current.chunks.get(id)?.signature === signature) continue
      const previous = current.chunks.get(id)
      if (previous) {
        layers.biome.removeChild(previous.biome)
        previous.biome.destroy({ children: true })
      }
      const biomeContainer = new Container()
      const graphics = new Graphics()
      for (const tile of chunk) {
        const point = center(tile)
        const biome = byBiome.get(tile.biomeId)
        if (biome) {
          graphics
            .poly(polygon(point.x, point.y, hexSize - 1))
            .fill(biome.color)
          graphics.stroke({ width: 1, color: '#263d38', alpha: 0.9 })
          if (tile.biomeId === 'to-be-replaced') {
            graphics
              .moveTo(point.x - 8, point.y - 8)
              .lineTo(point.x + 8, point.y + 8)
              .moveTo(point.x + 8, point.y - 8)
              .lineTo(point.x - 8, point.y + 8)
              .stroke({ width: 2, color: '#ffe2f3', alpha: 0.9 })
          }
        }
      }
      biomeContainer.addChild(graphics)
      layers.biome.addChild(biomeContainer)
      current.chunks.set(id, {
        signature,
        biome: biomeContainer
      })
    }

    const overlays = [
      ...(currentProps.overlays ?? []),
      ...(currentProps.token || currentProps.route
        ? [
            {
              id: 'primary',
              label: '',
              token: currentProps.token ?? null,
              route: currentProps.route ?? [],
              focused: true
            }
          ]
        : [])
    ]
    overlays.forEach((overlay, index) => {
      if (overlay.route.length > 1) {
        const route = new Graphics()
        const first = center(overlay.route[0]!)
        route.moveTo(first.x, first.y)
        for (const coordinate of overlay.route.slice(1)) {
          const point = center(coordinate)
          route.lineTo(point.x, point.y)
        }
        route.stroke({
          width: overlay.focused ? 5 : 3,
          color: overlay.focused ? '#f2cc70' : '#89b8c2',
          alpha: 0.85
        })
        layers.overlays.addChild(route)
      }
      if (overlay.token) {
        const point = center(overlay.token)
        const token = new Graphics()
        token
          .circle(point.x, point.y, overlay.focused ? 11 : 8)
          .fill(overlay.focused ? '#d6594c' : '#4f96a6')
        token.circle(point.x, point.y, 4).fill('#fff4e8')
        token.stroke({ width: 2, color: '#421c19' })
        layers.overlays.addChild(token)
        if (overlay.label) {
          const label = new Text({
            text: overlay.label,
            style: { fontSize: 11, fill: '#fff4d1' }
          })
          label.position.set(point.x + 12, point.y + index * 12)
          layers.overlays.addChild(label)
        }
      }
    })

    redrawTransientLayers()
  }, [clearLayer, redrawGrid, redrawTransientLayers])

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
    const layers = {
      grid: new Container(),
      biome: new Container(),
      overlays: new Container(),
      preview: new Container(),
      selection: new Container()
    }
    let disposed = false
    let resizeObserver: ResizeObserver | null = null
    let lastViewportNotice = 0
    let animationFrame = 0
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
        state.current = {
          application,
          world,
          element,
          mapId: latest.current.snapshot.map.id,
          cameraByMap: cameraMemory.current,
          destroyed: false,
          chunks: new Map(),
          layers
        }
        resetCamera(state.current, { q: 0, r: 0 })
        syncCamera()
        redrawSafely()
        const renderFrame = () => {
          if (disposed) return
          try {
            application.render(world)
            animationFrame = requestAnimationFrame(renderFrame)
          } catch (cause) {
            reportRendererFailure('canvas', cause)
          }
        }
        animationFrame = requestAnimationFrame(renderFrame)

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
          coordinateFor,
          onPan: (deltaX, deltaY) => {
            world.position.x += deltaX
            world.position.y += deltaY
            rememberCamera(state.current!)
            syncCamera()
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
          resizeObserver = new ResizeObserver(() => {
            application.resize(
              Math.max(1, element.clientWidth),
              Math.max(1, element.clientHeight)
            )
            syncCamera()
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
      cancelAnimationFrame(animationFrame)
      detachGestures?.()
      destroy()
    }
  }, [
    redrawGrid,
    redrawSafely,
    redrawTransientLayersSafely,
    renderAttempt,
    reportRendererFailure,
    syncCamera
  ])

  useEffect(() => {
    const current = state.current
    if (!current) return
    if (current.mapId !== props.snapshot.map.id) {
      rememberCamera(current)
      current.chunks.clear()
      clearLayer(current.layers.biome)
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
    clearLayer,
    syncCamera
  ])

  useEffect(() => {
    const frame = requestAnimationFrame(redrawTransientLayersSafely)
    return () => cancelAnimationFrame(frame)
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
    redrawGrid()
  }, [props.resetViewSignal, redrawGrid, syncCamera])

  const keyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const selected = latest.current.selected ?? latest.current.snapshot.center
    const delta =
      event.key === 'ArrowLeft'
        ? { q: -1, r: 0 }
        : event.key === 'ArrowRight'
          ? { q: 1, r: 0 }
          : event.key === 'ArrowUp'
            ? { q: 0, r: -1 }
            : event.key === 'ArrowDown'
              ? { q: 0, r: 1 }
              : event.key.toLowerCase() === 'q'
                ? { q: -1, r: 1 }
                : event.key.toLowerCase() === 'e'
                  ? { q: 1, r: -1 }
                  : null
    if (delta) {
      event.preventDefault()
      const next = {
        q: selected.q + delta.q,
        r: selected.r + delta.r
      }
      latest.current.onTileClick?.(next)
      const current = state.current
      if (current) {
        const point = center(next)
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
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      if (
        latest.current.interaction === 'paint' ||
        latest.current.interaction === 'erase'
      )
        latest.current.onStrokeComplete?.([selected])
      else latest.current.onTileClick?.(selected)
    }
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
