import {
  createContext,
  useContext,
  useId,
  useLayoutEffect,
  useRef,
  type CSSProperties,
  type ButtonHTMLAttributes,
  type FormHTMLAttributes,
  type ReactNode
} from 'react'
import { createPortal } from 'react-dom'
import { OverlayLayerContext } from './modal-layer.js'
import './modal-dialog.css'

const ModalInstanceContext = createContext<{
  id: string
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
  role?: 'dialog' | 'alertdialog'
}) {
  const layer = useContext(OverlayLayerContext)
  if (!layer)
    throw new Error('ModalDialog must be rendered inside ModalLayerProvider.')
  const { register, stack, unregister } = layer
  const busy = props.busy ?? false
  const onClose = props.onClose
  const id = useId()
  const dialog = useRef<HTMLElement>(null)
  const closeRef = useRef(onClose)
  const busyRef = useRef(busy)
  useLayoutEffect(() => {
    closeRef.current = onClose
    busyRef.current = busy
  }, [busy, onClose])
  const modalStack = stack.filter((entry) => entry.kind !== 'popup')
  const stackIndex = modalStack.findIndex((entry) => entry.id === id)
  const topModal = modalStack.at(-1)?.id === id
  const topOverlay = stack.at(-1)
  const interactive =
    topOverlay?.id === id ||
    (topOverlay?.kind === 'popup' && topOverlay.ownerId === id)
  const depth = stackIndex < 0 ? 0 : modalStack.length - stackIndex - 1
  const backdropStyle = {
    zIndex: 30 + Math.max(0, stackIndex),
    '--modal-stack-offset': `${depth * 11}px`,
    '--modal-stack-opacity': depth === 0 ? 1 : depth === 1 ? 0.7 : 0.5
  } as CSSProperties

  useLayoutEffect(() => {
    const restoreFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    register({
      id,
      kind: props.role === 'alertdialog' ? 'alertdialog' : 'modal',
      ownerId: null,
      element: () => dialog.current,
      anchor: () => null,
      dismiss: () => closeRef.current(),
      busy: () => busyRef.current,
      pointerDismiss: false,
      restoreFocus
    })
    return () => unregister(id)
  }, [id, props.role, register, unregister])

  const shared = {
    className: props.className,
    role: props.role ?? 'dialog',
    'aria-modal': topModal || undefined,
    'aria-hidden': !interactive || undefined,
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
      inert={!interactive || undefined}
      aria-hidden={!interactive || undefined}
      data-modal-index={stackIndex < 0 ? undefined : stackIndex}
      data-modal-depth={stackIndex < 0 ? undefined : depth}
      data-modal-bottom={stackIndex === 0 ? 'true' : 'false'}
      data-modal-top={topModal ? 'true' : 'false'}
      style={backdropStyle}
    >
      <section ref={dialog} {...shared}>
        {props.children}
      </section>
    </div>
  )
  return createPortal(
    <ModalInstanceContext.Provider
      value={{ id, close: props.onClose, busy: props.busy ?? false }}
    >
      {content}
    </ModalInstanceContext.Provider>,
    layer.layer
  )
}

export function ModalForm(props: FormHTMLAttributes<HTMLFormElement>) {
  const { className, ...formProps } = props
  return (
    <form
      {...formProps}
      className={`modal-form${className ? ` ${className}` : ''}`}
    />
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useModalOverlayOwnerId(): string | null {
  return useContext(ModalInstanceContext)?.id ?? null
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
