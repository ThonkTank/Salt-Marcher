import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  campaignId,
  campaignNamespace,
  campaignSnapshot,
} from "../../src/features/campaign/campaign-contracts";
import {
  campaignDomainOwnerPolicyDigest,
  campaignOwnershipDigestValue,
  type CampaignDomainOwnerProjectionV1,
} from "../../src/features/campaign/campaign-ownership";
import {
  parseCampaignRuntimeManifest,
  type CampaignRuntimeManifestV1,
} from "../../src/features/campaign/campaign-runtime-source";
import {
  CampaignRuntimeManifestSaveParticipant,
  type CampaignManifestNativeWrite,
  type CampaignRuntimeOwnerSaveAuthority,
} from "../../src/features/campaign/campaign-runtime-save-participant";

const sha = (value: string) =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;
const digest = (value: string) => sha(value);
const fixtureRoot = resolve(
  process.cwd(),
  "tests/fixtures/atlas-e2e-spatial-v2",
);
const fixture = JSON.parse(
  readFileSync(resolve(fixtureRoot, "manifest.json"), "utf8"),
) as {
  input: readonly { path: string; fixtureFile: string }[];
  expected: readonly { path: string; fixtureFile: string }[];
  campaign: {
    path: string;
    input: { fixtureFile: string; sha256: string; bytes: number };
    expected: { fixtureFile: string; sha256: string; bytes: number };
  };
};
const campaignPath = "Kampagnen/SaltMarcher/E2E-01-Atlas-Save.campaign.json";
const id = (suffix: string) =>
  `00000000-0000-4000-8000-${suffix.padStart(12, "0")}`;
const schema = "atlas.e2e01.v1";
const recordDefinitions = [
  ["010", "world", "atlas", ["013", "014", "201", "202"]],
  ["011", "location", "atlas", ["015", "016"]],
  ["012", "location", "atlas", ["017", "018"]],
  ["013", "location-placement", "atlas", ["010", "011"]],
  ["014", "location-placement", "atlas", ["010", "012"]],
  ["015", "location-section", "atlas", ["011"]],
  ["016", "location-section", "atlas", ["011"]],
  ["017", "location-section", "atlas", ["012"]],
  ["018", "location-section", "atlas", ["012"]],
  ["201", "city-placement", "atlas", ["100", "011"]],
  [
    "202",
    "dungeon-placement",
    "atlas",
    ["030", "100", "105", "032", "033", "031"],
  ],
  ["100", "city", "city", ["101", "102", "103", "104", "105", "106"]],
  ["101", "road-node", "city", ["100"]],
  ["102", "road-node", "city", ["100"]],
  ["103", "road", "city", ["100", "101", "102"]],
  ["104", "plaza", "city", ["100"]],
  ["105", "building", "city", ["100"]],
  ["106", "building", "city", ["100"]],
  ["030", "dungeon", "dungeon", ["032", "031", "033"]],
  ["032", "floor", "dungeon", ["030"]],
  ["031", "room", "dungeon", ["030", "032", "034"]],
  ["034", "room-section", "dungeon", ["031"]],
  ["033", "route", "dungeon", ["030", "031"]],
] as const;

