/**
 * The measured Chromium input for one DD-041.04 Ctrl+wheel detent. Dungeondraft
 * 1.2.0.1 changes 100% to 125% on up and 125% to 100% on down. Other wheel
 * shapes (trackpad, line-mode, combined modifiers) remain unmeasured here.
 */
export function measuredCtrlWheelNotchFactor(event: Pick<WheelEvent,
  "ctrlKey" | "metaKey" | "shiftKey" | "deltaX" | "deltaY" | "deltaMode"
>): number | null {
  if (!event.ctrlKey || event.metaKey || event.shiftKey ||
      event.deltaMode !== 0 || event.deltaX !== 0) return null;
  if (event.deltaY === -100) return 1.25;
  if (event.deltaY === 100) return 0.8;
  return null;
}
