import { Application, Container, Graphics, Text } from 'pixi.js'
import { useEffect, useRef, useState, type ReactElement } from 'react'
import type {
  AxialCoordinate,
  HexMapView,
  HexTerrainCatalog
} from '../../../shared/contracts/hex.js'

const rootThree = Math.sqrt(3)

function center(coordinate: AxialCoordinate, size: number) {
  return {
    x: size * rootThree * (coordinate.q + coordinate.r / 2),
    y: size * 1.5 * coordinate.r
  }
}

function polygon(x: number, y: number, size: number): number[] {
  return Array.from({ length: 6 }, (_, index) => {
    const angle = ((60 * index - 30) * Math.PI) / 180
    return [x + size * Math.cos(angle), y + size * Math.sin(angle)]
  }).flat()
}

function pixelToAxial(x: number, y: number, size: number): AxialCoordinate {
  const q = ((rootThree / 3) * x - y / 3) / size
  const r = ((2 / 3) * y) / size
  const cube = { x: q, z: r, y: -q - r }
  let rx = Math.round(cube.x)
  const ry = Math.round(cube.y)
  let rz = Math.round(cube.z)
  const dx = Math.abs(rx - cube.x)
  const dy = Math.abs(ry - cube.y)
  const dz = Math.abs(rz - cube.z)
  if (dx > dy && dx > dz) rx = -ry - rz
  else if (dy <= dz) rz = -rx - ry
  return { q: rx, r: rz }
}

