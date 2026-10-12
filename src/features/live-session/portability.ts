import {
  canonicalCampaignId,
  evidenceDigest,
  type CampaignId,
} from "./evidence";
import {
  parseCharacterDeletionTombstone,
  parseErasureToken,
  parseReferenceOwnerManifest,
  parseReferenceOwnerRegistryProjection,
  referenceOwnerSurvivorProof,
  type ErasureToken,
  type ExpectedSurvivorBinding,
  type ReferenceOwnerDigest,
  type ReferenceOwnerRegistryProjection,
} from "./reference-owners";
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
import { exactArray, exactBoolean, exactRecord, exactText, uniqueBy } from "./validation";

export type ProviderDisposition =
  | "present"
  | "disabled"
  | "absent"
  | "replaced";

export interface ProviderDispositionEvidence {
  readonly kind: "provider-disposition-evidence";
  readonly version: 1;
  readonly disposition: ProviderDisposition;
  readonly targetCampaignId: CampaignId;
  readonly targetOwnerId: OwnerId;
  readonly targetRegistryRevision: Revision;
  readonly targetOwnerRevision: Revision;
  readonly rebindAllowed: boolean;
}

export interface RetainedQuarantineSlot {
  readonly kind: "retained-quarantine-slot";
  readonly version: 1;
  readonly status: "offline-quarantined";
  readonly coreEnvelopeId: ReferenceId;
  readonly sourceManifestId: ReferenceId;
  readonly sourceTombstoneId: ReferenceId;
  readonly sourceToken: ErasureToken;
  readonly targetCampaignId: CampaignId;
  readonly targetCharacterId: CharacterId;
  readonly targetDeletionCommandId: CommandId;
  readonly targetRegistryRevision: Revision;
  readonly targetOwnerId: OwnerId;
  readonly targetOwnerRevision: Revision;
  readonly payloadClass: string;
  readonly targetSlotId: ReferenceId;
  readonly targetSlotRevision: Revision;
  readonly targetErasureUnitId: ReferenceId;
  readonly targetScopeId: ReferenceId;
  readonly expectedBeforeHash: string;
  readonly expectedSurvivorSetHash: string;
  readonly expectedSurvivorRootHash: string;
  readonly opaqueEnvelopeHash: string;
  readonly survivorRemap: readonly QuarantineSurvivorRemap[];
}

export interface QuarantineSurvivorRemap {
  readonly kind: "quarantine-survivor-remap";
  readonly version: 1;
  readonly sourceOwnerId: OwnerId;
  readonly sourcePayloadClass: string;
  readonly sourceSurvivorId: ReferenceId;
  readonly sourceTargetScopeId: ReferenceId;
  readonly sourceBeforeHash: string;
  readonly targetOwnerId: OwnerId;
  readonly targetPayloadClass: string;
  readonly targetSurvivorId: ReferenceId;
  readonly targetTargetScopeId: ReferenceId;
  readonly targetBeforeHash: string;
}

export interface QuarantineDiscardReceipt {
  readonly kind: "quarantine-discard-receipt";
  readonly version: 1;
  readonly outcome: "local-opaque-envelope-discard";
  readonly providerSemanticClosureClaimed: false;
  readonly commandId: CommandId;
  readonly targetCampaignId: CampaignId;
  readonly targetCharacterId: CharacterId;
  readonly targetDeletionCommandId: CommandId;
  readonly targetRegistryRevision: Revision;
  readonly targetOwnerId: OwnerId;
  readonly targetOwnerRevision: Revision;
  readonly providerDisposition: "absent";
  readonly rebindAllowed: false;
  readonly coreEnvelopeId: ReferenceId;
  readonly sourceManifestId: ReferenceId;
  readonly sourceTombstoneId: ReferenceId;
  readonly beforeHash: string;
  readonly afterHash: string;
  readonly survivorSetHash: string;
  readonly survivorRootHash: string;
}

export interface PortabilityInventoryEntry {
  readonly kind: "portability-inventory-entry";
  readonly version: 1;
  readonly identity: ReferenceId;
  readonly payloadKind:
    | "campaign-content"
    | "media"
    | "retained-quarantine"
    | "nonreconstructive-evidence";
  readonly status: "verified" | "missing" | "corrupt";
  readonly required: boolean;
  readonly retainedMetadata: boolean;
  readonly impact?: string;
}

