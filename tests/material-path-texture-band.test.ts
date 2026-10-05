import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPathTextureBand } from "../src/features/material/path-texture-band";

const close = (actual: number, expected: number) =>
  assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);

test("DD-021.15 horizontal strip advances U by physical path length", () => {
  const band = buildPathTextureBand({
    points: [
      { x: 0, y: 0 },
      { x: 15, y: 0 },
    ],
    width: 2,
    textureWidth: 100,
    textureHeight: 20,
  });
  assert.deepEqual(band.positions, [0, 1, 0, -1, 15, 1, 15, -1]);
  assert.deepEqual(band.uvs, [0, 0, 0, 1, 1.5, 0, 1.5, 1]);
  assert.deepEqual(band.indices, [0, 1, 2, 1, 3, 2]);
  assert.equal(band.repeatLength, 10);
  assert.equal(band.pathLength, 15);
  assert.equal(band.closurePhase, null);
});

test("DD-021.15 diagonal strip rotates its cross-section perpendicular to travel", () => {
  const band = buildPathTextureBand({
    points: [
      { x: 0, y: 0 },
      { x: 3, y: 4 },
    ],
    width: 2,
    textureWidth: 100,
    textureHeight: 20,
  });
  for (const [index, expected] of [
    -0.8, 0.6, 0.8, -0.6, 2.2, 4.6, 3.8, 3.4,
  ].entries())
    close(band.positions[index]!, expected);
  close(band.uvs[4]!, 0.5);
  close(band.uvs[6]!, 0.5);
  const tangent = { x: 3 / 5, y: 4 / 5 };
  const crossSection = {
    x: band.positions[0]! - band.positions[2]!,
    y: band.positions[1]! - band.positions[3]!,
  };
  close(tangent.x * crossSection.x + tangent.y * crossSection.y, 0);
});

test("DD-021.15 bend shares mitered edge vertices and one UV distance", () => {
  const band = buildPathTextureBand({
    points: [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 4 },
    ],
    width: 2,
    textureWidth: 100,
    textureHeight: 20,
  });
  assert.deepEqual(band.positions.slice(4, 8), [3, 1, 5, -1]);
  assert.deepEqual(band.indices, [0, 1, 2, 1, 3, 2, 2, 3, 4, 3, 5, 4]);
  close(band.uvs[4]!, 0.4);
  close(band.uvs[6]!, 0.4);
  close(band.uvs[8]!, 0.8);
  assert.equal(band.pathLength, 8);
});

test("DD-021.15 repeat seam keeps U unwrapped across an image boundary", () => {
  const band = buildPathTextureBand({
    points: [
      { x: 0, y: 0 },
      { x: 9, y: 0 },
      { x: 11, y: 0 },
    ],
    width: 1,
    textureWidth: 10,
    textureHeight: 1,
  });
  close(band.uvs[4]!, 0.9);
  close(band.uvs[8]!, 1.1);
  assert.deepEqual(band.indices.slice(6), [2, 3, 4, 3, 5, 4]);
});

test("DD-021.18 closed seam duplicates position but keeps cumulative U", () => {
  const points = [
    { x: 0, y: 0 },
    { x: 2, y: 0 },
    { x: 2, y: 2 },
    { x: 0, y: 2 },
    { x: 0, y: 0 },
  ];
  const aligned = buildPathTextureBand({
    points,
    width: 1,
    textureWidth: 4,
    textureHeight: 1,
    closed: true,
  });
  assert.equal(aligned.pathLength, 8);
  assert.equal(aligned.closurePhase, 0);
  assert.deepEqual(aligned.positions.slice(0, 4), aligned.positions.slice(-4));
  assert.deepEqual(aligned.uvs.slice(0, 4), [0, 0, 0, 1]);
  assert.deepEqual(aligned.uvs.slice(-4), [2, 0, 2, 1]);
  assert.equal(aligned.indices.length, 24);

  const unaligned = buildPathTextureBand({
    points,
    width: 1,
    textureWidth: 4,
    textureHeight: 1,
    repeatLength: 3,
    closed: true,
  });
  close(unaligned.closurePhase!, 2 / 3);
});

test("DD-021.15 invalid geometry and direct reversals are rejected", () => {
  const standard = { width: 1, textureWidth: 10, textureHeight: 1 };
  assert.throws(
    () =>
      buildPathTextureBand({
        ...standard,
        points: [
          { x: 0, y: 0 },
          { x: 0, y: 0 },
        ],
      }),
    RangeError,
  );
  assert.throws(
    () =>
      buildPathTextureBand({
        ...standard,
        points: [
          { x: 0, y: 0 },
          { x: 2, y: 0 },
          { x: 0, y: 0 },
        ],
      }),
    RangeError,
  );
  assert.throws(
    () =>
      buildPathTextureBand({
        ...standard,
        width: 0,
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
        ],
      }),
    RangeError,
  );
});
