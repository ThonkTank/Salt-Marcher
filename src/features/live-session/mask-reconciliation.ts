import type {
  LiveSceneSourceSnapshot,
  MaskReference,
  OwnerIdentity,
} from "./contracts";
import {
  campaignId,
  characterId,
  commandDigest,
  commandId,
  generationId,
  liveSceneId,
  maskId,
  ownerId,
  receiptId,
  revision,
  type CampaignId,
  type CharacterId,
  type CommandDigest,
  type CommandId,
  type LiveSceneId,
  type MaskId,
  type OwnerId,
  type ReceiptId,
  type Revision,
} from "./ids";
import { exactArray, exactRecord, exactText, uniqueBy } from "./validation";

export type MaskOwnerIdentity = OwnerIdentity;

export type ReconciliationTargetEndpoint =
  | { readonly kind: "none" }
  | {
      readonly kind: "created";
      readonly liveSceneId: LiveSceneId;
      readonly revisionAfter: Revision;
    }
  | {
      readonly kind: "existing";
      readonly liveSceneId: LiveSceneId;
      readonly revisionBefore: Revision;
      readonly revisionAfter: Revision;
    };

interface ReconciliationEnvelope {
  readonly version: 1;
  readonly campaignId: CampaignId;
  readonly commandId: CommandId;
  readonly commandDigest: CommandDigest;
  readonly partyRevisionBefore: Revision;
  readonly partyRevisionAfter: Revision;
  readonly sourceSceneId: LiveSceneId;
  readonly sourceRevisionBefore: Revision;
  readonly sourceRevisionAfter: Revision;
  readonly sourceLifecycleBefore: "active";
  readonly sourceLifecycleAfter: "active" | "retired";
  readonly target: ReconciliationTargetEndpoint;
  readonly affectedCharacterIds: readonly CharacterId[];
  readonly delivery: "required" | "pending";
}

export interface GenericSceneConsumerDuty extends ReconciliationEnvelope {
  readonly kind: "generic-scene-consumer-reconciliation";
  readonly ownerId: OwnerId;
  readonly expectedOwnerRevision: Revision;
  readonly operation: "remove-participants" | "source-retired";
}

export interface MaskPin {
  readonly maskId: MaskId;
  readonly maskKind: string;
  readonly expectedOwnerRevision: Revision;
  readonly lifecycleBefore: "active" | "suspended" | "archived" | "pending";
}

export interface MaskDelta extends MaskPin {
  readonly participantCharacterIds: readonly CharacterId[];
  readonly lifecycleAfter: "active" | "suspended" | "archived";
}

export interface MaskOwnerSnapshotMask {
  readonly maskId: MaskId;
  readonly maskKind: string;
  readonly lifecycle: "active" | "suspended" | "archived";
  readonly participantCharacterIds: readonly CharacterId[];
}

export interface MaskOwnerPreparedContribution {
  readonly kind: "mask-owner-prepared-contribution";
  readonly version: 1;
  readonly status: "prepared-unpublished";
  readonly receiptId: ReceiptId;
  readonly campaignId: CampaignId;
  readonly commandId: CommandId;
  readonly commandDigest: CommandDigest;
  readonly partyRevisionBefore: Revision;
  readonly partyRevisionAfter: Revision;
  readonly sourceSceneId: LiveSceneId;
  readonly sourceSceneRevisionBefore: Revision;
  readonly sourceSceneRevisionAfter: Revision;
  readonly sourceLifecycleBefore: "active";
  readonly sourceLifecycleAfter: "active" | "retired";
  readonly target: ReconciliationTargetEndpoint;
  readonly ownerIdentity: MaskOwnerIdentity;
  readonly ownerRevisionBefore: Revision;
  readonly ownerRevisionAfter: Revision;
  readonly affectedCharacterIds: readonly CharacterId[];
  readonly scope: Extract<
    MaskOwnerScope,
    { readonly kind: "complete-mask-delta" }
  >;
  readonly beforeMasks: readonly MaskOwnerSnapshotMask[];
  readonly afterMasks: readonly MaskOwnerSnapshotMask[];
}

export type MaskOwnerScope =
  | {
      readonly kind: "complete-mask-delta";
      readonly operation: "remove-participants" | "source-retired";
      readonly masks: readonly MaskDelta[];
    }
  | {
      readonly kind: "owner-scope-unresolved";
      readonly cause: "pending" | "unavailable";
      readonly knownMaskRefs: readonly MaskPin[];
    };

export interface MaskOwnerDuty extends ReconciliationEnvelope {
  readonly kind: "mask-owner-reconciliation";
  readonly ownerIdentity: MaskOwnerIdentity;
  readonly expectedOwnerRevision: Revision;
  readonly scope: MaskOwnerScope;
  readonly preparedContribution?: MaskOwnerPreparedContribution;
}