export interface PortabilityDecision {
  readonly kind: "portability-decision";
  readonly version: 1;
  readonly mode: "complete" | "salvage" | "evidentiary";
  readonly closureState:
    | "closure-clean"
    | "closure-pending"
    | "permanent-purge-finalized";
  readonly allowed: boolean;
  readonly reason:
    | "complete"
    | "salvage-disclosed"
    | "evidentiary-only"
    | "inventory-unverified"
    | "pending-quarantine-unverified"
    | "purged-payload-present"
    | "salvage-undisclosed"
    | "evidentiary-payload-present";
  readonly includedIdentities: readonly ReferenceId[];
  readonly omittedIdentities: readonly ReferenceId[];
}

function hash(value: unknown, label: string): string {
  return evidenceDigest(value, label);
}

function opaque(value: unknown, label: string): string {
  const parsed = exactText(value, label);
  if (parsed.trim() !== parsed || /[\u0000-\u001f\u007f]/u.test(parsed))
    throw new Error(`${label} ist kein opaker Vertragstext.`);
  return parsed;
}

function parseSurvivorRemap(
  value: unknown,
  index: number,
): QuarantineSurvivorRemap {
  const label = `RetainedQuarantineSlot.survivorRemap[${index}]`,
    row = exactRecord(
      value,
      [
        "kind",
        "version",
        "sourceOwnerId",
        "sourcePayloadClass",
        "sourceSurvivorId",
        "sourceTargetScopeId",
        "sourceBeforeHash",
        "targetOwnerId",
        "targetPayloadClass",
        "targetSurvivorId",
        "targetTargetScopeId",
        "targetBeforeHash",
      ],
      [],
      label,
    );
  if (row.kind !== "quarantine-survivor-remap" || row.version !== 1)
    throw new Error(`${label} besitzt einen unbekannten Vertrag.`);
  const result = Object.freeze({
    kind: "quarantine-survivor-remap" as const,
    version: 1 as const,
    sourceOwnerId: ownerId(row.sourceOwnerId, `${label}.sourceOwnerId`),
    sourcePayloadClass: opaque(
      row.sourcePayloadClass,
      `${label}.sourcePayloadClass`,
    ),
    sourceSurvivorId: referenceId(
      row.sourceSurvivorId,
      `${label}.sourceSurvivorId`,
    ),
    sourceTargetScopeId: referenceId(
      row.sourceTargetScopeId,
      `${label}.sourceTargetScopeId`,
    ),
    sourceBeforeHash: hash(
      row.sourceBeforeHash,
      `${label}.sourceBeforeHash`,
    ),
    targetOwnerId: ownerId(row.targetOwnerId, `${label}.targetOwnerId`),
    targetPayloadClass: opaque(
      row.targetPayloadClass,
      `${label}.targetPayloadClass`,
    ),
    targetSurvivorId: referenceId(
      row.targetSurvivorId,
      `${label}.targetSurvivorId`,
    ),
    targetTargetScopeId: referenceId(
      row.targetTargetScopeId,
      `${label}.targetTargetScopeId`,
    ),
    targetBeforeHash: hash(
      row.targetBeforeHash,
      `${label}.targetBeforeHash`,
    ),
  });
  if (result.sourceSurvivorId === result.targetSurvivorId)
    throw new Error(`${label} remappt keine unabhängige Survivor-ID.`);
  return result;
}

function survivorBindingKey(value: {
  readonly ownerId: OwnerId;
  readonly payloadClass: string;
  readonly survivorId: ReferenceId;
  readonly targetScopeId: ReferenceId;
}): string {
  return `${value.ownerId}\u0000${value.payloadClass}\u0000${value.survivorId}\u0000${value.targetScopeId}`;
}

