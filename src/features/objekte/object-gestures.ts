/** One native mouse-wheel press is one object-tool step. */
export function objectWheelDirection(deltaY: number, deltaX = 0): -1 | 0 | 1 {
  const delta = deltaY || deltaX;
  return delta > 0 ? -1 : delta < 0 ? 1 : 0;
}

export function wrapObjectDegrees(degrees: number): number {
  return ((degrees + 180) % 360 + 360) % 360 - 180;
}

export function rotateObjectRadians(current: number, degrees: number): number {
  return wrapObjectDegrees(current * 180 / Math.PI + degrees) * Math.PI / 180;
}

export function scaleObjectStep(current: number, direction: -1 | 1): number {
  return Math.max(0.1, Math.min(4,
    Math.round((current + direction * 0.1) * 1e6) / 1e6));
}

/** The GridMenu moves within its current item list and needs an active tile. */
export function cycledObjectId(ids: readonly string[], selectedId: string,
  direction: -1 | 1): string | undefined {
  const index = ids.indexOf(selectedId);
  if (index < 0) return undefined;
  return ids[(index + direction + ids.length) % ids.length];
}
