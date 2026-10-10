import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  campaignCommandId,
  campaignContext,
  campaignContextToken,
  campaignLocalId,
} from "../../src/features/campaign/campaign-contracts";
import { campaignOwnershipDigestValue } from "../../src/features/campaign/campaign-ownership";
import { parseCampaignRuntimeManifest } from "../../src/features/campaign/campaign-runtime-source";
import {
  WorldNotesCampaignCommitParticipant,
  type WorldNotesCommitReceiptV1,
  worldNotePath,
} from "../../src/features/campaign/world-notes-commit";
import {
  changeWorldNotes,
  emptyWorldNotes,
  serializeWorldNote,
} from "../../src/features/world/world-notes";
import {
  FileTransaction,
  type AtlasFileJournal,
} from "../../src/features/atlas/file-transaction";
import { FileConflict, type FileStore } from "../../src/persistence";

const root = "tests/fixtures/atlas-e2e-spatial-v2/";
const fixture = JSON.parse(readFileSync(root + "manifest.json", "utf8"));
const manifestPath = fixture.campaign.path as string;
const manifestBytes = readFileSync(root + fixture.campaign.input.fixtureFile, "utf8");
const sha = (text: string) =>
  "sha256:" + createHash("sha256").update(text).digest("hex");
const id = (n: number) =>
  campaignLocalId(`00000000-0000-4000-8000-${String(n).padStart(12, "0")}`);

function context() {
  const manifest = parseCampaignRuntimeManifest(manifestBytes, sha);
  return campaignContext(manifest.snapshot, campaignContextToken("world-notes:test"));
}

function journal(writes: readonly { path: string; before: string | null; after: string | null }[]): AtlasFileJournal {
  return {
    kind: "atlas-file-transaction",
    version: 1,
    journalPath: "Kampagnen/SaltMarcher/world-notes.journal",
    transactionId: "00000000-0000-4000-8000-000000000999",
    state: "committed",
    writes,
  };
}

function nativeWrites(
  before: ReturnType<typeof emptyWorldNotes>,
  after: ReturnType<typeof emptyWorldNotes>,
) {
  return after.records.map((record) => {
    const old = before.records.find((candidate) => candidate.id === record.id);
    return {
      path: worldNotePath(after.namespace, record.kind, record.id),
      before: old ? serializeWorldNote(old) : null,
      after: serializeWorldNote(record),
    };
  });
}

class Store implements FileStore {
  readonly files = new Map<string, string>();
  async read(path: string) { return this.files.get(path) ?? null; }
  async compareAndWrite(path: string, before: string | null, after: string | null) {
    if ((this.files.get(path) ?? null) !== before) throw new FileConflict(path);
    if (after === null) this.files.delete(path); else this.files.set(path, after);
  }
}