export function parseRetainedQuarantineSlot(
  value: unknown,
): RetainedQuarantineSlot {
  const label = "RetainedQuarantineSlot",
    row = exactRecord(
      value,
      [
        "kind",
        "version",
        "status",
        "coreEnvelopeId",
        "sourceManifestId",
        "sourceTombstoneId",
        "sourceToken",
        "targetCampaignId",
        "targetCharacterId",
        "targetDeletionCommandId",
        "targetRegistryRevision",
        "targetOwnerId",
        "targetOwnerRevision",
        "payloadClass",
        "targetSlotId",
        "targetSlotRevision",
        "targetErasureUnitId",
        "targetScopeId",
        "expectedBeforeHash",
        "expectedSurvivorSetHash",
        "expectedSurvivorRootHash",
        "opaqueEnvelopeHash",
        "survivorRemap",
      ],
      [],
      label,
    );
  if (
    row.kind !== "retained-quarantine-slot" ||
    row.version !== 1 ||
    row.status !== "offline-quarantined"
  )
    throw new Error(`${label} besitzt keinen offline quarantined Vertrag.`);
  const sourceToken = parseErasureToken(row.sourceToken),
    survivorRemap = Object.freeze(
      uniqueBy(
        exactArray(row.survivorRemap, `${label}.survivorRemap`).map(
          parseSurvivorRemap,
        ),
        (entry) =>
          `${entry.sourceOwnerId}\u0000${entry.sourcePayloadClass}\u0000${entry.sourceSurvivorId}\u0000${entry.sourceTargetScopeId}`,
        `${label}.survivorRemap.source`,
      ),
    ),
    result = Object.freeze({
      kind: "retained-quarantine-slot" as const,
      version: 1 as const,
      status: "offline-quarantined" as const,
      coreEnvelopeId: referenceId(
        row.coreEnvelopeId,
        `${label}.coreEnvelopeId`,
      ),
      sourceManifestId: referenceId(
        row.sourceManifestId,
        `${label}.sourceManifestId`,
      ),
      sourceTombstoneId: referenceId(
        row.sourceTombstoneId,
        `${label}.sourceTombstoneId`,
      ),
      sourceToken,
      targetCampaignId: canonicalCampaignId(
        row.targetCampaignId,
        `${label}.targetCampaignId`,
      ),
      targetCharacterId: characterId(
        row.targetCharacterId,
        `${label}.targetCharacterId`,
      ),
      targetDeletionCommandId: commandId(
        row.targetDeletionCommandId,
        `${label}.targetDeletionCommandId`,
      ),
      targetRegistryRevision: revision(
        row.targetRegistryRevision,
        `${label}.targetRegistryRevision`,
      ),
      targetOwnerId: ownerId(row.targetOwnerId, `${label}.targetOwnerId`),
      targetOwnerRevision: revision(
        row.targetOwnerRevision,
        `${label}.targetOwnerRevision`,
      ),
      payloadClass: opaque(row.payloadClass, `${label}.payloadClass`),
      targetSlotId: referenceId(row.targetSlotId, `${label}.targetSlotId`),
      targetSlotRevision: revision(
        row.targetSlotRevision,
        `${label}.targetSlotRevision`,
      ),
      targetErasureUnitId: referenceId(
        row.targetErasureUnitId,
        `${label}.targetErasureUnitId`,
      ),
      targetScopeId: referenceId(
        row.targetScopeId,
        `${label}.targetScopeId`,
      ),
      expectedBeforeHash: hash(
        row.expectedBeforeHash,
        `${label}.expectedBeforeHash`,
      ),
      expectedSurvivorSetHash: hash(
        row.expectedSurvivorSetHash,
        `${label}.expectedSurvivorSetHash`,
      ),
      expectedSurvivorRootHash: hash(
        row.expectedSurvivorRootHash,
        `${label}.expectedSurvivorRootHash`,
      ),
      opaqueEnvelopeHash: hash(
        row.opaqueEnvelopeHash,
        `${label}.opaqueEnvelopeHash`,
      ),
      survivorRemap,
    });
  if (
    result.targetCampaignId === sourceToken.campaignId ||
    result.targetCharacterId === sourceToken.characterId ||
    result.targetDeletionCommandId === sourceToken.deletionCommandId ||
    result.targetSlotId === sourceToken.slotId ||
    result.targetErasureUnitId === sourceToken.erasureUnitId ||
    result.targetScopeId === sourceToken.targetScopeId ||
    new Set(
      result.survivorRemap.map(
        (entry) =>
          `${entry.targetOwnerId}\u0000${entry.targetPayloadClass}\u0000${entry.targetSurvivorId}\u0000${entry.targetTargetScopeId}`,
      ),
    ).size !== result.survivorRemap.length ||
    result.survivorRemap.some(
      (entry) =>
        entry.targetOwnerId !== result.targetOwnerId ||
        entry.targetPayloadClass !== result.payloadClass ||
        entry.targetTargetScopeId !== result.targetScopeId,
    )
  )
    throw new Error(
      `${label} besitzt keine unabhängige vollständige Remap-Closure.`,
    );
  return result;
}

