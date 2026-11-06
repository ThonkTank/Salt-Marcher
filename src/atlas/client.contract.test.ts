import buildCore from "../../tests/support/buildCore";
import {
  startCoreTransport,
  type CoreTransport,
} from "../../tests/support/coreTransport";
import { afterAll, beforeAll, expect, test } from "vitest";
import { AtlasClient } from "./client";
import { normalizeWireError, WireError } from "../wireError";

let core: CoreTransport | undefined;
let client: AtlasClient;
let sendRaw: (cmd: string, args: Record<string, unknown>) => Promise<unknown>;
beforeAll(() => {
  buildCore();
  core = startCoreTransport();
  sendRaw = async (cmd, args) => {
    const response = JSON.parse(await core!.request({ cmd, args }));
    if (response.error) throw response.error;
    return response.value;
  };
  client = new AtlasClient(sendRaw);
}, 120_000);
afterAll(async () => {
  await core?.close();
});

test("Rust worker responses are consumed through the typed Atlas client", async () => {
  let status = await client.request("status", {});
  expect(status).toMatchObject({
    revision: 0,
    dirty: false,
    path: null,
    canUndo: false,
    canRedo: false,
    changes: null,
  });
  expect(await client.request("extent", {})).toBeNull();
  const house = {
    type: "createHouse",
    parcelId: null,
    transform: { x: 0, y: 0, angle: 0 },
    width: 2,
    depth: 2,
  } as const;
  const valid = await client.request("preview", {
    version: status,
    intent: house,
  });
  expect(valid).toMatchObject({
    valid: true,
    version: { sessionId: status.sessionId, revision: 0 },
    changed: true,
    generationSummary: { limited: false },
    generationLimit: null,
    generationDiagnostics: [],
    removedConnections: [],
  });
  expect(valid).not.toHaveProperty("reason");
  expect(valid.objects[0]).toMatchObject({
    kind: "house",
    transform: house.transform,
    contours: expect.any(Array),
  });
  const committed = await client.request("commit", {
    version: status,
    intent: house,
  });
  expect(committed.status?.revision).toBe(1);
  expect(committed.objects).toEqual(valid.objects);
  status = committed.status!;
  const invalid = await client.request("preview", {
    version: status,
    intent: house,
  });
  expect(invalid).toMatchObject({
    valid: false,
    reason: expect.any(String),
    changed: false,
    objects: [],
    removed: [],
    generationSummary: {
      createdParcels: 0,
      createdHouses: 0,
      emptyParcels: 0,
      skippedParcels: 0,
      unplacedHouses: 0,
      limited: false,
    },
    generationDiagnostics: [],
    generationLimit: null,
  });
  expect(invalid).not.toHaveProperty("status");
  expect(invalid).not.toHaveProperty("removedConnections");
  const scene = await client.read("scene", {
    context: { kind: "exterior" },
    bounds: [-100, -100, 100, 100],
  });
  const building = scene.objects[0];
  expect(building.kind).toBe("house");
  expect(building).toEqual(committed.objects[0]);
  const offscreen = await client.read("scene", {
    bounds: [100, 100, 200, 200],
    context: { kind: "house", houseId: building.id },
  });
  expect(offscreen.objects).toEqual([building]);
  const metadata = await client.read("interiorMetadata", {
    buildingId: building.id,
  });
  expect(metadata).toMatchObject({
    buildingId: building.id,
    rooms: [expect.objectContaining({ buildingId: building.id, floor: 0 })],
    connections: [
      expect.objectContaining({
        type: "opening",
        kind: "door",
        offset: 0.5,
        toRoom: null,
      }),
    ],
  });
  const tile = await client.read("interiorTile", {
    buildingId: building.id,
    floor: 0,
    bounds: [-1, -1, 3, 3],
    includeLower: true,
  });
  expect(tile).toMatchObject({
    buildingId: building.id,
    floor: 0,
    bounds: [-1, -1, 3, 3],
    includeLower: true,
    lower: [],
  });
  expect(tile.cells).toHaveLength(4);
  expect(await client.request("extent", {})).toEqual([0, 0, 10, 10]);
  await expect(
    client.request("history", {
      version: { ...status, revision: 0 },
      redo: false,
    }),
  ).rejects.toMatchObject({ category: "staleVersion" });
  await expect(
    client.request("commit", { version: status, intent: house }),
  ).rejects.toMatchObject({
    category: "invalidInput",
    name: "WireError",
    issue: invalid.valid ? undefined : invalid.issues[0],
  });
  const undone = await client.request("history", {
    version: status,
    redo: false,
  });
  expect(undone).toMatchObject({ canRedo: true, revision: 2 });
  const redone = await client.request("history", {
    version: undone,
    redo: true,
  });
  expect(redone).toMatchObject({ canUndo: true, revision: 3 });
  const rename = {
    type: "rename",
    id: building.id,
    name: "Typed house",
  } as const;
  const fieldPreview = await client.request("preview", {
    version: redone,
    intent: rename,
  });
  const fieldCommit = await client.request("commit", {
    version: redone,
    intent: rename,
  });
  expect(fieldCommit.objects).toEqual(fieldPreview.objects);
  expect(fieldCommit.removed).toEqual([building.id]);
  expect(fieldCommit.objects[0]).toMatchObject({
    ...building,
    name: "Typed house",
  });
  const renamedScene = await client.read("scene", {
    context: { kind: "exterior" },
    bounds: [-100, -100, 100, 100],
  });
  expect(renamedScene.objects[0]).toEqual(fieldCommit.objects[0]);
  const fresh = await client.request("new", {});
  expect(fresh).toMatchObject({ revision: 0, dirty: false });
  expect(fresh.sessionId).not.toBe(status.sessionId);
  const storage = await sendRaw("open", {
    path: "/no-such-atlas-file.saltatlas",
  }).catch(normalizeWireError);
  expect(storage).toBeInstanceOf(WireError);
  expect(storage).toMatchObject({ category: "storage" });
});

