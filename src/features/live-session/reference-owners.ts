import {
  characterId,
  commandId,
  ownerId,
  referenceId,
  revision,
  type CharacterId,
  type CommandId,
  type OwnerId,
  type ReferenceId,
  type Revision,
} from "./ids";
import { exactArray, exactRecord, uniqueBy } from "./validation";
import {
  campaignId,
  payloadDigest,
  type CampaignId,
} from "../campaign/campaign-contracts";

export interface ErasureSlotDefinition {
  readonly kind: "erasure-slot-definition";
  readonly version: 1;
  readonly campaignId: CampaignId;
  readonly ownerId: OwnerId;
  readonly payloadClass: string;
  readonly slotId: ReferenceId;
  readonly slotRevision: Revision;
  readonly targetScopeId: ReferenceId;
}

export interface ReferenceOwnerRegistryEntry {
  readonly kind: "reference-owner-registry-entry";
  readonly version: 1;
  readonly ownerId: OwnerId;
  readonly ownerRevision: Revision;
  readonly availability: "available" | "unavailable";
  readonly slots: readonly ErasureSlotDefinition[];
}

export interface ReferenceOwnerRegistryProjection {
  readonly kind: "reference-owner-registry-projection";
  readonly version: 1;
  readonly status: "complete";
  readonly campaignId: CampaignId;
  readonly registryRevision: Revision;
  readonly owners: readonly ReferenceOwnerRegistryEntry[];
}

export interface ErasureToken {
  readonly kind: "erasure-token";
  readonly version: 1;
  readonly status: "opaque-non-executable";
  readonly tokenId: ReferenceId;
  readonly deletionCommandId: CommandId;
  readonly campaignId: CampaignId;
  readonly characterId: CharacterId;
  readonly ownerId: OwnerId;
  readonly ownerRevision: Revision;
  readonly payloadClass: string;
  readonly slotId: ReferenceId;
  readonly slotRevision: Revision;
  readonly erasureUnitId: ReferenceId;
  readonly targetScopeId: ReferenceId;
  readonly expectedBeforeHash: string;
  readonly expectedSurvivorSetHash: string;
  readonly expectedSurvivorRootHash: string;
}

export interface ExpectedSurvivorBinding {
  readonly kind: "expected-survivor-binding";
  readonly version: 1;
  readonly ownerId: OwnerId;
  readonly payloadClass: string;
  readonly survivorId: ReferenceId;
  readonly targetScopeId: ReferenceId;
  readonly beforeHash: string;
}

export type ReferenceOwnerDigest = (canonical: string) => string;

export interface ReferenceOwnerSurvivorProof {
  readonly survivorSetHash: string;
  readonly survivorRootHash: string;
}

export interface ReferenceOwnerManifestEntry {
  readonly kind: "reference-owner-manifest-entry";
  readonly version: 1;
  readonly ownerId: OwnerId;
  readonly ownerRevision: Revision;
  readonly payloadClass: string;
  readonly slotId: ReferenceId;
  readonly slotRevision: Revision;
  readonly erasureUnitId: ReferenceId;
  readonly targetScopeId: ReferenceId;
  readonly beforeHash: string;
  readonly survivorSetHash: string;
  readonly survivorRootHash: string;
  readonly closureStatus: "removed" | "unavailable-quarantined";
  readonly erasureToken: ErasureToken;
  readonly expectedSurvivors: readonly ExpectedSurvivorBinding[];
}

export interface ReferenceOwnerManifest {
  readonly kind: "reference-owner-manifest";
  readonly version: 1;
  readonly status: "closed";
  readonly manifestId: ReferenceId;
  readonly deletionCommandId: CommandId;
  readonly campaignId: CampaignId;
  readonly characterId: CharacterId;
  readonly registryRevision: Revision;
  readonly entries: readonly ReferenceOwnerManifestEntry[];
}

export interface CharacterDeletionTombstone {
  readonly kind: "character-deletion-tombstone";
  readonly version: 1;
  readonly status: "non-reconstructive";
  readonly tombstoneId: ReferenceId;
  readonly manifestId: ReferenceId;
  readonly deletionCommandId: CommandId;
  readonly campaignId: CampaignId;
  readonly characterId: CharacterId;
  readonly registryRevision: Revision;
}

