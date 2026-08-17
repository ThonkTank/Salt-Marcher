import {
  useEffect,
  useRef,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent
} from 'react'

export function ResizeSeparator(props: {
  label: string
  edge: 'left' | 'right'
  value: number
  minimum: number
  maximum: number
  changed: (value: number) => void
  className?: string
}) {
  const cleanup = useRef<(() => void) | null>(null)
  useEffect(() => () => cleanup.current?.(), [])
  const bounded = (value: number) =>
    Math.round(Math.max(props.minimum, Math.min(props.maximum, value)))
  const pointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    const separator = event.currentTarget
    const parent = separator.parentElement
    if (!parent) return
    const pointerId = event.pointerId
    const bounds = parent.getBoundingClientRect()
    const update = (clientX: number) =>
      props.changed(
        bounded(
          props.edge === 'left' ? clientX - bounds.left : bounds.right - clientX
        )
      )
    const move = (next: PointerEvent) => update(next.clientX)
    const stop = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
      window.removeEventListener('pointercancel', stop)
      if (separator.hasPointerCapture?.(pointerId))
        separator.releasePointerCapture(pointerId)
      cleanup.current = null
    }
    cleanup.current?.()
    cleanup.current = stop
    update(event.clientX)
    separator.setPointerCapture?.(pointerId)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop, { once: true })
    window.addEventListener('pointercancel', stop, { once: true })
  }
  const keyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const direction =
      event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0
    if (!direction) return
    event.preventDefault()
    const signed = props.edge === 'left' ? direction : -direction
    props.changed(bounded(props.value + signed * 10))
  }
  return (
    <div
      className={props.className}
      role="separator"
      aria-label={props.label}
      aria-orientation="vertical"
      aria-valuemin={props.minimum}
      aria-valuemax={props.maximum}
      aria-valuenow={props.value}
      tabIndex={0}
      onPointerDown={pointerDown}
      onKeyDown={keyDown}
    />
  )
}
