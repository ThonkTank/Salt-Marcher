import type {
  FocusSourceSnapshot,
  LiveSceneSourceSnapshot,
  OwnerReconciliation,
  PartyProjection,
} from "./contracts";
import {
  parseActivatePartyCharacterCommand,
  parseDeactivatePartyCharacterCommand,
  parseInitializeLiveSessionCommand,
  parseMoveCharactersCommand,
  parsePrepareRuntimeCommand,
  parseSetFocusCommand,
  type AggregateCommandBinding,
} from "./commands";
import {
  revision,
  type CharacterId,
  type CommandDigest,
  type CommandId,
  type LiveSceneId,
  type MaskId,
  type OwnerId,
  type Revision,
} from "./ids";
import {
  parseLiveSessionAggregateState,
  type LiveSessionAggregateState,
  type PendingConsumerReconciliation,
  type RuntimeSceneState,
} from "./state";

export type AggregateRejectionReason =
  | "cancelled"
  | "foreign-campaign"
  | "stale-party"
  | "stale-focus"
  | "already-initialized"
  | "not-initialized"
  | "id-collision"
  | "unknown-scene"
  | "stale-scene"
  | "inactive-scene"
  | "same-scene"
  | "invalid-membership"
  | "prepared-scene"
  | "unknown-character"
  | "already-active"
  | "already-inactive"
  | "focus-mismatch";

export type ConsumerReconciliationDuty = Readonly<
  Omit<PendingConsumerReconciliation, "status"> & {
    readonly status: "required" | "pending";
  }
>;

export interface SceneCleanupDecision {
  readonly sourceSceneId: LiveSceneId;
  readonly targetSceneId: LiveSceneId;
  readonly sourceRevisionBefore: Revision;
  readonly sourceRevisionAfter: Revision;
  readonly targetRevisionBefore: Revision;
  readonly targetRevisionAfter: Revision;
  readonly sourceLifecycleBefore: "active";
  readonly sourceLifecycleAfter: "active" | "retired";
  readonly primaryBefore: LiveSceneId;
  readonly primaryAfter: LiveSceneId;
  readonly focusBefore: LiveSceneId | null;
  readonly focusAfter: LiveSceneId | null;
  readonly focusRevisionBefore: Revision;
  readonly focusRevisionAfter: Revision;
  readonly movedCharacterIds: readonly CharacterId[];
  readonly reconciliations: readonly ConsumerReconciliationDuty[];
}

export interface AggregateAppliedDecision {
  readonly campaignId: LiveSessionAggregateState["campaignId"];
  readonly commandId: CommandId;
  readonly commandDigest: CommandDigest;
  readonly kind:
    | "initialized"
    | "prepared-runtime-created"
    | "characters-moved"
    | "focus-changed"
    | "character-activated"
    | "character-deactivated";
  readonly partyRevisionBefore: Revision;
  readonly partyRevisionAfter: Revision;
  readonly focusRevisionBefore: Revision;
  readonly focusRevisionAfter: Revision;
  readonly sceneCleanup?: SceneCleanupDecision;
  readonly membership?: CharacterMembershipDecision;
}

export interface CharacterMembershipDecision {
  readonly characterId: CharacterId;
  readonly activeBefore: boolean;
  readonly activeAfter: boolean;
  readonly sourceSceneId: LiveSceneId | null;
  readonly targetSceneId: LiveSceneId | null;
  readonly primaryBefore: LiveSceneId | null;
  readonly primaryAfter: LiveSceneId | null;
  readonly focusBefore: LiveSceneId | null;
  readonly focusAfter: LiveSceneId | null;
  readonly focusRevisionBefore: Revision;
  readonly focusRevisionAfter: Revision;
  readonly sourceLifecycleAfter?: "active" | "retired";
  readonly reconciliations: readonly ConsumerReconciliationDuty[];
}

export type AggregateCommandResult =
  | {
      readonly status: "applied";
      readonly state: LiveSessionAggregateState;
      readonly decision: AggregateAppliedDecision;
    }
  | {
      readonly status: "rejected" | "cancelled";
      readonly state: LiveSessionAggregateState;
      readonly commandId: CommandId;
      readonly commandDigest: CommandDigest;
      readonly reason: AggregateRejectionReason;
    };

function nextRevision(value: Revision, label: string): Revision {
  return revision(value + 1, label);
}

