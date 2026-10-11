import assert from "node:assert/strict";
import test from "node:test";
import { AtlasHistory } from "../../src/features/atlas/atlas-history";
import { DungeonAtlasSource, dungeonDocumentChange } from "../../src/features/dungeon/atlas-source";
import {
  eraseVolumeGestureCommand,
  paintWalkableColumn,
  paintWalkableColumnCommand,
  paintWalkableColumns,
  paintVolumeGestureCommand,
  projectVolumeSlice,
  rasterizeWalkableArea,
  rasterizeVolumeStroke,
  setHorizontalFace,
  setHorizontalFaceCommand,
  setWallFace,
  setWallFaceCommand,
  setVolumeHeight,
  setVolumeHeightCommand,
  volumeColumnAt,
  volumeColumnsAt,
} from "../../src/features/dungeon/volume";
import { newDocument, parseDocument, serializeDocument } from "../../src/model";
import { Session } from "../../src/session";
import { MapRepository } from "../../src/persistence";
import { MemoryStore } from "./fixtures";

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

test("visible Volume paint command supports Undo, Redo and exact Save/Reopen", async () => {
  const session = new Session(newDocument("Volume gesture", 12, 12)),
    events: boolean[] = [];
  session.subscribe((event) => events.push(event.volumes === true));
  session.execute(paintWalkableColumnCommand(session.document(), "volume-ui", {
    x: 4, y: 5, bottomStep: -1, heightSteps: 3,
  }));
  assert.equal(session.volumes?.[0]?.id, "volume-ui");
  assert.equal(session.canUndo, true);
  session.undo();
  assert.equal(session.volumes, undefined);
  session.redo();
  const redoneVolumes = session.document().volumes;
  assert.equal(redoneVolumes?.[0]?.cells.length, 3);
  assert.deepEqual(events, [true, true, true]);
  const store = new MemoryStore(), path = "QA/Volume-Gesture.dungeon",
    repository = new MapRepository(store, path);
  await repository.save(session);
  const reopened = await new MapRepository(store, path).open();
  assert.deepEqual(reopened.volumes, redoneVolumes);
  assert.equal(reopened.dirty, false);
  assert.deepEqual(
    parseDocument(serializeDocument(reopened.snapshot().document)).volumes,
    redoneVolumes,
  );
});

test("pointer stroke adapter commits one connected area across a live slice change", () => {
  const document = newDocument("Volume stroke", 4, 4),
    samples = [
      { x: 0, y: 0, bottomStep: 0, heightSteps: 1 },
      { x: 2, y: 0, bottomStep: 0, heightSteps: 1 },
      { x: 2, y: 0, bottomStep: 2, heightSteps: 1 },
    ],
    columns = rasterizeVolumeStroke(samples),
    session = new Session(document);
  assert.deepEqual(columns, [
    { x: 0, y: 0, bottomStep: 0, heightSteps: 1 },
    { x: 1, y: 0, bottomStep: 0, heightSteps: 1 },
    { x: 2, y: 0, bottomStep: 0, heightSteps: 1 },
    { x: 2, y: 0, bottomStep: 1, heightSteps: 1 },
    { x: 2, y: 0, bottomStep: 2, heightSteps: 1 },
  ]);
  session.execute(paintVolumeGestureCommand(
    session.document(), "volume-stroke", samples,
  )!);
  const volume = session.volumes?.[0];
  assert.equal(volume?.id, "volume-stroke");
  assert.deepEqual(volume?.cells.map(({ x, y, z }) => [x, y, z]), [
    [0, 0, 0], [1, 0, 0], [2, 0, 0], [2, 0, 1], [2, 0, 2],
  ]);
  assert.deepEqual(volume?.cells[1]?.walls, ["north", "south"]);
  assert.equal(volume?.cells[2]?.ceiling, false);
  assert.equal(volume?.cells[3]?.floor, false);
  assert.deepEqual(projectVolumeSlice(session.document(), 1).map((item) => [
    item.cell.x, item.cell.z, item.relation,
  ]), [
    [0, 0, "below"], [1, 0, "below"], [2, 0, "below"],
    [2, 1, "active"], [2, 2, "active"],
  ]);
  assert.deepEqual(volumeColumnAt(session.document(), 2, 0, 1), {
    volumeId: "volume-stroke", x: 2, y: 0,
  });
  session.undo();
  assert.equal(session.volumes, undefined);
  assert.equal(session.canUndo, false);
  session.redo();
  assert.deepEqual(session.volumes, [volume]);
});

