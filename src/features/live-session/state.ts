import {
  parseFocusSource,
  parseLiveSceneSource,
  parseOwnerReference,
  parsePartyProjection,
  parsePreparationSnapshot,
  type FocusSourceSnapshot,
  type LiveSceneSourceSnapshot,
  type OwnerReference,
  type PartyProjection,
  type PreparationSnapshot,
} from "./contracts";
import {
  campaignId,
  characterId,
  commandDigest,
  commandId,
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

export interface RuntimeSceneState {
  readonly kind: "runtime-scene-state";
  readonly version: 1;
  readonly source: LiveSceneSourceSnapshot;
  readonly title: string;
  readonly notes: string;
  readonly preparedFrom?: PreparationSnapshot;
  readonly encounterPlanRef?: OwnerReference;
}

export interface PendingConsumerReconciliation {
  readonly ownerId: OwnerId;
  readonly campaignId: CampaignId;
  readonly commandId: CommandId;
  readonly commandDigest: CommandDigest;
  readonly sourceSceneId: LiveSceneId;
  readonly targetSceneId: LiveSceneId | null;
  readonly expectedSourceRevision: Revision;
  readonly expectedTargetRevision: Revision | null;
  readonly expectedOwnerRevision: Revision;
  readonly sourceLifecycleBefore: "active";
  readonly sourceLifecycleAfter: "active" | "retired";
  readonly action: "remove-participants" | "archive-source";
  readonly characterIds: readonly CharacterId[];
  readonly maskIds: readonly MaskId[];
  readonly status: "pending";
}

export interface LiveSessionAggregateState {
  readonly kind: "live-session-aggregate-state";
  readonly version: 1;
  readonly campaignId: CampaignId;
  readonly party: PartyProjection;
  readonly focus: FocusSourceSnapshot;
  readonly primarySceneId: LiveSceneId | null;
  readonly scenes: readonly RuntimeSceneState[];
  readonly pendingReconciliations: readonly PendingConsumerReconciliation[];
}

function parsePendingReconciliation(
  value: unknown,
  index: number,
): PendingConsumerReconciliation {
  const label = `LiveSessionAggregateState.pendingReconciliations[${index}]`,
    row = exactRecord(
      value,
      [
        "ownerId",
        "campaignId",
        "commandId",
        "commandDigest",
        "sourceSceneId",
        "targetSceneId",
        "expectedSourceRevision",
        "expectedTargetRevision",
        "expectedOwnerRevision",
        "sourceLifecycleBefore",
        "sourceLifecycleAfter",
        "action",
        "characterIds",
        "maskIds",
        "status",
      ],
      [],
      label,
    );
  if (
    row.sourceLifecycleBefore !== "active" ||
    !(
      row.sourceLifecycleAfter === "active" ||
      row.sourceLifecycleAfter === "retired"
    ) ||
    !(
      row.action === "remove-participants" || row.action === "archive-source"
    ) ||
    row.status !== "pending" ||
    (row.sourceLifecycleAfter === "active") !==
      (row.action === "remove-participants")
  )
    throw new Error(`${label} besitzt eine widersprüchliche Pflicht.`);
  const characterIds = Object.freeze(
      uniqueBy(
        exactArray(row.characterIds, `${label}.characterIds`).map(
          (entry, characterIndex) =>
            characterId(entry, `${label}.characterIds[${characterIndex}]`),
        ),
        (entry) => entry,
        `${label}.characterIds`,
      ),
    ),
    maskIds = Object.freeze(
      uniqueBy(
        exactArray(row.maskIds, `${label}.maskIds`).map((entry, maskIndex) =>
          maskId(entry, `${label}.maskIds[${maskIndex}]`),
        ),
        (entry) => entry,
        `${label}.maskIds`,
      ),
    );
  if (!characterIds.length)
    throw new Error(`${label}.characterIds darf nicht leer sein.`);
  return Object.freeze({
    ownerId: ownerId(row.ownerId, `${label}.ownerId`),
    campaignId: campaignId(row.campaignId, `${label}.campaignId`),
    commandId: commandId(row.commandId, `${label}.commandId`),
    commandDigest: commandDigest(row.commandDigest, `${label}.commandDigest`),
    sourceSceneId: liveSceneId(row.sourceSceneId, `${label}.sourceSceneId`),
    targetSceneId:
      row.targetSceneId === null
        ? null
        : liveSceneId(row.targetSceneId, `${label}.targetSceneId`),
    expectedSourceRevision: revision(
      row.expectedSourceRevision,
      `${label}.expectedSourceRevision`,
    ),
    expectedTargetRevision:
      row.expectedTargetRevision === null
        ? null
        : revision(
            row.expectedTargetRevision,
            `${label}.expectedTargetRevision`,
          ),
    expectedOwnerRevision: revision(
      row.expectedOwnerRevision,
      `${label}.expectedOwnerRevision`,
    ),
    sourceLifecycleBefore: "active",
    sourceLifecycleAfter: row.sourceLifecycleAfter,
    action: row.action,
    characterIds,
    maskIds,
    status: "pending",
  });
}

function parseRuntimeScene(value: unknown, index: number): RuntimeSceneState {
  const label = `LiveSessionAggregateState.scenes[${index}]`,
    row = exactRecord(
      value,
      ["kind", "version", "source", "title", "notes"],
      ["preparedFrom", "encounterPlanRef"],
      label,
    );
  if (row.kind !== "runtime-scene-state" || row.version !== 1)
    throw new Error(`${label} besitzt einen unbekannten Vertrag.`);
  const source = parseLiveSceneSource(row.source),
    preparedFrom =
      row.preparedFrom === undefined
        ? undefined
        : parsePreparationSnapshot(row.preparedFrom),
    encounterPlanRef =
      row.encounterPlanRef === undefined
        ? undefined
        : parseOwnerReference(
            row.encounterPlanRef,
            `${label}.encounterPlanRef`,
          );
  if (
    (preparedFrom?.encounterPlanRef === undefined) !==
    (encounterPlanRef === undefined)
  )
    throw new Error(
      `${label}.encounterPlanRef widerspricht der Preparation-Provenienz.`,
    );
  if (
    preparedFrom &&
    (preparedFrom.campaignId !== source.campaignId ||
      preparedFrom.title !== row.title ||
      preparedFrom.notes !== row.notes ||
      preparedFrom.locationRef?.ownerId !== source.locationRef?.ownerId ||
      preparedFrom.locationRef?.referenceId !==
        source.locationRef?.referenceId ||
      preparedFrom.locationRef?.ownerRevision !==
        source.locationRef?.ownerRevision)
  )
    throw new Error(`${label} widerspricht seiner Preparation-Provenienz.`);
  if (
    preparedFrom &&
    (preparedFrom.contentPins.length !== source.contentPins.length ||
      preparedFrom.contentPins.some((pin, pinIndex) => {
        const sourcePin = source.contentPins[pinIndex];
        return (
          sourcePin === undefined ||
          pin.ownerId !== sourcePin.ownerId ||
          pin.referenceId !== sourcePin.referenceId ||
          pin.ownerRevision !== sourcePin.ownerRevision
        );
      }))
  )
    throw new Error(`${label}.contentPins widersprechen der Preparation.`);
  if (
    encounterPlanRef !== undefined &&
    (preparedFrom?.encounterPlanRef?.ownerId !== encounterPlanRef.ownerId ||
      preparedFrom.encounterPlanRef.referenceId !==
        encounterPlanRef.referenceId ||
      preparedFrom.encounterPlanRef.ownerRevision !==
        encounterPlanRef.ownerRevision)
  )
    throw new Error(`${label}.encounterPlanRef widerspricht der Preparation.`);
  if (
    source.lifecycle === "prepared" &&
    (source.primary ||
      source.characterIds.length ||
      source.pendingAssignments.length ||
      source.maskRefs.length)
  )
    throw new Error(`${label} enthält eine aktive Prepared Runtime.`);
  if (source.lifecycle === "prepared" && !preparedFrom)
    throw new Error(`${label} benötigt Preparation-Provenienz.`);
  if (
    source.lifecycle !== "prepared" &&
    preparedFrom !== undefined &&
    preparedFrom.campaignId !== source.campaignId
  )
    throw new Error(`${label} besitzt fremde Preparation-Provenienz.`);
  const ownerRevisionById = new Map<OwnerId, Revision>();
  for (const mask of source.maskRefs) {
    const existing = ownerRevisionById.get(mask.ownerId);
    if (existing !== undefined && existing !== mask.ownerRevision)
      throw new Error(
        `${label} enthält widersprüchliche Masken-OwnerRevisionen.`,
      );
    ownerRevisionById.set(mask.ownerId, mask.ownerRevision);
  }
  for (const owner of source.reconciliations) {
    const maskRevision = ownerRevisionById.get(owner.ownerId);
    if (
      maskRevision !== undefined &&
      owner.ownerRevision !== undefined &&
      owner.ownerRevision !== maskRevision
    )
      throw new Error(`${label} enthält eine widersprüchliche OwnerRevision.`);
    if (maskRevision === undefined && owner.ownerRevision === undefined)
      throw new Error(`${label} benötigt eine gebundene OwnerRevision.`);
  }
  return Object.freeze({
    kind: "runtime-scene-state",
    version: 1,
    source,
    title: exactText(row.title, `${label}.title`, true),
    notes: exactText(row.notes, `${label}.notes`, true),
    ...(preparedFrom === undefined ? {} : { preparedFrom }),
    ...(encounterPlanRef === undefined ? {} : { encounterPlanRef }),
  });
}

export function parseLiveSessionAggregateState(
  value: unknown,
): LiveSessionAggregateState {
  const root = exactRecord(
    value,
    [
      "kind",
      "version",
      "campaignId",
      "party",
      "focus",
      "primarySceneId",
      "scenes",
      "pendingReconciliations",
    ],
    [],
    "LiveSessionAggregateState",
  );
  if (root.kind !== "live-session-aggregate-state" || root.version !== 1)
    throw new Error(
      "LiveSessionAggregateState besitzt einen unbekannten Vertrag.",
    );
  const party = parsePartyProjection(root.party),
    focus = parseFocusSource(root.focus),
    scenes = Object.freeze(
      uniqueBy(
        exactArray(root.scenes, "LiveSessionAggregateState.scenes").map(
          parseRuntimeScene,
        ),
        (scene) => scene.source.liveSceneId,
        "LiveSessionAggregateState.scenes",
      ),
    ),
    pendingReconciliations = Object.freeze(
      uniqueBy(
        exactArray(
          root.pendingReconciliations,
          "LiveSessionAggregateState.pendingReconciliations",
        ).map(parsePendingReconciliation),
        (entry) =>
          `${entry.ownerId}\u0000${entry.commandId}\u0000${entry.action}`,
        "LiveSessionAggregateState.pendingReconciliations",
      ),
    ),
    campaignId = party.campaignId;
  if (root.campaignId !== campaignId || focus.campaignId !== campaignId)
    throw new Error("LiveSessionAggregateState enthält eine fremde Campaign.");
  if (scenes.some((scene) => scene.source.campaignId !== campaignId))
    throw new Error("LiveSessionAggregateState enthält eine fremde Scene.");
  if (pendingReconciliations.some((entry) => entry.campaignId !== campaignId))
    throw new Error(
      "LiveSessionAggregateState enthält eine fremde Reconciliation.",
    );
  const sceneById = new Map(
    scenes.map((scene) => [scene.source.liveSceneId, scene.source]),
  );
  for (const duty of pendingReconciliations) {
    if (
      (duty.targetSceneId === null) !==
      (duty.expectedTargetRevision === null)
    )
      throw new Error(
        "LiveSessionAggregateState enthält eine widersprüchliche Zielbindung.",
      );
    const source = sceneById.get(duty.sourceSceneId),
      target =
        duty.targetSceneId === null
          ? undefined
          : sceneById.get(duty.targetSceneId);
    if (
      !source ||
      (duty.targetSceneId !== null && !target) ||
      source.liveSceneId === target?.liveSceneId
    )
      throw new Error(
        "LiveSessionAggregateState enthält eine Reconciliation ohne Scene-Bindung.",
      );
    const masks = duty.maskIds.map((id) =>
        source.maskRefs.find(
          (mask) => mask.maskId === id && mask.ownerId === duty.ownerId,
        ),
      ),
      owner = source.reconciliations.find(
        (entry) => entry.ownerId === duty.ownerId,
      );
    if (
      masks.some(
        (mask) =>
          mask === undefined ||
          mask.ownerId !== duty.ownerId ||
          mask.ownerRevision !== duty.expectedOwnerRevision,
      )
    )
      throw new Error(
        "LiveSessionAggregateState enthält eine ungebundene Masken-Reconciliation.",
      );
    if (
      (owner?.ownerRevision !== undefined &&
        owner.ownerRevision !== duty.expectedOwnerRevision) ||
      (duty.maskIds.length === 0 &&
        owner?.ownerRevision !== duty.expectedOwnerRevision)
    )
      throw new Error(
        "LiveSessionAggregateState enthält eine ungebundene Owner-Reconciliation.",
      );
  }

  const activeScenes = scenes.filter(
      (scene) => scene.source.lifecycle === "active",
    ),
    primaries = activeScenes.filter((scene) => scene.source.primary),
    primarySceneId =
      root.primarySceneId === null
        ? null
        : liveSceneId(
            root.primarySceneId,
            "LiveSessionAggregateState.primarySceneId",
          );
  if (
    (activeScenes.length === 0 &&
      (primarySceneId !== null || primaries.length !== 0)) ||
    (activeScenes.length > 0 &&
      (primarySceneId === null ||
        primaries.length !== 1 ||
        primaries[0]?.source.liveSceneId !== primarySceneId))
  )
    throw new Error(
      "LiveSessionAggregateState besitzt keine eindeutige Primary Scene.",
    );
  if (
    scenes.some(
      (scene) => scene.source.lifecycle !== "active" && scene.source.primary,
    )
  )
    throw new Error("Nur eine aktive Scene darf Primary sein.");

  const activeById = new Map(
      activeScenes.map((scene) => [scene.source.liveSceneId, scene.source]),
    ),
    characterScene = new Map<CharacterId, LiveSceneId>(),
    pendingScene = new Map<
      CharacterId,
      {
        readonly liveSceneId: LiveSceneId;
        readonly commandId: CommandId;
        readonly ownerId: OwnerId;
      }
    >();
  for (const scene of activeScenes) {
    for (const characterId of scene.source.characterIds) {
      if (characterScene.has(characterId) || pendingScene.has(characterId))
        throw new Error("Eine CharacterId liegt in mehreren aktiven Scenes.");
      characterScene.set(characterId, scene.source.liveSceneId);
    }
    for (const pending of scene.source.pendingAssignments) {
      if (
        pendingScene.has(pending.characterId) ||
        characterScene.has(pending.characterId)
      )
        throw new Error(
          "Eine CharacterId besitzt mehrere aktuelle Scene-Zuordnungen.",
        );
      pendingScene.set(pending.characterId, {
        liveSceneId: scene.source.liveSceneId,
        commandId: pending.commandId,
        ownerId: pending.ownerId,
      });
    }
  }
  const partyById = new Map(
    party.characters.map((character) => [character.characterId, character]),
  );
  for (const character of party.characters) {
    const assignment = character.sceneAssignment;
    if (!character.active) {
      if (
        characterScene.has(character.characterId) ||
        pendingScene.has(character.characterId)
      )
        throw new Error("Eine inaktive CharacterId liegt in einer Scene.");
      continue;
    }
    if (assignment.status === "not-started") {
      if (activeScenes.length)
        throw new Error(
          "Nach Initialisierung darf keine aktive Figur not-started sein.",
        );
      continue;
    }
    if (assignment.status === "assigned") {
      const scene = activeById.get(assignment.liveSceneId);
      if (
        !scene ||
        scene.sceneRevision !== assignment.sceneRevision ||
        characterScene.get(character.characterId) !== assignment.liveSceneId
      )
        throw new Error("Party- und Scene-Zuordnung widersprechen sich.");
      continue;
    }
    const pending = pendingScene.get(character.characterId);
    if (
      assignment.status !== "pending" ||
      pending === undefined ||
      pending.commandId !== assignment.commandId ||
      pending.ownerId !== assignment.ownerId
    )
      throw new Error(
        "Aktive Partyfigur besitzt keine aktuelle Scene-Zuordnung.",
      );
  }
  for (const characterId of [
    ...characterScene.keys(),
    ...pendingScene.keys(),
  ]) {
    if (!partyById.get(characterId)?.active)
      throw new Error("Eine Scene referenziert keine aktive Partyfigur.");
  }

  if (focus.status === "active") {
    const scene = activeById.get(focus.liveSceneId);
    if (!scene || scene.sceneRevision !== focus.sceneRevision)
      throw new Error("Focus referenziert keine aktuelle aktive Scene.");
  }
  return Object.freeze({
    kind: "live-session-aggregate-state",
    version: 1,
    campaignId,
    party,
    focus,
    primarySceneId,
    scenes,
    pendingReconciliations,
  });
}

export function createUninitializedLiveSessionState(
  partyValue: unknown,
): LiveSessionAggregateState {
  const party = parsePartyProjection(partyValue);
  if (
    party.characters.some(
      (character) =>
        character.active && character.sceneAssignment.status !== "not-started",
    )
  )
    throw new Error(
      "Eine nicht initialisierte Party darf keine Scene-Zuordnung besitzen.",
    );
  return parseLiveSessionAggregateState({
    kind: "live-session-aggregate-state",
    version: 1,
    campaignId: party.campaignId,
    party,
    focus: {
      kind: "focus-source",
      version: 1,
      status: "none",
      campaignId: party.campaignId,
      focusRevision: 0,
    },
    primarySceneId: null,
    scenes: [],
    pendingReconciliations: [],
  });
}
