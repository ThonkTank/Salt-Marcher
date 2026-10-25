import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  parseCityDocument,
  serializeCityDocument,
} from "../../../src/features/city/codec";

const root = "tests/fixtures/atlas-e2e-v1/";
const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const path = `Städte/${id(100)}.city`;
const seedBytes = () => readFileSync(root + "input/" + path, "utf8");

test("City E2E seed pins actual codec bytes, IDs, meters and courtyard geometry", () => {
  const manifest = JSON.parse(
    readFileSync(root + "city-manifest.json", "utf8"),
  );
  const bytes = seedBytes(),
    city = parseCityDocument(bytes);
  assert.equal(manifest.cityId, id(100));
  assert.deepEqual(manifest.elementIds, [101, 102, 103, 104, 105, 106].map(id));
  assert.equal(manifest.files.length, 2);
  assert.deepEqual(
    manifest.files.map((f: { fixtureFile: string }) => f.fixtureFile),
    ["input/" + path, "expected/" + path],
  );
  for (const file of manifest.files) {
    const actual = readFileSync(root + file.fixtureFile);
    assert.equal(actual.length, file.bytes);
    assert.equal(
      createHash("sha256").update(actual).digest("hex"),
      file.sha256,
    );
    assert.equal(actual.toString("utf8"), bytes);
  }
  assert.equal(serializeCityDocument(city), bytes);
  assert.equal(city.id, id(100));
  assert.equal(city.units, "meters");
  assert.deepEqual(city.roadNodes, [
    { id: id(101), point: { x: -10, y: 0 } },
    { id: id(102), point: { x: 10, y: 0 } },
  ]);
  assert.deepEqual(city.roads, [
    {
      id: id(103),
      startNodeId: id(101),
      endNodeId: id(102),
      via: [],
      widthMeters: 4,
    },
  ]);
  const points = (ps: number[][]) => ps.map(([x, y]) => ({ x, y }));
  assert.deepEqual(city.plazas, [
    {
      id: id(104),
      name: "E2E-Platz",
      outline: {
        outer: points([
          [-4, -4],
          [4, -4],
          [4, 4],
          [-4, 4],
        ]),
        holes: [],
      },
    },
  ]);
  assert.deepEqual(city.plots, []);
  assert.deepEqual(city.districts, []);
  assert.equal(city.buildings.length, 2);
  for (const [index, house] of city.buildings.entries()) {
    assert.equal(house.id, id(105 + index));
    assert.deepEqual(house.position, { x: index === 0 ? -6 : 6, y: 8 });
    assert.equal(house.rotationRadians, 0);
    assert.deepEqual(house.scale, { x: 1, y: 1 });
    assert.deepEqual(
      house.footprint,
      index === 0
        ? {
            outer: points([
              [0, 0],
              [4, 0],
              [4, 6],
              [0, 6],
            ]),
            holes: [],
          }
        : {
            outer: points([
              [0, 0],
              [8, 0],
              [8, 8],
              [0, 8],
            ]),
            holes: [
              points([
                [2, 2],
                [2, 6],
                [6, 6],
                [6, 2],
              ]),
            ],
          },
    );
  }
  assert.deepEqual(manifest.externalReferences, {
    atlasId: id(10),
    cityLocationId: id(11),
    poiLocationId: id(12),
    houseId: id(105),
    bindingState: "pending_confirmed_spatial_port_no_city_v1_field",
  });
  assert.throws(
    () =>
      parseCityDocument(
        JSON.stringify({
          ...city,
          buildings: [
            { ...city.buildings[0], dungeonId: id(30) },
            city.buildings[1],
          ],
        }),
      ),
    /unbekannte Felder/,
  );
});