export type ReconciliationDuty = GenericSceneConsumerDuty | MaskOwnerDuty;
export type PendingConsumerReconciliation = ReconciliationDuty & {
  readonly delivery: "pending";
};

function parseTarget(
  value: unknown,
  label: string,
): ReconciliationTargetEndpoint {
  const base = exactRecord(
    value,
    ["kind"],
    ["liveSceneId", "revisionBefore", "revisionAfter"],
    label,
  );
  if (base.kind === "none") {
    exactRecord(value, ["kind"], [], label);
    return Object.freeze({ kind: "none" });
  }
  if (base.kind === "created") {
    const row = exactRecord(
        value,
        ["kind", "liveSceneId", "revisionAfter"],
        [],
        label,
      ),
      revisionAfter = revision(row.revisionAfter, `${label}.revisionAfter`);
    if (revisionAfter !== 0)
      throw new Error(`${label} besitzt keine Created-Initialrevision 0.`);
    return Object.freeze({
      kind: "created",
      liveSceneId: liveSceneId(row.liveSceneId, `${label}.liveSceneId`),
      revisionAfter,
    });
  }
  if (base.kind === "existing") {
    const row = exactRecord(
        value,
        ["kind", "liveSceneId", "revisionBefore", "revisionAfter"],
        [],
        label,
      ),
      revisionBefore = revision(row.revisionBefore, `${label}.revisionBefore`),
      revisionAfter = revision(row.revisionAfter, `${label}.revisionAfter`);
    if (revisionAfter !== revisionBefore + 1)
      throw new Error(`${label} besitzt keinen einzelnen Revisionsschritt.`);
    return Object.freeze({
      kind: "existing",
      liveSceneId: liveSceneId(row.liveSceneId, `${label}.liveSceneId`),
      revisionBefore,
      revisionAfter,
    });
  }
  throw new Error(`${label}.kind ist unbekannt.`);
}

function characters(value: unknown, label: string): readonly CharacterId[] {
  return Object.freeze(
    uniqueBy(
      exactArray(value, label).map((entry, index) =>
        characterId(entry, `${label}[${index}]`),
      ),
      (entry) => entry,
      label,
    ),
  );
}

function parseMaskPin(value: unknown, label: string): MaskPin {
  const row = exactRecord(
    value,
    ["maskId", "maskKind", "expectedOwnerRevision", "lifecycleBefore"],
    [],
    label,
  );
  if (
    !(["active", "suspended", "archived", "pending"] as const).includes(
      row.lifecycleBefore as never,
    )
  )
    throw new Error(`${label}.lifecycleBefore ist unbekannt.`);
  return Object.freeze({
    maskId: maskId(row.maskId, `${label}.maskId`),
    maskKind: exactText(row.maskKind, `${label}.maskKind`),
    expectedOwnerRevision: revision(
      row.expectedOwnerRevision,
      `${label}.expectedOwnerRevision`,
    ),
    lifecycleBefore: row.lifecycleBefore as MaskPin["lifecycleBefore"],
  });
}