function reject(
  state: LiveSessionAggregateState,
  command: AggregateCommandBinding,
  reason: AggregateRejectionReason,
): AggregateCommandResult {
  return Object.freeze({
    status: reason === "cancelled" ? "cancelled" : "rejected",
    state,
    commandId: command.commandId,
    commandDigest: command.commandDigest,
    reason,
  });
}

function commonRejection(
  state: LiveSessionAggregateState,
  command: AggregateCommandBinding,
): AggregateCommandResult | undefined {
  if (command.cancelled) return reject(state, command, "cancelled");
  if (command.campaignId !== state.campaignId)
    return reject(state, command, "foreign-campaign");
  if (command.expectedPartyRevision !== state.party.partyRevision)
    return reject(state, command, "stale-party");
  if (command.expectedFocusRevision !== state.focus.focusRevision)
    return reject(state, command, "stale-focus");
  return undefined;
}

function applied(
  state: LiveSessionAggregateState,
  command: AggregateCommandBinding,
  kind: AggregateAppliedDecision["kind"],
  partyBefore: Revision,
  focusBefore: Revision,
  sceneCleanup?: SceneCleanupDecision,
  membership?: CharacterMembershipDecision,
): AggregateCommandResult {
  return Object.freeze({
    status: "applied",
    state,
    decision: Object.freeze({
      campaignId: state.campaignId,
      commandId: command.commandId,
      commandDigest: command.commandDigest,
      kind,
      partyRevisionBefore: partyBefore,
      partyRevisionAfter: state.party.partyRevision,
      focusRevisionBefore: focusBefore,
      focusRevisionAfter: state.focus.focusRevision,
      ...(sceneCleanup === undefined ? {} : { sceneCleanup }),
      ...(membership === undefined ? {} : { membership }),
    }),
  });
}

function sceneRaw(scene: RuntimeSceneState, source: LiveSceneSourceSnapshot) {
  return {
    ...scene,
    source,
  };
}

function partyWithAssignments(
  party: PartyProjection,
  assignments: ReadonlyMap<
    CharacterId,
    { sceneId: LiveSceneId; revision: Revision }
  >,
): PartyProjection {
  return {
    ...party,
    partyRevision: nextRevision(
      party.partyRevision,
      "PartyProjection.partyRevision",
    ),
    characters: party.characters.map((character) => {
      const assignment = assignments.get(character.characterId);
      return assignment === undefined
        ? character
        : {
            ...character,
            sceneAssignment: {
              status: "assigned" as const,
              liveSceneId: assignment.sceneId,
              sceneRevision: assignment.revision,
            },
          };
    }),
  };
}

export function initializeLiveSession(
  stateValue: unknown,
  commandValue: unknown,
): AggregateCommandResult {
  const state = parseLiveSessionAggregateState(stateValue),
    command = parseInitializeLiveSessionCommand(commandValue),
    blocked = commonRejection(state, command);
  if (blocked) return blocked;
  if (state.scenes.some((scene) => scene.source.lifecycle === "active"))
    return reject(state, command, "already-initialized");
  if (
    state.scenes.some(
      (scene) => scene.source.liveSceneId === command.primarySceneId,
    )
  )
    return reject(state, command, "id-collision");
  if (
    state.party.characters.some(
      (character) =>
        character.active && character.sceneAssignment.status !== "not-started",
    )
  )
    return reject(state, command, "invalid-membership");
  const partyRevision = nextRevision(
      state.party.partyRevision,
      "PartyProjection.partyRevision",
    ),
    sceneRevision = revision(0),
    characterIds = Object.freeze(
      state.party.characters
        .filter((character) => character.active)
        .map((character) => character.characterId),
    ),
    party = {
      ...state.party,
      partyRevision,
      characters: state.party.characters.map((character) =>
        character.active
          ? {
              ...character,
              sceneAssignment: {
                status: "assigned" as const,
                liveSceneId: command.primarySceneId,
                sceneRevision,
              },
            }
          : character,
      ),
    },
    focusRevision = nextRevision(
      state.focus.focusRevision,
      "FocusSource.focusRevision",
    ),
    source = {
      kind: "live-scene-source",
      version: 1,
      campaignId: state.campaignId,
      liveSceneId: command.primarySceneId,
      sceneRevision,
      lifecycle: "active",
      primary: true,
      characterIds,
      pendingAssignments: [],
      sceneClockRef: command.sceneClockRef,
      groupRefs: [],
      maskRefs: [],
      reconciliations: [],
      contentPins: [],
    },
    next = parseLiveSessionAggregateState({
      ...state,
      party,
      focus: {
        kind: "focus-source",
        version: 1,
        status: "active",
        campaignId: state.campaignId,
        focusRevision,
        liveSceneId: command.primarySceneId,
        sceneRevision,
      },
      primarySceneId: command.primarySceneId,
      scenes: [
        ...state.scenes,
        {
          kind: "runtime-scene-state",
          version: 1,
          source,
          title: command.title,
          notes: command.notes,
        },
      ],
    });
  return applied(
    next,
    command,
    "initialized",
    state.party.partyRevision,
    state.focus.focusRevision,
  );
}

