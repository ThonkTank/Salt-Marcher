import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { AtlasCampaignManifestSave } from "../../src/features/atlas/atlas-campaign-save";
import { AtlasRepository } from "../../src/features/atlas/atlas-repository";
import {
  AtlasCampaignNavigation,
  type AtlasResolvedNavigation,
} from "../../src/features/atlas/atlas-campaign-navigation";
import {
  CitySource,
  cityDocumentChange,
} from "../../src/features/city/commands";
import { editCity } from "../../src/features/city/edit";
import { DungeonAtlasSource } from "../../src/features/dungeon/atlas-source";
import { AtlasRoomKeyDraft } from "../../src/features/dungeon/atlas-room-key-draft";
import { TerrainStroke } from "../../src/features/atlas/terrain-source";
import {
  CampaignRuntimeSource,
  CampaignRuntimeNavigationProvider,
  parseCampaignRuntimeManifest,
} from "../../src/features/campaign/campaign-runtime-source";
import { CampaignLifecycle } from "../../src/features/campaign/campaign-lifecycle";
import {
  campaignCommandId,
  campaignContextToken,
  campaignNamespace,
  campaignReceiptId,
} from "../../src/features/campaign/campaign-contracts";
import { campaignOwnershipDigestValue } from "../../src/features/campaign/campaign-ownership";
import { FileConflict, type FileStore } from "../../src/persistence";
import type { AtlasFileJournal } from "../../src/features/atlas/file-transaction";
import type { AtlasSpatialOptions } from "../../src/features/atlas/detail-owners";

const root = "tests/fixtures/atlas-e2e-spatial-v2/";
const fixture = JSON.parse(readFileSync(root + "manifest.json", "utf8"));
const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const sha = (text: string) =>
  "sha256:" + createHash("sha256").update(text).digest("hex");
const worldPath = fixture.input.find((f: any) => f.path.endsWith(".overworld"))
  .path as string;
const cityPath = fixture.input.find((f: any) => f.path.endsWith(".city"))
  .path as string;
const dungeonPath = fixture.input.find((f: any) => f.path.endsWith(".dungeon"))
  .path as string;
const campaignPath = fixture.campaign.path as string;
const inputManifest = readFileSync(
  root + fixture.campaign.input.fixtureFile,
  "utf8",
);
const expectedManifest = readFileSync(
  root + fixture.campaign.expected.fixtureFile,
  "utf8",
);
const expectedFiles = () =>
  new Map<string, string>(
    fixture.expected.map((f: any) => [
      f.path,
      readFileSync(root + f.fixtureFile, "utf8"),
    ]),
  );

