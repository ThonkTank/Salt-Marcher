import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  parseCharacterDeletionTombstone,
  parseErasureToken,
  parseReferenceOwnerClosureReceipt,
  parseReferenceOwnerManifest,
  parseReferenceOwnerRegistryProjection,
  referenceOwnerSurvivorProof,
} from "../../src/features/live-session";

type Raw = Record<string, any>;

const CAMPAIGN_A = "00000000-0000-4000-8000-000000000001";
const CAMPAIGN_B = "00000000-0000-4000-8000-000000000002";
const digest = (canonical: string): string =>
  `sha256:${createHash("sha256").update(canonical).digest("hex")}`;
const evidence = (label: string): string =>
  digest(JSON.stringify(["test", label]));

function clone<T>(value: T): T {
  return structuredClone(value);
}

function frozenGraph(value: unknown, seen = new Set<object>()): boolean {
  if (!value || typeof value !== "object" || seen.has(value)) return true;
  seen.add(value);
  return (
    Object.isFrozen(value) &&
    Object.values(value).every((child) => frozenGraph(child, seen))
  );
}

function rawRegistry(): Raw {
  return {
    kind: "reference-owner-registry-projection",
    version: 1,
    status: "complete",
    campaignId: CAMPAIGN_A,
    registryRevision: 4,
    owners: [
      {
        kind: "reference-owner-registry-entry",
        version: 1,
        ownerId: "owner-party",
        ownerRevision: 7,
        availability: "available",
        slots: [
          {
            kind: "erasure-slot-definition",
            version: 1,
            campaignId: CAMPAIGN_A,
            ownerId: "owner-party",
            payloadClass: "party-roster",
            slotId: "slot-party",
            slotRevision: 3,
            targetScopeId: "scope-party",
          },
        ],
      },
      {
        kind: "reference-owner-registry-entry",
        version: 1,
        ownerId: "owner-scenes",
        ownerRevision: 9,
        availability: "unavailable",
        slots: [
          {
            kind: "erasure-slot-definition",
            version: 1,
            campaignId: CAMPAIGN_A,
            ownerId: "owner-scenes",
            payloadClass: "live-scenes",
            slotId: "slot-scenes",
            slotRevision: 5,
            targetScopeId: "scope-scenes",
          },
        ],
      },
    ],
  };
}

function rawToken(
  ownerId: string,
  ownerRevision: number,
  payloadClass: string,
  slotId: string,
  slotRevision: number,
  erasureUnitId: string,
  targetScopeId: string,
  beforeHash: string,
  survivorSetHash: string,
  survivorRootHash: string,
): Raw {
  return {
    kind: "erasure-token",
    version: 1,
    status: "opaque-non-executable",
    tokenId: `token-${slotId}`,
    deletionCommandId: "command-delete-character-a",
    campaignId: CAMPAIGN_A,
    characterId: "character-a",
    ownerId,
    ownerRevision,
    payloadClass,
    slotId,
    slotRevision,
    erasureUnitId,
    targetScopeId,
    expectedBeforeHash: beforeHash,
    expectedSurvivorSetHash: survivorSetHash,
    expectedSurvivorRootHash: survivorRootHash,
  };
}

function rawEntry(
  ownerId: string,
  ownerRevision: number,
  payloadClass: string,
  slotId: string,
  slotRevision: number,
  targetScopeId: string,
  suffix: string,
  closureStatus: "removed" | "unavailable-quarantined",
): Raw {
  const erasureUnitId = `deleted-${suffix}`,
    beforeHash = evidence(`before-${suffix}`),
    expectedSurvivors = [
      {
        kind: "expected-survivor-binding",
        version: 1,
        ownerId,
        payloadClass,
        survivorId: `survivor-${suffix}`,
        targetScopeId,
        beforeHash: evidence(`survivor-before-${suffix}`),
      },
    ],
    { survivorSetHash, survivorRootHash } = referenceOwnerSurvivorProof(
      expectedSurvivors as any,
      digest,
    );
  return {
    kind: "reference-owner-manifest-entry",
    version: 1,
    ownerId,
    ownerRevision,
    payloadClass,
    slotId,
    slotRevision,
    erasureUnitId,
    targetScopeId,
    beforeHash,
    survivorSetHash,
    survivorRootHash,
    closureStatus,
    erasureToken: rawToken(
      ownerId,
      ownerRevision,
      payloadClass,
      slotId,
      slotRevision,
      erasureUnitId,
      targetScopeId,
      beforeHash,
      survivorSetHash,
      survivorRootHash,
    ),
    expectedSurvivors,
  };
}

