/** Editor cameras are axis-aligned. Keep a device-pixel guard for rounded clips. */
export function visibleRasterTile(
  tile: { x: number; y: number },
  width: number,
  transform: DOMMatrix,
  canvas: HTMLCanvasElement,
  guard = 1,
): boolean {
  const left = tile.x * width * transform.a + transform.e;
  const top = tile.y * width * transform.d + transform.f;
  return (
    left <= canvas.width + guard &&
    top <= canvas.height + guard &&
    left + width * transform.a >= -guard &&
    top + width * transform.d >= -guard
  );
}