export function createPreparedRuntime(
  stateValue: unknown,
  commandValue: unknown,
): AggregateCommandResult {
  const state = parseLiveSessionAggregateState(stateValue),
    command = parsePrepareRuntimeCommand(commandValue),
    blocked = commonRejection(state, command);
  if (blocked) return blocked;
  if (!state.primarySceneId) return reject(state, command, "not-initialized");
  if (command.snapshot.campaignId !== state.campaignId)
    return reject(state, command, "foreign-campaign");
  if (
    state.scenes.some(
      (scene) => scene.source.liveSceneId === command.liveSceneId,
    )
  )
    return reject(state, command, "id-collision");
  if (
    state.scenes.some(
      (scene) =>
        scene.source.sceneClockRef?.ownerId === command.sceneClockRef.ownerId &&
        scene.source.sceneClockRef.referenceId ===
          command.sceneClockRef.referenceId,
    )
  )
    return reject(state, command, "id-collision");
  const source = {
      kind: "live-scene-source",
      version: 1,
      campaignId: state.campaignId,
      liveSceneId: command.liveSceneId,
      sceneRevision: revision(0),
      lifecycle: "prepared",
      primary: false,
      characterIds: [],
      pendingAssignments: [],
      ...(command.snapshot.locationRef === undefined
        ? {}
        : { locationRef: command.snapshot.locationRef }),
      sceneClockRef: command.sceneClockRef,
      groupRefs: [],
      maskRefs: [],
      reconciliations: [],
      contentPins: command.snapshot.contentPins,
    },
    next = parseLiveSessionAggregateState({
      ...state,
      scenes: [
        ...state.scenes,
        {
          kind: "runtime-scene-state",
          version: 1,
          source,
          title: command.snapshot.title,
          notes: command.snapshot.notes,
          preparedFrom: command.snapshot,
          ...(command.snapshot.encounterPlanRef === undefined
            ? {}
            : { encounterPlanRef: command.snapshot.encounterPlanRef }),
        },
      ],
    });
  return applied(
    next,
    command,
    "prepared-runtime-created",
    state.party.partyRevision,
    state.focus.focusRevision,
  );
}

function focusId(focus: FocusSourceSnapshot): LiveSceneId | null {
  return focus.status === "active" ? focus.liveSceneId : null;
}

function reconciliationDuties(
  state: LiveSessionAggregateState,
  binding: {
    readonly commandId: CommandId;
    readonly commandDigest: CommandDigest;
    readonly targetSceneId: LiveSceneId | null;
    readonly expectedSourceRevision: Revision;
    readonly expectedTargetRevision: Revision | null;
    readonly characterIds: readonly CharacterId[];
  },
  source: LiveSceneSourceSnapshot,
  retired: boolean,
): readonly ConsumerReconciliationDuty[] {
  const ownerStates = new Map<
    OwnerId,
    {
      status: OwnerReconciliation["status"];
      ownerRevision?: Revision;
      maskIds: MaskId[];
    }
  >();
  for (const entry of source.reconciliations) {
    ownerStates.set(entry.ownerId, {
      status: entry.status,
      ...(entry.ownerRevision === undefined
        ? {}
        : { ownerRevision: entry.ownerRevision }),
      maskIds: [],
    });
  }
  for (const mask of source.maskRefs) {
    const owner = ownerStates.get(mask.ownerId);
    if (owner) {
      owner.ownerRevision ??= mask.ownerRevision;
      owner.maskIds.push(mask.maskId);
    } else {
      ownerStates.set(mask.ownerId, {
        status: "current",
        ownerRevision: mask.ownerRevision,
        maskIds: [mask.maskId],
      });
    }
  }
  return Object.freeze(
    [...ownerStates.entries()].map(([ownerId, owner]) => {
      if (owner.ownerRevision === undefined)
        throw new Error(
          "Consumer-Pflicht besitzt keine gebundene OwnerRevision.",
        );
      return Object.freeze({
        ownerId,
        campaignId: state.campaignId,
        commandId: binding.commandId,
        commandDigest: binding.commandDigest,
        sourceSceneId: source.liveSceneId,
        targetSceneId: binding.targetSceneId,
        expectedSourceRevision: binding.expectedSourceRevision,
        expectedTargetRevision: binding.expectedTargetRevision,
        expectedOwnerRevision: owner.ownerRevision,
        sourceLifecycleBefore: "active" as const,
        sourceLifecycleAfter: retired
          ? ("retired" as const)
          : ("active" as const),
        action: retired
          ? ("archive-source" as const)
          : ("remove-participants" as const),
        characterIds: Object.freeze([...binding.characterIds]),
        maskIds: Object.freeze([...owner.maskIds]),
        status:
          owner.status === "current"
            ? ("required" as const)
            : ("pending" as const),
      });
    }),
  );
}