test("diagonal pointer samples rasterize to a face-connected Volume", () => {
  const columns = rasterizeVolumeStroke([
      { x: 0, y: 0, bottomStep: 0 },
      { x: 2, y: 1, bottomStep: 0 },
    ]),
    document = paintWalkableColumns(
      newDocument("Diagonal", 4, 4), "diagonal", columns,
    );
  assert.deepEqual(columns.map(({ x, y }) => [x, y]), [
    [0, 0], [1, 0], [1, 1], [2, 1],
  ]);
  assert.equal(document.volumes?.length, 1);
  assert.doesNotThrow(() => parseDocument(serializeDocument(document)));
});

test("ordinary floor footprints rasterize to matching walkable columns", () => {
  const columns = rasterizeWalkableArea({
    polygons: [{ outer: [
      { x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 2 }, { x: 0, y: 2 },
    ], holes: [[
      { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 1 }, { x: 1, y: 1 },
    ]] }],
    bottomStep: 4,
    heightSteps: 3,
  });
  assert.deepEqual(columns.map(({ x, y, bottomStep, heightSteps }) =>
    [x, y, bottomStep, heightSteps]), [
    [0, 0, 4, 3], [2, 0, 4, 3],
    [0, 1, 4, 3], [1, 1, 4, 3], [2, 1, 4, 3],
  ]);
});

test("continued and overlapping brush strokes extend one stable Volume identity", () => {
  const base = newDocument("Continue", 6, 4),
    first = paintWalkableColumns(base, "first", [
      { x: 0, y: 0, bottomStep: 0 },
      { x: 1, y: 0, bottomStep: 0 },
    ]),
    continued = paintWalkableColumns(first, "second", [
      { x: 1, y: 0, bottomStep: 0 },
      { x: 2, y: 0, bottomStep: 0 },
      { x: 3, y: 0, bottomStep: 0 },
    ]),
    cells = continued.volumes?.[0]?.cells.filter(({ z }) => z === 0);
  assert.equal(continued.volumes?.length, 1);
  assert.equal(continued.volumes?.[0]?.id, "first");
  assert.deepEqual(cells?.map(({ x }) => x), [0, 1, 2, 3]);
  assert.equal(cells?.[1]?.walls.includes("east"), false);
  assert.equal(cells?.[2]?.walls.includes("west"), false);
});

test("one bridge stroke transitively merges two existing Volume identities", () => {
  const left = paintWalkableColumn(newDocument("Bridge", 4, 3), "left", {
      x: 0, y: 0, bottomStep: 0, heightSteps: 1,
    }),
    separated = paintWalkableColumn(left, "right", {
      x: 2, y: 0, bottomStep: 0, heightSteps: 1,
    }),
    bridged = paintWalkableColumns(separated, "bridge", [
      { x: 1, y: 0, bottomStep: 0, heightSteps: 1 },
    ]);
  assert.equal(bridged.volumes?.length, 1);
  assert.equal(bridged.volumes?.[0]?.id, "left");
  assert.deepEqual(bridged.volumes?.[0]?.cells.map(({ x }) => x), [0, 1, 2]);
});

test("an overlapping vertical continuation keeps the existing Volume identity", () => {
  const base = paintWalkableColumn(newDocument("Vertical", 3, 3), "base", {
      x: 0, y: 0, bottomStep: 0, heightSteps: 2,
    }),
    continued = paintWalkableColumns(base, "upper-stroke", [
      { x: 0, y: 0, bottomStep: 1, heightSteps: 2 },
    ]);
  assert.equal(continued.volumes?.length, 1);
  assert.equal(continued.volumes?.[0]?.id, "base");
  assert.deepEqual(continued.volumes?.[0]?.cells.map(({ z, floor, ceiling }) =>
    ({ z, floor, ceiling })), [
    { z: 0, floor: true, ceiling: false },
    { z: 1, floor: false, ceiling: false },
    { z: 2, floor: false, ceiling: true },
  ]);
});

test("erase gesture shortens geometry, closes exposed faces and remains undoable", () => {
  const painted = paintWalkableColumns(newDocument("Erase", 5, 3), "area", [
      { x: 0, y: 0, bottomStep: 0, heightSteps: 1 },
      { x: 1, y: 0, bottomStep: 0, heightSteps: 1 },
      { x: 2, y: 0, bottomStep: 0, heightSteps: 1 },
    ]),
    session = new Session(painted);
  session.execute(eraseVolumeGestureCommand(session.document(), [
    { x: 1, y: 0, bottomStep: 0, heightSteps: 1 },
  ])!);
  assert.equal(session.volumes?.length, 2);
  assert.ok(session.volumes?.flatMap(({ cells }) => cells)
    .every((cell) => cell.walls.includes(cell.x === 0 ? "east" : "west")));
  session.undo();
  assert.deepEqual(session.volumes, painted.volumes);
});

