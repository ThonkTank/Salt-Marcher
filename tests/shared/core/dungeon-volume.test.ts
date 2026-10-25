import assert from "node:assert/strict";
import test from "node:test";
import { paintWalkableColumn } from "../../../src/features/dungeon/volume";
import { newDocument, parseDocument, serializeDocument } from "../../../src/model";

test("ordinary floor paint creates a persistent ten-foot Volume shell", () => {
  const before = newDocument("Volume", 12, 12),
    painted = paintWalkableColumn(before, "volume-a", {
      x: 3,
      y: 4,
      bottomStep: 0,
    }),
    reopened = parseDocument(serializeDocument(painted)),
    volume = reopened.volumes?.[0];
  assert.equal(volume?.id, "volume-a");
  assert.deepEqual(
    volume?.cells.map((cell) => ({
      z: cell.z,
      floor: cell.floor,
      ceiling: cell.ceiling,
    })),
    [
      { z: 0, floor: true, ceiling: false },
      { z: 1, floor: false, ceiling: true },
    ],
  );
  assert.ok(volume?.cells.every((cell) => cell.walls.length === 4));
});

test("invalid grids and duplicate Volume identity fail before persistence", () => {
  const input = newDocument("Volume", 2, 2);
  assert.throws(
    () =>
      paintWalkableColumn(input, "bad", {
        x: 0.5,
        y: 0,
        bottomStep: 0,
      }),
    /5-Fuß-Raster/,
  );
  const painted = paintWalkableColumn(input, "one", {
    x: 0,
    y: 0,
    bottomStep: 0,
    heightSteps: 1,
  });
  assert.throws(
    () =>
      paintWalkableColumn(painted, "one", {
        x: 1,
        y: 1,
        bottomStep: 0,
      }),
    /Kennung/,
  );
  const unbounded = paintWalkableColumn(input, "outside", {
    x: -2,
    y: 4,
    bottomStep: 0,
  });
  assert.equal(unbounded.volumes?.[0]?.cells[0]?.x, -2);
  assert.throws(
    () =>
      paintWalkableColumn(input, "   ", {
        x: 0,
        y: 0,
        bottomStep: 0,
      }),
    /Volume/,
  );
});

test("V3 remains byte-compatible and rejects Volume authoring or injected payload", () => {
  const legacy = newDocument("Legacy", 3, 3, undefined, undefined, 3),
    bytes = serializeDocument(legacy);
  assert.equal(parseDocument(bytes).version, 3);
  assert.equal(serializeDocument(parseDocument(bytes)), bytes);
  assert.throws(
    () =>
      paintWalkableColumn(legacy, "volume-v3", {
        x: 0,
        y: 0,
        bottomStep: 0,
      }),
    /V4/,
  );
  const volume = paintWalkableColumn(newDocument("V4", 3, 3), "volume-v4", {
    x: 0,
    y: 0,
    bottomStep: 0,
  }).volumes;
  assert.throws(
    () => parseDocument(JSON.stringify({ ...legacy, volumes: volume })),
    /V4/,
  );
});

test("overlapping and disconnected persisted Volumes fail closed", () => {
  const input = paintWalkableColumn(newDocument("Volume", 3, 3), "one", {
    x: 0,
    y: 0,
    bottomStep: 0,
  });
  assert.throws(
    () =>
      parseDocument(
        serializeDocument({
          ...input,
          volumes: [
            ...input.volumes!,
            { id: "two", cells: input.volumes![0]!.cells },
          ],
        }),
      ),
    /überlappen/,
  );
  assert.throws(
    () =>
      parseDocument(
        serializeDocument({
          ...input,
          volumes: [
            {
              id: "one",
              cells: [
                input.volumes![0]!.cells[0]!,
                {
                  ...input.volumes![0]!.cells[1]!,
                  x: 2,
                  y: 2,
                },
              ],
            },
          ],
        }),
      ),
    /zusammenhängend/,
  );
});
