import {
  Container,
  Graphics,
  Text
} from '../../spatial-2d/pixi-webgl-runtime.js'
import type {
  AxialCoordinate,
  HexBiomeCatalog,
  HexBiomeId,
  HexMapView
} from '../../../shared/contracts/hex.js'
import { expandHexBrush } from './hex-brush.js'
import {
  center,
  chunkId,
  hexSize,
  polygon,
  rootThree
} from './hex-canvas-geometry.js'
import { viewportCenter, type HexCameraState } from './hex-pixi-camera.js'

export type TravelOverlay = Readonly<{
  id: string
  label: string
  token: AxialCoordinate | null
  route: readonly AxialCoordinate[]
  focused?: boolean
}>

export type HexPixiLayers = Readonly<{
  grid: Container
  biome: Container
  overlays: Container
  preview: Container
  selection: Container
}>

export type HexPixiChunk = Readonly<{
  signature: string
  biome: Container
}>

export type HexTransientDrawing = Readonly<{
  biomes: HexBiomeCatalog
  selected: AxialCoordinate | null
  interaction?: 'select' | 'paint' | 'erase' | 'location' | undefined
  brushRadius?: number | undefined
  brushBiomeId?: HexBiomeId | undefined
  preview: readonly AxialCoordinate[]
}>

export function createHexPixiLayers(): HexPixiLayers {
  return Object.freeze({
    grid: new Container(),
    biome: new Container(),
    overlays: new Container(),
    preview: new Container(),
    selection: new Container()
  })
}

export function clearHexPixiLayer(layer: Container): void {
  for (const child of layer.removeChildren()) child.destroy({ children: true })
}

export function drawHexGrid(state: HexCameraState, layer: Container): void {
  clearHexPixiLayer(layer)
  const localCenter = viewportCenter(state)
  const spanQ =
    Math.ceil(
      state.element.clientWidth /
        (hexSize * rootThree * state.world.scale.x) /
        2
    ) + 3
  const spanR =
    Math.ceil(
      state.element.clientHeight / (hexSize * 1.5 * state.world.scale.y) / 2
    ) + 3
  const grid = new Graphics()
  for (let q = localCenter.q - spanQ; q <= localCenter.q + spanQ; q += 1)
    for (let r = localCenter.r - spanR; r <= localCenter.r + spanR; r += 1) {
      const point = center({ q, r })
      grid
        .poly(polygon(point.x, point.y, hexSize - 1))
        .stroke({ width: 1, color: '#263d38', alpha: 0.45 })
    }
  layer.addChild(grid)
}

export function synchronizeHexScene(options: {
  snapshot: HexMapView
  biomes: HexBiomeCatalog
  token?: AxialCoordinate | null | undefined
  route?: readonly AxialCoordinate[] | undefined
  overlays?: readonly TravelOverlay[] | undefined
  layers: HexPixiLayers
  chunks: Map<string, HexPixiChunk>
}): void {
  clearHexPixiLayer(options.layers.overlays)
  synchronizeBiomeChunks(options)
  drawTravelOverlays(options)
}

export function drawHexTransientLayers(
  layers: HexPixiLayers,
  drawing: HexTransientDrawing
): void {
  clearHexPixiLayer(layers.preview)
  clearHexPixiLayer(layers.selection)
  const byBiome = new Map(
    drawing.biomes.biomes.map((biome) => [biome.id, biome])
  )
  if (drawing.preview.length > 0) {
    const preview = new Graphics()
    for (const coordinate of expandHexBrush(
      drawing.preview,
      drawing.brushRadius ?? 0
    ) ?? []) {
      const point = center(coordinate)
      preview.poly(polygon(point.x, point.y, hexSize - 3)).fill({
        color:
          drawing.interaction === 'erase'
            ? '#d6594c'
            : (byBiome.get(drawing.brushBiomeId ?? 'grassland')?.color ??
              '#ffffff'),
        alpha: 0.35
      })
    }
    layers.preview.addChild(preview)
  }
  if (drawing.selected) {
    const point = center(drawing.selected)
    const selection = new Graphics()
    selection
      .poly(polygon(point.x, point.y, hexSize - 2))
      .stroke({ width: 4, color: '#ffffff' })
    layers.selection.addChild(selection)
  }
}

