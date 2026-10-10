import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { AtlasRepository } from "../../src/features/atlas/atlas-repository";
import { AtlasCampaignNavigation, type AtlasCampaignMount, type AtlasMountInput, type AtlasConfirmedInventory,
  type AtlasNavigationTarget, type AtlasResolvedNavigation, type AtlasNavigationRequest } from "../../src/features/atlas/atlas-campaign-navigation";
import { CampaignLifecycle } from "../../src/features/campaign/campaign-lifecycle";
import { campaignCommandId, campaignContextToken, campaignId, campaignNamespace, campaignReceiptId, campaignSnapshot,
  campaignLocalId, type CampaignContextProjection, type CampaignSnapshotV1 } from "../../src/features/campaign/campaign-contracts";
import { campaignDomainOwnershipProjection, campaignDomainOwnershipProjectionDigest, type CampaignDomainOwnershipProjectionV1,
  type CampaignDomainOwnerProjectionV1 } from "../../src/features/campaign/campaign-ownership";
import { parseDocument } from "../../src/model";
import { parseCityDocument } from "../../src/features/city/codec";
import { parseLocationDocument } from "../../src/features/location/location-schema";
import { TerrainStroke } from "../../src/features/atlas/terrain-source";
import { FileConflict, type FileStore } from "../../src/persistence";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const command = (n: number) => campaignCommandId(id(1000 + n));
const a = campaignId(id(700)), b = campaignId(id(701)), trashed = campaignId(id(702));
const root = "tests/fixtures/atlas-e2e-spatial-v2/";
const manifest: { input: { path: string; fixtureFile: string }[] } = JSON.parse(readFileSync(root + "manifest.json", "utf8"));
const worldId = JSON.parse(readFileSync(root + manifest.input[0]!.fixtureFile, "utf8")).id as string;
const sha = (bytes: string) => "sha256:" + createHash("sha256").update(bytes).digest("hex");
function deferred<T = void>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}
class Store implements FileStore {
  files = new Map(manifest.input.map((f) => [f.path, readFileSync(root + f.fixtureFile, "utf8")]));
  writes: string[] = [];
  onRead?: (path: string) => Promise<void>;
  onWrite?: (path: string) => Promise<void>;
  async read(path: string) { await this.onRead?.(path); return this.files.get(path) ?? null; }
  async compareAndWrite(path: string, before: string | null, after: string | null) {
    if ((this.files.get(path) ?? null) !== before) throw new FileConflict(path);
    this.writes.push(path);
    if (after === null) this.files.delete(path); else this.files.set(path, after);
    await this.onWrite?.(path);
  }
}
function documents(store: Store) {
  const files: AtlasConfirmedInventory["files"][number][] = [];
  const records: AtlasConfirmedInventory["records"][number][] = [];
  const payloads = new Map<string, string>();
  const add = (kind: AtlasNavigationTarget["kind"], recordId: string, documentId: string, value: unknown) => {
    records.push({ id: recordId, kind, documentId, ownerId: kind === "city" || kind === "building" ? "city" : kind === "dungeon" || kind === "room" || kind === "room-section" ? "dungeon" : "atlas", availability: "available" });
    payloads.set(recordId, sha(JSON.stringify(value)));
  };
  for (const [path, bytes] of store.files) {
    if (path.endsWith(".draft") || path.endsWith(".journal")) continue;
    const raw = JSON.parse(bytes);
    const kind = path.endsWith(".overworld") ? "world" : path.endsWith(".location") ? "location" : path.endsWith(".city") ? "city" : path.endsWith(".dungeon") ? "dungeon" : "terrain";
    files.push({ kind, id: kind === "terrain" ? null : raw.id, path, savedDigest: sha(bytes) });
    if (kind === "world") add("world", raw.id, raw.id, raw);
    if (kind === "location") {
      const doc = parseLocationDocument(bytes); add("location", doc.id, doc.id, doc);
      for (const s of doc.sections) add("location-section", s.id, doc.id, s);
    }
    if (kind === "city") {
      const doc = parseCityDocument(bytes); add("city", doc.id, doc.id, doc);
      for (const h of doc.buildings) add("building", h.id, doc.id, h);
    }
    if (kind === "dungeon") {
      const doc = parseDocument(bytes); add("dungeon", doc.id, doc.id, doc);
      for (const r of doc.entities) if (r.kind === "building" && r.key) {
        add("room", r.id, doc.id, r); for (const s of r.key.sections) add("room-section", s.id, doc.id, s);
      }
    }
  }
  return { files, records, payloads };
}
interface Mounted extends AtlasCampaignMount {
  input: AtlasMountInput;
  store: Store;
  blocked: boolean;
  resumed: number;
  disposed: boolean;
  leaveCalls: number;
  prepareCalls: number;
  focus: AtlasResolvedNavigation | null;
  unsavedKey: boolean;
  pendingPublish: boolean;
  prepareHook?: (guard: () => void) => Promise<void>;
  leaveHook?: (guard: () => void) => Promise<void>;
}
async function fixture() {
  const stores = new Map([[a, new Store()], [b, new Store()]]), snapshots = new Map([
    [a, campaignSnapshot({ schemaVersion: 1, campaignId: a, revision: 1, name: "A", namespace: campaignNamespace(id(710)), lifecycle: "active" })],
    [b, campaignSnapshot({ schemaVersion: 1, campaignId: b, revision: 1, name: "B", namespace: campaignNamespace(id(711)), lifecycle: "active" })],
    [trashed, campaignSnapshot({ schemaVersion: 1, campaignId: trashed, revision: 1, name: "Gelöscht", namespace: campaignNamespace(id(712)), lifecycle: "trashed" })],
  ]);
  const readGates = new Map<string, Promise<CampaignSnapshotV1 | null>>();
  let token = 0, receipt = 0;
  const service = new CampaignLifecycle({ read: async (id) => readGates.get(id) ?? snapshots.get(id) ?? null,
    publish: async () => ({ kind: "conflict" }), status: async () => ({ kind: "outcome_unknown" }) }, {
    campaignId: () => a, namespace: () => campaignNamespace(id(710)), contextToken: () => campaignContextToken("context:" + ++token), receiptId: () => campaignReceiptId(id(2000 + ++receipt)),
  });
  await service.activate(command(1), a);
  const mounts: Mounted[] = [], events: string[] = [];
  let verifyHook: (() => Promise<void>) | undefined, openHook: (() => Promise<void>) | undefined;
  let registryMode: "confirmed" | "unknown" | "unavailable" = "confirmed";
  let verifyMode: "current" | "stale" | "unknown" | "unavailable" = "current";
  let inventoryMode: "confirmed" | "unknown" | "unavailable" = "confirmed";
  let mutateInventory: ((i: AtlasConfirmedInventory) => AtlasConfirmedInventory) | undefined;
  let activateCalls = 0;
  let activationReplyHook: (() => Promise<void>) | undefined;
  const projections = new Map<string, CampaignDomainOwnershipProjectionV1>();
  const projection = (c: CampaignContextProjection) => {
    const existing = projections.get(c.contextToken); if (existing) return existing;
    const native = documents(stores.get(c.campaignId)!);
    const owners: CampaignDomainOwnerProjectionV1[] = ["atlas", "city", "dungeon"].map((ownerId) => ({ ownerId, ownerRevision: "owner:1", schemaRevision: "native:1", snapshotRevision: "snapshot:1", policyRevision: "policy:1", policyDigest: sha("native policy"), availability: "confirmed", emptyConfirmed: false, referenceSchemas: ["atlas.native.v1"], source: { adapterType: "native", generation: c.contextToken },
      records: native.records.filter((r) => r.ownerId === ownerId).map((r) => ({ id: campaignLocalId(r.id), recordType: r.kind, references: [], payloadDigest: native.payloads.get(r.id)!, media: null })), transferPolicies: [] }));
    const raw: CampaignDomainOwnershipProjectionV1 = { version: 1, registryId: "registry", registryRevision: "registry:1", projectionDigest: sha("initial"), context: c, owners };
    const p = campaignDomainOwnershipProjection({ ...raw, projectionDigest: campaignDomainOwnershipProjectionDigest(raw, sha) }); projections.set(c.contextToken, p); return p;
  };
  const navigation = new AtlasCampaignNavigation({ currentContext: () => service.context,
    registry: { read: async (c) => registryMode === "confirmed" ? { kind: "confirmed", projection: projection(c) } : { kind: registryMode },
      verify: async () => { await verifyHook?.(); return { kind: verifyMode }; } },
    inventory: { read: async (p, world) => {
      if (inventoryMode !== "confirmed") return { kind: inventoryMode };
      const native = documents(stores.get(p.context.campaignId)!);
      const inv: AtlasConfirmedInventory = { context: p.context, registryId: p.registryId, registryRevision: p.registryRevision, projectionDigest: p.projectionDigest, worldId: world, files: native.files, records: native.records };
      return { kind: "confirmed", inventory: mutateInventory ? mutateInventory(inv) : inv };
    } },
    activate: async (cmd, id, kind) => {
      activateCalls++; events.push("activate");
      const result = await service.activate(cmd, id, kind);
      await activationReplyHook?.();
      return result;
    },
    openNative: async (input) => {
      const store = stores.get(input.context.campaignId)!;
      let opening = true;
      const guarded: FileStore = { read: async (path) => { if (opening) input.assertCurrent(); const bytes = await store.read(path); if (opening) input.assertCurrent(); return bytes; }, compareAndWrite: (path, before, after) => store.compareAndWrite(path, before, after) };
      const repository = new AtlasRepository(guarded, manifest.input[0]!.path, store, { locations: true, details: true, resolveDetail: async (_world, kind, id) => [...store.files].filter(([path, bytes]) => path.endsWith("." + kind) && JSON.parse(bytes).id === id).map(([path]) => path) });
      await repository.open(); opening = false;
      const mount: Mounted = { repository, renderer: {}, input, store, blocked: true, resumed: 0, disposed: false, leaveCalls: 0, prepareCalls: 0, focus: null, unsavedKey: false, pendingPublish: false,
        setInputBlocked(blocked) { this.blocked = blocked; return undefined; },
        async prepareNavigation(guard) { this.prepareCalls++; guard(); await this.prepareHook?.(guard); guard(); },
        async prepareLeave(guard) { this.leaveCalls++; events.push("prepareLeave"); guard(); await this.leaveHook?.(guard); guard(); },
        navigate(target, guard) { guard(); this.focus = target; return undefined; },
        resume(guard) { guard(); this.resumed++; this.blocked = false; return undefined; },
        suspend() { return this.pendingPublish ? "publish-pending" : this.unsavedKey || this.repository.dirty && !this.repository.hasDraft ? "blocked-unsaved" : "recoverable"; },
        dispose() { this.disposed = true; return undefined; },
      };
      mounts.push(mount); await openHook?.(); return mount;
    },
  });
  async function open() { await navigation.open(service.context!, worldId); return mounts.at(-1)!; }
  async function request(target: AtlasNavigationTarget): Promise<AtlasNavigationRequest> {
    const s = navigation.state; assert.equal(s.kind, "active"); if (s.kind !== "active") throw new Error();
    const capture = await s.repository.captureNative({ worldId, assertCurrent: s.assertCurrent });
    const record = s.inventory.records.find((r) => r.id === target.recordId)!, owner = s.projection.owners.find((o) => o.ownerId === record.ownerId)!;
    return { context: s.context, worldId, mountGeneration: s.generation, registryRevision: s.projection.registryRevision, projectionDigest: s.projection.projectionDigest, ownerId: owner.ownerId, ownerRevision: owner.ownerRevision, sourceGeneration: owner.source.generation, sourceDigest: capture.sourceDigest, basis: capture.basis, target };
  }
  return { navigation, service, stores, mounts, open, request, readGates, events, projection, activateCalls: () => activateCalls,
    activationReplyHook: (hook?: () => Promise<void>) => { activationReplyHook = hook; },
    verifyHook: (hook?: () => Promise<void>) => { verifyHook = hook; }, openHook: (hook?: () => Promise<void>) => { openHook = hook; },
    registryMode: (v: typeof registryMode) => { registryMode = v; }, verifyMode: (v: typeof verifyMode) => { verifyMode = v; }, inventoryMode: (v: typeof inventoryMode) => { inventoryMode = v; },
    mutateInventory: (fn?: typeof mutateInventory) => { mutateInventory = fn; } };
}
const target = (kind: AtlasNavigationTarget["kind"], documentId: string, recordId = documentId, roomId: string | null = null): AtlasNavigationTarget => ({ kind, documentId, recordId, roomId });
const loc = target("location", id(11)), room = target("room", id(30), id(31));