function nativeRows(side: "input" | "expected") {
  return fixture[side].map((row) => ({
    ...row,
    bytes: readFileSync(resolve(fixtureRoot, row.fixtureFile), "utf8"),
  }));
}
function idsByPath(rows: ReturnType<typeof nativeRows>): Map<string, string> {
  const result = new Map<string, string>();
  for (const row of rows) {
    if (row.path.includes("terrain/")) continue;
    const visit = (value: unknown): void => {
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === "object")
        for (const [key, item] of Object.entries(value)) {
          if (key === "id" && typeof item === "string")
            result.set(item, row.path);
          visit(item);
        }
    };
    visit(JSON.parse(row.bytes));
  }
  return result;
}
function signedOwner(
  ownerId: string,
  records: CampaignDomainOwnerProjectionV1["records"],
) {
  const evidence = campaignOwnershipDigestValue(
      {
        schema: "campaign-runtime-owner-fixture-v1",
        ownerId,
        records: records.map(({ id: recordId, payloadDigest }) => ({
          id: recordId,
          payloadDigest,
        })),
      },
      digest,
    ),
    suffix = evidence.slice("sha256:".length);
  const owner = {
    ownerId,
    ownerRevision: `owner:${suffix}`,
    schemaRevision: `schema:${ownerId}:e2e01`,
    snapshotRevision: `snapshot:${suffix}`,
    policyRevision: `policy:${ownerId}:e2e01`,
    policyDigest: sha("placeholder"),
    availability: "confirmed" as const,
    emptyConfirmed: false,
    referenceSchemas: [schema],
    source: {
      adapterType: `native-${ownerId}`,
      generation: `source:${suffix}`,
    },
    records,
    transferPolicies: [],
  };
  return Object.freeze({
    ...owner,
    policyDigest: campaignDomainOwnerPolicyDigest(owner, digest),
  });
}
function worldClosureDigest(
  files: readonly { kind: string; path: string; savedDigest: string | null }[],
): string {
  const world = files.find((file) => file.kind === "world")!,
    terrain = files
      .filter((file) => file.kind === "terrain")
      .map((file) => ({ path: file.path, savedDigest: file.savedDigest }))
      .sort((a, b) => a.path.localeCompare(b.path));
  return campaignOwnershipDigestValue(
    {
      schema: "campaign-runtime-world-file-closure-v1",
      world: world.savedDigest,
      terrain,
    },
    digest,
  );
}
function manifest(
  rows: ReturnType<typeof nativeRows>,
  phase: "input" | "expected",
): string {
  const pathById = idsByPath(rows),
    worldId = id("010"),
    snapshot = campaignSnapshot({
      schemaVersion: 1,
      campaignId: campaignId(id("001")),
      revision: 1,
      name: "E2E-01 Atlas Save",
      namespace: campaignNamespace(id("002")),
      lifecycle: "active",
    });
  const owners = ["atlas", "city", "dungeon"].map((ownerId) =>
    signedOwner(
      ownerId,
      recordDefinitions
        .filter(([, , owner]) => owner === ownerId)
        .map(([suffix, recordType, , refs]) => {
          const recordId = id(suffix),
            path = pathById.get(recordId);
          assert.ok(path, recordId);
          return Object.freeze({
            id: recordId as never,
            recordType,
            references: refs
              .map((reference) =>
                Object.freeze({
                  id: id(reference),
                  scope: "campaign-local" as const,
                  schema,
                }),
              )
              .sort((a, b) => a.id.localeCompare(b.id)),
            payloadDigest:
              suffix === "010"
                ? worldClosureDigest(
                    rows.map((row) => ({
                      kind: row.path.endsWith(".overworld")
                        ? "world"
                        : row.path.includes("terrain/")
                          ? "terrain"
                          : "document",
                      path: row.path,
                      savedDigest: sha(row.bytes),
                    })),
                  )
                : sha(rows.find((row) => row.path === path)!.bytes),
            media: null,
          });
        })
        .sort((a, b) => String(a.id).localeCompare(String(b.id))),
    ),
  );
  const registryContent = {
    version: 1 as const,
    registryId: "registry:e2e01",
    registryRevision: `registry:${phase}`,
    campaignId: snapshot.campaignId,
    campaignRevision: snapshot.revision,
    namespace: snapshot.namespace,
    owners,
  };
  const kind = (path: string) =>
    path.endsWith(".overworld")
      ? "world"
      : path.endsWith(".location")
        ? "location"
        : path.endsWith(".city")
          ? "city"
          : path.endsWith(".dungeon")
            ? "dungeon"
            : "terrain";
  const files = rows.map((row) => {
    const fileKind = kind(row.path),
      document = fileKind === "terrain" ? null : JSON.parse(row.bytes);
    return {
      kind: fileKind,
      id: document?.id ?? null,
      path: row.path,
      savedDigest: sha(row.bytes),
    };
  });
  const navigable = new Set([
    "world",
    "location",
    "location-section",
    "city",
    "building",
    "dungeon",
    "room",
    "room-section",
  ]);
  const records = owners.flatMap((owner) =>
    owner.records
      .filter((record) => navigable.has(record.recordType))
      .map((record) => {
        const path = pathById.get(record.id)!;
        return {
          id: record.id,
          kind: record.recordType,
          documentId: path.endsWith(".overworld")
            ? worldId
            : files.find((file) => file.path === path)!.id,
          ownerId: owner.ownerId,
          availability: "available",
        };
      }),
  );
  return (
    JSON.stringify(
      {
        version: 1,
        snapshot,
        registry: {
          ...registryContent,
          registryContentDigest: campaignOwnershipDigestValue(
            registryContent,
            digest,
          ),
        },
        atlas: { worldId, files, records },
      },
      null,
      2,
    ) + "\n"
  );
}
function parsed(bytes: string): CampaignRuntimeManifestV1 {
  return parseCampaignRuntimeManifest(bytes, digest);
}
function writes(): CampaignManifestNativeWrite[] {
  const input = nativeRows("input"),
    expected = nativeRows("expected");
  return input.map((row, index) => ({
    path: row.path,
    before: row.bytes,
    after: expected[index]!.bytes,
  }));
}
function authorities(): readonly CampaignRuntimeOwnerSaveAuthority[] {
  const pathById = idsByPath(nativeRows("input"));
  return ["atlas", "city", "dungeon"].map((ownerId) => ({
    ownerId,
    verify: ({ beforeOwner, afterOwner, beforeFiles, afterFiles }) => {
      for (const [index, beforeRecord] of beforeOwner.records.entries()) {
        const afterRecord = afterOwner.records.find(
            (record) => record.id === beforeRecord.id,
          )!,
          path = pathById.get(beforeRecord.id)!,
          beforeDigest =
            beforeRecord.id === id("010")
              ? worldClosureDigest(beforeFiles)
              : beforeFiles.find((file) => file.path === path)!.savedDigest,
          afterDigest =
            afterRecord.id === id("010")
              ? worldClosureDigest(afterFiles)
              : afterFiles.find((file) => file.path === path)!.savedDigest;
        assert.equal(beforeRecord.payloadDigest, beforeDigest);
        assert.equal(afterRecord.payloadDigest, afterDigest);
        assert.equal(afterRecord.id, beforeOwner.records[index]!.id);
      }
      const evidence = campaignOwnershipDigestValue(
          {
            schema: "campaign-runtime-owner-fixture-v1",
            ownerId,
            records: afterOwner.records.map(
              ({ id: recordId, payloadDigest }) => ({
                id: recordId,
                payloadDigest,
              }),
            ),
          },
          digest,
        ),
        suffix = evidence.slice("sha256:".length);
      assert.equal(afterOwner.ownerRevision, `owner:${suffix}`);
      assert.equal(afterOwner.snapshotRevision, `snapshot:${suffix}`);
      assert.equal(afterOwner.source.generation, `source:${suffix}`);
    },
  }));
}
function projectedOwners(
  before: CampaignRuntimeManifestV1,
  nativeWrites: readonly CampaignManifestNativeWrite[],
): readonly CampaignDomainOwnerProjectionV1[] {
  const pathById = idsByPath(nativeRows("input")),
    byPath = new Map(nativeWrites.map((write) => [write.path, write])),
    files = before.atlas.files.map((file) => ({
      ...file,
      savedDigest: sha(byPath.get(file.path)!.after!),
    }));
  return before.registry.owners.map((owner) =>
    signedOwner(
      owner.ownerId,
      owner.records.map((record) => ({
        ...record,
        payloadDigest:
          record.id === id("010")
            ? worldClosureDigest(files)
            : files.find((file) => file.path === pathById.get(record.id))!
                .savedDigest,
      })),
    ),
  );
}

