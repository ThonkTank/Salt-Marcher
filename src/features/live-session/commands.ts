import {
  parseClockOwnerIdentity,
  parseClockReference,
  parseClockValue,
  parsePartyCharacterProfile,
  parsePartyCharacterProgress,
  parseOwnerReference,
  parsePreparationSnapshot,
  type ClockOwnerIdentity,
  type ClockReference,
  type ClockValueV1,
  type OwnerReference,
  type PartyCharacterProfileProjection,
  type PartyCharacterProgressProjection,
  type PreparationSnapshot,
} from "./contracts";
import {
  campaignId,
  characterId,
  commandDigest,
  commandId,
  liveSceneId,
  receiptId,
  revision,
  type CampaignId,
  type CharacterId,
  type CommandDigest,
  type CommandId,
  type LiveSceneId,
  type ReceiptId,
  type Revision,
} from "./ids";
import {
  exactArray,
  exactBoolean,
  exactRecord,
  exactText,
  uniqueBy,
} from "./validation";

export interface AggregateCommandBinding {
  readonly campaignId: CampaignId;
  readonly commandId: CommandId;
  readonly commandDigest: CommandDigest;
  readonly expectedPartyRevision: Revision;
  readonly expectedFocusRevision: Revision;
  readonly cancelled: boolean;
}

export interface InitializeLiveSessionCommand extends AggregateCommandBinding {
  readonly kind: "initialize-live-session";
  readonly version: 1;
  readonly primarySceneId: LiveSceneId;
  readonly sceneClockRef: ClockReference;
  readonly title: string;
  readonly notes: string;
}

export interface PrepareRuntimeCommand extends AggregateCommandBinding {
  readonly kind: "prepare-runtime";
  readonly version: 1;
  readonly liveSceneId: LiveSceneId;
  readonly sceneClockRef: ClockReference;
  readonly snapshot: PreparationSnapshot;
}

export interface MoveCharactersCommand extends AggregateCommandBinding {
  readonly kind: "move-characters";
  readonly version: 1;
  readonly sourceSceneId: LiveSceneId;
  readonly targetSceneId: LiveSceneId;
  readonly expectedSourceRevision: Revision;
  readonly expectedTargetRevision: Revision;
  readonly characterIds: readonly CharacterId[];
}

interface ClockContributionBase {
  readonly status: "prepared-unpublished";
  readonly receiptId: ReceiptId;
  readonly campaignId: CampaignId;
  readonly commandId: CommandId;
  readonly commandDigest: CommandDigest;
  readonly ownerIdentity: ClockOwnerIdentity;
  readonly calendarDefinitionRef: OwnerReference;
  readonly sourceSceneId: LiveSceneId;
  readonly sourceSceneRevisionBefore: Revision;
  readonly sourceSceneRevisionAfter: Revision;
  readonly sourceClockRef: ClockReference;
  readonly sourceClockValue: ClockValueV1;
  readonly sourceClockRevisionAfter: Revision;
  readonly targetSceneId: LiveSceneId;
  readonly targetSceneRevisionAfter: Revision;
  readonly targetClockRefAfter: ClockReference;
  readonly targetClockRevisionAfter: Revision;
  readonly targetClockValueAfter: ClockValueV1;
  readonly sourceDisposition: "retain" | "archive";
}

export interface ClockForkCreateContribution extends ClockContributionBase {
  readonly kind: "clock-fork-create-contribution";
  readonly version: 1;
  readonly targetKind: "created";
  readonly choice: "source-confirmed";
}

export interface ClockMergeContribution extends ClockContributionBase {
  readonly kind: "clock-merge-contribution";
  readonly version: 1;
  readonly targetKind: "existing";
  readonly targetSceneRevisionBefore: Revision;
  readonly targetClockRefBefore: ClockReference;
  readonly targetClockRevisionBefore: Revision;
  readonly targetClockValueBefore: ClockValueV1;
  readonly choice: "source-confirmed" | "target-confirmed" | "manual-confirmed";
}