test("Campaign Atlas navigation uses actual native IDs, relative frames, same Repository/History/renderer and no writes", async () => {
  const f = await fixture(), m = await f.open(), history = m.repository.terrainSource.history, renderer = m.renderer, before = [...m.store.files];
  for (const t of [target("world", worldId), loc, target("location-section", id(11), id(15)), target("city", id(100)), target("building", id(100), id(105)), target("dungeon", id(30)), room, target("room-section", id(30), id(34), id(31))]) {
    await f.navigation.navigate(await f.request(t));
    assert.equal(m.focus!.target.recordId, t.recordId); assert.equal(m.repository.terrainSource.history, history); assert.equal(m.renderer, renderer); assert.equal(f.mounts.length, 1);
  }
  assert.equal(m.focus!.key!.kind, "room"); assert.equal(m.focus!.frame!.metersPerUnit, 1.524);
  assert.deepEqual(m.focus!.frame, m.repository.spatialGraph.frame(id(30)));
  assert.deepEqual([...m.store.files], before); assert.deepEqual(m.store.writes, []); assert.equal(m.blocked, false);
});

test("navigation rejects stale expected Context/Owner/Source/basis and keeps camera and key unchanged", async () => {
  const f = await fixture(), m = await f.open(), req = await f.request(loc);
  for (const patch of [{ worldId: id(999) }, { mountGeneration: req.mountGeneration + 1 }, { ownerId: "foreign" }, { ownerRevision: "owner:2" }, { sourceGeneration: "other" }, { sourceDigest: sha("other") }, { basis: { ...req.basis, historyEpoch: req.basis.historyEpoch + 1 } }, { context: { ...req.context, namespace: campaignNamespace(id(799)) } }])
    await assert.rejects(f.navigation.navigate({ ...req, ...patch }));
  assert.equal(m.focus, null); assert.equal(m.prepareCalls, 0); assert.equal(m.blocked, false); assert.deepEqual(m.store.writes, []);
});

