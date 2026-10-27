/** Display geometry only. Authored positions, size, species and IDs stay in
 * VegetationSpec; both the flat fallback and the spatial crown use this rim. */
export function crownRadius(asset: 'oak' | 'pine', angle: number) {
  return asset === 'oak'
    ? 0.95 + 0.09 * Math.cos(angle * 5 + 0.4) + 0.04 * Math.sin(angle * 3 - 0.7)
    : 0.82 + 0.18 * Math.cos(angle * 6);
}

/** A small, stable colour variation belonging to the object, never the camera. */
export function crownTone(id: string) {
  let hash = 2166136261;
  for (let i = 0; i < id.length; i++) hash = Math.imul(hash ^ id.charCodeAt(i), 16777619);
  return 0.88 + ((hash >>> 0) / 4294967295) * 0.22;
}

/** Conservative horizontal envelope of the existing models. Automatic crowns
 * may double at overview scales; rocks can tilt with the surface normal.
 * Placement uses that maximum once, so zoom never changes candidate identity.
 */
export function vegetationFootprintRadius(asset: string, size: number) {
  const radius =
    asset === 'oak'
      ? 0.36 * (0.95 + 0.09 + 0.04) * 2
      : asset === 'pine'
        ? 0.32 * 2
        : asset === 'rock'
          ? 0.55 + 0.14
          : 0.5;
  return size * radius;
}
