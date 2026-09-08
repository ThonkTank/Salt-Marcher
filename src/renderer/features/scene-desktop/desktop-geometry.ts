import type {
  DesktopBounds,
  SceneDesktopWindow
} from '../../../shared/contracts/scene-desktop.js'

export type DesktopSize = Readonly<{ width: number; height: number }>
export type SnapSide = 'left' | 'right'

/** Fit for display only: never write a smaller viewport back as user preference. */
export function fitDesktopBounds(
  bounds: DesktopBounds,
  size: DesktopSize
): DesktopBounds {
  const width = Math.min(bounds.width, Math.max(1, size.width))
  const height = Math.min(bounds.height, Math.max(1, size.height))
  return {
    x: Math.max(0, Math.min(bounds.x, size.width - width)),
    y: Math.max(0, Math.min(bounds.y, size.height - height)),
    width,
    height
  }
}

export function desktopWindowBounds(
  window: SceneDesktopWindow,
  size: DesktopSize
): DesktopBounds {
  if (window.maximized) return { x: 0, y: 0, ...size }
  if (window.snap) {
    const half = Math.floor(size.width / 2)
    return {
      x: window.snap === 'left' ? 0 : half,
      y: 0,
      width: window.snap === 'left' ? half : size.width - half,
      height: size.height
    }
  }
  return fitDesktopBounds(window.bounds, size)
}

export function desktopSnapPreview(
  pointerX: number,
  size: DesktopSize
): SnapSide | null {
  if (size.width < 480) return null
  if (pointerX <= 24) return 'left'
  if (pointerX >= size.width - 24) return 'right'
  return null
}

export function alignDesktopBounds(
  bounds: DesktopBounds,
  others: readonly DesktopBounds[],
  size: DesktopSize
): DesktopBounds {
  let next = bounds
  for (const other of others) {
    if (Math.abs(next.x - other.x - other.width) <= 8)
      next = { ...next, x: other.x + other.width }
    else if (Math.abs(next.x + next.width - other.x) <= 8)
      next = { ...next, x: other.x - next.width }
    if (Math.abs(next.y - other.y - other.height) <= 8)
      next = { ...next, y: other.y + other.height }
    else if (Math.abs(next.y + next.height - other.y) <= 8)
      next = { ...next, y: other.y - next.height }
    else if (Math.abs(next.y - other.y) <= 8) next = { ...next, y: other.y }
  }
  return fitDesktopBounds(next, size)
}
