import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
buildSync({
  stdin: {
    contents:
      "export {terrainHorizon} from './src/app/atlas/terrain-coverage';export * from './src/app/atlas/atlas-camera';export {zoomBox} from './src/app/atlas/atlas-navigation-scale';export * from './src/app/atlas/terrain-spatial-model';export * as THREE from 'three';",
    resolveDir: process.cwd(),
  },
  outfile: '.build/atlas-perspective-camera-test.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const {
  zoomBox,
  atlasProject,
  atlasPlanePoint,
  atlasAnchorCamera,
  atlasCameraWorldEye,
  atlasNormalizeRotation,
  atlasSafeCameraMove,
  atlasRefocusCamera,
  terrainVisible,
  terrainHorizon,
  gridHeight,
  validateTerrainView,
  TerrainSpatialView,
  TerrainRing,
  TerrainRouteVisibility,
  AtlasSpatialLabels,
  THREE,
  ATLAS_CAMERA_FOV,
} = require('../../.build/atlas-perspective-camera-test.cjs');
function pose(offset = 0, width = 400) {
  return {
    projection: 'perspective',
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
const close = (a, b, tolerance = 1e-7) => assert(Math.abs(a - b) <= tolerance, `${a} != ${b}`);
test('perspective projection round trips work planes at every pose and far, fine coordinates', () => {
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
              Math.max(1e-7, ((Math.abs(offset) * Number.EPSILON) / width) * 12),
            );
            close(
              result.y,
              screen.y,
              Math.max(1e-7, ((Math.abs(offset) * Number.EPSILON) / width) * 12),
            );
          }
        }
  const v = { ...pose(), tilt: 75 };
  assert.equal(atlasPlanePoint(v, { x: 0.5, y: 0 }), null, 'sky is not an editable plane');
});
test('legacy orthographic brush snapshots stay valid; malformed projection is rejected', () => {
  const v = pose();
  delete v.projection;
  validateTerrainView(v);
  validateTerrainView({ ...v, projection: 'perspective', tilt: 75 });
  assert.throws(() => validateTerrainView({ ...v, projection: 'spherical' }));
  assert.throws(() => validateTerrainView({ ...v, tilt: 76 }));
  const p = { x: 20, y: -30 },
    screen = atlasProject(v, p, 60),
    roundTrip = atlasPlanePoint(v, screen);
  close(roundTrip.x, p.x);
  close(roundTrip.y, p.y);
});

test('zoom stays anchored on elevated terrain using the corresponding work-plane ray', () => {
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

test('physical terrain anchors retain CSS position across combined orbit and zoom above the focus plane', () => {
  for (const scale of [1, 2])
    for (const offset of [0, 1e9])
      for (const tilt of [0, 45, 75])
        for (const rotation of [-170, 0, 90, 175]) {
          const before = { ...pose(offset), tilt, rotation };
          const point = { x: offset + 15, y: -offset + 20, heightM: 80 };
          const screen = atlasProject(before, point, point.heightM);
          const requested = {
            ...before,
            tilt: Math.min(75, tilt + 13),
            rotation: rotation + 37,
            frame: { ...before.frame, width: 280, height: 224 },
          };
          const next = atlasAnchorCamera(requested, { point, screen });
          const actual = atlasProject(next, point, point.heightM);
          close(actual.x * 800, screen.x * 800, 0.001 / scale);
          close(actual.y * 640, screen.y * 640, 0.001 / scale);
        }
  assert.equal(atlasNormalizeRotation(540), -180);
  assert.equal(atlasNormalizeRotation(-721), -1);
});

test('collision constrains aggressive zoom and a pan whose endpoints clear a ridge', () => {
  const before = { ...pose(), focusM: 0, tilt: 75 };
  const eye = atlasCameraWorldEye(before);
  const ground = eye.heightM - 10;
  const zoom = atlasSafeCameraMove(
    before,
    { ...before, frame: { ...before.frame, width: 0.1, height: 0.08 } },
    () => ground,
    () => false,
  );
  assert(zoom.frame.width > 0.1);
  assert(atlasCameraWorldEye(zoom).heightM > ground + 0.02);
  let checkedPath = false;
  const pan = atlasSafeCameraMove(
    before,
    { ...before, frame: { ...before.frame, y: before.frame.y + 100 } },
    () => 0,
    (a, b) => {
      checkedPath = true;
      return a.y < eye.y + 50 && b.y > eye.y + 50;
    },
  );
  assert(checkedPath);
  assert.equal(
    pan.frame.y,
    before.frame.y,
    'a high ridge between safe endpoints blocks the eye path',
  );
});

test('unknown terrain keeps the last known ground plane and orbit checks intermediate eyes', () => {
  const before = { ...pose(), focusM: 100, tilt: 75 };
  const requested = { ...before, rotation: 180 };
  const safe = atlasSafeCameraMove(
    before,
    requested,
    (p) => (Math.abs(p.x) > 300 ? 1000 : null),
    () => false,
  );
  assert(
    Math.abs(safe.rotation) < 180 && Math.abs(safe.rotation) > 0,
    'orbit stops before the intermediate mountain',
  );
  const fallback = atlasSafeCameraMove(
    before,
    { ...before, focusM: -1000 },
    () => null,
    () => false,
  );
  assert(
    atlasCameraWorldEye(fallback).heightM > before.focusM,
    'missing coverage does not authorize descent through the focus plane',
  );
});

test('adopting a new terrain focus keeps the real eye and every world projection unchanged', () => {
  for (const tilt of [0, 45, 75]) {
    const before = { ...pose(), tilt };
    const eye = atlasCameraWorldEye(before);
    const next = atlasRefocusCamera(before, -100);
    const afterEye = atlasCameraWorldEye(next);
    for (const axis of ['x', 'y', 'heightM']) close(afterEye[axis], eye[axis]);
    assert.equal(next.focusM, -100);
    for (const point of [
      { x: 15, y: 20, heightM: 80 },
      { x: -30, y: 40, heightM: -100 },
    ]) {
      const a = atlasProject(before, point, point.heightM),
        b = atlasProject(next, point, point.heightM);
      close(a.x, b.x);
      close(a.y, b.y);
      close(a.depth, b.depth);
    }
  }
});

test('retreat from close ground to overview uses each endpoint own scale clearance', () => {
  const before = { ...pose(0, 0.1), focusM: 0, tilt: 75 };
  const requested = {
    ...before,
    frame: { x: -500000, y: -400000, width: 1000000, height: 800000 },
  };
  const safe = atlasSafeCameraMove(
    before,
    requested,
    () => 0,
    (a, b) => a.heightM <= 0 && b.heightM >= 0,
  );
  assert.equal(
    safe.frame.width,
    requested.frame.width,
    'larger clearance must not trap an otherwise safe retreat',
  );
});
