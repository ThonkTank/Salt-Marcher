import {
  parsePartyCharacterProfile,
  parsePartyCharacterProgress,
  parseOwnerReference,
  parsePreparationSnapshot,
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
  revision,
  type CampaignId,
  type CharacterId,
  type CommandDigest,
  type CommandId,
  type LiveSceneId,
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
  readonly sceneClockRef: OwnerReference;
  readonly title: string;
  readonly notes: string;
}

export interface PrepareRuntimeCommand extends AggregateCommandBinding {
  readonly kind: "prepare-runtime";
  readonly version: 1;
  readonly liveSceneId: LiveSceneId;
  readonly sceneClockRef: OwnerReference;
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
    sceneClockRef: parseOwnerReference(
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
    sceneClockRef: parseOwnerReference(
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
      ["expectedSourceRevision"],
      label,
    );
  if (row.kind !== "deactivate-party-character" || row.version !== 1)
    throw new Error(`${label} besitzt einen unbekannten Vertrag.`);
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
  });
}