function rawManifest(): Raw {
  return {
    kind: "reference-owner-manifest",
    version: 1,
    status: "closed",
    manifestId: "manifest-character-a",
    deletionCommandId: "command-delete-character-a",
    campaignId: CAMPAIGN_A,
    characterId: "character-a",
    registryRevision: 4,
    entries: [
      rawEntry(
        "owner-party",
        7,
        "party-roster",
        "slot-party",
        3,
        "scope-party",
        "party",
        "removed",
      ),
      rawEntry(
        "owner-scenes",
        9,
        "live-scenes",
        "slot-scenes",
        5,
        "scope-scenes",
        "scenes",
        "unavailable-quarantined",
      ),
    ],
  };
}

function bindSurvivorProof(entry: Raw): void {
  const proof = referenceOwnerSurvivorProof(entry.expectedSurvivors, digest);
  entry.survivorSetHash = proof.survivorSetHash;
  entry.survivorRootHash = proof.survivorRootHash;
  entry.erasureToken.expectedSurvivorSetHash = proof.survivorSetHash;
  entry.erasureToken.expectedSurvivorRootHash = proof.survivorRootHash;
}

function rawTombstone(): Raw {
  return {
    kind: "character-deletion-tombstone",
    version: 1,
    status: "non-reconstructive",
    tombstoneId: "tombstone-character-a",
    manifestId: "manifest-character-a",
    deletionCommandId: "command-delete-character-a",
    campaignId: CAMPAIGN_A,
    characterId: "character-a",
    registryRevision: 4,
  };
}

function rawReceipt(entry: Raw, outcome: "removed" | "quarantine-erased"): Raw {
  return {
    kind: "reference-owner-closure-receipt",
    version: 1,
    outcome,
    manifestId: "manifest-character-a",
    tombstoneId: "tombstone-character-a",
    deletionCommandId: "command-delete-character-a",
    campaignId: CAMPAIGN_A,
    characterId: "character-a",
    ownerId: entry.ownerId,
    ownerRevision: entry.ownerRevision,
    payloadClass: entry.payloadClass,
    slotId: entry.slotId,
    slotRevision: entry.slotRevision,
    targetScopeId: entry.targetScopeId,
    beforeHash: entry.beforeHash,
    afterHash: evidence(`after-${entry.slotId}`),
    survivorSetHash: entry.survivorSetHash,
    survivorRootHash: entry.survivorRootHash,
  };
}

function parseFixture() {
  const registry = parseReferenceOwnerRegistryProjection(rawRegistry());
  const manifest = parseReferenceOwnerManifest(rawManifest(), registry, digest);
  const tombstone = parseCharacterDeletionTombstone(rawTombstone(), manifest);
  return { registry, manifest, tombstone };
}

test("reference owner contract: parses immutable complete closure proof without reconstructive payload", () => {
  const registryInput = rawRegistry(),
    manifestInput = rawManifest(),
    registry = parseReferenceOwnerRegistryProjection(registryInput),
    manifest = parseReferenceOwnerManifest(manifestInput, registry, digest),
    tombstone = parseCharacterDeletionTombstone(rawTombstone(), manifest),
    removed = parseReferenceOwnerClosureReceipt(
      rawReceipt(manifestInput.entries[0], "removed"),
      manifest,
      tombstone,
    ),
    quarantined = parseReferenceOwnerClosureReceipt(
      rawReceipt(manifestInput.entries[1], "quarantine-erased"),
      manifest,
      tombstone,
    ),
    reconnected = parseReferenceOwnerClosureReceipt(
      rawReceipt(manifestInput.entries[1], "removed"),
      manifest,
      tombstone,
    );

  assert.equal(registry.owners[1]?.availability, "unavailable");
  assert.equal(manifest.entries[1]?.closureStatus, "unavailable-quarantined");
  assert.equal(removed.outcome, "removed");
  assert.equal(quarantined.outcome, "quarantine-erased");
  assert.equal(reconnected.outcome, "removed");
  for (const value of [
    registry,
    manifest,
    tombstone,
    removed,
    quarantined,
    reconnected,
  ])
    assert.ok(frozenGraph(value));

  registryInput.owners[0].slots[0].slotRevision = 99;
  manifestInput.entries[0].beforeHash = "mutated";
  assert.equal(registry.owners[0]?.slots[0]?.slotRevision, 3);
  assert.equal(manifest.entries[0]?.beforeHash, evidence("before-party"));
  assert.deepEqual(
    parseReferenceOwnerRegistryProjection(JSON.parse(JSON.stringify(registry))),
    registry,
  );
});

