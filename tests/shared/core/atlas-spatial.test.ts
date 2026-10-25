import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { AtlasHistory } from "../../../src/features/atlas/atlas-history";
import { parseOverworld } from "../../../src/features/atlas/overworld";
import {
  checkedSpatialWorld,
  parseSpatialWorld,
  serializeSpatialWorld,
  spatialChange,
  type DetailPlacement,
  type SpatialState,
} from "../../../src/features/atlas/spatial-schema";
import { TerrainSource } from "../../../src/features/atlas/terrain-source";

const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const root = "tests/fixtures/atlas-e2e-v1/input/",
  read = (p: string) => readFileSync(root + p, "utf8");
const worldBytes = read("Atlanten/Gemeinsamer-Testatlas.overworld");
const details: readonly DetailPlacement[] = [
  {
    kind: "city",
    id: id(201),
    documentId: id(100),
    parent: { kind: "location", locationId: id(11) },
    offsetMeters: { x: 0, y: 0 },
    rotationRadians: 0,
  },
  {
    kind: "dungeon",
    id: id(202),
    documentId: id(30),
    parent: { kind: "city-building", cityId: id(100), buildingId: id(105) },
    anchor: {
      parentPointMeters: { x: 0, y: 0 },
      mapPointFields: { x: 4, y: 4 },
    },
    rotationRadians: 0,
    surfaceFloorId: id(32),
    entrances: [
      {
        routeId: id(33),
        floorId: id(32),
        roomId: id(31),
        pointFields: { x: 4, y: 4 },
      },
    ],
  },
];
const state2 = (detailPlacements = details): SpatialState => ({
  version: 2,
  detailPlacements,
});

test("Spatial native codec preserves V1 bytes and keeps V2 closed in the existing host parser", () => {
  assert.equal(
    serializeSpatialWorld(parseSpatialWorld(worldBytes)),
    worldBytes,
  );
  const world = checkedSpatialWorld({
    ...parseSpatialWorld(worldBytes),
    version: 2,
    detailPlacements: details,
  });
  const bytes = serializeSpatialWorld(world);
  assert.equal(serializeSpatialWorld(parseSpatialWorld(bytes)), bytes);
  assert.throws(() => parseOverworld(bytes, true));
  const h = new AtlasHistory(),
    old = new TerrainSource(
      parseOverworld(worldBytes, true),
      h,
      async () => "",
    );
  assert.throws(() => old.spatialState(), /nicht aktiviert/);
  assert.throws(() =>
    h.execute({
      label: "Nicht aktivierter Anschluss",
      changes: [
        spatialChange(id(10), { version: 1, detailPlacements: [] }, state2()),
      ],
    }),
  );
  assert.equal(h.undoDepth, 0);
});

test("Spatial native codec rejects unknown fields, getters, sparse lists, aliases and malformed parents before JSON", () => {
  const fresh = () =>
    JSON.parse(
      JSON.stringify({
        ...parseSpatialWorld(worldBytes),
        version: 2,
        detailPlacements: details,
      }),
    );
  const unknown = { ...fresh(), ignored: true };
  assert.throws(() => checkedSpatialWorld(unknown));
  let accessed = 0;
  const getter = fresh();
  Object.defineProperty(getter, "detailPlacements", {
    enumerable: true,
    get: () => {
      accessed++;
      return [];
    },
  });
  assert.throws(() => checkedSpatialWorld(getter));
  assert.equal(accessed, 0);
  const sparse = fresh();
  delete sparse.detailPlacements[0];
  assert.throws(() => checkedSpatialWorld(sparse));
  const metadata = fresh();
  Object.assign(metadata.detailPlacements, { extra: true });
  assert.throws(() => checkedSpatialWorld(metadata));
  const nested = fresh();
  Object.assign(nested.detailPlacements[0]!.parent, { extra: true });
  assert.throws(() => checkedSpatialWorld(nested));
  const origin = fresh();
  Object.assign(origin.origin, { extra: true });
  assert.throws(() => checkedSpatialWorld(origin));
  const aliases = fresh();
  aliases.detailPlacements[0]!.id = id(11);
  assert.throws(() => checkedSpatialWorld(aliases));
  const duplicate = fresh();
  duplicate.detailPlacements.push(duplicate.detailPlacements[0]!);
  assert.throws(() => checkedSpatialWorld(duplicate));
  const wrongVersion = { ...fresh(), version: 1 };
  assert.throws(() => checkedSpatialWorld(wrongVersion));
});
