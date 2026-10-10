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
  type CampaignRuntimeStorageChange,
} from "../../src/features/campaign/campaign-runtime-source";
import { CampaignLifecycle } from "../../src/features/campaign/campaign-lifecycle";
import {
  campaignCommandId,
  campaignLocalId,
  campaignContextToken,
  campaignNamespace,
  campaignReceiptId,
} from "../../src/features/campaign/campaign-contracts";
import { campaignOwnershipDigestValue } from "../../src/features/campaign/campaign-ownership";
import { FileConflict, type FileStore } from "../../src/persistence";
import { FileTransaction, type AtlasFileJournal } from "../../src/features/atlas/file-transaction";
import type { AtlasSpatialOptions } from "../../src/features/atlas/detail-owners";
import { newLocationPath } from "../../src/features/atlas/location-owners";
import { parseLocationDocument } from "../../src/features/location/location-schema";
import { locationDocumentChange } from "../../src/features/location/location-source";
import { spatialChange } from "../../src/features/atlas/spatial-schema";
import { atlasCampaignServices } from "../../src/ui/atlas-campaign-services";
import {
  changeWorldNotes,
  emptyWorldNotes,
  serializeWorldNote,
} from "../../src/features/world/world-notes";
import { worldNotePath } from "../../src/features/campaign/world-notes-commit";

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
  failOnce?: string;
  manifestChanged?: (change: CampaignRuntimeStorageChange) => void;
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
    if (this.failOnce === path) {
      this.failOnce = undefined;
      throw new Error("first native CAS failed");
    }
    if (this.fault?.(path, after)) {
      this.offline = true;
      throw new Error("interruption");
    }
    this.writes.push(path);
    if (after === null) this.files.delete(path);
    else this.files.set(path, after);
    if (path === campaignPath && after !== null)
      this.manifestChanged?.({ kind: "modify", path, bytes: after });
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
      )?.[0] ?? newLocationPath(id),
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

test("World Notes save acknowledgment retains the active Campaign Context through the manifest event", async () => {
  const f = await liveNavigation(), context = f.services.provider.currentContext()!;
  let current = true;
  const before = emptyWorldNotes(context), noteId = campaignLocalId(id(945)),
    change = { kind: "create" as const, id: noteId,
      draft: { kind: "rumor" as const, title: "Die Hafenglocke", readAloud: "Drei Schläge.",
        gmNotes: "Nur bei Nebel.", relations: [], creatureId: null } },
    after = changeWorldNotes(before, context, context, before.revision, change),
    participant = await f.services.createWorldNotesSave!({
      context,
      assertCurrent: () => {
        if (!current) throw new Error("World-Save wurde widerrufen.");
      },
    }),
    notePath = worldNotePath(context.namespace, "rumor", noteId),
    prepared = participant.prepare({
      commandId: campaignCommandId(id(946)),
      context,
      beforeSnapshot: before,
      afterSnapshot: after,
      change,
      nativeWrites: [{ path: notePath, before: null, after: serializeWorldNote(after.records[0]!) }],
    }),
    transaction = new FileTransaction(
      f.store,
      worldPath + ".journal",
      (path) => prepared.writes.some((write) => write.path === path),
      f.store,
      (journal) => participant.validateRecovery(journal),
    );
  let receipt;
  await transaction.commit(prepared.writes, participant.transactionObserver(
    prepared,
    transaction,
    (value) => { receipt = value; },
  ));
  assert.ok(receipt);
  participant.validateReceipt(receipt);
  assert.deepEqual(f.services.provider.currentContext(), context);
  assert.equal(f.navigation.state.kind, "active");
  assert.equal(f.store.files.get(notePath), serializeWorldNote(after.records[0]!));
  assert.ok(parseCampaignRuntimeManifest(f.store.files.get(campaignPath)!, sha)
    .registry.owners.some((owner) => owner.ownerId === "world-notes"));
  current = false;
  f.services.close();
});

