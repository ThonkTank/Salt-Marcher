import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { campaignCommandId, campaignContext, campaignContextToken, campaignLocalId } from
  "../../src/features/campaign/campaign-contracts";
import { parseCampaignRuntimeManifest } from "../../src/features/campaign/campaign-runtime-source";
import { WorldNotesCampaignCommitParticipant } from "../../src/features/campaign/world-notes-commit";
import { changeWorldNotes, emptyWorldNotes, serializeWorldNote } from "../../src/features/world/world-notes";
import { readConfirmedWorldNotes } from "../../src/ui/world-notes-native-reader";

const root = "tests/fixtures/atlas-e2e-spatial-v2/",
  fixture = JSON.parse(readFileSync(root + "manifest.json", "utf8")),
  manifestPath = fixture.campaign.path as string,
  manifestBytes = readFileSync(root + fixture.campaign.input.fixtureFile, "utf8"),
  digest = (text: string) => `sha256:${createHash("sha256").update(text).digest("hex")}`;

test("fresh World Notes read derives the exact aggregate from confirmed native note and manifest bytes", async () => {
  const manifest = parseCampaignRuntimeManifest(manifestBytes, digest),
    context = campaignContext(manifest.snapshot, campaignContextToken("world-notes:reader")),
    before = emptyWorldNotes(context),
    change = { kind: "create" as const,
      id: campaignLocalId("00000000-0000-4000-8000-000000000901"),
      draft: { kind: "quest" as const, title: "Versunkene Glocke", readAloud: "Licht.",
        gmNotes: "[[Tor]]", relations: [], creatureId: null } },
    after = changeWorldNotes(before, context, context, before.revision, change),
    participant = new WorldNotesCampaignCommitParticipant(manifestPath, manifestBytes, digest),
    prepared = participant.prepare({ commandId: campaignCommandId("00000000-0000-4000-8000-000000000902"),
      context, beforeSnapshot: before, afterSnapshot: after, change,
      nativeWrites: [{ path: `Kampagnen/SaltMarcher/${context.namespace}/Weltwissen/quest/${change.id}.world-note.json`,
        before: null, after: JSON.stringify(after.records[0], null, 2) + "\n" }] }),
    files = new Map(prepared.writes.map((write) => [write.path, write.after!])),
    storage = { list: async () => [{ path: manifestPath, bytes: files.get(manifestPath)! }] },
    store = { read: async (path: string) => files.get(path) ?? null,
      compareAndWrite: async () => { throw new Error("Lesetest darf nicht schreiben."); } },
    input = { storage, files: store, digest, context, currentContext: () => context };
  const loaded = await readConfirmedWorldNotes(input);
  assert.deepEqual(loaded.snapshot, after);
  assert.equal(loaded.manifestBytes, files.get(manifestPath));

  files.set(prepared.notePath, files.get(prepared.notePath)!.replace("Licht.", "Anderer Text"));
  await assert.rejects(readConfirmedWorldNotes(input), /Digest/);
  files.set(prepared.notePath, prepared.writes.find((write) => write.path === prepared.notePath)!.after!);
  await assert.rejects(readConfirmedWorldNotes({ ...input, currentContext: () => null }), /widerrufen/);

  // Create a lower UUID second: the aggregate must reopen in canonical ID order.
  const second = { ...change, id: campaignLocalId("00000000-0000-4000-8000-000000000801"),
      draft: { ...change.draft, title: "Ältere Kennung" } },
    afterSecond = changeWorldNotes(after, context, context, after.revision, second),
    secondParticipant = new WorldNotesCampaignCommitParticipant(manifestPath, files.get(manifestPath)!, digest),
    secondPrepared = secondParticipant.prepare({
      commandId: campaignCommandId("00000000-0000-4000-8000-000000000903"),
      context, beforeSnapshot: after, afterSnapshot: afterSecond, change: second,
      nativeWrites: afterSecond.records.map((record) => ({
        path: `Kampagnen/SaltMarcher/${context.namespace}/Weltwissen/${record.kind}/${record.id}.world-note.json`,
        before: after.records.find((old) => old.id === record.id)
          ? serializeWorldNote(after.records.find((old) => old.id === record.id)!) : null,
        after: serializeWorldNote(record),
      })),
    });
  for (const write of secondPrepared.writes) files.set(write.path, write.after!);
  assert.deepEqual(afterSecond.records.map((record) => record.id), [second.id, change.id]);
  assert.deepEqual((await readConfirmedWorldNotes(input)).snapshot, afterSecond);
});