export interface ReferenceOwnerClosureReceipt {
  readonly kind: "reference-owner-closure-receipt";
  readonly version: 1;
  readonly outcome: "removed" | "quarantine-erased";
  readonly manifestId: ReferenceId;
  readonly tombstoneId: ReferenceId;
  readonly deletionCommandId: CommandId;
  readonly campaignId: CampaignId;
  readonly characterId: CharacterId;
  readonly ownerId: OwnerId;
  readonly ownerRevision: Revision;
  readonly payloadClass: string;
  readonly slotId: ReferenceId;
  readonly slotRevision: Revision;
  readonly targetScopeId: ReferenceId;
  readonly beforeHash: string;
  readonly afterHash: string;
  readonly survivorSetHash: string;
  readonly survivorRootHash: string;
}

function opaqueText(value: unknown, label: string): string {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > 512 ||
    value.trim() !== value ||
    /[\u0000-\u001f\u007f]/u.test(value)
  )
    throw new Error(`${label} ist kein opaker Beleg.`);
  return value;
}

function canonicalCampaignId(value: unknown, label: string): CampaignId {
  if (typeof value !== "string")
    throw new Error(`${label} ist keine Campaign-ID.`);
  try {
    return campaignId(value);
  } catch {
    throw new Error(`${label} ist keine kanonische Campaign-ID.`);
  }
}

function digestEvidence(value: unknown, label: string): string {
  try {
    return payloadDigest(opaqueText(value, label));
  } catch {
    throw new Error(`${label} ist kein kanonischer SHA-256-Beleg.`);
  }
}

type SurvivorProofInput = Pick<
  ExpectedSurvivorBinding,
  "ownerId" | "payloadClass" | "survivorId" | "targetScopeId" | "beforeHash"
>;

export function referenceOwnerSurvivorProof(
  survivors: readonly SurvivorProofInput[],
  digest: ReferenceOwnerDigest,
): ReferenceOwnerSurvivorProof {
  if (typeof digest !== "function")
    throw new Error("ReferenceOwnerDigest fehlt.");
  const ordered = [...survivors].sort((left, right) => {
      for (const field of [
        "ownerId",
        "payloadClass",
        "survivorId",
        "targetScopeId",
      ] as const) {
        const comparison = String(left[field]).localeCompare(
          String(right[field]),
        );
        if (comparison !== 0) return comparison;
      }
      return String(left.beforeHash).localeCompare(String(right.beforeHash));
    }),
    setProjection = ordered.map((survivor) => [
      survivor.ownerId,
      survivor.payloadClass,
      survivor.survivorId,
      survivor.targetScopeId,
    ]),
    survivorSetHash = payloadDigest(
      digest(
        JSON.stringify(["reference-owner-survivor-set", 1, setProjection]),
      ),
    ),
    rootProjection = ordered.map((survivor) => [
      survivor.ownerId,
      survivor.payloadClass,
      survivor.survivorId,
      survivor.targetScopeId,
      survivor.beforeHash,
    ]),
    survivorRootHash = payloadDigest(
      digest(
        JSON.stringify([
          "reference-owner-survivor-root",
          1,
          survivorSetHash,
          rootProjection,
        ]),
      ),
    );
  return Object.freeze({ survivorSetHash, survivorRootHash });
}

function slotKey(value: {
  readonly ownerId: OwnerId;
  readonly payloadClass: string;
  readonly slotId: ReferenceId;
}): string {
  return `${value.ownerId}\u0000${value.payloadClass}\u0000${value.slotId}`;
}

function targetKey(value: {
  readonly ownerId: OwnerId;
  readonly payloadClass: string;
  readonly erasureUnitId: ReferenceId;
}): string {
  return `${value.ownerId}\u0000${value.payloadClass}\u0000${value.erasureUnitId}`;
}

function survivorKey(value: {
  readonly ownerId: OwnerId;
  readonly payloadClass: string;
  readonly survivorId: ReferenceId;
}): string {
  return `${value.ownerId}\u0000${value.payloadClass}\u0000${value.survivorId}`;
}

