import test from "node:test";
import assert from "node:assert/strict";
import {
  newOverworld,
  parseOverworld,
  serializeOverworld,
} from "../../../src/features/atlas/overworld";
test("Atlas units and empty native roundtrip have no pixel bounds or generated hexes", () => {
  const d = newOverworld("world-a", "Testwelt", "pointy");
  assert.equal(d.metersPerMile, 1609.344);
  assert.equal(d.minHexMiles, 3);
  const raw = serializeOverworld(d);
  assert.deepEqual(parseOverworld(raw), d);
  assert(!raw.includes('"width"'));
  assert(!raw.includes('"height"'));
  assert.equal(d.chunks.length, 0);
  assert.equal(d.placements.length, 0);
  for (const altered of [
    { ...d, minHexMiles: 1 },
    { ...d, metersPerMile: 1600 },
    { ...d, width: 1000 },
    { ...d, version: 2 },
    { ...d, chunks: ["unknown"] },
  ])
    assert.throws(() => parseOverworld(JSON.stringify(altered)));
});
