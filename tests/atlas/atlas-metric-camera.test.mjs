import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';

buildSync({
  entryPoints: ['src/app/atlas/atlas-metric-camera.ts'],
  outfile: '.build/atlas-metric-camera-test.mjs',
  bundle: true,
  platform: 'node',
  format: 'esm',
});
const cameraMath = await import('../../.build/atlas-metric-camera-test.mjs');
const { atlasMetricFrame, AtlasMetricView, atlasMetricZoomAt, atlasMetricPanAt } = cameraMath;
buildSync({
  entryPoints: ['src/app/atlas/atlas-camera.ts'],
  outfile: '.build/atlas-camera-reference-test.mjs',
  bundle: true,
  platform: 'node',
  format: 'esm',
});
const { atlasProject, atlasPlanePoint, ATLAS_CAMERA_FOV } = await import(
  '../../.build/atlas-camera-reference-test.mjs'
);

function fixture(overrides = {}) {
  return {
    focus: { x: 12345.25, y: -5432.5 },
    focusHeightM: 145,
    metersPerPixel: 0.7,
    rotation: 37,
    tilt: 55,
    exaggeration: 2.5,
    ...overrides,
  };
}
function close(actual, expected, tolerance = 1e-7) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${actual} not within ${tolerance} of ${expected}`,
  );
}

test('Deck viewport projection matches Atlas CPU camera at five scales and varied heights', () => {
  const width = 913,
    height = 647;
  for (const metersPerPixel of [0.002, 0.1, 1, 250, 100000]) {
    const camera = fixture({ metersPerPixel });
    const frame = atlasMetricFrame(camera, width, height);
    const pose = {
      frame: {
        x: camera.focus.x - (width * metersPerPixel) / 2,
        y: camera.focus.y - (height * metersPerPixel) / 2,
        width: width * metersPerPixel,
        height: height * metersPerPixel,
      },
      focusM: camera.focusHeightM,
      tilt: camera.tilt,
      rotation: camera.rotation,
      exaggeration: camera.exaggeration,
      projection: 'perspective',
    };
    for (const delta of [
      [0, 0, 0],
      [35, -28, 12],
      [-90, 40, -8],
    ]) {
      const point = {
        x: camera.focus.x + delta[0],
        y: camera.focus.y + delta[1],
        heightM: camera.focusHeightM + delta[2],
      };
      const expected = atlasProject(pose, { x: point.x, y: point.y }, point.heightM);
      const actual = frame.project(point);
      close(actual.x, expected.x * width, 2e-7);
      close(actual.y, expected.y * height, 2e-7);
      close(actual.depthM, expected.depth, 2e-7);
    }
  }
  assert.ok(ATLAS_CAMERA_FOV > 0);
});

test('render origin is snapped in double precision and local geometry stays small at far coordinates', () => {
  const camera = fixture({
    focus: { x: 1_000_000_000_000.25, y: -300_000_000_000.125 },
    metersPerPixel: 0.005,
    tilt: 72,
  });
  const frame = atlasMetricFrame(camera, 800, 600);
  const point = {
    x: camera.focus.x + 0.125,
    y: camera.focus.y - 0.25,
    heightM: camera.focusHeightM + 0.5,
  };
  const local = frame.toLocal(point);
  assert.equal(frame.origin.x, Math.floor(camera.focus.x / 256) * 256);
  assert.equal(frame.origin.y, Math.floor(camera.focus.y / 256) * 256);
  assert.equal(local[0], point.x - frame.origin.x);
  assert.equal(local[1], point.y - frame.origin.y);
  close(local[2], (point.heightM - frame.origin.z) * camera.exaggeration);
  assert.ok(Math.abs(local[0]) < 256 && Math.abs(local[1]) < 256);
  const deck = frame.project(point);
  const ref = atlasProject(
    {
      frame: { x: camera.focus.x - 2, y: camera.focus.y - 1.5, width: 4, height: 3 },
      focusM: camera.focusHeightM,
      tilt: camera.tilt,
      rotation: camera.rotation,
      exaggeration: camera.exaggeration,
      projection: 'perspective',
    },
    point,
    point.heightM,
  );
  close(deck.x, ref.x * 800, 0.02);
  close(deck.y, ref.y * 600, 0.02);
});

test('ray unprojects the projected point back to its canonical height plane', () => {
  const camera = fixture({ focus: { x: -8e11, y: 4e11 }, metersPerPixel: 0.03, tilt: 68 });
  const frame = atlasMetricFrame(camera, 1024, 768);
  const point = {
    x: camera.focus.x + 2.75,
    y: camera.focus.y - 1.125,
    heightM: camera.focusHeightM + 0.8,
  };
  const pixel = frame.project(point);
  assert.equal(pixel.visible, true);
  const ray = frame.ray(pixel);
  assert.ok(ray);
  const dz = ray[1][2] - ray[0][2];
  assert.notEqual(dz, 0);
  const t = (point.heightM - ray[0][2]) / dz;
  assert.ok(t >= 0 && t <= 1);
  close(ray[0][0] + (ray[1][0] - ray[0][0]) * t, point.x, 0.002);
  close(ray[0][1] + (ray[1][1] - ray[0][1]) * t, point.y, 0.002);
  close(ray[0][2] + dz * t, point.heightM, 0.002);
  assert.equal(frame.ray({ x: -1, y: 2 }), null);
});

test('Deck public View returns the exact viewport for matching dimensions', () => {
  const frame = atlasMetricFrame(fixture(), 720, 540);
  const view = new AtlasMetricView({ frame, id: 'atlas-metric' });
  assert.equal(view.makeViewport({ width: 0, height: 0 }), null);
  assert.equal(view.makeViewport({ width: 720, height: 540 }), frame.viewport);
  const resized = view.makeViewport({ width: 360, height: 270 });
  assert.equal(resized.width, 360);
  assert.equal(resized.height, 270);
});

test('zoom and pan preserve the world point under their screen anchor', () => {
  const camera = fixture(),
    width = 900,
    height = 650,
    pixel = { x: 220, y: 410 },
    target = { x: 700, y: 160 };
  const oldPose = {
    frame: {
      x: camera.focus.x - (width * camera.metersPerPixel) / 2,
      y: camera.focus.y - (height * camera.metersPerPixel) / 2,
      width: width * camera.metersPerPixel,
      height: height * camera.metersPerPixel,
    },
    focusM: camera.focusHeightM,
    tilt: camera.tilt,
    rotation: camera.rotation,
    exaggeration: camera.exaggeration,
    projection: 'perspective',
  };
  const before = atlasPlanePoint(
    oldPose,
    { x: pixel.x / width, y: pixel.y / height },
    camera.focusHeightM,
  );
  const zoomed = atlasMetricZoomAt(camera, width, height, pixel, 1.7);
  assert.equal(zoomed.metersPerPixel, camera.metersPerPixel * 1.7);
  const zoomPose = {
    ...oldPose,
    frame: {
      ...oldPose.frame,
      x: zoomed.focus.x - (width * zoomed.metersPerPixel) / 2,
      y: zoomed.focus.y - (height * zoomed.metersPerPixel) / 2,
      width: width * zoomed.metersPerPixel,
      height: height * zoomed.metersPerPixel,
    },
  };
  const zoomAnchor = atlasPlanePoint(
    zoomPose,
    { x: pixel.x / width, y: pixel.y / height },
    camera.focusHeightM,
  );
  close(zoomAnchor.x, before.x, 1e-8);
  close(zoomAnchor.y, before.y, 1e-8);

  const pan = atlasMetricPanAt(camera, width, height, pixel, target);
  const panPose = {
    ...oldPose,
    frame: {
      ...oldPose.frame,
      x: pan.focus.x - (width * camera.metersPerPixel) / 2,
      y: pan.focus.y - (height * camera.metersPerPixel) / 2,
    },
  };
  const movedAnchor = atlasPlanePoint(
    panPose,
    { x: target.x / width, y: target.y / height },
    camera.focusHeightM,
  );
  close(movedAnchor.x, before.x, 1e-8);
  close(movedAnchor.y, before.y, 1e-8);
});

test('invalid cameras, non-finite points and degenerate clip ranges fail closed', () => {
  assert.throws(() => atlasMetricFrame(fixture({ metersPerPixel: 0 }), 300, 200));
  assert.throws(() => atlasMetricFrame(fixture({ tilt: 76 }), 300, 200));
  const frame = atlasMetricFrame(fixture(), 300, 200);
  assert.throws(() => frame.toLocal({ x: NaN, y: 0, heightM: 0 }));
  assert.throws(() =>
    atlasMetricFrame(fixture(), 300, 200, { x: 0, y: 0, z: 0 }, { near: 10, far: 1 }),
  );
});

test('sky gestures at 75 degrees retain a finite focus without a plane intersection', () => {
  const camera = fixture({ tilt: 75 }),
    sky = { x: 400, y: 0 };
  const zoom = atlasMetricZoomAt(camera, 800, 600, sky, 0.5);
  assert.deepEqual(zoom.focus, camera.focus);
  assert.equal(zoom.metersPerPixel, camera.metersPerPixel * 0.5);
  assert.deepEqual(atlasMetricPanAt(camera, 800, 600, sky, { x: 450, y: 10 }), camera);
});

test('output crops retain the full camera projection and the same world ray at tile seams', () => {
  for (const tilt of [0, 55, 75]) {
    const camera = fixture({ tilt }),
      full = atlasMetricFrame(camera, 3072, 2048);
    for (const [x, y, w, h] of [
      [0, 0, 1024, 1024],
      [1024, 0, 1024, 1024],
      [2048, 1024, 1024, 1024],
    ]) {
      const crop = atlasMetricFrame(camera, w, h, full.origin, {
        crop: { width: 3072, height: 2048, x, y },
      });
      const point = { ...camera.focus, heightM: camera.focusHeightM },
        a = full.project(point),
        b = crop.project(point);
      close(b.x, a.x - x);
      close(b.y, a.y - y);
      close(b.depthM, a.depthM);
      const ray = crop.ray({ x: w / 2, y: h / 2 }),
        reference = full.ray({ x: x + w / 2, y: y + h / 2 });
      for (let end = 0; end < 2; end++)
        for (let axis = 0; axis < 3; axis++) close(ray[end][axis], reference[end][axis], 1e-4);
    }
  }
});
