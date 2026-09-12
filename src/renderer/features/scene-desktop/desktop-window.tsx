import { DesktopTitleActionsContext } from './desktop-title-actions-context.js'
import {
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode
} from 'react'
import type {
  DesktopBounds,
  SceneDesktopWindow
} from '../../../shared/contracts/scene-desktop.js'
import { message } from '../../i18n/session-runtime.de.js'
import {
  alignDesktopBounds,
  desktopSnapPreview,
  desktopWindowBounds,
  type DesktopSize,
  type SnapSide
} from './desktop-geometry.js'
import type { DesktopAction } from './desktop-state.js'

export function DesktopWindow(props: {
  window: SceneDesktopWindow
  size: DesktopSize
  others: readonly DesktopBounds[]
  title?: string
  zIndex?: number
  raised: boolean
  disabled: boolean
  dispatch: (action: DesktopAction) => void
  preview: (side: SnapSide | null) => void
  children: ReactNode
}) {
  const [titleActions, setTitleActions] = useState<HTMLElement | null>(null)
  const [gestureBounds, setGestureBounds] = useState<DesktopBounds | null>(null)
  const element = useRef<HTMLElement>(null)
  const cancelGesture = useRef<(() => void) | null>(null)
  useEffect(() => () => cancelGesture.current?.(), [])
  const bounds = gestureBounds ?? desktopWindowBounds(props.window, props.size)

  function start(event: PointerEvent<HTMLElement>, edge: string | null) {
    if (event.button !== 0 || props.disabled) return
    if (
      !edge &&
      (event.target as HTMLElement).closest('button, summary, details')
    )
      return
    if (props.window.maximized) return
    event.preventDefault()
    cancelGesture.current?.()
    const target = event.currentTarget
    target.setPointerCapture(event.pointerId)
    const initial = bounds
    const startX = event.clientX
    const startY = event.clientY
    let next = initial
    let side: SnapSide | null = null
    let moved = false
    function moving(pointer: globalThis.PointerEvent) {
      if (pointer.pointerId !== event.pointerId) return
      const dx = pointer.clientX - startX
      const dy = pointer.clientY - startY
      moved ||= dx !== 0 || dy !== 0
      if (!edge) {
        next = alignDesktopBounds(
          { ...initial, x: initial.x + dx, y: initial.y + dy },
          props.others,
          props.size
        )
        const rect = element.current?.parentElement?.getBoundingClientRect()
        side = rect
          ? desktopSnapPreview(pointer.clientX - rect.left, props.size)
          : null
        props.preview(side)
      } else {
        const minWidth = Math.min(240, props.size.width)
        const minHeight = Math.min(160, props.size.height)
        let { x, y, width, height } = initial
        if (edge.includes('e'))
          width = Math.max(minWidth, Math.min(props.size.width - x, width + dx))
        if (edge.includes('s'))
          height = Math.max(
            minHeight,
            Math.min(props.size.height - y, height + dy)
          )
        if (edge.includes('w')) {
          x = Math.max(
            0,
            Math.min(initial.x + dx, initial.x + initial.width - minWidth)
          )
          width = initial.x + initial.width - x
        }
        if (edge.includes('n')) {
          y = Math.max(
            0,
            Math.min(initial.y + dy, initial.y + initial.height - minHeight)
          )
          height = initial.y + initial.height - y
        }
        next = { x, y, width, height }
      }
      setGestureBounds(next)
    }
    function cleanup() {
      target.removeEventListener('pointermove', moving)
      target.removeEventListener('pointerup', complete)
      target.removeEventListener('pointercancel', complete)
      target.removeEventListener('lostpointercapture', complete)
      cancelGesture.current = null
      props.preview(null)
      if (target.hasPointerCapture(event.pointerId))
        target.releasePointerCapture(event.pointerId)
    }
    cancelGesture.current = cleanup
    function complete(pointer: globalThis.PointerEvent) {
      if (pointer.pointerId !== event.pointerId) return
      cleanup()
      props.preview(null)
      setGestureBounds(null)
      if (pointer.type !== 'pointerup' || !moved) return
      if (side) props.dispatch({ type: 'snap', id: props.window.id, side })
      else
        props.dispatch({
          type: 'bounds',
          id: props.window.id,
          bounds: {
            x: Math.round(next.x),
            y: Math.round(next.y),
            width: Math.max(240, Math.round(next.width)),
            height: Math.max(160, Math.round(next.height))
          }
        })
    }
    target.addEventListener('pointermove', moving)
    target.addEventListener('pointerup', complete)
    target.addEventListener('pointercancel', complete)
    target.addEventListener('lostpointercapture', complete)
  }

  function resize(event: PointerEvent<HTMLElement>) {
    start(event, event.currentTarget.dataset['edge'] ?? null)
  }

  return (
    <section
      ref={element}
      hidden={props.window.minimized}
      className={`desktop-window${props.raised ? ' raised' : ''}`}
      data-window-id={props.window.id}
      aria-label={props.title ?? message('desktop.overview')}
      tabIndex={-1}
      style={{
        zIndex: props.zIndex,
        ...(gestureBounds
          ? {
              left: gestureBounds.x,
              top: gestureBounds.y,
              width: gestureBounds.width,
              height: gestureBounds.height,
              maxWidth: '100%',
              maxHeight: '100%'
            }
          : props.window.maximized
            ? {
                left: 0,
                top: 0,
                width: '100%',
                height: '100%'
              }
            : props.window.snap
              ? {
                  left: props.window.snap === 'left' ? 0 : '50%',
                  top: 0,
                  width: '50%',
                  height: '100%'
                }
              : {
                  left: `clamp(0px, ${props.window.bounds.x}px, max(0px, calc(100% - ${props.window.bounds.width}px)))`,
                  top: `clamp(0px, ${props.window.bounds.y}px, max(0px, calc(100% - ${props.window.bounds.height}px)))`,
                  width: props.window.bounds.width,
                  height: props.window.bounds.height,
                  maxWidth: '100%',
                  maxHeight: '100%'
                })
      }}
      onFocus={() => {
        if (!props.raised)
          props.dispatch({ type: 'raise', id: props.window.id })
      }}
      onPointerDown={() => {
        if (!props.raised)
          props.dispatch({ type: 'raise', id: props.window.id })
      }}
    >
      <header
        className="desktop-window-title"
        onPointerDown={(event) => start(event, null)}
      >
        <button
          type="button"
          className="desktop-drag-keyboard"
          aria-label={message('desktop.moveKeyboard')}
          onPointerDown={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            if (
              !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(
                event.key
              ) ||
              props.disabled
            )
              return
            event.preventDefault()
            const amount = event.shiftKey ? 40 : 10
            const next = { ...props.window.bounds }
            if (event.key === 'ArrowLeft') next.x = Math.max(0, next.x - amount)
            if (event.key === 'ArrowRight')
              next.x = Math.min(100_000, next.x + amount)
            if (event.key === 'ArrowUp') next.y = Math.max(0, next.y - amount)
            if (event.key === 'ArrowDown')
              next.y = Math.min(100_000, next.y + amount)
            props.dispatch({
              type: 'bounds',
              id: props.window.id,
              bounds: next
            })
          }}
        >
          ↔
        </button>
        <h2>{props.title ?? message('desktop.overview')}</h2>
        <div className="desktop-title-actions" ref={setTitleActions} />
        <details
          className="desktop-arrange"
          onClick={(event) => {
            if ((event.target as HTMLElement).closest('button'))
              event.currentTarget.open = false
          }}
          onBlur={(event) => {
            if (
              !event.currentTarget.contains(event.relatedTarget as Node | null)
            )
              event.currentTarget.open = false
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.currentTarget.open = false
              event.currentTarget.querySelector('summary')?.focus()
            }
          }}
        >
          <summary aria-label={message('desktop.arrange')}>⋮</summary>
          <div>
            <button
              disabled={props.disabled}
              onClick={() =>
                props.dispatch({
                  type: 'snap',
                  id: props.window.id,
                  side: 'left'
                })
              }
            >
              {message('desktop.left')}
            </button>
            <button
              disabled={props.disabled}
              onClick={() =>
                props.dispatch({
                  type: 'snap',
                  id: props.window.id,
                  side: 'right'
                })
              }
            >
              {message('desktop.right')}
            </button>
            <button
              disabled={props.disabled}
              onClick={() =>
                props.dispatch({
                  type: 'snap',
                  id: props.window.id,
                  side: null
                })
              }
            >
              {message('desktop.free')}
            </button>
          </div>
        </details>
        <button
          disabled={props.disabled}
          aria-label={message('desktop.minimize')}
          onClick={() =>
            props.dispatch({ type: 'minimize', id: props.window.id })
          }
        >
          −
        </button>
        <button
          disabled={props.disabled}
          aria-label={message(
            props.window.maximized ? 'desktop.restore' : 'desktop.maximize'
          )}
          onClick={() =>
            props.dispatch({ type: 'maximize', id: props.window.id })
          }
        >
          □
        </button>
        <button
          disabled={props.disabled}
          aria-label={message('desktop.close')}
          onClick={() => props.dispatch({ type: 'close', id: props.window.id })}
        >
          ×
        </button>
      </header>
      <DesktopTitleActionsContext.Provider value={titleActions}>
        <div className="desktop-window-content">{props.children}</div>
      </DesktopTitleActionsContext.Provider>
      {!props.window.maximized &&
        ['n', 'e', 's', 'w', 'ne', 'se', 'sw', 'nw'].map((edge) => (
          <div
            key={edge}
            className={`desktop-resize ${edge}`}
            data-edge={edge}
            onPointerDown={resize}
          />
        ))}
      <button
        className="desktop-resize-keyboard"
        aria-label={message('desktop.resizeKeyboard')}
        onKeyDown={(event) => {
          if (
            !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(
              event.key
            ) ||
            props.disabled
          )
            return
          event.preventDefault()
          props.dispatch({
            type: 'bounds',
            id: props.window.id,
            bounds: {
              ...props.window.bounds,
              width: Math.min(
                100_000,
                Math.max(
                  240,
                  props.window.bounds.width +
                    (event.key === 'ArrowRight'
                      ? 20
                      : event.key === 'ArrowLeft'
                        ? -20
                        : 0)
                )
              ),
              height: Math.min(
                100_000,
                Math.max(
                  160,
                  props.window.bounds.height +
                    (event.key === 'ArrowDown'
                      ? 20
                      : event.key === 'ArrowUp'
                        ? -20
                        : 0)
                )
              )
            }
          })
        }}
      >
        ◢
      </button>
    </section>
  )
}
