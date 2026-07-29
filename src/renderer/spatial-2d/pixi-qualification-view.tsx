import { Application, Container, Graphics } from 'pixi.js'
import { useEffect, useRef, useState, type ReactElement } from 'react'
import {
  createSparseQualificationCells,
  cullCells
} from './sparse-pixi-qualification.js'

const cells = createSparseQualificationCells()

export function PixiQualificationView(): ReactElement {
  const host = useRef<HTMLDivElement>(null)
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
        const layer = new Container()
        const visible = cullCells(cells, {
          x: 0,
          y: 0,
          width: 640,
          height: 360
        })
        for (const cell of visible) {
          const graphic = new Graphics()
            .rect(cell.x, cell.y, 2, 2)
            .fill(cell.fact ? '#a8d7c7' : '#3c5950')
          layer.addChild(graphic)
        }
        application.stage.addChild(layer)
        const pan = (event: KeyboardEvent): void => {
          const distance = 24
          if (event.key === 'ArrowLeft') layer.x += distance
          else if (event.key === 'ArrowRight') layer.x -= distance
          else if (event.key === 'ArrowUp') layer.y += distance
          else if (event.key === 'ArrowDown') layer.y -= distance
          else return
          event.preventDefault()
          setStatus('2D view moved with keyboard.')
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
        setStatus('2D qualification view ready. Use arrow keys to pan.')
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
    </>
  )
}