class Store implements FileStore {
  readonly files = new Map<string, string>(
    fixture.input.map((f: any) => [
      f.path,
      readFileSync(root + f.fixtureFile, "utf8"),
    ]),
  );
  readonly writes: string[] = [];
  readonly journals: AtlasFileJournal[] = [];
  readHook?: (path: string) => void;
  fault?: (path: string, after: string | null) => boolean;
  offline = false;
  constructor() {
    this.files.set(campaignPath, inputManifest);
  }
  async read(path: string) {
    this.readHook?.(path);
    return this.files.get(path) ?? null;
  }
  async compareAndWrite(
    path: string,
    before: string | null,
    after: string | null,
  ) {
    if (this.offline) throw new Error("process stopped");
    if ((this.files.get(path) ?? null) !== before) throw new FileConflict(path);
    if (this.fault?.(path, after)) {
      this.offline = true;
      throw new Error("interruption");
    }
    this.writes.push(path);
    if (after === null) this.files.delete(path);
    else this.files.set(path, after);
    if (path === worldPath + ".journal" && after !== null)
      this.journals.push(JSON.parse(after));
  }
}
function adapter(store: Store) {
  return new AtlasCampaignManifestSave(
    campaignPath,
    store.files.get(campaignPath)!,
    sha,
  );
}
function options(store: Store, campaign = adapter(store)): AtlasSpatialOptions {
  return {
    locations: true,
    details: true,
    campaignSave: campaign,
    resolveLocation: async (id) =>
      [...store.files].find(
        ([p, b]) => p.endsWith(".location") && JSON.parse(b).id === id,
      )![0],
    resolveDetail: async (_world, kind, id) =>
      [...store.files]
        .filter(([p, b]) => p.endsWith("." + kind) && JSON.parse(b).id === id)
        .map(([p]) => p),
  };
}
async function opened(store = new Store()) {
  const repo = new AtlasRepository(store, worldPath, store, options(store)),
    source = await repo.open();
  const city = repo.detail("city", id(100)),
    dungeon = repo.detail("dungeon", id(30));
  assert.ok(city instanceof CitySource);
  assert.ok(dungeon instanceof DungeonAtlasSource);
  return { store, repo, source, city, dungeon };
}
function edit(f: Awaited<ReturnType<typeof opened>>) {
  const city = f.city.read();
  f.source.history.execute({
    label: "Haus verschieben",
    changes: [
      cityDocumentChange(
        city,
        editCity(city, [
          {
            kind: "set-building-pose",
            buildingId: id(105),
            position: fixture.oracle.expectedPosition,
            rotationRadians: 0,
            scale: { x: 1, y: 1 },
          },
        ]),
      ),
    ],
  });
  const key = new AtlasRoomKeyDraft(f.dungeon, id(31));
  key.markdown.set(id(34), fixture.oracle.roomText);
  assert.equal(key.apply(), true);
}
function exactSaved(store: Store) {
  for (const [path, bytes] of expectedFiles())
    assert.equal(store.files.get(path), bytes, path);
  assert.equal(store.files.get(campaignPath), expectedManifest);
  assert.equal(store.files.has(worldPath + ".journal"), false);
  assert.equal(store.files.has(worldPath + ".draft"), false);
}
async function freshNavigation(store: Store) {
  const source = new CampaignRuntimeSource(
    {
      list: async () => [
        { path: campaignPath, bytes: store.files.get(campaignPath)! },
      ],
    },
    sha,
  );
  const manifest = parseCampaignRuntimeManifest(
    store.files.get(campaignPath)!,
    sha,
  );
  const lifecycle = new CampaignLifecycle(source.lifecycle, {
    campaignId: () => manifest.snapshot.campaignId,
    namespace: () => campaignNamespace(id(2)),
    contextToken: () => campaignContextToken("fresh:" + crypto.randomUUID()),
    receiptId: () => campaignReceiptId(id(990)),
  });
  const provider = new CampaignRuntimeNavigationProvider(source, lifecycle);
  await provider.activate(
    campaignCommandId(id(991)),
    manifest.snapshot.campaignId,
    "open",
  );
  let focus: AtlasResolvedNavigation | undefined;
  const navigation = new AtlasCampaignNavigation({
    currentContext: provider.currentContext,
    registry: provider.registry,
    inventory: provider.inventory,
    activate: (command, cid, kind) => provider.activate(command, cid, kind),
    openNative: async (input) => {
      const repo = new AtlasRepository(store, worldPath, store, {
        ...options(store),
        assertCurrent: input.assertCurrent,
      });
      await repo.open();
      return {
        repository: repo,
        renderer: Object.freeze({}),
        setInputBlocked: () => {},
        prepareNavigation: async (guard) => {
          guard();
        },
        prepareLeave: async (guard) => {
          guard();
          await repo.persistDraft();
          guard();
        },
        navigate: (target, guard) => {
          guard();
          focus = target;
        },
        resume: (guard) => {
          guard();
        },
        suspend: () => "recoverable",
        dispose: () => {},
      };
    },
  });
  await navigation.open(provider.currentContext()!, manifest.atlas.worldId);
  const state = navigation.state;
  assert.equal(state.kind, "active");
  const capture = await state.repository.captureNative({
    worldId: state.inventory.worldId,
    assertCurrent: state.assertCurrent,
  });
  const room = state.inventory.records.find((r) => r.kind === "room")!,
    owner = state.projection.owners.find((o) => o.ownerId === room.ownerId)!;
  await navigation.navigate({
    context: state.context,
    worldId: state.inventory.worldId,
    mountGeneration: state.generation,
    registryRevision: state.projection.registryRevision,
    projectionDigest: state.projection.projectionDigest,
    ownerId: owner.ownerId,
    ownerRevision: owner.ownerRevision,
    sourceGeneration: owner.source.generation,
    sourceDigest: capture.sourceDigest,
    basis: capture.basis,
    target: {
      kind: "room",
      documentId: room.documentId,
      recordId: room.id,
      roomId: null,
    },
  });
  assert.equal(focus?.target.recordId, id(31));
  assert.equal(focus?.key?.kind, "room");
  assert.equal(state.history, state.repository.terrainSource.history);
  provider.close();
  source.close();
  return state.repository;
}