test("reference owner contract: registry rejects unknown, stale-shaped, cross-campaign and incomplete projections", () => {
  const cases: Array<[string, (value: Raw) => void]> = [
    ["unknown projection status", (value) => (value.status = "unknown")],
    ["incomplete projection status", (value) => (value.status = "incomplete")],
    ["legacy weak campaign id", (value) => (value.campaignId = "campaign-a")],
    [
      "unknown owner availability",
      (value) => (value.owners[0].availability = "unknown"),
    ],
    ["empty owner enumeration", (value) => (value.owners = [])],
    ["empty slot enumeration", (value) => (value.owners[0].slots = [])],
    [
      "cross-campaign slot",
      (value) => (value.owners[0].slots[0].campaignId = CAMPAIGN_B),
    ],
    [
      "foreign owner slot",
      (value) => (value.owners[0].slots[0].ownerId = "owner-other"),
    ],
    ["duplicate owner", (value) => value.owners.push(clone(value.owners[0]))],
    [
      "duplicate slot",
      (value) => value.owners[0].slots.push(clone(value.owners[0].slots[0])),
    ],
  ];
  for (const [name, mutate] of cases) {
    const value = rawRegistry();
    mutate(value);
    assert.throws(() => parseReferenceOwnerRegistryProjection(value), name);
  }
});

test("reference owner contract: token is exact, opaque and non-executable", () => {
  const token = rawManifest().entries[0].erasureToken;
  assert.ok(frozenGraph(parseErasureToken(token)));
  for (const forbidden of ["path", "locator", "execute", "payload"]) {
    const value = clone(token);
    value[forbidden] = forbidden === "execute" ? true : "/recoverable/value";
    assert.throws(() => parseErasureToken(value), forbidden);
  }
});

test("reference owner contract: manifest fails closed for foreign, stale, incomplete and overlapping closure", () => {
  const cases: Array<[string, (manifest: Raw, registry: Raw) => void]> = [
    ["foreign campaign", (manifest) => (manifest.campaignId = CAMPAIGN_B)],
    ["stale registry", (manifest) => (manifest.registryRevision = 3)],
    ["missing registry slot", (manifest) => manifest.entries.pop()],
    [
      "unknown registry slot",
      (manifest) => (manifest.entries[0].slotId = "slot-unknown"),
    ],
    ["stale owner", (manifest) => (manifest.entries[0].ownerRevision = 6)],
    ["stale slot", (manifest) => (manifest.entries[0].slotRevision = 2)],
    [
      "foreign target scope",
      (manifest) => (manifest.entries[0].targetScopeId = "scope-other"),
    ],
    [
      "available owner quarantined",
      (manifest) =>
        (manifest.entries[0].closureStatus = "unavailable-quarantined"),
    ],
    [
      "unavailable owner removed",
      (manifest) => (manifest.entries[1].closureStatus = "removed"),
    ],
    [
      "target also survivor",
      (manifest) =>
        (manifest.entries[0].expectedSurvivors[0].survivorId =
          manifest.entries[0].erasureUnitId),
    ],
    [
      "duplicate survivor",
      (manifest) =>
        manifest.entries[0].expectedSurvivors.push(
          clone(manifest.entries[0].expectedSurvivors[0]),
        ),
    ],
    [
      "survivor proof drift",
      (manifest) =>
        (manifest.entries[0].expectedSurvivors[0].beforeHash =
          evidence("changed-survivor")),
    ],
    [
      "forged survivor set proof",
      (manifest) => {
        const forged = evidence("forged-survivor-set");
        manifest.entries[0].survivorSetHash = forged;
        manifest.entries[0].erasureToken.expectedSurvivorSetHash = forged;
      },
    ],
    [
      "forged survivor root proof",
      (manifest) => {
        const forged = evidence("forged-survivor-root");
        manifest.entries[0].survivorRootHash = forged;
        manifest.entries[0].erasureToken.expectedSurvivorRootHash = forged;
      },
    ],
    [
      "duplicate token id",
      (manifest) =>
        (manifest.entries[1].erasureToken.tokenId =
          manifest.entries[0].erasureToken.tokenId),
    ],
    [
      "registry changed after enumeration",
      (_manifest, registry) => (registry.registryRevision = 5),
    ],
  ];
  for (const [name, mutate] of cases) {
    const manifest = rawManifest(),
      registry = rawRegistry();
    mutate(manifest, registry);
    assert.throws(
      () => parseReferenceOwnerManifest(manifest, registry, digest),
      name,
    );
  }
});

