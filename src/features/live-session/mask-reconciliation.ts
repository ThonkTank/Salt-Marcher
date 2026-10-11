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
  revision,
  type CampaignId,
  type CharacterId,
  type CommandDigest,
  type CommandId,
  type LiveSceneId,
  type MaskId,
  type OwnerId,
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
    row = exactRecord(value, required, [], label);
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
      pins =
        scope.kind === "complete-mask-delta"
          ? scope.masks
          : scope.knownMaskRefs,
      affected = new Set(affectedCharacterIds);
    if (
      pins.some((pin) => pin.expectedOwnerRevision !== expectedOwnerRevision) ||
      (scope.kind === "owner-scope-unresolved" && row.delivery !== "pending") ||
      (scope.kind === "complete-mask-delta" &&
        ((scope.operation === "remove-participants") !==
          (row.sourceLifecycleAfter === "active") ||
          scope.masks.some((mask) =>
            mask.participantCharacterIds.some(
              (participant) => !affected.has(participant),
            ),
          )))
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
    maskGroups = new Map<string, MaskReference[]>();
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
      });
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
    duties.push(
      Object.freeze({
        kind: "mask-owner-reconciliation" as const,
        ...common,
        ownerIdentity,
        expectedOwnerRevision,
        delivery: "required" as const,
        scope: Object.freeze({
          kind: "complete-mask-delta" as const,
          operation:
            binding.sourceLifecycleAfter === "retired"
              ? ("source-retired" as const)
              : ("remove-participants" as const),
          masks: Object.freeze(deltas),
        }),
      }),
    );
  }
  return Object.freeze(duties);
}

export function pendingCopy(
  duty: ReconciliationDuty,
): PendingConsumerReconciliation {
  return Object.freeze({
    ...duty,
    delivery: "pending",
  }) as PendingConsumerReconciliation;
}

export function reconciliationOwnerKey(duty: ReconciliationDuty): string {
  return duty.kind === "mask-owner-reconciliation"
    ? `${duty.ownerIdentity.ownerId}\u0000${duty.ownerIdentity.generationId}`
    : `${duty.ownerId}\u0000`;
}
