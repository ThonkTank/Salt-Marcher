/** Canvas accepts alpha in CSS colors; Three separates color from opacity. */
export function atlasSpatialColor(value: string, opacity: number) {
  if (value === "transparent") return { color: "#ffffff", opacity: 0 };
  const hex = /^#([0-9a-f]{4}|[0-9a-f]{8})$/i.exec(value);
  if (hex) {
    const digits =
      hex[1]!.length === 4 ? [...hex[1]!].map((c) => c + c).join("") : hex[1]!;
    return {
      color: "#" + digits.slice(0, 6),
      opacity: (opacity * parseInt(digits.slice(6), 16)) / 255,
    };
  }
  const functional = /^(rgb|hsl)a\((.*),\s*([\d.]+)(%)?\s*\)$/i.exec(value);
  if (functional)
    return {
      color: `${functional[1]}(${functional[2]})`,
      opacity:
        opacity *
        Math.max(
          0,
          Math.min(1, Number(functional[3]) / (functional[4] ? 100 : 1)),
        ),
    };
  return { color: value, opacity };
}
