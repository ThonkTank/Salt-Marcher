import type { Bounds, Camera, WorldPoint } from "./model";

export const WORLD_LIMIT = 100_000_000;
export const MIN_WORLD_SCALE = 0.000002;
export const MAX_SCALE = 25.6;
export const DETAIL_SCALE = 1.28;
// Reference width is always 1,000 CSS pixels, independent of viewport and DPR.
export const ATLAS_VIEWS = [
  { name: "Raum", width: 15 },
  { name: "Haus", width: 60 },
  { name: "Grundstück", width: 240 },
  { name: "Straßenzug", width: 600 },
  { name: "Quartier / kleines Dorf", width: 1500 },
  { name: "Dorf / Stadtteil", width: 4000 },
  { name: "Stadt", width: 15000 },
  { name: "Umland", width: 50000 },
  { name: "Teilregion", width: 150000 },
  { name: "Region", width: 500000 },
  { name: "Land", width: 1500000 },
  { name: "Großregion", width: 4000000 },
  { name: "Kontinent", width: 12000000 },
  { name: "Welt", width: 60960000 },
] as const;
function atlasLevel(scale: number, previous?: number): number {
  const width = 304.8 / scale;
  if (
    previous !== undefined &&
    previous >= 0 &&
    previous < ATLAS_VIEWS.length
  ) {
    const lower = previous ? ATLAS_VIEWS[previous - 1].width : 0;
    if (
      width >= lower * 0.9 &&
      (previous === ATLAS_VIEWS.length - 1 ||
        width <= ATLAS_VIEWS[previous].width * 1.1)
    )
      return previous;
  }
  const index = ATLAS_VIEWS.findIndex((v) => width <= v.width);
  return index < 0 ? ATLAS_VIEWS.length - 1 : index;
}
export function viewScale(level: number): number {
  return Math.max(
    MIN_WORLD_SCALE,
    Math.min(MAX_SCALE, 304.8 / (ATLAS_VIEWS[level].width * 0.75)),
  );
}
export function zoomAt(
  camera: Camera,
  point: WorldPoint,
  scale: number,
): Camera {
  return {
    scale,
    x: camera.x + point[0] * (camera.scale - scale),
    y: camera.y + point[1] * (camera.scale - scale),
  };
}
export function scaleBar(scale: number): { pixels: number; label: string } {
  const meters = (120 * 0.3048) / scale;
  const power = 10 ** Math.floor(Math.log10(meters));
  const value = [5, 2, 1].find((n) => n * power <= meters)! * power;
  return {
    pixels: (value / 0.3048) * scale,
    label:
      value >= 1000
        ? `${value / 1000} km`
        : `${Number(value.toPrecision(3))} m`,
  };
}

function lodPolicy(scale: number) {
  return {
    exact: scale >= DETAIL_SCALE,
    roofs: scale >= 0.064,
    buildingNames: scale >= 0.32,
    importantNames: scale >= 0.0064,
    detailBrushes: scale >= 0.32,
    minRoadWidth: scale < 0.064 ? 12 : 0,
    minRoadLabelWidth: scale < 0.064 ? 20 : 0,
  };
}

export function clampCamera(
  camera: Camera,
  width: number,
  height: number,
): Camera {
  const halfX = width / (2 * camera.scale),
    halfY = height / (2 * camera.scale);
  const center = (offset: number, half: number) => {
    const margin = Math.max(0, WORLD_LIMIT - half);
    return Math.max(-margin, Math.min(margin, half - offset / camera.scale));
  };
  return {
    ...camera,
    x: width / 2 - center(camera.x, halfX) * camera.scale,
    y: height / 2 - center(camera.y, halfY) * camera.scale,
  };
}

export function landAuthorResolution(scale: number): number {
  return Math.max(0, Math.min(21, Math.floor(Math.log2(2 / (5 * scale)))));
}

function terrainResolution(scale: number, screenStep = 8): number {
  return Math.max(
    0,
    Math.min(21, Math.ceil(Math.log2(screenStep / (5 * scale)))),
  );
}