test("World Notes producer binds create/update/delete bytes, owner closure, recovery and receipt", () => {
  const ctx = context(), before = emptyWorldNotes(ctx), noteId = id(901),
    create = {
      kind: "create" as const,
      id: noteId,
      draft: {
        kind: "npc" as const,
        title: "Magistra Vey",
        readAloud: "Ein silberner Mantel.",
        gmNotes: "Kennt den versunkenen Weg.",
        relations: [],
        creatureId: "catalog:srd51:wizard",
      },
    },
    afterCreate = changeWorldNotes(before, ctx, ctx, before.revision, create),
    creator = new WorldNotesCampaignCommitParticipant(manifestPath, manifestBytes, sha),
    preparedCreate = creator.prepare({
      commandId: campaignCommandId("00000000-0000-4000-8000-000000000910"),
      context: ctx,
      beforeSnapshot: before,
      afterSnapshot: afterCreate,
      change: create,
      nativeWrites: nativeWrites(before, afterCreate),
    }),
    createJournal = journal(preparedCreate.writes);
  assert.equal(
    preparedCreate.notePath,
    worldNotePath(ctx.namespace, "npc", noteId),
  );
  creator.validateRecovery(createJournal);
  const receipt = creator.createReceipt(preparedCreate, createJournal);
  creator.validateReceipt(receipt);
  assert.throws(
    () => creator.createReceipt(preparedCreate, createJournal),
    /bereits verbraucht/,
  );
  assert.equal(receipt.recordId, noteId);
  assert.equal(receipt.beforeRecordRevision, null);
  assert.equal(receipt.afterRecordRevision, 1);
  assert.equal(receipt.deleted, false);
  assert.throws(() =>
    new WorldNotesCampaignCommitParticipant(manifestPath, manifestBytes, sha)
      .validateReceipt(receipt), /Producer/);

  const createdManifestBytes = preparedCreate.writes.find((write) => write.path === manifestPath)!.after!,
    createdManifest = parseCampaignRuntimeManifest(createdManifestBytes, sha),
    worldOwner = createdManifest.registry.owners.find((owner) => owner.ownerId === "world-notes")!;
  assert.ok(worldOwner);
  assert.deepEqual(
    worldOwner.records[0]!.references,
    [{ id: "catalog:srd51:wizard", scope: "shared", schema: "catalog-entry.v1" }],
  );
  assert.deepEqual(
    createdManifest.registry.owners
      .filter((owner) => owner.ownerId !== "world-notes"),
    parseCampaignRuntimeManifest(manifestBytes, sha).registry.owners,
  );

  const update = {
      kind: "update" as const,
      id: noteId,
      expectedRevision: 1,
      draft: { ...create.draft, title: "Magistra Vey II" },
    },
    afterUpdate = changeWorldNotes(afterCreate, ctx, ctx, afterCreate.revision, update),
    updater = new WorldNotesCampaignCommitParticipant(manifestPath, createdManifestBytes, sha),
    preparedUpdate = updater.prepare({
      commandId: campaignCommandId("00000000-0000-4000-8000-000000000911"),
      context: ctx,
      beforeSnapshot: afterCreate,
      afterSnapshot: afterUpdate,
      change: update,
      nativeWrites: nativeWrites(afterCreate, afterUpdate),
    });
  updater.validateRecovery(journal(preparedUpdate.writes));
  assert.equal(preparedUpdate.afterSnapshot.records[0]!.revision, 2);

  const updatedManifestBytes = preparedUpdate.writes.find((write) => write.path === manifestPath)!.after!,
    remove = { kind: "delete" as const, id: noteId, expectedRevision: 2 },
    afterDelete = changeWorldNotes(afterUpdate, ctx, ctx, afterUpdate.revision, remove),
    remover = new WorldNotesCampaignCommitParticipant(manifestPath, updatedManifestBytes, sha),
    preparedDelete = remover.prepare({
      commandId: campaignCommandId("00000000-0000-4000-8000-000000000912"),
      context: ctx,
      beforeSnapshot: afterUpdate,
      afterSnapshot: afterDelete,
      change: remove,
      nativeWrites: nativeWrites(afterUpdate, afterDelete),
    });
  remover.validateRecovery(journal(preparedDelete.writes));
  const tombstone = preparedDelete.afterSnapshot.records[0]!;
  assert.equal(tombstone.deleted, true);
  assert.equal(tombstone.kind, "npc");
  assert.equal(tombstone.creatureId, "catalog:srd51:wizard");
  assert.equal(tombstone.title, "Magistra Vey II");
  assert.deepEqual(tombstone.relations, []);
});