export function moveCharacters(
  stateValue: unknown,
  commandValue: unknown,
): AggregateCommandResult {
  const state = parseLiveSessionAggregateState(stateValue),
    command = parseMoveCharactersCommand(commandValue),
    blocked = commonRejection(state, command);
  if (blocked) return blocked;
  if (!state.primarySceneId) return reject(state, command, "not-initialized");
  if (command.sourceSceneId === command.targetSceneId)
    return reject(state, command, "same-scene");
  const sourceIndex = state.scenes.findIndex(
      (scene) => scene.source.liveSceneId === command.sourceSceneId,
    ),
    targetIndex = state.scenes.findIndex(
      (scene) => scene.source.liveSceneId === command.targetSceneId,
    );
  if (sourceIndex < 0 || targetIndex < 0)
    return reject(state, command, "unknown-scene");
  const sourceScene = state.scenes[sourceIndex]!,
    targetScene = state.scenes[targetIndex]!,
    source = sourceScene.source,
    target = targetScene.source;
  if (
    source.lifecycle !== "active" ||
    !["active", "prepared"].includes(target.lifecycle)
  )
    return reject(state, command, "inactive-scene");
  if (
    source.sceneRevision !== command.expectedSourceRevision ||
    target.sceneRevision !== command.expectedTargetRevision
  )
    return reject(state, command, "stale-scene");
  const selected = new Set(command.characterIds),
    partyById = new Map(
      state.party.characters.map((character) => [
        character.characterId,
        character,
      ]),
    );
  if (
    command.characterIds.some((id) => {
      const character = partyById.get(id);
      return (
        !character?.active ||
        character.sceneAssignment.status !== "assigned" ||
        character.sceneAssignment.liveSceneId !== source.liveSceneId ||
        character.sceneAssignment.sceneRevision !== source.sceneRevision ||
        !source.characterIds.includes(id)
      );
    })
  )
    return reject(state, command, "invalid-membership");

  const sourceRevision = nextRevision(
      source.sceneRevision,
      "Source.sceneRevision",
    ),
    targetRevision = nextRevision(target.sceneRevision, "Target.sceneRevision"),
    sourceCharacters = source.characterIds.filter((id) => !selected.has(id)),
    targetMembership = new Set([
      ...target.characterIds,
      ...command.characterIds,
    ]),
    targetCharacters = state.party.characters
      .filter((character) => targetMembership.has(character.characterId))
      .map((character) => character.characterId),
    retired =
      sourceCharacters.length === 0 && source.pendingAssignments.length === 0,
    focusBefore = focusId(state.focus),
    focusChanges =
      retired &&
      state.focus.status === "active" &&
      (state.focus.liveSceneId === source.liveSceneId ||
        state.focus.liveSceneId === target.liveSceneId),
    focusRevision = focusChanges
      ? nextRevision(state.focus.focusRevision, "FocusSource.focusRevision")
      : state.focus.focusRevision,
    primaryAfter =
      source.primary && retired ? target.liveSceneId : state.primarySceneId,
    nextSource: LiveSceneSourceSnapshot = {
      ...source,
      sceneRevision: sourceRevision,
      lifecycle: retired ? "retired" : "active",
      primary: retired ? false : source.primary,
      characterIds: sourceCharacters,
      reconciliations: source.reconciliations.map((entry) =>
        entry.status === "current"
          ? entry
          : {
              ownerId: entry.ownerId,
              status: "pending" as const,
              ...(entry.ownerRevision === undefined
                ? {}
                : { ownerRevision: entry.ownerRevision }),
              commandId: command.commandId,
            },
      ),
    },
    nextTarget: LiveSceneSourceSnapshot = {
      ...target,
      sceneRevision: targetRevision,
      lifecycle: "active",
      primary: target.primary || (source.primary && retired),
      characterIds: targetCharacters,
    },
    assignments = new Map<
      CharacterId,
      { sceneId: LiveSceneId; revision: Revision }
    >();
  for (const id of sourceCharacters)
    assignments.set(id, {
      sceneId: source.liveSceneId,
      revision: sourceRevision,
    });
  for (const id of targetCharacters)
    assignments.set(id, {
      sceneId: target.liveSceneId,
      revision: targetRevision,
    });
  const party = partyWithAssignments(state.party, assignments),
    focus: FocusSourceSnapshot = focusChanges
      ? {
          kind: "focus-source",
          version: 1,
          status: "active",
          campaignId: state.campaignId,
          focusRevision,
          liveSceneId: target.liveSceneId,
          sceneRevision: targetRevision,
        }
      : state.focus.status === "active" &&
          state.focus.liveSceneId === source.liveSceneId
        ? {
            ...state.focus,
            sceneRevision: sourceRevision,
          }
        : state.focus.status === "active" &&
            state.focus.liveSceneId === target.liveSceneId
          ? {
              ...state.focus,
              sceneRevision: targetRevision,
            }
          : state.focus,
    duties = reconciliationDuties(
      state,
      {
        commandId: command.commandId,
        commandDigest: command.commandDigest,
        targetSceneId: target.liveSceneId,
        expectedSourceRevision: command.expectedSourceRevision,
        expectedTargetRevision: command.expectedTargetRevision,
        characterIds: command.characterIds,
      },
      source,
      retired,
    ),
    cleanup = Object.freeze({
      sourceSceneId: source.liveSceneId,
      targetSceneId: target.liveSceneId,
      sourceRevisionBefore: source.sceneRevision,
      sourceRevisionAfter: sourceRevision,
      targetRevisionBefore: target.sceneRevision,
      targetRevisionAfter: targetRevision,
      sourceLifecycleBefore: "active" as const,
      sourceLifecycleAfter: retired
        ? ("retired" as const)
        : ("active" as const),
      primaryBefore: state.primarySceneId,
      primaryAfter,
      focusBefore,
      focusAfter: focusId(focus),
      focusRevisionBefore: state.focus.focusRevision,
      focusRevisionAfter: focus.focusRevision,
      movedCharacterIds: Object.freeze([...command.characterIds]),
      reconciliations: duties,
    }),
    scenes = state.scenes.map((scene, index) =>
      index === sourceIndex
        ? sceneRaw(sourceScene, nextSource)
        : index === targetIndex
          ? sceneRaw(targetScene, nextTarget)
          : scene,
    ),
    next = parseLiveSessionAggregateState({
      ...state,
      party,
      focus,
      primarySceneId: primaryAfter,
      scenes,
      pendingReconciliations: [
        ...state.pendingReconciliations,
        ...duties.filter(
          (duty): duty is PendingConsumerReconciliation =>
            duty.status === "pending",
        ),
      ],
    });
  return applied(
    next,
    command,
    "characters-moved",
    state.party.partyRevision,
    state.focus.focusRevision,
    cleanup,
  );
}

