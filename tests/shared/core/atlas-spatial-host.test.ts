import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseCityDocument } from "../../../src/features/city/codec";
import { isStructuredRoom, parseDocument } from "../../../src/model";
const fixture = "tests/fixtures/atlas-e2e-spatial-v2/",
  manifest = JSON.parse(readFileSync(fixture + "manifest.json", "utf8"));
const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
test("Spatial v2 fixture has native metre footprint and complete byte oracles without changing v1", () => {
  for (const group of [manifest.input, manifest.expected])
    for (const row of group) {
      const bytes = readFileSync(fixture + row.fixtureFile);
      assert.equal(bytes.length, row.bytes);
      assert.equal(
        createHash("sha256").update(bytes).digest("hex"),
        row.sha256,
      );
    }
  const read = (extension: string) => {
    const row = manifest.input.find((row: { path: string }) =>
      row.path.endsWith(extension),
    );
    assert.ok(row, `Missing ${extension} fixture`);
    return readFileSync(fixture + row.fixtureFile, "utf8");
  };
  const city = parseCityDocument(read(".city"));
  const dungeon = parseDocument(read(".dungeon"));
  const house = city.buildings.find((b) => b.id === id(105))!;
  const room = dungeon.entities.find(isStructuredRoom)!;
  assert.equal(
    house.footprint.outer[1]!.x,
    (room.polygons[0]!.outer[1]!.x - room.polygons[0]!.outer[0]!.x) * 1.524,
  );
  assert.equal(house.footprint.outer[2]!.y, 8 * 1.524);
});
