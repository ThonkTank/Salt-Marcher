import { referenceSearchSpan } from '../../../shared/reference/reference-search.js'

export type DesktopSearchIntent = Readonly<{
  id: string
  windowId: string
  targetKey: string
  query: string
  consumed: boolean
}>

export function focusDesktopWindow(
  stage: HTMLElement | null,
  id: string
): void {
  const frame = stage?.querySelector<HTMLElement>(`[data-window-id="${id}"]`)
  const input =
    id === 'search'
      ? frame?.querySelector<HTMLInputElement>('input[type="search"]')
      : null
  if (input) {
    input.focus()
    input.select()
  } else frame?.focus()
}

export function isLookupShortcut(event: KeyboardEvent): boolean {
  if (
    event.defaultPrevented ||
    event.isComposing ||
    event.altKey ||
    event.shiftKey ||
    !(event.ctrlKey || event.metaKey) ||
    event.key.toLowerCase() !== 'k'
  )
    return false
  const target = event.target instanceof HTMLElement ? event.target : null
  if (target?.closest('[role="dialog"],textarea,[contenteditable="true"]'))
    return false
  return (
    !target?.closest('input') ||
    Boolean(target.closest('[data-window-id="search"]'))
  )
}

/** Scroll inside this reader only, leaving the desktop and user selection alone. */
export function focusReferenceSearch(
  scroll: HTMLElement,
  query: string,
  title: string
): Range | null {
  const document = scroll.querySelector('.reference-document')
  if (!document) return null
  const walker = scroll.ownerDocument.createTreeWalker(
    document,
    NodeFilter.SHOW_TEXT
  )
  const nodes: Text[] = []
  let node = walker.nextNode()
  while (node) {
    nodes.push(node as Text)
    node = walker.nextNode()
  }
  const span = referenceSearchSpan(
    nodes.map((node) => node.data).join(''),
    query,
    title
  )
  if (!span) return null
  const range = scroll.ownerDocument.createRange()
  let offset = 0
  for (const text of nodes) {
    const end = offset + text.length
    if (span.start >= offset && span.start < end)
      range.setStart(text, span.start - offset)
    if (span.end > offset && span.end <= end) {
      range.setEnd(text, span.end - offset)
      break
    }
    offset = end
  }
  const box = range.getBoundingClientRect()
  scroll.scrollTop += box.top - scroll.getBoundingClientRect().top - 24
  return range
}