test("World Notes prepared acknowledgment cancels cleanly after FileTransaction rollback", async () => {
  const f = await liveNavigation(), context = f.services.provider.currentContext()!,
    beforeManifest = f.store.files.get(campaignPath)!,
    before = emptyWorldNotes(context), noteId = campaignLocalId(id(947)),
    change = { kind: "create" as const, id: noteId,
      draft: { kind: "quest" as const, title: "Das verlorene Licht", readAloud: "", gmNotes: "",
        relations: [], creatureId: null } },
    after = changeWorldNotes(before, context, context, before.revision, change),
    participant = await f.services.createWorldNotesSave!({ context, assertCurrent: () => {} }),
    notePath = worldNotePath(context.namespace, "quest", noteId),
    prepared = participant.prepare({
      commandId: campaignCommandId(id(948)), context, beforeSnapshot: before,
      afterSnapshot: after, change,
      nativeWrites: [{ path: notePath, before: null, after: serializeWorldNote(after.records[0]!) }],
    }),
    transaction = new FileTransaction(
      f.store, worldPath + ".journal",
      (path) => prepared.writes.some((write) => write.path === path),
      f.store, (journal) => participant.validateRecovery(journal),
    );
  f.store.failOnce = notePath;
  await assert.rejects(transaction.commit(prepared.writes, participant.transactionObserver(
    prepared, transaction, () => { throw new Error("Rollback darf kein Receipt ausstellen."); },
  )), /first native CAS failed/);
  assert.deepEqual(f.services.provider.currentContext(), context);
  assert.equal(f.navigation.state.kind, "active");
  assert.equal(f.store.files.get(campaignPath), beforeManifest);
  assert.equal(f.store.files.has(notePath), false);
  assert.equal(f.store.files.has(worldPath + ".journal"), false);
  const rolledBackJournal = f.store.journals.at(-1)!;
  assert.throws(() => participant.createReceipt(prepared, {
    ...rolledBackJournal,
    state: "committed",
  }), /bereits verbraucht/);
  f.services.close();
});

