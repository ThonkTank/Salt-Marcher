import type { AxialCoordinate } from '../../../shared/contracts/hex.js'

type Interaction = 'select' | 'paint' | 'erase' | 'location' | undefined

export type HexCanvasKeyboardCommand =
  | Readonly<{ kind: 'navigate'; coordinate: AxialCoordinate }>
  | Readonly<{ kind: 'activate'; coordinate: AxialCoordinate }>
  | Readonly<{ kind: 'stroke'; coordinate: AxialCoordinate }>

/** Converts keyboard input into renderer-agnostic map commands. */
export function hexCanvasKeyboardCommand(input: {
  key: string
  selected: AxialCoordinate
  interaction: Interaction
}): HexCanvasKeyboardCommand | null {
  const key = input.key.toLowerCase()
  const delta =
    key === 'arrowleft'
      ? { q: -1, r: 0 }
      : key === 'arrowright'
        ? { q: 1, r: 0 }
        : key === 'arrowup'
          ? { q: 0, r: -1 }
          : key === 'arrowdown'
            ? { q: 0, r: 1 }
            : key === 'q'
              ? { q: -1, r: 1 }
              : key === 'e'
                ? { q: 1, r: -1 }
                : null
  if (delta)
    return {
      kind: 'navigate',
      coordinate: {
        q: input.selected.q + delta.q,
        r: input.selected.r + delta.r
      }
    }
  if (key !== 'enter' && key !== ' ') return null
  return {
    kind:
      input.interaction === 'paint' || input.interaction === 'erase'
        ? 'stroke'
        : 'activate',
    coordinate: input.selected
  }
}
