import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { isRoom, parseDocument } from "../../src/model";
import { Session } from "../../src/session";
import { createDoor, createObject, createLight, createPortal, createWall, duplicateFloor, resizeMap, createReferenceImage, editNote } from "../../src/commands";
import { AssetCatalog, discoverPackAssets, PackAssetLibrary, readDungeondraftPack, type AssetCatalogStore, type BinarySource } from "../../src/assets";
import { generateLayout } from "../../src/generators";
import { newDocument, fixture } from "./fixtures";
import { buildingWearMode, buildingWearAssetId,
  NATIVE_BUILDING_WEAR_IDS } from "../../src/features/material/native-path-catalog";

test("native building wear is binary and older numeric maps retain their mode", () => {
  const enabled = newDocument("Wear on", 8, 8),
    disabled = newDocument("Wear off", 8, 8, undefined, {
      wallShadows: true, objectShadows: true, buildingWear: 0,
      nativeBuildingWear: false,
    });
  assert.equal(enabled.settings.nativeBuildingWear, true);
  assert.equal(parseDocument(JSON.stringify(disabled)).settings.nativeBuildingWear,
    false);
  const old = { ...enabled, settings: { ...enabled.settings,
    nativeBuildingWear: undefined, buildingWear: 0.55 } };
  const parsed = parseDocument(JSON.stringify(old));
  assert.equal(parsed.settings.nativeBuildingWear, undefined);
  assert.equal(parsed.settings.buildingWear, 0.55);
  assert.throws(() => parseDocument(JSON.stringify({ ...enabled,
    settings: { ...enabled.settings, nativeBuildingWear: "off" } })));
});

test("DD-008 five wear modes retain their identity through document and history", () => {
  const session = new Session(newDocument("Wear modes", 8, 8));
  assert.equal(buildingWearMode(session.settings), "grime");
  const beforeShadow = session.settings;
  session.execute({ label: "Wall shadow", settings: { before: beforeShadow,
    after: { ...beforeShadow, wallShadows: false } } });
  for (const mode of ["none", "dust", "grime", "noise", "scratched"] as const) {
    session.setBuildingWearMode(mode);
    assert.equal(session.historySize, 1);
    const reopened = parseDocument(JSON.stringify(session.document()));
    assert.equal(buildingWearMode(reopened.settings), mode);
    assert.equal(reopened.settings.nativeBuildingWear, mode !== "none");
    assert.equal(buildingWearAssetId(reopened.settings),
      NATIVE_BUILDING_WEAR_IDS[mode === "none" ? "grime" : mode]);
  }
  session.undo();
  assert.equal(buildingWearMode(session.settings), "scratched");
  assert.equal(session.settings.wallShadows, true);
  session.redo();
  assert.equal(buildingWearMode(session.settings), "scratched");
  assert.equal(session.settings.wallShadows, false);
  const legacy = { ...session.settings,
    buildingWearMode: undefined, nativeBuildingWear: false };
  assert.equal(buildingWearMode(legacy), "none");
  for (const invalid of ["", "wet", 0])
    assert.throws(() => parseDocument(JSON.stringify({ ...session.document(),
      settings: { ...session.settings, buildingWearMode: invalid } })));
});


