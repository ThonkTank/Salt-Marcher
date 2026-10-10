import {
  parseFocusSource,
  parseLiveSceneSource,
  parsePartyProjection,
  type FocusSourceSnapshot,
  type LiveSceneSourceSnapshot,
  type MaskReference,
  type OwnerReconciliation,
  type OwnerReference,
  type PartyProjection,
  type PendingAssignment,
} from "./contracts";
import type {
  CampaignId,
  CharacterId,
  CommandId,
  LiveSceneId,
  OwnerId,
  Revision,
} from "./ids";

export type FocusUnavailableReason =
  | "owner-unavailable"
  | "missing-scene"
  | "invalid-scene"
  | "foreign-scene"
  | "stale-scene"
  | "inactive-scene";

export type FocusProjection =
  | {
      readonly kind: "focus-projection";
      readonly version: 1;
      readonly status: "active";
      readonly campaignId: CampaignId;
      readonly focusRevision: Revision;
      readonly liveSceneId: LiveSceneId;
      readonly sceneRevision: Revision;
    }
  | {
      readonly kind: "focus-projection";
      readonly version: 1;
      readonly status: "none";
      readonly campaignId: CampaignId;
      readonly focusRevision: Revision;
      readonly liveSceneId: null;
    }
  | {
      readonly kind: "focus-projection";
      readonly version: 1;
      readonly status: "pending";
      readonly campaignId: CampaignId;
      readonly focusRevision: Revision;
      readonly liveSceneId: null;
      readonly commandId: CommandId;
    }
  | {
      readonly kind: "focus-projection";
      readonly version: 1;
      readonly status: "unavailable";
      readonly campaignId: CampaignId;
      readonly focusRevision: Revision;
      readonly liveSceneId: null;
      readonly reason: FocusUnavailableReason;
      readonly ownerId?: OwnerId;
    };

export interface LiveSceneProjection {
  readonly kind: "live-scene-projection";
  readonly version: 1;
  readonly campaignId: CampaignId;
  readonly liveSceneId: LiveSceneId;
  readonly sceneRevision: Revision;
  readonly primary: boolean;
  readonly focus:
    | { readonly status: "focused"; readonly focusRevision: Revision }
    | { readonly status: "not-focused" };
  readonly characterIds: readonly CharacterId[];
  readonly pendingAssignments: readonly PendingAssignment[];
  readonly locationRef?: OwnerReference;
  readonly sceneClockRef?: OwnerReference;
  readonly groupRefs: readonly OwnerReference[];
  readonly maskRefs: readonly MaskReference[];
  readonly reconciliations: readonly OwnerReconciliation[];
  readonly contentPins: readonly OwnerReference[];
}

export type LiveSceneProjectionResult =
  | { readonly status: "active"; readonly projection: LiveSceneProjection }
  | {
      readonly status: "unavailable";
      readonly reason:
        | "invalid-scene"
        | "foreign-scene"
        | "inactive-scene";
    };

export type LiveSessionProjection =
  | {
      readonly kind: "live-session-projection";
      readonly version: 1;
      readonly status: "active";
      readonly campaignId: CampaignId;
      readonly partyRevision: Revision;
      readonly focusRevision: Revision;
      readonly scene: LiveSceneProjection;
    }
  | {
      readonly kind: "live-session-projection";
      readonly version: 1;
      readonly status: "none" | "pending" | "unavailable";
      readonly campaignId: CampaignId;
      readonly partyRevision: Revision;
      readonly focusRevision: Revision;
    };

function unavailableFocus(
  focus: FocusSourceSnapshot,
  reason: FocusUnavailableReason,
  owner?: OwnerId,
): FocusProjection {
  return Object.freeze({
    kind: "focus-projection",
    version: 1,
    status: "unavailable",
    campaignId: focus.campaignId,
    focusRevision: focus.focusRevision,
    liveSceneId: null,
    reason,
    ...(owner === undefined ? {} : { ownerId: owner }),
  });
}

export function projectFocus(
  focusValue: unknown,
  sceneValue?: unknown,
): FocusProjection {
  const focus = parseFocusSource(focusValue);
  if (focus.status === "none")
    return Object.freeze({
      kind: "focus-projection",
      version: 1,
      status: "none",
      campaignId: focus.campaignId,
      focusRevision: focus.focusRevision,
      liveSceneId: null,
    });
  if (focus.status === "pending")
    return Object.freeze({
      kind: "focus-projection",
      version: 1,
      status: "pending",
      campaignId: focus.campaignId,
      focusRevision: focus.focusRevision,
      liveSceneId: null,
      commandId: focus.commandId,
    });
  if (focus.status === "unavailable")
    return unavailableFocus(focus, "owner-unavailable", focus.ownerId);
  if (sceneValue === undefined) return unavailableFocus(focus, "missing-scene");
  let scene: LiveSceneSourceSnapshot;
  try {
    scene = parseLiveSceneSource(sceneValue);
  } catch {
    return unavailableFocus(focus, "invalid-scene");
  }
  if (
    scene.campaignId !== focus.campaignId ||
    scene.liveSceneId !== focus.liveSceneId
  )
    return unavailableFocus(focus, "foreign-scene");
  if (scene.sceneRevision !== focus.sceneRevision)
    return unavailableFocus(focus, "stale-scene");
  if (scene.lifecycle !== "active")
    return unavailableFocus(focus, "inactive-scene");
  return Object.freeze({
    kind: "focus-projection",
    version: 1,
    status: "active",
    campaignId: focus.campaignId,
    focusRevision: focus.focusRevision,
    liveSceneId: focus.liveSceneId,
    sceneRevision: focus.sceneRevision,
  });
}

