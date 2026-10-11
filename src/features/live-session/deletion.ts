import {
  parseDeactivatePartyCharacterCommand,
  type DeactivatePartyCharacterCommand,
} from "./commands";
import {
  parsePartyCommandHistory,
  sealPartyHistoryForDeletion,
  type PartyCommandHistory,
  type PartyHistoryDigest,
} from "./history";
import {
  receiptId,
  referenceId,
  type CharacterId,
  type CommandDigest,
  type CommandId,
  type ReceiptId,
  type ReferenceId,
} from "./ids";
import {
  parseCharacterDeletionTombstone,
  parseReferenceOwnerClosureReceipt,
  parseReferenceOwnerManifest,
  parseReferenceOwnerRegistryProjection,
  type CharacterDeletionTombstone,
  type ReferenceOwnerClosureReceipt,
  type ReferenceOwnerDigest,
  type ReferenceOwnerManifest,
} from "./reference-owners";
import {
  deactivatePartyCharacter,
  type CharacterMembershipDecision,
} from "./scene-aggregate";
import {
  parseLiveSessionAggregateState,
  type LiveSessionAggregateState,
} from "./state";
import { exactArray, exactRecord, uniqueBy } from "./validation";

export type PermanentCharacterDeletionCommand = Omit<
  DeactivatePartyCharacterCommand,
  "kind"
> & {
  readonly kind: "permanent-character-deletion";
  readonly historyEntryId: ReferenceId;
  readonly historyReceiptId: ReceiptId;
  readonly manifestId: ReferenceId;
  readonly tombstoneId: ReferenceId;
};

export interface CharacterDeletionDecision {
  readonly kind: "character-deletion-decision";
  readonly version: 1;
  readonly status: "logical-delete/closure-pending" | "logical-delete/closed";
  readonly commandId: CommandId;
  readonly commandDigest: CommandDigest;
  readonly characterId: CharacterId;
  readonly state: LiveSessionAggregateState;
  readonly history: PartyCommandHistory;
  readonly manifest: ReferenceOwnerManifest;
  readonly tombstone: CharacterDeletionTombstone;
  readonly membership?: CharacterMembershipDecision;
  readonly outstandingEntryIds: readonly ReferenceId[];
}

export type CharacterDeletionResult =
  | { readonly status: "applied"; readonly decision: CharacterDeletionDecision }
  | {
      readonly status: "rejected" | "cancelled";
      readonly state: LiveSessionAggregateState;
      readonly history: PartyCommandHistory;
      readonly commandId: CommandId;
      readonly commandDigest: CommandDigest;
      readonly reason:
        | "cancelled"
        | "foreign-campaign"
        | "stale-registry"
        | "unknown-character"
        | "aggregate-rejected";
    };

export interface CharacterClosureAssessment {
  readonly kind: "character-closure-assessment";
  readonly version: 1;
  readonly status: "closure-pending" | "permanent-purge-finalized";
  readonly manifestId: ReferenceId;
  readonly tombstoneId: ReferenceId;
  readonly receipts: readonly ReferenceOwnerClosureReceipt[];
  readonly outstandingEntryIds: readonly ReferenceId[];
  readonly purgeEligible: boolean;
}

const DEACTIVATE_REQUIRED = [
  "kind",
  "version",
  "campaignId",
  "commandId",
  "commandDigest",
  "expectedPartyRevision",
  "expectedFocusRevision",
  "cancelled",
  "characterId",
  "maskOwnerContributions",
] as const;

const DEACTIVATE_OPTIONAL = [
  "expectedSourceRevision",
  "primarySuccessorSceneId",
  "expectedSuccessorRevision",
] as const;

