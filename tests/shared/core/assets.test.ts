import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AssetCatalog,
  discoverPackAssets,
  PackAssetLibrary,
  readDungeondraftPack,
  type AssetCatalogStore,
  type BinarySource,
} from "../../../src/assets";
import {
  buildingWearAssetId,
  buildingWearMode,
  NATIVE_BUILDING_WEAR_IDS,
} from "../../../src/features/material/native-path-catalog";
import { parseDocument } from "../../../src/model";
import { Session } from "../../../src/session";
import { newDocument } from "./fixtures";
import { assetPack } from "./pack-fixtures";

test("native building wear is binary and older numeric maps retain their mode", () => {
  const enabled = newDocument("Wear on", 8, 8),
    disabled = newDocument("Wear off", 8, 8, undefined, {
      wallShadows: true,
      objectShadows: true,
      buildingWear: 0,
      nativeBuildingWear: false,
    });
  assert.equal(enabled.settings.nativeBuildingWear, true);
  assert.equal(
    parseDocument(JSON.stringify(disabled)).settings.nativeBuildingWear,
    false,
  );
  const old = {
    ...enabled,
    settings: {
      ...enabled.settings,
      nativeBuildingWear: undefined,
      buildingWear: 0.55,
    },
  };
  const parsed = parseDocument(JSON.stringify(old));
  assert.equal(parsed.settings.nativeBuildingWear, undefined);
  assert.equal(parsed.settings.buildingWear, 0.55);
  assert.throws(() =>
    parseDocument(
      JSON.stringify({
        ...enabled,
        settings: { ...enabled.settings, nativeBuildingWear: "off" },
      }),
    ),
  );
});

test("DD-008 five wear modes retain their identity through document and history", () => {
  const session = new Session(newDocument("Wear modes", 8, 8));
  assert.equal(buildingWearMode(session.settings), "grime");
  const beforeShadow = session.settings;
  session.execute({
    label: "Wall shadow",
    settings: {
      before: beforeShadow,
      after: { ...beforeShadow, wallShadows: false },
    },
  });
  for (const mode of ["none", "dust", "grime", "noise", "scratched"] as const) {
    session.setBuildingWearMode(mode);
    assert.equal(session.historySize, 1);
    const reopened = parseDocument(JSON.stringify(session.document()));
    assert.equal(buildingWearMode(reopened.settings), mode);
    assert.equal(reopened.settings.nativeBuildingWear, mode !== "none");
    assert.equal(
      buildingWearAssetId(reopened.settings),
      NATIVE_BUILDING_WEAR_IDS[mode === "none" ? "grime" : mode],
    );
  }
  session.undo();
  assert.equal(buildingWearMode(session.settings), "scratched");
  assert.equal(session.settings.wallShadows, true);
  session.redo();
  assert.equal(buildingWearMode(session.settings), "scratched");
  assert.equal(session.settings.wallShadows, false);
  const legacy = {
    ...session.settings,
    buildingWearMode: undefined,
    nativeBuildingWear: false,
  };
  assert.equal(buildingWearMode(legacy), "none");
  for (const invalid of ["", "wet", 0])
    assert.throws(() =>
      parseDocument(
        JSON.stringify({
          ...session.document(),
          settings: { ...session.settings, buildingWearMode: invalid },
        }),
      ),
    );
});

test("Dungeondraft packages keep image payloads lazy and expose stable assets", async () => {
  const blob = assetPack(),
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
    reads.every(([start, end]) => {
      const from = start ?? 0,
        to = end ?? blob.size;
      return to >= from && to - from < blob.size;
    }),
  );
  const image = new Uint8Array(
    await pack.asset(object.files.image!).arrayBuffer(),
  );
  assert.deepEqual([...image.slice(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
});

test("asset library discovers composite package classes and releases ownership", async () => {
  const library = new PackAssetLibrary();
  await library.add(assetPack());
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
  const store = new CatalogMemoryStore(),
    catalog = new AssetCatalog(store),
    [added] = await catalog.add([assetPack()]);
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
