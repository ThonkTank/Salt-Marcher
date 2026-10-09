import test from "node:test";
import assert from "node:assert/strict";
import {
  newOverworld,
  parseOverworld,
  serializeOverworld,
  METERS_PER_MILE,
} from "../../src/features/atlas/overworld";
import {
  hexAt,
  hexAddressKey,
  hexCenter,
  hexCorners,
  hexDistanceMeters,
  displayHexLevel,
} from "../../src/features/atlas/hex";
import {
  initialAtlasCamera,
  panAtlas,
  screenToWorld,
  worldToScreen,
  zoomAtlas,
} from "../../src/features/atlas/camera";
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
test("Both hex orientations preserve signed addresses and exact neighbor scale across levels", () => {
  for (const orientation of ["pointy", "flat"] as const) {
    const world = newOverworld("world-a", "Testwelt", orientation);
    for (const level of [0, 1, 3, 6, 10])
      for (const [q, r] of [
        [0, 0],
        [2, -3],
        [-7, 4],
        [-5, -9],
      ]) {
        const a = { worldId: world.id, level, q: q!, r: r! },
          center = hexCenter(world, a);
        assert.deepEqual(hexAt(world, center, level), a);
        const east = hexCenter(world, { ...a, q: a.q + 1 });
        assert(
          Math.abs(
            Math.hypot(east.x - center.x, east.y - center.y) /
              hexDistanceMeters(level) -
              1,
          ) < 1e-12,
        );
        assert.equal(hexCorners(world, a).length, 6);
        assert.equal(hexAddressKey(a), `world-a/${level}/${q}/${r}`);
      }
  }
  assert.equal(hexDistanceMeters(0), 3 * METERS_PER_MILE);
  assert.equal(hexDistanceMeters(1), 9 * METERS_PER_MILE);
  assert.throws(() =>
    hexCenter(newOverworld("a", "A", "flat"), {
      worldId: "b",
      level: 0,
      q: 0,
      r: 0,
    }),
  );
});
test("World origin participates in hit testing without moving the axial lattice", () => {
  const base = newOverworld("a", "A", "pointy");
  const world = parseOverworld(
    JSON.stringify({ ...base, origin: { x: -40000000, y: 20000000 } }),
  );
  assert.deepEqual(hexAt(world, world.origin), {
    worldId: "a",
    level: 0,
    q: 0,
    r: 0,
  });
  const east = hexCenter(world, { worldId: "a", level: 0, q: 1, r: 0 });
  assert.equal(east.y, world.origin.y);
  assert(Math.abs(east.x - world.origin.x - 4828.032) < 1e-8);
});
test("Pan and pointer anchored zoom preserve world hit positions and never mutate terrain", () => {
  const world = newOverworld("a", "A", "pointy"),
    saved = serializeOverworld(world),
    size = { width: 1000, height: 700 };
  const camera = initialAtlasCamera(world.origin),
    anchor = { x: 720, y: 210 },
    before = screenToWorld(camera, size, anchor);
  const zoomed = zoomAtlas(camera, size, anchor, 0.3),
    after = screenToWorld(zoomed, size, anchor);
  assert(Math.hypot(after.x - before.x, after.y - before.y) < 1e-9);
  assert.deepEqual(worldToScreen(camera, size, before), anchor);
  const panned = panAtlas(camera, 150, -90);
  assert.equal(panned.center.x, -150 * camera.metersPerPixel);
  assert.equal(panned.center.y, 90 * camera.metersPerPixel);
  assert.equal(serializeOverworld(world), saved);
  assert.throws(() => zoomAtlas(camera, size, anchor, 0));
});
test("Overview raster changes detail with hysteresis instead of enumerating small hexes", () => {
  assert.equal(displayHexLevel(hexDistanceMeters(0) / 96), 0);
  const broad = displayHexLevel(10000);
  assert(broad > 0);
  assert(
    hexDistanceMeters(broad) / 10000 >= 42 &&
      hexDistanceMeters(broad) / 10000 <= 180,
  );
  assert.equal(displayHexLevel(hexDistanceMeters(1) / 100, 1), 1);
  assert.equal(displayHexLevel(hexDistanceMeters(1) / 100, 0), 1);
  assert.throws(() => displayHexLevel(0));
  assert.throws(() => displayHexLevel(100, -1));
});