function parseScope(value: unknown, label: string): MaskOwnerScope {
  const base = exactRecord(
    value,
    ["kind"],
    ["operation", "masks", "cause", "knownMaskRefs"],
    label,
  );
  if (base.kind === "owner-scope-unresolved") {
    const row = exactRecord(
        value,
        ["kind", "cause", "knownMaskRefs"],
        [],
        label,
      ),
      knownMaskRefs = Object.freeze(
        uniqueBy(
          exactArray(row.knownMaskRefs, `${label}.knownMaskRefs`).map(
            (entry, index) =>
              parseMaskPin(entry, `${label}.knownMaskRefs[${index}]`),
          ),
          (entry) => entry.maskId,
          `${label}.knownMaskRefs`,
        ),
      );
    if (
      !(row.cause === "pending" || row.cause === "unavailable") ||
      knownMaskRefs.length === 0
    )
      throw new Error(
        `${label} besitzt keinen vollständigen unresolved Scope.`,
      );
    return Object.freeze({
      kind: "owner-scope-unresolved",
      cause: row.cause,
      knownMaskRefs,
    });
  }
  if (base.kind === "complete-mask-delta") {
    const row = exactRecord(value, ["kind", "operation", "masks"], [], label),
      masks = Object.freeze(
        uniqueBy(
          exactArray(row.masks, `${label}.masks`).map((entry, index) => {
            const maskLabel = `${label}.masks[${index}]`,
              maskRow = exactRecord(
                entry,
                [
                  "maskId",
                  "maskKind",
                  "expectedOwnerRevision",
                  "lifecycleBefore",
                  "participantCharacterIds",
                  "lifecycleAfter",
                ],
                [],
                maskLabel,
              ),
              pin = parseMaskPin(
                {
                  maskId: maskRow.maskId,
                  maskKind: maskRow.maskKind,
                  expectedOwnerRevision: maskRow.expectedOwnerRevision,
                  lifecycleBefore: maskRow.lifecycleBefore,
                },
                maskLabel,
              ),
              participantCharacterIds = characters(
                maskRow.participantCharacterIds,
                `${maskLabel}.participantCharacterIds`,
              );
            if (
              !(["active", "suspended", "archived"] as const).includes(
                maskRow.lifecycleAfter as never,
              )
            )
              throw new Error(`${maskLabel}.lifecycleAfter ist unbekannt.`);
            return Object.freeze({
              ...pin,
              participantCharacterIds,
              lifecycleAfter:
                maskRow.lifecycleAfter as MaskDelta["lifecycleAfter"],
            });
          }),
          (entry) => entry.maskId,
          `${label}.masks`,
        ),
      );
    if (
      !(
        row.operation === "remove-participants" ||
        row.operation === "source-retired"
      ) ||
      masks.length === 0 ||
      (row.operation === "remove-participants" &&
        masks.some(
          (mask) =>
            mask.participantCharacterIds.length === 0 ||
            mask.lifecycleAfter !== mask.lifecycleBefore ||
            mask.lifecycleBefore === "archived",
        )) ||
      (row.operation === "source-retired" &&
        masks.some(
          (mask) =>
            mask.lifecycleAfter !== "archived" ||
            mask.lifecycleBefore === "pending",
        ))
    )
      throw new Error(`${label} besitzt widersprüchliche Maskendeltas.`);
    return Object.freeze({
      kind: "complete-mask-delta",
      operation: row.operation,
      masks,
    });
  }
  throw new Error(`${label}.kind ist unbekannt.`);
}

function parseSnapshotMasks(
  value: unknown,
  label: string,
): readonly MaskOwnerSnapshotMask[] {
  return Object.freeze(
    uniqueBy(
      exactArray(value, label).map((entry, index) => {
        const maskLabel = `${label}[${index}]`,
          row = exactRecord(
            entry,
            ["maskId", "maskKind", "lifecycle", "participantCharacterIds"],
            [],
            maskLabel,
          ),
          lifecycle = row.lifecycle as MaskOwnerSnapshotMask["lifecycle"],
          participantCharacterIds = characters(
            row.participantCharacterIds,
            `${maskLabel}.participantCharacterIds`,
          );
        if (
          !(
            lifecycle === "active" ||
            lifecycle === "suspended" ||
            lifecycle === "archived"
          )
        )
          throw new Error(`${maskLabel}.lifecycle ist unbekannt.`);
        if (lifecycle === "archived" && participantCharacterIds.length > 0)
          throw new Error(
            `${maskLabel} darf archiviert keine Live-Teilnehmer enthalten.`,
          );
        return Object.freeze({
          maskId: maskId(row.maskId, `${maskLabel}.maskId`),
          maskKind: exactText(row.maskKind, `${maskLabel}.maskKind`),
          lifecycle,
          participantCharacterIds,
        });
      }),
      (entry) => entry.maskId,
      label,
    ),
  );
}