test("Campaign + seven native files use one journal and fresh real provider/navigation accepts the exact owner fixture", async () => {
  const f = await opened(),
    history = f.source.history;
  edit(f);
  history.undo();
  history.redo();
  await f.repo.save();
  exactSaved(f.store);
  assert.equal(f.source.history, history);
  assert.equal(history.undoDepth, 2);
  const canonical = f.store.journals.filter(
    (j) =>
      j.state === "prepared" && j.writes.some((w) => w.path === campaignPath),
  );
  assert.equal(canonical.length, 1);
  assert.deepEqual(
    new Set(canonical[0]!.writes.map((w) => w.path)),
    new Set([cityPath, dungeonPath, worldPath + ".draft", campaignPath]),
  );
  const fresh = await freshNavigation(f.store);
  assert.notEqual(fresh, f.repo);
  assert.notEqual(fresh.terrainSource.history, history);
  assert.equal(fresh.dirty, false);
  assert.equal(fresh.hasDraft, false);
  history.undo();
  history.undo();
  await f.repo.save();
  history.redo();
  history.redo();
  await f.repo.save();
  exactSaved(f.store);
});

test("Campaign no-op guards the complete basis without manufacturing revisions or writes", async () => {
  const f = await opened();
  await f.repo.save();
  assert.equal(f.store.files.get(campaignPath), inputManifest);
  assert.deepEqual(f.store.writes, []);
});

test("Terrain-only save changes the World owner proof and reopens through the real provider", async () => {
  const f = await opened(),
    before = parseCampaignRuntimeManifest(inputManifest, sha);
  await f.source.ensure([{ q: 0, r: 0 }]);
  const stroke = new TerrainStroke(f.source, "forest");
  stroke.add({ q: 0, r: 0 });
  assert.equal(stroke.finish(), true);
  await f.repo.save();
  const after = parseCampaignRuntimeManifest(
    f.store.files.get(campaignPath)!,
    sha,
  );
  assert.notEqual(
    after.registry.owners[0]!.ownerRevision,
    before.registry.owners[0]!.ownerRevision,
  );
  assert.deepEqual(
    after.registry.owners.slice(1),
    before.registry.owners.slice(1),
  );
  assert.equal(
    f.store.files.get(worldPath),
    readFileSync(root + fixture.input[0].fixtureFile, "utf8"),
  );
  const fresh = await freshNavigation(f.store);
  assert.equal(fresh.dirty, false);
});

test("Unloaded unchanged terrain remains guarded before the common canonical publish", async () => {
  const f = await opened();
  edit(f);
  const terrainPath = fixture.input.find((r: any) =>
    r.path.includes("terrain/"),
  ).path as string;
  const beforeTerrain = f.store.files.get(terrainPath)!;
  let reads = 0;
  f.store.readHook = (path) => {
    if (path === terrainPath && ++reads === 2)
      f.store.files.set(path, beforeTerrain + "\n");
  };
  await assert.rejects(f.repo.save(), FileConflict);
  assert.equal(f.store.files.get(campaignPath), inputManifest);
  assert.equal(
    f.store.files.get(cityPath),
    readFileSync(
      root + fixture.input.find((r: any) => r.path === cityPath).fixtureFile,
      "utf8",
    ),
  );
  assert.equal(f.store.files.get(terrainPath), beforeTerrain + "\n");
  assert.equal(f.repo.hasDraft, true);
  assert.equal(
    f.store.journals.some((j) => j.writes.some((w) => w.path === campaignPath)),
    false,
  );
});