export function parseErasureSlotDefinition(
  value: unknown,
  label = "ErasureSlotDefinition",
): ErasureSlotDefinition {
  const row = exactRecord(
    value,
    [
      "kind",
      "version",
      "campaignId",
      "ownerId",
      "payloadClass",
      "slotId",
      "slotRevision",
      "targetScopeId",
    ],
    [],
    label,
  );
  if (row.kind !== "erasure-slot-definition" || row.version !== 1)
    throw new Error(`${label} besitzt einen unbekannten Vertrag.`);
  return Object.freeze({
    kind: "erasure-slot-definition",
    version: 1,
    campaignId: canonicalCampaignId(row.campaignId, `${label}.campaignId`),
    ownerId: ownerId(row.ownerId, `${label}.ownerId`),
    payloadClass: opaqueText(row.payloadClass, `${label}.payloadClass`),
    slotId: referenceId(row.slotId, `${label}.slotId`),
    slotRevision: revision(row.slotRevision, `${label}.slotRevision`),
    targetScopeId: referenceId(row.targetScopeId, `${label}.targetScopeId`),
  });
}

function parseRegistryEntry(
  value: unknown,
  index: number,
  campaign: CampaignId,
): ReferenceOwnerRegistryEntry {
  const label = `ReferenceOwnerRegistryProjection.owners[${index}]`,
    row = exactRecord(
      value,
      ["kind", "version", "ownerId", "ownerRevision", "availability", "slots"],
      [],
      label,
    );
  if (
    row.kind !== "reference-owner-registry-entry" ||
    row.version !== 1 ||
    !(row.availability === "available" || row.availability === "unavailable")
  )
    throw new Error(`${label} besitzt einen unbekannten Verfügbarkeitsstatus.`);
  const parsedOwnerId = ownerId(row.ownerId, `${label}.ownerId`),
    slots = Object.freeze(
      uniqueBy(
        exactArray(row.slots, `${label}.slots`).map((slot, slotIndex) =>
          parseErasureSlotDefinition(slot, `${label}.slots[${slotIndex}]`),
        ),
        slotKey,
        `${label}.slots`,
      ),
    );
  if (slots.length === 0)
    throw new Error(`${label} besitzt keine vollständige Slotdeklaration.`);
  if (
    slots.some(
      (slot) => slot.campaignId !== campaign || slot.ownerId !== parsedOwnerId,
    )
  )
    throw new Error(`${label} enthält campaign- oder ownerfremde Slots.`);
  return Object.freeze({
    kind: "reference-owner-registry-entry",
    version: 1,
    ownerId: parsedOwnerId,
    ownerRevision: revision(row.ownerRevision, `${label}.ownerRevision`),
    availability: row.availability,
    slots,
  });
}

export function parseReferenceOwnerRegistryProjection(
  value: unknown,
): ReferenceOwnerRegistryProjection {
  const label = "ReferenceOwnerRegistryProjection",
    row = exactRecord(
      value,
      ["kind", "version", "status", "campaignId", "registryRevision", "owners"],
      [],
      label,
    );
  if (
    row.kind !== "reference-owner-registry-projection" ||
    row.version !== 1 ||
    row.status !== "complete"
  )
    throw new Error(
      `${label} ist unbekannt, nicht verfügbar oder unvollständig.`,
    );
  const campaign = canonicalCampaignId(row.campaignId, `${label}.campaignId`),
    owners = Object.freeze(
      uniqueBy(
        exactArray(row.owners, `${label}.owners`).map((entry, index) =>
          parseRegistryEntry(entry, index, campaign),
        ),
        (entry) => entry.ownerId,
        `${label}.owners`,
      ),
    );
  if (owners.length === 0)
    throw new Error(`${label} enthält keine vollständige Ownerdeklaration.`);
  return Object.freeze({
    kind: "reference-owner-registry-projection",
    version: 1,
    status: "complete",
    campaignId: campaign,
    registryRevision: revision(
      row.registryRevision,
      `${label}.registryRevision`,
    ),
    owners,
  });
}