export function bindRetainedQuarantineSlot(
  slotValue: unknown,
  sourceRegistryValue: unknown,
  sourceManifestValue: unknown,
  sourceTombstoneValue: unknown,
  digest: ReferenceOwnerDigest,
): RetainedQuarantineSlot {
  const slot = parseRetainedQuarantineSlot(slotValue),
    registry = parseReferenceOwnerRegistryProjection(sourceRegistryValue),
    manifest = parseReferenceOwnerManifest(
      sourceManifestValue,
      registry,
      digest,
    ),
    tombstone = parseCharacterDeletionTombstone(
      sourceTombstoneValue,
      manifest,
    ),
    sourceEntry = manifest.entries.find(
      (entry) => entry.erasureToken.tokenId === slot.sourceToken.tokenId,
    ),
    sourceSurvivors = sourceEntry?.expectedSurvivors ?? [],
    targetSurvivors: readonly ExpectedSurvivorBinding[] =
      slot.survivorRemap.map((entry) =>
        Object.freeze({
          kind: "expected-survivor-binding" as const,
          version: 1 as const,
          ownerId: entry.targetOwnerId,
          payloadClass: entry.targetPayloadClass,
          survivorId: entry.targetSurvivorId,
          targetScopeId: entry.targetTargetScopeId,
          beforeHash: entry.targetBeforeHash,
        }),
      ),
    targetProof = referenceOwnerSurvivorProof(targetSurvivors, digest);
  if (
    slot.sourceManifestId !== manifest.manifestId ||
    slot.sourceTombstoneId !== tombstone.tombstoneId ||
    !sourceEntry ||
    sourceEntry.payloadClass !== slot.payloadClass ||
    JSON.stringify(sourceEntry.erasureToken) !==
      JSON.stringify(slot.sourceToken) ||
    sourceSurvivors.length !== slot.survivorRemap.length ||
    sourceSurvivors.some((source) => {
      const mapped = slot.survivorRemap.find(
        (entry) =>
          survivorBindingKey(source) ===
          survivorBindingKey({
            ownerId: entry.sourceOwnerId,
            payloadClass: entry.sourcePayloadClass,
            survivorId: entry.sourceSurvivorId,
            targetScopeId: entry.sourceTargetScopeId,
          }),
      );
      return !mapped || mapped.sourceBeforeHash !== source.beforeHash;
    }) ||
    targetProof.survivorSetHash !== slot.expectedSurvivorSetHash ||
    targetProof.survivorRootHash !== slot.expectedSurvivorRootHash
  )
    throw new Error(
      "RetainedQuarantineSlot bindet nicht exakt an seine Quell-Closure.",
    );
  return slot;
}

export function mintReboundErasureToken(
  slotValue: unknown,
  registryValue: unknown,
  providerDisposition: ProviderDisposition,
  tokenValue: unknown,
): ErasureToken {
  const slot = parseRetainedQuarantineSlot(slotValue),
    registry = parseReferenceOwnerRegistryProjection(registryValue),
    token = parseErasureToken(tokenValue);
  if (providerDisposition !== "present")
    throw new Error("ErasureToken-Rebind benötigt einen installierten Owner.");
  const owner = registry.owners.find(
      (candidate) => candidate.ownerId === slot.targetOwnerId,
    ),
    registeredSlot = owner?.slots.find(
      (candidate) =>
        candidate.payloadClass === slot.payloadClass &&
        candidate.slotId === slot.targetSlotId,
    );
  if (
    registry.campaignId !== slot.targetCampaignId ||
    registry.registryRevision !== slot.targetRegistryRevision ||
    !owner ||
    owner.availability !== "available" ||
    owner.ownerRevision !== slot.targetOwnerRevision ||
    !registeredSlot ||
    registeredSlot.slotRevision !== slot.targetSlotRevision ||
    registeredSlot.targetScopeId !== slot.targetScopeId ||
    token.tokenId === slot.sourceToken.tokenId ||
    token.campaignId !== slot.targetCampaignId ||
    token.characterId !== slot.targetCharacterId ||
    token.deletionCommandId !== slot.targetDeletionCommandId ||
    token.ownerId !== slot.targetOwnerId ||
    token.ownerRevision !== slot.targetOwnerRevision ||
    token.payloadClass !== slot.payloadClass ||
    token.slotId !== slot.targetSlotId ||
    token.slotRevision !== slot.targetSlotRevision ||
    token.erasureUnitId !== slot.targetErasureUnitId ||
    token.targetScopeId !== slot.targetScopeId ||
    token.expectedBeforeHash !== slot.expectedBeforeHash ||
    token.expectedSurvivorSetHash !== slot.expectedSurvivorSetHash ||
    token.expectedSurvivorRootHash !== slot.expectedSurvivorRootHash
  )
    throw new Error("ErasureToken-Rebind ist fremd, stale oder unvollständig.");
  return token;
}

