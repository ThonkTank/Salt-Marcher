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
  type ErasureToken,
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
    | "required-input-unverified"
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
    });
  if (
    result.targetCampaignId === sourceToken.campaignId ||
    result.targetCharacterId === sourceToken.characterId ||
    result.targetDeletionCommandId === sourceToken.deletionCommandId ||
    result.targetSlotId === sourceToken.slotId ||
    result.targetErasureUnitId === sourceToken.erasureUnitId ||
    result.targetScopeId === sourceToken.targetScopeId ||
    result.expectedBeforeHash !== sourceToken.expectedBeforeHash ||
    result.expectedSurvivorSetHash !== sourceToken.expectedSurvivorSetHash ||
    result.expectedSurvivorRootHash !== sourceToken.expectedSurvivorRootHash
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
    );
  if (
    slot.sourceManifestId !== manifest.manifestId ||
    slot.sourceTombstoneId !== tombstone.tombstoneId ||
    !sourceEntry ||
    sourceEntry.payloadClass !== slot.payloadClass ||
    JSON.stringify(sourceEntry.erasureToken) !==
      JSON.stringify(slot.sourceToken)
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
    row.providerSemanticClosureClaimed !== false
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
  providerDisposition: ProviderDisposition,
  receiptValue: unknown,
  existingReceiptValue?: unknown,
): QuarantineDiscardReceipt {
  if (providerDisposition !== "absent")
    throw new Error("QuarantineDiscard ist nur bei dauerhaft absentem Owner zulässig.");
  const slot = parseRetainedQuarantineSlot(slotValue),
    receipt = parseQuarantineDiscardReceipt(receiptValue, slot);
  if (existingReceiptValue === undefined) return receipt;
  const existing = parseQuarantineDiscardReceipt(existingReceiptValue, slot);
  if (JSON.stringify(existing) !== JSON.stringify(receipt))
    throw new Error("QuarantineDiscard-Retry widerspricht dem Originalreceipt.");
  return existing;
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
    invalid = inventory.filter(
      (entry) => entry.required && entry.status !== "verified",
    ),
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
    if (invalid.length) return result(false, "required-input-unverified");
    return result(true, "complete");
  }
  if (mode === "salvage") {
    if (
      invalid.some(
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