test("campaign manifest participant binds seven native guards to three owner-authorized projections", () => {
  const beforeBytes = manifest(nativeRows("input"), "input"),
    before = parsed(beforeBytes),
    authorizedAfter = parsed(manifest(nativeRows("expected"), "expected")),
    participant = new CampaignRuntimeManifestSaveParticipant(
      campaignPath,
      digest,
      authorities(),
    );
  assert.equal(
    before.registry.owners.reduce(
      (count, owner) => count + owner.records.length,
      0,
    ),
    23,
  );
  assert.equal(before.atlas.records.length, 13);
  assert.equal(participant.owns(campaignPath), true);
  assert.equal(participant.owns(campaignPath + ".backup"), false);
  const [write] = participant.prepare({
    beforeManifestBytes: beforeBytes,
    nativeWrites: writes(),
    beforeOwners: before.registry.owners,
    afterOwners: authorizedAfter.registry.owners,
  });
  const inputFixture = readFileSync(
      resolve(fixtureRoot, fixture.campaign.input.fixtureFile),
      "utf8",
    ),
    expectedFixture = readFileSync(
      resolve(fixtureRoot, fixture.campaign.expected.fixtureFile),
      "utf8",
    );
  assert.equal(fixture.campaign.path, campaignPath);
  assert.equal(inputFixture, beforeBytes);
  assert.equal(expectedFixture, write!.after);
  assert.equal(Buffer.byteLength(inputFixture), fixture.campaign.input.bytes);
  assert.equal(
    Buffer.byteLength(expectedFixture),
    fixture.campaign.expected.bytes,
  );
  assert.equal(
    sha(inputFixture).slice("sha256:".length),
    fixture.campaign.input.sha256,
  );
  assert.equal(
    sha(expectedFixture).slice("sha256:".length),
    fixture.campaign.expected.sha256,
  );
  assert.equal(write?.path, campaignPath);
  const after = parsed(write!.after!);
  assert.deepEqual(after.snapshot, before.snapshot);
  assert.equal(after.registry.registryId, before.registry.registryId);
  assert.notEqual(
    after.registry.registryRevision,
    before.registry.registryRevision,
  );
  assert.deepEqual(
    after.registry.owners.find((owner) => owner.ownerId === "atlas"),
    before.registry.owners.find((owner) => owner.ownerId === "atlas"),
  );
  for (const ownerId of ["city", "dungeon"])
    assert.notEqual(
      after.registry.owners.find((owner) => owner.ownerId === ownerId)!
        .ownerRevision,
      before.registry.owners.find((owner) => owner.ownerId === ownerId)!
        .ownerRevision,
    );
  participant.validateRecovery({
    writes: [
      ...writes().filter(
        (nativeWrite) => nativeWrite.before !== nativeWrite.after,
      ),
      write!,
      {
        path: "Atlanten/Gemeinsamer-Testatlas.overworld.draft",
        before: "draft",
        after: null,
      },
    ],
  });
  assert.deepEqual(
    participant.prepare({
      beforeManifestBytes: beforeBytes,
      nativeWrites: writes().map((write) => ({
        ...write,
        after: write.before,
      })),
      beforeOwners: before.registry.owners,
      afterOwners: before.registry.owners,
    }),
    [],
  );
});

