export type ResizeEdge = "left" | "right" | "top" | "bottom";

export function normalizeResizeEdge(
  width: number,
  height: number,
  margins: Readonly<Record<ResizeEdge, number>>,
  edge: ResizeEdge,
  raw: number,
): number {
  const horizontal = edge === "left" || edge === "right";
  const size = horizontal ? width : height;
  const opposite = edge === "left" ? "right" : edge === "right" ? "left"
    : edge === "top" ? "bottom" : "top";
  const other = margins[opposite];
  const value = Number.isFinite(raw) ? Math.sign(raw) * Math.round(Math.abs(raw)) : 0;
  if (size < 8 || size > 128) return Math.max(-64, Math.min(64, value));
  const minimum = Math.max(-64, 8 - size - other);
  const maximum = Math.min(64, 128 - size - other);
  return Math.max(minimum, Math.min(maximum, value));
}
