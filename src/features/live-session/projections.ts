import {
  parseFocusSource,
  parseLiveSceneSource,
  parsePartyProjection,
  type ClockReference,
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
import { campaignId, commandId, liveSceneId, ownerId, revision } from "./ids";

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
  readonly sceneClockRef?: ClockReference;
  readonly groupRefs: readonly OwnerReference[];
  readonly maskRefs: readonly MaskReference[];
  readonly reconciliations: readonly OwnerReconciliation[];
  readonly contentPins: readonly OwnerReference[];
}

export type LiveSceneProjectionResult =
  | { readonly status: "active"; readonly projection: LiveSceneProjection }
  | {
      readonly status: "unavailable";
      readonly reason: "invalid-scene" | "foreign-scene" | "inactive-scene";
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

function record(
  value: unknown,
  required: readonly string[],
  optional: readonly string[] = [],
  label = "Wert",
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`${label} muss ein Objekt sein.`);
  const result = value as Record<string, unknown>,
    prototype = Object.getPrototypeOf(result),
    keys = Reflect.ownKeys(result),
    allowed = new Set([...required, ...optional]);
  if (
    (prototype !== Object.prototype && prototype !== null) ||
    required.some((key) => !Object.hasOwn(result, key)) ||
    keys.some((key) => typeof key !== "string" || !allowed.has(key)) ||
    Object.values(Object.getOwnPropertyDescriptors(result)).some(
      (descriptor) => !Object.hasOwn(descriptor, "value"),
    )
  )
    throw new Error(
      `${label} enthält unbekannte, berechnete oder unvollständige Daten.`,
    );
  return result;
}

function parseFocusProjection(value: unknown): FocusProjection {
  const base = record(
    value,
    ["kind", "version", "status", "campaignId", "focusRevision", "liveSceneId"],
    ["sceneRevision", "commandId", "reason", "ownerId"],
    "FocusProjection",
  );
  if (base.kind !== "focus-projection" || base.version !== 1)
    throw new Error("FocusProjection besitzt einen unbekannten Vertrag.");
  const common = {
    kind: "focus-projection" as const,
    version: 1 as const,
    campaignId: campaignId(base.campaignId, "FocusProjection.campaignId"),
    focusRevision: revision(
      base.focusRevision,
      "FocusProjection.focusRevision",
    ),
  };
  if (base.status === "active") {
    const row = record(
      value,
      [
        "kind",
        "version",
        "status",
        "campaignId",
        "focusRevision",
        "liveSceneId",
        "sceneRevision",
      ],
      [],
      "FocusProjection",
    );
    return Object.freeze({
      ...common,
      status: "active",
      liveSceneId: liveSceneId(row.liveSceneId, "FocusProjection.liveSceneId"),
      sceneRevision: revision(
        row.sceneRevision,
        "FocusProjection.sceneRevision",
      ),
    });
  }
  if (base.status === "none") {
    record(
      value,
      [
        "kind",
        "version",
        "status",
        "campaignId",
        "focusRevision",
        "liveSceneId",
      ],
      [],
      "FocusProjection",
    );
    if (base.liveSceneId !== null)
      throw new Error("FocusProjection.none darf keine LiveScene tragen.");
    return Object.freeze({ ...common, status: "none", liveSceneId: null });
  }
  if (base.status === "pending") {
    const row = record(
      value,
      [
        "kind",
        "version",
        "status",
        "campaignId",
        "focusRevision",
        "liveSceneId",
        "commandId",
      ],
      [],
      "FocusProjection",
    );
    if (row.liveSceneId !== null)
      throw new Error("FocusProjection.pending darf keine LiveScene tragen.");
    return Object.freeze({
      ...common,
      status: "pending",
      liveSceneId: null,
      commandId: commandId(row.commandId, "FocusProjection.commandId"),
    });
  }
  if (base.status === "unavailable") {
    const row = record(
      value,
      [
        "kind",
        "version",
        "status",
        "campaignId",
        "focusRevision",
        "liveSceneId",
        "reason",
      ],
      ["ownerId"],
      "FocusProjection",
    );
    if (
      row.liveSceneId !== null ||
      !(
        [
          "owner-unavailable",
          "missing-scene",
          "invalid-scene",
          "foreign-scene",
          "stale-scene",
          "inactive-scene",
        ] as const
      ).includes(row.reason as never)
    )
      throw new Error("FocusProjection.unavailable ist widersprüchlich.");
    return Object.freeze({
      ...common,
      status: "unavailable",
      liveSceneId: null,
      reason: row.reason as FocusUnavailableReason,
      ...(row.ownerId === undefined
        ? {}
        : { ownerId: ownerId(row.ownerId, "FocusProjection.ownerId") }),
    });
  }
  throw new Error("FocusProjection.status ist unbekannt.");
}

