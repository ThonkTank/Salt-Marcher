/** Frozen I02 consumer contract: real Repository -> FileTransaction -> Campaign source/provider.
 * Faults/storage delivery and the renderer/camera owner are controlled test ports, not GUI evidence.
 * Deliberately separate from npm test until the public rollback-release seam is supplied.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { AtlasRepository } from "../src/features/atlas/atlas-repository";
import { AtlasCampaignManifestSave } from "../src/features/atlas/atlas-campaign-save";
import { AtlasCampaignNavigation } from "../src/features/atlas/atlas-campaign-navigation";
import type { AtlasFileJournal } from "../src/features/atlas/file-transaction";
import { CitySource, cityDocumentChange } from "../src/features/city/commands";
import { editCity } from "../src/features/city/edit";
import { DungeonAtlasSource } from "../src/features/dungeon/atlas-source";
import { AtlasRoomKeyDraft } from "../src/features/dungeon/atlas-room-key-draft";
import { CampaignLifecycle } from "../src/features/campaign/campaign-lifecycle";
import { CampaignRuntimeManifestSaveParticipant } from "../src/features/campaign/campaign-runtime-save-participant";
import {
  CampaignRuntimeNavigationProvider,
  CampaignRuntimeSource,
  parseCampaignRuntimeManifest,
  type CampaignRuntimeStorageChange,
  type CampaignRuntimeSaveAcknowledgmentV1,
  type CampaignRuntimeSaveAcknowledgmentResult,
} from "../src/features/campaign/campaign-runtime-source";
import {
  campaignCommandId,
  campaignContextToken,
  campaignNamespace,
  campaignReceiptId,
} from "../src/features/campaign/campaign-contracts";
import { FileConflict, type FileStore } from "../src/persistence";

const root = "tests/fixtures/atlas-e2e-spatial-v2/";
const seed = JSON.parse(readFileSync(root + "manifest.json", "utf8"));
const digest = (bytes: string) =>
  "sha256:" + createHash("sha256").update(bytes).digest("hex");
const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const native = (side: "input" | "expected") =>
  new Map<string, string>(
    seed[side].map((f: { path: string; fixtureFile: string }) => [
      f.path,
      readFileSync(root + f.fixtureFile, "utf8"),
    ]),
  );
const original = native("input"),
  expected = native("expected");
const manifestPath: string = seed.campaign.path;
const beforeBytes = readFileSync(
  root + seed.campaign.input.fixtureFile,
  "utf8",
);
const afterBytes = readFileSync(
  root + seed.campaign.expected.fixtureFile,
  "utf8",
);
const before = parseCampaignRuntimeManifest(beforeBytes, digest),
  after = parseCampaignRuntimeManifest(afterBytes, digest);
const worldPath = before.atlas.files.find((f) => f.kind === "world")!.path;
const journalPath = worldPath + ".journal",
  draftPath = worldPath + ".draft";
const cityPath = before.atlas.files.find((f) => f.kind === "city")!.path;
const dungeonPath = before.atlas.files.find((f) => f.kind === "dungeon")!.path;
const nativeWrites = before.atlas.files.map((f) => ({
  path: f.path,
  before: original.get(f.path)!,
  after: expected.get(f.path)!,
}));

// Sole new public contract requested of Campaign/Data. No private state/reset or invented commit.
interface RollbackObservation {
  readonly journalPath: string;
  readonly preparedJournalBytes: string;
  readonly journalAfter: string | null;
  readonly files: readonly {
    readonly path: string;
    readonly bytes: string | null;
  }[];
}
interface RollbackReceipt {
  readonly transactionId: string;
  readonly outcome: "rolled_back";
  readonly journalState: "absent";
  readonly writes: readonly {
    readonly path: string;
    readonly before: string | null;
    readonly after: string | null;
    readonly current: string | null;
  }[];
}
interface ReleaseFactory {
  createRollbackAcknowledgment(input: {
    readonly prepared: CampaignRuntimeSaveAcknowledgmentV1;
    readonly receipt: RollbackReceipt;
  }): unknown;
}
interface ReleaseConsumer {
  cancelSaveAcknowledgment(proof: unknown): void | Promise<void>;
}
function requireReleaseAPI(f: Fixture) {
  assert.equal(
    typeof (f.participant as unknown as ReleaseFactory)
      .createRollbackAcknowledgment,
    "function",
    "Missing public release-proof factory",
  );
  assert.equal(
    typeof (f.provider as unknown as ReleaseConsumer).cancelSaveAcknowledgment,
    "function",
    "Missing public release consumer",
  );
}
function releaseProof(
  f: Fixture,
  rollback = observation(f),
  prepared = f.prepared!,
) {
  const factory = f.participant as unknown as ReleaseFactory;
  assert.equal(
    typeof factory.createRollbackAcknowledgment,
    "function",
    "MISSING PUBLIC Campaign release-proof factory (HEX-MANIFEST-I02-03)",
  );
  // The Hex test authority issues only after the real transaction restored its exact closure.
  assert.equal(rollback.journalPath, journalPath);
  assert.equal(rollback.preparedJournalBytes, f.preparedRaw);
  assert.equal(rollback.journalAfter, null);
  assert.equal(f.files.get(journalPath) ?? null, null);
  const journal = JSON.parse(rollback.preparedJournalBytes) as AtlasFileJournal;
  assert.equal(journal.state, "prepared");
  assert.equal(journal.transactionId, prepared.transactionId);
  assert.deepEqual(journal.writes, prepared.journal.writes);
  assert.deepEqual(
    rollback.files,
    journal.writes.map((w) => ({
      path: w.path,
      bytes: f.files.get(w.path) ?? null,
    })),
  );
  for (const [index, write] of journal.writes.entries())
    assert.equal(rollback.files[index]!.bytes, write.before);
  const receipt: RollbackReceipt = Object.freeze({
    transactionId: journal.transactionId,
    outcome: "rolled_back",
    journalState: "absent",
    writes: Object.freeze(
      journal.writes.map((w) =>
        Object.freeze({ ...w, current: f.files.get(w.path) ?? null }),
      ),
    ),
  });
  f.receipts.add(receipt);
  return factory.createRollbackAcknowledgment({ prepared, receipt });
}
async function release(f: Fixture, proof = releaseProof(f)) {
  const consumer = f.provider as unknown as ReleaseConsumer;
  assert.equal(
    typeof consumer.cancelSaveAcknowledgment,
    "function",
    "MISSING PUBLIC Campaign prepared-save release consumer",
  );
  await consumer.cancelSaveAcknowledgment(proof);
}
function observation(f: Fixture): RollbackObservation {
  assert.ok(
    f.preparedRaw,
    "Only actual won/read-back Prepared journal may be released",
  );
  const journal = JSON.parse(f.preparedRaw) as AtlasFileJournal;
  return {
    journalPath,
    preparedJournalBytes: f.preparedRaw,
    journalAfter: f.files.get(journalPath) ?? null,
    files: journal.writes.map((w) => ({
      path: w.path,
      bytes: f.files.get(w.path) ?? null,
    })),
  };
}
class Store implements FileStore {
  readonly files = new Map(original);
  fault?: (
    path: string,
    old: string | null,
    next: string | null,
  ) => void | Promise<void>;
  won?: (
    path: string,
    old: string | null,
    next: string | null,
  ) => void | Promise<void>;
  readonly trace: {
    path: string;
    before: string | null;
    after: string | null;
  }[] = [];
  constructor() {
    this.files.set(manifestPath, beforeBytes);
  }
  async read(path: string) {
    return this.files.get(path) ?? null;
  }
  async compareAndWrite(path: string, old: string | null, next: string | null) {
    if ((this.files.get(path) ?? null) !== old) throw new FileConflict(path);
    await this.fault?.(path, old, next);
    if (next === null) this.files.delete(path);
    else this.files.set(path, next);
    this.trace.push({ path, before: old, after: next });
    await this.won?.(path, old, next);
  }
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
async function fixture(t: { after(fn: () => void): void }) {
  const store = new Store();
  const receipts = new WeakSet<object>();
  const participant = Reflect.construct(
    CampaignRuntimeManifestSaveParticipant,
    [
      manifestPath,
      digest,
      before.registry.owners.map((owner, index) => ({
        ownerId: owner.ownerId,
        verify: (
          v: Parameters<
            import("../src/features/campaign/campaign-runtime-save-participant").CampaignRuntimeOwnerSaveAuthority["verify"]
          >[0],
        ) => {
          assert.deepEqual(v.beforeOwner, owner);
          assert.deepEqual(v.afterOwner, after.registry.owners[index]);
          assert.deepEqual(v.beforeFiles, before.atlas.files);
          assert.deepEqual(v.afterFiles, after.atlas.files);
          const full = nativeWrites.map((w) => w.path).sort(),
            changed = nativeWrites
              .filter((w) => w.before !== w.after)
              .map((w) => w.path)
              .sort(),
            actual = v.nativeWrites.map((w) => w.path).sort();
          assert.ok(
            JSON.stringify(actual) === JSON.stringify(full) ||
              JSON.stringify(actual) === JSON.stringify(changed),
          );
          for (const write of v.nativeWrites)
            assert.deepEqual(
              write,
              nativeWrites.find((w) => w.path === write.path),
            );
        },
      })),
      {
        validateRollbackReceipt(receipt: RollbackReceipt) {
          if (!receipts.has(receipt))
            throw new Error(
              "Rollback receipt not issued after actual validated FileTransaction recovery",
            );
        },
      },
    ],
  ) as CampaignRuntimeManifestSaveParticipant;
  let emit: ((c: CampaignRuntimeStorageChange) => void) | undefined;
  const source = new CampaignRuntimeSource(
    {
      list: async () => [
        { path: manifestPath, bytes: store.files.get(manifestPath)! },
      ],
      subscribe: (fn) => {
        emit = fn;
        return () => {
          emit = undefined;
        };
      },
    },
    digest,
    participant,
  );
  const lifecycle = new CampaignLifecycle(source.lifecycle, {
    campaignId: () => before.snapshot.campaignId,
    namespace: () => campaignNamespace(before.snapshot.namespace),
    contextToken: () => campaignContextToken(crypto.randomUUID()),
    receiptId: () => campaignReceiptId(crypto.randomUUID()),
  });
  const provider = new CampaignRuntimeNavigationProvider(source, lifecycle);
  await provider.activate(
    campaignCommandId(crypto.randomUUID()),
    before.snapshot.campaignId,
    "open",
  );
  const context = provider.currentContext()!;
  const registry = await provider.registry.read(context);
  assert.equal(registry.kind, "confirmed");
  if (registry.kind !== "confirmed")
    throw new Error("Actual registry unavailable");
  // Explicit controlled renderer port: same owner object and immutable camera value; no raster/UI claim.
  const renderer = {
    camera: Object.freeze({
      center: Object.freeze({ x: -18, y: 8 }),
      scale: 1,
    }),
  };
  const navigation = new AtlasCampaignNavigation({
    currentContext: provider.currentContext,
    registry: provider.registry,
    inventory: provider.inventory,
    activate: (...args) => provider.activate(...args),
    openNative: async (input) => {
      const repository = new AtlasRepository(store, worldPath, store, {
        locations: true,
        details: true,
        campaignSave: new AtlasCampaignManifestSave(
          manifestPath,
          store.files.get(manifestPath)!,
          digest,
        ),
        assertCurrent: input.assertCurrent,
        resolveLocation: async (recordId) =>
          before.atlas.files.find(
            (f) => f.kind === "location" && f.id === recordId,
          )!.path,
        resolveDetail: async (_world, kind, recordId) =>
          before.atlas.files
            .filter((f) => f.kind === kind && f.id === recordId)
            .map((f) => f.path),
      });
      await repository.open();
      return {
        repository,
        renderer,
        setInputBlocked: () => {},
        prepareNavigation: async (guard) => {
          guard();
        },
        prepareLeave: async (guard) => {
          guard();
          await repository.persistDraft();
          guard();
        },
        navigate: (_target, guard) => {
          guard();
        },
        resume: (guard) => {
          guard();
        },
        suspend: () => "recoverable",
        dispose: () => {},
      };
    },
  });
  const unsubscribe = provider.subscribeContextChanged(() =>
    navigation.contextChanged(),
  );
  await navigation.open(context, before.atlas.worldId);
  const state = navigation.state;
  assert.equal(state.kind, "active");
  if (state.kind !== "active") throw new Error("No native mount");
  const repository = state.repository,
    history = state.history;
  const city = repository.detail("city", id(100)),
    dungeon = repository.detail("dungeon", id(30));
  assert.ok(city instanceof CitySource);
  assert.ok(dungeon instanceof DungeonAtlasSource);
  const f = {
    store,
    files: store.files,
    participant,
    receipts,
    source,
    provider,
    context,
    registry: registry.projection,
    navigation,
    state,
    repository,
    history,
    renderer,
    initialCamera: renderer.camera,
    city,
    dungeon,
    event: (c: CampaignRuntimeStorageChange) => emit?.(c),
    prepared: undefined as CampaignRuntimeSaveAcknowledgmentV1 | undefined,
    preparedRaw: undefined as string | undefined,
    committed: undefined as CampaignRuntimeSaveAcknowledgmentV1 | undefined,
    ack: undefined as
      | Promise<CampaignRuntimeSaveAcknowledgmentResult>
      | undefined,
    delivery: "atomic" as "atomic" | "delayed",
    eventId: 1,
    preparedHook: undefined as (() => void | Promise<void>) | undefined,
    committedHook: undefined as (() => void | Promise<void>) | undefined,
  };
  store.won = async (path, _old, next) => {
    if (path === manifestPath && next !== null) {
      if (f.delivery === "atomic")
        f.event({ kind: "modify", path, bytes: next });
      else
        f.event({ kind: "modify", path, phase: "pending", eventId: f.eventId });
    }
    if (path === journalPath && next !== null) {
      const journal = JSON.parse(next) as AtlasFileJournal;
      if (!journal.writes.some((w) => w.path === manifestPath)) return; // existing draft transaction has no Campaign lease
      assert.equal(await store.read(path), next); // only after actual CAS and read-back
      const proof = participant.createAcknowledgment({
        context: f.context,
        beforeRegistry: f.registry,
        journal,
      });
      if (journal.state === "prepared") {
        f.prepared = proof;
        f.preparedRaw = next;
        provider.prepareSaveAcknowledgment(proof);
        await f.preparedHook?.();
      } else {
        f.committed = proof;
        f.ack = provider.acknowledgeCommittedSave(proof);
        void f.ack.catch(() => {});
        await f.committedHook?.();
      }
    }
  };
  t.after(() => {
    unsubscribe();
    navigation.dispose();
    provider.close();
    source.close();
  });
  return f;
}
function edit(f: Fixture) {
  const old = f.city.read();
  assert.deepEqual(
    [
      old.id,
      ...old.roadNodes.map((v) => v.id),
      ...old.roads.map((v) => v.id),
      ...old.plazas.map((v) => v.id),
      ...old.buildings.map((v) => v.id),
    ].sort(),
    Array.from({ length: 7 }, (_, i) => id(100 + i)).sort(),
  );
  f.history.execute({
    label: "Haus verschieben",
    changes: [
      cityDocumentChange(
        old,
        editCity(old, [
          {
            kind: "set-building-pose",
            buildingId: id(105),
            position: seed.oracle.expectedPosition,
            rotationRadians: 0,
            scale: { x: 1, y: 1 },
          },
        ]),
      ),
    ],
  });
  const key = new AtlasRoomKeyDraft(f.dungeon, id(31));
  key.markdown.set(id(34), seed.oracle.roomText);
  assert.equal(key.apply(), true);
  f.history.undo();
  f.history.redo();
  oracles(f);
}
function oracles(f: Fixture) {
  assert.equal(f.repository.detail("city", id(100)), f.city);
  assert.equal(f.city.history, f.history);
  assert.equal(f.dungeon.history, f.history);
  assert.equal(f.repository.terrainSource.history, f.history);
  assert.equal(f.navigation.state.kind, "active");
  if (f.navigation.state.kind !== "active")
    throw new Error("Original mount retired");
  assert.equal(f.navigation.state.repository, f.repository);
  assert.equal(f.navigation.state.history, f.history);
  assert.equal(f.navigation.state.renderer, f.renderer);
  assert.equal(f.navigation.state.generation, f.state.generation);
  assert.equal(f.renderer.camera, f.initialCamera);
  assert.deepEqual(
    f.city.read().buildings.find((v) => v.id === id(105))!.position,
    seed.oracle.expectedPosition,
  );
  assert.equal(f.history.undoDepth, 2);
  // Exact supplied native snapshots also bind road/building IDs 100--106 and the existing RoomKey section.
  assert.equal(
    JSON.stringify(f.city.read()),
    JSON.stringify(JSON.parse(expected.get(cityPath)!)),
  );
  assert.equal(f.dungeon.read().documentBytes, expected.get(dungeonPath));
}
function rolledBack(f: Fixture) {
  assert.ok(f.prepared);
  assert.equal(f.committed, undefined);
  assert.equal(f.files.has(journalPath), false);
  for (const [path, bytes] of original)
    assert.equal(f.files.get(path), bytes, path);
  assert.equal(f.files.get(manifestPath), beforeBytes);
  assert.equal(f.repository.dirty, true);
  assert.equal(f.repository.hasDraft, true);
  assert.equal(f.provider.currentContext(), f.context);
  oracles(f);
}
async function saved(f: Fixture) {
  assert.ok(f.committed);
  assert.ok(f.ack);
  const result = await f.ack;
  for (const [path, bytes] of expected)
    assert.equal(f.files.get(path), bytes, path);
  assert.equal(f.files.get(manifestPath), afterBytes);
  assert.equal(f.files.has(journalPath), false);
  assert.equal(f.files.has(draftPath), false);
  assert.equal(f.provider.currentContext(), f.context);
  assert.equal(result.context.contextToken, f.context.contextToken);
  assert.equal(
    result.registry.registryRevision,
    after.registry.registryRevision,
  );
  assert.deepEqual(result.inventory.files, after.atlas.files);
  assert.equal(f.repository.dirty, false);
  oracles(f);
  return result;
}
async function failingSave(f: Fixture, target: "first" | "manifest" = "first") {
  let fired = false;
  f.store.fault = (path, _old, next) => {
    if (!f.prepared || fired || next === null) return;
    if (target === "manifest" ? path === manifestPath : path === cityPath) {
      fired = true;
      throw new Error("injected native CAS rejection before mutation");
    }
  };
  await assert.rejects(f.repository.save(), /injected native CAS rejection/);
  f.store.fault = undefined;
  assert.equal(fired, true);
  rolledBack(f);
}
const opts = { timeout: 5000 };
for (const target of ["first", "manifest"] as const)
  test(
    `M01-${target}: real prepared save -> native CAS failure -> complete rollback -> release -> same-mount retry`,
    opts,
    async (t) => {
      const f = await fixture(t);
      edit(f);
      await failingSave(f, target);
      await release(f);
      oracles(f);
      await f.repository.save();
      await saved(f);
    },
  );
test(
  "M02: actual won Prepared CAS reply lost -> validated rollback -> release -> retry",
  opts,
  async (t) => {
    const f = await fixture(t);
    edit(f);
    let fired = false;
    f.preparedHook = () => {
      if (!fired) {
        fired = true;
        throw new Error("Prepared reply lost after actual read-back");
      }
    };
    await assert.rejects(f.repository.save(), /Prepared reply lost/);
    rolledBack(f);
    f.preparedHook = undefined;
    await release(f);
    await f.repository.save();
    await saved(f);
  },
);
test(
  "M03: actual Commit + exact once replay preserve Context, all native IDs/bytes and History",
  opts,
  async (t) => {
    const f = await fixture(t);
    edit(f);
    await f.repository.save();
    const result = await saved(f);
    assert.equal(
      await f.provider.acknowledgeCommittedSave(f.committed!),
      result,
    );
  },
);
test(
  "M04: actual won Committed CAS reply lost rolls forward; it cannot be released as rollback",
  opts,
  async (t) => {
    const f = await fixture(t);
    edit(f);
    f.committedHook = () => {
      throw new Error("Committed reply lost after actual read-back");
    };
    await f.repository.save();
    await saved(f);
    requireReleaseAPI(f);
    await assert.rejects(async () => release(f), /./);
    assert.equal(f.files.get(manifestPath), afterBytes);
  },
);
test(
  "M05: pending own Vault event -> won Commit -> delayed exact resolution; no early receipt",
  opts,
  async (t) => {
    const f = await fixture(t);
    f.delivery = "delayed";
    edit(f);
    await f.repository.save();
    let settled = false;
    void f.ack!.then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      },
    );
    await Promise.resolve();
    assert.equal(settled, false);
    assert.equal(f.provider.currentContext(), f.context);
    f.event({
      kind: "modify",
      path: manifestPath,
      phase: "resolved",
      eventId: f.eventId,
      bytes: afterBytes,
    });
    await saved(f);
  },
);
test(
  "M06: foreign unknown modify revokes old mount synchronously before asynchronous bytes",
  opts,
  async (t) => {
    const f = await fixture(t);
    edit(f);
    f.event({
      kind: "modify",
      path: manifestPath,
      phase: "pending",
      eventId: 70,
    });
    assert.equal(f.provider.currentContext(), null);
    assert.throws(() => f.history.undo(), /./);
    await assert.rejects(f.repository.save(), /./);
    assert.equal(f.files.get(manifestPath), beforeBytes);
    assert.deepEqual(
      f.city.read().buildings.find((v) => v.id === id(105))!.position,
      seed.oracle.expectedPosition,
    );
  },
);
test(
  "M07: foreign/wrong resolved event during a prepared lease rejects commit/release; no automatic reactivation",
  opts,
  async (t) => {
    const f = await fixture(t);
    edit(f);
    f.preparedHook = () => {
      f.event({
        kind: "modify",
        path: manifestPath,
        phase: "pending",
        eventId: 71,
      });
      f.event({
        kind: "modify",
        path: manifestPath,
        phase: "resolved",
        eventId: 71,
        bytes: beforeBytes + "\n",
      });
      throw new Error("foreign event before native mutation");
    };
    await assert.rejects(f.repository.save(), /./);
    assert.equal(f.provider.currentContext(), null);
    requireReleaseAPI(f);
    await assert.rejects(async () => release(f), /./);
    assert.throws(() => f.history.redo(), /./);
    assert.ok(f.files.has(journalPath));
    assert.equal(f.files.get(manifestPath), beforeBytes);
  },
);
test(
  "M08: late old resolved event cannot revoke a new Context or its newer prepared save",
  opts,
  async (t) => {
    const f = await fixture(t);
    f.event({
      kind: "modify",
      path: manifestPath,
      phase: "pending",
      eventId: 72,
    });
    assert.equal(f.provider.currentContext(), null);
    await f.provider.activate(
      campaignCommandId(crypto.randomUUID()),
      before.snapshot.campaignId,
      "open",
    );
    const fresh = f.provider.currentContext()!;
    assert.notEqual(fresh.contextToken, f.context.contextToken);
    const registry = await f.provider.registry.read(fresh);
    assert.equal(registry.kind, "confirmed");
    if (registry.kind !== "confirmed") throw new Error("No fresh registry");
    // Actual second transaction, same supplied native closure; old mount is intentionally retired.
    const { FileTransaction } = await import(
      "../src/features/atlas/file-transaction"
    );
    const manifestWrites = f.participant.prepare({
      beforeManifestBytes: beforeBytes,
      nativeWrites,
      beforeOwners: before.registry.owners,
      afterOwners: after.registry.owners,
    });
    let committed: CampaignRuntimeSaveAcknowledgmentV1 | undefined;
    let ack: Promise<CampaignRuntimeSaveAcknowledgmentResult> | undefined;
    f.store.won = async (path, _old, next) => {
      if (path === manifestPath && next)
        f.event({ kind: "modify", path, bytes: next });
      if (path !== journalPath || !next) return;
      const journal = JSON.parse(next) as AtlasFileJournal;
      assert.equal(await f.store.read(path), next);
      const proof = f.participant.createAcknowledgment({
        context: fresh,
        beforeRegistry: registry.projection,
        journal,
      });
      if (journal.state === "prepared") {
        f.provider.prepareSaveAcknowledgment(proof);
        f.event({
          kind: "modify",
          path: manifestPath,
          phase: "resolved",
          eventId: 72,
          bytes: beforeBytes,
        });
        assert.equal(f.provider.currentContext(), fresh);
      } else {
        committed = proof;
        ack = f.provider.acknowledgeCommittedSave(proof);
        void ack.catch(() => {});
      }
    };
    const tx = new FileTransaction(
      f.store,
      journalPath,
      (p) => [...nativeWrites, ...manifestWrites].some((w) => w.path === p),
      f.store,
      (j) => f.participant.validateRecovery(j),
      () => assert.equal(f.provider.currentContext(), fresh),
    );
    assert.equal(await tx.commit([...nativeWrites, ...manifestWrites]), true);
    assert.ok(committed);
    assert.equal((await ack!).context.contextToken, fresh.contextToken);
    assert.throws(() => f.history.undo(), /./);
  },
);
test(
  "M09: release rejects unsealed/foreign/duplicate proofs, changed bytes and unremoved Prepared journal",
  opts,
  async (t) => {
    const f = await fixture(t);
    edit(f);
    await failingSave(f);
    const good = observation(f);
    for (const bad of [
      { ...good, journalPath: "Atlanten/Foreign.overworld.journal" },
      { ...good, journalAfter: good.preparedJournalBytes },
      {
        ...good,
        files: good.files.map((v, i) =>
          i === 0 ? { ...v, bytes: "foreign" } : v,
        ),
      },
      {
        ...good,
        preparedJournalBytes: JSON.stringify({
          ...JSON.parse(good.preparedJournalBytes),
          transactionId: crypto.randomUUID(),
        }),
      },
    ])
      assert.throws(() => releaseProof(f, bad), /./);
    const proof = releaseProof(f);
    await assert.rejects(
      async () => release(f, JSON.parse(JSON.stringify(proof))),
      /./,
    );
    await release(f, proof);
    await assert.rejects(async () => release(f, proof), /./);
    oracles(f);
    await f.repository.save();
    await saved(f);
  },
);
test(
  "M10: Source closure during Prepared save retains journal/draft and rejects release/retry",
  opts,
  async (t) => {
    const f = await fixture(t);
    edit(f);
    f.preparedHook = () => {
      f.source.close();
      throw new Error("closed after actual prepare");
    };
    await assert.rejects(f.repository.save(), /./);
    assert.equal(f.provider.currentContext(), null);
    assert.ok(f.files.has(journalPath));
    assert.ok(f.files.has(draftPath));
    requireReleaseAPI(f);
    await assert.rejects(async () => release(f), /./);
    await assert.rejects(f.repository.save(), /./);
    assert.throws(() => f.history.undo(), /./);
  },
);
test(
  "M11: Provider closure after validated rollback cannot release or reuse the old reservation",
  opts,
  async (t) => {
    const f = await fixture(t);
    edit(f);
    await failingSave(f);
    const proof = releaseProof(f);
    f.provider.close();
    await assert.rejects(async () => release(f, proof), /./);
    assert.equal(f.provider.currentContext(), null);
    assert.throws(() => f.history.redo(), /./);
  },
);
test(
  "M12: closure while own committed acknowledgment waits for bytes rejects, preserving won After state",
  opts,
  async (t) => {
    const f = await fixture(t);
    f.delivery = "delayed";
    edit(f);
    await f.repository.save();
    f.source.close();
    await assert.rejects(f.ack!, /./);
    assert.equal(f.files.get(manifestPath), afterBytes);
    for (const [path, bytes] of expected)
      assert.equal(f.files.get(path), bytes);
    assert.equal(f.files.has(journalPath), false);
    assert.equal(f.provider.currentContext(), null);
  },
);

test(
  "M13: rollback after an observed own Manifest event must not release/reactivate the obsolete source",
  opts,
  async (t) => {
    const f = await fixture(t);
    edit(f);
    let fired = false;
    f.store.fault = (path, _old, next) => {
      if (
        !fired &&
        f.prepared &&
        path === journalPath &&
        next &&
        JSON.parse(next).state === "committed"
      ) {
        fired = true;
        throw new Error("Commit CAS rejected after Manifest event");
      }
    };
    await assert.rejects(f.repository.save(), /./);
    assert.equal(fired, true);
    assert.ok(f.prepared);
    assert.equal(f.committed, undefined);
    for (const [path, bytes] of original)
      assert.equal(f.files.get(path), bytes);
    assert.equal(f.files.get(manifestPath), beforeBytes);
    assert.equal(f.files.has(journalPath), false);
    assert.equal(f.provider.currentContext(), null);
    requireReleaseAPI(f);
    await assert.rejects(async () => release(f), /./);
    assert.equal(f.provider.currentContext(), null);
    assert.throws(() => f.history.undo(), /./);
  },
);
test(
  "M14: stale rollback-release after A1 -> A2 must reject without revoking A2",
  opts,
  async (t) => {
    const f = await fixture(t);
    edit(f);
    await failingSave(f);
    const proof = releaseProof(f);
    await f.provider.activate(
      campaignCommandId(crypto.randomUUID()),
      before.snapshot.campaignId,
      "open",
    );
    const fresh = f.provider.currentContext()!;
    assert.notEqual(fresh.contextToken, f.context.contextToken);
    await assert.rejects(async () => release(f, proof), /./);
    assert.equal(f.provider.currentContext(), fresh);
    assert.throws(() => f.history.redo(), /./);
    for (const [path, bytes] of original)
      assert.equal(f.files.get(path), bytes);
    assert.equal(f.files.get(manifestPath), beforeBytes);
  },
);

test(
  "M15: Prepared journal CAS rejected before mutation creates no Campaign lease; same-mount retry succeeds",
  opts,
  async (t) => {
    const f = await fixture(t);
    edit(f);
    let fired = false;
    f.store.fault = (path, _old, next) => {
      if (!fired && path === journalPath && next) {
        const j = JSON.parse(next) as AtlasFileJournal;
        if (
          j.state === "prepared" &&
          j.writes.some((w) => w.path === manifestPath)
        ) {
          fired = true;
          throw new Error("Prepared CAS failed before mutation");
        }
      }
    };
    await assert.rejects(f.repository.save(), /Prepared CAS failed/);
    assert.equal(fired, true);
    assert.equal(f.prepared, undefined);
    assert.equal(f.files.has(journalPath), false);
    assert.equal(f.provider.currentContext(), f.context);
    oracles(f);
    f.store.fault = undefined;
    await f.repository.save();
    await saved(f);
  },
);
test(
  "M16: cleanup CAS fails after a won commit; real recovery rolls forward and acknowledgment replays once",
  opts,
  async (t) => {
    const f = await fixture(t);
    edit(f);
    let fired = false;
    f.store.fault = (path, old, next) => {
      if (
        !fired &&
        path === journalPath &&
        next === null &&
        old &&
        JSON.parse(old).state === "committed" &&
        f.committed
      ) {
        fired = true;
        throw new Error("Committed cleanup CAS rejected");
      }
    };
    await f.repository.save();
    assert.equal(fired, true);
    const result = await saved(f);
    assert.equal(
      await f.provider.acknowledgeCommittedSave(f.committed!),
      result,
    );
  },
);
test(
  "M17: release terminates a waiting ack; late commit and reused transaction reject without losing the retained mount",
  opts,
  async (t) => {
    const f = await fixture(t);
    edit(f);
    await failingSave(f);
    requireReleaseAPI(f);
    // Deliberate unwon future-Commit claim exercises tombstones; it is never presented as a won journal.
    const future = f.participant.createAcknowledgment({
      context: f.context,
      beforeRegistry: f.registry,
      journal: { ...f.prepared!.journal, state: "committed" },
    });
    const waiting = f.provider.acknowledgeCommittedSave(future);
    void waiting.catch(() => {});
    await release(f);
    await assert.rejects(waiting, /./);
    await assert.rejects(f.provider.acknowledgeCommittedSave(future), /./);
    assert.throws(() => f.provider.prepareSaveAcknowledgment(f.prepared!), /./);
    assert.equal(f.provider.currentContext(), f.context);
    oracles(f);
    await f.repository.save();
    await saved(f);
  },
);