test("unknown/unavailable/stale Registry and foreign/duplicate/unavailable inventory fail without mount activation", async () => {
  for (const mode of ["unknown", "unavailable"] as const) {
    const f = await fixture(); f.registryMode(mode); await assert.rejects(f.open()); assert.equal(f.mounts.length, 0);
    const g = await fixture(); g.inventoryMode(mode); await assert.rejects(g.open()); assert.equal(g.mounts.length, 0);
  }
  for (const mutate of [
    (i: AtlasConfirmedInventory) => ({ ...i, context: { ...i.context, namespace: campaignNamespace(id(799)) } }),
    (i: AtlasConfirmedInventory) => ({ ...i, records: [...i.records, i.records[0]!] }),
    (i: AtlasConfirmedInventory) => ({ ...i, records: i.records.map((r) => r.id === worldId ? { ...r, availability: "unavailable" as const } : r) }),
    (i: AtlasConfirmedInventory) => ({ ...i, files: i.files.map((r) => r.kind === "world" ? { ...r, savedDigest: sha("wrong bytes") } : r) }),
  ]) { const f = await fixture(); f.mutateInventory(mutate); await assert.rejects(f.open()); assert.ok(f.mounts.every((m) => m.resumed === 0)); }
  const f = await fixture(); f.verifyMode("stale"); await assert.rejects(f.open()); assert.equal(f.mounts.length, 0);
});

