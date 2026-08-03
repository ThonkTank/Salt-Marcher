import { Application, Container, Graphics, Text } from 'pixi.js'
import { useEffect, useRef, type ReactElement } from 'react'
import type {
  AxialCoordinate,
  HexMapSnapshot,
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
  snapshot: HexMapSnapshot
  terrains: HexTerrainCatalog
  selected: AxialCoordinate | null
  token?: AxialCoordinate | null
  route?: readonly AxialCoordinate[]
  onTileClick?: (coordinate: AxialCoordinate) => void
  ariaLabel: string
}): ReactElement {
  const host = useRef<HTMLDivElement>(null)
  const click = useRef(props.onTileClick)
  useEffect(() => {
    click.current = props.onTileClick
  }, [props.onTileClick])

  useEffect(() => {
    const element = host.current
    if (!element) return
    const application = new Application()
    let disposed = false
    let dragging = false
    let last = { x: 0, y: 0 }
    const size = 27
    const world = new Container()
    const byTerrain = new Map(
      props.terrains.terrains.map((terrain) => [terrain.id, terrain])
    )

    void application
      .init({
        resizeTo: element,
        background: '#101a18',
        antialias: true,
        preference: 'webgl'
      })
      .then(() => {
        if (disposed) return
        element.append(application.canvas)
        application.stage.addChild(world)
        world.position.set(element.clientWidth / 2, element.clientHeight / 2)

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

    return () => {
      disposed = true
      ;(application as Application & { cleanup?: () => void }).cleanup?.()
      application.destroy(true, { children: true })
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
      <label className="hex-accessible-selection">
        Hexfeld auswählen
        <select
          value={
            props.selected ? `${props.selected.q}:${props.selected.r}` : ''
          }
          onChange={(event) => {
            const [q, r] = event.target.value.split(':').map(Number)
            if (Number.isFinite(q) && Number.isFinite(r))
              props.onTileClick?.({ q: q!, r: r! })
          }}
        >
          <option value="">Keine Auswahl</option>
          {props.snapshot.tiles.map((tile) => (
            <option key={tile.id} value={tile.id}>
              {tile.label} · {byLabel(props.terrains, tile.terrainId)}
              {tile.location ? ` · ${tile.location.displayName}` : ''}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}

function byLabel(catalog: HexTerrainCatalog, id: string) {
  return catalog.terrains.find((terrain) => terrain.id === id)?.label ?? id
}