test("reference owner contract: survivor proofs are canonical and order independent", () => {
  const manifest = rawManifest(),
    entry = manifest.entries[0];
  entry.expectedSurvivors.push({
    kind: "expected-survivor-binding",
    version: 1,
    ownerId: entry.ownerId,
    payloadClass: entry.payloadClass,
    survivorId: "survivor-party-second",
    targetScopeId: entry.targetScopeId,
    beforeHash: evidence("survivor-before-party-second"),
  });
  bindSurvivorProof(entry);
  const expectedProof = {
    survivorSetHash: entry.survivorSetHash,
    survivorRootHash: entry.survivorRootHash,
  };
  entry.expectedSurvivors.reverse();

  const parsed = parseReferenceOwnerManifest(manifest, rawRegistry(), digest);
  assert.deepEqual(
    {
      survivorSetHash: parsed.entries[0]?.survivorSetHash,
      survivorRootHash: parsed.entries[0]?.survivorRootHash,
    },
    expectedProof,
  );
});

test("reference owner contract: manifest requires exact token bindings", () => {
  const fields = [
    "deletionCommandId",
    "campaignId",
    "characterId",
    "ownerId",
    "ownerRevision",
    "payloadClass",
    "slotId",
    "slotRevision",
    "erasureUnitId",
    "targetScopeId",
    "expectedBeforeHash",
    "expectedSurvivorSetHash",
    "expectedSurvivorRootHash",
  ];
  for (const field of fields) {
    const manifest = rawManifest(),
      token = manifest.entries[0].erasureToken;
    token[field] =
      typeof token[field] === "number"
        ? token[field] + 1
        : `${token[field]}-stale`;
    assert.throws(
      () => parseReferenceOwnerManifest(manifest, rawRegistry(), digest),
      field,
    );
  }
});

test("reference owner contract: tombstone is non-reconstructive and exactly manifest-bound", () => {
  const { manifest } = parseFixture();
  assert.ok(
    frozenGraph(parseCharacterDeletionTombstone(rawTombstone(), manifest)),
  );
  for (const [name, mutate] of [
    [
      "profile payload",
      (value: Raw) => (value.profile = { name: "recover me" }),
    ],
    ["foreign manifest", (value: Raw) => (value.manifestId = "manifest-other")],
    ["foreign campaign", (value: Raw) => (value.campaignId = CAMPAIGN_B)],
    ["stale registry", (value: Raw) => (value.registryRevision = 3)],
  ] as const) {
    const value = rawTombstone();
    mutate(value);
    assert.throws(() => parseCharacterDeletionTombstone(value, manifest), name);
  }
});

test("reference owner contract: receipt proves slot, target, before, after and complete unchanged survivor closure", () => {
  const { manifest, tombstone } = parseFixture(),
    base = () => rawReceipt(rawManifest().entries[0], "removed"),
    cases: Array<[string, (receipt: Raw) => void]> = [
      [
        "foreign command",
        (receipt) => (receipt.deletionCommandId = "command-other"),
      ],
      ["foreign campaign", (receipt) => (receipt.campaignId = CAMPAIGN_B)],
      [
        "foreign manifest",
        (receipt) => (receipt.manifestId = "manifest-other"),
      ],
      [
        "foreign tombstone",
        (receipt) => (receipt.tombstoneId = "tombstone-other"),
      ],
      ["foreign character", (receipt) => (receipt.characterId = "character-b")],
      ["foreign owner", (receipt) => (receipt.ownerId = "owner-other")],
      ["stale owner", (receipt) => (receipt.ownerRevision = 6)],
      [
        "foreign payload class",
        (receipt) => (receipt.payloadClass = "party-notes"),
      ],
      ["foreign slot", (receipt) => (receipt.slotId = "slot-other")],
      ["stale slot", (receipt) => (receipt.slotRevision = 2)],
      ["foreign target", (receipt) => (receipt.targetScopeId = "scope-other")],
      ["wrong before", (receipt) => (receipt.beforeHash = evidence("wrong"))],
      [
        "unchanged target",
        (receipt) => (receipt.afterHash = receipt.beforeHash),
      ],
      [
        "wrong survivor set",
        (receipt) => (receipt.survivorSetHash = evidence("wrong-set")),
      ],
      [
        "wrong survivor root",
        (receipt) => (receipt.survivorRootHash = evidence("wrong-root")),
      ],
      ["wrong outcome", (receipt) => (receipt.outcome = "quarantine-erased")],
      [
        "reconstructive payload",
        (receipt) => (receipt.profile = { name: "recover me" }),
      ],
    ];
  for (const [name, mutate] of cases) {
    const receipt = base();
    mutate(receipt);
    assert.throws(
      () => parseReferenceOwnerClosureReceipt(receipt, manifest, tombstone),
      name,
    );
  }
});

