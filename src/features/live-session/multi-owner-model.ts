import { evidenceDigest } from "./evidence";
import {
  campaignId,
  commandDigest,
  commandId,
  ownerId,
  receiptId,
  referenceId,
  revision,
  type CampaignId,
  type CommandDigest,
  type CommandId,
  type OwnerId,
  type ReceiptId,
  type ReferenceId,
  type Revision,
} from "./ids";
import { exactArray, exactRecord, uniqueBy } from "./validation";

export type CoordinatedCommandKind =
  | "initialize-live-session"
  | "split-scene"
  | "rejoin-scenes"
  | "move-characters"
  | "deactivate-character"
  | "permanent-character-deletion"
  | "quarantine-discard"
  | "undo-party-history"
  | "redo-party-history";

export type CoordinatorStatus =
  | "staged"
  | "validated"
  | "published"
  | "verified"
  | "finalized"
  | "cancelled-before-publish"
  | "conflict"
  | "unavailable"
  | "unknown-outcome";

export interface CoordinatorParticipant {
  readonly kind: "coordinator-participant";
  readonly version: 1;
  readonly participantId: ReferenceId;
  readonly ownerId: OwnerId;
  readonly expectedOwnerRevision: Revision;
  readonly targetId: ReferenceId;
  readonly contributionHash?: string;
}

export interface MultiOwnerCommandModel {
  readonly kind: "multi-owner-command-model";
  readonly version: 1;
  readonly campaignId: CampaignId;
  readonly commandId: CommandId;
  readonly commandDigest: CommandDigest;
  readonly receiptId: ReceiptId;
  readonly commandKind: CoordinatedCommandKind;
  readonly status: CoordinatorStatus;
  readonly generation: Revision;
  readonly beforeTruthHash: string;
  readonly expectedSurvivorRootHash: string;
  readonly participants: readonly CoordinatorParticipant[];
  readonly effectHash?: string;
  readonly unknownBoundary?: "pre-publish" | "post-publish";
  readonly unknownOriginStatus?:
    | "staged"
    | "validated"
    | "published"
    | "verified";
}

interface CoordinatorEventBinding {
  readonly version: 1;
  readonly campaignId: CampaignId;
  readonly commandId: CommandId;
  readonly commandDigest: CommandDigest;
  readonly receiptId: ReceiptId;
  readonly expectedGeneration: Revision;
}

export type CoordinatorEvent = CoordinatorEventBinding &
  (
    | {
      readonly kind: "validate";
      readonly outcome: "valid" | "conflict" | "unavailable";
    }
  | {
      readonly kind: "prepare-participant";
      readonly participantId: ReferenceId;
      readonly ownerId: OwnerId;
      readonly ownerRevision: Revision;
      readonly targetId: ReferenceId;
      readonly contributionHash: string;
    }
  | {
      readonly kind: "publish";
      readonly effectHash: string;
      readonly survivorRootHash: string;
    }
  | {
      readonly kind: "cancel";
    }
  | {
      readonly kind: "mark-outcome-unknown";
    }
  | {
      readonly kind: "resolve-outcome";
      readonly outcome: "cancelled-before-publish" | "published";
      readonly effectHash?: string;
      readonly survivorRootHash?: string;
    }
  | {
      readonly kind: "verify";
      readonly effectHash: string;
      readonly survivorRootHash: string;
    }
  | {
      readonly kind: "finalize";
    }
  );

export type CoordinatorTransition =
  | {
      readonly status: "applied";
      readonly model: MultiOwnerCommandModel;
    }
  | {
      readonly status: "rejected";
      readonly model: MultiOwnerCommandModel;
      readonly reason:
        | "stale-generation"
        | "phase-conflict"
        | "unknown-participant"
        | "stale-owner"
        | "participant-already-prepared"
        | "participants-incomplete"
        | "survivor-mismatch"
        | "effect-mismatch"
        | "receipt-mismatch"
        | "command-mismatch"
        | "participant-mismatch"
        | "already-published"
        | "already-terminal";
    };

const COMMAND_KINDS: readonly CoordinatedCommandKind[] = [
  "initialize-live-session",
  "split-scene",
  "rejoin-scenes",
  "move-characters",
  "deactivate-character",
  "permanent-character-deletion",
  "quarantine-discard",
  "undo-party-history",
  "redo-party-history",
];

