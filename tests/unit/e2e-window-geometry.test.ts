import { describe, expect, it } from 'vitest'
import { rendererAcknowledgesWindowGeometry } from '../e2e/support/e2e-window-geometry.js'

describe('E2E window geometry acknowledgement', () => {
  it('separates native frame geometry from renderer and workspace geometry', () => {
    const content = { contentWidth: 1264, contentHeight: 761 }
    expect(
      rendererAcknowledgesWindowGeometry(content, {
        innerWidth: 1264,
        innerHeight: 761,
        workspace: {
          ready: true,
          measuredWidth: 1198,
          renderedWidth: 1198.4
        }
      })
    ).toBe(true)
    expect(
      rendererAcknowledgesWindowGeometry(content, {
        innerWidth: 1024,
        innerHeight: 761,
        workspace: null
      })
    ).toBe(false)
  })

  it('waits for the owner layout measurement after renderer resize', () => {
    const content = { contentWidth: 720, contentHeight: 501 }
    expect(
      rendererAcknowledgesWindowGeometry(content, {
        innerWidth: 720,
        innerHeight: 501,
        workspace: {
          ready: false,
          measuredWidth: 654,
          renderedWidth: 654
        }
      })
    ).toBe(false)
    expect(
      rendererAcknowledgesWindowGeometry(content, {
        innerWidth: 720,
        innerHeight: 501,
        workspace: {
          ready: true,
          measuredWidth: 900,
          renderedWidth: 654
        }
      })
    ).toBe(false)
  })
})