export function parseErasureToken(value: unknown): ErasureToken {
  const label = "ErasureToken",
    row = exactRecord(
      value,
      [
        "kind",
        "version",
        "status",
        "tokenId",
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
      ],
      [],
      label,
    );
  if (
    row.kind !== "erasure-token" ||
    row.version !== 1 ||
    row.status !== "opaque-non-executable"
  )
    throw new Error(`${label} ist nicht opak oder nicht lokal ausführbar.`);
  return Object.freeze({
    kind: "erasure-token",
    version: 1,
    status: "opaque-non-executable",
    tokenId: referenceId(row.tokenId, `${label}.tokenId`),
    deletionCommandId: commandId(
      row.deletionCommandId,
      `${label}.deletionCommandId`,
    ),
    campaignId: canonicalCampaignId(row.campaignId, `${label}.campaignId`),
    characterId: characterId(row.characterId, `${label}.characterId`),
    ownerId: ownerId(row.ownerId, `${label}.ownerId`),
    ownerRevision: revision(row.ownerRevision, `${label}.ownerRevision`),
    payloadClass: opaqueText(row.payloadClass, `${label}.payloadClass`),
    slotId: referenceId(row.slotId, `${label}.slotId`),
    slotRevision: revision(row.slotRevision, `${label}.slotRevision`),
    erasureUnitId: referenceId(row.erasureUnitId, `${label}.erasureUnitId`),
    targetScopeId: referenceId(row.targetScopeId, `${label}.targetScopeId`),
    expectedBeforeHash: digestEvidence(
      row.expectedBeforeHash,
      `${label}.expectedBeforeHash`,
    ),
    expectedSurvivorSetHash: digestEvidence(
      row.expectedSurvivorSetHash,
      `${label}.expectedSurvivorSetHash`,
    ),
    expectedSurvivorRootHash: digestEvidence(
      row.expectedSurvivorRootHash,
      `${label}.expectedSurvivorRootHash`,
    ),
  });
}

function parseExpectedSurvivor(
  value: unknown,
  label: string,
): ExpectedSurvivorBinding {
  const row = exactRecord(
    value,
    [
      "kind",
      "version",
      "ownerId",
      "payloadClass",
      "survivorId",
      "targetScopeId",
      "beforeHash",
    ],
    [],
    label,
  );
  if (row.kind !== "expected-survivor-binding" || row.version !== 1)
    throw new Error(`${label} besitzt einen unbekannten Vertrag.`);
  return Object.freeze({
    kind: "expected-survivor-binding",
    version: 1,
    ownerId: ownerId(row.ownerId, `${label}.ownerId`),
    payloadClass: opaqueText(row.payloadClass, `${label}.payloadClass`),
    survivorId: referenceId(row.survivorId, `${label}.survivorId`),
    targetScopeId: referenceId(row.targetScopeId, `${label}.targetScopeId`),
    beforeHash: digestEvidence(row.beforeHash, `${label}.beforeHash`),
  });
}

function sameTokenBinding(
  token: ErasureToken,
  manifest: {
    readonly deletionCommandId: CommandId;
    readonly campaignId: CampaignId;
    readonly characterId: CharacterId;
  },
  entry: Omit<
    ReferenceOwnerManifestEntry,
    "erasureToken" | "expectedSurvivors"
  >,
): boolean {
  return (
    token.deletionCommandId === manifest.deletionCommandId &&
    token.campaignId === manifest.campaignId &&
    token.characterId === manifest.characterId &&
    token.ownerId === entry.ownerId &&
    token.ownerRevision === entry.ownerRevision &&
    token.payloadClass === entry.payloadClass &&
    token.slotId === entry.slotId &&
    token.slotRevision === entry.slotRevision &&
    token.erasureUnitId === entry.erasureUnitId &&
    token.targetScopeId === entry.targetScopeId &&
    token.expectedBeforeHash === entry.beforeHash &&
    token.expectedSurvivorSetHash === entry.survivorSetHash &&
    token.expectedSurvivorRootHash === entry.survivorRootHash
  );
}