export function HexMapCanvas(props: {
  snapshot: HexMapView
  terrains: HexTerrainCatalog
  selected: AxialCoordinate | null
  token?: AxialCoordinate | null
  route?: readonly AxialCoordinate[]
  onTileClick?: (coordinate: AxialCoordinate) => void
  onViewportChange?: (center: AxialCoordinate) => void
  ariaLabel: string
}): ReactElement {
  const host = useRef<HTMLDivElement>(null)
  const [renderError, setRenderError] = useState(false)
  const [directQ, setDirectQ] = useState(props.selected?.q ?? 0)
  const [directR, setDirectR] = useState(props.selected?.r ?? 0)
  const [factPage, setFactPage] = useState(0)
  const click = useRef(props.onTileClick)
  const viewportChange = useRef(props.onViewportChange)
  useEffect(() => {
    click.current = props.onTileClick
  }, [props.onTileClick])
  useEffect(() => {
    viewportChange.current = props.onViewportChange
  }, [props.onViewportChange])

  useEffect(() => {
    const element = host.current
    if (!element) return
    setRenderError(false)
    const application = new Application()
    let disposed = false
    let initialized = false
    let destroyed = false
    let dragging = false
    let last = { x: 0, y: 0 }
    const size = 27
    const world = new Container()
    const byTerrain = new Map(
      props.terrains.terrains.map((terrain) => [terrain.id, terrain])
    )
    const destroy = () => {
      if (!initialized || destroyed) return
      destroyed = true
      try {
        ;(application as Application & { cleanup?: () => void }).cleanup?.()
        application.destroy(true, { children: true })
      } catch {
        // Renderer cleanup must never prevent navigation away from the map.
      }
    }

    void application
      .init({
        resizeTo: element,
        background: '#101a18',
        antialias: true,
        preference: 'webgl'
      })
      .then(() => {
        initialized = true
        if (disposed) {
          destroy()
          return
        }
        element.append(application.canvas)
        application.stage.addChild(world)
        const viewportCenter = center(props.snapshot.center, size)
        world.position.set(
          element.clientWidth / 2 - viewportCenter.x,
          element.clientHeight / 2 - viewportCenter.y
        )

        const tiles = new Graphics()
        for (const tile of props.snapshot.tiles) {
          const point = center(tile, size)
          const terrain = byTerrain.get(tile.terrainId)!
          tiles.poly(polygon(point.x, point.y, size - 1))
          tiles.fill(terrain.color)
          tiles.stroke({ width: 1, color: '#263d38', alpha: 0.9 })
        }
        world.addChild(tiles)

        if (props.route && props.route.length > 1) {
          const route = new Graphics()
          const first = center(props.route[0]!, size)
          route.moveTo(first.x, first.y)
          for (const coordinate of props.route.slice(1)) {
            const point = center(coordinate, size)
            route.lineTo(point.x, point.y)
          }
          route.stroke({ width: 5, color: '#f2cc70', alpha: 0.85 })
          world.addChild(route)
        }

        for (const tile of props.snapshot.tiles.filter(
          (tile) => tile.location
        )) {
          const point = center(tile, size)
          const marker = new Graphics()
          marker.circle(point.x, point.y, 7).fill('#f3d38a')
          marker.stroke({ width: 2, color: '#3e2f1e' })
          world.addChild(marker)
          const label = new Text({
            text: tile.location!.displayName,
            style: { fontSize: 12, fill: '#fff4d1' }
          })
          label.position.set(point.x + 10, point.y - 18)
          world.addChild(label)
        }

        if (props.selected) {
          const point = center(props.selected, size)
          const selection = new Graphics()
          selection
            .poly(polygon(point.x, point.y, size - 2))
            .stroke({ width: 4, color: '#ffffff' })
          world.addChild(selection)
        }

        if (props.token) {
          const point = center(props.token, size)
          const token = new Graphics()
          token.circle(point.x, point.y, 11).fill('#d6594c')
          token.circle(point.x, point.y, 4).fill('#fff4e8')
          token.stroke({ width: 2, color: '#421c19' })
          world.addChild(token)
        }

        const canvas = application.canvas
        const pointerDown = (event: PointerEvent) => {
          if (event.button !== 1) return
          dragging = true
          last = { x: event.clientX, y: event.clientY }
          event.preventDefault()
        }
        const pointerMove = (event: PointerEvent) => {
          if (!dragging) return
          world.position.x += event.clientX - last.x
          world.position.y += event.clientY - last.y
          last = { x: event.clientX, y: event.clientY }
        }
        const pointerUp = () => {
          if (dragging && viewportChange.current) {
            const localX =
              (element.clientWidth / 2 - world.position.x) / world.scale.x
            const localY =
              (element.clientHeight / 2 - world.position.y) / world.scale.y
            const nextCenter = pixelToAxial(localX, localY, size)
            if (
              nextCenter.q !== props.snapshot.center.q ||
              nextCenter.r !== props.snapshot.center.r
            )
              viewportChange.current(nextCenter)
          }
          dragging = false
        }
        const pointerClick = (event: MouseEvent) => {
          if (event.button !== 0 || !click.current) return
          const bounds = canvas.getBoundingClientRect()
          const localX =
            (event.clientX - bounds.left - world.position.x) / world.scale.x
          const localY =
            (event.clientY - bounds.top - world.position.y) / world.scale.y
          const coordinate = pixelToAxial(localX, localY, size)
          if (
            props.snapshot.tiles.some(
              (tile) => tile.q === coordinate.q && tile.r === coordinate.r
            )
          )
            click.current(coordinate)
        }
        const wheel = (event: WheelEvent) => {
          event.preventDefault()
          const next = Math.max(
            0.35,
            Math.min(2.5, world.scale.x * (event.deltaY > 0 ? 0.9 : 1.1))
          )
          world.scale.set(next)
        }
        canvas.addEventListener('pointerdown', pointerDown)
        window.addEventListener('pointermove', pointerMove)
        window.addEventListener('pointerup', pointerUp)
        canvas.addEventListener('click', pointerClick)
        canvas.addEventListener('wheel', wheel, { passive: false })
        ;(application as Application & { cleanup?: () => void }).cleanup =
          () => {
            canvas.removeEventListener('pointerdown', pointerDown)
            window.removeEventListener('pointermove', pointerMove)
            window.removeEventListener('pointerup', pointerUp)
            canvas.removeEventListener('click', pointerClick)
            canvas.removeEventListener('wheel', wheel)
          }
      })
      .catch(() => {
        destroy()
        if (!disposed) setRenderError(true)
      })

    return () => {
      disposed = true
      destroy()
    }
  }, [props.snapshot, props.terrains, props.selected, props.token, props.route])

  return (
    <div className="hex-canvas-shell">
      <div
        className="hex-canvas"
        ref={host}
        role="img"
        aria-label={props.ariaLabel}
      />
      {renderError && (
        <p className="hex-canvas-render-error" role="alert">
          Die Kartenansicht konnte nicht initialisiert werden. Navigation und
          Kartendaten bleiben verfügbar.
        </p>
      )}
      <section className="hex-accessible-selection" aria-label="Hex-Navigation">
        <label>
          q-Koordinate
          <input
            type="number"
            value={directQ}
            onChange={(event) => setDirectQ(Number(event.target.value))}
          />
        </label>
        <label>
          r-Koordinate
          <input
            type="number"
            value={directR}
            onChange={(event) => setDirectR(Number(event.target.value))}
          />
        </label>
        <button
          onClick={() => {
            if (Number.isSafeInteger(directQ) && Number.isSafeInteger(directR))
              props.onTileClick?.({ q: directQ, r: directR })
          }}
        >
          Koordinate auswählen
        </button>
        <ul aria-label="Relevante Kartenfakten">
          {props.snapshot.tiles
            .filter((tile) => tile.location || tile.terrainId !== 'grassland')
            .slice(factPage * 20, factPage * 20 + 20)
            .map((tile) => (
              <li key={tile.id}>
                {tile.label} · {byLabel(props.terrains, tile.terrainId)}
                {tile.location ? ` · ${tile.location.displayName}` : ''}
              </li>
            ))}
        </ul>
        <button
          disabled={factPage === 0}
          onClick={() => setFactPage((p) => p - 1)}
        >
          Vorherige Fakten
        </button>
        <button
          disabled={
            (factPage + 1) * 20 >=
            props.snapshot.tiles.filter(
              (tile) => tile.location || tile.terrainId !== 'grassland'
            ).length
          }
          onClick={() => setFactPage((p) => p + 1)}
        >
          Weitere Fakten
        </button>
      </section>
    </div>
  )
}

function byLabel(catalog: HexTerrainCatalog, id: string) {
  return catalog.terrains.find((terrain) => terrain.id === id)?.label ?? id
}
