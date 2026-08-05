import { describe, expect, it } from 'vitest'
import {
  formatMessage,
  messagesDe,
  pseudoExpand
} from '../../src/renderer/i18n/messages.de.js'

describe('pseudo locale', () => {
  it('expands every UI message by at least forty percent', () => {
    for (const value of Object.values(messagesDe))
      expect(pseudoExpand(value).length).toBeGreaterThanOrEqual(
        Math.ceil(value.length * 1.4)
      )
  })

  it('formats typed dynamic copy before pseudo expansion', () => {
    expect(
      formatMessage(
        'party.restSummary',
        { shortRestXp: 100, longRestXp: 300 },
        false
      )
    ).toBe('SR 100 · LR 300')
    const pseudo = formatMessage(
      'catalog.locationCount',
      { visible: 2, total: 5 },
      true
    )
    expect(pseudo).toContain('2')
    expect(pseudo).toContain('5')
    expect(pseudo.startsWith('⟦')).toBe(true)
  })

  it('fails closed when an untyped caller omits a placeholder', () => {
    expect(() =>
      // @ts-expect-error Runtime validation protects non-TypeScript callers.
      formatMessage('catalog.locationCount', { visible: 2 }, false)
    ).toThrow('Missing {total} for message catalog.locationCount')
  })

  it('rejects extra placeholder parameters at compile time', () => {
    const invalidParameters = () =>
      // @ts-expect-error Parameter objects must exactly match the template.
      formatMessage('workspace.loading', { name: 'Hex', extra: 'private' })
    expect(invalidParameters).toBeTypeOf('function')
  })
})
