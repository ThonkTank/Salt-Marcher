import type {
  ClockReference,
  FocusSourceSnapshot,
  LiveSceneSourceSnapshot,
  PartyProjection,
} from "./contracts";
import {
  parseActivatePartyCharacterCommand,
  parseDeactivatePartyCharacterCommand,
  parseInitializeLiveSessionCommand,
  parseRejoinScenesCommand,
  parseMoveCharactersCommand,
  parsePrepareRuntimeCommand,
  parseSetFocusCommand,
  parseSplitSceneCommand,
  type AggregateCommandBinding,
  type ClockForkCreateContribution,
  type ClockMergeContribution,
} from "./commands";
import {
  revision,
  type CharacterId,
  type CommandDigest,
  type CommandId,
  type LiveSceneId,
  type OwnerId,
  type Revision,
} from "./ids";
import {
  parseLiveSessionAggregateState,
  type LiveSessionAggregateState,
  type RuntimeSceneState,
} from "./state";
import {
  buildReconciliationDuties,
  pendingCopy,
  reconciliationOwnerKey,
  type MaskOwnerDuty,
  type PendingConsumerReconciliation,
  type ReconciliationDuty,
  type ReconciliationTargetEndpoint,
} from "./mask-reconciliation";

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
  | "missing-clock"
  | "same-scene"
  | "invalid-membership"
  | "prepared-scene"
  | "unknown-character"
  | "already-active"
  | "already-inactive"
  | "focus-mismatch";

export type ConsumerReconciliationDuty = ReconciliationDuty;

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

export type SceneTransitionTarget =
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

export interface SceneTransitionDecision {
  readonly operation: "split" | "rejoin";
  readonly sourceSceneId: LiveSceneId;
  readonly sourceRevisionBefore: Revision;
  readonly sourceRevisionAfter: Revision;
  readonly sourceLifecycleBefore: "active";
  readonly sourceLifecycleAfter: "active" | "retired";
  readonly target: SceneTransitionTarget;
  readonly partyRevisionBefore: Revision;
  readonly partyRevisionAfter: Revision;
  readonly primaryBefore: LiveSceneId;
  readonly primaryAfter: LiveSceneId;
  readonly focusBefore: LiveSceneId | null;
  readonly focusAfter: LiveSceneId | null;
  readonly focusRevisionBefore: Revision;
  readonly focusRevisionAfter: Revision;
  readonly movedCharacterIds: readonly CharacterId[];
  readonly clockContribution:
    | ClockForkCreateContribution
    | ClockMergeContribution;
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
    | "character-deactivated"
    | "scene-split"
    | "scenes-rejoined";
  readonly partyRevisionBefore: Revision;
  readonly partyRevisionAfter: Revision;
  readonly focusRevisionBefore: Revision;
  readonly focusRevisionAfter: Revision;
  readonly sceneCleanup?: SceneCleanupDecision;
  readonly membership?: CharacterMembershipDecision;
  readonly transition?: SceneTransitionDecision;
}

