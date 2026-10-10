import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const root = "tests/fixtures/atlas-e2e-campaign-b-v1";
const prefix = "11111111-1111-4111-8111-";
const id = (n) => prefix + String(n).padStart(12, "0");
const json = (value) => JSON.stringify(value, null, 2) + "\n";
const sha = (bytes) =>
  `sha256:${createHash("sha256").update(bytes, "utf8").digest("hex")}`;
const stable = (value) => {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.keys(value).sort().map((key) =>
      `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
};
const digestValue = (value) => sha(stable(value));
const ref = (target) => ({
  id: target,
  scope: "campaign-local",
  schema: "atlas.e2e01.v1",
});

const campaignId = id(1), namespace = id(2), worldId = id(10);
const worldPath = "Atlanten/E2E-01-Nebelmark-B.overworld";
const cityPath = `Städte/${id(100)}.city`;
const dungeonPath = "Dungeons/E2E-01-Nebelgewölbe-B/Karte.dungeon";
const locationPaths = [11, 12].map((n) => `Orte/${id(n)}.location`);
const terrainPaths = [
  `Atlasdaten/${worldId}/terrain/0_0_0.json`,
  `Atlasdaten/${worldId}/terrain/0_1_0.json`,
];
const campaignPath = "Kampagnen/SaltMarcher/E2E-01-Nebelmark-B.campaign.json";

const world = {
  kind: "overworld",
  version: 2,
  id: worldId,
  name: "Nebelmark",
  orientation: "pointy",
  origin: { x: 1250, y: -750 },
  metersPerMile: 1609.344,
  minHexMiles: 3,
  levelFactor: 3,
  chunks: [
    { q: 0, r: 0, level: 0, file: "terrain/0_0_0.json", cellCount: 1,
      extent: { minQ: 0, maxQ: 0, minR: 0, maxR: 0 } },
    { q: 1, r: 0, level: 0, file: "terrain/0_1_0.json", cellCount: 1,
      extent: { minQ: 32, maxQ: 32, minR: 0, maxR: 0 } },
  ],
  placements: [
    { kind: "location", id: id(13), locationId: id(11), position: { x: 1524, y: -610 } },
    { kind: "location", id: id(14), locationId: id(12), position: { x: 6096, y: 2286 } },
  ],
  detailPlacements: [
    { id: id(201), kind: "city", documentId: id(100),
      parent: { kind: "location", locationId: id(11) },
      offsetMeters: { x: 45, y: -30 }, rotationRadians: 0.125 },
    { id: id(202), kind: "dungeon", documentId: id(30),
      parent: { kind: "city-building", cityId: id(100), buildingId: id(105) },
      anchor: { parentPointMeters: { x: 2, y: 3 }, mapPointFields: { x: 3, y: 5 } },
      rotationRadians: -0.25, surfaceFloorId: id(32),
      entrances: [{ routeId: id(33), floorId: id(32), roomId: id(31), pointFields: { x: 3, y: 5 } }] },
  ],
};
const city = {
  kind: "city", version: 1, id: id(100), name: "Morgenhafen", units: "meters",
  roadNodes: [
    { id: id(101), point: { x: -24, y: -6 } },
    { id: id(102), point: { x: 18, y: 12 } },
  ],
  roads: [{ id: id(103), startNodeId: id(101), endNodeId: id(102),
    via: [{ x: -3, y: 9 }], widthMeters: 5.5 }],
  plazas: [{ id: id(104), name: "Leuchterplatz", outline: {
    outer: [{ x: -7, y: -3 }, { x: 5, y: -3 }, { x: 7, y: 6 }, { x: -5, y: 7 }], holes: [] } }],
  plots: [], districts: [],
  buildings: [
    { id: id(105), name: "Kartenhaus", footprint: {
      outer: [{ x: 0, y: 0 }, { x: 12, y: 0 }, { x: 12, y: 9 }, { x: 0, y: 9 }], holes: [] },
      position: { x: -11, y: 14 }, rotationRadians: 0.25, scale: { x: 1.1, y: 0.9 } },
    { id: id(106), name: "Archivturm", footprint: {
      outer: [{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 11 }, { x: 0, y: 11 }], holes: [] },
      position: { x: 9, y: -13 }, rotationRadians: -0.5, scale: { x: 1, y: 1 } },
  ],
};
const dungeon = {
  format: "dungeon-map", version: 4, id: id(30),
  settings: { name: "Nebelgewölbe", width: 28, height: 20, feetPerField: 5,
    wallShadows: true, objectShadows: false, buildingWear: 0.15,
    nativeBuildingWear: true, buildingWearMode: "grime" },
  floors: [{ id: id(32), name: "Unteres Archiv", elevation: -1 }],
  entities: [{ id: id(31), floorId: id(32), kind: "building",
    polygons: [{ outer: [{ x: 3, y: 5 }, { x: 12, y: 5 }, { x: 12, y: 13 }, { x: 3, y: 13 }], holes: [] }],
    layer: 0, fill: 3750201, wall: 8158332, wallWidth: 0.3,
    name: "Kartensaal", number: "B1",
    key: { sections: [{ id: id(34), kind: "markdown",
      markdown: "## Kartensaal\nDie Messingtafeln zeigen einen fremden Küstenverlauf.\n" }] } }],
  content: { definitions: [], occurrences: [], routes: [{ id: id(33),
    name: "Nebeltreppe", entrance: true, toRoomId: id(31), prerequisites: [] }], archive: [] },
};
const locations = [
  { kind: "location", version: 1, id: id(11), name: "Morgenhafen", type: "city",
    sections: [
      { id: id(15), title: "Hafenbild", markdown: "Graue Segel liegen im Morgennebel.\n" },
      { id: id(16), title: "Gerücht", markdown: "Im Kartenhaus fehlt eine Messingtafel.\n" },
    ], detailMaps: [], keyLinks: [] },
  { kind: "location", version: 1, id: id(12), name: "Nebeltor", type: "poi",
    sections: [
      { id: id(17), title: "Steinbogen", markdown: "Der Bogen summt bei Ebbe.\n" },
      { id: id(18), title: "Spur", markdown: "Salzkristalle weisen nach Osten.\n" },
    ], detailMaps: [], keyLinks: [] },
];
const terrains = [
  { kind: "atlas-terrain", version: 1, worldId, level: 0, q: 0, r: 0,
    cells: [{ q: 0, r: 0, surface: "sea", terrain: "plain", color: "#496b63" }] },
  { kind: "atlas-terrain", version: 1, worldId, level: 0, q: 1, r: 0,
    cells: [{ q: 32, r: 0, surface: "land", terrain: "forest", color: "#8a7b55" }] },
];

const native = [
  ["world", worldId, worldPath, world],
  ["city", id(100), cityPath, city],
  ["dungeon", id(30), dungeonPath, dungeon],
  ["location", id(11), locationPaths[0], locations[0]],
  ["location", id(12), locationPaths[1], locations[1]],
  ["terrain", null, terrainPaths[0], terrains[0]],
  ["terrain", null, terrainPaths[1], terrains[1]],
].map(([kind, documentId, path, value]) => ({ kind, id: documentId, path, value, bytes: json(value) }));
const byPath = new Map(native.map((file) => [file.path, file]));
const fileDigest = (path) => sha(byPath.get(path).bytes);
const worldClosureDigest = digestValue({
  schema: "campaign-runtime-world-file-closure-v1",
  world: fileDigest(worldPath),
  terrain: terrainPaths.map((path) => ({ path, savedDigest: fileDigest(path) }))
    .sort((a, b) => a.path.localeCompare(b.path)),
});
const refs = (ids) => ids.map(ref);
const record = (recordId, recordType, references, payloadDigest) => ({
  id: recordId, recordType, references: refs(references), payloadDigest, media: null,
});
const atlasRecords = [
  record(worldId, "world", [id(13), id(14), id(201), id(202)], worldClosureDigest),
  record(id(11), "location", [id(15), id(16)], fileDigest(locationPaths[0])),
  record(id(12), "location", [id(17), id(18)], fileDigest(locationPaths[1])),
  record(id(13), "location-placement", [worldId, id(11)], fileDigest(worldPath)),
  record(id(14), "location-placement", [worldId, id(12)], fileDigest(worldPath)),
  record(id(15), "location-section", [id(11)], fileDigest(locationPaths[0])),
  record(id(16), "location-section", [id(11)], fileDigest(locationPaths[0])),
  record(id(17), "location-section", [id(12)], fileDigest(locationPaths[1])),
  record(id(18), "location-section", [id(12)], fileDigest(locationPaths[1])),
  record(id(201), "city-placement", [id(11), id(100)], fileDigest(worldPath)),
  record(id(202), "dungeon-placement", [id(30), id(31), id(32), id(33), id(100), id(105)], fileDigest(worldPath)),
];
const cityRecords = [
  record(id(100), "city", [id(101), id(102), id(103), id(104), id(105), id(106)], fileDigest(cityPath)),
  record(id(101), "road-node", [id(100)], fileDigest(cityPath)),
  record(id(102), "road-node", [id(100)], fileDigest(cityPath)),
  record(id(103), "road", [id(100), id(101), id(102)], fileDigest(cityPath)),
  record(id(104), "plaza", [id(100)], fileDigest(cityPath)),
  record(id(105), "building", [id(100)], fileDigest(cityPath)),
  record(id(106), "building", [id(100)], fileDigest(cityPath)),
];
const dungeonRecords = [
  record(id(30), "dungeon", [id(31), id(32), id(33)], fileDigest(dungeonPath)),
  record(id(31), "room", [id(30), id(32), id(34)], fileDigest(dungeonPath)),
  record(id(32), "floor", [id(30)], fileDigest(dungeonPath)),
  record(id(33), "route", [id(30), id(31)], fileDigest(dungeonPath)),
  record(id(34), "room-section", [id(31)], fileDigest(dungeonPath)),
];
const owner = (ownerId, records) => {
  const suffix = digestValue({ schema: "campaign-runtime-owner-fixture-v1", ownerId,
    records: records.map(({ id, payloadDigest }) => ({ id, payloadDigest })) }).slice(7);
  const value = {
    ownerId, ownerRevision: `owner:${suffix}`, schemaRevision: `schema:${ownerId}:e2e01`,
    snapshotRevision: `snapshot:${suffix}`, policyRevision: `policy:${ownerId}:e2e01`,
    policyDigest: "", availability: "confirmed", emptyConfirmed: false,
    referenceSchemas: ["atlas.e2e01.v1"],
    source: { adapterType: `native-${ownerId}`, generation: `source:${suffix}` },
    records: records.map((item) => ({ ...item,
      references: [...item.references].sort((a, b) => `${a.scope}:${a.id}:${a.schema}`.localeCompare(`${b.scope}:${b.id}:${b.schema}`)) }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    transferPolicies: [],
  };
  value.policyDigest = digestValue({ ownerId, policyRevision: value.policyRevision, transferPolicies: [] });
  return value;
};
const owners = [owner("atlas", atlasRecords), owner("city", cityRecords), owner("dungeon", dungeonRecords)]
  .sort((a, b) => a.ownerId.localeCompare(b.ownerId));
const snapshot = { schemaVersion: 1, campaignId, revision: 1,
  name: "E2E-01 Nebelmark B", namespace, lifecycle: "active" };
const registry = { version: 1, registryId: "registry:e2e01:campaign-b-v1",
  registryRevision: "registry:campaign-b-v1", campaignId, campaignRevision: 1, namespace, owners };
const inventoryRecords = [
  [worldId, "world", worldId, "atlas"], [id(11), "location", id(11), "atlas"],
  [id(12), "location", id(12), "atlas"], [id(15), "location-section", id(11), "atlas"],
  [id(16), "location-section", id(11), "atlas"], [id(17), "location-section", id(12), "atlas"],
  [id(18), "location-section", id(12), "atlas"], [id(100), "city", id(100), "city"],
  [id(105), "building", id(100), "city"], [id(106), "building", id(100), "city"],
  [id(30), "dungeon", id(30), "dungeon"], [id(31), "room", id(30), "dungeon"],
  [id(34), "room-section", id(30), "dungeon"],
].map(([recordId, kind, documentId, ownerId]) => ({
  id: recordId, kind, documentId, ownerId, availability: "available",
}));
const runtime = {
  version: 1,
  snapshot,
  registry: { ...registry, registryContentDigest: digestValue(registry) },
  atlas: {
    worldId,
    files: native.map((file) => ({ kind: file.kind, id: file.id, path: file.path, savedDigest: sha(file.bytes) })),
    records: inventoryRecords,
  },
};
const runtimeBytes = json(runtime);
for (const file of native) {
  const target = join(root, "input", file.path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, file.bytes);
}
const runtimeTarget = join(root, "input", campaignPath);
mkdirSync(dirname(runtimeTarget), { recursive: true });
writeFileSync(runtimeTarget, runtimeBytes);

const fixture = {
  kind: "e2e01-campaign-native-fixture",
  version: 1,
  fixtureVersion: "e2e01-campaign-b-v1",
  gate: "E2E-01",
  steward: "Campaign/Data",
  sourceCommit: "9ff11e8e515f162272eab3edf59f5a823349c7aa",
  materialization: "independent native domain values; generator reads no Campaign-A fixture",
  input: native.map((file) => ({ kind: file.kind, path: file.path,
    fixtureFile: `input/${file.path}`, sha256: sha(file.bytes).slice(7), bytes: Buffer.byteLength(file.bytes) }))
    .sort((a, b) => a.path.localeCompare(b.path)),
  campaign: { path: campaignPath, fixtureFile: `input/${campaignPath}`,
    sha256: sha(runtimeBytes).slice(7), bytes: Buffer.byteLength(runtimeBytes) },
  provenance: {
    worldClosureDigest,
    owners: owners.map(({ ownerId, ownerRevision, snapshotRevision, policyRevision, policyDigest, source }) =>
      ({ ownerId, ownerRevision, snapshotRevision, policyRevision, policyDigest,
        adapterType: source.adapterType, generation: source.generation })),
  },
  initialOracle: {
    campaignId, namespace, registryId: registry.registryId,
    registryRevision: registry.registryRevision, campaignName: snapshot.name,
    worldId, worldName: world.name,
    locationIds: [id(11), id(12)], cityId: id(100), buildingId: id(105),
    dungeonId: id(30), roomId: id(31), roomSectionId: id(34),
    locationNames: locations.map((value) => value.name),
    cityName: city.name, roomName: dungeon.entities[0].name,
    cityPlacement: world.detailPlacements[0], dungeonPlacement: world.detailPlacements[1],
    terrainCells: terrains.flatMap((value) => value.cells),
    inventoryRecordCount: inventoryRecords.length,
    picker: { label: snapshot.name, status: "available" },
  },
};
writeFileSync(join(root, "manifest.json"), json(fixture));