function parseManifestEntry(
  value: unknown,
  index: number,
  manifest: {
    readonly deletionCommandId: CommandId;
    readonly campaignId: CampaignId;
    readonly characterId: CharacterId;
  },
  digest: ReferenceOwnerDigest,
): ReferenceOwnerManifestEntry {
  const label = `ReferenceOwnerManifest.entries[${index}]`,
    row = exactRecord(
      value,
      [
        "kind",
        "version",
        "ownerId",
        "ownerRevision",
        "payloadClass",
        "slotId",
        "slotRevision",
        "erasureUnitId",
        "targetScopeId",
        "beforeHash",
        "survivorSetHash",
        "survivorRootHash",
        "closureStatus",
        "erasureToken",
        "expectedSurvivors",
      ],
      [],
      label,
    );
  if (
    row.kind !== "reference-owner-manifest-entry" ||
    row.version !== 1 ||
    !(
      row.closureStatus === "removed" ||
      row.closureStatus === "unavailable-quarantined"
    )
  )
    throw new Error(`${label} besitzt keinen geschlossenen Status.`);
  const base = Object.freeze({
      kind: "reference-owner-manifest-entry" as const,
      version: 1 as const,
      ownerId: ownerId(row.ownerId, `${label}.ownerId`),
      ownerRevision: revision(row.ownerRevision, `${label}.ownerRevision`),
      payloadClass: opaqueText(row.payloadClass, `${label}.payloadClass`),
      slotId: referenceId(row.slotId, `${label}.slotId`),
      slotRevision: revision(row.slotRevision, `${label}.slotRevision`),
      erasureUnitId: referenceId(row.erasureUnitId, `${label}.erasureUnitId`),
      targetScopeId: referenceId(row.targetScopeId, `${label}.targetScopeId`),
      beforeHash: digestEvidence(row.beforeHash, `${label}.beforeHash`),
      survivorSetHash: digestEvidence(
        row.survivorSetHash,
        `${label}.survivorSetHash`,
      ),
      survivorRootHash: digestEvidence(
        row.survivorRootHash,
        `${label}.survivorRootHash`,
      ),
      closureStatus: row.closureStatus as "removed" | "unavailable-quarantined",
    }),
    erasureToken = parseErasureToken(row.erasureToken),
    expectedSurvivors = Object.freeze(
      uniqueBy(
        exactArray(row.expectedSurvivors, `${label}.expectedSurvivors`).map(
          (survivor, survivorIndex) =>
            parseExpectedSurvivor(
              survivor,
              `${label}.expectedSurvivors[${survivorIndex}]`,
            ),
        ),
        survivorKey,
        `${label}.expectedSurvivors`,
      ),
    ),
    survivorProof = referenceOwnerSurvivorProof(expectedSurvivors, digest);
  if (!sameTokenBinding(erasureToken, manifest, base))
    throw new Error(`${label} besitzt keinen exakt gebundenen ErasureToken.`);
  if (
    base.survivorSetHash !== survivorProof.survivorSetHash ||
    base.survivorRootHash !== survivorProof.survivorRootHash
  )
    throw new Error(`${label} besitzt keinen kanonischen Survivor-Beleg.`);
  if (
    expectedSurvivors.some(
      (survivor) =>
        survivor.ownerId !== base.ownerId ||
        survivor.payloadClass !== base.payloadClass ||
        survivor.targetScopeId !== base.targetScopeId ||
        survivor.survivorId === base.erasureUnitId,
    )
  )
    throw new Error(`${label} enthält eine überlappende Survivor-Closure.`);
  return Object.freeze({
    ...base,
    erasureToken,
    expectedSurvivors,
  });
}

