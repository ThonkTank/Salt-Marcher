import { opacityFromAlphaByte } from "./pattern-appearance";

export interface PatternColorValue {
  color: number;
  opacity: number;
}

export interface PatternColorSample {
  color: number;
  alphaByte: number;
}

export type RgbChannel = "r" | "g" | "b";

function byte(value: number): number {
  if (!Number.isInteger(value) || value < 0 || value > 255)
    throw new RangeError("RGB/alpha channel must be an integer from 0 to 255.");
  return value;
}

function rgb(color: number): [number, number, number] {
  if (!Number.isInteger(color) || color < 0 || color > 0xffffff)
    throw new RangeError("Pattern RGB must be a 24-bit integer.");
  return [(color >>> 16) & 255, (color >>> 8) & 255, color & 255];
}

export function patternRgbChannels(color: number): Record<RgbChannel, number> {
  const [r, g, b] = rgb(color);
  return { r, g, b };
}

export function patternWithRgbChannel(
  color: number,
  channel: RgbChannel,
  value: number,
): number {
  const channels = patternRgbChannels(color);
  channels[channel] = byte(value);
  return (channels.r << 16) | (channels.g << 8) | channels.b;
}

export interface PatternHsv {
  hue: number; // normalized 0–1, starting at red
  saturation: number;
  value: number;
}

export function patternHsv(color: number): PatternHsv {
  const [red, green, blue] = rgb(color).map((channel) => channel / 255);
  const max = Math.max(red!, green!, blue!);
  const min = Math.min(red!, green!, blue!);
  const delta = max - min;
  let hue = 0;
  if (delta !== 0) {
    if (max === red) hue = ((green! - blue!) / delta) % 6;
    else if (max === green) hue = (blue! - red!) / delta + 2;
    else hue = (red! - green!) / delta + 4;
    hue = ((hue / 6) + 1) % 1;
  }
  return { hue, saturation: max === 0 ? 0 : delta / max, value: max };
}

function unit(value: number): number {
  if (!Number.isFinite(value) || value < 0 || value > 1)
    throw new RangeError("HSV component must be between 0 and 1.");
  return value;
}

export function patternRgbFromHsv({ hue, saturation, value }: PatternHsv): number {
  unit(hue);
  unit(saturation);
  unit(value);
  const h = (hue % 1) * 6;
  const chroma = value * saturation;
  const secondary = chroma * (1 - Math.abs((h % 2) - 1));
  const low = value - chroma;
  const sextant = Math.floor(h);
  const [r, g, b] = (
    sextant === 0 ? [chroma, secondary, 0]
      : sextant === 1 ? [secondary, chroma, 0]
      : sextant === 2 ? [0, chroma, secondary]
      : sextant === 3 ? [0, secondary, chroma]
      : sextant === 4 ? [secondary, 0, chroma]
      : [chroma, 0, secondary]
  ).map((channel) => Math.floor((channel + low) * 255 + 1e-9));
  return (r! << 16) | (g! << 8) | b!;
}

/** The control supplies its normalized position; this does not assume screen dimensions. */
export function patternWithHue(color: number, hue: number): number {
  return patternRgbFromHsv({ ...patternHsv(color), hue: unit(hue) });
}

export function patternWithSaturationValue(
  color: number,
  saturation: number,
  value: number,
): number {
  return patternRgbFromHsv({
    ...patternHsv(color),
    saturation: unit(saturation),
    value: unit(value),
  });
}

/** A sampled rendered pixel supplies its own alpha; opaque floor sampling set A=255. */
export function patternWithSample(
  _current: PatternColorValue,
  sample: PatternColorSample,
): PatternColorValue {
  rgb(sample.color);
  return { color: sample.color, opacity: opacityFromAlphaByte(byte(sample.alphaByte)) };
}
