import { createHash } from "node:crypto";
import type { CommitPatch } from "../src/editor/bridge";
import {
  encodeHeightDependency,
  HEIGHT_CONTENT_IDENTITY_PREFIX,
  type HeightDependency,
} from "../src/editor/model/content-identity";
import { heightTilesFromControls } from "../src/editor/model/fixtures";
import { houseKey, type HouseHeader } from "../src/editor/model/house";
import {
  HEIGHT_BASE,
  HEIGHT_LEVELS,
  type HeightTile,
} from "../src/editor/model/types";
import {
  waterBounds,
  waterKey,
  type WaterSource,
} from "../src/editor/model/water";

/** A normal document template, persisted through the common author transaction. */
export function preparedWaterScene(): CommitPatch[] {
  // Cubic B-splines reproduce this plane in the central area: the surrounding
  // controls leave ample support beyond both saved masks and the river banks.
  const controls: [number, number, number][] = [];
  for (let y = -16; y <= 16; y++)
    for (let x = -16; x <= 16; x++)
      controls.push([x, y, 34 + 0.025 * x * 40 + 0.01 * y * 40 - HEIGHT_BASE]);
  const heights = heightTilesFromControls(3, controls, 1);
  const temporaryDependency: HeightDependency = {
    kind: "height",
    bounds: [-640, -640, 640, 640],
    identity: `${HEIGHT_CONTENT_IDENTITY_PREFIX}${"0".repeat(64)}`,
  };
  const lake: WaterSource = {
    kind: "lake",
    id: "prepared-lake",
    revision: 1,
    name: "Hangsee",
    rings: [
      [
        [-280, -160],
        [-20, -160],
        [-20, 120],
        [-280, 120],
      ],
      [
        [-210, -60],
        [-150, -60],
        [-150, 0],
        [-210, 0],
      ],
    ],
    level: 32,
    terrain: temporaryDependency,
  };
  const river: WaterSource = {
    kind: "river",
    id: "prepared-river",
    revision: 1,
    name: "Hangbach",
    samples: [
      { point: [60, -180], width: 36, level: 38 },
      { point: [80, -60], width: 42, level: 35 },
      { point: [100, 60], width: 48, level: 32 },
      { point: [160, 180], width: 54, level: 29 },
    ],
    terrain: temporaryDependency,
  };
  const waters = [lake, river].map((source) => ({
    ...source,
    terrain: dependencyFor(source, heights),
  }));
  const house: HouseHeader = {
    id: "prepared-house",
    revision: 1,
    x: 132,
    y: 55,
    width: 52,
    depth: 36,
    rotation: 15,
    foundationHeight: 1,
    foundationTransition: 12,
  };
  return [
    ...heights.map((after) => ({
      kind: "height" as const,
      key: after.key,
      after,
    })),
    { kind: "house", key: houseKey(house.id), after: house },
    ...waters.map((after) => ({
      kind: "water" as const,
      key: waterKey(after.id),
      after,
    })),
  ];
}

function dependencyFor(
  source: WaterSource,
  tiles: HeightTile[],
): HeightDependency {
  const bounds = waterBounds(source);
  const hash = createHash("sha256");
  for (const chunk of encodeHeightDependency({
    bounds,
    levels: HEIGHT_LEVELS,
    tiles,
  }))
    hash.update(chunk);
  return {
    kind: "height",
    bounds,
    identity: `${HEIGHT_CONTENT_IDENTITY_PREFIX}${hash.digest("hex")}`,
  };
}