export function projectLiveScene(
  sceneValue: unknown,
  focus: FocusProjection,
): LiveSceneProjectionResult {
  let scene: LiveSceneSourceSnapshot;
  try {
    scene = parseLiveSceneSource(sceneValue);
  } catch {
    return Object.freeze({ status: "unavailable", reason: "invalid-scene" });
  }
  if (scene.campaignId !== focus.campaignId)
    return Object.freeze({ status: "unavailable", reason: "foreign-scene" });
  if (scene.lifecycle !== "active")
    return Object.freeze({ status: "unavailable", reason: "inactive-scene" });
  const focused =
    focus.status === "active" &&
    focus.liveSceneId === scene.liveSceneId &&
    focus.sceneRevision === scene.sceneRevision;
  const projection: LiveSceneProjection = Object.freeze({
    kind: "live-scene-projection",
    version: 1,
    campaignId: scene.campaignId,
    liveSceneId: scene.liveSceneId,
    sceneRevision: scene.sceneRevision,
    primary: scene.primary,
    focus: focused
      ? Object.freeze({
          status: "focused" as const,
          focusRevision: focus.focusRevision,
        })
      : Object.freeze({ status: "not-focused" as const }),
    characterIds: scene.characterIds,
    pendingAssignments: scene.pendingAssignments,
    ...(scene.locationRef === undefined
      ? {}
      : { locationRef: scene.locationRef }),
    ...(scene.sceneClockRef === undefined
      ? {}
      : { sceneClockRef: scene.sceneClockRef }),
    groupRefs: scene.groupRefs,
    maskRefs: scene.maskRefs,
    reconciliations: scene.reconciliations,
    contentPins: scene.contentPins,
  });
  return Object.freeze({ status: "active", projection });
}

function activeSceneMatchesParty(
  party: PartyProjection,
  scene: LiveSceneProjection,
): boolean {
  const characters = new Map(
    party.characters.map((entry) => [entry.characterId, entry]),
  ), sceneCharacterIds = new Set(scene.characterIds);
  for (const id of scene.characterIds) {
    const character = characters.get(id);
    if (
      !character?.active ||
      character.sceneAssignment.status !== "assigned" ||
      character.sceneAssignment.liveSceneId !== scene.liveSceneId ||
      character.sceneAssignment.sceneRevision !== scene.sceneRevision
    )
      return false;
  }
  for (const character of party.characters) {
    const assignment = character.sceneAssignment;
    if (
      character.active &&
      assignment.status === "assigned" &&
      assignment.liveSceneId === scene.liveSceneId &&
      (assignment.sceneRevision !== scene.sceneRevision ||
        !sceneCharacterIds.has(character.characterId))
    )
      return false;
  }
  for (const pending of scene.pendingAssignments) {
    const character = characters.get(pending.characterId);
    if (
      !character?.active ||
      character.sceneAssignment.status !== "pending" ||
      character.sceneAssignment.commandId !== pending.commandId ||
      character.sceneAssignment.ownerId !== pending.ownerId
    )
      return false;
  }
  return true;
}

export function projectLiveSession(
  partyValue: unknown,
  focus: FocusProjection,
  sceneResult?: LiveSceneProjectionResult,
): LiveSessionProjection {
  const party = parsePartyProjection(partyValue),
    common = {
      kind: "live-session-projection" as const,
      version: 1 as const,
      campaignId: focus.campaignId,
      partyRevision: party.partyRevision,
      focusRevision: focus.focusRevision,
    };
  if (party.campaignId !== focus.campaignId)
    return Object.freeze({ ...common, status: "unavailable" });
  if (focus.status !== "active")
    return Object.freeze({ ...common, status: focus.status });
  if (
    sceneResult?.status !== "active" ||
    sceneResult.projection.campaignId !== focus.campaignId ||
    sceneResult.projection.liveSceneId !== focus.liveSceneId ||
    sceneResult.projection.sceneRevision !== focus.sceneRevision ||
    !activeSceneMatchesParty(party, sceneResult.projection)
  )
    return Object.freeze({ ...common, status: "unavailable" });
  return Object.freeze({
    ...common,
    status: "active",
    scene: sceneResult.projection,
  });
}