function groundResolution(scale: number): number {
  return Math.max(0, Math.min(24, Math.ceil(Math.log2(1 / scale)) - 1));
}

// Only enumerate after the clipped range fits the transport budget.
export function tileRequest(
  bounds: Bounds,
  level: number,
  size: number,
  maxLevel: number,
) {
  const clipped = [
    Math.max(-WORLD_LIMIT, bounds[0]),
    Math.max(-WORLD_LIMIT, bounds[1]),
    Math.min(WORLD_LIMIT, bounds[2]),
    Math.min(WORLD_LIMIT, bounds[3]),
  ];
  const tiles: [number, number][] = [];
  if (clipped[0] > clipped[2] || clipped[1] > clipped[3])
    return { level, tiles };
  for (; level <= maxLevel; level++) {
    const width = size * 2 ** level;
    const x0 = Math.floor(clipped[0] / width),
      y0 = Math.floor(clipped[1] / width),
      x1 = Math.floor(clipped[2] / width),
      y1 = Math.floor(clipped[3] / width);
    if ((x1 - x0 + 1) * (y1 - y0 + 1) > 64) continue;
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) tiles.push([x, y]);
    return { level, tiles };
  }
  throw Error("Kartenausschnitt überschreitet das Kachelbudget.");
}

const LOD_THRESHOLDS = [
  0.0064,
  0.064,
  0.32,
  DETAIL_SCALE,
  ...Array.from({ length: 23 }, (_, level) => 8 / (5 * 2 ** level)),
  ...Array.from({ length: 24 }, (_, level) => 1 / 2 ** (level + 1)),
];

// Enter a detail band at its nominal boundary; retain it over a 10% zoom-out
// margin. Coordinate transforms always use the unmodified physical scale.
function stableLodScale(scale: number, previous?: number): number {
  return LOD_THRESHOLDS.reduce(
    (stable, boundary) =>
      previous !== undefined &&
      previous >= boundary &&
      scale >= boundary * 0.9 &&
      scale < boundary
        ? Math.max(stable, boundary)
        : stable,
    scale,
  );
}
/** Semantic LOD is derived once from physical zoom and its previous decision. */
export type LodDecision = Readonly<{
  atlasLevel: number;
  navigationLevel: number;
  policy: ReturnType<typeof lodPolicy>;
  cityLevel: number;
  terrainLevel: number;
  groundLevel: number;
  authorTerrainLevel: number;
  /** Retained solely to apply the existing return margin on the next decision. */
  stableScale: number;
}>;

export function decideLod(scale: number, previous?: LodDecision): LodDecision {
  const stableScale = stableLodScale(scale, previous?.stableScale);
  const idealCity = Math.max(0, Math.min(20, Math.floor(Math.log2(1 / scale))));
  const pixels = previous && 16 * 2 ** previous.cityLevel * scale;
  const cityLevel =
    pixels !== undefined && pixels >= 7.2 && pixels <= 17.6
      ? previous!.cityLevel
      : idealCity;
  const result = {
    atlasLevel: atlasLevel(scale, previous?.atlasLevel),
    navigationLevel: atlasLevel(scale),
    policy: lodPolicy(stableScale),
    cityLevel,
    // Smaller display tiles bound the raster work of a local brush section.
    // Author resolution stays independent; tileRequest still caps the view at 64.
    terrainLevel: terrainResolution(stableScale, 4),
    groundLevel: groundResolution(stableScale),
    authorTerrainLevel: terrainResolution(scale),
    stableScale,
  };
  if (
    previous &&
    previous.stableScale === result.stableScale &&
    previous.atlasLevel === result.atlasLevel &&
    previous.navigationLevel === result.navigationLevel &&
    previous.cityLevel === result.cityLevel &&
    previous.terrainLevel === result.terrainLevel &&
    previous.groundLevel === result.groundLevel &&
    previous.authorTerrainLevel === result.authorTerrainLevel
  )
    return previous;
  return result;
}