test("height and face adapters remain atomic commands and empty gestures cancel cleanly", () => {
  const session = new Session(newDocument("Volume edit", 4, 4));
  assert.throws(() => paintVolumeGestureCommand(
    session.document(), "cancelled", [],
  ), /mindestens eine/);
  assert.equal(session.revision, 0);
  session.execute(paintWalkableColumnCommand(session.document(), "edited", {
    x: 1, y: 1, bottomStep: 0,
  }));
  assert.equal(eraseVolumeGestureCommand(session.document(), [
    { x: 3, y: 3, bottomStep: 0 },
  ]), undefined);
  assert.equal(paintVolumeGestureCommand(session.document(), "overpaint", [
    { x: 1, y: 1, bottomStep: 0 },
  ]), undefined);
  session.execute(setVolumeHeightCommand(session.document(), "edited", 3));
  assert.equal(session.volumes?.[0]?.cells.length, 3);
  session.execute(setHorizontalFaceCommand(session.document(), {
    volumeId: "edited", x: 1, y: 1, z: 1,
    face: "ceiling", present: true,
  }));
  assert.equal(session.volumes?.length, 2);
  session.undo();
  assert.equal(session.volumes?.length, 1);
  assert.equal(session.volumes?.[0]?.cells.length, 3);
  session.undo();
  assert.equal(session.volumes?.[0]?.cells.length, 2);
  session.redo();
  session.redo();
  assert.equal(session.volumes?.length, 2);
});

test("vertical wall faces edit both sides and split or merge stable geometry", () => {
  const joined = paintWalkableColumns(newDocument("Walls", 4, 4), "one", [
      { x: 0, y: 0, bottomStep: 0, heightSteps: 1 },
      { x: 1, y: 0, bottomStep: 0, heightSteps: 1 },
    ]),
    split = setWallFace(joined, {
      volumeId: "one", x: 0, y: 0, z: 0, wall: "east", present: true,
    });
  assert.equal(split.volumes?.length, 2);
  assert.ok(split.volumes?.flatMap(({ cells }) => cells)
    .every((cell) => cell.walls.includes(cell.x === 0 ? "east" : "west")));
  const left = split.volumes?.find(({ cells }) => cells.some(({ x }) => x === 0));
  assert.ok(left);
  const session = new Session(split);
  session.execute(setWallFaceCommand(session.document(), {
    volumeId: left.id, x: 0, y: 0, z: 0, wall: "east", present: false,
  }));
  assert.equal(session.volumes?.length, 1);
  assert.ok(session.volumes?.[0]?.cells.every((cell) =>
    !cell.walls.includes(cell.x === 0 ? "east" : "west")));
  session.undo();
  assert.equal(session.volumes?.length, 2);
});

test("paint next to an authored closed wall keeps both boundary sides closed", () => {
  const left = setWallFace(paintWalkableColumn(
      newDocument("Authored wall", 3, 3), "left",
      { x: 0, y: 0, bottomStep: 0, heightSteps: 1 },
    ), {
      volumeId: "left", x: 0, y: 0, z: 0, wall: "east", present: true,
    }),
    next = paintWalkableColumns(left, "right", [
      { x: 1, y: 0, bottomStep: 0, heightSteps: 1 },
    ]),
    cells = next.volumes?.flatMap(({ cells }) => cells);
  assert.equal(next.volumes?.length, 2);
  assert.equal(cells?.find(({ x }) => x === 0)?.walls.includes("east"), true);
  assert.equal(cells?.find(({ x }) => x === 1)?.walls.includes("west"), true);
});

test("stacked candidates can be cycled without losing deterministic hit order", () => {
  const lower = paintWalkableColumn(newDocument("Stacked", 2, 2), "lower", {
      x: 0, y: 0, bottomStep: 0, heightSteps: 2,
    }),
    stacked = paintWalkableColumn(lower, "upper", {
      x: 0, y: 0, bottomStep: 2, heightSteps: 2,
    });
  assert.deepEqual(volumeColumnsAt(stacked, 0, 0, 1).map(({ volumeId }) => volumeId),
    ["lower", "upper"]);
});