export function activatePartyCharacter(
  stateValue: unknown,
  commandValue: unknown,
): AggregateCommandResult {
  const state = parseLiveSessionAggregateState(stateValue),
    command = parseActivatePartyCharacterCommand(commandValue),
    blocked = commonRejection(state, command);
  if (blocked) return blocked;
  const character = state.party.characters.find(
    (entry) => entry.characterId === command.characterId,
  );
  if (!character) return reject(state, command, "unknown-character");
  if (character.active) return reject(state, command, "already-active");

  if (state.primarySceneId === null) {
    if (command.targetSceneId !== undefined)
      return reject(state, command, "focus-mismatch");
    const party = {
        ...state.party,
        partyRevision: nextRevision(
          state.party.partyRevision,
          "PartyProjection.partyRevision",
        ),
        characters: state.party.characters.map((entry) =>
          entry.characterId === command.characterId
            ? {
                ...entry,
                active: true,
                sceneAssignment: { status: "not-started" as const },
              }
            : entry,
        ),
      },
      next = parseLiveSessionAggregateState({ ...state, party }),
      membership = Object.freeze({
        characterId: command.characterId,
        activeBefore: false,
        activeAfter: true,
        sourceSceneId: null,
        targetSceneId: null,
        primaryBefore: null,
        primaryAfter: null,
        focusBefore: focusId(state.focus),
        focusAfter: focusId(next.focus),
        focusRevisionBefore: state.focus.focusRevision,
        focusRevisionAfter: next.focus.focusRevision,
        reconciliations: Object.freeze([]),
      });
    return applied(
      next,
      command,
      "character-activated",
      state.party.partyRevision,
      state.focus.focusRevision,
      undefined,
      membership,
    );
  }

  if (
    state.focus.status !== "active" ||
    command.targetSceneId === undefined ||
    command.expectedTargetRevision === undefined ||
    command.targetSceneId !== state.focus.liveSceneId ||
    command.expectedTargetRevision !== state.focus.sceneRevision
  )
    return reject(state, command, "focus-mismatch");
  const targetIndex = state.scenes.findIndex(
    (scene) => scene.source.liveSceneId === command.targetSceneId,
  );
  if (targetIndex < 0) return reject(state, command, "unknown-scene");
  const targetScene = state.scenes[targetIndex]!,
    target = targetScene.source;
  if (target.lifecycle !== "active")
    return reject(state, command, "inactive-scene");
  if (target.sceneRevision !== command.expectedTargetRevision)
    return reject(state, command, "stale-scene");
  const targetRevision = nextRevision(
      target.sceneRevision,
      "Target.sceneRevision",
    ),
    targetMembership = new Set([...target.characterIds, command.characterId]),
    characterIds = state.party.characters
      .filter((entry) => targetMembership.has(entry.characterId))
      .map((entry) => entry.characterId),
    nextTarget: LiveSceneSourceSnapshot = {
      ...target,
      sceneRevision: targetRevision,
      characterIds,
    },
    assignments = new Map<
      CharacterId,
      { sceneId: LiveSceneId; revision: Revision }
    >(
      characterIds.map((id) => [
        id,
        { sceneId: target.liveSceneId, revision: targetRevision },
      ]),
    ),
    assignedParty = partyWithAssignments(state.party, assignments),
    party = {
      ...assignedParty,
      characters: assignedParty.characters.map((entry) =>
        entry.characterId === command.characterId
          ? { ...entry, active: true }
          : entry,
      ),
    },
    focus: FocusSourceSnapshot = {
      ...state.focus,
      sceneRevision: targetRevision,
    },
    scenes = state.scenes.map((scene, index) =>
      index === targetIndex ? sceneRaw(targetScene, nextTarget) : scene,
    ),
    next = parseLiveSessionAggregateState({ ...state, party, focus, scenes }),
    membership = Object.freeze({
      characterId: command.characterId,
      activeBefore: false,
      activeAfter: true,
      sourceSceneId: null,
      targetSceneId: target.liveSceneId,
      primaryBefore: state.primarySceneId,
      primaryAfter: next.primarySceneId,
      focusBefore: focusId(state.focus),
      focusAfter: focusId(next.focus),
      focusRevisionBefore: state.focus.focusRevision,
      focusRevisionAfter: next.focus.focusRevision,
      reconciliations: Object.freeze([]),
    });
  return applied(
    next,
    command,
    "character-activated",
    state.party.partyRevision,
    state.focus.focusRevision,
    undefined,
    membership,
  );
}

