import { Application, Container, Graphics } from 'pixi.js'
import { useEffect, useRef, useState, type ReactElement } from 'react'
import {
  createSparseQualificationCells,
  createSparseCellIndex,
  cullIndexedCells,
  countFacts
} from './sparse-pixi-qualification.js'
import {
  downloadRawQualificationSamples,
  FrameMeasurementTracker,
  InteractionSampler,
  recordedRunCount
} from '../spatial-3d/render-qualification-metrics.js'
import {
  ContextRecoveryTracker,
  exerciseWebglContextLoss,
  webgl2Description
} from '../spatial-3d/webgl-context.js'
import { type SpatialQualificationModel } from '../spatial-qualification-model.js'

const cells = createSparseQualificationCells()
const cellIndex = createSparseCellIndex(cells)

export function PixiQualificationView({
  model
}: {
  readonly model: SpatialQualificationModel
}): ReactElement {
  const host = useRef<HTMLDivElement>(null)
  const downloadSamples = useRef<(() => void) | null>(null)
  const recovery = useRef(new ContextRecoveryTracker())
  const [downloadReady, setDownloadReady] = useState(false)
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
        antialias: false,
        preference: 'webgl'
      })
      .then(() => {
        if (disposed) return
        element.append(application.canvas)
        setContextCanvas(application.canvas)
        const backend = webgl2Description(application.canvas)
        if (backend === undefined) {
          setStatus(
            '2D qualification requires WebGL 2; this device is unavailable.'
          )
          application.destroy(true, { children: true })
          return
        }
        const layer = new Container()
        layer.scale.set(0.4)
        const graphic = new Graphics()
        layer.addChild(graphic)
        application.stage.addChild(layer)
        const viewport = { ...model.state.viewport }
        const interactionSampler = new InteractionSampler()
        const inputToPresentation: number[] = []
        const frameTracker = new FrameMeasurementTracker()
        downloadSamples.current = () => {
          downloadRawQualificationSamples('m1-pixi-pan-raw.json', {
            pixiPanFrameWork: interactionSampler.samples,
            pixiPanInputToPresentation: inputToPresentation
          })
        }
        const postrenderListener = {
          postrender: () => {
            recovery.current.observedRerender()
            const timing = frameTracker.afterRender()
            if (timing === undefined) return
            recovery.current.observedNextInteraction()
            if (inputToPresentation.length < recordedRunCount)
              inputToPresentation.push(timing.inputToPresentationMs)
            const result = interactionSampler.record(timing.frameWorkMs)
            if (result !== undefined) {
              setDownloadReady(true)
              setStatus(
                `2D pan frame-work p95 ${result.p95Ms.toFixed(2)} ms after ${recordedRunCount} samples.`
              )
            }
          }
        }
        application.renderer.runners.postrender.add(postrenderListener)
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
        const unsubscribeModel = model.subscribe((state) => {
          Object.assign(viewport, state.viewport)
          redraw()
        })
        const pan = (event: KeyboardEvent): void => {
          const startedAt = performance.now()
          const distance = 24
          let deltaX = 0
          let deltaY = 0
          if (event.key === 'ArrowLeft') deltaX = -distance
          else if (event.key === 'ArrowRight') deltaX = distance
          else if (event.key === 'ArrowUp') deltaY = -distance
          else if (event.key === 'ArrowDown') deltaY = distance
          else return
          event.preventDefault()
          if (!frameTracker.begin(startedAt)) return
          model.pan(deltaX, deltaY)
          application.ticker.addOnce(() => {
            frameTracker.arm()
            frameTracker.beforeRender()
          })
        }
        const contextLost = (event: Event): void => {
          event.preventDefault()
          recovery.current.observedLoss()
          setStatus('2D graphics context lost; waiting for restoration.')
        }
        const contextRestored = (): void => {
          recovery.current.observedRestoration()
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
          unsubscribeModel()
          application.renderer.runners.postrender.remove(postrenderListener)
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
      downloadSamples.current = null
      application.destroy(true, { children: true })
    }
  }, [model])
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
            !exerciseWebglContextLoss(contextCanvas, () =>
              recovery.current.requested()
            )
          )
            setStatus(
              'This browser does not expose the WebGL context-loss test extension.'
            )
        }}
      >
        Exercise 2D WebGL context loss and restoration
      </button>
      <button
        type="button"
        onClick={() => downloadSamples.current?.()}
        disabled={!downloadReady}
      >
        Download complete 2D raw timing samples
      </button>
    </>
  )
}
