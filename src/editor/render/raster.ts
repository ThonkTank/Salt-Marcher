import type { Bounds } from "../model";

/** Exact height is sampled first; colour is a pure display classification. */
export function colour(height: number): [number, number, number] {
  if (height < 0) {
    const depth = Math.min(1, -height / 300);
    return [
      Math.round(94 - 53 * depth),
      Math.round(147 - 57 * depth),
      Math.round(166 - 44 * depth),
    ];
  }
  if (height < 12) return [201, 192, 144];
  const shade = Math.min(1, height / 600);
  return [
    Math.round(132 + 60 * shade),
    Math.round(151 + 34 * shade),
    Math.round(103 + 64 * shade),
  ];
}

export function rasterize(
  sample: (x: number, y: number) => number,
  bounds: Bounds,
  size: number,
  rect: [number, number, number, number],
): Uint8Array {
  const [x0, y0, x1, y1] = rect;
  const width = x1 - x0,
    height = y1 - y0;
  const pixels = new Uint8Array(width * height * 4);
  // World-edge tiles can be clipped on only one axis.
  const stepX = (bounds[2] - bounds[0]) / size;
  const stepY = (bounds[3] - bounds[1]) / size;
  for (let row = 0; row < height; row++) {
    const y = bounds[1] + (y0 + row + 0.5) * stepY;
    for (let column = 0; column < width; column++) {
      const x = bounds[0] + (x0 + column + 0.5) * stepX;
      const rgb = colour(sample(x, y));
      const i = (row * width + column) * 4;
      pixels[i] = rgb[0];
      pixels[i + 1] = rgb[1];
      pixels[i + 2] = rgb[2];
      pixels[i + 3] = 255;
    }
  }
  return pixels;
}
