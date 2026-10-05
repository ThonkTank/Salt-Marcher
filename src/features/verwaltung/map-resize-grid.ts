export interface ResizeMargins {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

/** Move row-major map cells with the canvas; discard cells outside its new bounds. */
export function resizeCellGrid<T>(
  cells: readonly T[],
  width: number,
  height: number,
  margins: ResizeMargins,
  empty: T,
): { width: number; height: number; cells: T[] } {
  const nextWidth = width + margins.left + margins.right;
  const nextHeight = height + margins.top + margins.bottom;
  if (![width, height, margins.left, margins.right, margins.top, margins.bottom,
    nextWidth, nextHeight].every(Number.isSafeInteger) ||
    width <= 0 || height <= 0 || nextWidth <= 0 || nextHeight <= 0 ||
    !Number.isSafeInteger(width * height) ||
    !Number.isSafeInteger(nextWidth * nextHeight) ||
    cells.length !== width * height)
    throw new RangeError("Ungültiges Kartenraster oder ungültige Ränder");

  const next = Array<T>(nextWidth * nextHeight).fill(empty);
  for (let y = 0; y < height; y++) {
    const nextY = y + margins.top;
    if (nextY < 0 || nextY >= nextHeight) continue;
    for (let x = 0; x < width; x++) {
      const nextX = x + margins.left;
      if (nextX >= 0 && nextX < nextWidth)
        next[nextY * nextWidth + nextX] = cells[y * width + x]!;
    }
  }
  return { width: nextWidth, height: nextHeight, cells: next };
}
