import { describe, expect, it } from 'vitest'
import { catalogMessagesDe } from '../../src/renderer/i18n/catalog-messages.de.js'
import { formatMessage as formatCatalogMessage } from '../../src/renderer/i18n/catalog-runtime.de.js'
import { hexMessagesDe } from '../../src/renderer/i18n/hex-messages.de.js'
import { pseudoExpand } from '../../src/renderer/i18n/message-runtime.de.js'
import { referenceMessagesDe } from '../../src/renderer/i18n/reference-messages.de.js'
import { sessionMessagesDe } from '../../src/renderer/i18n/session-messages.de.js'
import { formatMessage as formatSessionMessage } from '../../src/renderer/i18n/session-runtime.de.js'
import { uiMessagesDe } from '../../src/renderer/i18n/ui-messages.de.js'
import { workspaceMessagesDe } from '../../src/renderer/i18n/workspace-messages.de.js'
import { worldplannerMessagesDe } from '../../src/renderer/i18n/worldplanner-messages.de.js'

const messagesDe = {
  ...workspaceMessagesDe,
  ...referenceMessagesDe,
  ...sessionMessagesDe,
  ...hexMessagesDe,
  ...catalogMessagesDe,
  ...worldplannerMessagesDe,
  ...uiMessagesDe
}

describe('pseudo locale', () => {
  it('expands every UI message by at least forty percent', () => {
    for (const value of Object.values(messagesDe))
      expect(pseudoExpand(value).length).toBeGreaterThanOrEqual(
        Math.ceil(value.length * 1.4)
      )
  })

  it('formats typed dynamic copy before pseudo expansion', () => {
    expect(
      formatSessionMessage(
        'party.restSummary',
        { shortRestXp: 100, longRestXp: 300 },
        false
      )
    ).toBe('SR 100 · LR 300')
    const pseudo = formatCatalogMessage(
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
      formatCatalogMessage('catalog.locationCount', { visible: 2 }, false)
    ).toThrow('Missing {total} for message catalog.locationCount')
  })

  it('rejects extra placeholder parameters at compile time', () => {
    const invalidParameters = () =>
      formatCatalogMessage('workspace.loading', {
        name: 'Hex',
        // @ts-expect-error Parameter objects must exactly match the template.
        extra: 'private'
      })
    expect(invalidParameters).toBeTypeOf('function')
  })
})
