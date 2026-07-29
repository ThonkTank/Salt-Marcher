import { Application, Container, Graphics } from 'pixi.js'
import { useEffect, useRef, type ReactElement } from 'react'
import {
  createSparseQualificationCells,
  cullCells
} from './sparse-pixi-qualification.js'

const cells = createSparseQualificationCells()

export function PixiQualificationView(): ReactElement {
  const host = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const element = host.current
    if (element === null) return
    const application = new Application()
    let disposed = false
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
      })
      .catch(() => application.destroy(true, { children: true }))
    return () => {
      disposed = true
      application.destroy(true, { children: true })
    }
  }, [])
  return <div ref={host} className="qualification-canvas" aria-hidden="true" />
}