test("A foreign manifest never becomes the baseline of the common save", async () => {
  const f = await opened();
  edit(f);
  f.store.files.set(campaignPath, inputManifest + "\n");
  await assert.rejects(f.repo.save(), FileConflict);
  assert.equal(f.store.files.get(campaignPath), inputManifest + "\n");
  assert.equal(
    f.store.files.get(cityPath),
    readFileSync(
      root + fixture.input.find((r: any) => r.path === cityPath).fixtureFile,
      "utf8",
    ),
  );
  assert.equal(f.repo.hasDraft, true);
});

test("Prepared common journal rolls back native/manifest bytes and retains the complete draft for retry", async () => {
  const f = await opened();
  edit(f);
  f.store.fault = (path) => path === campaignPath;
  await assert.rejects(f.repo.save(), AggregateError);
  assert.equal(
    JSON.parse(f.store.files.get(worldPath + ".journal")!).state,
    "prepared",
  );
  assert.equal(f.store.files.get(campaignPath), inputManifest);
  f.store.offline = false;
  f.store.fault = undefined;
  const fresh = await opened(f.store);
  assert.equal(fresh.repo.dirty, true);
  assert.equal(fresh.repo.hasDraft, true);
  assert.equal(f.store.files.get(campaignPath), inputManifest);
  for (const row of fixture.input)
    assert.equal(
      f.store.files.get(row.path),
      readFileSync(root + row.fixtureFile, "utf8"),
    );
  await fresh.repo.save();
  exactSaved(f.store);
  await freshNavigation(f.store);
});

test("Committed reply loss retains the one won common journal and fresh recovery acknowledges it once", async () => {
  const f = await opened();
  edit(f);
  f.store.fault = (path, after) =>
    path === worldPath + ".journal" &&
    after === null &&
    f.store.files.get(campaignPath) === expectedManifest;
  await assert.rejects(f.repo.save(), AggregateError);
  assert.equal(
    JSON.parse(f.store.files.get(worldPath + ".journal")!).state,
    "committed",
  );
  assert.equal(f.store.files.get(campaignPath), expectedManifest);
  f.store.offline = false;
  f.store.fault = undefined;
  const fresh = await opened(f.store);
  exactSaved(f.store);
  assert.equal(fresh.repo.dirty, false);
  await fresh.repo.save();
  exactSaved(f.store);
  await freshNavigation(f.store);
});

test("Foreign unchanged terrain blocks common-journal recovery without losing either evidence or external bytes", async () => {
  const f = await opened();
  edit(f);
  f.store.fault = (path) => path === campaignPath;
  await assert.rejects(f.repo.save(), AggregateError);
  f.store.offline = false;
  f.store.fault = undefined;
  const terrain = fixture.input.find((r: any) => r.path.includes("terrain/"))
    .path as string;
  f.store.files.set(terrain, f.store.files.get(terrain)! + "\n");
  const before = [...f.store.files],
    writes = f.store.writes.length;
  await assert.rejects(opened(f.store), /Guards/);
  assert.deepEqual([...f.store.files], before);
  assert.equal(f.store.writes.length, writes);
});

test("Hex co-validation rejects the wrong World-draft path even when its suffix looks valid", async () => {
  const f = await opened();
  edit(f);
  await f.repo.persistDraft();
  const capture = await f.repo.captureNative({ worldId: id(10) });
  assert.throws(
    () =>
      adapter(f.store).prepare(capture.files, {
        path: "Atlanten/Fremd.overworld.draft",
        before: f.store.files.get(worldPath + ".draft")!,
        after: null,
      }),
    /World-Draftpfad/,
  );
});

test("A schema-valid forged record proof cannot authorize a native save", async () => {
  const store = new Store(),
    value = JSON.parse(inputManifest);
  value.registry.owners[0].records[0].payloadDigest = sha("forged");
  const { registryContentDigest: _, ...unsigned } = value.registry;
  value.registry.registryContentDigest = campaignOwnershipDigestValue(
    unsigned,
    sha,
  );
  store.files.set(campaignPath, JSON.stringify(value));
  const f = await opened(store);
  edit(f);
  await assert.rejects(f.repo.save(), /Before-Ownerbelege/);
  assert.equal(f.store.files.get(campaignPath), JSON.stringify(value));
  assert.equal(f.repo.hasDraft, true);
});
