export interface ObjectColorAlpha {
  readonly rgb: number;
  readonly alphaByte: number;
}

/** Dungeondraft 1.2.0.1 stores Colorable object colors as eight ARGB hex digits. */
export function readObjectArgb(value: string): ObjectColorAlpha {
  if (!/^[0-9a-f]{8}$/i.test(value))
    throw new Error("Ungültige ARGB-Objektfarbe.");
  return {
    alphaByte: Number.parseInt(value.slice(0, 2), 16),
    rgb: Number.parseInt(value.slice(2), 16),
  };
}

export function writeObjectArgb(color: ObjectColorAlpha): string {
  if (
    !Number.isInteger(color.alphaByte) ||
    color.alphaByte < 0 || color.alphaByte > 255 ||
    !Number.isInteger(color.rgb) ||
    color.rgb < 0 || color.rgb > 0xffffff
  )
    throw new RangeError("Ungültige RGB- oder Alpha-Komponente.");
  return color.alphaByte.toString(16).padStart(2, "0") +
    color.rgb.toString(16).padStart(6, "0");
}

export function objectAlphaOpacity(alphaByte: number): number {
  if (!Number.isInteger(alphaByte) || alphaByte < 0 || alphaByte > 255)
    throw new RangeError("Ungültiger Alpha-Wert.");
  return alphaByte / 255;
}