export function parseQuarantineDiscardReceipt(
  value: unknown,
  slotValue: unknown,
): QuarantineDiscardReceipt {
  const slot = parseRetainedQuarantineSlot(slotValue),
    label = "QuarantineDiscardReceipt",
    row = exactRecord(
      value,
      [
        "kind",
        "version",
        "outcome",
        "providerSemanticClosureClaimed",
        "commandId",
        "targetCampaignId",
        "targetCharacterId",
        "targetDeletionCommandId",
        "targetRegistryRevision",
        "targetOwnerId",
        "targetOwnerRevision",
        "providerDisposition",
        "rebindAllowed",
        "coreEnvelopeId",
        "sourceManifestId",
        "sourceTombstoneId",
        "beforeHash",
        "afterHash",
        "survivorSetHash",
        "survivorRootHash",
      ],
      [],
      label,
    );
  if (
    row.kind !== "quarantine-discard-receipt" ||
    row.version !== 1 ||
    row.outcome !== "local-opaque-envelope-discard" ||
    row.providerSemanticClosureClaimed !== false ||
    row.providerDisposition !== "absent" ||
    row.rebindAllowed !== false
  )
    throw new Error(`${label} behauptet eine fremde semantische Closure.`);
  const result = Object.freeze({
    kind: "quarantine-discard-receipt" as const,
    version: 1 as const,
    outcome: "local-opaque-envelope-discard" as const,
    providerSemanticClosureClaimed: false as const,
    commandId: commandId(row.commandId, `${label}.commandId`),
    targetCampaignId: canonicalCampaignId(
      row.targetCampaignId,
      `${label}.targetCampaignId`,
    ),
    targetCharacterId: characterId(
      row.targetCharacterId,
      `${label}.targetCharacterId`,
    ),
    targetDeletionCommandId: commandId(
      row.targetDeletionCommandId,
      `${label}.targetDeletionCommandId`,
    ),
    targetRegistryRevision: revision(
      row.targetRegistryRevision,
      `${label}.targetRegistryRevision`,
    ),
    targetOwnerId: ownerId(row.targetOwnerId, `${label}.targetOwnerId`),
    targetOwnerRevision: revision(
      row.targetOwnerRevision,
      `${label}.targetOwnerRevision`,
    ),
    providerDisposition: "absent" as const,
    rebindAllowed: false as const,
    coreEnvelopeId: referenceId(
      row.coreEnvelopeId,
      `${label}.coreEnvelopeId`,
    ),
    sourceManifestId: referenceId(
      row.sourceManifestId,
      `${label}.sourceManifestId`,
    ),
    sourceTombstoneId: referenceId(
      row.sourceTombstoneId,
      `${label}.sourceTombstoneId`,
    ),
    beforeHash: hash(row.beforeHash, `${label}.beforeHash`),
    afterHash: hash(row.afterHash, `${label}.afterHash`),
    survivorSetHash: hash(
      row.survivorSetHash,
      `${label}.survivorSetHash`,
    ),
    survivorRootHash: hash(
      row.survivorRootHash,
      `${label}.survivorRootHash`,
    ),
  });
  if (
    result.targetCampaignId !== slot.targetCampaignId ||
    result.targetCharacterId !== slot.targetCharacterId ||
    result.targetDeletionCommandId !== slot.targetDeletionCommandId ||
    result.targetRegistryRevision !== slot.targetRegistryRevision ||
    result.targetOwnerId !== slot.targetOwnerId ||
    result.targetOwnerRevision !== slot.targetOwnerRevision ||
    result.providerDisposition !== "absent" ||
    result.rebindAllowed !== false ||
    result.coreEnvelopeId !== slot.coreEnvelopeId ||
    result.sourceManifestId !== slot.sourceManifestId ||
    result.sourceTombstoneId !== slot.sourceTombstoneId ||
    result.beforeHash !== slot.opaqueEnvelopeHash ||
    result.afterHash === result.beforeHash ||
    result.survivorSetHash !== slot.expectedSurvivorSetHash ||
    result.survivorRootHash !== slot.expectedSurvivorRootHash
  )
    throw new Error(`${label} bindet nicht exakt an den Core-Envelope.`);
  return result;
}

