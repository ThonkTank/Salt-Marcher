/**
 * The measured Chromium input for one DD-041.04 Ctrl+wheel detent. Dungeondraft
 * 1.2.0.1 steps through 50, 75, 100, 125, 150 and 200 percent. Other wheel
 * shapes (trackpad, line-mode, combined modifiers) remain unmeasured here.
 */
export function measuredCtrlWheelNotchFactor(event: Pick<WheelEvent,
  "ctrlKey" | "metaKey" | "shiftKey" | "deltaX" | "deltaY" | "deltaMode"
>, currentScale: number): number | null {
  if (!event.ctrlKey || event.metaKey || event.shiftKey ||
      event.deltaMode !== 0 || event.deltaX !== 0) return null;
  if (event.deltaY !== -100 && event.deltaY !== 100) return null;
  const scales = [32, 48, 64, 80, 96, 128];
  const current = scales.findIndex((scale) => Math.abs(currentScale - scale) < 1e-4);
  if (current < 0) return null;
  const next = current + (event.deltaY < 0 ? 1 : -1);
  return next >= 0 && next < scales.length ? scales[next]! / scales[current]! : null;
}