function hash(value: unknown, label: string): string {
  return evidenceDigest(value, label);
}

function parseParticipant(
  value: unknown,
  index: number,
): CoordinatorParticipant {
  const label = `MultiOwnerCommandModel.participants[${index}]`,
    row = exactRecord(
      value,
      [
        "kind",
        "version",
        "participantId",
        "ownerId",
        "expectedOwnerRevision",
        "targetId",
      ],
      ["contributionHash"],
      label,
    );
  if (row.kind !== "coordinator-participant" || row.version !== 1)
    throw new Error(`${label} besitzt einen unbekannten Vertrag.`);
  return Object.freeze({
    kind: "coordinator-participant",
    version: 1,
    participantId: referenceId(row.participantId, `${label}.participantId`),
    ownerId: ownerId(row.ownerId, `${label}.ownerId`),
    expectedOwnerRevision: revision(
      row.expectedOwnerRevision,
      `${label}.expectedOwnerRevision`,
    ),
    targetId: referenceId(row.targetId, `${label}.targetId`),
    ...(row.contributionHash === undefined
      ? {}
      : {
          contributionHash: hash(
            row.contributionHash,
            `${label}.contributionHash`,
          ),
        }),
  });
}

export function parseMultiOwnerCommandModel(
  value: unknown,
): MultiOwnerCommandModel {
  const label = "MultiOwnerCommandModel",
    row = exactRecord(
      value,
      [
        "kind",
        "version",
        "campaignId",
        "commandId",
        "commandDigest",
        "receiptId",
        "commandKind",
        "status",
        "generation",
        "beforeTruthHash",
        "expectedSurvivorRootHash",
        "participants",
      ],
      ["effectHash", "unknownBoundary", "unknownOriginStatus"],
      label,
    );
  if (
    row.kind !== "multi-owner-command-model" ||
    row.version !== 1 ||
    !COMMAND_KINDS.includes(row.commandKind as CoordinatedCommandKind) ||
    ![
      "staged",
      "validated",
      "published",
      "verified",
      "finalized",
      "cancelled-before-publish",
      "conflict",
      "unavailable",
      "unknown-outcome",
    ].includes(String(row.status))
  )
    throw new Error(`${label} besitzt einen unbekannten Vertrag.`);
  const status = row.status as CoordinatorStatus,
    participants = Object.freeze(
      uniqueBy(
        exactArray(row.participants, `${label}.participants`).map(
          parseParticipant,
        ),
        (participant) => participant.participantId,
        `${label}.participants`,
      ),
    ),
    effectHash =
      row.effectHash === undefined
        ? undefined
        : hash(row.effectHash, `${label}.effectHash`),
    unknownBoundary = row.unknownBoundary as
      | "pre-publish"
      | "post-publish"
      | undefined,
    unknownOriginStatus = row.unknownOriginStatus as
      | "staged"
      | "validated"
      | "published"
      | "verified"
      | undefined,
    effectExpected =
      (["published", "verified", "finalized"] as CoordinatorStatus[]).includes(
        status,
      ) ||
      (status === "unknown-outcome" && unknownBoundary === "post-publish");
  if (participants.length === 0)
    throw new Error(`${label} besitzt keine vollständige Participantliste.`);
  if ((effectHash !== undefined) !== effectExpected)
    throw new Error(`${label} bindet den Publish-Effekt nicht exakt.`);
  if (
    status === "unknown-outcome"
      ? !["pre-publish", "post-publish"].includes(String(unknownBoundary)) ||
        !["staged", "validated", "published", "verified"].includes(
          String(unknownOriginStatus),
        ) ||
        (unknownBoundary === "post-publish") !==
          (effectHash !== undefined) ||
        (unknownBoundary === "pre-publish") !==
          (effectHash === undefined) ||
        (unknownBoundary === "pre-publish" &&
          !["staged", "validated"].includes(String(unknownOriginStatus))) ||
        (unknownBoundary === "post-publish" &&
          !["published", "verified"].includes(String(unknownOriginStatus)))
      : unknownBoundary !== undefined || unknownOriginStatus !== undefined
  )
    throw new Error(`${label} besitzt eine ungültige Unknown-Grenze.`);
  if (
    (["validated", "published", "verified", "finalized"].includes(status) ||
      (status === "unknown-outcome" &&
        unknownOriginStatus !== "staged")) &&
    participants.some((participant) => !participant.contributionHash)
  )
    throw new Error(`${label} besitzt unvorbereitete Participants.`);
  return Object.freeze({
    kind: "multi-owner-command-model",
    version: 1,
    campaignId: campaignId(row.campaignId, `${label}.campaignId`),
    commandId: commandId(row.commandId, `${label}.commandId`),
    commandDigest: commandDigest(row.commandDigest, `${label}.commandDigest`),
    receiptId: receiptId(row.receiptId, `${label}.receiptId`),
    commandKind: row.commandKind as CoordinatedCommandKind,
    status,
    generation: revision(row.generation, `${label}.generation`),
    beforeTruthHash: hash(row.beforeTruthHash, `${label}.beforeTruthHash`),
    expectedSurvivorRootHash: hash(
      row.expectedSurvivorRootHash,
      `${label}.expectedSurvivorRootHash`,
    ),
    participants,
    ...(effectHash === undefined ? {} : { effectHash }),
    ...(unknownBoundary === undefined ? {} : { unknownBoundary }),
    ...(unknownOriginStatus === undefined ? {} : { unknownOriginStatus }),
  });
}

