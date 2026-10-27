export function vegetationWaterSuitable(depth: number | undefined, maximum: number) {
  return depth === undefined || (maximum > 0 && depth <= maximum);
}
/** World-fixed ground furrows use the authored instance spacing. The far
 * cartographic pattern takes over before these physical rows become subpixel. */
export function vegetationFurrowShade(y: number, spacing: number, mpp: number, sampleM: number) {
  const phase = Math.abs(((((y / spacing) % 1) + 1) % 1) - 0.5),
    aa = Math.max(sampleM / spacing, 0.015),
    band = 1 - Math.max(0, Math.min(1, (phase - 0.035) / aa)),
    detail = 1 - Math.max(0, Math.min(1, (mpp - 0.5) / 1.5));
  return 1 - band * detail * 0.18;
}
