import test from "node:test";
import assert from "node:assert/strict";
import { campaignContext, campaignContextToken, campaignId, campaignLocalId,
  campaignNamespace, campaignRevision, campaignSnapshot } from "../../../src/features/campaign/campaign-contracts";
import { changeWorldNotes, emptyWorldNotes, searchWorldNotes, worldNotesSnapshot,
  type WorldNoteDraft } from "../../../src/features/world/world-notes";

const campaign = campaignSnapshot({ schemaVersion: 1,
  campaignId: campaignId("00000000-0000-4000-8000-000000000001"),
  namespace: campaignNamespace("00000000-0000-4000-8000-000000000002"),
  revision: campaignRevision(1), name: "Welt", lifecycle: "active" });
const context = campaignContext(campaign, campaignContextToken("world:one"));
const otherContext = campaignContext(campaign, campaignContextToken("world:two"));
const npcId = campaignLocalId("00000000-0000-4000-8000-000000000010");
const factionId = campaignLocalId("00000000-0000-4000-8000-000000000011");
const draft = (kind: WorldNoteDraft["kind"], title: string): WorldNoteDraft => ({
  kind, title, readAloud: "  Vorlesen:\nDer Mond steigt.  \n",
  gmNotes: "# Geheim\n\n[[Alte Mühle]]\n", relations: [], creatureId: null,
});

test("authored prose, stable identities, relationship and search survive immutable snapshots", () => {
  const first = emptyWorldNotes(context);
  const faction = changeWorldNotes(first, context, context, first.revision,
    { kind: "create", id: factionId, draft: draft("faction", "Nebelbund") });
  const npcDraft = { ...draft("npc", "Älva"), creatureId: "srd-2014:wizard",
    relations: [{ targetId: factionId, label: "Mitglied" }] };
  const npc = changeWorldNotes(faction, context, context, faction.revision,
    { kind: "create", id: npcId, draft: npcDraft });
  npcDraft.relations[0]!.label = "verändert";
  assert.equal(npc.records.find((record) => record.id === npcId)!.relations[0]!.label, "Mitglied");
  assert.deepEqual(new Set(searchWorldNotes(npc, "mond").map((record) => record.id)),
    new Set([factionId, npcId]));
  assert.equal(searchWorldNotes(npc, "geheim", ["npc"])[0]?.id, npcId);
  assert.deepEqual(searchWorldNotes(npc, "nebelbund", ["npc"]).map((record) => record.id), [npcId]);
  assert.deepEqual(searchWorldNotes(npc, "mitglied", ["npc"]).map((record) => record.id), [npcId]);
  assert.deepEqual(searchWorldNotes(npc, "WIZARD", ["npc"]).map((record) => record.id), [npcId]);
  assert.deepEqual(searchWorldNotes(npc, "srd-2014:wizard", ["faction"]), []);
  assert.deepEqual(searchWorldNotes(npc, "mitglied", ["quest"]), []);
  const reopened = worldNotesSnapshot(JSON.parse(JSON.stringify(npc)));
  assert.deepEqual(reopened, npc);
  const reopenedNpc = reopened.records.find((record) => record.id === npcId)!;
  assert.equal(reopenedNpc.readAloud, "  Vorlesen:\nDer Mond steigt.  \n");
  assert.equal(reopenedNpc.gmNotes, "# Geheim\n\n[[Alte Mühle]]\n");
  assert(Object.isFrozen(reopenedNpc.relations[0]));
});

test("stale context, revision, broken relation and deletion fail before changing the input", () => {
  const empty = emptyWorldNotes(context);
  const faction = changeWorldNotes(empty, context, context, 1,
    { kind: "create", id: factionId, draft: draft("faction", "Nebelbund") });
  const npc = changeWorldNotes(faction, context, context, 2,
    { kind: "create", id: npcId, draft: { ...draft("npc", "Älva"),
      relations: [{ targetId: factionId, label: "Mitglied" }] } });
  const before = JSON.stringify(npc);
  assert.throws(() => changeWorldNotes(npc, context, otherContext, 3,
    { kind: "delete", id: factionId, expectedRevision: 1 }), /Kontext/);
  assert.throws(() => changeWorldNotes(npc, context, context, 2,
    { kind: "delete", id: factionId, expectedRevision: 1 }), /Bestand/);
  assert.throws(() => changeWorldNotes(npc, context, context, 3,
    { kind: "delete", id: factionId, expectedRevision: 1 }), /verknüpft/);
  assert.throws(() => changeWorldNotes(npc, context, context, 3,
    { kind: "create", id: campaignLocalId("00000000-0000-4000-8000-000000000099"),
      draft: { ...draft("quest", "Auftrag"), relations: [{ targetId: campaignLocalId("00000000-0000-4000-8000-000000000098"), label: "Quelle" }] } }), /Beziehung/);
  assert.equal(JSON.stringify(npc), before);
});

test("explicit unlink then tombstone keeps original prose and prevents identity reuse", () => {
  let snapshot = emptyWorldNotes(context);
  snapshot = changeWorldNotes(snapshot, context, context, snapshot.revision,
    { kind: "create", id: factionId, draft: draft("faction", "Nebelbund") });
  snapshot = changeWorldNotes(snapshot, context, context, snapshot.revision,
    { kind: "create", id: npcId, draft: { ...draft("npc", "Älva"),
      relations: [{ targetId: factionId, label: "Mitglied" }] } });
  snapshot = changeWorldNotes(snapshot, context, context, snapshot.revision,
    { kind: "update", id: npcId, expectedRevision: 1, draft: draft("npc", "Älva") });
  snapshot = changeWorldNotes(snapshot, context, context, snapshot.revision,
    { kind: "delete", id: factionId, expectedRevision: 1 });
  assert.deepEqual(searchWorldNotes(snapshot, "Nebelbund"), []);
  assert.equal(snapshot.records.find((record) => record.id === factionId)!.gmNotes,
    "# Geheim\n\n[[Alte Mühle]]\n");
  assert.throws(() => changeWorldNotes(snapshot, context, context, snapshot.revision,
    { kind: "create", id: factionId, draft: draft("faction", "Ersatz") }), /vergeben/);
});