export function parseReferenceOwnerManifest(
  value: unknown,
  registryValue: unknown,
  digest: ReferenceOwnerDigest,
): ReferenceOwnerManifest {
  const registry = parseReferenceOwnerRegistryProjection(registryValue),
    label = "ReferenceOwnerManifest",
    row = exactRecord(
      value,
      [
        "kind",
        "version",
        "status",
        "manifestId",
        "deletionCommandId",
        "campaignId",
        "characterId",
        "registryRevision",
        "entries",
      ],
      [],
      label,
    );
  if (
    row.kind !== "reference-owner-manifest" ||
    row.version !== 1 ||
    row.status !== "closed"
  )
    throw new Error(`${label} ist nicht geschlossen.`);
  const campaign = canonicalCampaignId(row.campaignId, `${label}.campaignId`),
    registryRevision = revision(
      row.registryRevision,
      `${label}.registryRevision`,
    ),
    binding = Object.freeze({
      deletionCommandId: commandId(
        row.deletionCommandId,
        `${label}.deletionCommandId`,
      ),
      campaignId: campaign,
      characterId: characterId(row.characterId, `${label}.characterId`),
    }),
    entries = Object.freeze(
      uniqueBy(
        exactArray(row.entries, `${label}.entries`).map((entry, index) =>
          parseManifestEntry(entry, index, binding, digest),
        ),
        slotKey,
        `${label}.entries`,
      ),
    );
  if (
    new Set(entries.map((entry) => entry.erasureToken.tokenId)).size !==
    entries.length
  )
    throw new Error(`${label} enthält mehrfach verwendete ErasureToken.`);
  if (
    campaign !== registry.campaignId ||
    registryRevision !== registry.registryRevision
  )
    throw new Error(`${label} bindet eine fremde oder stale Registry.`);
  const slots = registry.owners.flatMap((owner) =>
    owner.slots.map((slot) => ({ owner, slot })),
  );
  if (
    entries.length !== slots.length ||
    entries.some((entry) => {
      const registered = slots.find(
        ({ slot }) => slotKey(slot) === slotKey(entry),
      );
      return (
        !registered ||
        registered.owner.ownerRevision !== entry.ownerRevision ||
        registered.slot.slotRevision !== entry.slotRevision ||
        registered.slot.targetScopeId !== entry.targetScopeId ||
        (registered.owner.availability === "available"
          ? entry.closureStatus !== "removed"
          : entry.closureStatus !== "unavailable-quarantined")
      );
    })
  )
    throw new Error(
      `${label} besitzt eine unbekannte, stale oder unvollständige Registry-Closure.`,
    );
  const targetKeys = new Set(entries.map(targetKey)),
    survivorKeys = entries.flatMap((entry) =>
      entry.expectedSurvivors.map(survivorKey),
    );
  if (
    new Set(survivorKeys).size !== survivorKeys.length ||
    survivorKeys.some((key) => targetKeys.has(key))
  )
    throw new Error(`${label} enthält überlappende Survivor-Mengen.`);
  return Object.freeze({
    kind: "reference-owner-manifest",
    version: 1,
    status: "closed",
    manifestId: referenceId(row.manifestId, `${label}.manifestId`),
    ...binding,
    registryRevision,
    entries,
  });
}

export function parseCharacterDeletionTombstone(
  value: unknown,
  manifest: ReferenceOwnerManifest,
): CharacterDeletionTombstone {
  const label = "CharacterDeletionTombstone",
    row = exactRecord(
      value,
      [
        "kind",
        "version",
        "status",
        "tombstoneId",
        "manifestId",
        "deletionCommandId",
        "campaignId",
        "characterId",
        "registryRevision",
      ],
      [],
      label,
    );
  if (
    row.kind !== "character-deletion-tombstone" ||
    row.version !== 1 ||
    row.status !== "non-reconstructive"
  )
    throw new Error(`${label} enthält rekonstruierbare oder unbekannte Daten.`);
  const result = Object.freeze({
    kind: "character-deletion-tombstone" as const,
    version: 1 as const,
    status: "non-reconstructive" as const,
    tombstoneId: referenceId(row.tombstoneId, `${label}.tombstoneId`),
    manifestId: referenceId(row.manifestId, `${label}.manifestId`),
    deletionCommandId: commandId(
      row.deletionCommandId,
      `${label}.deletionCommandId`,
    ),
    campaignId: canonicalCampaignId(row.campaignId, `${label}.campaignId`),
    characterId: characterId(row.characterId, `${label}.characterId`),
    registryRevision: revision(
      row.registryRevision,
      `${label}.registryRevision`,
    ),
  });
  if (
    result.manifestId !== manifest.manifestId ||
    result.deletionCommandId !== manifest.deletionCommandId ||
    result.campaignId !== manifest.campaignId ||
    result.characterId !== manifest.characterId ||
    result.registryRevision !== manifest.registryRevision
  )
    throw new Error(`${label} bindet nicht exakt an das Manifest.`);
  return result;
}

