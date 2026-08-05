import {
  createContext,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react'

type ModalLayerContextValue = {
  layer: HTMLDivElement | null
  stack: readonly string[]
  register: (id: string) => void
  unregister: (id: string) => void
}

// eslint-disable-next-line react-refresh/only-export-components
export const ModalLayerContext = createContext<ModalLayerContextValue | null>(
  null
)

export function ModalLayerProvider(props: { children: ReactNode }) {
  const [layer, setLayer] = useState<HTMLDivElement | null>(null)
  const [stack, setStack] = useState<readonly string[]>([])
  const originalOverflow = useRef<string | null>(null)

  const register = useCallback((id: string) => {
    setStack((current) => (current.includes(id) ? current : [...current, id]))
  }, [])
  const unregister = useCallback((id: string) => {
    setStack((current) => current.filter((candidate) => candidate !== id))
  }, [])

  useLayoutEffect(() => {
    if (stack.length > 0 && originalOverflow.current === null) {
      originalOverflow.current = document.body.style.overflow
      document.body.style.overflow = 'hidden'
    } else if (stack.length === 0 && originalOverflow.current !== null) {
      document.body.style.overflow = originalOverflow.current
      originalOverflow.current = null
    }
  }, [stack.length])

  useLayoutEffect(
    () => () => {
      if (originalOverflow.current !== null)
        document.body.style.overflow = originalOverflow.current
    },
    []
  )

  const value = useMemo(
    () => ({ layer, stack, register, unregister }),
    [layer, register, stack, unregister]
  )

  return (
    <ModalLayerContext.Provider value={value}>
      <div
        className="modal-app-root"
        inert={stack.length > 0 || undefined}
        aria-hidden={stack.length > 0 || undefined}
      >
        {props.children}
      </div>
      <div ref={setLayer} className="modal-layer-root" />
    </ModalLayerContext.Provider>
  )
}
