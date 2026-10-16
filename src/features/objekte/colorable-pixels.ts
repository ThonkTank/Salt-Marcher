/** Candidate fitted to Dungeondraft 1.2.0.1 Colorable object charts. */
export interface ColorableObjectSettings {
  readonly minRedness: number;
  readonly minSaturation: number;
  readonly redTolerance: number;
}

export type Rgba = readonly [number, number, number, number];

export const DEFAULT_COLORABLE_OBJECT_SETTINGS: ColorableObjectSettings = {
  minRedness: 0.1,
  minSaturation: 0,
  redTolerance: 0.04,
};

/** Disabled package overrides use native defaults, even if override values exist. */
export function colorableSettingsFromMetadata(
  overrides: unknown,
): ColorableObjectSettings {
  if (!overrides || typeof overrides !== "object" ||
      (overrides as Record<string, unknown>).enabled !== true)
    return DEFAULT_COLORABLE_OBJECT_SETTINGS;
  const source = overrides as Record<string, unknown>;
  const values = [source.min_redness, source.min_saturation, source.red_tolerance];
  if (values.some((value) =>
    typeof value !== "number" || !Number.isFinite(value) ||
    value < 0 || value > 1))
    throw new Error("Ungültige Colorable-Paketparameter.");
  return {
    minRedness: source.min_redness as number,
    minSaturation: source.min_saturation as number,
    redTolerance: source.red_tolerance as number,
  };
}

function recolorPixel(
  source: Rgba,
  target: Rgba,
  settings: ColorableObjectSettings,
): Rgba {
  const [red, green, blue, alpha] = source;
  const r = red / 255, g = green / 255, b = blue / 255;
  const selected =
    r - (g + b) / 2 > settings.minRedness &&
    Math.abs(g - b) < settings.redTolerance &&
    1 - (g + b) / 2 > settings.minSaturation;
  if (!selected) return source;
  const white = Math.max(0, 0.3 * r + 0.59 * g + 0.11 * b - 1 / 3);
  return [
    Math.round(255 * (r * (target[0] / 255) * (1 - white) + white)),
    Math.round(255 * (r * (target[1] / 255) * (1 - white) + white)),
    Math.round(255 * (r * (target[2] / 255) * (1 - white) + white)),
    Math.round(alpha * target[3] / 255),
  ];
}

/** Source channels must be raw, unpremultiplied PNG bytes. */
export function recolorColorableObjectPixel(
  source: Rgba,
  target: Rgba,
  settings: ColorableObjectSettings = DEFAULT_COLORABLE_OBJECT_SETTINGS,
): Rgba {
  return recolorPixel(source, target, settings);
}

/** Returns a fresh RGBA buffer; never alters a cached source texture. */
export function recolorColorableObjectRgba(
  source: Uint8Array | Uint8ClampedArray,
  target: Rgba,
  settings: ColorableObjectSettings = DEFAULT_COLORABLE_OBJECT_SETTINGS,
): Uint8Array {
  if (source.length % 4 !== 0)
    throw new Error("Ungültige RGBA-Bilddaten.");
  const result = new Uint8Array(source.length);
  for (let i = 0; i < source.length; i += 4) {
    const pixel = recolorPixel(
      [source[i]!, source[i + 1]!, source[i + 2]!, source[i + 3]!],
      target,
      settings,
    );
    result.set(pixel, i);
  }
  return result;
}
