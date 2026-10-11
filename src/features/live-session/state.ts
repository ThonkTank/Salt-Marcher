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
  liveSceneId,
  type CampaignId,
  type CharacterId,
  type LiveSceneId,
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

export interface LiveSessionAggregateState {
  readonly kind: "live-session-aggregate-state";
  readonly version: 1;
  readonly campaignId: CampaignId;
  readonly party: PartyProjection;
  readonly focus: FocusSourceSnapshot;
  readonly primarySceneId: LiveSceneId | null;
  readonly scenes: readonly RuntimeSceneState[];
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
    encounterPlanRef !== undefined && preparedFrom === undefined
  )
    throw new Error(`${label}.encounterPlanRef benötigt Preparation-Provenienz.`);
  if (
    preparedFrom &&
    (preparedFrom.campaignId !== source.campaignId ||
      preparedFrom.title !== row.title ||
      preparedFrom.notes !== row.notes ||
      preparedFrom.locationRef?.ownerId !== source.locationRef?.ownerId ||
      preparedFrom.locationRef?.referenceId !== source.locationRef?.referenceId ||
      preparedFrom.locationRef?.ownerRevision !== source.locationRef?.ownerRevision)
  )
    throw new Error(`${label} widerspricht seiner Preparation-Provenienz.`);
  if (
    encounterPlanRef !== undefined &&
    (preparedFrom?.encounterPlanRef?.ownerId !== encounterPlanRef.ownerId ||
      preparedFrom.encounterPlanRef.referenceId !== encounterPlanRef.referenceId ||
      preparedFrom.encounterPlanRef.ownerRevision !== encounterPlanRef.ownerRevision)
  )
    throw new Error(`${label}.encounterPlanRef widerspricht der Preparation.`);
  if (
    source.lifecycle === "prepared" &&
    (source.primary || source.characterIds.length || source.maskRefs.length)
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
    ],
    [],
    "LiveSessionAggregateState",
  );
  if (root.kind !== "live-session-aggregate-state" || root.version !== 1)
    throw new Error("LiveSessionAggregateState besitzt einen unbekannten Vertrag.");
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
    campaignId = party.campaignId;
  if (root.campaignId !== campaignId || focus.campaignId !== campaignId)
    throw new Error("LiveSessionAggregateState enthält eine fremde Campaign.");
  if (scenes.some((scene) => scene.source.campaignId !== campaignId))
    throw new Error("LiveSessionAggregateState enthält eine fremde Scene.");

  const activeScenes = scenes.filter((scene) => scene.source.lifecycle === "active"),
    primaries = activeScenes.filter((scene) => scene.source.primary),
    primarySceneId =
      root.primarySceneId === null
        ? null
        : liveSceneId(root.primarySceneId, "LiveSessionAggregateState.primarySceneId");
  if (
    (activeScenes.length === 0 && (primarySceneId !== null || primaries.length !== 0)) ||
    (activeScenes.length > 0 &&
      (primarySceneId === null ||
        primaries.length !== 1 ||
        primaries[0]?.source.liveSceneId !== primarySceneId))
  )
    throw new Error("LiveSessionAggregateState besitzt keine eindeutige Primary Scene.");
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
    pendingScene = new Map<CharacterId, LiveSceneId>();
  for (const scene of activeScenes) {
    for (const characterId of scene.source.characterIds) {
      if (characterScene.has(characterId))
        throw new Error("Eine CharacterId liegt in mehreren aktiven Scenes.");
      characterScene.set(characterId, scene.source.liveSceneId);
    }
    for (const pending of scene.source.pendingAssignments) {
      if (pendingScene.has(pending.characterId) || characterScene.has(pending.characterId))
        throw new Error("Eine CharacterId besitzt mehrere aktuelle Scene-Zuordnungen.");
      pendingScene.set(pending.characterId, scene.source.liveSceneId);
    }
  }
  const partyById = new Map(
    party.characters.map((character) => [character.characterId, character]),
  );
  for (const character of party.characters) {
    const assignment = character.sceneAssignment;
    if (!character.active) {
      if (characterScene.has(character.characterId) || pendingScene.has(character.characterId))
        throw new Error("Eine inaktive CharacterId liegt in einer Scene.");
      continue;
    }
    if (assignment.status === "not-started") {
      if (activeScenes.length)
        throw new Error("Nach Initialisierung darf keine aktive Figur not-started sein.");
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
    if (
      assignment.status !== "pending" ||
      !pendingScene.has(character.characterId)
    )
      throw new Error("Aktive Partyfigur besitzt keine aktuelle Scene-Zuordnung.");
  }
  for (const characterId of [...characterScene.keys(), ...pendingScene.keys()]) {
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
    throw new Error("Eine nicht initialisierte Party darf keine Scene-Zuordnung besitzen.");
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
  });
}