test("campaign manifest participant binds terrain-only save to the complete World file closure", () => {
  const beforeBytes = manifest(nativeRows("input"), "input"),
    before = parsed(beforeBytes),
    nativeWrites = writes().map((write) => ({ ...write, after: write.before })),
    terrain = nativeWrites.find((write) => write.path.endsWith("0_0_0.json"))!;
  nativeWrites[nativeWrites.indexOf(terrain)] = {
    ...terrain,
    after: terrain.after! + "\n",
  };
  const participant = new CampaignRuntimeManifestSaveParticipant(
      campaignPath,
      digest,
      authorities(),
    ),
    [manifestWrite] = participant.prepare({
      beforeManifestBytes: beforeBytes,
      nativeWrites,
      beforeOwners: before.registry.owners,
      afterOwners: projectedOwners(before, nativeWrites),
    }),
    after = parsed(manifestWrite!.after!);
  assert.notEqual(
    after.registry.owners.find((owner) => owner.ownerId === "atlas")!
      .ownerRevision,
    before.registry.owners.find((owner) => owner.ownerId === "atlas")!
      .ownerRevision,
  );
  assert.deepEqual(
    after.registry.owners.find((owner) => owner.ownerId === "city"),
    before.registry.owners.find((owner) => owner.ownerId === "city"),
  );
  participant.validateRecovery({
    writes: [
      nativeWrites.find((write) => write.before !== write.after)!,
      manifestWrite!,
    ],
  });
});

