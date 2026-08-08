import {
  createContext,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react'

export type OverlayKind = 'modal' | 'alertdialog' | 'popup'

export type OverlayRegistration = Readonly<{
  id: string
  kind: OverlayKind
  ownerId: string | null
  element: () => HTMLElement | null
  anchor: () => HTMLElement | null
  dismiss: () => void
  busy: () => boolean
  pointerDismiss: boolean
  restoreFocus: HTMLElement | null
}>

type OverlayLayerContextValue = Readonly<{
  layer: HTMLDivElement | null
  stack: readonly OverlayRegistration[]
  register: (overlay: OverlayRegistration) => void
  unregister: (id: string) => void
}>

const focusableSelector = [
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[href]',
  '[tabindex]:not([tabindex="-1"])'
].join(',')

// eslint-disable-next-line react-refresh/only-export-components
export const OverlayLayerContext =
  createContext<OverlayLayerContextValue | null>(null)

export function ModalLayerProvider(props: { children: ReactNode }) {
  const [layer, setLayer] = useState<HTMLDivElement | null>(null)
  const [stack, setStack] = useState<readonly OverlayRegistration[]>([])
  const stackRef = useRef<readonly OverlayRegistration[]>([])
  const originalOverflow = useRef<string | null>(null)
  const lastTopId = useRef<string | null>(null)
  const pendingFocusRestore = useRef<HTMLElement | null>(null)

  const register = useCallback((overlay: OverlayRegistration) => {
    const current = stackRef.current
    const next = current.some((entry) => entry.id === overlay.id)
      ? current.map((entry) => (entry.id === overlay.id ? overlay : entry))
      : [...current, overlay]
    stackRef.current = next
    setStack(next)
  }, [])

  const unregister = useCallback((id: string) => {
    const removed = stackRef.current.find((entry) => entry.id === id)
    const next = stackRef.current.filter((entry) => entry.id !== id)
    stackRef.current = next
    setStack(next)
    pendingFocusRestore.current = removed?.restoreFocus ?? null
  }, [])

  const modalOpen = stack.some((entry) => entry.kind !== 'popup')
  useLayoutEffect(() => {
    if (modalOpen && originalOverflow.current === null) {
      originalOverflow.current = document.body.style.overflow
      document.body.style.overflow = 'hidden'
    } else if (!modalOpen && originalOverflow.current !== null) {
      document.body.style.overflow = originalOverflow.current
      originalOverflow.current = null
    }
  }, [modalOpen])

  useLayoutEffect(
    () => () => {
      if (originalOverflow.current !== null)
        document.body.style.overflow = originalOverflow.current
    },
    []
  )

  useLayoutEffect(() => {
    const restoreFocus = pendingFocusRestore.current
    if (restoreFocus?.isConnected && document.activeElement !== restoreFocus) {
      pendingFocusRestore.current = null
      restoreFocus.focus()
    }
    const top = stack.at(-1)
    if (!top || top.id === lastTopId.current) return
    lastTopId.current = top.id
    if (top.kind === 'popup') return
    const element = top.element()
    if (!element) return
    const first = element.querySelector<HTMLElement>(focusableSelector)
    ;(first ?? element).focus()
  }, [stack])

  useEffect(() => {
    if (stack.length === 0) return
    const keyDown = (event: KeyboardEvent) => {
      const top = stackRef.current.at(-1)
      if (!top || event.defaultPrevented) return
      if (event.key === 'Escape' && !top.busy()) {
        event.preventDefault()
        event.stopPropagation()
        const popupAnchor = top.kind === 'popup' ? top.anchor() : null
        top.dismiss()
        popupAnchor?.focus({ preventScroll: true })
        return
      }
      if (event.key !== 'Tab' || top.kind === 'popup') return
      trapTab(event, top.element())
    }
    const focusIn = (event: FocusEvent) => {
      const top = stackRef.current.at(-1)
      const targetNode = event.target
      if (!top || !(targetNode instanceof Node)) return
      const allowed = allowedFocusRoots(top, stackRef.current)
      if (allowed.some((root) => root.contains(targetNode))) return
      const target =
        top.kind === 'popup'
          ? (top.anchor() ?? allowed.at(-1) ?? null)
          : top.element()
      const first = target?.querySelector<HTMLElement>(focusableSelector)
      ;(first ?? target)?.focus()
    }
    const pointerDown = (event: PointerEvent) => {
      const top = stackRef.current.at(-1)
      if (
        !top ||
        top.kind !== 'popup' ||
        !top.pointerDismiss ||
        !(event.target instanceof Node)
      )
        return
      if (
        top.element()?.contains(event.target) ||
        top.anchor()?.contains(event.target)
      )
        return
      top.dismiss()
    }
    document.addEventListener('keydown', keyDown, true)
    document.addEventListener('focusin', focusIn, true)
    document.addEventListener('pointerdown', pointerDown, true)
    return () => {
      document.removeEventListener('keydown', keyDown, true)
      document.removeEventListener('focusin', focusIn, true)
      document.removeEventListener('pointerdown', pointerDown, true)
    }
  }, [stack.length])

  const value = useMemo(
    () => ({ layer, stack, register, unregister }),
    [layer, register, stack, unregister]
  )

  return (
    <OverlayLayerContext.Provider value={value}>
      <div
        className="modal-app-root"
        inert={modalOpen || undefined}
        aria-hidden={modalOpen || undefined}
      >
        {props.children}
      </div>
      <div ref={setLayer} className="modal-layer-root" />
    </OverlayLayerContext.Provider>
  )
}

function trapTab(event: KeyboardEvent, root: HTMLElement | null): void {
  const focusable = [
    ...(root?.querySelectorAll<HTMLElement>(focusableSelector) ?? [])
  ]
  if (focusable.length === 0) {
    event.preventDefault()
    root?.focus()
    return
  }
  const first = focusable[0]!
  const last = focusable.at(-1)!
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

function allowedFocusRoots(
  top: OverlayRegistration,
  stack: readonly OverlayRegistration[]
): HTMLElement[] {
  const roots = [top.element()].filter((value): value is HTMLElement => !!value)
  if (top.kind !== 'popup') return roots
  const anchor = top.anchor()
  if (anchor) roots.push(anchor)
  if (!top.ownerId) return roots
  const owner = stack.find((entry) => entry.id === top.ownerId)?.element()
  if (owner) roots.push(owner)
  return roots
}