export function parsePermanentCharacterDeletionCommand(
  value: unknown,
): PermanentCharacterDeletionCommand {
  const label = "PermanentCharacterDeletionCommand",
    row = exactRecord(
      value,
      [
        ...DEACTIVATE_REQUIRED,
        "historyEntryId",
        "historyReceiptId",
        "manifestId",
        "tombstoneId",
      ],
      DEACTIVATE_OPTIONAL,
      label,
    );
  if (row.kind !== "permanent-character-deletion" || row.version !== 1)
    throw new Error(`${label} besitzt einen unbekannten Vertrag.`);
  const deactivation = parseDeactivatePartyCharacterCommand({
    kind: "deactivate-party-character",
    version: 1,
    campaignId: row.campaignId,
    commandId: row.commandId,
    commandDigest: row.commandDigest,
    expectedPartyRevision: row.expectedPartyRevision,
    expectedFocusRevision: row.expectedFocusRevision,
    cancelled: row.cancelled,
    characterId: row.characterId,
    maskOwnerContributions: row.maskOwnerContributions,
    ...(row.expectedSourceRevision === undefined
      ? {}
      : { expectedSourceRevision: row.expectedSourceRevision }),
    ...(row.primarySuccessorSceneId === undefined
      ? {}
      : { primarySuccessorSceneId: row.primarySuccessorSceneId }),
    ...(row.expectedSuccessorRevision === undefined
      ? {}
      : { expectedSuccessorRevision: row.expectedSuccessorRevision }),
  });
  return Object.freeze({
    ...deactivation,
    kind: "permanent-character-deletion",
    historyEntryId: referenceId(
      row.historyEntryId,
      `${label}.historyEntryId`,
    ),
    historyReceiptId: receiptId(
      row.historyReceiptId,
      `${label}.historyReceiptId`,
    ),
    manifestId: referenceId(row.manifestId, `${label}.manifestId`),
    tombstoneId: referenceId(row.tombstoneId, `${label}.tombstoneId`),
  });
}

function inactiveDeletionState(
  state: LiveSessionAggregateState,
  command: PermanentCharacterDeletionCommand,
): LiveSessionAggregateState {
  if (
    command.expectedSourceRevision !== undefined ||
    command.primarySuccessorSceneId !== undefined ||
    command.expectedSuccessorRevision !== undefined ||
    command.maskOwnerContributions.length > 0
  )
    throw new Error("Inaktive Löschung besitzt unerwartete Scene-Beiträge.");
  return parseLiveSessionAggregateState({
    ...state,
    party: {
      ...state.party,
      partyRevision: state.party.partyRevision + 1,
      characters: state.party.characters.filter(
        (character) => character.characterId !== command.characterId,
      ),
    },
  });
}