test("campaign manifest participant fails closed for incomplete guards and invented owner authority", () => {
  const beforeBytes = manifest(nativeRows("input"), "input"),
    before = parsed(beforeBytes),
    authorizedAfter = parsed(manifest(nativeRows("expected"), "expected")),
    participant = new CampaignRuntimeManifestSaveParticipant(
      campaignPath,
      digest,
      authorities(),
    ),
    nativeWrites = writes();
  const input = {
    beforeManifestBytes: beforeBytes,
    nativeWrites,
    beforeOwners: before.registry.owners,
    afterOwners: authorizedAfter.registry.owners,
  };
  assert.throws(
    () =>
      participant.prepare({ ...input, nativeWrites: nativeWrites.slice(1) }),
    /nicht exakt/,
  );
  assert.throws(
    () =>
      participant.prepare({
        ...input,
        nativeWrites: [
          ...nativeWrites,
          { path: "fremd.json", before: "{}", after: "{}" },
        ],
      }),
    /Fremdes/,
  );
  assert.throws(
    () =>
      participant.prepare({
        ...input,
        nativeWrites: nativeWrites.map((write, index) =>
          index ? write : { ...write, before: "extern" },
        ),
      }),
    /Campaignbasis/,
  );
  assert.throws(
    () =>
      participant.prepare({ ...input, afterOwners: before.registry.owners }),
    /nicht deckungsgleich|Expected values to be strictly equal/,
  );
  const invented = authorizedAfter.registry.owners.map((owner) =>
    owner.ownerId === "atlas"
      ? { ...owner, ownerRevision: "owner:atlas:invented" }
      : owner,
  );
  assert.throws(
    () => participant.prepare({ ...input, afterOwners: invented }),
    /erfundene Revision/,
  );
  const forged = authorizedAfter.registry.owners.map((owner) =>
    owner.ownerId !== "city"
      ? owner
      : {
          ...owner,
          records: owner.records.map((record, index) =>
            index ? record : { ...record, payloadDigest: sha("forged") },
          ),
        },
  );
  assert.throws(
    () => participant.prepare({ ...input, afterOwners: forged }),
    /Expected values to be strictly equal/,
  );
  for (const field of [
    "ownerRevision",
    "snapshotRevision",
    "generation",
  ] as const) {
    const forgedRevision = authorizedAfter.registry.owners.map((owner) => {
      if (owner.ownerId !== "city") return owner;
      return field === "generation"
        ? { ...owner, source: { ...owner.source, generation: "source:forged" } }
        : { ...owner, [field]: `${field}:forged` };
    });
    assert.throws(
      () => participant.prepare({ ...input, afterOwners: forgedRevision }),
      /Expected values to be strictly equal/,
    );
  }
  assert.throws(
    () =>
      participant.validateRecovery({
        writes: nativeWrites.filter((write) => write.before !== write.after),
      }),
    /kein Manifestziel/,
  );
  const [validManifestWrite] = participant.prepare(input),
    changed = nativeWrites.filter((write) => write.before !== write.after);
  assert.doesNotThrow(() =>
    participant.validateRecovery({
      writes: [
        {
          path: "Atlanten/Gemeinsamer-Testatlas.overworld.draft",
          before: "draft",
          after: null,
        },
      ],
    }),
  );
  assert.throws(
    () =>
      participant.validateRecovery({
        writes: [changed[0]!, validManifestWrite!],
      }),
    /nicht exakt/,
  );
  assert.throws(
    () =>
      participant.validateRecovery({
        writes: [
          ...changed,
          validManifestWrite!,
          { path: "fremd.json", before: "{}", after: "{}" },
        ],
      }),
    /fremdes Ziel/,
  );
  assert.throws(
    () =>
      participant.validateRecovery({
        writes: [
          { ...changed[0]!, before: "stale" },
          ...changed.slice(1),
          validManifestWrite!,
        ],
      }),
    /falsche native Bytes/,
  );
  assert.throws(
    () =>
      participant.validateRecovery({
        writes: [...changed, validManifestWrite!, validManifestWrite!],
      }),
    /Doppeltes/,
  );
  const collision = JSON.parse(beforeBytes),
    futureRevision = parsed(validManifestWrite!.after!).registry
      .registryRevision;
  collision.registry.registryRevision = futureRevision;
  const { registryContentDigest: _oldDigest, ...collisionRegistry } =
    collision.registry;
  collision.registry.registryContentDigest = campaignOwnershipDigestValue(
    collisionRegistry,
    digest,
  );
  const collisionBytes = JSON.stringify(collision, null, 2) + "\n",
    collisionBefore = parsed(collisionBytes);
  assert.throws(
    () =>
      participant.prepare({
        ...input,
        beforeManifestBytes: collisionBytes,
        beforeOwners: collisionBefore.registry.owners,
      }),
    /frische Revision/,
  );
  assert.throws(
    () =>
      new CampaignRuntimeManifestSaveParticipant(
        "Kampagnen/fremd.campaign.json",
        digest,
        authorities(),
      ),
    /Campaignroots/,
  );
});
