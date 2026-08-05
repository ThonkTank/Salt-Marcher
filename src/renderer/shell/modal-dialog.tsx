import {
  createContext,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  type ButtonHTMLAttributes,
  type FormEventHandler,
  type ReactNode,
  type RefObject
} from 'react'
import { createPortal } from 'react-dom'
import { ModalLayerContext } from './modal-layer.js'
import './modal-dialog.css'

const focusableSelector = [
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[href]',
  '[tabindex]:not([tabindex="-1"])'
].join(',')

const ModalInstanceContext = createContext<{
  close: () => void
  busy: boolean
} | null>(null)

export function ModalDialog(props: {
  children: ReactNode
  className: string
  onClose: () => void
  ariaLabel?: string
  labelledBy?: string
  backdropClassName?: string
  busy?: boolean
  form?: boolean
  role?: 'dialog' | 'alertdialog'
  onSubmit?: FormEventHandler<HTMLFormElement>
}) {
  const layer = useContext(ModalLayerContext)
  if (!layer)
    throw new Error('ModalDialog must be rendered inside ModalLayerProvider.')
  const { register, stack, unregister } = layer
  const busy = props.busy ?? false
  const onClose = props.onClose
  const id = useId()
  const dialog = useRef<HTMLElement>(null)
  const restoreFocus = useRef<HTMLElement | null>(null)
  const focused = useRef(false)
  const closing = useRef(false)
  const top = stack.at(-1) === id

  function trapTab(event: globalThis.KeyboardEvent) {
    const focusable = [
      ...(dialog.current?.querySelectorAll<HTMLElement>(focusableSelector) ??
        [])
    ]
    if (focusable.length === 0) {
      event.preventDefault()
      dialog.current?.focus()
      return
    }
    const first = focusable[0]
    const last = focusable.at(-1)
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last?.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first?.focus()
    }
  }

  useLayoutEffect(() => {
    restoreFocus.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    register(id)
    return () => {
      closing.current = true
      unregister(id)
      restoreFocus.current?.focus()
    }
  }, [id, register, unregister])

  useEffect(() => {
    if (!top) return
    if (!focused.current) {
      const first =
        dialog.current?.querySelector<HTMLElement>(focusableSelector)
      ;(first ?? dialog.current)?.focus()
      focused.current = true
    }
    const keyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab') return
      trapTab(event)
    }
    const keepFocusInside = (event: FocusEvent) => {
      if (closing.current) return
      if (
        event.target instanceof Node &&
        dialog.current &&
        !dialog.current.contains(event.target)
      ) {
        const first =
          dialog.current.querySelector<HTMLElement>(focusableSelector)
        ;(first ?? dialog.current).focus()
      }
    }
    document.addEventListener('keydown', keyDown)
    document.addEventListener('focusin', keepFocusInside)
    return () => {
      document.removeEventListener('keydown', keyDown)
      document.removeEventListener('focusin', keepFocusInside)
    }
  }, [busy, onClose, top])

  const shared = {
    className: props.className,
    role: props.role ?? 'dialog',
    'aria-modal': top || undefined,
    'aria-hidden': !top || undefined,
    'aria-label': props.ariaLabel,
    'aria-labelledby': props.labelledBy,
    'aria-busy': props.busy || undefined,
    tabIndex: -1
  } as const
  if (!layer.layer) return null
  const content = (
    <div
      className={props.backdropClassName ?? 'modal-backdrop'}
      role="presentation"
      inert={!top || undefined}
      aria-hidden={!top || undefined}
    >
      {props.form ? (
        <form
          ref={dialog as RefObject<HTMLFormElement>}
          {...shared}
          onSubmit={props.onSubmit}
        >
          {props.children}
        </form>
      ) : (
        <section ref={dialog} {...shared}>
          {props.children}
        </section>
      )}
    </div>
  )
  return createPortal(
    <ModalInstanceContext.Provider
      value={{ close: props.onClose, busy: props.busy ?? false }}
    >
      {content}
    </ModalInstanceContext.Provider>,
    layer.layer
  )
}

export function ModalCloseButton(
  props: ButtonHTMLAttributes<HTMLButtonElement>
) {
  const modal = useContext(ModalInstanceContext)
  if (!modal)
    throw new Error('ModalCloseButton must be rendered inside ModalDialog.')
  const { onClick, disabled, ...buttonProps } = props
  return (
    <button
      {...buttonProps}
      type={props.type ?? 'button'}
      disabled={disabled || modal.busy}
      onClick={(event) => {
        onClick?.(event)
        if (!event.defaultPrevented) modal.close()
      }}
    />
  )
}

export function DiscardChangesDialog(props: {
  message: string
  cancelLabel: string
  discardLabel: string
  onCancel: () => void
  onDiscard: () => void
  busy?: boolean
}) {
  return (
    <ModalDialog
      role="alertdialog"
      className="discard-changes-dialog"
      ariaLabel={props.message}
      onClose={props.onCancel}
      {...(props.busy === undefined ? {} : { busy: props.busy })}
    >
      <p>{props.message}</p>
      <footer>
        <ModalCloseButton>{props.cancelLabel}</ModalCloseButton>
        <button
          type="button"
          className="danger"
          disabled={props.busy}
          onClick={props.onDiscard}
        >
          {props.discardLabel}
        </button>
      </footer>
    </ModalDialog>
  )
}
