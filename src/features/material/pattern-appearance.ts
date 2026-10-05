export function opacityFromAlphaByte(alpha: number): number {
  if (!Number.isInteger(alpha) || alpha < 0 || alpha > 255)
    throw new RangeError("Alpha must be an integer from 0 to 255.");
  return alpha / 255;
}

export function alphaByteFromOpacity(opacity: number): number {
  if (!Number.isFinite(opacity) || opacity < 0 || opacity > 1)
    throw new RangeError("Opacity must be between 0 and 1.");
  return Math.round(opacity * 255);
}