export interface CharacterMembershipDecision {
  readonly characterId: CharacterId;
  readonly activeBefore: boolean;
  readonly activeAfter: boolean;
  readonly sourceSceneId: LiveSceneId | null;
  readonly sourceRevisionBefore: Revision | null;
  readonly sourceRevisionAfter: Revision | null;
  readonly targetSceneId: LiveSceneId | null;
  readonly primarySuccessorSceneId: LiveSceneId | null;
  readonly successorRevisionBefore: Revision | null;
  readonly successorRevisionAfter: Revision | null;
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
  transition?: SceneTransitionDecision,
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
      ...(transition === undefined ? {} : { transition }),
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
      maskParticipationProjections: [],
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
        scene.source.sceneClockRef.generationId ===
          command.sceneClockRef.generationId &&
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
      maskParticipationProjections: [],
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
    readonly target: ReconciliationTargetEndpoint;
    readonly expectedSourceRevision: Revision;
    readonly characterIds: readonly CharacterId[];
    readonly maskOwnerContributions: Parameters<
      typeof buildReconciliationDuties
    >[2];
  },
  source: LiveSceneSourceSnapshot,
  retired: boolean,
): readonly ConsumerReconciliationDuty[] {
  const selected = new Set(binding.characterIds),
    affectedCharacterIds = state.party.characters
      .filter((character) => selected.has(character.characterId))
      .map((character) => character.characterId);
  if (
    binding.maskOwnerContributions.some((contribution) =>
      state.scenes.some((scene) =>
        scene.source.reconciliations.some(
          (owner) =>
            owner.receiptId === contribution.receiptId ||
            owner.appliedReceipts?.some(
              (receipt) => receipt.receiptId === contribution.receiptId,
            ),
        ),
      ),
    )
  )
    throw new Error(
      "Maskenbeitrag verwendet eine bereits veröffentlichte ReceiptId.",
    );
  return buildReconciliationDuties(
    source,
    {
      campaignId: state.campaignId,
      commandId: binding.commandId,
      commandDigest: binding.commandDigest,
      partyRevisionBefore: state.party.partyRevision,
      partyRevisionAfter: revision(
        state.party.partyRevision + 1,
        "Reconciliation.partyRevisionAfter",
      ),
      sourceRevisionBefore: binding.expectedSourceRevision,
      sourceRevisionAfter: revision(
        binding.expectedSourceRevision + 1,
        "Reconciliation.sourceRevisionAfter",
      ),
      sourceLifecycleAfter: retired ? "retired" : "active",
      target: binding.target,
      affectedCharacterIds,
    },
    binding.maskOwnerContributions,
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
  if (target.sceneClockRef === undefined)
    return reject(state, command, "missing-clock");
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
              ...entry,
              status: "pending" as const,
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
        target: Object.freeze({
          kind: "existing" as const,
          liveSceneId: target.liveSceneId,
          revisionBefore: target.sceneRevision,
          revisionAfter: targetRevision,
        }),
        expectedSourceRevision: command.expectedSourceRevision,
        characterIds: command.characterIds,
        maskOwnerContributions: command.maskOwnerContributions,
      },
      source,
      retired,
    ),
    confirmedSource = sourceWithAppliedMaskContributions(nextSource, duties),
    reconciledSource = sourceWithPendingMaskOwners(
      confirmedSource,
      duties,
      command.commandId,
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
        ? sceneRaw(sourceScene, reconciledSource)
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
        ...pendingDuties(duties),
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

function sameOwnerReference(
  left: {
    readonly ownerId: OwnerId;
    readonly referenceId: string;
    readonly ownerRevision: Revision;
  },
  right: {
    readonly ownerId: OwnerId;
    readonly referenceId: string;
    readonly ownerRevision: Revision;
  },
): boolean {
  return (
    left.ownerId === right.ownerId &&
    left.referenceId === right.referenceId &&
    left.ownerRevision === right.ownerRevision
  );
}

function sameClockReference(
  left: ClockReference,
  right: ClockReference,
): boolean {
  return (
    sameOwnerReference(left, right) && left.generationId === right.generationId
  );
}

function sameClockIdentity(
  left: ClockReference,
  right: ClockReference,
): boolean {
  return (
    left.ownerId === right.ownerId &&
    left.generationId === right.generationId &&
    left.referenceId === right.referenceId
  );
}

function pendingDuties(
  duties: readonly ConsumerReconciliationDuty[],
): readonly PendingConsumerReconciliation[] {
  return Object.freeze(
    duties.flatMap((duty) =>
      duty.delivery === "pending" ? [pendingCopy(duty)] : [],
    ),
  );
}

function sourceWithAppliedMaskContributions(
  source: LiveSceneSourceSnapshot,
  duties: readonly ConsumerReconciliationDuty[],
): LiveSceneSourceSnapshot {
  const contributions = duties.flatMap((duty) =>
    duty.kind === "mask-owner-reconciliation" &&
    duty.preparedContribution !== undefined
      ? [duty.preparedContribution]
      : [],
  );
  if (contributions.length === 0) return source;
  const byOwner = new Map(
      contributions.map((contribution) => [
        `${contribution.ownerIdentity.ownerId}\u0000${contribution.ownerIdentity.generationId}`,
        contribution,
      ]),
    ),
    reconciliations = source.reconciliations.map((entry) => {
      if (entry.generationId === undefined) return entry;
      const contribution = byOwner.get(
        `${entry.ownerId}\u0000${entry.generationId}`,
      );
      return contribution === undefined
        ? entry
        : Object.freeze({
            ownerId: entry.ownerId,
            generationId: entry.generationId,
            status: "current" as const,
            ownerRevision: contribution.ownerRevisionAfter,
            commandId: contribution.commandId,
            commandDigest: contribution.commandDigest,
            receiptId: contribution.receiptId,
            appliedReceipts: Object.freeze([
              ...(entry.appliedReceipts ??
                (entry.receiptId !== undefined &&
                entry.commandId !== undefined &&
                entry.commandDigest !== undefined
                  ? [
                      Object.freeze({
                        receiptId: entry.receiptId,
                        commandId: entry.commandId,
                        commandDigest: entry.commandDigest,
                        ownerRevisionBefore: revision(
                          entry.ownerRevision! - 1,
                          "OwnerReconciliation.ownerRevisionBefore",
                        ),
                        ownerRevisionAfter: entry.ownerRevision!,
                      }),
                    ]
                  : [])),
              Object.freeze({
                receiptId: contribution.receiptId,
                commandId: contribution.commandId,
                commandDigest: contribution.commandDigest,
                ownerRevisionBefore: contribution.ownerRevisionBefore,
                ownerRevisionAfter: contribution.ownerRevisionAfter,
              }),
            ]),
          });
    });
  for (const contribution of contributions) {
    if (
      !reconciliations.some(
        (entry) =>
          entry.ownerId === contribution.ownerIdentity.ownerId &&
          entry.generationId === contribution.ownerIdentity.generationId,
      )
    )
      reconciliations.push(
        Object.freeze({
          ownerId: contribution.ownerIdentity.ownerId,
          generationId: contribution.ownerIdentity.generationId,
          status: "current" as const,
          ownerRevision: contribution.ownerRevisionAfter,
          commandId: contribution.commandId,
          commandDigest: contribution.commandDigest,
          receiptId: contribution.receiptId,
          appliedReceipts: Object.freeze([
            Object.freeze({
              receiptId: contribution.receiptId,
              commandId: contribution.commandId,
              commandDigest: contribution.commandDigest,
              ownerRevisionBefore: contribution.ownerRevisionBefore,
              ownerRevisionAfter: contribution.ownerRevisionAfter,
            }),
          ]),
        }),
      );
  }
  return Object.freeze({
    ...source,
    maskRefs: Object.freeze(
      source.maskRefs.map((mask) => {
        const contribution = byOwner.get(
            `${mask.ownerId}\u0000${mask.generationId}`,
          ),
          after = contribution?.afterMasks.find(
            (entry) => entry.maskId === mask.maskId,
          );
        return contribution === undefined || after === undefined
          ? mask
          : Object.freeze({
              ...mask,
              ownerRevision: contribution.ownerRevisionAfter,
              lifecycle: after.lifecycle,
            });
      }),
    ),
    maskParticipationProjections: Object.freeze(
      source.maskParticipationProjections.map((projection) => {
        const contribution = byOwner.get(
            `${projection.ownerIdentity.ownerId}\u0000${projection.ownerIdentity.generationId}`,
          ),
          after = contribution?.afterMasks.find(
            (entry) => entry.maskId === projection.maskId,
          );
        return contribution === undefined || after === undefined
          ? projection
          : Object.freeze({
              ...projection,
              ownerRevision: contribution.ownerRevisionAfter,
              participantCharacterIds: Object.freeze([
                ...after.participantCharacterIds,
              ]),
              lifecycle: after.lifecycle,
            });
      }),
    ),
    reconciliations: Object.freeze(reconciliations),
  });
}

function sourceWithPendingMaskOwners(
  source: LiveSceneSourceSnapshot,
  duties: readonly ConsumerReconciliationDuty[],
  commandId: CommandId,
): LiveSceneSourceSnapshot {
  const maskDuties = duties.filter(
    (duty): duty is MaskOwnerDuty =>
      duty.kind === "mask-owner-reconciliation" && duty.delivery === "pending",
  );
  if (maskDuties.length === 0) return source;
  const ownerKeys = new Set(maskDuties.map(reconciliationOwnerKey)),
    reconciliations = source.reconciliations.map((entry) => {
      if (entry.generationId === undefined) return entry;
      const key = `${entry.ownerId}\u0000${entry.generationId}`;
      return ownerKeys.has(key)
        ? Object.freeze({
            ownerId: entry.ownerId,
            generationId: entry.generationId,
            status: "pending" as const,
            ownerRevision: entry.ownerRevision!,
            commandId,
            pendingCommandIds: Object.freeze([
              ...(entry.status === "pending"
                ? (entry.pendingCommandIds ?? [entry.commandId!]).filter(
                    (pendingCommandId) => pendingCommandId !== commandId,
                  )
                : []),
              commandId,
            ]),
          })
        : entry;
    });
  for (const duty of maskDuties) {
    const key = reconciliationOwnerKey(duty);
    if (
      !reconciliations.some(
        (entry) =>
          entry.generationId !== undefined &&
          `${entry.ownerId}\u0000${entry.generationId}` === key,
      )
    )
      reconciliations.push(
        Object.freeze({
          ownerId: duty.ownerIdentity.ownerId,
          generationId: duty.ownerIdentity.generationId,
          status: "pending" as const,
          ownerRevision: duty.expectedOwnerRevision,
          commandId,
          pendingCommandIds: Object.freeze([commandId]),
        }),
      );
  }
  return Object.freeze({
    ...source,
    maskParticipationProjections: Object.freeze(
      source.maskParticipationProjections.filter(
        (projection) =>
          !ownerKeys.has(
            `${projection.ownerIdentity.ownerId}\u0000${projection.ownerIdentity.generationId}`,
          ),
      ),
    ),
    reconciliations: Object.freeze(reconciliations),
  });
}

export function splitScene(
  stateValue: unknown,
  commandValue: unknown,
): AggregateCommandResult {
  const state = parseLiveSessionAggregateState(stateValue),
    command = parseSplitSceneCommand(commandValue),
    blocked = commonRejection(state, command);
  if (blocked) return blocked;
  if (!state.primarySceneId) return reject(state, command, "not-initialized");
  if (command.sourceSceneId === command.targetSceneId)
    return reject(state, command, "same-scene");
  const sourceIndex = state.scenes.findIndex(
    (scene) => scene.source.liveSceneId === command.sourceSceneId,
  );
  if (sourceIndex < 0) return reject(state, command, "unknown-scene");
  if (
    state.scenes.some(
      (scene) => scene.source.liveSceneId === command.targetSceneId,
    )
  )
    return reject(state, command, "id-collision");
  const sourceScene = state.scenes[sourceIndex]!,
    source = sourceScene.source;
  if (source.lifecycle !== "active" || source.sceneClockRef === undefined)
    return reject(state, command, "inactive-scene");
  if (source.sceneRevision !== command.expectedSourceRevision)
    return reject(state, command, "stale-scene");
  if (
    state.scenes.some(
      (scene) =>
        scene.source.sceneClockRef !== undefined &&
        sameClockIdentity(scene.source.sceneClockRef, command.targetClockRef),
    )
  )
    return reject(state, command, "id-collision");
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
    targetRevision = revision(0),
    sourceCharacters = state.party.characters
      .filter(
        (character) =>
          source.characterIds.includes(character.characterId) &&
          !selected.has(character.characterId),
      )
      .map((character) => character.characterId),
    targetCharacters = state.party.characters
      .filter((character) => selected.has(character.characterId))
      .map((character) => character.characterId),
    retired =
      sourceCharacters.length === 0 && source.pendingAssignments.length === 0,
    contribution = command.clockContribution;
  if (
    contribution.campaignId !== state.campaignId ||
    contribution.commandId !== command.commandId ||
    contribution.commandDigest !== command.commandDigest ||
    contribution.sourceSceneId !== source.liveSceneId ||
    contribution.sourceSceneRevisionBefore !== source.sceneRevision ||
    contribution.sourceSceneRevisionAfter !== sourceRevision ||
    !sameClockReference(contribution.sourceClockRef, source.sceneClockRef) ||
    contribution.sourceClockRevisionAfter !==
      source.sceneClockRef.ownerRevision ||
    contribution.targetSceneId !== command.targetSceneId ||
    contribution.targetSceneRevisionAfter !== targetRevision ||
    !sameClockReference(
      contribution.targetClockRefAfter,
      command.targetClockRef,
    ) ||
    contribution.targetClockRevisionAfter !== 0 ||
    contribution.sourceDisposition !== (retired ? "archive" : "retain")
  )
    return reject(state, command, "stale-scene");

  const primaryAfter =
      source.primary && retired ? command.targetSceneId : state.primarySceneId,
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
              ...entry,
              status: "pending" as const,
              commandId: command.commandId,
            },
      ),
    },
    targetSource: LiveSceneSourceSnapshot = {
      kind: "live-scene-source",
      version: 1,
      campaignId: state.campaignId,
      liveSceneId: command.targetSceneId,
      sceneRevision: targetRevision,
      lifecycle: "active",
      primary: source.primary && retired,
      characterIds: targetCharacters,
      pendingAssignments: [],
      ...(source.locationRef === undefined
        ? {}
        : { locationRef: source.locationRef }),
      sceneClockRef: command.targetClockRef,
      groupRefs: [],
      maskRefs: [],
      maskParticipationProjections: [],
      reconciliations: [],
      contentPins: [],
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
      sceneId: command.targetSceneId,
      revision: targetRevision,
    });
  const party = partyWithAssignments(state.party, assignments),
    focusMoves =
      retired &&
      state.focus.status === "active" &&
      state.focus.liveSceneId === source.liveSceneId,
    focus: FocusSourceSnapshot = focusMoves
      ? {
          kind: "focus-source",
          version: 1,
          status: "active",
          campaignId: state.campaignId,
          focusRevision: nextRevision(
            state.focus.focusRevision,
            "FocusSource.focusRevision",
          ),
          liveSceneId: command.targetSceneId,
          sceneRevision: targetRevision,
        }
      : state.focus.status === "active" &&
          state.focus.liveSceneId === source.liveSceneId
        ? { ...state.focus, sceneRevision: sourceRevision }
        : state.focus,
    targetEndpoint = Object.freeze({
      kind: "created" as const,
      liveSceneId: command.targetSceneId,
      revisionAfter: targetRevision,
    }),
    duties = reconciliationDuties(
      state,
      {
        commandId: command.commandId,
        commandDigest: command.commandDigest,
        target: targetEndpoint,
        expectedSourceRevision: command.expectedSourceRevision,
        characterIds: targetCharacters,
        maskOwnerContributions: command.maskOwnerContributions,
      },
      source,
      retired,
    ),
    confirmedSource = sourceWithAppliedMaskContributions(nextSource, duties),
    reconciledSource = sourceWithPendingMaskOwners(
      confirmedSource,
      duties,
      command.commandId,
    ),
    scenes = [
      ...state.scenes.map((scene, index) =>
        index === sourceIndex ? sceneRaw(sourceScene, reconciledSource) : scene,
      ),
      {
        kind: "runtime-scene-state" as const,
        version: 1 as const,
        source: targetSource,
        title: command.title,
        notes: "",
      },
    ],
    next = parseLiveSessionAggregateState({
      ...state,
      party,
      focus,
      primarySceneId: primaryAfter,
      scenes,
      pendingReconciliations: [
        ...state.pendingReconciliations,
        ...pendingDuties(duties),
      ],
    }),
    transition = Object.freeze({
      operation: "split" as const,
      sourceSceneId: source.liveSceneId,
      sourceRevisionBefore: source.sceneRevision,
      sourceRevisionAfter: sourceRevision,
      sourceLifecycleBefore: "active" as const,
      sourceLifecycleAfter: retired
        ? ("retired" as const)
        : ("active" as const),
      target: targetEndpoint,
      partyRevisionBefore: state.party.partyRevision,
      partyRevisionAfter: next.party.partyRevision,
      primaryBefore: state.primarySceneId,
      primaryAfter: next.primarySceneId!,
      focusBefore: focusId(state.focus),
      focusAfter: focusId(next.focus),
      focusRevisionBefore: state.focus.focusRevision,
      focusRevisionAfter: next.focus.focusRevision,
      movedCharacterIds: Object.freeze([...targetCharacters]),
      clockContribution: contribution,
      reconciliations: duties,
    });
  return applied(
    next,
    command,
    "scene-split",
    state.party.partyRevision,
    state.focus.focusRevision,
    undefined,
    undefined,
    transition,
  );
}

