import { useEffect, useRef, useState, type ReactNode } from 'react'

export function HexScrollArea(props: {
  className: string
  children: ReactNode
  role?: string
  ariaLabel?: string
}) {
  const content = useRef<HTMLDivElement>(null)
  const [metrics, setMetrics] = useState({ top: 0, height: 0, visible: false })
  useEffect(() => {
    const element = content.current
    if (!element) return
    const measure = () => {
      const { clientHeight, scrollHeight, scrollTop } = element
      const visible = scrollHeight > clientHeight + 1
      const height = visible
        ? Math.max(20, (clientHeight / scrollHeight) * clientHeight)
        : 0
      const top = visible
        ? (scrollTop / (scrollHeight - clientHeight)) * (clientHeight - height)
        : 0
      setMetrics({ top, height, visible })
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [props.children])
  return (
    <div className="hex-scroll-shell">
      <div
        ref={content}
        className={props.className}
        role={props.role}
        aria-label={props.ariaLabel}
        onScroll={(event) => {
          const element = event.currentTarget
          const height = Math.max(
            20,
            (element.clientHeight / element.scrollHeight) * element.clientHeight
          )
          setMetrics({
            visible: element.scrollHeight > element.clientHeight + 1,
            height,
            top:
              (element.scrollTop /
                (element.scrollHeight - element.clientHeight || 1)) *
              (element.clientHeight - height)
          })
        }}
      >
        {props.children}
      </div>
      {metrics.visible && (
        <span className="hex-scroll-rail" aria-hidden="true">
          <i style={{ height: metrics.height, top: metrics.top }} />
        </span>
      )}
    </div>
  )
}
