import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { createHash } from "node:crypto";
import {
  parseCityDocument,
  serializeCityDocument,
} from "../src/features/city/codec";
import { editCity } from "../src/features/city/edit";
import {
  parseSpatialWorld,
  serializeSpatialWorld,
  type DetailPlacement,
} from "../src/features/atlas/spatial-schema";
import {
  parseDocument,
  serializeDocument,
  isStructuredRoom,
} from "../src/model";
const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const seed = "tests/fixtures/atlas-e2e-v1/input/",
  target = "tests/fixtures/atlas-e2e-spatial-v2/";
const worldPath = "Atlanten/Gemeinsamer-Testatlas.overworld",
  cityPath = `Städte/${id(100)}.city`,
  dungeonPath = "Dungeons/E2E-01-Testdungeon/Karte.dungeon";
const world = parseSpatialWorld(readFileSync(seed + worldPath, "utf8"));
const bindings: readonly DetailPlacement[] = [
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
const original = parseCityDocument(readFileSync(seed + cityPath, "utf8"));
const footprint = editCity(original, [
  {
    kind: "set-building-footprint",
    buildingId: id(105),
    footprint: {
      outer: [
        { x: 0, y: 0 },
        { x: 15.24, y: 0 },
        { x: 15.24, y: 12.192 },
        { x: 0, y: 12.192 },
      ],
      holes: [],
    },
  },
]);
const city = editCity(footprint, [
  {
    kind: "set-building-pose",
    buildingId: id(105),
    position: { x: -18, y: 8 },
    rotationRadians: 0,
    scale: { x: 1, y: 1 },
  },
]);
const roomText =
  "Atlasprobe: Haus und Raum liegen zusammen.\n\n**Tür** bleibt verknüpft.\n";
const files = [
  worldPath,
  cityPath,
  dungeonPath,
  ...[11, 12].map((n) => `Orte/${id(n)}.location`),
  ...world.chunks.map((ref) => `Atlasdaten/${world.id}/${ref.file}`),
];
const manifest = {
  kind: "atlas-e2e-spatial-fixture",
  fixtureVersion: "e2e01-spatial-v2",
  gate: "E2E-01",
  steward: "Hex",
  state: "spatial_host_slice_full_gate_open",
  materialization:
    "native CityEdit footprint then pose, one city snapshot; frozen v1 untouched",
  input: [] as unknown[],
  expected: [] as unknown[],
  oracle: {
    houseId: id(105),
    inputPosition: { x: -18, y: 8 },
    expectedPosition: { x: -14, y: 6 },
    footprintMeters: { width: 15.24, height: 12.192 },
    dungeonRoomFields: { width: 10, height: 8 },
    metersPerField: 1.524,
    roomId: id(31),
    sectionId: id(34),
    roomText,
    unchangedNativeFiles: [
      worldPath,
      ...files.filter(
        (p) => p !== worldPath && p !== cityPath && p !== dungeonPath,
      ),
    ],
    limits: [
      "No Campaign authority token, original parity, physical input or full E2E gate.",
    ],
  },
};
for (const file of files) {
  const raw = readFileSync(seed + file, "utf8");
  const input =
    file === worldPath
      ? serializeSpatialWorld({
          ...world,
          version: 2,
          detailPlacements: bindings,
        })
      : file === cityPath
        ? serializeCityDocument(city)
        : raw;
  let expected = input;
  if (file === cityPath)
    expected = serializeCityDocument(
      editCity(city, [
        {
          kind: "set-building-pose",
          buildingId: id(105),
          position: { x: -14, y: 6 },
          rotationRadians: 0,
          scale: { x: 1, y: 1 },
        },
      ]),
    );
  if (file === dungeonPath) {
    const doc = parseDocument(input);
    expected = serializeDocument({
      ...doc,
      entities: doc.entities.map((r) =>
        isStructuredRoom(r) && r.id === id(31)
          ? {
              ...r,
              key: {
                ...r.key,
                sections: r.key.sections.map((s) =>
                  s.kind === "markdown" && s.id === id(34)
                    ? { ...s, markdown: roomText }
                    : s,
                ),
              },
            }
          : r,
      ),
    });
  }
  for (const [side, bytes] of [
    ["input", input],
    ["expected", expected],
  ] as const) {
    const fixtureFile = side + "/" + file;
    mkdirSync(dirname(target + fixtureFile), { recursive: true });
    writeFileSync(target + fixtureFile, bytes);
    manifest[side].push({
      path: file,
      fixtureFile,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      bytes: Buffer.byteLength(bytes),
    });
  }
}
writeFileSync(
  target + "manifest.json",
  JSON.stringify(manifest, null, 2) + "\n",
);