export function parseReferenceOwnerClosureReceipt(
  value: unknown,
  manifest: ReferenceOwnerManifest,
  tombstone: CharacterDeletionTombstone,
): ReferenceOwnerClosureReceipt {
  const label = "ReferenceOwnerClosureReceipt",
    row = exactRecord(
      value,
      [
        "kind",
        "version",
        "outcome",
        "manifestId",
        "tombstoneId",
        "deletionCommandId",
        "campaignId",
        "characterId",
        "ownerId",
        "ownerRevision",
        "payloadClass",
        "slotId",
        "slotRevision",
        "targetScopeId",
        "beforeHash",
        "afterHash",
        "survivorSetHash",
        "survivorRootHash",
      ],
      [],
      label,
    );
  if (
    row.kind !== "reference-owner-closure-receipt" ||
    row.version !== 1 ||
    !(row.outcome === "removed" || row.outcome === "quarantine-erased")
  )
    throw new Error(`${label} besitzt kein bekanntes Outcome.`);
  const result = Object.freeze({
      kind: "reference-owner-closure-receipt" as const,
      version: 1 as const,
      outcome: row.outcome as "removed" | "quarantine-erased",
      manifestId: referenceId(row.manifestId, `${label}.manifestId`),
      tombstoneId: referenceId(row.tombstoneId, `${label}.tombstoneId`),
      deletionCommandId: commandId(
        row.deletionCommandId,
        `${label}.deletionCommandId`,
      ),
      campaignId: canonicalCampaignId(row.campaignId, `${label}.campaignId`),
      characterId: characterId(row.characterId, `${label}.characterId`),
      ownerId: ownerId(row.ownerId, `${label}.ownerId`),
      ownerRevision: revision(row.ownerRevision, `${label}.ownerRevision`),
      payloadClass: opaqueText(row.payloadClass, `${label}.payloadClass`),
      slotId: referenceId(row.slotId, `${label}.slotId`),
      slotRevision: revision(row.slotRevision, `${label}.slotRevision`),
      targetScopeId: referenceId(row.targetScopeId, `${label}.targetScopeId`),
      beforeHash: digestEvidence(row.beforeHash, `${label}.beforeHash`),
      afterHash: digestEvidence(row.afterHash, `${label}.afterHash`),
      survivorSetHash: digestEvidence(
        row.survivorSetHash,
        `${label}.survivorSetHash`,
      ),
      survivorRootHash: digestEvidence(
        row.survivorRootHash,
        `${label}.survivorRootHash`,
      ),
    }),
    matchingEntries = manifest.entries.filter(
      (candidate) =>
        candidate.ownerId === result.ownerId &&
        candidate.ownerRevision === result.ownerRevision &&
        candidate.payloadClass === result.payloadClass &&
        candidate.slotId === result.slotId &&
        candidate.slotRevision === result.slotRevision &&
        candidate.targetScopeId === result.targetScopeId,
    ),
    entry = matchingEntries.length === 1 ? matchingEntries[0] : undefined;
  if (
    !entry ||
    result.manifestId !== manifest.manifestId ||
    result.tombstoneId !== tombstone.tombstoneId ||
    tombstone.manifestId !== manifest.manifestId ||
    tombstone.deletionCommandId !== manifest.deletionCommandId ||
    tombstone.campaignId !== manifest.campaignId ||
    tombstone.characterId !== manifest.characterId ||
    tombstone.registryRevision !== manifest.registryRevision ||
    result.deletionCommandId !== manifest.deletionCommandId ||
    result.campaignId !== manifest.campaignId ||
    result.characterId !== manifest.characterId ||
    result.beforeHash !== entry.beforeHash ||
    result.afterHash === result.beforeHash ||
    result.survivorSetHash !== entry.survivorSetHash ||
    result.survivorRootHash !== entry.survivorRootHash ||
    (entry.closureStatus === "removed" && result.outcome !== "removed")
  )
    throw new Error(
      `${label} bindet Slot, Ziel, Before oder After nicht exakt.`,
    );
  return result;
}
