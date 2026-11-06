import type { LandscapeRecord } from '../../src/app/atlas/landscape-contracts';
import type { Polygon } from "../../src/app/shared/contracts";
import type { AtlasTerritory } from "../../src/app/atlas/atlas-territories";
import type { CityUnit } from '../../src/app/atlas/city-data-contracts';
import { heightRecord, settingsRecord } from "../../src/app/atlas/terrain-height";
import { vegetationSpec } from "../../src/app/atlas/vegetation";

/** Renderer-independent authored scene. Meters, positive y south, sea level zero.
 * IDs/geometry are stable; canonical creation assigns campaign/city IDs separately.
 * This is the small integrated fixture, not the P8 world-size qualification. */
export const SCENE_VERSION = 1;
export const anchors = {
  overview: { x: 0, y: 0, width: 32768, height: 32768 },
  coast: { x: 10000, y: 0 },
  mountain: { x: -3000, y: -4500 },
  city: { x: -600, y: 250 },
  village: { x: 1800, y: 900 },
  dungeon: { x: -1800, y: -800 },
};
export function rectangle(x: number, y: number, w: number, h = w): Polygon[] {
  return [
    {
      outer: [
        { x, y },
        { x: x + w, y },
        { x: x + w, y: y + h },
        { x, y: y + h },
      ],
      holes: [],
    },
  ];
}

/** Continuous analytic source at every resolution: no independent coarse/fine noise. */
export function elevation(x: number, y: number): number {
  const mainland = 420 * (1 - Math.hypot(x / 10000, y / 8000));
  const island = 160 * (1 - Math.hypot((x - 13000) / 1400, (y - 3500) / 1900));
  const ridge =
    1500 * Math.exp(-(((x + 3000) / 1800) ** 2) - ((y + 4500) / 3000) ** 2);
  const valley =
    120 * Math.exp(-(((x - 1100 * Math.sin(y / 2500)) / 800) ** 2));
  return Math.max(-500, mainland + ridge - valley, island);
}

export function* heightTiles(): Generator<LandscapeRecord> {
  // 64 regional tiles and 16 detailed village tiles. The same surface crosses
  // negative coordinates, tile edges and sea level, with no invented detail seam.
  for (const [pixel, startX, startY, count] of [
    [64, -4, -4, 8],
    [2, 12, 5, 4],
  ] as const) {
    const edge = 64 * pixel;
    for (let ty: number = startY; ty < startY + count; ty++)
      for (let tx: number = startX; tx < startX + count; tx++) {
        const values = new Float32Array(4096);
        for (let y = 0; y < 64; y++)
          for (let x = 0; x < 64; x++)
            values[y * 64 + x] = elevation(
              tx * edge + x * pixel,
              ty * edge + y * pixel,
            );
        yield heightRecord(tx * edge, ty * edge, pixel, values);
      }
  }
}

export function landscape(): LandscapeRecord[] {
  const base = (
    id: string,
    kind: LandscapeRecord["kind"],
    name: string,
  ): LandscapeRecord => ({
    id,
    revision: 0,
    kind,
    name,
    points: [],
    polygons: [],
    resolution: 2,
    width: 0,
    values: {},
  });
  return [
    settingsRecord(0),
    ...heightTiles(),
    {
      ...base("bench:river", "river", "Silberlauf"),
      width: 12,
      style: "river",
      // Follow the analytic valley from its spring downhill into the sea.
      points: Array.from({ length: 43 }, (_, i) => {
        const y = i * 200;
        return { x: 1100 * Math.sin(y / 2500), y };
      }),
      values: { river: true },
    },
    {
      ...base("bench:road", "road", "Küstenstraße"),
      width: 6,
      style: "road",
      points: [
        { x: -1500, y: 200 },
        { x: -600, y: 230 },
        { x: -50, y: 230 },
        { x: 500, y: 600 },
        { x: 1800, y: 875 },
        { x: 4000, y: 1300 },
      ],
      values: { road: true },
    },
    {
      ...base("bench:entrance-path", "road", "Tavernenzugang"),
      width: 1.5,
      style: "path",
      points: [
        { x: 1800, y: 875 },
        { x: 1800, y: 891 },
      ],
      values: { road: true },
    },
    {
      ...base("bench:forest", "vegetation", "Eichenhain"),
      polygons: rectangle(2100, 300, 120, 160),
      vegetation: vegetationSpec("deciduous", 7421),
      values: { terrain: "forest" },
    },
    {
      ...base("bench:city-label", "place", "Silberhafen"),
      points: [anchors.city],
    },
    {
      ...base("bench:village-label", "place", "Weidenfurt"),
      points: [anchors.village],
    },
  ];
}

export function territories(): AtlasTerritory[] {
  return [
    {
      id: "bench:realm",
      name: "Silbermark",
      parentId: null,
      typeId: "realm",
      rank: 5,
      polygons: rectangle(-8000, -7000, 16000, 14000),
    },
    {
      id: "bench:region",
      name: "Unteres Silbertal",
      parentId: "bench:realm",
      typeId: "region",
      rank: 4,
      polygons: rectangle(-3000, -2000, 6500, 5000),
    },
    {
      id: "bench:ward",
      name: "Hafenviertel",
      parentId: "bench:region",
      typeId: "ward",
      rank: 1,
      polygons: rectangle(-600, 250, 500, 400),
    },
  ].map((t) => ({
    ...t,
    revision: 0,
    layerId: "bench:politics",
    color: "#9273b0",
    opacity: 0.13,
    border: "solid" as const,
  }));
}

export function buildings(count: number): CityUnit[] {
  if (!Number.isInteger(count) || count < 1 || count > 5000)
    throw Error("Building count must be 1–5000.");
  const columns = Math.ceil(Math.sqrt(count));
  return Array.from({ length: count }, (_, i) => ({
    id: `bench:building:${i}`,
    kind: "building",
    name: i === 0 ? "Zum Silbernen Ast" : `Haus ${i + 1}`,
    protected: false,
    position: {
      x: 30 + (i % columns) * 28,
      y: 30 + Math.floor(i / columns) * 32,
    },
    angle: 0,
    outline: rectangle(-8, -9, 16, 18)[0]!.outer,
    use: i === 0 ? "Taverne" : "Wohnhaus",
    notes: "",
    groupRecipe: {
      version: 1,
      profile: i === 0 ? "Taverne" : "Wohnhaus",
      width: 16,
      depth: 18,
      seed: `atlas-benchmark-v1-${i}`,
    },
  }));
}
