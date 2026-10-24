import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSync } from "esbuild";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
buildSync({
  stdin: {
    contents:
      "export {terrainHorizon} from './src/app/terrain-coverage';export * from './src/app/atlas-camera';export {zoomBox} from './src/app/atlas-navigation-scale';export * from './src/app/terrain-spatial-model';export * as THREE from 'three';",
    resolveDir: process.cwd(),
  },
  outfile: ".build/atlas-perspective-camera-test.cjs",
  bundle: true,
  platform: "node",
  format: "cjs",
});
const {
  zoomBox,
  atlasProject,
  atlasPlanePoint,
  terrainVisible,
  terrainHorizon,
  gridHeight,
  validateTerrainView,
  TerrainSpatialView,
  TerrainRing,
  TerrainRouteVisibility,
  TerrainHexGrid,
  AtlasSpatialLabels,
  THREE,
  ATLAS_CAMERA_FOV,
} = require("../.build/atlas-perspective-camera-test.cjs");
function pose(offset = 0, width = 400) {
  return {
    projection: "perspective",
    frame: {
      x: offset - width / 2,
      y: -offset - width * 0.4,
      width,
      height: width * 0.8,
    },
    box: {
      x: offset - width * 1.5,
      y: -offset - width * 1.2,
      width: width * 3,
      height: width * 2.4,
    },
    columns: 33,
    rows: 33,
    focusM: 60,
    tilt: 0,
    rotation: 0,
    exaggeration: 1,
  };
}
const close = (a, b, tolerance = 1e-7) =>
  assert(Math.abs(a - b) <= tolerance, `${a} != ${b}`);
test("perspective projection round trips work planes at every pose and far, fine coordinates", () => {
  for (const offset of [0, -1e10, 1e10])
    for (const width of [0.1, 400, 4e7])
      for (const tilt of [0, 45, 75])
        for (const rotation of [-180, -45, 0, 90, 180]) {
          const v = { ...pose(offset, width), tilt, rotation };
          for (const screen of [
            { x: 0.5, y: 0.5 },
            { x: 0.35, y: 0.7 },
            { x: 0.7, y: 0.8 },
          ]) {
            const point = atlasPlanePoint(v, screen);
            assert(point);
            const result = atlasProject(v, point, 60);
            close(
              result.x,
              screen.x,
              Math.max(
                1e-7,
                ((Math.abs(offset) * Number.EPSILON) / width) * 12,
              ),
            );
            close(
              result.y,
              screen.y,
              Math.max(
                1e-7,
                ((Math.abs(offset) * Number.EPSILON) / width) * 12,
              ),
            );
          }
        }
  const v = { ...pose(), tilt: 75 };
  assert.equal(
    atlasPlanePoint(v, { x: 0.5, y: 0 }),
    null,
    "sky is not an editable plane",
  );
});
test("legacy orthographic brush snapshots stay valid; malformed projection is rejected", () => {
  const v = pose();
  delete v.projection;
  validateTerrainView(v);
  validateTerrainView({ ...v, projection: "perspective", tilt: 75 });
  assert.throws(() => validateTerrainView({ ...v, projection: "spherical" }));
  assert.throws(() => validateTerrainView({ ...v, tilt: 76 }));
  const p = { x: 20, y: -30 },
    screen = atlasProject(v, p, 60),
    roundTrip = atlasPlanePoint(v, screen);
  close(roundTrip.x, p.x);
  close(roundTrip.y, p.y);
});

test("zoom stays anchored on elevated terrain using the corresponding work-plane ray", () => {
  for (const tilt of [0, 45, 75])
    for (const rotation of [0, 90, 160])
      for (const factor of [0.4, 1.8]) {
        const v = { ...pose(), tilt, rotation },
          point = { x: 15, y: 20 },
          heightM = 80,
          screen = atlasProject(v, point, heightM),
          anchor = atlasPlanePoint(v, screen);
        assert(anchor);
        const next = {
            ...v,
            frame: zoomBox(v.frame, v.frame.width * factor, anchor),
          },
          projected = atlasProject(next, point, heightM);
        close(projected.x, screen.x);
        close(projected.y, screen.y);
      }
});