import { Application, Container, Graphics } from 'pixi.js'
import { useEffect, useRef, useState, type ReactElement } from 'react'
import {
  createSparseQualificationCells,
  createSparseCellIndex,
  cullIndexedCells,
  countFacts,
  qualificationViewport
} from './sparse-pixi-qualification.js'
import {
  InteractionSampler,
  recordedRunCount
} from '../spatial-3d/render-qualification-metrics.js'
import { exerciseWebglContextLoss } from '../spatial-3d/webgl-context.js'

const cells = createSparseQualificationCells()
const cellIndex = createSparseCellIndex(cells)

export function PixiQualificationView(): ReactElement {
  const host = useRef<HTMLDivElement>(null)
  const [contextCanvas, setContextCanvas] = useState<HTMLCanvasElement | null>(
    null
  )
  const [status, setStatus] = useState('Preparing 2D qualification view.')
  useEffect(() => {
    const element = host.current
    if (element === null) return
    const application = new Application()
    let disposed = false
    let detachListeners = (): void => undefined
    void application
      .init({
        width: 640,
        height: 360,
        background: '#0c1513',
        antialias: false
      })
      .then(() => {
        if (disposed) return
        element.append(application.canvas)
        setContextCanvas(application.canvas)
        const layer = new Container()
        layer.scale.set(0.4)
        const graphic = new Graphics()
        layer.addChild(graphic)
        application.stage.addChild(layer)
        const viewport = { ...qualificationViewport() }
        const interactionSampler = new InteractionSampler()
        const redraw = (): void => {
          const visible = cullIndexedCells(cellIndex, viewport)
          graphic.clear()
          for (const cell of visible) {
            graphic.rect(cell.x - viewport.x, cell.y - viewport.y, 2, 2)
          }
          graphic.fill('#3c5950')
          for (const cell of visible) {
            if (cell.fact) {
              graphic.rect(cell.x - viewport.x, cell.y - viewport.y, 3, 3)
            }
          }
          graphic.fill('#a8d7c7')
          setStatus(
            `2D view ready: ${countFacts(visible).toLocaleString()} facts visible. Use arrow keys to pan.`
          )
        }
        redraw()
        const pan = (event: KeyboardEvent): void => {
          const startedAt = performance.now()
          const distance = 24
          if (event.key === 'ArrowLeft') viewport.x -= distance
          else if (event.key === 'ArrowRight') viewport.x += distance
          else if (event.key === 'ArrowUp') viewport.y -= distance
          else if (event.key === 'ArrowDown') viewport.y += distance
          else return
          viewport.x = Math.max(0, viewport.x)
          viewport.y = Math.max(0, viewport.y)
          event.preventDefault()
          redraw()
          application.ticker.addOnce(() => {
            const result = interactionSampler.record(
              performance.now() - startedAt
            )
            if (result !== undefined) {
              setStatus(
                `2D pan p95 ${result.p95Ms.toFixed(2)} ms after ${recordedRunCount} presented frames (${result.passes ? 'passes' : 'fails'}).`
              )
            }
          })
        }
        const contextLost = (event: Event): void => {
          event.preventDefault()
          setStatus('2D graphics context lost; waiting for restoration.')
        }
        const contextRestored = (): void => {
          setStatus('2D graphics context restored.')
        }
        element.addEventListener('keydown', pan)
        application.canvas.addEventListener('webglcontextlost', contextLost)
        application.canvas.addEventListener(
          'webglcontextrestored',
          contextRestored
        )
        detachListeners = (): void => {
          element.removeEventListener('keydown', pan)
          application.canvas.removeEventListener(
            'webglcontextlost',
            contextLost
          )
          application.canvas.removeEventListener(
            'webglcontextrestored',
            contextRestored
          )
        }
      })
      .catch(() => {
        setStatus('2D graphics are unavailable on this device.')
        application.destroy(true, { children: true })
      })
    return () => {
      disposed = true
      setContextCanvas(null)
      detachListeners()
      application.destroy(true, { children: true })
    }
  }, [])
  return (
    <>
      <div
        ref={host}
        className="qualification-canvas"
        tabIndex={0}
        role="application"
        aria-label="2D sparse-map qualification view"
      />
      <p aria-live="polite">{status}</p>
      <button
        type="button"
        onClick={() => {
          if (
            contextCanvas === null ||
            !exerciseWebglContextLoss(contextCanvas)
          )
            setStatus(
              'This browser does not expose the WebGL context-loss test extension.'
            )
        }}
      >
        Exercise 2D WebGL context loss and restoration
      </button>
    </>
  )
}