export interface SplitSceneCommand extends AggregateCommandBinding {
  readonly kind: "split-scene";
  readonly version: 1;
  readonly sourceSceneId: LiveSceneId;
  readonly expectedSourceRevision: Revision;
  readonly targetSceneId: LiveSceneId;
  readonly targetClockRef: ClockReference;
  readonly characterIds: readonly CharacterId[];
  readonly title: string;
  readonly clockContribution: ClockForkCreateContribution;
}

export interface RejoinScenesCommand extends AggregateCommandBinding {
  readonly kind: "rejoin-scenes";
  readonly version: 1;
  readonly sourceSceneId: LiveSceneId;
  readonly expectedSourceRevision: Revision;
  readonly targetSceneId: LiveSceneId;
  readonly expectedTargetRevision: Revision;
  readonly clockContribution: ClockMergeContribution;
}

export interface SetFocusCommand extends AggregateCommandBinding {
  readonly kind: "set-focus";
  readonly version: 1;
  readonly targetSceneId: LiveSceneId | null;
  readonly expectedTargetRevision?: Revision;
}

export interface ActivatePartyCharacterCommand extends AggregateCommandBinding {
  readonly kind: "activate-party-character";
  readonly version: 1;
  readonly characterId: CharacterId;
  readonly targetSceneId?: LiveSceneId;
  readonly expectedTargetRevision?: Revision;
}

export interface DeactivatePartyCharacterCommand
  extends AggregateCommandBinding {
  readonly kind: "deactivate-party-character";
  readonly version: 1;
  readonly characterId: CharacterId;
  readonly expectedSourceRevision?: Revision;
  readonly primarySuccessorSceneId?: LiveSceneId;
  readonly expectedSuccessorRevision?: Revision;
}

export interface PartyCommandBinding {
  readonly campaignId: CampaignId;
  readonly commandId: CommandId;
  readonly commandDigest: CommandDigest;
  readonly expectedPartyRevision: Revision;
  readonly cancelled: boolean;
}

export interface CreatePartyCharacterCommand extends PartyCommandBinding {
  readonly kind: "create-party-character";
  readonly version: 1;
  readonly characterId: CharacterId;
  readonly profile: PartyCharacterProfileProjection;
}

export interface UpdatePartyCharacterProfileCommand
  extends PartyCommandBinding {
  readonly kind: "update-party-character-profile";
  readonly version: 1;
  readonly characterId: CharacterId;
  readonly profile: PartyCharacterProfileProjection;
}

export interface SetPartyCharacterProgressCommand extends PartyCommandBinding {
  readonly kind: "set-party-character-progress";
  readonly version: 1;
  readonly characterId: CharacterId;
  readonly progress: PartyCharacterProgressProjection;
}

export interface RestPartyCharactersCommand extends PartyCommandBinding {
  readonly kind: "rest-party-characters";
  readonly version: 1;
  readonly rest: "short" | "long";
  readonly characterIds: readonly CharacterId[];
}

function binding(
  row: Record<string, unknown>,
  label: string,
): AggregateCommandBinding {
  return Object.freeze({
    campaignId: campaignId(row.campaignId, `${label}.campaignId`),
    commandId: commandId(row.commandId, `${label}.commandId`),
    commandDigest: commandDigest(row.commandDigest, `${label}.commandDigest`),
    expectedPartyRevision: revision(
      row.expectedPartyRevision,
      `${label}.expectedPartyRevision`,
    ),
    expectedFocusRevision: revision(
      row.expectedFocusRevision,
      `${label}.expectedFocusRevision`,
    ),
    cancelled: exactBoolean(row.cancelled, `${label}.cancelled`),
  });
}

const COMMON = [
  "kind",
  "version",
  "campaignId",
  "commandId",
  "commandDigest",
  "expectedPartyRevision",
  "expectedFocusRevision",
  "cancelled",
] as const;

const PARTY_COMMON = [
  "kind",
  "version",
  "campaignId",
  "commandId",
  "commandDigest",
  "expectedPartyRevision",
  "cancelled",
] as const;

function partyBinding(
  row: Record<string, unknown>,
  label: string,
): PartyCommandBinding {
  return Object.freeze({
    campaignId: campaignId(row.campaignId, `${label}.campaignId`),
    commandId: commandId(row.commandId, `${label}.commandId`),
    commandDigest: commandDigest(row.commandDigest, `${label}.commandDigest`),
    expectedPartyRevision: revision(
      row.expectedPartyRevision,
      `${label}.expectedPartyRevision`,
    ),
    cancelled: exactBoolean(row.cancelled, `${label}.cancelled`),
  });
}