test("retired targets and missing native sections reject before preparing old keys", async () => {
  const f = await fixture(); f.mutateInventory((i) => ({ ...i, records: i.records.map((r) => r.id === id(11) ? { ...r, availability: "retired" } : r) }));
  const m = await f.open(); await assert.rejects(f.navigation.navigate(await f.request(loc))); assert.equal(m.prepareCalls, 0);
  const req = await f.request(room); await assert.rejects(f.navigation.navigate({ ...req, target: target("room-section", id(30), id(999), id(31)) })); assert.equal(m.focus, null);
});

test("invalid key preparation preserves old target and editability; valid native Key edits remain one History", async () => {
  const f = await fixture(), m = await f.open(); await f.navigation.navigate(await f.request(loc)); const focus = m.focus;
  m.prepareHook = async () => { throw new Error("Ungültiger Key"); };
  await assert.rejects(f.navigation.navigate(await f.request(room)), /Ungültiger Key/); assert.equal(m.focus, focus); assert.equal(m.blocked, false);
  m.prepareHook = async (guard) => {
    guard(); const doc = m.repository.location(id(11))!.read()!;
    m.repository.editLocation({ ...doc, sections: doc.sections.map((s, n) => n ? s : { ...s, markdown: s.markdown + "\nNeuer Keytext" }) });
    guard(); await m.repository.persistDraft(); guard();
  };
  const history = m.repository.terrainSource.history; await f.navigation.navigate(await f.request(room));
  assert.equal(m.repository.terrainSource.history, history); assert.equal(m.focus!.key!.kind, "room"); assert.equal(m.repository.hasDraft, true);
  assert.match(m.repository.location(id(11))!.read()!.sections[0]!.markdown, /Neuer Keytext/);
});