export function decideQuarantineDiscard(
  slotValue: unknown,
  registryValue: unknown,
  providerEvidenceValue: unknown,
  receiptValue: unknown,
  existingReceiptValue?: unknown,
): QuarantineDiscardReceipt {
  const slot = parseRetainedQuarantineSlot(slotValue),
    registry = assertTargetRegistryForQuarantine(slot, registryValue),
    evidence = parseProviderDispositionEvidence(providerEvidenceValue),
    receipt = parseQuarantineDiscardReceipt(receiptValue, slot);
  const owner = registry.owners.find(
    (candidate) => candidate.ownerId === slot.targetOwnerId,
  );
  if (
    evidence.disposition !== "absent" ||
    evidence.targetCampaignId !== slot.targetCampaignId ||
    evidence.targetOwnerId !== slot.targetOwnerId ||
    evidence.targetRegistryRevision !== registry.registryRevision ||
    evidence.targetOwnerRevision !== slot.targetOwnerRevision ||
    evidence.rebindAllowed !== false ||
    !owner ||
    owner.ownerRevision !== evidence.targetOwnerRevision ||
    owner.availability !== "unavailable"
  )
    throw new Error(
      "QuarantineDiscard benötigt einen aktuellen revisionsgebundenen Absent-Beleg.",
    );
  if (existingReceiptValue === undefined) return receipt;
  const existing = parseQuarantineDiscardReceipt(existingReceiptValue, slot);
  if (JSON.stringify(existing) !== JSON.stringify(receipt))
    throw new Error("QuarantineDiscard-Retry widerspricht dem Originalreceipt.");
  return existing;
}

export function parseProviderDispositionEvidence(
  value: unknown,
): ProviderDispositionEvidence {
  const label = "ProviderDispositionEvidence",
    row = exactRecord(
      value,
      [
        "kind",
        "version",
        "disposition",
        "targetCampaignId",
        "targetOwnerId",
        "targetRegistryRevision",
        "targetOwnerRevision",
        "rebindAllowed",
      ],
      [],
      label,
    );
  if (
    row.kind !== "provider-disposition-evidence" ||
    row.version !== 1 ||
    !(["present", "disabled", "absent", "replaced"] as const).includes(
      row.disposition as ProviderDisposition,
    )
  )
    throw new Error(`${label} besitzt einen unbekannten Vertrag.`);
  return Object.freeze({
    kind: "provider-disposition-evidence",
    version: 1,
    disposition: row.disposition as ProviderDisposition,
    targetCampaignId: canonicalCampaignId(
      row.targetCampaignId,
      `${label}.targetCampaignId`,
    ),
    targetOwnerId: ownerId(row.targetOwnerId, `${label}.targetOwnerId`),
    targetRegistryRevision: revision(
      row.targetRegistryRevision,
      `${label}.targetRegistryRevision`,
    ),
    targetOwnerRevision: revision(
      row.targetOwnerRevision,
      `${label}.targetOwnerRevision`,
    ),
    rebindAllowed: exactBoolean(
      row.rebindAllowed,
      `${label}.rebindAllowed`,
    ),
  });
}