export function decidePermanentCharacterDeletion(
  stateValue: unknown,
  historyValue: unknown,
  commandValue: unknown,
  registryValue: unknown,
  manifestValue: unknown,
  tombstoneValue: unknown,
  digest: ReferenceOwnerDigest & PartyHistoryDigest,
): CharacterDeletionResult {
  const state = parseLiveSessionAggregateState(stateValue),
    history = parsePartyCommandHistory(historyValue),
    command = parsePermanentCharacterDeletionCommand(commandValue),
    reject = (
      reason: Extract<
        CharacterDeletionResult,
        { status: "rejected" | "cancelled" }
      >["reason"],
    ): CharacterDeletionResult =>
      Object.freeze({
        status: reason === "cancelled" ? "cancelled" : "rejected",
        state,
        history,
        commandId: command.commandId,
        commandDigest: command.commandDigest,
        reason,
      });
  if (command.cancelled) return reject("cancelled");
  if (
    command.campaignId !== state.campaignId ||
    command.campaignId !== history.campaignId
  )
    return reject("foreign-campaign");
  if (
    command.expectedPartyRevision !== state.party.partyRevision ||
    command.expectedFocusRevision !== state.focus.focusRevision
  )
    return reject("aggregate-rejected");
  const character = state.party.characters.find(
    (candidate) => candidate.characterId === command.characterId,
  );
  if (!character) return reject("unknown-character");
  const registry = parseReferenceOwnerRegistryProjection(registryValue),
    manifest = parseReferenceOwnerManifest(manifestValue, registry, digest),
    tombstone = parseCharacterDeletionTombstone(tombstoneValue, manifest);
  if (
    String(registry.campaignId) !== String(state.campaignId) ||
    String(manifest.campaignId) !== String(state.campaignId) ||
    manifest.deletionCommandId !== command.commandId ||
    manifest.characterId !== command.characterId ||
    manifest.manifestId !== command.manifestId ||
    tombstone.tombstoneId !== command.tombstoneId ||
    registry.registryRevision !== manifest.registryRevision
  )
    return reject("stale-registry");

  let deactivatedState = state,
    membership: CharacterMembershipDecision | undefined;
  if (character.active) {
    const deactivation = deactivatePartyCharacter(state, {
      kind: "deactivate-party-character",
      version: 1,
      campaignId: command.campaignId,
      commandId: command.commandId,
      commandDigest: command.commandDigest,
      expectedPartyRevision: command.expectedPartyRevision,
      expectedFocusRevision: command.expectedFocusRevision,
      cancelled: command.cancelled,
      characterId: command.characterId,
      maskOwnerContributions: command.maskOwnerContributions,
      ...(command.expectedSourceRevision === undefined
        ? {}
        : { expectedSourceRevision: command.expectedSourceRevision }),
      ...(command.primarySuccessorSceneId === undefined
        ? {}
        : { primarySuccessorSceneId: command.primarySuccessorSceneId }),
      ...(command.expectedSuccessorRevision === undefined
        ? {}
        : { expectedSuccessorRevision: command.expectedSuccessorRevision }),
    });
    if (deactivation.status !== "applied")
      return reject("aggregate-rejected");
    deactivatedState = deactivation.state;
    membership = deactivation.decision.membership;
  } else {
    try {
      deactivatedState = inactiveDeletionState(state, command);
    } catch {
      return reject("aggregate-rejected");
    }
  }
  const stateAfter = parseLiveSessionAggregateState({
      ...deactivatedState,
      party: {
        ...deactivatedState.party,
        characters: deactivatedState.party.characters.filter(
          (candidate) => candidate.characterId !== command.characterId,
        ),
      },
    }),
    historyAfter = sealPartyHistoryForDeletion(
      history,
      {
        entryId: command.historyEntryId,
        commandId: command.commandId,
        commandDigest: command.commandDigest,
        receiptId: command.historyReceiptId,
        tombstoneId: command.tombstoneId,
        deletedCharacterId: command.characterId,
        before: state.party,
        after: stateAfter.party,
      },
      digest,
    ),
    outstanding = Object.freeze(
      manifest.entries
        .filter((entry) => entry.closureStatus === "unavailable-quarantined")
        .map((entry) => entry.erasureUnitId),
    ),
    decision: CharacterDeletionDecision = Object.freeze({
      kind: "character-deletion-decision",
      version: 1,
      status:
        outstanding.length === 0
          ? "logical-delete/closed"
          : "logical-delete/closure-pending",
      commandId: command.commandId,
      commandDigest: command.commandDigest,
      characterId: command.characterId,
      state: stateAfter,
      history: historyAfter,
      manifest,
      tombstone,
      ...(membership === undefined ? {} : { membership }),
      outstandingEntryIds: outstanding,
    });
  return Object.freeze({ status: "applied", decision });
}

function entryKey(receipt: ReferenceOwnerClosureReceipt): string {
  return `${receipt.ownerId}\u0000${receipt.payloadClass}\u0000${receipt.slotId}`;
}

export function assessCharacterClosure(
  registryValue: unknown,
  manifestValue: unknown,
  tombstoneValue: unknown,
  receiptsValue: unknown,
  digest: ReferenceOwnerDigest,
): CharacterClosureAssessment {
  const registry = parseReferenceOwnerRegistryProjection(registryValue),
    manifest = parseReferenceOwnerManifest(manifestValue, registry, digest),
    tombstone = parseCharacterDeletionTombstone(tombstoneValue, manifest),
    receipts = Object.freeze(
      uniqueBy(
        exactArray(receiptsValue, "CharacterClosure.receipts").map(
          (value) =>
            parseReferenceOwnerClosureReceipt(value, manifest, tombstone),
        ),
        entryKey,
        "CharacterClosure.receipts",
      ),
    ),
    outstanding = Object.freeze(
      manifest.entries
        .filter(
          (entry) =>
            !receipts.some(
              (receipt) =>
                receipt.ownerId === entry.ownerId &&
                receipt.payloadClass === entry.payloadClass &&
                receipt.slotId === entry.slotId,
            ),
        )
        .map((entry) => entry.erasureUnitId),
    );
  return Object.freeze({
    kind: "character-closure-assessment",
    version: 1,
    status:
      outstanding.length === 0
        ? "permanent-purge-finalized"
        : "closure-pending",
    manifestId: manifest.manifestId,
    tombstoneId: tombstone.tombstoneId,
    receipts,
    outstandingEntryIds: outstanding,
    purgeEligible: outstanding.length === 0,
  });
}
