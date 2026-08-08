export function sliderValueAtClientX(
  clientX: number,
  left: number,
  width: number,
  min: number,
  max: number
): number {
  if (width <= 0) return min
  const ratio = Math.max(0, Math.min(1, (clientX - left) / width))
  return Math.round(min + ratio * (max - min))
}