export function deactivatePartyCharacter(
  stateValue: unknown,
  commandValue: unknown,
): AggregateCommandResult {
  const state = parseLiveSessionAggregateState(stateValue),
    command = parseDeactivatePartyCharacterCommand(commandValue),
    blocked = commonRejection(state, command);
  if (blocked) return blocked;
  const character = state.party.characters.find(
    (entry) => entry.characterId === command.characterId,
  );
  if (!character) return reject(state, command, "unknown-character");
  if (!character.active) return reject(state, command, "already-inactive");

  if (state.primarySceneId === null) {
    if (
      character.sceneAssignment.status !== "not-started" ||
      command.expectedSourceRevision !== undefined
    )
      return reject(state, command, "invalid-membership");
    const party = {
        ...state.party,
        partyRevision: nextRevision(
          state.party.partyRevision,
          "PartyProjection.partyRevision",
        ),
        characters: state.party.characters.map((entry) =>
          entry.characterId === command.characterId
            ? {
                ...entry,
                active: false,
                sceneAssignment: { status: "inactive" as const },
              }
            : entry,
        ),
      },
      next = parseLiveSessionAggregateState({ ...state, party }),
      membership = Object.freeze({
        characterId: command.characterId,
        activeBefore: true,
        activeAfter: false,
        sourceSceneId: null,
        targetSceneId: null,
        primaryBefore: null,
        primaryAfter: null,
        focusBefore: focusId(state.focus),
        focusAfter: focusId(next.focus),
        focusRevisionBefore: state.focus.focusRevision,
        focusRevisionAfter: next.focus.focusRevision,
        reconciliations: Object.freeze([]),
      });
    return applied(
      next,
      command,
      "character-deactivated",
      state.party.partyRevision,
      state.focus.focusRevision,
      undefined,
      membership,
    );
  }

  if (
    character.sceneAssignment.status !== "assigned" ||
    command.expectedSourceRevision === undefined
  )
    return reject(state, command, "invalid-membership");
  const assignment = character.sceneAssignment;
  const sourceIndex = state.scenes.findIndex(
    (scene) => scene.source.liveSceneId === assignment.liveSceneId,
  );
  if (sourceIndex < 0) return reject(state, command, "unknown-scene");
  const sourceScene = state.scenes[sourceIndex]!,
    source = sourceScene.source;
  if (source.lifecycle !== "active")
    return reject(state, command, "inactive-scene");
  if (
    source.sceneRevision !== command.expectedSourceRevision ||
    assignment.sceneRevision !== source.sceneRevision
  )
    return reject(state, command, "stale-scene");
  if (!source.characterIds.includes(command.characterId))
    return reject(state, command, "invalid-membership");

  const sourceRevision = nextRevision(
      source.sceneRevision,
      "Source.sceneRevision",
    ),
    sourceCharacters = source.characterIds.filter(
      (id) => id !== command.characterId,
    ),
    populatedCandidates = state.scenes
      .map((scene, index) => ({ scene, index }))
      .filter(
        ({ scene, index }) =>
          index !== sourceIndex &&
          scene.source.lifecycle === "active" &&
          (scene.source.characterIds.length > 0 ||
            scene.source.pendingAssignments.length > 0),
      ),
    empty =
      sourceCharacters.length === 0 && source.pendingAssignments.length === 0,
    retired = empty && (!source.primary || populatedCandidates.length > 0),
    successor = source.primary && retired ? populatedCandidates[0] : undefined,
    successorRevision = successor
      ? nextRevision(
          successor.scene.source.sceneRevision,
          "Successor.sceneRevision",
        )
      : undefined,
    primaryAfter = successor
      ? successor.scene.source.liveSceneId
      : state.primarySceneId,
    nextSource: LiveSceneSourceSnapshot = {
      ...source,
      sceneRevision: sourceRevision,
      lifecycle: retired ? "retired" : "active",
      primary: retired ? false : source.primary,
      characterIds: sourceCharacters,
      reconciliations: source.reconciliations.map((entry) =>
        entry.status === "current"
          ? entry
          : {
              ownerId: entry.ownerId,
              status: "pending" as const,
              ...(entry.ownerRevision === undefined
                ? {}
                : { ownerRevision: entry.ownerRevision }),
              commandId: command.commandId,
            },
      ),
    },
    nextSuccessor = successor
      ? {
          ...successor.scene.source,
          sceneRevision: successorRevision!,
          primary: true,
        }
      : undefined,
    assignments = new Map<
      CharacterId,
      { sceneId: LiveSceneId; revision: Revision }
    >();
  for (const id of sourceCharacters)
    assignments.set(id, {
      sceneId: source.liveSceneId,
      revision: sourceRevision,
    });
  if (successor && nextSuccessor)
    for (const id of nextSuccessor.characterIds)
      assignments.set(id, {
        sceneId: nextSuccessor.liveSceneId,
        revision: nextSuccessor.sceneRevision,
      });
  const assignedParty = partyWithAssignments(state.party, assignments),
    party = {
      ...assignedParty,
      characters: assignedParty.characters.map((entry) =>
        entry.characterId === command.characterId
          ? {
              ...entry,
              active: false,
              sceneAssignment: { status: "inactive" as const },
            }
          : entry,
      ),
    },
    focusMoves =
      retired &&
      state.focus.status === "active" &&
      state.focus.liveSceneId === source.liveSceneId,
    focusRevision = focusMoves
      ? nextRevision(state.focus.focusRevision, "FocusSource.focusRevision")
      : state.focus.focusRevision,
    focusTarget = focusMoves
      ? state.scenes.find((scene) => scene.source.liveSceneId === primaryAfter)
          ?.source
      : undefined,
    focus: FocusSourceSnapshot = focusMoves
      ? {
          kind: "focus-source",
          version: 1,
          status: "active",
          campaignId: state.campaignId,
          focusRevision,
          liveSceneId: primaryAfter!,
          sceneRevision:
            nextSuccessor?.liveSceneId === primaryAfter
              ? nextSuccessor.sceneRevision
              : focusTarget!.sceneRevision,
        }
      : state.focus.status === "active" &&
          state.focus.liveSceneId === source.liveSceneId
        ? { ...state.focus, sceneRevision: sourceRevision }
        : state.focus.status === "active" &&
            nextSuccessor?.liveSceneId === state.focus.liveSceneId
          ? { ...state.focus, sceneRevision: nextSuccessor.sceneRevision }
          : state.focus,
    duties = reconciliationDuties(
      state,
      {
        commandId: command.commandId,
        commandDigest: command.commandDigest,
        targetSceneId: null,
        expectedSourceRevision: command.expectedSourceRevision,
        expectedTargetRevision: null,
        characterIds: [command.characterId],
      },
      source,
      retired,
    ),
    scenes = state.scenes.map((scene, index) =>
      index === sourceIndex
        ? sceneRaw(sourceScene, nextSource)
        : successor && index === successor.index && nextSuccessor
          ? sceneRaw(successor.scene, nextSuccessor)
          : scene,
    ),
    next = parseLiveSessionAggregateState({
      ...state,
      party,
      focus,
      primarySceneId: primaryAfter,
      scenes,
      pendingReconciliations: [
        ...state.pendingReconciliations,
        ...duties.filter(
          (duty): duty is PendingConsumerReconciliation =>
            duty.status === "pending",
        ),
      ],
    }),
    membership = Object.freeze({
      characterId: command.characterId,
      activeBefore: true,
      activeAfter: false,
      sourceSceneId: source.liveSceneId,
      targetSceneId: null,
      primaryBefore: state.primarySceneId,
      primaryAfter: next.primarySceneId,
      focusBefore: focusId(state.focus),
      focusAfter: focusId(next.focus),
      focusRevisionBefore: state.focus.focusRevision,
      focusRevisionAfter: next.focus.focusRevision,
      sourceLifecycleAfter: nextSource.lifecycle as "active" | "retired",
      reconciliations: duties,
    });
  return applied(
    next,
    command,
    "character-deactivated",
    state.party.partyRevision,
    state.focus.focusRevision,
    undefined,
    membership,
  );
}

