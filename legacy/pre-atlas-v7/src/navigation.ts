export type WheelNavigation =
  | { kind: "zoom"; factor: number }
  | { kind: "pan"; x: number; y: number };

export type CompactWheelNavigation =
  | { kind: "zoom"; viewFactor: number }
  | { kind: "none" };

type WheelInput = Pick<
  WheelEvent,
  "deltaX" | "deltaY" | "deltaMode" | "ctrlKey" | "metaKey" | "shiftKey"
>;

function pixels(value: number, mode: number): number {
  if (mode === 1) return value * 16;
  if (mode === 2) return value * 120;
  return value;
}

export function wheelNavigation(event: WheelInput): WheelNavigation {
  const x = pixels(event.deltaX, event.deltaMode),
    y = pixels(event.deltaY, event.deltaMode),
    zoom =
      event.ctrlKey ||
      event.metaKey ||
      (!event.shiftKey && Math.abs(y) >= Math.abs(x));
  if (!zoom) return { kind: "pan", x: -x, y: -y };
  // The measured native Ctrl+wheel notch moves 100% to 125% and back.
  // Small pixel deltas remain continuous for touchpad pinch input.
  if ((event.ctrlKey || event.metaKey) && Math.abs(y) >= 40)
    return { kind: "zoom", factor: y < 0 ? 1.25 : 0.8 };
  const bounded = Math.max(-48, Math.min(48, y));
  return { kind: "zoom", factor: Math.exp(-bounded * 0.006) };
}

/** The small reading map retains the established interaction contract. */
export function compactWheelNavigation(
  event: Pick<WheelInput, "deltaY" | "ctrlKey">,
): CompactWheelNavigation {
  if (!event.ctrlKey || event.deltaY === 0) return { kind: "none" };
  return {
    kind: "zoom",
    viewFactor: event.deltaY > 0 ? 1.15 : 1 / 1.15,
  };
}