export function parseMaskOwnerPreparedContribution(
  value: unknown,
  label = "MaskOwnerPreparedContribution",
): MaskOwnerPreparedContribution {
  const row = exactRecord(
      value,
      [
        "kind",
        "version",
        "status",
        "receiptId",
        "campaignId",
        "commandId",
        "commandDigest",
        "partyRevisionBefore",
        "partyRevisionAfter",
        "sourceSceneId",
        "sourceSceneRevisionBefore",
        "sourceSceneRevisionAfter",
        "sourceLifecycleBefore",
        "sourceLifecycleAfter",
        "target",
        "ownerIdentity",
        "ownerRevisionBefore",
        "ownerRevisionAfter",
        "affectedCharacterIds",
        "scope",
        "beforeMasks",
        "afterMasks",
      ],
      [],
      label,
    ),
    identity = exactRecord(
      row.ownerIdentity,
      ["ownerId", "generationId"],
      [],
      `${label}.ownerIdentity`,
    ),
    sourceSceneRevisionBefore = revision(
      row.sourceSceneRevisionBefore,
      `${label}.sourceSceneRevisionBefore`,
    ),
    sourceSceneRevisionAfter = revision(
      row.sourceSceneRevisionAfter,
      `${label}.sourceSceneRevisionAfter`,
    ),
    partyRevisionBefore = revision(
      row.partyRevisionBefore,
      `${label}.partyRevisionBefore`,
    ),
    partyRevisionAfter = revision(
      row.partyRevisionAfter,
      `${label}.partyRevisionAfter`,
    ),
    ownerRevisionBefore = revision(
      row.ownerRevisionBefore,
      `${label}.ownerRevisionBefore`,
    ),
    ownerRevisionAfter = revision(
      row.ownerRevisionAfter,
      `${label}.ownerRevisionAfter`,
    ),
    scope = parseScope(row.scope, `${label}.scope`),
    affectedCharacterIds = characters(
      row.affectedCharacterIds,
      `${label}.affectedCharacterIds`,
    ),
    beforeMasks = parseSnapshotMasks(row.beforeMasks, `${label}.beforeMasks`),
    afterMasks = parseSnapshotMasks(row.afterMasks, `${label}.afterMasks`),
    target = parseTarget(row.target, `${label}.target`),
    affected = new Set(affectedCharacterIds),
    operation =
      scope.kind === "complete-mask-delta" ? scope.operation : undefined,
    expectedScope = Object.freeze({
      kind: "complete-mask-delta" as const,
      operation:
        operation === "source-retired"
          ? ("source-retired" as const)
          : ("remove-participants" as const),
      masks: Object.freeze(
        beforeMasks.flatMap((mask) => {
          const participants = mask.participantCharacterIds.filter((entry) =>
            affected.has(entry),
          );
          if (operation !== "source-retired" && participants.length === 0)
            return [];
          return [
            Object.freeze({
              maskId: mask.maskId,
              maskKind: mask.maskKind,
              expectedOwnerRevision: ownerRevisionBefore,
              lifecycleBefore: mask.lifecycle,
              participantCharacterIds: Object.freeze(participants),
              lifecycleAfter:
                operation === "source-retired"
                  ? ("archived" as const)
                  : mask.lifecycle,
            }),
          ];
        }),
      ),
    }),
    expectedAfterMasks = Object.freeze(
      beforeMasks.map((mask) =>
        Object.freeze({
          ...mask,
          lifecycle:
            operation === "source-retired"
              ? ("archived" as const)
              : mask.lifecycle,
          participantCharacterIds:
            operation === "source-retired"
              ? Object.freeze([] as CharacterId[])
              : Object.freeze(
                  mask.participantCharacterIds.filter(
                    (entry) => !affected.has(entry),
                  ),
                ),
        }),
      ),
    );
  if (
    row.kind !== "mask-owner-prepared-contribution" ||
    row.version !== 1 ||
    row.status !== "prepared-unpublished" ||
    scope.kind !== "complete-mask-delta" ||
    affectedCharacterIds.length === 0 ||
    beforeMasks.length === 0 ||
    beforeMasks.length !== afterMasks.length ||
    partyRevisionAfter !== partyRevisionBefore + 1 ||
    sourceSceneRevisionAfter !== sourceSceneRevisionBefore + 1 ||
    ownerRevisionAfter !== ownerRevisionBefore + 1 ||
    row.sourceLifecycleBefore !== "active" ||
    !(
      row.sourceLifecycleAfter === "active" ||
      row.sourceLifecycleAfter === "retired"
    ) ||
    (operation === "remove-participants") !==
      (row.sourceLifecycleAfter === "active") ||
    scope.kind !== "complete-mask-delta" ||
    !sameCompleteScope(scope, expectedScope) ||
    !sameSnapshotMasks(afterMasks, expectedAfterMasks)
  )
    throw new Error(`${label} besitzt keinen vollständigen Prepared-Vertrag.`);
  return Object.freeze({
    kind: "mask-owner-prepared-contribution",
    version: 1,
    status: "prepared-unpublished",
    receiptId: receiptId(row.receiptId, `${label}.receiptId`),
    campaignId: campaignId(row.campaignId, `${label}.campaignId`),
    commandId: commandId(row.commandId, `${label}.commandId`),
    commandDigest: commandDigest(row.commandDigest, `${label}.commandDigest`),
    partyRevisionBefore,
    partyRevisionAfter,
    sourceSceneId: liveSceneId(row.sourceSceneId, `${label}.sourceSceneId`),
    sourceSceneRevisionBefore,
    sourceSceneRevisionAfter,
    sourceLifecycleBefore: "active",
    sourceLifecycleAfter: row.sourceLifecycleAfter as "active" | "retired",
    target,
    ownerIdentity: Object.freeze({
      ownerId: ownerId(identity.ownerId, `${label}.ownerIdentity.ownerId`),
      generationId: generationId(
        identity.generationId,
        `${label}.ownerIdentity.generationId`,
      ),
    }),
    ownerRevisionBefore,
    ownerRevisionAfter,
    affectedCharacterIds,
    scope,
    beforeMasks,
    afterMasks,
  });
}

function sameCharacters(
  left: readonly CharacterId[],
  right: readonly CharacterId[],
): boolean {
  return (
    left.length === right.length &&
    left.every((entry, index) => entry === right[index])
  );
}

