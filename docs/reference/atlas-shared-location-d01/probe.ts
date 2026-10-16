// #40 D01: diagnostic counterprobe, no product patch and no Obsidian/GUI claim.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { AtlasCampaignManifestSave } from "../../../src/features/atlas/atlas-campaign-save";
import { AtlasRepository } from "../../../src/features/atlas/atlas-repository";
import { AtlasCampaignNavigation } from "../../../src/features/atlas/atlas-campaign-navigation";
import { CampaignRuntimeManifestSaveParticipant } from "../../../src/features/campaign/campaign-runtime-save-participant";
import { CampaignRuntimeSource, CampaignRuntimeNavigationProvider, parseCampaignRuntimeManifest } from "../../../src/features/campaign/campaign-runtime-source";
import { CampaignLifecycle } from "../../../src/features/campaign/campaign-lifecycle";
import { campaignCommandId, campaignContextToken, campaignNamespace, campaignReceiptId } from "../../../src/features/campaign/campaign-contracts";
import { parseLocationDocument } from "../../../src/features/location/location-schema";
import { FileConflict, type FileStore } from "../../../src/persistence";
import type { AtlasSpatialOptions } from "../../../src/features/atlas/detail-owners";

const root = process.argv[2]!;
const fixtureRoot = join(root, "tests/fixtures/atlas-e2e-spatial-v2");
const h01 = join(root, "docs/reference/atlas-shared-location-h01/raw");
const fixture = JSON.parse(readFileSync(join(fixtureRoot, "manifest.json"), "utf8"));
const sha = (bytes: string) => "sha256:" + createHash("sha256").update(bytes).digest("hex");
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const worldPath = fixture.input[0].path as string, campaignPath = fixture.campaign.path as string;
const created = JSON.parse(readFileSync(join(h01, "02-created.json"), "utf8"));
const moved = JSON.parse(readFileSync(join(h01, "04-marker-moved.json"), "utf8"));
const locationPath = "Orte/" + moved.location.id + ".location";

class Store implements FileStore {
  readonly files = new Map<string, string>();
  readonly writes: { path: string; before: string | null; after: string | null }[] = [];
  constructor() {
    for (const row of [...fixture.input, { path: campaignPath, ...fixture.campaign.input }]) {
      const bytes = readFileSync(join(fixtureRoot, row.fixtureFile), "utf8");
      assert.equal(sha(bytes), "sha256:" + row.sha256);
      this.files.set(row.path, bytes);
    }
  }
  async read(path: string) { return this.files.get(path) ?? null; }
  async compareAndWrite(path: string, before: string | null, after: string | null) {
    if ((this.files.get(path) ?? null) !== before) throw new FileConflict(path);
    this.writes.push({ path, before, after });
    if (after === null) this.files.delete(path); else this.files.set(path, after);
  }
}
function options(store: Store, adapter = new AtlasCampaignManifestSave(campaignPath, store.files.get(campaignPath)!, sha)): AtlasSpatialOptions {
  return { locations: true, details: true, campaignSave: adapter,
    resolveLocation: async (id) => [...store.files].find(([p, b]) => p.endsWith(".location") && JSON.parse(b).id === id)?.[0] ?? "Orte/" + id + ".location",
    resolveDetail: async (_world, kind, id) => [...store.files].filter(([p, b]) => p.endsWith("." + kind) && JSON.parse(b).id === id).map(([p]) => p) };
}
function reproduce(repo: AtlasRepository) {
  const source = repo.terrainSource!, original = source.placements();
  const placement = created.placements.find((p: any) => p.locationId === created.location.id);
  assert.equal(repo.createLocation(created.location, placement), true);
  assert.equal(source.history.undoDepth, 1);
  source.history.undo(); assert.deepEqual(source.placements(), original);
  source.history.redo(); assert.deepEqual(repo.location(created.location.id).read(), created.location);
  assert.equal(repo.editLocation(moved.location), true);
  assert.equal(repo.moveLocation(moved.location.id, moved.placements.find((p: any) => p.locationId === moved.location.id).position), true);
  assert.equal(source.history.undoDepth, 3);
  assert.deepEqual(source.placements(), moved.placements);
  assert.deepEqual(repo.location(moved.location.id).read(), moved.location);
}
const failure = async (run: () => Promise<unknown>) => {
  try { await run(); } catch (error) { assert(error instanceof Error); return { message: error.message, stack: error.stack }; }
  assert.fail("Expected the currently failing production boundary");
};
async function mounted() {
  const store = new Store(), inputManifest = store.files.get(campaignPath)!;
  const manifest = parseCampaignRuntimeManifest(inputManifest, sha);
  const source = new CampaignRuntimeSource({ list: async () => [{ path: campaignPath, bytes: store.files.get(campaignPath)! }] }, sha);
  const lifecycle = new CampaignLifecycle(source.lifecycle, { campaignId: () => manifest.snapshot.campaignId,
    namespace: () => campaignNamespace(id(2)), contextToken: () => campaignContextToken("d01:" + id(992)), receiptId: () => campaignReceiptId(id(990)) });
  const provider = new CampaignRuntimeNavigationProvider(source, lifecycle);
  await provider.activate(campaignCommandId(id(991)), manifest.snapshot.campaignId, "open");
  const events: unknown[] = []; let calls = 0, repo!: AtlasRepository;
  const navigation = new AtlasCampaignNavigation({ currentContext: provider.currentContext, registry: provider.registry, inventory: provider.inventory,
    activate: (command, campaignId, kind) => provider.activate(command, campaignId, kind),
    openNative: async (input) => {
      repo = new AtlasRepository(store, worldPath, store, { ...options(store), assertCurrent: input.assertCurrent });
      await repo.open();
      const save = repo.save.bind(repo);
      repo.save = async () => { calls++; return save(); }; // Observer only: calls the unchanged real save.
      return { repository: repo, renderer: Object.freeze({}), setInputBlocked: (blocked) => events.push({ blocked }),
        prepareNavigation: async (guard) => guard(), prepareLeave: async (guard) => { guard(); await repo.persistDraft(); guard(); },
        navigate: (_target, guard) => guard(), resume: (guard) => guard(),
        suspend: (reason) => { events.push({ suspended: reason }); return "recoverable"; }, dispose: () => events.push({ disposed: true }) };
    } });
  await navigation.open(provider.currentContext()!, manifest.atlas.worldId);
  assert.equal(navigation.state.kind, "active");
  return { store, repo, navigation, provider, events, saveCalls: () => calls };
}

