/** -1 selects automatic detail, 0 hides contours, positive values fix metres. */
export const AUTO_CONTOURS = -1;
export const CONTOUR_BASE_METRES = 1;
/** Cartographic scale rule: at 1 logical metre/pixel use 16 m contours.
 * Cap the coarsest interval at 256 m so continent-scale relief remains visible.
 * Heights, slopes, loaded tiles and camera tilt never choose elevation levels.
 * The shader crossfades nested powers of two around this scale, without moving lines. */
export function terrainContourStep(metresPerPixel: number) {
  return Math.max(CONTOUR_BASE_METRES, Math.min(256, 16 * metresPerPixel));
}
export const CONTOUR_INK = {
  minorWidth: 0.65,
  minorAlpha: 0.62,
  majorWidth: 1,
  majorAlpha: 0.78,
} as const;
const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
function line(
  height: number,
  gradient: number,
  step: number,
  sea: number,
  width: number,
  pixelRatio: number,
) {
  if (Math.floor(height / step + 0.5) * step <= sea) return 0;
  const distance =
    Math.abs(((((height + step * 0.5) % step) + step) % step) - step * 0.5) / gradient;
  return (
    (1 - smooth(Math.max(0, width * pixelRatio - 0.5), width * pixelRatio + 0.5, distance)) *
    (1 - smooth(step * 0.15, step * 0.4, gradient * pixelRatio))
  );
}
const band = (height: number, gradient: number, step: number, sea: number, ratio: number) =>
  Math.max(
    line(height, gradient, step, sea, CONTOUR_INK.minorWidth, ratio) * CONTOUR_INK.minorAlpha,
    line(height, gradient, step * 5, sea, CONTOUR_INK.majorWidth, ratio) * CONTOUR_INK.majorAlpha,
  );

/** Screen derivative in metres per physical sample pixel; pixelRatio converts
 * to logical display pixels. Crossfade nested, world-anchored intervals; never
 * interpolate a contour's elevation while the camera moves. */
export function terrainContourInk(
  height: number,
  gradient: number,
  interval: number,
  sea: number,
  pixelRatio: number,
  automaticStep: number,
) {
  if (interval === 0 || gradient <= 0.00001) return 0;
  if (interval > 0) return band(height, gradient, interval, sea, pixelRatio);
  const level = Math.max(0, Math.log2(automaticStep / CONTOUR_BASE_METRES));
  const step = CONTOUR_BASE_METRES * 2 ** Math.floor(level),
    blend = smooth(0, 1, level % 1);
  return (
    band(height, gradient, step, sea, pixelRatio) * (1 - blend) +
    band(height, gradient, step * 2, sea, pixelRatio) * blend
  );
}