function sameTarget(
  left: ReconciliationTargetEndpoint,
  right: ReconciliationTargetEndpoint,
): boolean {
  return (
    left.kind === right.kind &&
    (left.kind === "none" ||
      (right.kind !== "none" &&
        left.liveSceneId === right.liveSceneId &&
        left.revisionAfter === right.revisionAfter &&
        (left.kind === "created" ||
          (right.kind === "existing" &&
            left.revisionBefore === right.revisionBefore))))
  );
}

function sameSnapshotMasks(
  left: readonly MaskOwnerSnapshotMask[],
  right: readonly MaskOwnerSnapshotMask[],
): boolean {
  return (
    left.length === right.length &&
    left.every((entry, index) => {
      const other = right[index];
      return (
        other !== undefined &&
        entry.maskId === other.maskId &&
        entry.maskKind === other.maskKind &&
        entry.lifecycle === other.lifecycle &&
        sameCharacters(
          entry.participantCharacterIds,
          other.participantCharacterIds,
        )
      );
    })
  );
}

function sameCompleteScope(
  left: Extract<MaskOwnerScope, { readonly kind: "complete-mask-delta" }>,
  right: Extract<MaskOwnerScope, { readonly kind: "complete-mask-delta" }>,
): boolean {
  return (
    left.operation === right.operation &&
    left.masks.length === right.masks.length &&
    left.masks.every((entry, index) => {
      const other = right.masks[index];
      return (
        other !== undefined &&
        entry.maskId === other.maskId &&
        entry.maskKind === other.maskKind &&
        entry.expectedOwnerRevision === other.expectedOwnerRevision &&
        entry.lifecycleBefore === other.lifecycleBefore &&
        entry.lifecycleAfter === other.lifecycleAfter &&
        sameCharacters(
          entry.participantCharacterIds,
          other.participantCharacterIds,
        )
      );
    })
  );
}

