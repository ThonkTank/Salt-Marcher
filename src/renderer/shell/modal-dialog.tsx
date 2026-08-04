import {
  useEffect,
  useRef,
  type KeyboardEvent,
  type FormEventHandler,
  type ReactNode,
  type RefObject
} from 'react'

const focusableSelector = [
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[href]',
  '[tabindex]:not([tabindex="-1"])'
].join(',')

let scrollLocks = 0

export function ModalDialog(props: {
  children: ReactNode
  className: string
  onClose: () => void
  ariaLabel?: string
  labelledBy?: string
  backdropClassName?: string
  busy?: boolean
  form?: boolean
  onSubmit?: FormEventHandler<HTMLFormElement>
}) {
  const dialog = useRef<HTMLElement>(null)
  const restoreFocus = useRef<HTMLElement | null>(null)

  useEffect(() => {
    restoreFocus.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    scrollLocks += 1
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const first = dialog.current?.querySelector<HTMLElement>(focusableSelector)
    ;(first ?? dialog.current)?.focus()
    return () => {
      scrollLocks = Math.max(0, scrollLocks - 1)
      if (scrollLocks === 0) document.body.style.overflow = previousOverflow
      restoreFocus.current?.focus()
    }
  }, [])

  function keyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape' && !props.busy) {
      event.preventDefault()
      props.onClose()
      return
    }
    if (event.key !== 'Tab') return
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

  const shared = {
    className: props.className,
    role: 'dialog',
    'aria-modal': true,
    'aria-label': props.ariaLabel,
    'aria-labelledby': props.labelledBy,
    'aria-busy': props.busy || undefined,
    tabIndex: -1,
    onKeyDown: keyDown
  } as const
  return (
    <div
      className={props.backdropClassName ?? 'modal-backdrop'}
      role="presentation"
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
}