export function parseCreatePartyCharacterCommand(
  value: unknown,
): CreatePartyCharacterCommand {
  const label = "CreatePartyCharacterCommand",
    row = exactRecord(
      value,
      [...PARTY_COMMON, "characterId", "profile"],
      [],
      label,
    );
  if (row.kind !== "create-party-character" || row.version !== 1)
    throw new Error(`${label} besitzt einen unbekannten Vertrag.`);
  return Object.freeze({
    kind: "create-party-character",
    version: 1,
    ...partyBinding(row, label),
    characterId: characterId(row.characterId, `${label}.characterId`),
    profile: parsePartyCharacterProfile(row.profile, `${label}.profile`),
  });
}

export function parseUpdatePartyCharacterProfileCommand(
  value: unknown,
): UpdatePartyCharacterProfileCommand {
  const label = "UpdatePartyCharacterProfileCommand",
    row = exactRecord(
      value,
      [...PARTY_COMMON, "characterId", "profile"],
      [],
      label,
    );
  if (row.kind !== "update-party-character-profile" || row.version !== 1)
    throw new Error(`${label} besitzt einen unbekannten Vertrag.`);
  return Object.freeze({
    kind: "update-party-character-profile",
    version: 1,
    ...partyBinding(row, label),
    characterId: characterId(row.characterId, `${label}.characterId`),
    profile: parsePartyCharacterProfile(row.profile, `${label}.profile`),
  });
}

export function parseSetPartyCharacterProgressCommand(
  value: unknown,
): SetPartyCharacterProgressCommand {
  const label = "SetPartyCharacterProgressCommand",
    row = exactRecord(
      value,
      [...PARTY_COMMON, "characterId", "progress"],
      [],
      label,
    );
  if (row.kind !== "set-party-character-progress" || row.version !== 1)
    throw new Error(`${label} besitzt einen unbekannten Vertrag.`);
  return Object.freeze({
    kind: "set-party-character-progress",
    version: 1,
    ...partyBinding(row, label),
    characterId: characterId(row.characterId, `${label}.characterId`),
    progress: parsePartyCharacterProgress(row.progress, `${label}.progress`),
  });
}

export function parseRestPartyCharactersCommand(
  value: unknown,
): RestPartyCharactersCommand {
  const label = "RestPartyCharactersCommand",
    row = exactRecord(
      value,
      [...PARTY_COMMON, "rest", "characterIds"],
      [],
      label,
    );
  if (row.kind !== "rest-party-characters" || row.version !== 1)
    throw new Error(`${label} besitzt einen unbekannten Vertrag.`);
  if (!(row.rest === "short" || row.rest === "long"))
    throw new Error(`${label}.rest ist unbekannt.`);
  const characterIds = Object.freeze(
    uniqueBy(
      exactArray(row.characterIds, `${label}.characterIds`).map(
        (entry, index) => characterId(entry, `${label}.characterIds[${index}]`),
      ),
      (entry) => entry,
      `${label}.characterIds`,
    ),
  );
  if (!characterIds.length)
    throw new Error(`${label}.characterIds darf nicht leer sein.`);
  return Object.freeze({
    kind: "rest-party-characters",
    version: 1,
    ...partyBinding(row, label),
    rest: row.rest,
    characterIds,
  });
}

export function parseInitializeLiveSessionCommand(
  value: unknown,
): InitializeLiveSessionCommand {
  const label = "InitializeLiveSessionCommand",
    row = exactRecord(
      value,
      [...COMMON, "primarySceneId", "sceneClockRef", "title", "notes"],
      [],
      label,
    );
  if (row.kind !== "initialize-live-session" || row.version !== 1)
    throw new Error(`${label} besitzt einen unbekannten Vertrag.`);
  return Object.freeze({
    kind: "initialize-live-session",
    version: 1,
    ...binding(row, label),
    primarySceneId: liveSceneId(row.primarySceneId, `${label}.primarySceneId`),
    sceneClockRef: parseClockReference(
      row.sceneClockRef,
      `${label}.sceneClockRef`,
    ),
    title: exactText(row.title, `${label}.title`, true),
    notes: exactText(row.notes, `${label}.notes`, true),
  });
}