function parseInventoryEntry(
  value: unknown,
  index: number,
): PortabilityInventoryEntry {
  const label = `PortabilityInventory[${index}]`,
    row = exactRecord(
      value,
      [
        "kind",
        "version",
        "identity",
        "payloadKind",
        "status",
        "required",
        "retainedMetadata",
      ],
      ["impact"],
      label,
    );
  if (
    row.kind !== "portability-inventory-entry" ||
    row.version !== 1 ||
    ![
      "campaign-content",
      "media",
      "retained-quarantine",
      "nonreconstructive-evidence",
    ].includes(String(row.payloadKind)) ||
    !["verified", "missing", "corrupt"].includes(String(row.status))
  )
    throw new Error(`${label} besitzt einen unbekannten Vertrag.`);
  const status = row.status as PortabilityInventoryEntry["status"],
    impact =
      row.impact === undefined
        ? undefined
        : exactText(row.impact, `${label}.impact`);
  if (status !== "verified" && !impact)
    throw new Error(`${label} verschweigt die Auswirkung eines Fehlers.`);
  return Object.freeze({
    kind: "portability-inventory-entry",
    version: 1,
    identity: referenceId(row.identity, `${label}.identity`),
    payloadKind: row.payloadKind as PortabilityInventoryEntry["payloadKind"],
    status,
    required: exactBoolean(row.required, `${label}.required`),
    retainedMetadata: exactBoolean(
      row.retainedMetadata,
      `${label}.retainedMetadata`,
    ),
    ...(impact === undefined ? {} : { impact }),
  });
}

export function decidePortability(
  mode: PortabilityDecision["mode"],
  closureState: PortabilityDecision["closureState"],
  inventoryValue: unknown,
): PortabilityDecision {
  if (!(["complete", "salvage", "evidentiary"] as const).includes(mode))
    throw new Error("PortabilityDecision.mode ist unbekannt.");
  if (
    !(
      [
        "closure-clean",
        "closure-pending",
        "permanent-purge-finalized",
      ] as const
    ).includes(closureState)
  )
    throw new Error("PortabilityDecision.closureState ist unbekannt.");
  const inventory = uniqueBy(
      exactArray(inventoryValue, "PortabilityInventory").map(
        parseInventoryEntry,
      ),
      (entry) => entry.identity,
      "PortabilityInventory",
    ),
    unverified = inventory.filter((entry) => entry.status !== "verified"),
    quarantine = inventory.filter(
      (entry) => entry.payloadKind === "retained-quarantine",
    ),
    included = Object.freeze(
      inventory
        .filter((entry) => entry.status === "verified")
        .map((entry) => entry.identity),
    ),
    omitted = Object.freeze(
      inventory
        .filter((entry) => entry.status !== "verified")
        .map((entry) => entry.identity),
    ),
    result = (
      allowed: boolean,
      reason: PortabilityDecision["reason"],
    ): PortabilityDecision =>
      Object.freeze({
        kind: "portability-decision",
        version: 1,
        mode,
        closureState,
        allowed,
        reason,
        includedIdentities: included,
        omittedIdentities: omitted,
      });
  if (mode === "complete") {
    if (
      closureState === "closure-pending" &&
      (quarantine.length === 0 ||
        quarantine.some((entry) => entry.status !== "verified"))
    )
      return result(false, "pending-quarantine-unverified");
    if (
      closureState === "permanent-purge-finalized" &&
      quarantine.some((entry) => entry.status === "verified")
    )
      return result(false, "purged-payload-present");
    if (unverified.length) return result(false, "inventory-unverified");
    return result(true, "complete");
  }
  if (mode === "salvage") {
    if (
      unverified.some(
        (entry) => !entry.impact || !entry.retainedMetadata,
      )
    )
      return result(false, "salvage-undisclosed");
    return result(true, "salvage-disclosed");
  }
  if (
    inventory.some(
      (entry) =>
        entry.status === "verified" &&
        entry.payloadKind !== "nonreconstructive-evidence",
    )
  )
    return result(false, "evidentiary-payload-present");
  return result(true, "evidentiary-only");
}

export function assertTargetRegistryForQuarantine(
  slotValue: unknown,
  registryValue: unknown,
): ReferenceOwnerRegistryProjection {
  const slot = parseRetainedQuarantineSlot(slotValue),
    registry = parseReferenceOwnerRegistryProjection(registryValue);
  if (
    registry.campaignId !== slot.targetCampaignId ||
    registry.registryRevision !== slot.targetRegistryRevision ||
    !registry.owners.some(
      (owner) =>
        owner.ownerId === slot.targetOwnerId &&
        owner.ownerRevision === slot.targetOwnerRevision &&
        owner.slots.some(
          (candidate) =>
            candidate.payloadClass === slot.payloadClass &&
            candidate.slotId === slot.targetSlotId &&
            candidate.slotRevision === slot.targetSlotRevision &&
            candidate.targetScopeId === slot.targetScopeId,
        ),
    )
  )
    throw new Error("RetainedQuarantineSlot besitzt keine lokale Registrybindung.");
  return registry;
}
