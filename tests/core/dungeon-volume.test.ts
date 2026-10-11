import assert from "node:assert/strict";
import test from "node:test";
import { AtlasHistory } from "../../src/features/atlas/atlas-history";
import { DungeonAtlasSource, dungeonDocumentChange } from "../../src/features/dungeon/atlas-source";
import {
  paintWalkableColumn,
  projectVolumeSlice,
  setHorizontalFace,
  setVolumeHeight,
} from "../../src/features/dungeon/volume";
import { newDocument, parseDocument, serializeDocument } from "../../src/model";
import { Session } from "../../src/session";

test("ordinary floor paint creates a persistent ten-foot Volume shell", () => {
  const before = newDocument("Volume", 12, 12),
    painted = paintWalkableColumn(before, "volume-a", {
      x: 3, y: 4, bottomStep: 0,
    }),
    reopened = parseDocument(serializeDocument(painted)),
    volume = reopened.volumes?.[0];
  assert.equal(volume?.id, "volume-a");
  assert.deepEqual(volume?.cells.map((cell) => ({
    z: cell.z, floor: cell.floor, ceiling: cell.ceiling,
  })), [
    { z: 0, floor: true, ceiling: false },
    { z: 1, floor: false, ceiling: true },
  ]);
  assert.ok(volume?.cells.every((cell) => cell.walls.length === 4));
  assert.equal(new Session(reopened).document().volumes?.[0]?.id, "volume-a");
});

test("height, stacked slices and an opened intermediate boundary survive history", () => {
  const initial = newDocument("Volume", 12, 12),
    lower = setVolumeHeight(paintWalkableColumn(initial, "lower", {
      x: 2, y: 2, bottomStep: 0,
    }), "lower", 3),
    stacked = paintWalkableColumn(lower, "upper", {
      x: 2, y: 2, bottomStep: 3,
    }),
    opened = setHorizontalFace(stacked, {
      volumeId: "lower", x: 2, y: 2, z: 2, face: "ceiling", present: false,
    }),
    active = projectVolumeSlice(opened, 2);
  assert.deepEqual(active.map(({ cell, relation, volumeId }) =>
    [volumeId, cell.z, relation]), [
    ["lower", 1, "below"], ["lower", 2, "active"],
    ["lower", 3, "active"], ["lower", 4, "above"],
  ]);

  const history = new AtlasHistory(), source = new DungeonAtlasSource(initial, history);
  assert.equal(history.execute({ label: "Dungeon-Volume zeichnen", changes: [
    dungeonDocumentChange(initial, opened),
  ] }), true);
  assert.equal(source.read().document.volumes?.length, 1);
  assert.equal(history.undo(), true);
  assert.equal(source.read().document.volumes, undefined);
  assert.equal(history.redo(), true);
  const reopened = parseDocument(source.read().documentBytes);
  assert.equal(reopened.volumes?.[0]?.cells.length, 5);
  assert.equal(reopened.volumes?.[0]?.cells[2]?.ceiling, false);
  assert.equal(reopened.volumes?.[0]?.cells[3]?.floor, false);
});

test("invalid grids and duplicate Volume identity fail before persistence", () => {
  const input = newDocument("Volume", 2, 2);
  assert.throws(() => paintWalkableColumn(input, "bad", {
    x: 0.5, y: 0, bottomStep: 0,
  }), /5-Fuß-Raster/);
  const painted = paintWalkableColumn(input, "one", {
    x: 0, y: 0, bottomStep: 0, heightSteps: 1,
  });
  assert.throws(() => paintWalkableColumn(painted, "one", {
    x: 1, y: 1, bottomStep: 0,
  }), /Kennung/);
  const unbounded = paintWalkableColumn(input, "outside", {
    x: -2, y: 4, bottomStep: 0,
  });
  assert.equal(unbounded.volumes?.[0]?.cells[0]?.x, -2);
  assert.throws(() => paintWalkableColumn(input, "   ", {
    x: 0, y: 0, bottomStep: 0,
  }), /Volume/);
});