export function parsePrepareRuntimeCommand(
  value: unknown,
): PrepareRuntimeCommand {
  const label = "PrepareRuntimeCommand",
    row = exactRecord(
      value,
      [...COMMON, "liveSceneId", "sceneClockRef", "snapshot"],
      [],
      label,
    );
  if (row.kind !== "prepare-runtime" || row.version !== 1)
    throw new Error(`${label} besitzt einen unbekannten Vertrag.`);
  return Object.freeze({
    kind: "prepare-runtime",
    version: 1,
    ...binding(row, label),
    liveSceneId: liveSceneId(row.liveSceneId, `${label}.liveSceneId`),
    sceneClockRef: parseClockReference(
      row.sceneClockRef,
      `${label}.sceneClockRef`,
    ),
    snapshot: parsePreparationSnapshot(row.snapshot),
  });
}

export function parseMoveCharactersCommand(
  value: unknown,
): MoveCharactersCommand {
  const label = "MoveCharactersCommand",
    row = exactRecord(
      value,
      [
        ...COMMON,
        "sourceSceneId",
        "targetSceneId",
        "expectedSourceRevision",
        "expectedTargetRevision",
        "characterIds",
      ],
      [],
      label,
    );
  if (row.kind !== "move-characters" || row.version !== 1)
    throw new Error(`${label} besitzt einen unbekannten Vertrag.`);
  const characterIds = Object.freeze(
    uniqueBy(
      exactArray(row.characterIds, `${label}.characterIds`).map(
        (entry, index) => characterId(entry, `${label}.characterIds[${index}]`),
      ),
      (entry) => entry,
      `${label}.characterIds`,
    ),
  );
  if (!characterIds.length)
    throw new Error(`${label}.characterIds darf nicht leer sein.`);
  return Object.freeze({
    kind: "move-characters",
    version: 1,
    ...binding(row, label),
    sourceSceneId: liveSceneId(row.sourceSceneId, `${label}.sourceSceneId`),
    targetSceneId: liveSceneId(row.targetSceneId, `${label}.targetSceneId`),
    expectedSourceRevision: revision(
      row.expectedSourceRevision,
      `${label}.expectedSourceRevision`,
    ),
    expectedTargetRevision: revision(
      row.expectedTargetRevision,
      `${label}.expectedTargetRevision`,
    ),
    characterIds,
  });
}

const CLOCK_CONTRIBUTION_COMMON = [
  "kind",
  "version",
  "status",
  "receiptId",
  "campaignId",
  "commandId",
  "commandDigest",
  "ownerIdentity",
  "calendarDefinitionRef",
  "sourceSceneId",
  "sourceSceneRevisionBefore",
  "sourceSceneRevisionAfter",
  "sourceClockRef",
  "sourceClockValue",
  "sourceClockRevisionAfter",
  "targetSceneId",
  "targetSceneRevisionAfter",
  "targetClockRefAfter",
  "targetClockRevisionAfter",
  "targetClockValueAfter",
  "sourceDisposition",
  "targetKind",
  "choice",
] as const;