export function stageMultiOwnerCommand(input: {
  readonly campaignId: unknown;
  readonly commandId: unknown;
  readonly commandDigest: unknown;
  readonly receiptId: unknown;
  readonly commandKind: CoordinatedCommandKind;
  readonly beforeTruthHash: unknown;
  readonly expectedSurvivorRootHash: unknown;
  readonly participants: readonly {
    readonly participantId: unknown;
    readonly ownerId: unknown;
    readonly expectedOwnerRevision: unknown;
    readonly targetId: unknown;
  }[];
}): MultiOwnerCommandModel {
  return parseMultiOwnerCommandModel({
    kind: "multi-owner-command-model",
    version: 1,
    campaignId: input.campaignId,
    commandId: input.commandId,
    commandDigest: input.commandDigest,
    receiptId: input.receiptId,
    commandKind: input.commandKind,
    status: "staged",
    generation: 0,
    beforeTruthHash: input.beforeTruthHash,
    expectedSurvivorRootHash: input.expectedSurvivorRootHash,
    participants: input.participants.map((participant) => ({
      kind: "coordinator-participant",
      version: 1,
      ...participant,
    })),
  });
}

export function parseCoordinatorEvent(value: unknown): CoordinatorEvent {
  const label = "CoordinatorEvent",
    bindingKeys = [
      "kind",
      "version",
      "campaignId",
      "commandId",
      "commandDigest",
      "receiptId",
      "expectedGeneration",
    ] as const,
    base = exactRecord(
      value,
      bindingKeys,
      [
        "outcome",
        "participantId",
        "ownerId",
        "ownerRevision",
        "targetId",
        "contributionHash",
        "effectHash",
        "survivorRootHash",
      ],
      label,
    ),
    generation = revision(
      base.expectedGeneration,
      `${label}.expectedGeneration`,
    ),
    binding = Object.freeze({
      version: 1 as const,
      campaignId: campaignId(base.campaignId, `${label}.campaignId`),
      commandId: commandId(base.commandId, `${label}.commandId`),
      commandDigest: commandDigest(
        base.commandDigest,
        `${label}.commandDigest`,
      ),
      receiptId: receiptId(base.receiptId, `${label}.receiptId`),
      expectedGeneration: generation,
    });
  if (base.version !== 1) throw new Error(`${label}.version ist unbekannt.`);
  switch (base.kind) {
    case "validate": {
      const row = exactRecord(
        value,
        [...bindingKeys, "outcome"],
        [],
        label,
      );
      if (!["valid", "conflict", "unavailable"].includes(String(row.outcome)))
        throw new Error(`${label}.outcome ist unbekannt.`);
      return Object.freeze({
        kind: "validate",
        ...binding,
        outcome: row.outcome as "valid" | "conflict" | "unavailable",
      });
    }
    case "prepare-participant": {
      const row = exactRecord(
        value,
        [
          "kind",
          "version",
          "campaignId",
          "commandId",
          "commandDigest",
          "receiptId",
          "expectedGeneration",
          "participantId",
          "ownerId",
          "ownerRevision",
          "targetId",
          "contributionHash",
        ],
        [],
        label,
      );
      return Object.freeze({
        kind: "prepare-participant",
        ...binding,
        participantId: referenceId(
          row.participantId,
          `${label}.participantId`,
        ),
        ownerRevision: revision(
          row.ownerRevision,
          `${label}.ownerRevision`,
        ),
        ownerId: ownerId(row.ownerId, `${label}.ownerId`),
        targetId: referenceId(row.targetId, `${label}.targetId`),
        contributionHash: hash(
          row.contributionHash,
          `${label}.contributionHash`,
        ),
      });
    }
    case "publish":
    case "verify": {
      const row = exactRecord(
        value,
        [
          ...bindingKeys,
          "effectHash",
          "survivorRootHash",
        ],
        [],
        label,
      );
      return Object.freeze({
        kind: base.kind,
        ...binding,
        effectHash: hash(row.effectHash, `${label}.effectHash`),
        survivorRootHash: hash(
          row.survivorRootHash,
          `${label}.survivorRootHash`,
        ),
      });
    }
    case "cancel":
    case "mark-outcome-unknown":
    case "finalize":
      exactRecord(
        value,
        bindingKeys,
        [],
        label,
      );
      return Object.freeze({
        kind: base.kind,
        ...binding,
      });
    case "resolve-outcome": {
      const row = exactRecord(
        value,
        [
          ...bindingKeys,
          "outcome",
        ],
        ["effectHash", "survivorRootHash"],
        label,
      );
      if (
        !(
          row.outcome === "cancelled-before-publish" ||
          row.outcome === "published"
        )
      )
        throw new Error(`${label}.outcome ist unbekannt.`);
      if (
        row.outcome === "published" &&
        (row.effectHash === undefined || row.survivorRootHash === undefined)
      )
        throw new Error(`${label} besitzt keinen Publish-Beleg.`);
      return Object.freeze({
        kind: "resolve-outcome",
        ...binding,
        outcome: row.outcome,
        ...(row.effectHash === undefined
          ? {}
          : { effectHash: hash(row.effectHash, `${label}.effectHash`) }),
        ...(row.survivorRootHash === undefined
          ? {}
          : {
              survivorRootHash: hash(
                row.survivorRootHash,
                `${label}.survivorRootHash`,
              ),
            }),
      });
    }
    default:
      throw new Error(`${label}.kind ist unbekannt.`);
  }
}