test("Volume commands reject stale before-state and document-wide ID collisions atomically", () => {
  const session = new Session(newDocument("Volume CAS", 4, 4)),
    first = paintWalkableColumnCommand(session.document(), "volume-a", {
      x: 0, y: 0, bottomStep: 0,
    });
  session.execute(first);
  const revision = session.revision, current = session.volumes;
  assert.throws(() => session.execute(first), /Veraltete Dungeon-Volumes/);
  assert.equal(session.revision, revision);
  const floorId = session.floors.keys().next().value!;
  assert.throws(() => session.execute({
    label: "Kollidierendes Volume",
    volumes: {
      before: current,
      after: [...current!, {
        id: floorId,
        cells: [{ x: 1, y: 1, z: 0, floor: true, ceiling: true,
          walls: ["north", "east", "south", "west"] }],
      }],
    },
  }), /Dungeon-Volume/);
  assert.equal(session.revision, revision);
  assert.equal(session.volumes, current);
  const content = session.content;
  assert.throws(() => session.execute({
    label: "Kollidierende Inhaltskennung",
    content: {
      before: content,
      after: { ...content, definitions: [{
        id: "volume-a", name: "Kollision", kind: "feature", xp: 0, lootValue: 0,
      }] },
    },
  }), /Dungeon-Volume/);
  assert.equal(session.revision, revision);
  assert.equal(session.content, content);
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

test("V3 remains byte-compatible and rejects Volume authoring or injected payload", () => {
  const legacy = newDocument("Legacy", 3, 3, undefined, undefined, 3),
    bytes = serializeDocument(legacy);
  assert.equal(parseDocument(bytes).version, 3);
  assert.equal(serializeDocument(parseDocument(bytes)), bytes);
  assert.throws(() => paintWalkableColumn(legacy, "volume-v3", {
    x: 0, y: 0, bottomStep: 0,
  }), /V4/);
  const volume = paintWalkableColumn(
    newDocument("V4", 3, 3), "volume-v4",
    { x: 0, y: 0, bottomStep: 0 },
  ).volumes;
  assert.throws(() => parseDocument(JSON.stringify({ ...legacy, volumes: volume })),
    /V4/);
  const legacySession = new Session(legacy);
  assert.throws(() => legacySession.execute({
    label: "Ungültiges V3-Volume",
    volumes: { before: undefined, after: volume },
  }), /V4/);
  assert.equal(legacySession.revision, 0);
  assert.equal(legacySession.volumes, undefined);
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
        cell.z === 0 ? { ...cell, walls: [],
          authoredFaces: [...(cell.authoredFaces ?? []),
            "north" as const, "east" as const, "south" as const, "west" as const] }
          : cell),
    })) },
    taller = setVolumeHeight(parseDocument(serializeDocument(custom)), "one", 3);
  assert.equal(taller.volumes?.[0]?.cells[0]?.floor, false);
  assert.deepEqual(taller.volumes?.[0]?.cells[0]?.walls, []);
  assert.equal(taller.volumes?.[0]?.cells[1]?.ceiling, false);
  assert.equal(taller.volumes?.[0]?.cells[2]?.ceiling, true);
  const shorter = setVolumeHeight(taller, "one", 2);
  assert.equal(shorter.volumes?.[0]?.cells[1]?.ceiling, true);
});

test("height changes keep a painted area's new layers internally open", () => {
  const input = paintWalkableColumns(
      newDocument("Tall area", 4, 4), "area",
      [
        { x: 0, y: 0, bottomStep: 0, heightSteps: 2 },
        { x: 1, y: 0, bottomStep: 0, heightSteps: 2 },
      ],
    ),
    taller = setVolumeHeight(input, "area", 3),
    top = taller.volumes?.[0]?.cells.filter(({ z }) => z === 2);
  assert.equal(top?.length, 2);
  assert.equal(top?.[0]?.walls.includes("east"), false);
  assert.equal(top?.[1]?.walls.includes("west"), false);
});

test("height changes repair automatic walls across uneven columns", () => {
  const painted = paintWalkableColumns(
      newDocument("Uneven area", 4, 4), "area",
      [{ x: 0, y: 0, bottomStep: 0 }, { x: 1, y: 0, bottomStep: 0 }],
    ),
    uneven = { ...painted, volumes: painted.volumes?.map((volume) => ({
      ...volume,
      cells: volume.cells.filter(({ x, z }) => x === 1 || z === 0),
    })) },
    taller = setVolumeHeight(parseDocument(serializeDocument(uneven)), "area", 3),
    left = taller.volumes?.[0]?.cells.find(({ x, z }) => x === 0 && z === 1),
    right = taller.volumes?.[0]?.cells.find(({ x, z }) => x === 1 && z === 1);
  assert.equal(left?.walls.includes("east"), false);
  assert.equal(right?.walls.includes("west"), false);
  assert.doesNotThrow(() => parseDocument(serializeDocument(taller)));
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