function clockContributionBase(
  row: Record<string, unknown>,
  label: string,
): ClockContributionBase {
  if (row.status !== "prepared-unpublished")
    throw new Error(`${label}.status ist nicht vorbereitet.`);
  if (
    !(row.sourceDisposition === "retain" || row.sourceDisposition === "archive")
  )
    throw new Error(`${label}.sourceDisposition ist unbekannt.`);
  const ownerIdentity = parseClockOwnerIdentity(
      row.ownerIdentity,
      `${label}.ownerIdentity`,
    ),
    sourceClockRef = parseClockReference(
      row.sourceClockRef,
      `${label}.sourceClockRef`,
    ),
    targetClockRefAfter = parseClockReference(
      row.targetClockRefAfter,
      `${label}.targetClockRefAfter`,
    ),
    sourceClockRevisionAfter = revision(
      row.sourceClockRevisionAfter,
      `${label}.sourceClockRevisionAfter`,
    ),
    targetClockRevisionAfter = revision(
      row.targetClockRevisionAfter,
      `${label}.targetClockRevisionAfter`,
    );
  if (
    ownerIdentity.ownerId !== sourceClockRef.ownerId ||
    ownerIdentity.generationId !== sourceClockRef.generationId ||
    ownerIdentity.ownerId !== targetClockRefAfter.ownerId ||
    ownerIdentity.generationId !== targetClockRefAfter.generationId ||
    sourceClockRevisionAfter !== sourceClockRef.ownerRevision ||
    targetClockRevisionAfter !== targetClockRefAfter.ownerRevision
  )
    throw new Error(
      `${label} bindet Clock-Identität oder Revision widersprüchlich.`,
    );
  return Object.freeze({
    status: "prepared-unpublished",
    receiptId: receiptId(row.receiptId, `${label}.receiptId`),
    campaignId: campaignId(row.campaignId, `${label}.campaignId`),
    commandId: commandId(row.commandId, `${label}.commandId`),
    commandDigest: commandDigest(row.commandDigest, `${label}.commandDigest`),
    ownerIdentity,
    calendarDefinitionRef: parseOwnerReference(
      row.calendarDefinitionRef,
      `${label}.calendarDefinitionRef`,
    ),
    sourceSceneId: liveSceneId(row.sourceSceneId, `${label}.sourceSceneId`),
    sourceSceneRevisionBefore: revision(
      row.sourceSceneRevisionBefore,
      `${label}.sourceSceneRevisionBefore`,
    ),
    sourceSceneRevisionAfter: revision(
      row.sourceSceneRevisionAfter,
      `${label}.sourceSceneRevisionAfter`,
    ),
    sourceClockRef,
    sourceClockValue: parseClockValue(
      row.sourceClockValue,
      `${label}.sourceClockValue`,
    ),
    sourceClockRevisionAfter,
    targetSceneId: liveSceneId(row.targetSceneId, `${label}.targetSceneId`),
    targetSceneRevisionAfter: revision(
      row.targetSceneRevisionAfter,
      `${label}.targetSceneRevisionAfter`,
    ),
    targetClockRefAfter,
    targetClockRevisionAfter,
    targetClockValueAfter: parseClockValue(
      row.targetClockValueAfter,
      `${label}.targetClockValueAfter`,
    ),
    sourceDisposition: row.sourceDisposition,
  });
}

export function parseClockForkCreateContribution(
  value: unknown,
): ClockForkCreateContribution {
  const label = "ClockForkCreateContribution",
    row = exactRecord(value, CLOCK_CONTRIBUTION_COMMON, [], label);
  if (
    row.kind !== "clock-fork-create-contribution" ||
    row.version !== 1 ||
    row.targetKind !== "created" ||
    row.choice !== "source-confirmed"
  )
    throw new Error(`${label} besitzt einen unbekannten Vertrag.`);
  const base = clockContributionBase(row, label);
  if (
    base.targetSceneRevisionAfter !== 0 ||
    base.targetClockRevisionAfter !== 0 ||
    base.sourceClockValue.canonicalValue !==
      base.targetClockValueAfter.canonicalValue
  )
    throw new Error(`${label} besitzt keinen kanonischen Fresh-Fork.`);
  return Object.freeze({
    kind: "clock-fork-create-contribution",
    version: 1,
    ...base,
    targetKind: "created",
    choice: "source-confirmed",
  });
}

