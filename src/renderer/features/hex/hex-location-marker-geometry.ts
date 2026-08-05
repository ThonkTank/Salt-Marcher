import type { LocationSymbolViewBox } from './location-symbols.js'

export function markerSymbolTransform(
  center: Readonly<{ x: number; y: number }>,
  size: number,
  viewBox: LocationSymbolViewBox
): string {
  return `translate(${center.x - size / 2} ${center.y - size / 2}) scale(${size / viewBox.width} ${size / viewBox.height}) translate(${-viewBox.minX} ${-viewBox.minY})`
}

export function markerLabelPath(
  center: Readonly<{ x: number; y: number }>,
  title: string,
  size: number,
  curve: number,
  position: 'above' | 'below'
): string {
  const half = Math.max(56, title.length * 8.4) + Math.abs(curve) * 0.9
  const above = position === 'above'
  const y = above ? center.y - size / 2 - 12 : center.y + size / 2 + 26
  const control = above ? y - curve : y + curve
  return `M ${center.x - half} ${y} Q ${center.x} ${2 * control - y} ${center.x + half} ${y}`
}
