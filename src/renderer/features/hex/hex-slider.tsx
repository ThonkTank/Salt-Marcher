import { useRef, type KeyboardEvent, type PointerEvent } from 'react'
import { sliderValueAtClientX } from './hex-slider-geometry.js'

export function HexSlider(props: {
  value: number
  min: number
  max: number
  ariaLabel: string
  ticks?: number
  centerMark?: boolean
  disabled?: boolean
  onChange: (value: number) => void
  onCommit?: () => void
}) {
  const track = useRef<HTMLDivElement>(null)
  const dragging = useRef<number | null>(null)
  const percent = ((props.value - props.min) / (props.max - props.min)) * 100
  const updateFromPointer = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = track.current?.getBoundingClientRect()
    if (!bounds) return
    props.onChange(
      sliderValueAtClientX(
        event.clientX,
        bounds.left,
        bounds.width,
        props.min,
        props.max
      )
    )
  }
  const pointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (props.disabled || event.button !== 0) return
    updateFromPointer(event)
    dragging.current = event.pointerId
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // The value is already applied; capture is only a drag enhancement.
    }
  }
  const pointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (dragging.current === event.pointerId) updateFromPointer(event)
  }
  const finish = (event: PointerEvent<HTMLDivElement>) => {
    if (dragging.current !== event.pointerId) return
    updateFromPointer(event)
    dragging.current = null
    props.onCommit?.()
  }
  const keyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const delta =
      event.key === 'ArrowLeft' || event.key === 'ArrowDown'
        ? -1
        : event.key === 'ArrowRight' || event.key === 'ArrowUp'
          ? 1
          : 0
    if (delta === 0 || props.disabled) return
    event.preventDefault()
    props.onChange(
      Math.max(props.min, Math.min(props.max, props.value + delta))
    )
    props.onCommit?.()
  }
  return (
    <div
      ref={track}
      className="hex-slider"
      role="slider"
      tabIndex={props.disabled ? -1 : 0}
      aria-label={props.ariaLabel}
      aria-valuemin={props.min}
      aria-valuemax={props.max}
      aria-valuenow={props.value}
      aria-disabled={props.disabled || undefined}
      onKeyDown={keyDown}
      onBlur={props.onCommit}
      onPointerDown={pointerDown}
      onPointerMove={pointerMove}
      onPointerUp={finish}
      onPointerCancel={() => {
        dragging.current = null
      }}
    >
      <span className="hex-slider-track" aria-hidden="true" />
      <span
        className="hex-slider-fill"
        style={{ width: `${percent}%` }}
        aria-hidden="true"
      />
      {props.ticks && (
        <span className="hex-slider-ticks" aria-hidden="true">
          {Array.from({ length: props.ticks }, (_, index) => (
            <i key={index} />
          ))}
        </span>
      )}
      {props.centerMark && (
        <span className="hex-slider-center" aria-hidden="true" />
      )}
      <span
        className="hex-slider-thumb"
        style={{ left: `${percent}%` }}
        aria-hidden="true"
      />
    </div>
  )
}
