import assert from "node:assert/strict";
import test from "node:test";
import {
  composeVolumeSlice,
  dungeonViewportBounds,
} from "../../src/features/dungeon/volume-projection";
import {
  paintWalkableColumn,
  setHorizontalFace,
  setVolumeHeight,
} from "../../src/features/dungeon/volume";
import { newDocument } from "../../src/model";

test("Volume XY composition prefers active facts and preserves deterministic faces", () => {
  const base = newDocument("Projection", 4, 3),
    below = paintWalkableColumn(base, "below", {
      x: 1, y: 1, bottomStep: -1, heightSteps: 1,
    }),
    active = paintWalkableColumn(below, "active", {
      x: 1, y: 1, bottomStep: 0, heightSteps: 2,
    }),
    above = paintWalkableColumn(active, "above", {
      x: 1, y: 1, bottomStep: 2, heightSteps: 1,
    }),
    projection = composeVolumeSlice(above, 0);
  assert.equal(projection.length, 1);
  assert.equal(projection[0]?.relation, "active");
  assert.deepEqual(projection[0]?.faces.map(({ volumeId, cell }) => [
    volumeId, cell.z, cell.floor, cell.ceiling,
  ]), [
    ["active", 0, true, false],
    ["active", 1, false, true],
  ]);
});

test("Volume XY composition exposes independently authored horizontal and wall faces", () => {
  const initial = setVolumeHeight(paintWalkableColumn(
      newDocument("Faces", 2, 2), "one",
      { x: 0, y: 0, bottomStep: 0 },
    ), "one", 3),
    opened = setHorizontalFace(initial, {
      volumeId: "one", x: 0, y: 0, z: 1, face: "ceiling", present: false,
    }),
    changed = {
      ...opened,
      volumes: opened.volumes?.map((volume) => ({
        ...volume,
        cells: volume.cells.map((cell) => cell.z === 1
          ? { ...cell, walls: ["north", "west"] as const }
          : cell),
      })),
    },
    faces = composeVolumeSlice(changed, 0)[0]?.faces;
  assert.deepEqual(faces?.map(({ cell }) => ({
    z: cell.z, floor: cell.floor, ceiling: cell.ceiling, walls: cell.walls,
  })), [
    { z: 0, floor: true, ceiling: false,
      walls: ["north", "east", "south", "west"] },
    { z: 1, floor: false, ceiling: false, walls: ["north", "west"] },
  ]);
});

test("Volume viewport bounds include negative and beyond-map sparse cells", () => {
  const base = newDocument("Bounds", 4, 3),
    negative = paintWalkableColumn(base, "negative", {
      x: -3, y: -2, bottomStep: 0,
    }),
    outside = paintWalkableColumn(negative, "outside", {
      x: 7, y: 5, bottomStep: 0,
    });
  assert.deepEqual(dungeonViewportBounds(outside), {
    x: -3, y: -2, width: 11, height: 8,
  });
});