test("actual Source edit/Undo ABA during Registry await rejects same-content request", async () => {
  const f = await fixture(), m = await f.open(), req = await f.request(loc), entered = deferred(), resume = deferred();
  f.verifyHook(async () => { entered.resolve(); await resume.promise; });
  const pending = f.navigation.navigate(req); await entered.promise;
  const doc = m.repository.location(id(11))!.read()!; m.repository.editLocation({ ...doc, name: doc.name + " changed" }); m.repository.terrainSource.history.undo();
  resume.resolve(); await assert.rejects(pending, /Atlasquellstand ist veraltet/); assert.equal(m.focus, null);
});

test("actual local new-terrain draft is navigable without claiming a new confirmed record", async () => {
  const f = await fixture(), m = await f.open(), source = m.repository.terrainSource;
  await source.ensure([{ q: 100, r: 100 }]);
  const stroke = new TerrainStroke(source, "land"); stroke.add({ q: 100, r: 100 }); assert.equal(stroke.finish(), true);
  await f.navigation.navigate(await f.request(room)); assert.equal(m.focus!.key!.kind, "room"); assert.ok(m.repository.dirty);
});

test("requested switch finishes Key/gesture/draft before real activate, preserves draft failure and old Context", async () => {
  const f = await fixture(), m = await f.open(), c = f.service.context!, entered = deferred(), resume = deferred();
  m.leaveHook = async (guard) => { entered.resolve(); await resume.promise; guard(); throw new Error("Draftspeicherung fehlgeschlagen"); };
  const pending = f.navigation.switchCampaign(c, command(2), b, worldId); await entered.promise;
  assert.equal(m.blocked, true); assert.equal(f.activateCalls(), 0); resume.resolve();
  await assert.rejects(pending, /Draftspeicherung/); assert.equal(f.service.context, c); assert.equal(m.blocked, false); assert.equal(m.disposed, false);
  m.leaveHook = async (guard) => {
    guard(); const doc = m.repository.location(id(11))!.read()!; m.repository.editLocation({ ...doc, name: doc.name + " draft" });
    await m.repository.persistDraft(); guard(); f.events.push("draft-retained");
  };
  await f.navigation.switchCampaign(c, command(3), b, worldId);
  assert.deepEqual(f.events.slice(-3), ["prepareLeave", "draft-retained", "activate"]); assert.ok(m.repository.hasDraft); assert.equal(m.disposed, true);
  assert.equal(f.navigation.state.context!.campaignId, b);
});

