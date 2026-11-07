import type { Brush } from "./generated/Brush";
import type { BrushMode } from "./generated/BrushMode";

export type FeatureMode = "mountains" | "hills" | "canyon";
export const isFeatureBrush = (mode: BrushMode): mode is FeatureMode =>
  mode === "mountains" || mode === "hills" || mode === "canyon";
export const metres = 0.3048;
export const featurePresets = {
  mountains: [
    { label: "Kleiner Berg", width: 6000, height: 300 },
    { label: "Alpenmassiv", width: 40000, height: 2500 },
    { label: "Achttausender", width: 100000, height: 8500 },
  ],
  hills: [
    { label: "Sanfte Hügel", width: 800, height: 30 },
    { label: "Hügelland", width: 2500, height: 100 },
    { label: "Hohe Hügel", width: 6000, height: 300 },
  ],
  canyon: [
    { label: "Kerbe", width: 200, height: 30 },
    { label: "Schlucht", width: 1500, height: 200 },
    { label: "Großer Canyon", width: 12000, height: 1500 },
  ],
} satisfies Record<
  FeatureMode,
  { label: string; width: number; height: number }[]
>;

export function featurePreset(
  brush: Omit<Brush, "points">,
  mode: FeatureMode,
  index: number,
) {
  const preset = featurePresets[mode][index];
  return {
    ...brush,
    mode,
    radius: preset.width / (2 * metres),
    featureHeight: preset.height / metres,
  };
}
// About 32–64 control intervals per radius, independent of camera zoom.
export const featureResolution = (radius: number) =>
  Math.max(0, Math.min(21, Math.floor(Math.log2(radius / 160))));
export const resizeFeatureRadius = (radius: number, factor: number) =>
  Math.max(10 / (2 * metres), Math.min(200000 / (2 * metres), radius * factor));
export function terrainScreenRadius(
  brush: Omit<Brush, "points">,
  scale: number,
  water = false,
) {
  return isFeatureBrush(brush.mode)
    ? water
      ? 40
      : brush.radius * scale
    : brush.radius;
}
