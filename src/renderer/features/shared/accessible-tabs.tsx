import { useId, type KeyboardEvent, type ReactNode } from 'react'

export type AccessibleTabItem<Value extends string> = Readonly<{
  value: Value
  label: string
}>

export function AccessibleTabs<Value extends string>(props: {
  label: string
  items: readonly AccessibleTabItem<Value>[]
  selected: Value
  changed: (value: Value) => void
  className?: string
  headerClassName?: string
  panelClassName?: string
  afterTabs?: ReactNode
  children: ReactNode
}) {
  const prefix = useId()
  const selectedIndex = Math.max(
    0,
    props.items.findIndex((item) => item.value === props.selected)
  )
  const tabId = (index: number) => `${prefix}-tab-${index}`
  const panelId = `${prefix}-panel`
  const keyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const last = props.items.length - 1
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? last
          : event.key === 'ArrowLeft'
            ? (selectedIndex - 1 + props.items.length) % props.items.length
            : (selectedIndex + 1) % props.items.length
    const item = props.items[next]
    if (!item) return
    props.changed(item.value)
    event.currentTarget
      .querySelector<HTMLElement>(`[data-tab-index="${next}"]`)
      ?.focus()
  }
  const tabs = (
    <div
      className={props.className}
      role="tablist"
      aria-label={props.label}
      onKeyDown={keyDown}
    >
      {props.items.map((item, index) => {
        const selected = index === selectedIndex
        return (
          <button
            key={item.value}
            id={tabId(index)}
            type="button"
            data-tab-index={index}
            role="tab"
            aria-controls={panelId}
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => props.changed(item.value)}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
  const navigation = props.headerClassName ? (
    <header className={props.headerClassName}>
      {tabs}
      {props.afterTabs}
    </header>
  ) : (
    <>
      {tabs}
      {props.afterTabs}
    </>
  )
  return (
    <>
      {navigation}
      <div
        id={panelId}
        className={props.panelClassName}
        role="tabpanel"
        aria-labelledby={tabId(selectedIndex)}
      >
        {props.children}
      </div>
    </>
  )
}