test("external switch revokes old guard immediately, retains unsaved work and fresh A2 cannot reuse A1 Source/History", async () => {
  const f = await fixture(), old = await f.open(), oldHistory = old.repository.terrainSource.history, oldGuard = old.input.assertCurrent;
  old.unsavedKey = true; await f.service.activate(command(2), b); f.navigation.contextChanged();
  assert.throws(oldGuard, /veraltet/); assert.equal(old.disposed, true); assert.equal(old.blocked, true);
  assert.equal(f.navigation.retainedMounts[0]!.mount, old); assert.equal(f.navigation.retainedMounts[0]!.reason, "blocked-unsaved");
  await f.open(); await f.service.activate(command(3), a); f.navigation.contextChanged(); const a2 = await f.open();
  assert.notEqual(a2.repository.terrainSource.history, oldHistory); assert.notEqual(a2.repository, old.repository); assert.notEqual(a2.input.context.contextToken, old.input.context.contextToken);
  assert.throws(oldGuard, /veraltet/); assert.equal(old.unsavedKey, true);
});

test("late inert A mount cannot activate or alter a newer B mount", async () => {
  const f = await fixture(), entered = deferred(), resume = deferred();
  f.openHook(async () => { entered.resolve(); await resume.promise; });
  const pending = f.open(); await entered.promise; const a1 = f.mounts[0]!;
  await f.service.activate(command(2), b); f.navigation.contextChanged(); f.openHook(); const fresh = await f.open();
  resume.resolve(); await assert.rejects(pending, /veraltet/); assert.equal(a1.resumed, 0); assert.equal(a1.disposed, true); assert.equal(fresh.resumed, 1);
  assert.equal(f.navigation.state.kind, "active"); assert.equal(f.navigation.state.context!.campaignId, b);
});

test("stale actual native open read is rejected before Source hydration or active UI", async () => {
  const f = await fixture(), entered = deferred(), resume = deferred(), store = f.stores.get(a)!;
  store.onRead = async (path) => { if (path !== manifest.input[0]!.path) return; store.onRead = undefined; entered.resolve(); await resume.promise; };
  const pending = f.open(); await entered.promise;
  await f.service.activate(command(2), b); f.navigation.contextChanged(); await f.open(); resume.resolve();
  await assert.rejects(pending, /veraltet/); assert.equal(f.mounts.length, 1); assert.equal(f.navigation.state.context!.campaignId, b); assert.deepEqual(store.writes, []);
});

test("confirmed activation with failed new load or trashed target never rolls back to editable A", async () => {
  const f = await fixture(), m = await f.open(); f.inventoryMode("unavailable");
  await assert.rejects(f.navigation.switchCampaign(f.service.context!, command(2), b, worldId), /nicht bestätigt/);
  assert.equal(f.service.context!.campaignId, b); assert.equal(f.navigation.state.kind, "unavailable"); assert.equal(m.disposed, true); assert.throws(m.input.assertCurrent, /veraltet/);
  const g = await fixture(), old = await g.open(); await assert.rejects(g.navigation.switchCampaign(g.service.context!, command(2), trashed, worldId), /nicht aktuell und aktiv/);
  assert.equal(g.service.context!.lifecycle, "trashed"); assert.equal(g.navigation.state.kind, "unavailable"); assert.equal(old.disposed, true);
});