function synchronizeBiomeChunks(options: {
  snapshot: HexMapView
  biomes: HexBiomeCatalog
  layers: HexPixiLayers
  chunks: Map<string, HexPixiChunk>
}): void {
  const byBiome = new Map(
    options.biomes.biomes.map((biome) => [biome.id, biome])
  )
  const byChunk = new Map<string, HexMapView['tiles'][number][]>()
  for (const tile of options.snapshot.tiles) {
    const id = chunkId(tile)
    const chunk = byChunk.get(id) ?? []
    chunk.push(tile)
    byChunk.set(id, chunk)
  }
  for (const [id, drawing] of options.chunks)
    if (!byChunk.has(id)) {
      options.layers.biome.removeChild(drawing.biome)
      drawing.biome.destroy({ children: true })
      options.chunks.delete(id)
    }
  for (const [id, chunk] of byChunk) {
    chunk.sort((left, right) => left.q - right.q || left.r - right.r)
    const signature = chunk
      .map((tile) => {
        const biome = byBiome.get(tile.biomeId)
        return `${tile.q}:${tile.r}:${tile.biomeId}:${biome?.color ?? ''}`
      })
      .join('|')
    if (options.chunks.get(id)?.signature === signature) continue
    const previous = options.chunks.get(id)
    if (previous) {
      options.layers.biome.removeChild(previous.biome)
      previous.biome.destroy({ children: true })
    }
    const biomeContainer = new Container()
    const graphics = new Graphics()
    for (const tile of chunk) {
      const point = center(tile)
      const biome = byBiome.get(tile.biomeId)
      if (!biome) continue
      graphics.poly(polygon(point.x, point.y, hexSize - 1)).fill(biome.color)
      graphics.stroke({ width: 1, color: '#263d38', alpha: 0.9 })
      if (tile.biomeId === 'to-be-replaced')
        graphics
          .moveTo(point.x - 8, point.y - 8)
          .lineTo(point.x + 8, point.y + 8)
          .moveTo(point.x + 8, point.y - 8)
          .lineTo(point.x - 8, point.y + 8)
          .stroke({ width: 2, color: '#ffe2f3', alpha: 0.9 })
    }
    biomeContainer.addChild(graphics)
    options.layers.biome.addChild(biomeContainer)
    options.chunks.set(id, { signature, biome: biomeContainer })
  }
}

function drawTravelOverlays(options: {
  token?: AxialCoordinate | null | undefined
  route?: readonly AxialCoordinate[] | undefined
  overlays?: readonly TravelOverlay[] | undefined
  layers: HexPixiLayers
}): void {
  const overlays = [
    ...(options.overlays ?? []),
    ...(options.token || options.route
      ? [
          {
            id: 'primary',
            label: '',
            token: options.token ?? null,
            route: options.route ?? [],
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
      options.layers.overlays.addChild(route)
    }
    if (!overlay.token) return
    const point = center(overlay.token)
    const token = new Graphics()
    token
      .circle(point.x, point.y, overlay.focused ? 11 : 8)
      .fill(overlay.focused ? '#d6594c' : '#4f96a6')
    token.circle(point.x, point.y, 4).fill('#fff4e8')
    token.stroke({ width: 2, color: '#421c19' })
    options.layers.overlays.addChild(token)
    if (!overlay.label) return
    const label = new Text({
      text: overlay.label,
      style: { fontSize: 11, fill: '#fff4d1' }
    })
    label.position.set(point.x + 12, point.y + index * 12)
    options.layers.overlays.addChild(label)
  })
}
