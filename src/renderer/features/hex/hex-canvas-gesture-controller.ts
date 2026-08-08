import type { AxialCoordinate } from '../../../shared/contracts/hex.js'
import { coordinateId } from './hex-canvas-geometry.js'

type Interaction = 'select' | 'paint' | 'erase' | 'location' | undefined

/** Owns pointer gesture state without depending on the Pixi adapter. */
export function attachHexCanvasGestures(options: {
  canvas: HTMLCanvasElement
  interaction: () => Interaction
  coordinateFor: (event: PointerEvent | MouseEvent) => AxialCoordinate
  onPan: (deltaX: number, deltaY: number) => void
  onPanEnd: () => void
  onStrokePreview: (path: readonly AxialCoordinate[]) => void
  onStrokeComplete: (path: readonly AxialCoordinate[]) => void
  onStrokeCancel: () => void
  onSelect: (coordinate: AxialCoordinate) => void
  onZoom: (event: WheelEvent) => void
}): () => void {
  const { canvas } = options
  let dragging = false
  let stroking = false
  let last = { x: 0, y: 0 }
  let stroke: AxialCoordinate[] = []

  const pointerDown = (event: PointerEvent) => {
    if (event.button === 1) {
      dragging = true
      last = { x: event.clientX, y: event.clientY }
      canvas.setPointerCapture?.(event.pointerId)
      event.preventDefault()
      return
    }
    const interaction = options.interaction()
    if (
      event.button !== 0 ||
      (interaction !== 'paint' && interaction !== 'erase')
    )
      return
    stroking = true
    stroke = [options.coordinateFor(event)]
    options.onSelect(stroke[0]!)
    options.onStrokePreview(stroke)
    canvas.setPointerCapture?.(event.pointerId)
    event.preventDefault()
  }
  const pointerMove = (event: PointerEvent) => {
    if (dragging) {
      options.onPan(event.clientX - last.x, event.clientY - last.y)
      last = { x: event.clientX, y: event.clientY }
      return
    }
    if (!stroking) return
    const coordinate = options.coordinateFor(event)
    if (coordinateId(stroke.at(-1)!) === coordinateId(coordinate)) return
    stroke = [...stroke, coordinate]
    options.onStrokePreview(stroke)
  }
  const pointerUp = (event: PointerEvent) => {
    if (dragging) {
      dragging = false
      options.onPanEnd()
    }
    if (stroking) {
      stroking = false
      const completed = stroke
      stroke = []
      options.onStrokePreview([])
      options.onStrokeComplete(completed)
    }
    canvas.releasePointerCapture?.(event.pointerId)
  }
  const pointerCancel = (event: PointerEvent) => {
    dragging = false
    stroking = false
    stroke = []
    options.onStrokeCancel()
    canvas.releasePointerCapture?.(event.pointerId)
  }
  const click = (event: MouseEvent) => {
    const interaction = options.interaction()
    if (
      event.button !== 0 ||
      interaction === 'paint' ||
      interaction === 'erase'
    )
      return
    options.onSelect(options.coordinateFor(event))
  }
  const wheel = (event: WheelEvent) => {
    event.preventDefault()
    options.onZoom(event)
  }

  canvas.addEventListener('pointerdown', pointerDown)
  canvas.addEventListener('pointermove', pointerMove)
  canvas.addEventListener('pointerup', pointerUp)
  canvas.addEventListener('pointercancel', pointerCancel)
  canvas.addEventListener('lostpointercapture', pointerCancel)
  canvas.addEventListener('click', click)
  canvas.addEventListener('wheel', wheel, { passive: false })
  return () => {
    canvas.removeEventListener('pointerdown', pointerDown)
    canvas.removeEventListener('pointermove', pointerMove)
    canvas.removeEventListener('pointerup', pointerUp)
    canvas.removeEventListener('pointercancel', pointerCancel)
    canvas.removeEventListener('lostpointercapture', pointerCancel)
    canvas.removeEventListener('click', click)
    canvas.removeEventListener('wheel', wheel)
  }
}
