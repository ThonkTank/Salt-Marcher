// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { referenceSearchSpan } from '../../src/shared/reference/reference-search.js'
import {
  focusReferenceSearch,
  focusDesktopWindow,
  isLookupShortcut
} from '../../src/renderer/features/scene-desktop/reference-search-focus.js'
afterEach(() => vi.restoreAllMocks())
describe('reference search focus', () => {
  it('focuses and selects lookup immediately without selecting unrelated editor inputs', () => {
    const stage = document.createElement('div')
    stage.innerHTML =
      '<section data-window-id="search" tabindex="-1"><input type="search" value="previous"></section><section data-window-id="party" tabindex="-1"><input value="draft"></section>'
    document.body.append(stage)
    try {
      focusDesktopWindow(stage, 'search')
      const input = stage.querySelector('input')!
      expect(document.activeElement).toBe(input)
      expect([input.selectionStart, input.selectionEnd]).toEqual([0, 8])
      focusDesktopWindow(stage, 'party')
      expect(document.activeElement).toBe(
        stage.querySelector('[data-window-id="party"]')
      )
    } finally {
      stage.remove()
    }
  })
  it('protects other text editors, modal inputs, handled events and IME composition from the shortcut', () => {
    expect(
      isLookupShortcut(
        new KeyboardEvent('keydown', { key: 'k', ctrlKey: true })
      )
    ).toBe(true)
    expect(
      isLookupShortcut(
        new KeyboardEvent('keydown', { key: 'k', metaKey: true })
      )
    ).toBe(true)
    expect(
      isLookupShortcut(
        new KeyboardEvent('keydown', {
          key: 'k',
          ctrlKey: true,
          isComposing: true
        })
      )
    ).toBe(false)
    expect(
      isLookupShortcut(
        new KeyboardEvent('keydown', {
          key: 'k',
          ctrlKey: true,
          shiftKey: true
        })
      )
    ).toBe(false)
    const handled = new KeyboardEvent('keydown', {
      key: 'k',
      ctrlKey: true,
      cancelable: true
    })
    handled.preventDefault()
    expect(isLookupShortcut(handled)).toBe(false)
    for (const html of [
      '<textarea>draft</textarea>',
      '<input value="draft">',
      '<div role="dialog"><input type="search"></div>',
      '<div contenteditable="true">draft</div>'
    ]) {
      const root = document.createElement('div')
      root.innerHTML = html
      const target = root.querySelector('input,textarea,[contenteditable]')!
      let intercepted = true
      target.addEventListener('keydown', (event) => {
        intercepted = isLookupShortcut(event as KeyboardEvent)
      })
      target.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true })
      )
      expect(intercepted).toBe(false)
    }
  })
  it('prefers the note phrase over the known title and preserves Unicode source offsets', () => {
    const text = 'Kai 1: Lager.\n\nKai 30: U\u0308berfall.\n'
    const span = referenceSearchSpan(
      text,
      'Salzmarschhafen Kai 30',
      'Salzmarschhafen'
    )!
    expect(text.slice(span.start, span.end)).toBe('Kai 30')
    const unicode = referenceSearchSpan(text, 'ÜBERFALL')!
    expect(text.slice(unicode.start, unicode.end)).toBe('U\u0308berfall')
    expect(
      referenceSearchSpan(text, 'Salzmarschhafen', 'Salzmarschhafen')
    ).toBeNull()
    expect(referenceSearchSpan(text, 'missing')).toBeNull()
  })
  it('finds a phrase spanning linked nodes and scrolls only its reader without rewriting content', () => {
    const scroll = document.createElement('div')
    scroll.innerHTML =
      '<article class="reference-document"><p>Before Kai <button>30</button>: after</p></article>'
    const before = scroll.innerHTML
    vi.spyOn(scroll, 'getBoundingClientRect').mockReturnValue({
      top: 100
    } as DOMRect)
    const createRange = scroll.ownerDocument.createRange.bind(
      scroll.ownerDocument
    )
    vi.spyOn(scroll.ownerDocument, 'createRange').mockImplementation(() => {
      const range = createRange()
      range.getBoundingClientRect = () => ({ top: 500 }) as DOMRect
      return range
    })
    const range = focusReferenceSearch(scroll, 'Kai 30', 'Harbor')!
    expect(range.toString()).toBe('Kai 30')
    expect(scroll.scrollTop).toBe(376)
    expect(scroll.innerHTML).toBe(before)
  })
})