test("reference owner contract: receipt rejects sibling-manifest replay", () => {
  const original = parseFixture(),
    receipt = rawReceipt(rawManifest().entries[0], "removed"),
    siblingManifestInput = rawManifest();
  siblingManifestInput.manifestId = "manifest-character-a-sibling";
  const siblingManifest = parseReferenceOwnerManifest(
      siblingManifestInput,
      rawRegistry(),
      digest,
    ),
    siblingTombstoneInput = rawTombstone();
  siblingTombstoneInput.manifestId = siblingManifestInput.manifestId;
  siblingTombstoneInput.tombstoneId = "tombstone-character-a-sibling";
  const siblingTombstone = parseCharacterDeletionTombstone(
    siblingTombstoneInput,
    siblingManifest,
  );

  assert.doesNotThrow(() =>
    parseReferenceOwnerClosureReceipt(
      receipt,
      original.manifest,
      original.tombstone,
    ),
  );
  assert.throws(
    () =>
      parseReferenceOwnerClosureReceipt(
        receipt,
        siblingManifest,
        siblingTombstone,
      ),
    "sibling manifest replay",
  );
});

test("reference owner contract: exact receipt slot identity disambiguates sibling slots", () => {
  const registryInput = rawRegistry(),
    manifestInput = rawManifest(),
    extraSlot = clone(registryInput.owners[0].slots[0]);
  extraSlot.payloadClass = "party-notes";
  extraSlot.slotId = "slot-party-notes";
  registryInput.owners[0].slots.push(extraSlot);
  const extraEntry = rawEntry(
    "owner-party",
    7,
    "party-notes",
    "slot-party-notes",
    3,
    "scope-party",
    "party-notes",
    "removed",
  );
  manifestInput.entries.push(extraEntry);

  const registry = parseReferenceOwnerRegistryProjection(registryInput),
    manifest = parseReferenceOwnerManifest(manifestInput, registry, digest),
    tombstone = parseCharacterDeletionTombstone(rawTombstone(), manifest);
  assert.doesNotThrow(() =>
    parseReferenceOwnerClosureReceipt(
      rawReceipt(manifestInput.entries[0], "removed"),
      manifest,
      tombstone,
    ),
  );
  assert.doesNotThrow(() =>
    parseReferenceOwnerClosureReceipt(
      rawReceipt(extraEntry, "removed"),
      manifest,
      tombstone,
    ),
  );
});

test("reference owner contract: survivor proofs use locale-independent Unicode order", () => {
  const canonicalInputs: string[] = [],
    recordingDigest = (canonical: string): string => {
      canonicalInputs.push(canonical);
      return digest(canonical);
    };

  referenceOwnerSurvivorProof(
    [
      {
        ownerId: "owner-party" as never,
        payloadClass: "party-roster",
        survivorId: "ä" as never,
        targetScopeId: "scope-party" as never,
        beforeHash: evidence("unicode-a-umlaut"),
      },
      {
        ownerId: "owner-party" as never,
        payloadClass: "party-roster",
        survivorId: "z" as never,
        targetScopeId: "scope-party" as never,
        beforeHash: evidence("unicode-z"),
      },
    ],
    recordingDigest,
  );

  const setProjection = JSON.parse(canonicalInputs[0]!) as unknown[];
  assert.deepEqual(setProjection, [
    "reference-owner-survivor-set",
    1,
    [
      ["owner-party", "party-roster", "z", "scope-party"],
      ["owner-party", "party-roster", "ä", "scope-party"],
    ],
  ]);
});