export function setFocus(
  stateValue: unknown,
  commandValue: unknown,
): AggregateCommandResult {
  const state = parseLiveSessionAggregateState(stateValue),
    command = parseSetFocusCommand(commandValue),
    blocked = commonRejection(state, command);
  if (blocked) return blocked;
  let focus: FocusSourceSnapshot;
  if (command.targetSceneId === null) {
    focus = {
      kind: "focus-source",
      version: 1,
      status: "none",
      campaignId: state.campaignId,
      focusRevision: nextRevision(
        state.focus.focusRevision,
        "FocusSource.focusRevision",
      ),
    };
  } else {
    const target = state.scenes.find(
      (scene) => scene.source.liveSceneId === command.targetSceneId,
    )?.source;
    if (!target) return reject(state, command, "unknown-scene");
    if (target.lifecycle === "prepared")
      return reject(state, command, "prepared-scene");
    if (target.lifecycle !== "active")
      return reject(state, command, "inactive-scene");
    if (target.sceneRevision !== command.expectedTargetRevision)
      return reject(state, command, "stale-scene");
    focus = {
      kind: "focus-source",
      version: 1,
      status: "active",
      campaignId: state.campaignId,
      focusRevision: nextRevision(
        state.focus.focusRevision,
        "FocusSource.focusRevision",
      ),
      liveSceneId: target.liveSceneId,
      sceneRevision: target.sceneRevision,
    };
  }
  const next = parseLiveSessionAggregateState({ ...state, focus });
  return applied(
    next,
    command,
    "focus-changed",
    state.party.partyRevision,
    state.focus.focusRevision,
  );
}
