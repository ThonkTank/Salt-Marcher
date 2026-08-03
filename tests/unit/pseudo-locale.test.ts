import { describe, expect, it } from 'vitest'
import {
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
})