test("Rust scene object variants and malformed input stay on the wire contract", async () => {
  let status = await client.request("new", {});
  const road = {
    name: "Road",
    width: 10,
    material: "earth",
    nodes: [
      { point: [100, 100], incoming: null, outgoing: null },
      { point: [150, 100], incoming: null, outgoing: null },
    ],
  } as const;
  // Copy readonly coordinates to the mutable wire shape used by the client.
  const roadIntent = {
    type: "createRoad" as const,
    population: null,
    road: {
      ...road,
      nodes: road.nodes.map((n) => ({
        ...n,
        point: [...n.point] as [number, number],
      })),
    },
  };
  const roadPreview = await client.request("preview", {
    version: status,
    intent: roadIntent,
  });
  const roadCommit = await client.request("commit", {
    version: status,
    intent: roadIntent,
  });
  expect(roadCommit.objects).toEqual(roadPreview.objects);
  status = roadCommit.status;
  const area = {
    material: "stone",
    points: [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
    ] as [number, number][],
  };
  const areaIntent = { type: "createArea" as const, area };
  const areaPreview = await client.request("preview", {
    version: status,
    intent: areaIntent,
  });
  const areaCommit = await client.request("commit", {
    version: status,
    intent: areaIntent,
  });
  expect(areaCommit.objects).toEqual(areaPreview.objects);
  status = areaCommit.status;
  const scene = await client.read("scene", {
    context: { kind: "exterior" },
    bounds: [-10, -10, 200, 200],
  });
  expect(scene.objects).toEqual([roadCommit.objects[0], areaCommit.objects[0]]);
  expect(scene.objects).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        kind: "road",
        id: expect.stringMatching(/^road-/),
        material: "earth",
        path: expect.any(Array),
        nodes: expect.any(Array),
      }),
      expect.objectContaining({
        kind: "area",
        id: expect.stringMatching(/^area-/),
        material: "stone",
        points: area.points,
        order: expect.any(Number),
      }),
    ]),
  );
  expect(scene.status.revision).toBe(status.revision);
  await expect(
    sendRaw("interiorTile", {
      buildingId: "missing",
      floor: "wrong",
      bounds: [0, 0, 1, 1],
      includeLower: false,
    }).catch((e) => {
      throw normalizeWireError(e);
    }),
  ).rejects.toMatchObject({ category: "invalidInput" });
  await expect(
    sendRaw("unknown", {}).catch((e) => {
      throw normalizeWireError(e);
    }),
  ).rejects.toMatchObject({ category: "invalidInput" });
});