export function rejoinScenes(
  stateValue: unknown,
  commandValue: unknown,
): AggregateCommandResult {
  const state = parseLiveSessionAggregateState(stateValue),
    command = parseRejoinScenesCommand(commandValue),
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
    target.lifecycle !== "active" ||
    source.sceneClockRef === undefined ||
    target.sceneClockRef === undefined
  )
    return reject(state, command, "inactive-scene");
  if (
    source.sceneRevision !== command.expectedSourceRevision ||
    target.sceneRevision !== command.expectedTargetRevision
  )
    return reject(state, command, "stale-scene");
  if (source.pendingAssignments.length > 0 || source.characterIds.length === 0)
    return reject(state, command, "invalid-membership");
  const sourceMembership = new Set(source.characterIds),
    movedCharacterIds = state.party.characters
      .filter((character) => sourceMembership.has(character.characterId))
      .map((character) => character.characterId);
  if (
    movedCharacterIds.length !== source.characterIds.length ||
    movedCharacterIds.some((id) => {
      const character = state.party.characters.find(
        (entry) => entry.characterId === id,
      );
      return (
        !character?.active ||
        character.sceneAssignment.status !== "assigned" ||
        character.sceneAssignment.liveSceneId !== source.liveSceneId ||
        character.sceneAssignment.sceneRevision !== source.sceneRevision
      );
    })
  )
    return reject(state, command, "invalid-membership");
  const sourceRevision = nextRevision(
      source.sceneRevision,
      "Source.sceneRevision",
    ),
    targetRevision = nextRevision(target.sceneRevision, "Target.sceneRevision"),
    contribution = command.clockContribution;
  if (
    contribution.campaignId !== state.campaignId ||
    contribution.commandId !== command.commandId ||
    contribution.commandDigest !== command.commandDigest ||
    contribution.sourceSceneId !== source.liveSceneId ||
    contribution.sourceSceneRevisionBefore !== source.sceneRevision ||
    contribution.sourceSceneRevisionAfter !== sourceRevision ||
    !sameClockReference(contribution.sourceClockRef, source.sceneClockRef) ||
    contribution.sourceClockRevisionAfter !==
      source.sceneClockRef.ownerRevision ||
    contribution.targetSceneId !== target.liveSceneId ||
    contribution.targetSceneRevisionBefore !== target.sceneRevision ||
    contribution.targetSceneRevisionAfter !== targetRevision ||
    !sameClockReference(
      contribution.targetClockRefBefore,
      target.sceneClockRef,
    ) ||
    contribution.targetClockRevisionBefore !==
      target.sceneClockRef.ownerRevision ||
    contribution.targetClockRefAfter.referenceId !==
      target.sceneClockRef.referenceId ||
    contribution.targetClockRefAfter.ownerId !== target.sceneClockRef.ownerId ||
    contribution.targetClockRefAfter.generationId !==
      target.sceneClockRef.generationId ||
    contribution.targetClockRevisionAfter !==
      target.sceneClockRef.ownerRevision + 1 ||
    contribution.sourceDisposition !== "archive"
  )
    return reject(state, command, "stale-scene");

  const targetMembership = new Set([
      ...target.characterIds,
      ...movedCharacterIds,
    ]),
    targetCharacters = state.party.characters
      .filter((character) => targetMembership.has(character.characterId))
      .map((character) => character.characterId),
    primaryAfter = source.primary ? target.liveSceneId : state.primarySceneId,
    nextSource: LiveSceneSourceSnapshot = {
      ...source,
      sceneRevision: sourceRevision,
      lifecycle: "retired",
      primary: false,
      characterIds: [],
      reconciliations: source.reconciliations.map((entry) =>
        entry.status === "current"
          ? entry
          : {
              ...entry,
              status: "pending" as const,
              commandId: command.commandId,
            },
      ),
    },
    nextTarget: LiveSceneSourceSnapshot = {
      ...target,
      sceneRevision: targetRevision,
      primary: target.primary || source.primary,
      characterIds: targetCharacters,
      sceneClockRef: contribution.targetClockRefAfter,
    },
    assignments = new Map<
      CharacterId,
      { sceneId: LiveSceneId; revision: Revision }
    >(
      targetCharacters.map((id) => [
        id,
        { sceneId: target.liveSceneId, revision: targetRevision },
      ]),
    );
  const party = partyWithAssignments(state.party, assignments),
    focusMoves =
      state.focus.status === "active" &&
      state.focus.liveSceneId === source.liveSceneId,
    focus: FocusSourceSnapshot = focusMoves
      ? {
          kind: "focus-source",
          version: 1,
          status: "active",
          campaignId: state.campaignId,
          focusRevision: nextRevision(
            state.focus.focusRevision,
            "FocusSource.focusRevision",
          ),
          liveSceneId: target.liveSceneId,
          sceneRevision: targetRevision,
        }
      : state.focus.status === "active" &&
          state.focus.liveSceneId === target.liveSceneId
        ? { ...state.focus, sceneRevision: targetRevision }
        : state.focus,
    targetEndpoint = Object.freeze({
      kind: "existing" as const,
      liveSceneId: target.liveSceneId,
      revisionBefore: target.sceneRevision,
      revisionAfter: targetRevision,
    }),
    duties = reconciliationDuties(
      state,
      {
        commandId: command.commandId,
        commandDigest: command.commandDigest,
        target: targetEndpoint,
        expectedSourceRevision: command.expectedSourceRevision,
        characterIds: movedCharacterIds,
        maskOwnerContributions: command.maskOwnerContributions,
      },
      source,
      true,
    ),
    confirmedSource = sourceWithAppliedMaskContributions(nextSource, duties),
    reconciledSource = sourceWithPendingMaskOwners(
      confirmedSource,
      duties,
      command.commandId,
    ),
    scenes = state.scenes.map((scene, index) =>
      index === sourceIndex
        ? sceneRaw(sourceScene, reconciledSource)
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
        ...pendingDuties(duties),
      ],
    }),
    transition = Object.freeze({
      operation: "rejoin" as const,
      sourceSceneId: source.liveSceneId,
      sourceRevisionBefore: source.sceneRevision,
      sourceRevisionAfter: sourceRevision,
      sourceLifecycleBefore: "active" as const,
      sourceLifecycleAfter: "retired" as const,
      target: targetEndpoint,
      partyRevisionBefore: state.party.partyRevision,
      partyRevisionAfter: next.party.partyRevision,
      primaryBefore: state.primarySceneId,
      primaryAfter: next.primarySceneId!,
      focusBefore: focusId(state.focus),
      focusAfter: focusId(next.focus),
      focusRevisionBefore: state.focus.focusRevision,
      focusRevisionAfter: next.focus.focusRevision,
      movedCharacterIds: Object.freeze([...movedCharacterIds]),
      clockContribution: contribution,
      reconciliations: duties,
    });
  return applied(
    next,
    command,
    "scenes-rejoined",
    state.party.partyRevision,
    state.focus.focusRevision,
    undefined,
    undefined,
    transition,
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
        sourceRevisionBefore: null,
        sourceRevisionAfter: null,
        targetSceneId: null,
        primarySuccessorSceneId: null,
        successorRevisionBefore: null,
        successorRevisionAfter: null,
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
      sourceRevisionBefore: null,
      sourceRevisionAfter: null,
      targetSceneId: target.liveSceneId,
      primarySuccessorSceneId: null,
      successorRevisionBefore: null,
      successorRevisionAfter: null,
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
      command.expectedSourceRevision !== undefined ||
      command.primarySuccessorSceneId !== undefined ||
      command.expectedSuccessorRevision !== undefined
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
        sourceRevisionBefore: null,
        sourceRevisionAfter: null,
        targetSceneId: null,
        primarySuccessorSceneId: null,
        successorRevisionBefore: null,
        successorRevisionAfter: null,
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

  if (command.expectedSourceRevision === undefined)
    return reject(state, command, "invalid-membership");
  const assignment = character.sceneAssignment,
    sourceIndex =
      assignment.status === "assigned"
        ? state.scenes.findIndex(
            (scene) => scene.source.liveSceneId === assignment.liveSceneId,
          )
        : assignment.status === "pending"
          ? state.scenes.findIndex(
              (scene) =>
                scene.source.lifecycle === "active" &&
                scene.source.pendingAssignments.some(
                  (pending) =>
                    pending.characterId === command.characterId &&
                    pending.commandId === assignment.commandId &&
                    pending.ownerId === assignment.ownerId,
                ),
            )
          : -1;
  if (sourceIndex < 0) return reject(state, command, "unknown-scene");
  const sourceScene = state.scenes[sourceIndex]!,
    source = sourceScene.source;
  if (source.lifecycle !== "active")
    return reject(state, command, "inactive-scene");
  if (source.sceneRevision !== command.expectedSourceRevision)
    return reject(state, command, "stale-scene");
  if (
    (assignment.status === "assigned" &&
      (assignment.sceneRevision !== source.sceneRevision ||
        !source.characterIds.includes(command.characterId))) ||
    (assignment.status === "pending" &&
      !source.pendingAssignments.some(
        (pending) =>
          pending.characterId === command.characterId &&
          pending.commandId === assignment.commandId &&
          pending.ownerId === assignment.ownerId,
      )) ||
    (assignment.status !== "assigned" && assignment.status !== "pending")
  )
    return reject(state, command, "invalid-membership");

  const sourceCharacters = source.characterIds.filter(
      (id) => id !== command.characterId,
    ),
    sourcePendingAssignments = source.pendingAssignments.filter(
      (pending) => pending.characterId !== command.characterId,
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
      sourceCharacters.length === 0 && sourcePendingAssignments.length === 0,
    retired = empty && (!source.primary || populatedCandidates.length > 0),
    focusedSceneId = focusId(state.focus),
    focusedCandidate =
      focusedSceneId !== null && focusedSceneId !== source.liveSceneId
        ? populatedCandidates.find(
            ({ scene }) => scene.source.liveSceneId === focusedSceneId,
          )
        : undefined,
    firstPartyCandidate = state.party.characters
      .filter(
        (entry) => entry.active && entry.characterId !== command.characterId,
      )
      .map((entry) => {
        const candidateAssignment = entry.sceneAssignment;
        if (candidateAssignment.status === "assigned")
          return populatedCandidates.find(
            ({ scene }) =>
              scene.source.liveSceneId === candidateAssignment.liveSceneId,
          );
        if (candidateAssignment.status === "pending")
          return populatedCandidates.find(({ scene }) =>
            scene.source.pendingAssignments.some(
              (pending) =>
                pending.characterId === entry.characterId &&
                pending.commandId === candidateAssignment.commandId &&
                pending.ownerId === candidateAssignment.ownerId,
            ),
          );
        return undefined;
      })
      .find((candidate) => candidate !== undefined),
    successor =
      source.primary && retired
        ? (focusedCandidate ?? firstPartyCandidate)
        : undefined;
  if (
    successor === undefined
      ? command.primarySuccessorSceneId !== undefined ||
        command.expectedSuccessorRevision !== undefined
      : command.primarySuccessorSceneId !==
          successor.scene.source.liveSceneId ||
        command.expectedSuccessorRevision !==
          successor.scene.source.sceneRevision
  )
    return reject(state, command, "stale-scene");
  const sourceRevision = nextRevision(
      source.sceneRevision,
      "Source.sceneRevision",
    ),
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
      pendingAssignments: sourcePendingAssignments,
      reconciliations: source.reconciliations.map((entry) =>
        entry.status === "current"
          ? entry
          : {
              ...entry,
              status: "pending" as const,
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
        target: Object.freeze({ kind: "none" as const }),
        expectedSourceRevision: command.expectedSourceRevision,
        characterIds: [command.characterId],
        maskOwnerContributions: command.maskOwnerContributions,
      },
      source,
      retired,
    ),
    confirmedSource = sourceWithAppliedMaskContributions(nextSource, duties),
    reconciledSource = sourceWithPendingMaskOwners(
      confirmedSource,
      duties,
      command.commandId,
    ),
    scenes = state.scenes.map((scene, index) =>
      index === sourceIndex
        ? sceneRaw(sourceScene, reconciledSource)
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
        ...pendingDuties(duties),
      ],
    }),
    membership = Object.freeze({
      characterId: command.characterId,
      activeBefore: true,
      activeAfter: false,
      sourceSceneId: source.liveSceneId,
      sourceRevisionBefore: source.sceneRevision,
      sourceRevisionAfter: nextSource.sceneRevision,
      targetSceneId: null,
      primarySuccessorSceneId: nextSuccessor?.liveSceneId ?? null,
      successorRevisionBefore: successor?.scene.source.sceneRevision ?? null,
      successorRevisionAfter: nextSuccessor?.sceneRevision ?? null,
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