function parseLiveSceneProjection(value: unknown): LiveSceneProjection {
  const row = record(
      value,
      [
        "kind",
        "version",
        "campaignId",
        "liveSceneId",
        "sceneRevision",
        "primary",
        "focus",
        "characterIds",
        "pendingAssignments",
        "groupRefs",
        "maskRefs",
        "reconciliations",
        "contentPins",
      ],
      ["locationRef", "sceneClockRef"],
      "LiveSceneProjection",
    ),
    focusBase = record(
      row.focus,
      ["status"],
      ["focusRevision"],
      "LiveSceneProjection.focus",
    );
  if (row.kind !== "live-scene-projection" || row.version !== 1)
    throw new Error("LiveSceneProjection besitzt einen unbekannten Vertrag.");
  const focus =
      focusBase.status === "focused"
        ? (() => {
            const focused = record(
              row.focus,
              ["status", "focusRevision"],
              [],
              "LiveSceneProjection.focus",
            );
            return Object.freeze({
              status: "focused" as const,
              focusRevision: revision(
                focused.focusRevision,
                "LiveSceneProjection.focus.focusRevision",
              ),
            });
          })()
        : focusBase.status === "not-focused"
          ? (() => {
              record(row.focus, ["status"], [], "LiveSceneProjection.focus");
              return Object.freeze({ status: "not-focused" as const });
            })()
          : (() => {
              throw new Error(
                "LiveSceneProjection.focus.status ist unbekannt.",
              );
            })(),
    source = parseLiveSceneSource({
      kind: "live-scene-source",
      version: 1,
      campaignId: row.campaignId,
      liveSceneId: row.liveSceneId,
      sceneRevision: row.sceneRevision,
      lifecycle: "active",
      primary: row.primary,
      characterIds: row.characterIds,
      pendingAssignments: row.pendingAssignments,
      ...(row.locationRef === undefined
        ? {}
        : { locationRef: row.locationRef }),
      ...(row.sceneClockRef === undefined
        ? {}
        : { sceneClockRef: row.sceneClockRef }),
      groupRefs: row.groupRefs,
      maskRefs: row.maskRefs,
      reconciliations: row.reconciliations,
      contentPins: row.contentPins,
    });
  return Object.freeze({
    kind: "live-scene-projection",
    version: 1,
    campaignId: source.campaignId,
    liveSceneId: source.liveSceneId,
    sceneRevision: source.sceneRevision,
    primary: source.primary,
    focus,
    characterIds: source.characterIds,
    pendingAssignments: source.pendingAssignments,
    ...(source.locationRef === undefined
      ? {}
      : { locationRef: source.locationRef }),
    ...(source.sceneClockRef === undefined
      ? {}
      : { sceneClockRef: source.sceneClockRef }),
    groupRefs: source.groupRefs,
    maskRefs: source.maskRefs,
    reconciliations: source.reconciliations,
    contentPins: source.contentPins,
  });
}

function parseLiveSceneProjectionResult(
  value: unknown,
): LiveSceneProjectionResult {
  const base = record(
    value,
    ["status"],
    ["projection", "reason"],
    "LiveSceneProjectionResult",
  );
  if (base.status === "active") {
    const row = record(
      value,
      ["status", "projection"],
      [],
      "LiveSceneProjectionResult",
    );
    return Object.freeze({
      status: "active",
      projection: parseLiveSceneProjection(row.projection),
    });
  }
  if (base.status === "unavailable") {
    const row = record(
      value,
      ["status", "reason"],
      [],
      "LiveSceneProjectionResult",
    );
    if (
      !(["invalid-scene", "foreign-scene", "inactive-scene"] as const).includes(
        row.reason as never,
      )
    )
      throw new Error("LiveSceneProjectionResult.reason ist unbekannt.");
    return Object.freeze({
      status: "unavailable",
      reason: row.reason as
        | "invalid-scene"
        | "foreign-scene"
        | "inactive-scene",
    });
  }
  throw new Error("LiveSceneProjectionResult.status ist unbekannt.");
}

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
  focusValue: unknown,
): LiveSceneProjectionResult {
  const focus = parseFocusProjection(focusValue);
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
    ),
    sceneCharacterIds = new Set(scene.characterIds);
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
    if (character.active && assignment.status === "not-started") return false;
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
  focusValue: unknown,
  sceneResultValue?: unknown,
): LiveSessionProjection {
  const party = parsePartyProjection(partyValue),
    focus = parseFocusProjection(focusValue),
    sceneResult =
      sceneResultValue === undefined
        ? undefined
        : parseLiveSceneProjectionResult(sceneResultValue),
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
    sceneResult.projection.focus.status !== "focused" ||
    sceneResult.projection.focus.focusRevision !== focus.focusRevision ||
    !activeSceneMatchesParty(party, sceneResult.projection)
  )
    return Object.freeze({ ...common, status: "unavailable" });
  return Object.freeze({
    ...common,
    status: "active",
    scene: sceneResult.projection,
  });
}