test("height changes retain independently edited faces", () => {
  const input = paintWalkableColumn(newDocument("Volume", 2, 2), "one", {
      x: 0, y: 0, bottomStep: 0,
    }),
    noFloor = setHorizontalFace(input, {
      volumeId: "one", x: 0, y: 0, z: 0, face: "floor", present: false,
    }),
    custom = { ...noFloor, volumes: noFloor.volumes?.map((volume) => ({
      ...volume, cells: volume.cells.map((cell) =>
        cell.z === 0 ? { ...cell, walls: [] } : cell),
    })) },
    taller = setVolumeHeight(parseDocument(serializeDocument(custom)), "one", 3);
  assert.equal(taller.volumes?.[0]?.cells[0]?.floor, false);
  assert.deepEqual(taller.volumes?.[0]?.cells[0]?.walls, []);
  assert.equal(taller.volumes?.[0]?.cells[1]?.ceiling, false);
  assert.equal(taller.volumes?.[0]?.cells[2]?.ceiling, true);
  const shorter = setVolumeHeight(taller, "one", 2);
  assert.equal(shorter.volumes?.[0]?.cells[1]?.ceiling, true);
});

test("closing an opened intermediate floor splits geometric identity again", () => {
  const lower = setVolumeHeight(paintWalkableColumn(
      newDocument("Split", 2, 2), "lower", { x: 0, y: 0, bottomStep: 0 },
    ), "lower", 3),
    stacked = paintWalkableColumn(lower, "upper", { x: 0, y: 0, bottomStep: 3 }),
    merged = setHorizontalFace(stacked, {
      volumeId: "lower", x: 0, y: 0, z: 2, face: "ceiling", present: false,
    }),
    split = setHorizontalFace(merged, {
      volumeId: "lower", x: 0, y: 0, z: 2, face: "ceiling", present: true,
    });
  assert.equal(merged.volumes?.length, 1);
  assert.equal(split.volumes?.length, 2);
  assert.equal(split.volumes?.[0]?.id, "lower");
  assert.notEqual(split.volumes?.[1]?.id, "upper");
  assert.doesNotThrow(() => parseDocument(serializeDocument(split)));
});

test("split identity skips every reserved document ID deterministically", () => {
  const initial = newDocument("Split collision", 2, 2),
    lower = setVolumeHeight(paintWalkableColumn(initial, "lower", {
      x: 0, y: 0, bottomStep: 0,
    }), "lower", 3),
    stacked = paintWalkableColumn(lower, "upper", {
      x: 0, y: 0, bottomStep: 3,
    }),
    merged = setHorizontalFace(stacked, {
      volumeId: "lower", x: 0, y: 0, z: 2, face: "ceiling", present: false,
    }),
    colliding = {
      ...merged,
      floors: merged.floors.map((floor, index) => index === 0
        ? { ...floor, id: "lower:split:3:0:0" } : floor),
    },
    split = setHorizontalFace(colliding, {
      volumeId: "lower", x: 0, y: 0, z: 2, face: "ceiling", present: true,
    });
  assert.deepEqual(split.volumes?.map(({ id }) => id), [
    "lower", "lower:split:3:0:0:2",
  ]);
  assert.doesNotThrow(() => parseDocument(serializeDocument(split)));
});

test("overlapping and disconnected persisted Volumes fail closed", () => {
  const input = paintWalkableColumn(newDocument("Volume", 3, 3), "one", {
    x: 0, y: 0, bottomStep: 0,
  });
  assert.throws(() => parseDocument(serializeDocument({ ...input, volumes: [
    ...input.volumes!, { id: "two", cells: input.volumes![0]!.cells },
  ] })), /überlappen/);
  assert.throws(() => parseDocument(serializeDocument({ ...input, volumes: [{
    id: "one", cells: [input.volumes![0]!.cells[0]!, {
      ...input.volumes![0]!.cells[1]!, x: 2, y: 2,
    }],
  }] })), /zusammenhängend/);
});
