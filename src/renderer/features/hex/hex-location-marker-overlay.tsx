import { forwardRef, useId, useImperativeHandle, useRef } from 'react'
import type { HexMapView } from '../../../shared/contracts/hex.js'
import { center } from './hex-canvas-geometry.js'
import { builtinLocationSymbols } from './location-symbols.js'
import {
  markerLabelPath,
  markerSymbolTransform
} from './hex-location-marker-geometry.js'

export type HexMarkerOverlayCamera = Readonly<{
  x: number
  y: number
  scale: number
  width: number
  height: number
}>

export type HexLocationMarkerOverlayHandle = {
  setCamera(camera: HexMarkerOverlayCamera): void
}

export const HexLocationMarkerOverlay = forwardRef<
  HexLocationMarkerOverlayHandle,
  { snapshot: HexMapView }
>(function HexLocationMarkerOverlay(props, forwardedRef) {
  const svg = useRef<SVGSVGElement>(null)
  const world = useRef<SVGGElement>(null)
  const instanceId = useId().replaceAll(':', '')
  useImperativeHandle(
    forwardedRef,
    () => ({
      setCamera(camera) {
        svg.current?.setAttribute(
          'viewBox',
          `0 0 ${Math.max(1, camera.width)} ${Math.max(1, camera.height)}`
        )
        world.current?.setAttribute(
          'transform',
          `translate(${camera.x} ${camera.y}) scale(${camera.scale})`
        )
      }
    }),
    []
  )
  const builtinById = new Map(
    builtinLocationSymbols.map((symbol) => [symbol.id, symbol])
  )
  const markers = props.snapshot.tiles.flatMap((tile) => {
    if (!tile.location) return []
    const presentation = tile.location.marker
    const symbol =
      presentation.symbol.kind === 'custom'
        ? presentation.symbol
        : builtinById.get(presentation.symbol.id)
    return symbol ? [{ tile, presentation, symbol }] : []
  })
  return (
    <svg
      ref={svg}
      className="hex-location-overlay"
      viewBox="0 0 1 1"
      aria-hidden="true"
    >
      <g ref={world}>
        {markers.map(({ tile, presentation, symbol }) => {
          const point = center(tile)
          const baseId =
            `hex-label-${instanceId}-${props.snapshot.map.id}-${tile.q}-${tile.r}`.replace(
              /[^a-zA-Z0-9_-]/g,
              '-'
            )
          const label = (position: 'above' | 'below') => {
            const id = `${baseId}-${position}`
            return (
              <g key={position}>
                <path
                  id={id}
                  d={markerLabelPath(
                    point,
                    presentation.title,
                    presentation.symbolSize,
                    presentation.labelCurve,
                    position
                  )}
                  fill="none"
                />
                <text className="hex-location-label">
                  <textPath
                    href={`#${id}`}
                    startOffset="50%"
                    textAnchor="middle"
                  >
                    {presentation.title}
                  </textPath>
                </text>
              </g>
            )
          }
          return (
            <g key={`${tile.q}:${tile.r}`}>
              <path
                className="hex-location-symbol"
                d={symbol.pathData}
                transform={markerSymbolTransform(
                  point,
                  presentation.symbolSize,
                  symbol.viewBox
                )}
                fillRule={symbol.fillRule}
              />
              {(presentation.labelPosition === 'above' ||
                presentation.labelPosition === 'both') &&
                label('above')}
              {(presentation.labelPosition === 'below' ||
                presentation.labelPosition === 'both') &&
                label('below')}
            </g>
          )
        })}
      </g>
    </svg>
  )
})