test("Rust stair connection is consumed as its discriminated interior variant", async () => {
  let status = await client.request("new", {});
  const created = await client.request("commit", {
    version: status,
    intent: {
      type: "createHouse",
      parcelId: null,
      transform: { x: 0, y: 0, angle: 0 },
      width: 4,
      depth: 4,
    },
  });
  status = created.status;
  const id = created.objects[0].id;
  const cells: [number, number][] = Array.from({ length: 16 }, (_, i) => [
    i % 4,
    Math.floor(i / 4),
  ]);
  status = (
    await client.request("commit", {
      version: status,
      intent: {
        type: "room",
        buildingId: id,
        intent: { kind: "draw", floor: 1, cells },
      },
    })
  ).status;
  status = (
    await client.request("commit", {
      version: status,
      intent: {
        type: "connection",
        buildingId: id,
        intent: {
          action: "createStairs",
          floor: 0,
          x: 1,
          y: 1,
          direction: "east",
          length: 2,
        },
      },
    })
  ).status;
  const metadata = await client.read("interiorMetadata", { buildingId: id });
  const stairs = metadata.connections.find(
    (connection) => connection.type === "stairs",
  );
  expect(stairs).toMatchObject({
    type: "stairs",
    floor: 0,
    x: 1,
    y: 1,
    direction: "east",
    length: 2,
    offset: 0,
    toRoom: expect.any(String),
  });
  expect(metadata.status.revision).toBe(status.revision);
});

test("Rust returns no-op and removed connection response details", async () => {
  let status = await client.request("new", {});
  const created = await client.request("commit", {
    version: status,
    intent: {
      type: "createHouse",
      parcelId: null,
      transform: { x: 0, y: 0, angle: 0 },
      width: 2,
      depth: 2,
    },
  });
  status = created.status;
  const house = created.objects[0];
  if (house.kind !== "house") throw new Error("Expected house");
  const noop = await client.request("commit", {
    version: status,
    intent: { type: "rename", id: house.id, name: house.name },
  });
  expect(noop).toMatchObject({
    valid: true,
    changed: false,
    objects: [],
    removed: [],
    generationDiagnostics: [],
    removedConnections: [],
    generationSummary: { limited: false },
    generationLimit: null,
    status: { revision: status.revision },
  });
  const preview = await client.request("preview", {
    version: status,
    intent: { type: "delete", id: house.id },
  });
  expect(preview).toMatchObject({
    valid: true,
    changed: true,
    removed: [house.id],
    removedConnections: [
      {
        buildingId: house.id,
        connection: {
          type: "opening",
          kind: "door",
          offset: 0.5,
          toRoom: null,
        },
      },
    ],
  });
  const commit = await client.request("commit", {
    version: status,
    intent: { type: "delete", id: house.id },
  });
  expect(commit.removedConnections).toEqual(preview.removedConnections);
  expect(commit.status.revision).toBe(status.revision + 1);
});

test("Rust population preview reports skipped candidates and the limit", async () => {
  let status = await client.request("new", {});
  const createdRoad = await client.request("commit", {
    version: status,
    intent: {
      type: "createRoad",
      population: null,
      road: {
        name: "Long road",
        width: 10,
        material: "earth",
        nodes: [
          { point: [0, 0], incoming: null, outgoing: null },
          { point: [2000, 0], incoming: null, outgoing: null },
        ],
      },
    },
  });
  status = createdRoad.status;
  const roadId = createdRoad.objects[0].id;
  status = (
    await client.request("commit", {
      version: status,
      intent: {
        type: "createHouse",
        parcelId: null,
        transform: { x: 0, y: -20, angle: 0 },
        width: 2,
        depth: 2,
      },
    })
  ).status;
  const preview = await client.request("preview", {
    version: status,
    intent: {
      type: "populate",
      roadId,
      settings: {
        side: "both",
        setback: 5,
        gap: 0,
        minWidth: 1,
        maxWidth: 1,
        minDepth: 1,
        maxDepth: 1,
        seed: 1,
        parcelDepth: null,
      },
    },
  });
  expect(preview).toMatchObject({
    valid: true,
    changed: true,
    generationSummary: { limited: true },
    generationLimit: "boundParcels",
    removed: [roadId],
    removedConnections: [],
    status: { revision: status.revision },
  });
  if (!preview.valid) throw new Error(preview.reason);
  expect(preview.generationDiagnostics).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        point: expect.any(Array),
        target: "parcel",
        code: "parcelCollision",
        message: expect.any(String),
      }),
    ]),
  );
  expect(preview.objects.filter((o) => o.kind === "house")).toHaveLength(200);
  expect(preview.objects.filter((o) => o.kind === "parcel")).toHaveLength(200);
  expect(preview.objects.filter((o) => o.kind === "road")).toHaveLength(1);
  expect(preview.deletedIds).toEqual([]);
});