export function parseClockMergeContribution(
  value: unknown,
): ClockMergeContribution {
  const label = "ClockMergeContribution",
    row = exactRecord(
      value,
      [
        ...CLOCK_CONTRIBUTION_COMMON,
        "targetSceneRevisionBefore",
        "targetClockRefBefore",
        "targetClockRevisionBefore",
        "targetClockValueBefore",
      ],
      [],
      label,
    );
  if (
    row.kind !== "clock-merge-contribution" ||
    row.version !== 1 ||
    row.targetKind !== "existing" ||
    !(
      row.choice === "source-confirmed" ||
      row.choice === "target-confirmed" ||
      row.choice === "manual-confirmed"
    )
  )
    throw new Error(`${label} besitzt einen unbekannten Vertrag.`);
  const base = clockContributionBase(row, label),
    targetClockRefBefore = parseClockReference(
      row.targetClockRefBefore,
      `${label}.targetClockRefBefore`,
    ),
    targetClockRevisionBefore = revision(
      row.targetClockRevisionBefore,
      `${label}.targetClockRevisionBefore`,
    ),
    targetClockValueBefore = parseClockValue(
      row.targetClockValueBefore,
      `${label}.targetClockValueBefore`,
    );
  if (
    targetClockRefBefore.ownerId !== base.ownerIdentity.ownerId ||
    targetClockRefBefore.generationId !== base.ownerIdentity.generationId ||
    targetClockRefBefore.referenceId !== base.targetClockRefAfter.referenceId ||
    targetClockRefBefore.ownerRevision !== targetClockRevisionBefore ||
    base.targetClockRevisionAfter !== targetClockRevisionBefore + 1 ||
    (row.choice === "source-confirmed" &&
      base.targetClockValueAfter.canonicalValue !==
        base.sourceClockValue.canonicalValue) ||
    (row.choice === "target-confirmed" &&
      base.targetClockValueAfter.canonicalValue !==
        targetClockValueBefore.canonicalValue)
  )
    throw new Error(
      `${label} bindet Merge-Wahl oder Revision widersprüchlich.`,
    );
  return Object.freeze({
    kind: "clock-merge-contribution",
    version: 1,
    ...base,
    targetKind: "existing",
    targetSceneRevisionBefore: revision(
      row.targetSceneRevisionBefore,
      `${label}.targetSceneRevisionBefore`,
    ),
    targetClockRefBefore,
    targetClockRevisionBefore,
    targetClockValueBefore,
    choice: row.choice,
  });
}

function parsedCharacterIds(
  value: unknown,
  label: string,
): readonly CharacterId[] {
  const values = Object.freeze(
    uniqueBy(
      exactArray(value, label).map((entry, index) =>
        characterId(entry, `${label}[${index}]`),
      ),
      (entry) => entry,
      label,
    ),
  );
  if (!values.length) throw new Error(`${label} darf nicht leer sein.`);
  return values;
}

export function parseSplitSceneCommand(value: unknown): SplitSceneCommand {
  const label = "SplitSceneCommand",
    row = exactRecord(
      value,
      [
        ...COMMON,
        "sourceSceneId",
        "expectedSourceRevision",
        "targetSceneId",
        "targetClockRef",
        "characterIds",
        "title",
        "clockContribution",
      ],
      [],
      label,
    );
  if (row.kind !== "split-scene" || row.version !== 1)
    throw new Error(`${label} besitzt einen unbekannten Vertrag.`);
  return Object.freeze({
    kind: "split-scene",
    version: 1,
    ...binding(row, label),
    sourceSceneId: liveSceneId(row.sourceSceneId, `${label}.sourceSceneId`),
    expectedSourceRevision: revision(
      row.expectedSourceRevision,
      `${label}.expectedSourceRevision`,
    ),
    targetSceneId: liveSceneId(row.targetSceneId, `${label}.targetSceneId`),
    targetClockRef: parseClockReference(
      row.targetClockRef,
      `${label}.targetClockRef`,
    ),
    characterIds: parsedCharacterIds(row.characterIds, `${label}.characterIds`),
    title: exactText(row.title, `${label}.title`, true),
    clockContribution: parseClockForkCreateContribution(row.clockContribution),
  });
}

export function parseRejoinScenesCommand(value: unknown): RejoinScenesCommand {
  const label = "RejoinScenesCommand",
    row = exactRecord(
      value,
      [
        ...COMMON,
        "sourceSceneId",
        "expectedSourceRevision",
        "targetSceneId",
        "expectedTargetRevision",
        "clockContribution",
      ],
      [],
      label,
    );
  if (row.kind !== "rejoin-scenes" || row.version !== 1)
    throw new Error(`${label} besitzt einen unbekannten Vertrag.`);
  return Object.freeze({
    kind: "rejoin-scenes",
    version: 1,
    ...binding(row, label),
    sourceSceneId: liveSceneId(row.sourceSceneId, `${label}.sourceSceneId`),
    expectedSourceRevision: revision(
      row.expectedSourceRevision,
      `${label}.expectedSourceRevision`,
    ),
    targetSceneId: liveSceneId(row.targetSceneId, `${label}.targetSceneId`),
    expectedTargetRevision: revision(
      row.expectedTargetRevision,
      `${label}.expectedTargetRevision`,
    ),
    clockContribution: parseClockMergeContribution(row.clockContribution),
  });
}

