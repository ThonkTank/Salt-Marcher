export interface NativePathPixels {
  readonly width: number;
  readonly height: number;
}

/** The observed original map stores 256 texture pixels per field. */
const PIXELS_PER_FIELD = 256;

export function nativePathDimensions(
  pixels: NativePathPixels,
  widthFactor: number,
): { width: number; repeatLength: number } {
  if (![pixels.width, pixels.height, widthFactor].every(
    (value) => Number.isFinite(value) && value > 0,
  )) throw new RangeError("Ungültige native Pfadmaße.");
  return {
    width: pixels.height * widthFactor / PIXELS_PER_FIELD,
    repeatLength: pixels.width * widthFactor / PIXELS_PER_FIELD,
  };
}

export function nativePathWidthFactor(
  width: number,
  pixels: NativePathPixels,
): number {
  return width / nativePathDimensions(pixels, 1).width;
}