test("applied=false after superseding actual Lifecycle activation cannot mount its older result", async () => {
  const f = await fixture(), m = await f.open(), gate = deferred<CampaignSnapshotV1 | null>();
  f.readGates.set(b, gate.promise); const pending = f.navigation.switchCampaign(f.service.context!, command(2), b, worldId);
  while (!f.activateCalls()) await Promise.resolve();
  const result = await f.service.activate(command(3), a); gate.resolve(campaignSnapshot({ schemaVersion: 1, campaignId: b, revision: 1, name: "B", namespace: campaignNamespace(id(711)), lifecycle: "active" }));
  await assert.rejects(pending, /nicht aktuell und aktiv/); assert.equal(f.service.context, result.context); assert.equal(m.disposed, true); assert.equal(f.mounts.length, 1);
});

test("late native Capture/context change and Repository Source replacement revoke navigation before effects", async () => {
  const f = await fixture(), m = await f.open(), req = await f.request(room), entered = deferred(), resume = deferred();
  m.store.onRead = async (path) => { if (path !== manifest.input[0]!.path) return; m.store.onRead = undefined; entered.resolve(); await resume.promise; };
  const pending = f.navigation.navigate(req); await entered.promise;
  await f.service.activate(command(2), b); f.navigation.contextChanged(); resume.resolve(); await assert.rejects(pending, /veraltet/); assert.equal(m.focus, null);
  const g = await fixture(), old = await g.open(), before = await g.request(room); await old.repository.discard();
  await assert.rejects(g.navigation.navigate(before), /veraltet/); assert.equal(old.focus, null); assert.equal(old.disposed, true);
});

test("won native save rolls forward only under old paths while its suspended mount cannot touch B", async () => {
  const f = await fixture(), m = await f.open(), entered = deferred(), resume = deferred();
  const doc = m.repository.location(id(11))!.read()!; m.repository.editLocation({ ...doc, name: doc.name + " saved" });
  m.pendingPublish = true;
  m.store.onWrite = async (path) => { if (!path.endsWith(".journal")) return; m.store.onWrite = undefined; entered.resolve(); await resume.promise; };
  const pending = m.repository.save(); await entered.promise;
  await f.service.activate(command(2), b); f.navigation.contextChanged(); const fresh = await f.open(), newFiles = [...fresh.store.files];
  resume.resolve(); await pending; m.pendingPublish = false;
  assert.match(m.store.files.get(`Orte/${id(11)}.location`)!, / saved/); assert.deepEqual([...fresh.store.files], newFiles);
  assert.equal(m.store.files.has(m.repository.journalPath), false); assert.equal(f.navigation.retainedMounts[0]!.reason, "publish-pending"); assert.throws(m.input.assertCurrent, /veraltet/);
});

test("RUNTIME-I01b-R01-01: late applied reply preserves fresh B mount, native Key and UI owners", async () => {
  const f = await fixture(), old = await f.open(), entered = deferred(), reply = deferred();
  f.activationReplyHook(async () => { entered.resolve(); await reply.promise; });
  const pending = f.navigation.switchCampaign(f.service.context!, command(2), b, worldId);
  const outcome = pending.then(() => null, (error: unknown) => error);
  await entered.promise; const confirmed = f.service.context!;
  f.navigation.contextChanged(); const fresh = await f.open();
  await f.navigation.navigate(await f.request(loc));
  const doc = fresh.repository.location(id(11))!.read()!;
  fresh.repository.editLocation({ ...doc, sections: doc.sections.map((s, n) => n ? s : { ...s, markdown: "Ungesicherter B-Key" }) });
  fresh.unsavedKey = true;
  const source = fresh.repository.terrainSource, history = source.history, epoch = history.epoch, focus = fresh.focus;
  reply.resolve(); const error = await outcome;
  assert.equal(fresh.disposed, false); assert.equal(fresh.blocked, false); assert.equal(f.mounts.length, 2);
  const active = f.navigation.state; assert.equal(active.kind, "active");
  if (active.kind === "active") { assert.equal(active.repository, fresh.repository); assert.equal(active.history, history); assert.equal(active.renderer, fresh.renderer); }
  assert.equal(fresh.repository.terrainSource, source); assert.equal(history.epoch, epoch); assert.equal(fresh.focus, focus);
  assert.equal(fresh.repository.location(id(11))!.read()!.sections[0]!.markdown, "Ungesicherter B-Key"); assert.equal(fresh.unsavedKey, true);
  assert.equal(f.service.context, confirmed); fresh.input.assertCurrent(); assert.equal(old.disposed, true);
  assert.match(String(error), /neueren Atlasauftrag/); assert.deepEqual(fresh.store.writes, []);
});

