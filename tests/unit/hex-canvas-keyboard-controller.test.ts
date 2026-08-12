import { describe, expect, it } from 'vitest'
import { hexCanvasKeyboardCommand } from '../../src/renderer/features/hex/hex-canvas-keyboard-controller.js'

describe('hex canvas keyboard controller', () => {
  it('maps all six axial neighbors without Pixi state', () => {
    expect(
      ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'q', 'E'].map((key) =>
        hexCanvasKeyboardCommand({
          key,
          selected: { q: 2, r: -1 },
          interaction: 'select'
        })
      )
    ).toEqual([
      { kind: 'navigate', coordinate: { q: 1, r: -1 } },
      { kind: 'navigate', coordinate: { q: 3, r: -1 } },
      { kind: 'navigate', coordinate: { q: 2, r: -2 } },
      { kind: 'navigate', coordinate: { q: 2, r: 0 } },
      { kind: 'navigate', coordinate: { q: 1, r: 0 } },
      { kind: 'navigate', coordinate: { q: 3, r: -2 } }
    ])
  })

  it('separates activation from paint and erase strokes', () => {
    expect(
      hexCanvasKeyboardCommand({
        key: 'Enter',
        selected: { q: 0, r: 0 },
        interaction: 'select'
      })
    ).toEqual({ kind: 'activate', coordinate: { q: 0, r: 0 } })
    for (const interaction of ['paint', 'erase'] as const)
      expect(
        hexCanvasKeyboardCommand({
          key: ' ',
          selected: { q: 0, r: 0 },
          interaction
        })
      ).toEqual({ kind: 'stroke', coordinate: { q: 0, r: 0 } })
  })
})