async function main() {
  const baseline = await mounted();
  await baseline.navigation.save();
  assert.equal(baseline.saveCalls(), 1); assert.equal(baseline.navigation.state.kind, "active");
  assert.equal(baseline.repo.dirty, false);
  const original = new Store().files;
  for (const [p, bytes] of original) assert.equal(baseline.store.files.get(p), bytes);

  const f = await mounted(), context = f.provider.currentContext();
  reproduce(f.repo); await f.repo.persistDraft();
  const snapshot = new Map(f.store.files), priorWrites = f.store.writes.length;
  const draft = f.store.files.get(worldPath + ".draft")!, history = f.repo.terrainSource!.history;
  const retainedDraft = readFileSync(join(h01, "retained-location.draft"), "utf8");
  assert.equal(draft, retainedDraft, "Exact H01 retained draft bytes must be reproduced");
  const before = f.navigation.state;
  assert.equal(before.kind, "active");
  const captured = await f.repo.captureNative({ worldId: before.inventory.worldId, assertCurrent: before.assertCurrent });
  const newFile = captured.files.find((file) => file.path === locationPath)!;
  assert.equal(newFile.before, null); assert.equal(newFile.beforeDigest, null);
  assert.equal(before.inventory.files.some((file) => file.path === locationPath), false);
  const navFailure = await failure(() => f.navigation.save());
  assert.equal(navFailure.message, "Native Atlasdatei passt nicht zur bestätigten Basis.");
  assert.equal(f.saveCalls(), 0); assert.equal(f.store.writes.length - priorWrites, 0);
  assert.deepEqual([...f.store.files], [...snapshot]);
  assert.deepEqual(f.provider.currentContext(), context);
  assert.equal(f.navigation.state.kind, "unavailable");
  assert.equal(f.navigation.state.reason, "Speicherbasis ist unbestätigt; Atlas unter seiner alten Identität erhalten.");
  assert.equal(f.events.filter((e: any) => e.disposed).length, 1);
  assert.equal(f.repo.terrainSource!.history, history); assert.equal(history.undoDepth, 3);
  assert.deepEqual(f.repo.location(moved.location.id).read(), moved.location);
  assert.equal(f.store.files.get(worldPath + ".draft"), draft);

  const directStore = new Store(), direct = new AtlasRepository(directStore, worldPath, directStore, options(directStore));
  await direct.open(); reproduce(direct); await direct.persistDraft();
  const directBefore = new Map(directStore.files), directPrior = directStore.writes.length;
  const adapterFailure = await failure(() => direct.save());
  assert.equal(adapterFailure.message, "Campaign-Save benötigt den vollständigen nativen Bestand.");
  assert.equal(directStore.writes.length - directPrior, 0); assert.deepEqual([...directStore.files], [...directBefore]);

  // Control: the adapter can save payload changes on an already confirmed Location.
  const knownStore = new Store(), known = new AtlasRepository(knownStore, worldPath, knownStore, options(knownStore));
  await known.open(); await known.ensureLocation(id(11));
  const knownLocation = known.location(id(11)).read()!;
  assert.equal(known.editLocation({ ...knownLocation, name: "D01 bekannter Ort" }), true);
  await known.persistDraft(); await known.save(); assert.equal(known.dirty, false);
  const savedKnown = parseCampaignRuntimeManifest(knownStore.files.get(campaignPath)!, sha);
  assert.notEqual(savedKnown.registry.registryRevision, parseCampaignRuntimeManifest(original.get(campaignPath)!, sha).registry.registryRevision);
  assert.equal(parseLocationDocument(knownStore.files.get("Orte/" + id(11) + ".location")!).name, "D01 bekannter Ort");

  // Isolate the Campaign participant too, without bypassing any actual product guard.
  const manifest = parseCampaignRuntimeManifest(original.get(campaignPath)!, sha);
  let authorityCalls = 0;
  const participant = new CampaignRuntimeManifestSaveParticipant(campaignPath, sha,
    manifest.registry.owners.map((owner) => ({ ownerId: owner.ownerId, verify: () => { authorityCalls++; } })));
  const participantFailure = await failure(async () => participant.prepare({ beforeManifestBytes: original.get(campaignPath)!,
    nativeWrites: captured.files, beforeOwners: manifest.registry.owners, afterOwners: manifest.registry.owners }));
  assert.equal(participantFailure.message, "Fremdes oder doppeltes natives Speicherziel.");
  assert.equal(authorityCalls, 0);
  const baselineWrites = manifest.atlas.files.map((file) => ({ path: file.path, before: original.get(file.path)!, after: original.get(file.path)! }));
  const addedRecord = { ...manifest.registry.owners.find((o) => o.ownerId === "atlas")!.records.find((r) => r.recordType === "location")!, id: moved.location.id };
  const closureFailure = await failure(async () => participant.prepare({ beforeManifestBytes: original.get(campaignPath)!,
    nativeWrites: baselineWrites, beforeOwners: manifest.registry.owners,
    afterOwners: manifest.registry.owners.map((owner) => owner.ownerId === "atlas" ? { ...owner, records: [...owner.records, addedRecord] } : owner) }));
  assert.equal(closureFailure.message, "Owner-Closure wurde im lokalen Save verändert.");
  assert.equal(authorityCalls, 0);

  console.log(JSON.stringify({ id: "E2E-01-SHARED-LOCATION-KEY-D01", state: "PASS_diagnosis_only_actual_product_failure_reproduced",
    fixtureVersion: fixture.fixtureVersion, finding: "SHARED-LOCATION-H01-SAVE-01",
    locationId: moved.location.id, placementId: moved.placements.find((p: any) => p.locationId === moved.location.id).id,
    sections: moved.location.sections.map((s: any) => s.id),
    controls: { navigationNoopSaveCalls: baseline.saveCalls(), navigationNoopRemainsActive: true, confirmedLocationEditSaved: true },
    navigation: { error: navFailure, saveCalls: f.saveCalls(), writesAfterSaveRequest: 0, nativeBeforeUnchanged: true, draftUnchanged: true,
      exactH01DraftReproduced: true, draftSha256: sha(draft),
      providerContextUnchanged: true, state: f.navigation.state, events: f.events, sameHistory: true, undoDepth: history.undoDepth },
    directRepository: { error: adapterFailure, writesAfterSaveRequest: 0, beforeUnchanged: true },
    participant: { newPathError: participantFailure, newOwnerRecordError: closureFailure, authorityCalls },
    capture: { fileCount: captured.files.length, confirmedFileCount: before.inventory.files.length,
      newFile: { kind: newFile.kind, id: newFile.id, path: newFile.path, before: newFile.before, beforeDigest: newFile.beforeDigest, afterDigest: newFile.afterDigest } },
    nativeProbeRepeated: false, productPatched: false, guiSlotUsed: false, fullE2E: false }, null, 2));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