export function parseReconciliationDuty(
  value: unknown,
  label = "ReconciliationDuty",
): ReconciliationDuty {
  const base = exactRecord(
    value,
    ["kind"],
    [
      "version",
      "campaignId",
      "commandId",
      "commandDigest",
      "partyRevisionBefore",
      "partyRevisionAfter",
      "sourceSceneId",
      "sourceRevisionBefore",
      "sourceRevisionAfter",
      "sourceLifecycleBefore",
      "sourceLifecycleAfter",
      "target",
      "affectedCharacterIds",
      "delivery",
      "ownerId",
      "expectedOwnerRevision",
      "operation",
      "ownerIdentity",
      "scope",
      "preparedContribution",
    ],
    label,
  );
  const maskOwner = base.kind === "mask-owner-reconciliation",
    required = [
      "kind",
      "version",
      "campaignId",
      "commandId",
      "commandDigest",
      "partyRevisionBefore",
      "partyRevisionAfter",
      "sourceSceneId",
      "sourceRevisionBefore",
      "sourceRevisionAfter",
      "sourceLifecycleBefore",
      "sourceLifecycleAfter",
      "target",
      "affectedCharacterIds",
      "delivery",
      ...(maskOwner
        ? ["ownerIdentity", "expectedOwnerRevision", "scope"]
        : ["ownerId", "expectedOwnerRevision", "operation"]),
    ],
    row = exactRecord(
      value,
      required,
      maskOwner ? ["preparedContribution"] : [],
      label,
    );
  if (
    (!maskOwner && row.kind !== "generic-scene-consumer-reconciliation") ||
    row.version !== 1 ||
    row.sourceLifecycleBefore !== "active" ||
    !(
      row.sourceLifecycleAfter === "active" ||
      row.sourceLifecycleAfter === "retired"
    ) ||
    !(row.delivery === "required" || row.delivery === "pending")
  )
    throw new Error(
      `${label} besitzt einen unbekannten oder widersprüchlichen Vertrag.`,
    );
  const partyRevisionBefore = revision(
      row.partyRevisionBefore,
      `${label}.partyRevisionBefore`,
    ),
    partyRevisionAfter = revision(
      row.partyRevisionAfter,
      `${label}.partyRevisionAfter`,
    ),
    sourceRevisionBefore = revision(
      row.sourceRevisionBefore,
      `${label}.sourceRevisionBefore`,
    ),
    sourceRevisionAfter = revision(
      row.sourceRevisionAfter,
      `${label}.sourceRevisionAfter`,
    ),
    affectedCharacterIds = characters(
      row.affectedCharacterIds,
      `${label}.affectedCharacterIds`,
    ),
    common = {
      version: 1 as const,
      campaignId: campaignId(row.campaignId, `${label}.campaignId`),
      commandId: commandId(row.commandId, `${label}.commandId`),
      commandDigest: commandDigest(row.commandDigest, `${label}.commandDigest`),
      partyRevisionBefore,
      partyRevisionAfter,
      sourceSceneId: liveSceneId(row.sourceSceneId, `${label}.sourceSceneId`),
      sourceRevisionBefore,
      sourceRevisionAfter,
      sourceLifecycleBefore: "active" as const,
      sourceLifecycleAfter: row.sourceLifecycleAfter as "active" | "retired",
      target: parseTarget(row.target, `${label}.target`),
      affectedCharacterIds,
      delivery: row.delivery as "required" | "pending",
    };
  if (
    affectedCharacterIds.length === 0 ||
    partyRevisionAfter !== partyRevisionBefore + 1 ||
    sourceRevisionAfter !== sourceRevisionBefore + 1
  )
    throw new Error(`${label} besitzt unvollständige Revisionsbindungen.`);
  if (maskOwner) {
    const identity = exactRecord(
        row.ownerIdentity,
        ["ownerId", "generationId"],
        [],
        `${label}.ownerIdentity`,
      ),
      expectedOwnerRevision = revision(
        row.expectedOwnerRevision,
        `${label}.expectedOwnerRevision`,
      ),
      scope = parseScope(row.scope, `${label}.scope`),
      preparedContribution =
        row.preparedContribution === undefined
          ? undefined
          : parseMaskOwnerPreparedContribution(
              row.preparedContribution,
              `${label}.preparedContribution`,
            ),
      pins =
        scope.kind === "complete-mask-delta"
          ? scope.masks
          : scope.knownMaskRefs,
      affected = new Set(affectedCharacterIds);
    if (
      pins.some((pin) => pin.expectedOwnerRevision !== expectedOwnerRevision) ||
      (scope.kind === "owner-scope-unresolved" &&
        (row.delivery !== "pending" || preparedContribution !== undefined)) ||
      (scope.kind === "complete-mask-delta" &&
        (row.delivery !== "required" ||
          preparedContribution === undefined ||
          (scope.operation === "remove-participants") !==
            (row.sourceLifecycleAfter === "active") ||
          scope.masks.some((mask) =>
            mask.participantCharacterIds.some(
              (participant) => !affected.has(participant),
            ),
          ) ||
          preparedContribution.campaignId !== common.campaignId ||
          preparedContribution.commandId !== common.commandId ||
          preparedContribution.commandDigest !== common.commandDigest ||
          preparedContribution.partyRevisionBefore !==
            common.partyRevisionBefore ||
          preparedContribution.partyRevisionAfter !==
            common.partyRevisionAfter ||
          preparedContribution.sourceSceneId !== common.sourceSceneId ||
          preparedContribution.sourceSceneRevisionBefore !==
            common.sourceRevisionBefore ||
          preparedContribution.sourceSceneRevisionAfter !==
            common.sourceRevisionAfter ||
          preparedContribution.sourceLifecycleBefore !==
            common.sourceLifecycleBefore ||
          preparedContribution.sourceLifecycleAfter !==
            common.sourceLifecycleAfter ||
          !sameTarget(preparedContribution.target, common.target) ||
          preparedContribution.ownerIdentity.ownerId !== identity.ownerId ||
          preparedContribution.ownerIdentity.generationId !==
            identity.generationId ||
          preparedContribution.ownerRevisionBefore !== expectedOwnerRevision ||
          !sameCharacters(
            preparedContribution.affectedCharacterIds,
            affectedCharacterIds,
          ) ||
          !sameCompleteScope(preparedContribution.scope, scope)))
    )
      throw new Error(`${label} besitzt ungebundene Masken-Cross-Bindings.`);
    return Object.freeze({
      kind: "mask-owner-reconciliation",
      ...common,
      ownerIdentity: Object.freeze({
        ownerId: ownerId(identity.ownerId, `${label}.ownerIdentity.ownerId`),
        generationId: generationId(
          identity.generationId,
          `${label}.ownerIdentity.generationId`,
        ),
      }),
      expectedOwnerRevision,
      scope,
      ...(preparedContribution === undefined ? {} : { preparedContribution }),
    });
  }
  if (
    !(
      row.operation === "remove-participants" ||
      row.operation === "source-retired"
    ) ||
    (row.sourceLifecycleAfter === "active") !==
      (row.operation === "remove-participants")
  )
    throw new Error(
      `${label} besitzt eine widersprüchliche generische Pflicht.`,
    );
  return Object.freeze({
    kind: "generic-scene-consumer-reconciliation",
    ...common,
    ownerId: ownerId(row.ownerId, `${label}.ownerId`),
    expectedOwnerRevision: revision(
      row.expectedOwnerRevision,
      `${label}.expectedOwnerRevision`,
    ),
    operation: row.operation,
  });
}

