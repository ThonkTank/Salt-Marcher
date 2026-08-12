import type { AxialCoordinate } from '../../../shared/contracts/hex.js'
import { coordinateId } from './hex-canvas-geometry.js'

type Interaction = 'select' | 'paint' | 'erase' | 'location' | undefined

type GestureState =
  | Readonly<{ kind: 'idle' }>
  | Readonly<{
      kind: 'panning'
      pointerId: number
      lastX: number
      lastY: number
    }>
  | Readonly<{
      kind: 'stroking'
      pointerId: number
      path: readonly AxialCoordinate[]
    }>
  | Readonly<{
      kind: 'token-candidate'
      pointerId: number
      originX: number
      originY: number
    }>
  | Readonly<{ kind: 'token-dragging'; pointerId: number }>

/** Owns pointer gesture state without depending on the Pixi adapter. */
export function attachHexCanvasGestures(options: {
  canvas: HTMLCanvasElement
  interaction: () => Interaction
  draggableToken?: () => AxialCoordinate | null
  coordinateFor: (event: PointerEvent | MouseEvent) => AxialCoordinate
  onPan: (deltaX: number, deltaY: number) => void
  onPanEnd: () => void
  onStrokePreview: (path: readonly AxialCoordinate[]) => void
  onStrokeComplete: (path: readonly AxialCoordinate[]) => void
  onStrokeCancel: () => void
  onSelect: (coordinate: AxialCoordinate) => void
  onTokenPreview?: (coordinate: AxialCoordinate | null) => void
  onTokenDrop?: (coordinate: AxialCoordinate) => void
  onZoom: (event: WheelEvent) => void
}): () => void {
  const { canvas } = options
  let gesture: GestureState = { kind: 'idle' }
  let suppressClick = false

  const pointerDown = (event: PointerEvent) => {
    if (gesture.kind !== 'idle') return
    if (event.button === 1) {
      gesture = {
        kind: 'panning',
        pointerId: event.pointerId,
        lastX: event.clientX,
        lastY: event.clientY
      }
      canvas.setPointerCapture?.(event.pointerId)
      event.preventDefault()
      return
    }
    const interaction = options.interaction()
    const coordinate = options.coordinateFor(event)
    const token = options.draggableToken?.()
    if (
      event.button === 0 &&
      interaction !== 'paint' &&
      interaction !== 'erase' &&
      token !== null &&
      token !== undefined &&
      coordinateId(token) === coordinateId(coordinate) &&
      options.onTokenDrop
    ) {
      gesture = {
        kind: 'token-candidate',
        pointerId: event.pointerId,
        originX: event.clientX,
        originY: event.clientY
      }
      canvas.setPointerCapture?.(event.pointerId)
      event.preventDefault()
      return
    }
    if (
      event.button !== 0 ||
      (interaction !== 'paint' && interaction !== 'erase')
    )
      return
    const strokeCoordinate = options.coordinateFor(event)
    gesture = {
      kind: 'stroking',
      pointerId: event.pointerId,
      path: [strokeCoordinate]
    }
    options.onSelect(strokeCoordinate)
    options.onStrokePreview(gesture.path)
    canvas.setPointerCapture?.(event.pointerId)
    event.preventDefault()
  }
  const pointerMove = (event: PointerEvent) => {
    if (
      'pointerId' in gesture &&
      event.pointerId !== undefined &&
      gesture.pointerId !== event.pointerId
    )
      return
    if (gesture.kind === 'token-candidate') {
      if (
        Math.hypot(
          event.clientX - gesture.originX,
          event.clientY - gesture.originY
        ) < 4
      )
        return
      gesture = { kind: 'token-dragging', pointerId: gesture.pointerId }
      options.onTokenPreview?.(options.coordinateFor(event))
      return
    }
    if (gesture.kind === 'token-dragging') {
      options.onTokenPreview?.(options.coordinateFor(event))
      return
    }
    if (gesture.kind === 'panning') {
      options.onPan(
        event.clientX - gesture.lastX,
        event.clientY - gesture.lastY
      )
      gesture = {
        ...gesture,
        lastX: event.clientX,
        lastY: event.clientY
      }
      return
    }
    if (gesture.kind !== 'stroking') return
    const coordinate = options.coordinateFor(event)
    if (coordinateId(gesture.path.at(-1)!) === coordinateId(coordinate)) return
    gesture = { ...gesture, path: [...gesture.path, coordinate] }
    options.onStrokePreview(gesture.path)
  }
  const pointerUp = (event: PointerEvent) => {
    if (
      'pointerId' in gesture &&
      event.pointerId !== undefined &&
      gesture.pointerId !== event.pointerId
    )
      return
    if (gesture.kind === 'token-candidate') {
      gesture = { kind: 'idle' }
      canvas.releasePointerCapture?.(event.pointerId)
      return
    }
    if (gesture.kind === 'token-dragging') {
      const coordinate = options.coordinateFor(event)
      options.onTokenPreview?.(coordinate)
      options.onTokenDrop?.(coordinate)
      suppressClick = true
    } else if (gesture.kind === 'panning') {
      options.onPanEnd()
    } else if (gesture.kind === 'stroking') {
      const completed = gesture.path
      options.onStrokePreview([])
      options.onStrokeComplete(completed)
    }
    gesture = { kind: 'idle' }
    canvas.releasePointerCapture?.(event.pointerId)
  }
  const pointerCancel = (event: PointerEvent) => {
    if (
      'pointerId' in gesture &&
      event.pointerId !== undefined &&
      gesture.pointerId !== event.pointerId
    )
      return
    if (gesture.kind === 'stroking') options.onStrokeCancel()
    if (gesture.kind === 'token-candidate' || gesture.kind === 'token-dragging')
      options.onTokenPreview?.(null)
    gesture = { kind: 'idle' }
    canvas.releasePointerCapture?.(event.pointerId)
  }
  const click = (event: MouseEvent) => {
    if (suppressClick) {
      suppressClick = false
      return
    }
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