test("World Notes producer rejects unrelated confirmation, forged tombstone and incomplete recovery", () => {
  const ctx = context(), before = emptyWorldNotes(ctx), noteId = id(920),
    create = {
      kind: "create" as const,
      id: noteId,
      draft: { kind: "npc" as const, title: "Requested", readAloud: "", gmNotes: "",
        relations: [], creatureId: "catalog:srd51:wizard" },
    },
    expected = changeWorldNotes(before, ctx, ctx, before.revision, create),
    participant = new WorldNotesCampaignCommitParticipant(manifestPath, manifestBytes, sha);
  const unrelated = {
    ...expected,
    records: [{ ...expected.records[0]!, id: id(921), title: "Unrelated" }],
  };
  assert.throws(() => participant.prepare({
    commandId: campaignCommandId("00000000-0000-4000-8000-000000000930"),
    context: ctx,
    beforeSnapshot: before,
    afterSnapshot: unrelated,
    change: create,
    nativeWrites: nativeWrites(before, unrelated),
  }), /angeforderte Änderung/);

  const prepared = participant.prepare({
    commandId: campaignCommandId("00000000-0000-4000-8000-000000000931"),
    context: ctx,
    beforeSnapshot: before,
    afterSnapshot: expected,
    change: create,
    nativeWrites: nativeWrites(before, expected),
  });
  assert.throws(() => participant.validateRecovery(journal(prepared.writes.slice(1))), /unvollständig/);

  const copied = {
    ...prepared,
    commandId: campaignCommandId("00000000-0000-4000-8000-000000000934"),
    changeDigest: `sha256:${"0".repeat(64)}`,
    context: { ...prepared.context, contextToken: campaignContextToken("world-notes:forged") },
  };
  assert.throws(
    () => participant.createReceipt(copied, journal(prepared.writes)),
    /nicht aus diesem Producer/,
  );

  const forgedOwnerManifest = JSON.parse(
    prepared.writes.find((write) => write.path === manifestPath)!.after!,
  );
  const policyRevision = "policy:foreign:v1";
  forgedOwnerManifest.registry.owners.push({
    ownerId: "foreign-owner",
    ownerRevision: "owner:foreign:v1",
    schemaRevision: "schema:foreign:v1",
    snapshotRevision: "snapshot:foreign:v1",
    policyRevision,
    policyDigest: campaignOwnershipDigestValue(
      { ownerId: "foreign-owner", policyRevision, transferPolicies: [] },
      sha,
    ),
    availability: "confirmed",
    emptyConfirmed: true,
    referenceSchemas: ["foreign.v1"],
    source: { adapterType: "native-foreign", generation: "source:foreign:v1" },
    records: [],
    transferPolicies: [],
  });
  forgedOwnerManifest.registry.owners.sort((a: { ownerId: string }, b: { ownerId: string }) =>
    a.ownerId.localeCompare(b.ownerId));
  const { registryContentDigest: _registryContentDigest, ...unsignedRegistry } =
    forgedOwnerManifest.registry;
  unsignedRegistry.registryRevision = "registry:foreign:v1";
  forgedOwnerManifest.registry = {
    ...unsignedRegistry,
    registryContentDigest: campaignOwnershipDigestValue(unsignedRegistry, sha),
  };
  const forgedOwnerBytes = JSON.stringify(forgedOwnerManifest, null, 2) + "\n";
  parseCampaignRuntimeManifest(forgedOwnerBytes, sha);
  assert.throws(() => participant.validateRecovery(journal(
    prepared.writes.map((write) => write.path === manifestPath
      ? { ...write, after: forgedOwnerBytes }
      : write),
  )), /fremden Owner/);

  const remove = { kind: "delete" as const, id: noteId, expectedRevision: 1 },
    deleted = changeWorldNotes(expected, ctx, ctx, expected.revision, remove),
    forged = {
      ...deleted,
      records: [{ ...deleted.records[0]!, kind: "quest" as const, creatureId: null }],
    },
    nextManifest = prepared.writes.find((write) => write.path === manifestPath)!.after!,
    remover = new WorldNotesCampaignCommitParticipant(manifestPath, nextManifest, sha);
  assert.throws(() => remover.prepare({
    commandId: campaignCommandId("00000000-0000-4000-8000-000000000932"),
    context: ctx,
    beforeSnapshot: expected,
    afterSnapshot: forged,
    change: remove,
    nativeWrites: nativeWrites(expected, forged),
  }), /angeforderte Änderung/);

  assert.throws(() => participant.prepare({
    commandId: campaignCommandId("00000000-0000-4000-8000-000000000933"),
    context: ctx,
    beforeSnapshot: before,
    afterSnapshot: expected,
    change: create,
    nativeWrites: [],
  }), /vollständig/);

  const forgedJournal = journal(prepared.writes.map((write) =>
    write.path === prepared.notePath && write.after !== null
      ? { ...write, after: write.after.replace("\n}", ",\n  \"foreign\": true\n}") }
      : write));
  assert.throws(() => participant.validateRecovery(forgedJournal), /kausalen nativen/);
});

test("World Notes commit runs through the actual FileTransaction and emits only a committed causal receipt", async () => {
  const ctx = context(), before = emptyWorldNotes(ctx), noteId = id(940),
    change = {
      kind: "create" as const,
      id: noteId,
      draft: { kind: "rumor" as const, title: "Die Glocke", readAloud: "Sie läutet nachts.",
        gmNotes: "Unter dem alten Kai.", relations: [], creatureId: null },
    },
    after = changeWorldNotes(before, ctx, ctx, before.revision, change),
    participant = new WorldNotesCampaignCommitParticipant(manifestPath, manifestBytes, sha),
    prepared = participant.prepare({
      commandId: campaignCommandId("00000000-0000-4000-8000-000000000941"),
      context: ctx,
      beforeSnapshot: before,
      afterSnapshot: after,
      change,
      nativeWrites: nativeWrites(before, after),
    }),
    store = new Store(), journalPath = "Kampagnen/SaltMarcher/world-notes.journal";
  store.files.set(manifestPath, manifestBytes);
  let receipt: WorldNotesCommitReceiptV1 | undefined;
  const transaction = new FileTransaction(
    store,
    journalPath,
    (path) => prepared.writes.some((write) => write.path === path),
    store,
    (value) => participant.validateRecovery(value),
  );
  assert.equal(await transaction.commit(prepared.writes, {
    prepared: (value) => participant.validateRecovery(value),
    committed: (value) => { receipt = participant.createReceipt(prepared, value); },
    rolledBack: () => { throw new Error("Unerwarteter Rollback."); },
  }), true);
  assert.equal(await store.read(journalPath), null);
  assert.equal(await store.read(prepared.notePath), serializeWorldNote(after.records[0]!));
  assert.equal(await store.read(manifestPath), prepared.writes.find((write) => write.path === manifestPath)!.after);
  assert.ok(receipt);
  participant.validateReceipt(receipt);
});
