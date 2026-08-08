import {
  autoUpdate,
  flip,
  offset,
  shift,
  useFloating,
  type Placement
} from '@floating-ui/react'
import {
  useContext,
  useId,
  useLayoutEffect,
  useRef,
  type ReactNode
} from 'react'
import { createPortal } from 'react-dom'
import { OverlayLayerContext } from './modal-layer.js'
import { useModalOverlayOwnerId } from './modal-dialog.js'

export function AnchoredPopup(props: {
  open: boolean
  anchor: HTMLElement | null
  onDismiss: () => void
  children: ReactNode
  className: string
  placement?: Placement
  minWidth?: number
  matchAnchorWidth?: boolean
}) {
  const layer = useContext(OverlayLayerContext)
  if (!layer)
    throw new Error('AnchoredPopup must be rendered inside ModalLayerProvider.')
  const { register, unregister } = layer
  const id = useId()
  const ownerId = useModalOverlayOwnerId()
  const popup = useRef<HTMLDivElement>(null)
  const anchor = useRef(props.anchor)
  const dismiss = useRef(props.onDismiss)
  useLayoutEffect(() => {
    anchor.current = props.anchor
    dismiss.current = props.onDismiss
  }, [props.anchor, props.onDismiss])
  const { refs, floatingStyles } = useFloating({
    open: props.open,
    placement: props.placement ?? 'bottom-start',
    strategy: 'fixed',
    middleware: [offset(2), flip({ padding: 8 }), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate
  })

  useLayoutEffect(() => {
    refs.setReference(props.anchor)
  }, [props.anchor, refs])

  useLayoutEffect(() => {
    if (!props.open) return
    register({
      id,
      kind: 'popup',
      ownerId,
      element: () => popup.current,
      anchor: () => anchor.current,
      dismiss: () => dismiss.current(),
      busy: () => false,
      pointerDismiss: true,
      restoreFocus: null
    })
    return () => unregister(id)
  }, [id, ownerId, props.open, register, unregister])

  if (!props.open || !props.anchor) return null
  const anchorWidth = props.anchor.getBoundingClientRect().width
  if (!layer.layer) return null
  const stackIndex = layer.stack.findIndex((entry) => entry.id === id)
  return createPortal(
    <div
      ref={(node) => {
        popup.current = node
        refs.setFloating(node)
      }}
      className={props.className}
      style={{
        ...floatingStyles,
        width: props.matchAnchorWidth
          ? Math.max(anchorWidth, props.minWidth ?? 0)
          : undefined,
        minWidth: props.matchAnchorWidth ? undefined : props.minWidth,
        zIndex: 100 + Math.max(0, stackIndex)
      }}
    >
      {props.children}
    </div>,
    layer.layer
  )
}