test("Dungeondraft packages keep image payloads lazy and expose stable assets", async () => {
  const bytes = await readFile(
      "../dungeon-auswertung/tests/fixtures/own-asset-pack/own.dungeondraft_pack",
    ),
    blob = new Blob([bytes]),
    reads: [number | undefined, number | undefined][] = [],
    source = {
      size: blob.size,
      slice(start?: number, end?: number) {
        reads.push([start, end]);
        return blob.slice(start, end);
      },
    },
    pack = await readDungeondraftPack(source),
    assets = await discoverPackAssets(pack),
    object = assets.find((asset) => asset.kind === "object");
  assert.equal(pack.allowed, true);
  assert.ok(object);
  assert.equal(object.packId, pack.metadata.id);
  assert.match(object.id, /^pack:/);
  assert.ok(
    reads.every(([start, end]) => (end ?? 0) - (start ?? 0) < bytes.length),
  );
  const image = new Uint8Array(
    await pack.asset(object.files.image!).arrayBuffer(),
  );
  assert.deepEqual([...image.slice(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
});

test("asset library discovers composite package classes and releases ownership", async () => {
  const files = [
      "../dungeon-auswertung/tests/fixtures/wall-texture-probe/own-walls.dungeondraft_pack",
      "../dungeon-auswertung/tests/fixtures/surface-parts/own-surfaces.dungeondraft_pack",
      "../dungeon-auswertung/tests/fixtures/roof-resize-probe/own-roofs.dungeondraft_pack",
    ],
    library = new PackAssetLibrary();
  for (const file of files) {
    const bytes = await readFile(file);
    await library.add(new Blob([bytes]));
  }
  assert.ok(library.list("wall").length > 0);
  assert.ok(library.list("roof").length > 0);
  assert.ok(library.list("material").length > 0);
  assert.ok(library.list("cave").length > 0);
  const wall = library.list("wall")[0]!;
  assert.ok(library.blob(wall.id, "image").size > 0);
  assert.ok(library.list(undefined, wall.name.slice(0, 2)).includes(wall));
  library.close();
  assert.deepEqual(library.list(), []);
});

test("asset package parser rejects malformed containers", async () => {
  await assert.rejects(
    () => readDungeondraftPack(new Blob([new Uint8Array(128)])),
    /Paketcontainer/,
  );
});

test("asset catalog persists package selection and reloads enabled packages", async () => {
  class CatalogMemoryStore implements AssetCatalogStore {
    catalog: string | null = null;
    packages = new Map<string, Blob>();
    async readCatalog() {
      return this.catalog;
    }
    async writeCatalog(text: string) {
      this.catalog = text;
    }
    async writePackage(hash: string, source: BinarySource) {
      if (!this.packages.has(hash))
        this.packages.set(hash, source.slice(0, source.size));
    }
    async readPackage(hash: string) {
      const source = this.packages.get(hash);
      if (!source) throw new Error("missing package");
      return source;
    }
    async removePackage(hash: string) {
      this.packages.delete(hash);
    }
  }
  const bytes = await readFile(
      "../dungeon-auswertung/tests/fixtures/own-asset-pack/own.dungeondraft_pack",
    ),
    store = new CatalogMemoryStore(),
    catalog = new AssetCatalog(store),
    [added] = await catalog.add([new Blob([bytes])]);
  assert.ok(added);
  assert.equal((await catalog.read()).packs[0]!.assetCount > 0, true);
  let library = await catalog.loadEnabled();
  assert.ok(library.list("object").length > 0);
  library.close();
  await catalog.setEnabled(added.metadata.id, false);
  await catalog.setBuiltIns(false);
  library = await catalog.loadEnabled();
  assert.equal(library.list().length, 0);
  library.close();
  assert.equal((await catalog.read()).builtIns, false);
  await catalog.remove(added.metadata.id);
  assert.equal((await catalog.read()).packs.length, 0);
  assert.equal(store.packages.size, 0);
});

test("map-specific asset selection is validated and follows ordinary undo", () => {
  const document = newDocument("Assetkarte", 20, 20, {
      assetPacks: ["pack-a"],
      builtInAssets: true,
    }),
    session = new Session(document),
    before = session.settings,
    after = {
      ...before,
      assetPacks: ["pack-a", "pack-b"],
      builtInAssets: false,
    };
  session.execute({
    label: "Kartenassets ändern",
    settings: { before, after },
  });
  assert.deepEqual(session.settings.assetPacks, ["pack-a", "pack-b"]);
  assert.equal(session.settings.builtInAssets, false);
  session.undo();
  assert.deepEqual(session.settings, before);
  session.redo();
  assert.deepEqual(session.settings, after);
  assert.throws(
    () =>
      session.execute({
        label: "Ungültige Kartenassets",
        settings: {
          before: after,
          after: { ...after, assetPacks: ["pack-a", "pack-a"] },
        },
      }),
    /Karteneinstellungen/,
  );
});

test("floor duplication remaps topology and copies protected room text in one undo", () => {
  const { s, floor, room } = fixture(),
    beforeText = s.note(room.note!.path)! + "**Unveränderter  Wortlaut.**\n";
  editNote(s, room.note!.path, s.note(room.note!.path)!, beforeText);
  const door = createDoor(s, room, 0, 0.5),
    object = createObject(s, floor, { x: 5, y: 5 });
  const history = s.historySize,
    copiedFloor = duplicateFloor(s, floor),
    copies = [...s.entities.values()].filter(
      (entity) => entity.floorId === copiedFloor.id,
    ),
    copiedRoom = copies.find(isRoom)!,
    copiedDoor = copies.find((entity) => entity.kind === "door")!,
    copiedObject = copies.find((entity) => entity.kind === "object")!;
  assert.equal(s.historySize, history + 1);
  assert.equal(copies.length, 3);
  assert.notEqual(copiedRoom.id, room.id);
  assert.equal(copiedDoor.kind, "door");
  assert.equal(copiedDoor.anchor?.boundaryId, copiedRoom.id);
  assert.equal(copiedDoor.note?.path, copiedRoom.note!.path);
  assert.equal(copiedObject.kind, "object");
  assert.equal(copiedObject.roomId, copiedRoom.id);
  const copiedText = s.note(copiedRoom.note!.path)!;
  assert.match(copiedText, /\*\*Unveränderter  Wortlaut\.\*\*/);
  assert.match(copiedText, new RegExp('room_id: "' + copiedRoom.id + '"'));
  assert.match(copiedText, new RegExp("\\^durchgang-" + copiedDoor.id));
  assert.ok(!copiedText.includes("^durchgang-" + door.id));
  s.undo();
  assert.ok(!s.floors.has(copiedFloor.id));
  assert.ok(copies.every((entity) => !s.entities.has(entity.id)));
  assert.equal(s.note(copiedRoom.note!.path), null);
  assert.ok(s.entities.has(object.id));
});

test("map margins translate all geometry together and restore exactly with undo", () => {
  const { s, floor, room } = fixture(),
    door = createDoor(s, room, 0, 0.5),
    object = createObject(s, floor, { x: 5, y: 5 }),
    wall = createWall(
      s,
      floor,
      [
        { x: 20, y: 20 },
        { x: 24, y: 20 },
      ],
      false,
    ),
    storedDoor = s.entities.get(door.id),
    before = s.document(),
    history = s.historySize;
  resizeMap(
    s,
    { left: 3, right: -5, top: 2, bottom: 4 },
    { wallShadows: false, objectShadows: false, buildingWear: 0.55 },
  );
  assert.equal(s.historySize, history + 1);
  assert.equal(s.settings.width, 78);
  assert.equal(s.settings.height, 66);
  assert.equal(s.settings.wallShadows, false);
  assert.equal(s.settings.objectShadows, false);
  assert.equal(s.settings.buildingWear, 0.55);
  assert.deepEqual(
    (s.entities.get(room.id) as typeof room).polygons[0]!.outer[0],
    {
    x: 5,
    y: 4,
    },
  );
  assert.deepEqual(
    {
      x: (s.entities.get(object.id) as typeof object).x,
      y: (s.entities.get(object.id) as typeof object).y,
    },
    { x: 8, y: 7 },
  );
  assert.deepEqual((s.entities.get(wall.id) as typeof wall).points[0], {
    x: 23,
    y: 22,
  });
  assert.equal(s.entities.get(door.id), storedDoor);
  s.undo();
  assert.deepEqual(s.document(), before);
  s.redo();
  assert.equal(s.settings.width, 78);
  assert.equal(s.settings.buildingWear, 0.55);
  assert.throws(
    () => resizeMap(s, { left: 0.5, right: 0, top: 0, bottom: 0 }),
    /ganzen Feldern/,
  );
  assert.throws(
    () => resizeMap(s, { left: -100, right: 0, top: 0, bottom: 0 }),
    /Kartengröße/,
  );
});

test("reference images align per floor and participate in ordinary history", () => {
  const { s, floor } = fixture(),
    image = createReferenceImage(
      s,
      floor,
      ".obsidian/dungeon-editor-assets/references/test.png",
      "Skizze.png",
      1600,
      900,
    );
  assert.equal(image.kind, "reference");
  assert.equal(image.x, 40);
  assert.equal(image.y, 30);
  assert.equal(image.width, 64);
  assert.equal(image.height, 36);
  assert.equal(image.opacity, 0.45);
  resizeMap(s, { left: 2, right: 0, top: 3, bottom: 0 });
  const moved = s.entities.get(image.id);
  assert.equal(moved?.kind, "reference");
  if (moved?.kind === "reference") {
    assert.equal(moved.x, 42);
    assert.equal(moved.y, 33);
  }
  s.undo();
  assert.deepEqual(s.entities.get(image.id), image);
  s.undo();
  assert.equal(s.entities.has(image.id), false);
});

test("dungeon and cave generation are deterministic replaceable proposals", () => {
  const a = fixture(),
    first = generateLayout(a.s, a.floor, {
      kind: "dungeon",
      seed: 42,
      amount: 9,
    }),
    firstShape = first.map((entity) => {
      const { id: _id, floorId: _floorId, ...stable } = entity;
      return stable;
    }),
    b = fixture(),
    second = generateLayout(b.s, b.floor, {
      kind: "dungeon",
      seed: 42,
      amount: 9,
    });
  assert.deepEqual(
    second.map((entity) => {
      const { id: _id, floorId: _floorId, ...stable } = entity;
      return stable;
    }),
    firstShape,
  );
  const history = a.s.historySize,
    cave = generateLayout(
      a.s,
      a.floor,
      { kind: "cave", seed: 7, amount: 18 },
      first.map((entity) => entity.id),
    );
  assert.equal(a.s.historySize, history + 1);
  assert.equal(cave.length, 1);
  assert.equal(cave[0]?.kind, "surface");
  assert.ok(first.every((entity) => !a.s.entities.has(entity.id)));
  a.s.undo();
  assert.ok(first.every((entity) => a.s.entities.has(entity.id)));
  assert.ok(cave.every((entity) => !a.s.entities.has(entity.id)));
  assert.throws(
    () => generateLayout(a.s, a.floor, { kind: "cave", seed: 1.5, amount: 8 }),
    /Generatorwerte/,
  );
});

test("package walls, portals and lights keep stable model references", () => {
  const { s, floor, room } = fixture(),
    texturedRoom = {
      ...room,
      wallAssetId: "pack:test:wall:room",
    },
    wall = createWall(
      s,
      floor,
      [
        { x: 20, y: 2 },
        { x: 30, y: 2 },
      ],
      false,
      false,
      0.3,
      "pack:test:wall:free",
    );
  s.execute({
    label: "Paketwand anwenden",
    entities: [{ id: room.id, before: room, after: texturedRoom }],
  });
  const portal = createPortal(
      s,
      floor,
      { boundary: wall, anchor: { contour: 0, at: 0.5 } },
      {
        variant: "window",
        width: 2,
        blocksLight: true,
        assetId: "pack:test:portal:window",
      },
    ),
    light = createLight(
      s,
      floor,
      { x: 12, y: 20 },
      {
        radius: 8,
        intensity: 1,
        color: 0xffffff,
        shadows: true,
        assetId: "pack:test:light:glow",
      },
    );
  assert.equal(
    (s.entities.get(room.id) as typeof texturedRoom).wallAssetId,
    texturedRoom.wallAssetId,
  );
  assert.equal(wall.assetId, "pack:test:wall:free");
  assert.equal(portal.assetId, "pack:test:portal:window");
  assert.equal(light.assetId, "pack:test:light:glow");
  assert.throws(
    () =>
      s.execute({
        label: "Ungültiges Paketlicht",
        entities: [
          {
            id: light.id,
            before: light,
            after: { ...light, assetId: "vault.png" },
          },
        ],
      }),
    /Paketasset/,
  );
});
