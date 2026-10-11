import {
  parseOwnerReference,
  parsePreparationSnapshot,
  type OwnerReference,
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

export function parseInitializeLiveSessionCommand(
  value: unknown,
): InitializeLiveSessionCommand {
  const label = "InitializeLiveSessionCommand",
    row = exactRecord(
      value,
      [
        ...COMMON,
        "primarySceneId",
        "sceneClockRef",
        "title",
        "notes",
      ],
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

export function parsePrepareRuntimeCommand(value: unknown): PrepareRuntimeCommand {
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

export function parseMoveCharactersCommand(value: unknown): MoveCharactersCommand {
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
      exactArray(row.characterIds, `${label}.characterIds`).map((entry, index) =>
        characterId(entry, `${label}.characterIds[${index}]`),
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
    (row.targetSceneId === null) !== (row.expectedTargetRevision === undefined)
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