export function parseSetFocusCommand(value: unknown): SetFocusCommand {
  const label = "SetFocusCommand",
    row = exactRecord(
      value,
      [...COMMON, "targetSceneId"],
      ["expectedTargetRevision"],
      label,
    );
  if (row.kind !== "set-focus" || row.version !== 1)
    throw new Error(`${label} besitzt einen unbekannten Vertrag.`);
  if (
    (row.targetSceneId === null) !==
    (row.expectedTargetRevision === undefined)
  )
    throw new Error(`${label} bindet Ziel und Revision widersprüchlich.`);
  return Object.freeze({
    kind: "set-focus",
    version: 1,
    ...binding(row, label),
    targetSceneId:
      row.targetSceneId === null
        ? null
        : liveSceneId(row.targetSceneId, `${label}.targetSceneId`),
    ...(row.expectedTargetRevision === undefined
      ? {}
      : {
          expectedTargetRevision: revision(
            row.expectedTargetRevision,
            `${label}.expectedTargetRevision`,
          ),
        }),
  });
}

export function parseActivatePartyCharacterCommand(
  value: unknown,
): ActivatePartyCharacterCommand {
  const label = "ActivatePartyCharacterCommand",
    row = exactRecord(
      value,
      [...COMMON, "characterId"],
      ["targetSceneId", "expectedTargetRevision"],
      label,
    );
  if (row.kind !== "activate-party-character" || row.version !== 1)
    throw new Error(`${label} besitzt einen unbekannten Vertrag.`);
  if (
    (row.targetSceneId === undefined) !==
    (row.expectedTargetRevision === undefined)
  )
    throw new Error(`${label} bindet Ziel und Revision widersprüchlich.`);
  return Object.freeze({
    kind: "activate-party-character",
    version: 1,
    ...binding(row, label),
    characterId: characterId(row.characterId, `${label}.characterId`),
    ...(row.targetSceneId === undefined
      ? {}
      : {
          targetSceneId: liveSceneId(
            row.targetSceneId,
            `${label}.targetSceneId`,
          ),
          expectedTargetRevision: revision(
            row.expectedTargetRevision,
            `${label}.expectedTargetRevision`,
          ),
        }),
  });
}

export function parseDeactivatePartyCharacterCommand(
  value: unknown,
): DeactivatePartyCharacterCommand {
  const label = "DeactivatePartyCharacterCommand",
    row = exactRecord(
      value,
      [...COMMON, "characterId"],
      [
        "expectedSourceRevision",
        "primarySuccessorSceneId",
        "expectedSuccessorRevision",
      ],
      label,
    );
  if (row.kind !== "deactivate-party-character" || row.version !== 1)
    throw new Error(`${label} besitzt einen unbekannten Vertrag.`);
  if (
    (row.primarySuccessorSceneId === undefined) !==
    (row.expectedSuccessorRevision === undefined)
  )
    throw new Error(`${label} bindet Nachfolger und Revision widersprüchlich.`);
  return Object.freeze({
    kind: "deactivate-party-character",
    version: 1,
    ...binding(row, label),
    characterId: characterId(row.characterId, `${label}.characterId`),
    ...(row.expectedSourceRevision === undefined
      ? {}
      : {
          expectedSourceRevision: revision(
            row.expectedSourceRevision,
            `${label}.expectedSourceRevision`,
          ),
        }),
    ...(row.primarySuccessorSceneId === undefined
      ? {}
      : {
          primarySuccessorSceneId: liveSceneId(
            row.primarySuccessorSceneId,
            `${label}.primarySuccessorSceneId`,
          ),
          expectedSuccessorRevision: revision(
            row.expectedSuccessorRevision,
            `${label}.expectedSuccessorRevision`,
          ),
        }),
  });
}