test("RUNTIME-I01b-R01-01: late applied reply cannot overtake pending B open or release its lock", async () => {
  const f = await fixture(); await f.open();
  const entered = deferred(), reply = deferred(), openEntered = deferred(), openResume = deferred();
  f.activationReplyHook(async () => { entered.resolve(); await reply.promise; });
  const pending = f.navigation.switchCampaign(f.service.context!, command(2), b, worldId);
  const outcome = pending.then(() => null, (error: unknown) => error);
  await entered.promise; const confirmed = f.service.context!; f.navigation.contextChanged();
  f.openHook(async () => { f.openHook(); openEntered.resolve(); await openResume.promise; });
  const opening = f.open(); const openOutcome = opening.then((mount) => ({ mount }), (error: unknown) => ({ error }));
  await openEntered.promise; const fresh = f.mounts[1]!; fresh.unsavedKey = true;
  try {
    reply.resolve(); const error = await outcome;
    assert.match(String(error), /neueren Atlasauftrag/); assert.equal(f.mounts.length, 2); assert.equal(fresh.disposed, false);
    fresh.input.assertCurrent(); assert.equal(fresh.resumed, 0);
    await assert.rejects(f.navigation.open(confirmed, worldId), /beschäftigt/);
  } finally { openResume.resolve(); }
  const opened = await openOutcome; assert.ok("mount" in opened); if ("mount" in opened) assert.equal(opened.mount, fresh);
  assert.equal(fresh.resumed, 1); assert.equal(fresh.disposed, false); assert.equal(fresh.unsavedKey, true);
  assert.equal(f.service.context, confirmed); fresh.input.assertCurrent(); assert.equal(f.mounts.length, 2);
});

test("RUNTIME-I01b-R01-01: failed newer B open is not retried by obsolete applied reply", async () => {
  const f = await fixture(); await f.open(); const entered = deferred(), reply = deferred();
  f.activationReplyHook(async () => { entered.resolve(); await reply.promise; });
  const pending = f.navigation.switchCampaign(f.service.context!, command(2), b, worldId);
  const outcome = pending.then(() => null, (error: unknown) => error);
  await entered.promise; const confirmed = f.service.context!; f.navigation.contextChanged();
  f.inventoryMode("unavailable"); await assert.rejects(f.open(), /nicht bestätigt/);
  const state = f.navigation.state; f.inventoryMode("confirmed"); reply.resolve(); const error = await outcome;
  assert.match(String(error), /neueren Atlasauftrag/); assert.deepEqual(f.navigation.state, state);
  assert.equal(f.service.context, confirmed); assert.equal(f.mounts.length, 1);
});

test("RUNTIME-I01b-R01-01: Context notification alone still allows original switch to mount confirmed B", async () => {
  const f = await fixture(); const old = await f.open(), entered = deferred(), reply = deferred();
  f.activationReplyHook(async () => { entered.resolve(); await reply.promise; });
  const pending = f.navigation.switchCampaign(f.service.context!, command(2), b, worldId);
  await entered.promise; const confirmed = f.service.context!; f.navigation.contextChanged();
  reply.resolve(); const result = await pending;
  assert.equal(result.applied, true); assert.equal(result.context, confirmed); assert.equal(f.service.context, confirmed);
  assert.equal(f.mounts.length, 2); assert.equal(old.disposed, true); assert.equal(f.mounts[1]!.resumed, 1);
  assert.equal(f.navigation.state.kind, "active"); assert.deepEqual(f.navigation.state.context, confirmed);
});