function next(
  model: MultiOwnerCommandModel,
  patch: Partial<MultiOwnerCommandModel>,
): CoordinatorTransition {
  return Object.freeze({
    status: "applied",
    model: parseMultiOwnerCommandModel({
      ...model,
      ...patch,
      generation: model.generation + 1,
    }),
  });
}

export function transitionMultiOwnerCommand(
  modelValue: unknown,
  eventValue: unknown,
): CoordinatorTransition {
  const model = parseMultiOwnerCommandModel(modelValue),
    event = parseCoordinatorEvent(eventValue),
    reject = (
      reason: Extract<CoordinatorTransition, { status: "rejected" }>["reason"],
    ): CoordinatorTransition => Object.freeze({ status: "rejected", model, reason });
  if (event.expectedGeneration !== model.generation)
    return reject("stale-generation");
  if (
    event.campaignId !== model.campaignId ||
    event.commandId !== model.commandId ||
    event.commandDigest !== model.commandDigest
  )
    return reject("command-mismatch");
  if (event.receiptId !== model.receiptId)
    return reject("receipt-mismatch");
  if (
    [
      "finalized",
      "cancelled-before-publish",
      "conflict",
      "unavailable",
    ].includes(model.status)
  )
    return reject("already-terminal");
  if (event.kind === "validate") {
    if (model.status !== "staged") return reject("phase-conflict");
    if (event.outcome !== "valid")
      return next(model, {
        status: event.outcome,
        participants: Object.freeze(
          model.participants.map((participant) => {
            const { contributionHash: _closed, ...closed } = participant;
            return Object.freeze(closed);
          }),
        ),
      });
    if (model.participants.some((participant) => !participant.contributionHash))
      return reject("participants-incomplete");
    return next(model, { status: "validated" });
  }
  if (event.kind === "prepare-participant") {
    if (model.status !== "staged") return reject("phase-conflict");
    const participant = model.participants.find(
      (candidate) => candidate.participantId === event.participantId,
    );
    if (!participant) return reject("unknown-participant");
    if (
      participant.ownerId !== event.ownerId ||
      participant.targetId !== event.targetId
    )
      return reject("participant-mismatch");
    if (participant.expectedOwnerRevision !== event.ownerRevision)
      return reject("stale-owner");
    if (participant.contributionHash)
      return participant.contributionHash === event.contributionHash
        ? Object.freeze({ status: "applied", model })
        : reject("participant-already-prepared");
    return next(model, {
      participants: Object.freeze(
        model.participants.map((candidate) =>
          candidate.participantId === participant.participantId
            ? Object.freeze({
                ...candidate,
                contributionHash: event.contributionHash,
              })
            : candidate,
        ),
      ),
    });
  }
  if (event.kind === "cancel") {
    if (["published", "verified"].includes(model.status))
      return reject("already-published");
    if (model.status === "unknown-outcome") return reject("phase-conflict");
    return next(model, {
      status: "cancelled-before-publish",
      participants: Object.freeze(
        model.participants.map((participant) => {
          const { contributionHash: _closed, ...closed } = participant;
          return Object.freeze(closed);
        }),
      ),
    });
  }
  if (event.kind === "publish") {
    if (model.status !== "validated") return reject("phase-conflict");
    if (event.survivorRootHash !== model.expectedSurvivorRootHash)
      return reject("survivor-mismatch");
    if (event.effectHash === model.beforeTruthHash)
      return reject("effect-mismatch");
    return next(model, { status: "published", effectHash: event.effectHash });
  }
  if (event.kind === "mark-outcome-unknown") {
    if (
      !["staged", "validated", "published", "verified"].includes(model.status)
    )
      return reject("phase-conflict");
    return next(model, {
      status: "unknown-outcome",
      unknownBoundary: ["published", "verified"].includes(model.status)
        ? "post-publish"
        : "pre-publish",
      unknownOriginStatus: model.status as
        | "staged"
        | "validated"
        | "published"
        | "verified",
    });
  }
  if (event.kind === "resolve-outcome") {
    if (model.status !== "unknown-outcome") return reject("phase-conflict");
    if (event.receiptId !== model.receiptId) return reject("receipt-mismatch");
    if (
      model.unknownBoundary === "post-publish" &&
      event.outcome !== "published"
    )
      return reject("already-published");
    if (event.outcome === "cancelled-before-publish")
      return next(model, {
        status: "cancelled-before-publish",
        unknownBoundary: undefined,
        unknownOriginStatus: undefined,
        participants: Object.freeze(
          model.participants.map((participant) => {
            const { contributionHash: _closed, ...closed } = participant;
            return Object.freeze(closed);
          }),
        ),
      });
    if (model.unknownOriginStatus === "staged")
      return reject("phase-conflict");
    if (model.participants.some((participant) => !participant.contributionHash))
      return reject("participants-incomplete");
    if (event.survivorRootHash !== model.expectedSurvivorRootHash)
      return reject("survivor-mismatch");
    if (
      event.effectHash === model.beforeTruthHash ||
      (model.unknownBoundary === "post-publish" &&
        event.effectHash !== model.effectHash)
    )
      return reject("effect-mismatch");
    return next(model, {
      status:
        model.unknownOriginStatus === "verified" ? "verified" : "published",
      effectHash: event.effectHash,
      unknownBoundary: undefined,
      unknownOriginStatus: undefined,
    });
  }
  if (event.kind === "verify") {
    if (model.status !== "published") return reject("phase-conflict");
    if (event.effectHash !== model.effectHash) return reject("effect-mismatch");
    if (event.survivorRootHash !== model.expectedSurvivorRootHash)
      return reject("survivor-mismatch");
    return next(model, { status: "verified" });
  }
  if (model.status !== "verified") return reject("phase-conflict");
  return next(model, { status: "finalized" });
}