test("Atlas save preserves an unrelated World Notes owner without claiming its authority", async () => {
  const store = new Store(), before = parseCampaignRuntimeManifest(inputManifest, sha),
    policyRevision = "policy:world-notes:v1",
    foreign = {
      ownerId: "world-notes",
      ownerRevision: "owner:world-notes-empty",
      schemaRevision: "schema:world-notes:v1",
      snapshotRevision: "snapshot:world-notes-empty",
      policyRevision,
      policyDigest: campaignOwnershipDigestValue(
        { ownerId: "world-notes", policyRevision, transferPolicies: [] },
        sha,
      ),
      availability: "confirmed" as const,
      emptyConfirmed: true,
      referenceSchemas: ["catalog-entry.v1", "world-notes.v1"],
      source: { adapterType: "native-world-notes", generation: "source:world-notes-empty" },
      records: [],
      transferPolicies: [],
    },
    owners = [...before.registry.owners, foreign].sort((a, b) => a.ownerId.localeCompare(b.ownerId)),
    unsigned = {
      version: before.registry.version,
      registryId: before.registry.registryId,
      registryRevision: "registry:world-notes-empty",
      campaignId: before.registry.campaignId,
      campaignRevision: before.registry.campaignRevision,
      namespace: before.registry.namespace,
      owners,
    },
    extended = JSON.stringify({ ...before, registry: {
      ...unsigned,
      registryContentDigest: campaignOwnershipDigestValue(unsigned, sha),
    } }, null, 2) + "\n";
  parseCampaignRuntimeManifest(extended, sha);
  store.files.set(campaignPath, extended);
  const f = await opened(store);
  edit(f);
  await f.repo.save();
  const saved = parseCampaignRuntimeManifest(store.files.get(campaignPath)!, sha);
  assert.deepEqual(
    saved.registry.owners.find((owner) => owner.ownerId === "world-notes"),
    foreign,
  );
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

// Reuse the immutable native H01 failure's actual created/edited/moved payload.
const createdLocation = JSON.parse(
  readFileSync(
    "docs/reference/atlas-shared-location-h01/raw/02-created.json",
    "utf8",
  ),
);
const movedLocation = JSON.parse(
  readFileSync(
    "docs/reference/atlas-shared-location-h01/raw/04-marker-moved.json",
    "utf8",
  ),
);
const locationPath = newLocationPath(movedLocation.location.id);
function createMovedLocation(repo: AtlasRepository) {
  const history = repo.terrainSource.history,
    original = repo.terrainSource.placements();
  repo.createLocation(
    createdLocation.location,
    createdLocation.placements.find(
      (p: any) => p.locationId === createdLocation.location.id,
    ),
  );
  history.undo();
  assert.deepEqual(repo.terrainSource.placements(), original);
  history.redo();
  assert.deepEqual(
    repo.location(createdLocation.location.id).read(),
    createdLocation.location,
  );
  repo.editLocation(movedLocation.location);
  repo.moveLocation(
    movedLocation.location.id,
    movedLocation.placements.find(
      (p: any) => p.locationId === movedLocation.location.id,
    ).position,
  );
  assert.equal(history.undoDepth, 3);
  assert.deepEqual(
    repo.location(movedLocation.location.id).read(),
    movedLocation.location,
  );
}
function savedLocationClosure(store: Store) {
  const before = parseCampaignRuntimeManifest(inputManifest, sha),
    after = parseCampaignRuntimeManifest(store.files.get(campaignPath)!, sha),
    owner = after.registry.owners.find((o) => o.ownerId === "atlas")!,
    location = parseLocationDocument(store.files.get(locationPath)!),
    placement = JSON.parse(store.files.get(worldPath)!).placements.find(
      (p: any) => p.locationId === location.id,
    );
  assert.deepEqual(location, movedLocation.location);
  assert.deepEqual(
    placement,
    movedLocation.placements.find((p: any) => p.locationId === location.id),
  );
  assert.deepEqual(after.snapshot, before.snapshot);
  assert.equal(after.registry.registryId, before.registry.registryId);
  assert.notEqual(
    after.registry.registryRevision,
    before.registry.registryRevision,
  );
  assert.deepEqual(
    after.atlas.records.slice(0, before.atlas.records.length),
    before.atlas.records,
  );
  assert.deepEqual(
    after.atlas.files
      .slice(0, before.atlas.files.length)
      .map(({ savedDigest, ...f }) => f),
    before.atlas.files.map(({ savedDigest, ...f }) => f),
  );
  for (const foreign of before.registry.owners.filter(
    (o) => o.ownerId !== "atlas",
  ))
    assert.deepEqual(
      after.registry.owners.find((o) => o.ownerId === foreign.ownerId),
      foreign,
    );
  for (const f of after.atlas.files)
    assert.equal(f.savedDigest, sha(store.files.get(f.path)!));
  const ref = (id: string) => ({
    id,
    scope: "campaign-local",
    schema: "atlas.e2e01.v1",
  });
  assert.deepEqual(
    owner.records.find((r) => r.id === location.id)!.references,
    location.sections
      .map((s) => ref(s.id))
      .sort((a, b) => a.id.localeCompare(b.id)),
  );
  for (const s of location.sections) {
    assert.deepEqual(owner.records.find((r) => r.id === s.id)!.references, [
      ref(location.id),
    ]);
    assert.deepEqual(
      after.atlas.records.find((r) => r.id === s.id),
      {
        id: s.id,
        kind: "location-section",
        documentId: location.id,
        ownerId: "atlas",
        availability: "available",
      },
    );
  }
  assert.deepEqual(
    owner.records.find((r) => r.id === placement.id)!.references,
    [ref(location.id), ref(before.atlas.worldId)].sort((a, b) =>
      a.id.localeCompare(b.id),
    ),
  );
  assert.ok(
    owner.records
      .find((r) => r.id === before.atlas.worldId)!
      .references.some((r) => r.id === placement.id),
  );
  for (const row of fixture.input.filter((r: any) => r.path !== worldPath))
    assert.equal(
      store.files.get(row.path),
      readFileSync(root + row.fixtureFile, "utf8"),
    );
  assert.equal(store.files.has(worldPath + ".journal"), false);
  assert.equal(store.files.has(worldPath + ".draft"), false);
}
async function liveNavigation(store = new Store()) {
  const services = atlasCampaignServices(
      {
        list: async () => [
          { path: campaignPath, bytes: store.files.get(campaignPath)! },
        ],
        subscribe: (changed) => {
          store.manifestChanged = changed;
          return () => {
            store.manifestChanged = undefined;
          };
        },
      },
      sha,
    ),
    provider = services.provider,
    manifest = parseCampaignRuntimeManifest(
      store.files.get(campaignPath)!,
      sha,
    );
  await provider.activate(
    campaignCommandId(id(991)),
    manifest.snapshot.campaignId,
    "open",
  );
  const renderer = {},
    blocked: boolean[] = [];
  let disposed = 0,
    resumed = 0;
  const navigation = new AtlasCampaignNavigation({
    currentContext: provider.currentContext,
    registry: provider.registry,
    inventory: provider.inventory,
    activate: (command, cid, kind) => provider.activate(command, cid, kind),
    openNative: async (input) => {
      const campaign = await services.createSave!(input),
        repo = new AtlasRepository(store, worldPath, store, {
          ...options(store, campaign),
          assertCurrent: input.assertCurrent,
        });
      await repo.open();
      return {
        repository: repo,
        renderer,
        setInputBlocked: (b) => {
          blocked.push(b);
        },
        prepareNavigation: async (guard) => guard(),
        prepareLeave: async (guard) => {
          guard();
          await repo.persistDraft();
        },
        navigate: (_target, guard) => {
          guard();
          return undefined;
        },
        resume: (guard) => {
          guard();
          resumed++;
        },
        suspend: () => "recoverable",
        dispose: () => {
          disposed++;
        },
      };
    },
  });
  await navigation.open(provider.currentContext()!, manifest.atlas.worldId);
  const state = navigation.state;
  assert.equal(state.kind, "active");
  return {
    store,
    services,
    navigation,
    state,
    blocked,
    disposed: () => disposed,
    resumed: () => resumed,
  };
}

test("H01 Location create then Undo saves as a no-op on the same live mount and retains Redo", async () => {
  const f = await liveNavigation(),
    repo = f.state.repository,
    history = f.state.history,
    before = new Map(f.store.files);
  repo.createLocation(
    createdLocation.location,
    createdLocation.placements.find(
      (p: any) => p.locationId === createdLocation.location.id,
    ),
  );
  const source = repo.location(createdLocation.location.id);
  history.undo();
  assert.equal(repo.dirty, false);
  assert.equal(source.read(), null);
  await f.navigation.save();
  const after = f.navigation.state;
  assert.equal(after.kind, "active");
  assert.equal(after.repository, repo);
  assert.equal(after.history, history);
  assert.equal(after.renderer, f.state.renderer);
  assert.deepEqual(after.context, f.state.context);
  assert.equal(after.generation, f.state.generation);
  assert.equal(f.disposed(), 0);
  assert.equal(f.blocked.at(-1), false);
  assert.deepEqual(f.store.files, before);
  assert.equal(f.store.writes.length, 0);
  const capture = await repo.captureNative({ worldId: id(10) });
  assert.equal(
    capture.files.some((file) => file.path === locationPath),
    false,
  );
  history.redo();
  assert.equal(repo.location(createdLocation.location.id), source);
  assert.deepEqual(source.read(), createdLocation.location);
  await f.navigation.save();
  assert.deepEqual(
    parseLocationDocument(f.store.files.get(locationPath)!),
    createdLocation.location,
  );
  assert.equal(repo.dirty, false);
  assert.equal(f.navigation.state.kind, "active");
  assert.equal(f.disposed(), 0);
  f.services.close();
});

test("Undo of a saved Location stays in native capture and cannot bypass Campaign deletion authority", async () => {
  const f = await liveNavigation(),
    repo = f.state.repository;
  repo.createLocation(
    createdLocation.location,
    createdLocation.placements.find(
      (p: any) => p.locationId === createdLocation.location.id,
    ),
  );
  await f.navigation.save();
  f.state.history.undo();
  await repo.persistDraft();
  const capture = await repo.captureNative({ worldId: id(10) }),
    location = capture.files.find((file) => file.path === locationPath)!;
  assert.equal(location.before, f.store.files.get(locationPath));
  assert.notEqual(location.before, null);
  assert.equal(location.after, null);
  const before = new Map(f.store.files),
    writes = f.store.writes.length;
  await assert.rejects(f.navigation.save());
  assert.deepEqual(f.store.files, before);
  assert.equal(f.store.writes.length, writes);
  f.services.close();
});

test("H01 Location create/Key/move saves through real runtime Ack on the same mount/History and admits fresh navigation", async () => {
  const f = await liveNavigation(),
    history = f.state.history,
    renderer = f.state.renderer,
    context = f.state.context;
  createMovedLocation(f.state.repository);
  await f.navigation.save();
  savedLocationClosure(f.store);
  const after = f.navigation.state;
  assert.equal(after.kind, "active");
  assert.equal(after.repository, f.state.repository);
  assert.equal(after.history, history);
  assert.equal(after.renderer, renderer);
  assert.deepEqual(after.context, context);
  assert.equal(f.disposed(), 0);
  assert.equal(f.resumed(), 1);
  assert.equal(f.blocked.at(-1), false);
  assert.equal(after.repository.dirty, false);
  assert.ok(
    after.inventory.records.some(
      (r) => r.id === movedLocation.location.sections[0].id,
    ),
  );
  const saved = new Map(f.store.files);
  await f.navigation.save();
  assert.deepEqual(f.store.files, saved);
  history.undo();
  await f.navigation.save();
  history.redo();
  await f.navigation.save();
  savedLocationClosure(f.store);
  f.services.close();
  const fresh = await liveNavigation(f.store);
  assert.equal(fresh.state.repository.dirty, false);
  assert.deepEqual(
    (
      await fresh.state.repository.ensureLocation(movedLocation.location.id)
    ).read(),
    movedLocation.location,
  );
  assert.ok(
    fresh.state.inventory.records.some(
      (r) => r.id === movedLocation.location.id,
    ),
  );
  await fresh.navigation.save();
  savedLocationClosure(fresh.store);
  fresh.services.close();
});

test("New Location native CAS failure rolls back authority and retains editable current runtime, draft and retry", async () => {
  const f = await liveNavigation();
  createMovedLocation(f.state.repository);
  await f.state.repository.persistDraft();
  const retained = f.store.files.get(worldPath + ".draft"),
    original = new Map(f.store.files);
  f.store.failOnce = worldPath;
  await assert.rejects(f.navigation.save(), /first native CAS failed/);
  assert.equal(f.navigation.state.kind, "active");
  assert.equal(f.disposed(), 0);
  assert.equal(f.blocked.at(-1), false);
  assert.equal(f.store.files.get(worldPath + ".draft"), retained);
  assert.equal(f.store.files.get(campaignPath), inputManifest);
  assert.deepEqual(f.store.files, original);
  await f.navigation.save();
  savedLocationClosure(f.store);
  f.services.close();
});

test("Prepared Location extension recovers BeforeNull and complete draft; committed reply loss rolls forward exactly once", async () => {
  for (const state of ["prepared", "committed"] as const) {
    const f = await opened();
    createMovedLocation(f.repo);
    f.store.fault =
      state === "prepared"
        ? (p) => p === campaignPath
        : (p, after) =>
            p === worldPath + ".journal" &&
            after === null &&
            f.store.files.get(campaignPath) !== inputManifest;
    await assert.rejects(f.repo.save(), AggregateError);
    assert.equal(
      JSON.parse(f.store.files.get(worldPath + ".journal")!).state,
      state,
    );
    f.store.offline = false;
    f.store.fault = undefined;
    const fresh = await opened(f.store);
    if (state === "prepared") {
      assert.equal(f.store.files.has(locationPath), false);
      assert.equal(f.store.files.get(campaignPath), inputManifest);
      assert.equal(fresh.repo.hasDraft, true);
      assert.equal(fresh.repo.dirty, true);
      assert.deepEqual(
        fresh.repo.location(movedLocation.location.id).read(),
        movedLocation.location,
      );
    } else assert.equal(fresh.repo.dirty, false);
    await fresh.repo.save();
    savedLocationClosure(f.store);
  }
});

test("Location extension authority rejects noncanonical paths, foreign sections, missing markers and unqualified Detaillinks", async () => {
  const f = await opened();
  createMovedLocation(f.repo);
  const capture = await f.repo.captureNative({ worldId: id(10) }),
    draft = { path: worldPath + ".draft", before: null, after: null };
  const attempt = (mutate: (files: any[]) => void) => {
    const files = structuredClone([...capture.files]);
    mutate(files);
    assert.throws(() => adapter(f.store).prepare(files, draft));
  };
  attempt((files) => {
    files.find((f) => f.path === locationPath).path = "Orte/Fremd.location";
  });
  attempt((files) => {
    const f = files.find((f) => f.path === locationPath),
      doc = JSON.parse(f.after);
    doc.sections[0].id = id(105);
    f.after = JSON.stringify(doc);
  });
  attempt((files) => {
    const f = files.find((f) => f.path === worldPath),
      doc = JSON.parse(f.after);
    doc.placements = doc.placements.filter(
      (p: any) => p.locationId !== movedLocation.location.id,
    );
    f.after = JSON.stringify(doc);
  });
  attempt((files) => {
    const f = files.find((f) => f.path === locationPath),
      doc = JSON.parse(f.after);
    doc.detailMaps = [{ kind: "dungeon", documentId: id(30) }];
    f.after = JSON.stringify(doc);
  });
  assert.equal(f.store.writes.length, 0);
});

test("Location extension recovery rejects a missing create and forged owner closure without writing", async () => {
  const f = await opened();
  createMovedLocation(f.repo);
  f.store.fault = (p) => p === campaignPath;
  await assert.rejects(f.repo.save(), AggregateError);
  f.store.offline = false;
  f.store.fault = undefined;
  const journal: AtlasFileJournal = JSON.parse(
      f.store.files.get(worldPath + ".journal")!,
    ),
    before = new Map(f.store.files),
    writes = f.store.writes.length;
  await assert.rejects(
    adapter(f.store).validateRecovery(f.store, {
      ...journal,
      writes: journal.writes.filter((w) => w.path !== locationPath),
    }),
  );
  const forged = structuredClone(journal),
    manifestWrite = forged.writes.find((w) => w.path === campaignPath)!,
    manifest = JSON.parse(manifestWrite.after!);
  manifest.registry.owners
    .find((o: any) => o.ownerId === "atlas")
    .records.find((r: any) => r.id === movedLocation.location.id).references =
    [];
  const { registryContentDigest: _, ...unsigned } = manifest.registry;
  manifest.registry.registryContentDigest = campaignOwnershipDigestValue(
    unsigned,
    sha,
  );
  (manifestWrite as any).after = JSON.stringify(manifest, null, 2) + "\n";
  await assert.rejects(adapter(f.store).validateRecovery(f.store, forged));
  assert.deepEqual(f.store.files, before);
  assert.equal(f.store.writes.length, writes);
});

async function bindExistingDungeon(repo: AtlasRepository, reparent = true) {
  const source = repo.terrainSource,
    before = source.spatialState(),
    dungeon = before.detailPlacements.find((p) => p.id === id(202));
  assert.ok(dungeon?.kind === "dungeon");
  const location = (await repo.ensureLocation(id(12))).read()!;
  const after = {
    ...location,
    detailMaps: [
      ...location.detailMaps,
      { kind: "dungeon" as const, documentId: id(30) },
    ],
  };
  const changes = [locationDocumentChange(location.id, location, after)];
  if (reparent)
    changes.push(
      spatialChange(source.world.id, before, {
        ...before,
        detailPlacements: before.detailPlacements.map((p) =>
          p.id === dungeon.id
            ? {
                ...dungeon,
                parent: { kind: "location" as const, locationId: location.id },
                anchor: {
                  ...dungeon.anchor,
                  parentPointMeters: { x: 0, y: 0 },
                },
              }
            : p,
        ),
      }),
    );
  assert.equal(
    source.history.execute({
      label: "Bestehenden Dungeon am Ort verorten",
      changes,
    }),
    true,
  );
  const changedWorld = source.spatialState();
  assert.equal(source.history.undo(), true);
  assert.deepEqual(source.spatialState(), before);
  assert.deepEqual(repo.location(location.id).read(), location);
  assert.equal(source.history.redo(), true);
  assert.deepEqual(source.spatialState(), changedWorld);
  assert.deepEqual(repo.location(location.id).read(), after);
}

async function savedAtlasReferences(repo: AtlasRepository, store: Store) {
  const capture = await repo.captureNative({ worldId: id(10) }),
    manifest = parseCampaignRuntimeManifest(
      store.files.get(campaignPath)!,
      sha,
    ),
    atlas = manifest.registry.owners.find((o) => o.ownerId === "atlas")!,
    initial = JSON.parse(inputManifest);
  assert.deepEqual(
    atlas.records.map((r) => r.id),
    initial.registry.owners
      .find((o: any) => o.ownerId === "atlas")
      .records.map((r: any) => r.id),
  );
  for (const native of capture.records) {
    const record = atlas.records.find((r) => r.id === native.id)!;
    assert.deepEqual(
      record.references,
      [...new Set(native.references.map((r) => r.id))].sort().map((id) => ({
        id,
        scope: "campaign-local",
        schema: "atlas.e2e01.v1",
      })),
      native.id,
    );
  }
  // Relation changes grant no authority over native City/Dungeon owner projections.
  assert.deepEqual(
    manifest.registry.owners.filter((o) => o.ownerId !== "atlas"),
    initial.registry.owners.filter((o: any) => o.ownerId !== "atlas"),
  );
  assert.equal(
    store.files.get(dungeonPath),
    readFileSync(
      root + fixture.input.find((f: any) => f.path === dungeonPath).fixtureFile,
      "utf8",
    ),
  );
  return atlas;
}

for (const reparent of [false, true])
  test(`D01 existing Location detail link${reparent ? " and same-ID Dungeon reparent" : ""} saves exact references and admits fresh model capture`, async () => {
    const f = await opened(),
      before = new Map(f.store.files);
    const targetPath = [...before].find(
      ([p, b]) => p.endsWith(".location") && JSON.parse(b).id === id(12),
    )![0];
    await bindExistingDungeon(f.repo, reparent);
    await f.repo.save();
    const atlas = await savedAtlasReferences(f.repo, f.store);
    assert.deepEqual(
      atlas.records.find((r) => r.id === id(12))!.references.map((r) => r.id),
      [id(17), id(18), id(30)],
    );
    assert.deepEqual(
      atlas.records.find((r) => r.id === id(202))!.references.map((r) => r.id),
      reparent
        ? [id(12), id(30), id(31), id(32), id(33)]
        : [id(30), id(31), id(32), id(33), id(100), id(105)],
    );
    for (const [path, bytes] of before)
      if (path !== campaignPath && path !== worldPath && path !== targetPath)
        assert.equal(f.store.files.get(path), bytes, path);
    const fresh = await opened(f.store);
    await savedAtlasReferences(fresh.repo, f.store);
    const writes = f.store.writes.length;
    await fresh.repo.save();
    assert.equal(f.store.writes.length, writes);
    await freshNavigation(f.store);
  });

test("Existing Dungeon binding Save, Undo Save, Redo Save retain one live runtime mount/History and fresh references", async () => {
  const f = await liveNavigation(),
    { repository: repo, history, renderer, context } = f.state;
  await bindExistingDungeon(repo);
  for (const phase of ["bound", "undo", "redo"] as const) {
    if (phase === "undo") history.undo();
    if (phase === "redo") history.redo();
    await f.navigation.save();
    const atlas = await savedAtlasReferences(repo, f.store);
    assert.equal(
      atlas.records
        .find((r) => r.id === id(202))!
        .references.some((r) => r.id === id(12)),
      phase !== "undo",
    );
    const state = f.navigation.state;
    assert.equal(state.kind, "active");
    assert.equal(state.repository, repo);
    assert.equal(state.history, history);
    assert.equal(state.renderer, renderer);
    assert.deepEqual(state.context, context);
    assert.equal(f.disposed(), 0);
    assert.equal(f.blocked.at(-1), false);
  }
  f.services.close();
  const fresh = await liveNavigation(f.store);
  await savedAtlasReferences(fresh.state.repository, f.store);
  fresh.services.close();
});

test("Location key targets add exact deduplicated references and removal drops obsolete links", async () => {
  const f = await opened();
  await bindExistingDungeon(f.repo, false);
  const location = f.repo.location(id(12)).read()!;
  f.source.history.execute({
    label: "Raum-Key verknüpfen",
    changes: [
      locationDocumentChange(location.id, location, {
        ...location,
        keyLinks: [
          {
            kind: "room",
            atlasId: id(10),
            documentId: id(30),
            roomId: id(31),
            sectionId: id(34),
            anchor: null,
          },
        ],
      }),
    ],
  });
  await f.repo.save();
  let atlas = await savedAtlasReferences(f.repo, f.store);
  assert.deepEqual(
    atlas.records.find((r) => r.id === id(12))!.references.map((r) => r.id),
    [id(10), id(17), id(18), id(30), id(31), id(34)],
  );
  const linked = f.repo.location(id(12)).read()!;
  f.source.history.execute({
    label: "Links entfernen",
    changes: [
      locationDocumentChange(linked.id, linked, {
        ...linked,
        detailMaps: [],
        keyLinks: [],
      }),
    ],
  });
  await f.repo.save();
  atlas = await savedAtlasReferences(f.repo, f.store);
  assert.deepEqual(
    atlas.records.find((r) => r.id === id(12))!.references.map((r) => r.id),
    [id(17), id(18)],
  );
});

test("Schema-valid forged Before references cannot authorize a native binding save", async () => {
  const store = new Store(),
    value = JSON.parse(inputManifest);
  value.registry.owners
    .find((o: any) => o.ownerId === "atlas")
    .records.find((r: any) => r.id === id(12))
    .references.push({
      id: id(105),
      scope: "campaign-local",
      schema: "atlas.e2e01.v1",
    });
  const { registryContentDigest: _, ...unsigned } = value.registry;
  value.registry.registryContentDigest = campaignOwnershipDigestValue(
    unsigned,
    sha,
  );
  store.files.set(campaignPath, JSON.stringify(value));
  const f = await opened(store);
  await bindExistingDungeon(f.repo);
  await f.repo.persistDraft();
  const before = new Map(store.files),
    writes = store.writes.length;
  await assert.rejects(f.repo.save(), /Before-Ownerbelege/);
  assert.deepEqual(store.files, before);
  assert.equal(store.writes.length, writes);
  assert.equal(f.repo.dirty, true);
});

test("Unregistered Dungeon placement ID still rejects Save without native writes or draft loss", async () => {
  const f = await opened(),
    before = f.source.spatialState();
  f.source.history.execute({
    label: "Nicht autorisierte Placementkennung",
    changes: [
      spatialChange(id(10), before, {
        ...before,
        detailPlacements: before.detailPlacements.map((p) =>
          p.id === id(202) ? { ...p, id: id(9001) } : p,
        ),
      }),
    ],
  });
  await f.repo.persistDraft();
  const files = new Map(f.store.files),
    writes = f.store.writes.length;
  await assert.rejects(f.repo.save(), /keinem passenden nativen Owner/);
  assert.deepEqual(f.store.files, files);
  assert.equal(f.store.writes.length, writes);
  assert.equal(f.repo.dirty, true);
  assert.equal(f.store.files.has(worldPath + ".journal"), false);
});

test("Prepared and committed binding journals recover native and Registry references together", async () => {
  for (const state of ["prepared", "committed"] as const) {
    const f = await opened();
    await bindExistingDungeon(f.repo);
    f.store.fault =
      state === "prepared"
        ? (p) => p === campaignPath
        : (p, after) =>
            p === worldPath + ".journal" &&
            after === null &&
            f.store.files.get(campaignPath) !== inputManifest;
    await assert.rejects(f.repo.save(), AggregateError);
    assert.equal(
      JSON.parse(f.store.files.get(worldPath + ".journal")!).state,
      state,
    );
    f.store.offline = false;
    f.store.fault = undefined;
    const fresh = await opened(f.store);
    assert.equal(fresh.repo.dirty, state === "prepared");
    if (state === "prepared")
      assert.equal(f.store.files.get(campaignPath), inputManifest);
    else await savedAtlasReferences(fresh.repo, f.store);
    await fresh.repo.save();
    await savedAtlasReferences(fresh.repo, f.store);
    assert.equal(f.store.files.has(worldPath + ".journal"), false);
    assert.equal(f.store.files.has(worldPath + ".draft"), false);
  }
});

test("Binding native CAS failure restores runtime authority and exact draft before retry", async () => {
  const f = await liveNavigation();
  await bindExistingDungeon(f.state.repository);
  await f.state.repository.persistDraft();
  const before = new Map(f.store.files);
  f.store.failOnce = worldPath;
  await assert.rejects(f.navigation.save(), /first native CAS failed/);
  assert.deepEqual(f.store.files, before);
  assert.equal(f.navigation.state.kind, "active");
  assert.equal(f.disposed(), 0);
  assert.equal(f.blocked.at(-1), false);
  await f.navigation.save();
  await savedAtlasReferences(f.state.repository, f.store);
  f.services.close();
});

test("Binding recovery rejects a schema-valid stale After reference proof without writes", async () => {
  const f = await opened();
  await bindExistingDungeon(f.repo);
  f.store.fault = (path) => path === campaignPath;
  await assert.rejects(f.repo.save(), AggregateError);
  f.store.offline = false;
  f.store.fault = undefined;
  const journal: AtlasFileJournal = JSON.parse(
      f.store.files.get(worldPath + ".journal")!,
    ),
    write = journal.writes.find((w) => w.path === campaignPath)!,
    manifest = JSON.parse(write.after!),
    before = new Map(f.store.files),
    writes = f.store.writes.length;
  const original = JSON.parse(inputManifest)
    .registry.owners.find((o: any) => o.ownerId === "atlas")
    .records.find((r: any) => r.id === id(202));
  manifest.registry.owners
    .find((o: any) => o.ownerId === "atlas")
    .records.find((r: any) => r.id === id(202)).references =
    original.references;
  const { registryContentDigest: _, ...unsigned } = manifest.registry;
  manifest.registry.registryContentDigest = campaignOwnershipDigestValue(
    unsigned,
    sha,
  );
  (write as any).after = JSON.stringify(manifest, null, 2) + "\n";
  await assert.rejects(adapter(f.store).validateRecovery(f.store, journal));
  assert.deepEqual(f.store.files, before);
  assert.equal(f.store.writes.length, writes);
});