function pin(mask: MaskReference): MaskPin {
  return Object.freeze({
    maskId: mask.maskId,
    maskKind: mask.kind,
    expectedOwnerRevision: mask.ownerRevision,
    lifecycleBefore: mask.lifecycle,
  });
}

export interface ReconciliationBinding {
  readonly campaignId: CampaignId;
  readonly commandId: CommandId;
  readonly commandDigest: CommandDigest;
  readonly partyRevisionBefore: Revision;
  readonly partyRevisionAfter: Revision;
  readonly sourceRevisionBefore: Revision;
  readonly sourceRevisionAfter: Revision;
  readonly sourceLifecycleAfter: "active" | "retired";
  readonly target: ReconciliationTargetEndpoint;
  readonly affectedCharacterIds: readonly CharacterId[];
}

export function buildReconciliationDuties(
  source: LiveSceneSourceSnapshot,
  binding: ReconciliationBinding,
  preparedContributions: readonly MaskOwnerPreparedContribution[],
): readonly ReconciliationDuty[] {
  const affected = new Set(binding.affectedCharacterIds),
    common = {
      version: 1 as const,
      campaignId: binding.campaignId,
      commandId: binding.commandId,
      commandDigest: binding.commandDigest,
      partyRevisionBefore: binding.partyRevisionBefore,
      partyRevisionAfter: binding.partyRevisionAfter,
      sourceSceneId: source.liveSceneId,
      sourceRevisionBefore: binding.sourceRevisionBefore,
      sourceRevisionAfter: binding.sourceRevisionAfter,
      sourceLifecycleBefore: "active" as const,
      sourceLifecycleAfter: binding.sourceLifecycleAfter,
      target: binding.target,
      affectedCharacterIds: Object.freeze([...binding.affectedCharacterIds]),
    },
    maskGroups = new Map<string, MaskReference[]>(),
    contributionByOwner = new Map<string, MaskOwnerPreparedContribution>(),
    receiptIds = new Set<ReceiptId>(),
    consumedContributions = new Set<MaskOwnerPreparedContribution>();
  for (const contribution of preparedContributions) {
    const key = `${contribution.ownerIdentity.ownerId}\u0000${contribution.ownerIdentity.generationId}`;
    if (contributionByOwner.has(key) || receiptIds.has(contribution.receiptId))
      throw new Error(
        "Maskenbeiträge enthalten doppelte Owner- oder Receipt-Identitäten.",
      );
    contributionByOwner.set(key, contribution);
    receiptIds.add(contribution.receiptId);
  }
  for (const mask of source.maskRefs) {
    const key = `${mask.ownerId}\u0000${mask.generationId}`,
      group = maskGroups.get(key);
    if (group) group.push(mask);
    else maskGroups.set(key, [mask]);
  }
  const duties: ReconciliationDuty[] = [];
  for (const owner of source.reconciliations) {
    if (owner.generationId !== undefined) continue;
    if (owner.ownerRevision === undefined)
      throw new Error("Generischer Consumer besitzt keine OwnerRevision.");
    duties.push(
      Object.freeze({
        kind: "generic-scene-consumer-reconciliation" as const,
        ...common,
        ownerId: owner.ownerId,
        expectedOwnerRevision: owner.ownerRevision,
        operation:
          binding.sourceLifecycleAfter === "retired"
            ? ("source-retired" as const)
            : ("remove-participants" as const),
        delivery:
          owner.status === "current"
            ? ("required" as const)
            : ("pending" as const),
      }),
    );
  }
  for (const masks of maskGroups.values()) {
    const first = masks[0]!,
      owner = source.reconciliations.find(
        (entry) =>
          entry.ownerId === first.ownerId &&
          entry.generationId === first.generationId,
      ),
      status = owner?.status ?? "current",
      expectedOwnerRevision = first.ownerRevision,
      ownerIdentity = Object.freeze({
        ownerId: first.ownerId,
        generationId: first.generationId,
      }),
      ownerKey = `${first.ownerId}\u0000${first.generationId}`;
    if (status !== "current") {
      duties.push(
        Object.freeze({
          kind: "mask-owner-reconciliation" as const,
          ...common,
          ownerIdentity,
          expectedOwnerRevision,
          delivery: "pending" as const,
          scope: Object.freeze({
            kind: "owner-scope-unresolved" as const,
            cause: status as "pending" | "unavailable",
            knownMaskRefs: Object.freeze(masks.map(pin)),
          }),
        }),
      );
      continue;
    }
    const projections = masks.map((mask) =>
        source.maskParticipationProjections.find(
          (projection) =>
            projection.ownerIdentity.ownerId === mask.ownerId &&
            projection.ownerIdentity.generationId === mask.generationId &&
            projection.maskId === mask.maskId,
        ),
      ),
      beforeMasks = projections.map((projection, index) => {
        if (!projection)
          throw new Error(
            "Current Maskenowner besitzt keine vollständige Projektion.",
          );
        const mask = masks[index]!;
        return Object.freeze({
          maskId: mask.maskId,
          maskKind: mask.kind,
          lifecycle: projection.lifecycle as MaskOwnerSnapshotMask["lifecycle"],
          participantCharacterIds: Object.freeze([
            ...projection.participantCharacterIds,
          ]),
        });
      }),
      deltas = projections.flatMap((projection, index) => {
        if (!projection)
          throw new Error(
            "Current Maskenowner besitzt keine vollständige Projektion.",
          );
        const mask = masks[index]!,
          participants = projection.participantCharacterIds.filter((id) =>
            affected.has(id),
          );
        if (
          binding.sourceLifecycleAfter === "active" &&
          participants.length === 0
        )
          return [];
        return [
          Object.freeze({
            ...pin(mask),
            participantCharacterIds: Object.freeze(participants),
            lifecycleAfter:
              binding.sourceLifecycleAfter === "retired"
                ? ("archived" as const)
                : (projection.lifecycle as "active" | "suspended"),
          }),
        ];
      });
    if (deltas.length === 0) continue;
    const scope = Object.freeze({
        kind: "complete-mask-delta" as const,
        operation:
          binding.sourceLifecycleAfter === "retired"
            ? ("source-retired" as const)
            : ("remove-participants" as const),
        masks: Object.freeze(deltas),
      }),
      afterMasks = Object.freeze(
        beforeMasks.map((mask) =>
          Object.freeze({
            ...mask,
            lifecycle:
              binding.sourceLifecycleAfter === "retired"
                ? ("archived" as const)
                : mask.lifecycle,
            participantCharacterIds:
              binding.sourceLifecycleAfter === "retired"
                ? Object.freeze([] as CharacterId[])
                : Object.freeze(
                    mask.participantCharacterIds.filter(
                      (participant) => !affected.has(participant),
                    ),
                  ),
          }),
        ),
      ),
      contribution = contributionByOwner.get(ownerKey);
    if (
      contribution === undefined ||
      contribution.campaignId !== binding.campaignId ||
      contribution.commandId !== binding.commandId ||
      contribution.commandDigest !== binding.commandDigest ||
      contribution.partyRevisionBefore !== binding.partyRevisionBefore ||
      contribution.partyRevisionAfter !== binding.partyRevisionAfter ||
      contribution.sourceSceneId !== source.liveSceneId ||
      contribution.sourceSceneRevisionBefore !== binding.sourceRevisionBefore ||
      contribution.sourceSceneRevisionAfter !== binding.sourceRevisionAfter ||
      contribution.sourceLifecycleBefore !== "active" ||
      contribution.sourceLifecycleAfter !== binding.sourceLifecycleAfter ||
      !sameTarget(contribution.target, binding.target) ||
      contribution.ownerRevisionBefore !== expectedOwnerRevision ||
      contribution.ownerRevisionAfter !== expectedOwnerRevision + 1 ||
      !sameCharacters(
        contribution.affectedCharacterIds,
        binding.affectedCharacterIds,
      ) ||
      !sameCompleteScope(contribution.scope, scope) ||
      !sameSnapshotMasks(contribution.beforeMasks, beforeMasks) ||
      !sameSnapshotMasks(contribution.afterMasks, afterMasks) ||
      source.reconciliations.some(
        (entry) =>
          entry.receiptId === contribution.receiptId ||
          entry.appliedContributions?.some(
            (published) => published.receiptId === contribution.receiptId,
          ),
      )
    )
      throw new Error(
        "Maskenbeitrag bindet Receipt, Revision oder Matrix nicht exakt.",
      );
    consumedContributions.add(contribution);
    duties.push(
      Object.freeze({
        kind: "mask-owner-reconciliation" as const,
        ...common,
        ownerIdentity,
        expectedOwnerRevision,
        delivery: "required" as const,
        scope,
        preparedContribution: contribution,
      }),
    );
  }
  if (consumedContributions.size !== preparedContributions.length)
    throw new Error("Maskenbeiträge enthalten keinen erforderlichen Owner.");
  return Object.freeze(duties);
}

export function pendingCopy(
  duty: ReconciliationDuty,
): PendingConsumerReconciliation {
  if (duty.delivery !== "pending")
    throw new Error("Eine required Reconciliation darf nicht pending werden.");
  return Object.freeze({
    ...duty,
    delivery: "pending" as const,
  }) as PendingConsumerReconciliation;
}

export function reconciliationOwnerKey(duty: ReconciliationDuty): string {
  return duty.kind === "mask-owner-reconciliation"
    ? `${duty.ownerIdentity.ownerId}\u0000${duty.ownerIdentity.generationId}`
    : `${duty.ownerId}\u0000`;
}
