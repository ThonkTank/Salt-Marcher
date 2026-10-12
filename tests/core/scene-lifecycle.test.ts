import assert from "node:assert/strict";
import test from "node:test";
import {
  activatePartyCharacter,
  createPreparedRuntime,
  createUninitializedLiveSessionState,
  deactivatePartyCharacter,
  initializeLiveSession,
  moveCharacters,
  parseClockForkCreateContribution,
  parseClockMergeContribution,
  parseLiveSessionAggregateState,
  rejoinScenes,
  setFocus,
  splitScene,
} from "../../src/features/live-session";

function frozenGraph(value: unknown, seen = new Set<object>()): boolean {
  if (!value || typeof value !== "object" || seen.has(value)) return true;
  seen.add(value);
  return (
    Object.isFrozen(value) &&
    Object.values(value).every((child) => frozenGraph(child, seen))
  );
}

function partyBeforeSession() {
  return {
    kind: "party-projection",
    version: 1,
    campaignId: "campaign-a",
    partyRevision: 0,
    characters: [
      {
        characterId: "character-a",
        active: true,
        profile: { name: "Alex" },
        progress: {
          currentXp: 10,
          xpSinceLongRest: 10,
          xpSinceShortRest: 0,
        },
        sceneAssignment: { status: "not-started" },
      },
      {
        characterId: "character-b",
        active: true,
        profile: { name: "Alex" },
        progress: {
          currentXp: 20,
          xpSinceLongRest: 0,
          xpSinceShortRest: 0,
        },
        sceneAssignment: { status: "not-started" },
      },
      {
        characterId: "character-c",
        active: false,
        profile: { name: "Casey" },
        progress: {
          currentXp: 0,
          xpSinceLongRest: 0,
          xpSinceShortRest: 0,
        },
        sceneAssignment: { status: "inactive" },
      },
    ],
  };
}

function commandBase(kind: string, overrides: Record<string, unknown> = {}) {
  const usesMaskContributions = [
    "move-characters",
    "split-scene",
    "rejoin-scenes",
    "deactivate-party-character",
  ].includes(kind);
  return {
    kind,
    version: 1,
    campaignId: "campaign-a",
    commandId: `command-${kind}`,
    commandDigest: `digest-${kind}`,
    expectedPartyRevision: 0,
    expectedFocusRevision: 0,
    cancelled: false,
    ...(usesMaskContributions ? { maskOwnerContributions: [] } : {}),
    ...overrides,
  };
}

function initialize() {
  const state = createUninitializedLiveSessionState(partyBeforeSession()),
    result = initializeLiveSession(
      state,
      commandBase("initialize-live-session", {
        primarySceneId: "scene-primary",
        sceneClockRef: {
          ownerId: "clock",
          generationId: "clock-generation",
          referenceId: "clock-primary",
          ownerRevision: 0,
        },
        title: "Primary",
        notes: "",
      }),
    );
  assert.equal(result.status, "applied");
  if (result.status !== "applied") throw new Error("initialization failed");
  return result.state;
}

function preparationSnapshot() {
  return {
    kind: "preparation-snapshot",
    version: 1,
    campaignId: "campaign-a",
    preparationId: "preparation-a",
    preparationRevision: 4,
    source: {
      ownerId: "planner",
      sourceId: "plan-a",
      sourceRevision: 7,
    },
    title: "Prepared ruins",
    notes: "Keep exact notes.",
    locationRef: {
      ownerId: "locations",
      referenceId: "ruins",
      ownerRevision: 3,
    },
    contentPins: [
      { ownerId: "notes", referenceId: "note-a", ownerRevision: 2 },
    ],
    encounterPlanRef: {
      ownerId: "encounters",
      referenceId: "plan-encounter-a",
      ownerRevision: 5,
    },
  };
}

function prepare(state = initialize()) {
  const snapshot = preparationSnapshot(),
    result = createPreparedRuntime(
      state,
      commandBase("prepare-runtime", {
        commandId: "command-prepare",
        commandDigest: "digest-prepare",
        expectedPartyRevision: state.party.partyRevision,
        expectedFocusRevision: state.focus.focusRevision,
        liveSceneId: "scene-prepared",
        sceneClockRef: {
          ownerId: "clock",
          generationId: "clock-generation",
          referenceId: "clock-prepared",
          ownerRevision: 0,
        },
        snapshot,
      }),
    );
  assert.equal(result.status, "applied");
  if (result.status !== "applied") throw new Error("preparation failed");
  snapshot.notes = "mutated";
  snapshot.contentPins[0]!.referenceId = "mutated";
  return result.state;
}

function clockValue(canonicalValue = "3600") {
  return {
    codecId: "smr07.elapsed-seconds",
    codecVersion: 1,
    canonicalValue,
  };
}

function calendarDefinitionRef() {
  return {
    ownerId: "clock",
    referenceId: "calendar-a",
    ownerRevision: 3,
  };
}

function clockRef(referenceId: string, ownerRevision = 0) {
  return {
    ownerId: "clock",
    generationId: "clock-generation",
    referenceId,
    ownerRevision,
  };
}

function forkContribution(overrides: Record<string, unknown> = {}) {
  return {
    kind: "clock-fork-create-contribution",
    version: 1,
    status: "prepared-unpublished",
    receiptId: "receipt-clock-fork",
    campaignId: "campaign-a",
    commandId: "command-split-scene",
    commandDigest: "digest-split-scene",
    ownerIdentity: {
      ownerId: "clock",
      generationId: "clock-generation",
    },
    calendarDefinitionRef: calendarDefinitionRef(),
    sourceSceneId: "scene-primary",
    sourceSceneRevisionBefore: 0,
    sourceSceneRevisionAfter: 1,
    sourceClockRef: clockRef("clock-primary"),
    sourceClockValue: clockValue(),
    sourceClockRevisionAfter: 0,
    targetSceneId: "scene-split",
    targetSceneRevisionAfter: 0,
    targetClockRefAfter: clockRef("clock-split"),
    targetClockRevisionAfter: 0,
    targetClockValueAfter: clockValue(),
    sourceDisposition: "retain",
    targetKind: "created",
    choice: "source-confirmed",
    ...overrides,
  };
}

function splitPrimary(overrides: Record<string, unknown> = {}) {
  const state = initialize(),
    result = splitScene(
      state,
      commandBase("split-scene", {
        expectedPartyRevision: 1,
        expectedFocusRevision: 1,
        sourceSceneId: "scene-primary",
        expectedSourceRevision: 0,
        targetSceneId: "scene-split",
        targetClockRef: clockRef("clock-split"),
        characterIds: ["character-b"],
        title: "Scout group",
        clockContribution: forkContribution(),
        ...overrides,
      }),
    );
  assert.equal(result.status, "applied");
  if (result.status !== "applied") throw new Error("split failed");
  return result.state;
}

function mergeContribution(overrides: Record<string, unknown> = {}) {
  return {
    kind: "clock-merge-contribution",
    version: 1,
    status: "prepared-unpublished",
    receiptId: "receipt-clock-merge",
    campaignId: "campaign-a",
    commandId: "command-rejoin-scenes",
    commandDigest: "digest-rejoin-scenes",
    ownerIdentity: {
      ownerId: "clock",
      generationId: "clock-generation",
    },
    calendarDefinitionRef: calendarDefinitionRef(),
    sourceSceneId: "scene-primary",
    sourceSceneRevisionBefore: 1,
    sourceSceneRevisionAfter: 2,
    sourceClockRef: clockRef("clock-primary"),
    sourceClockValue: clockValue(),
    sourceClockRevisionAfter: 0,
    targetSceneId: "scene-split",
    targetSceneRevisionBefore: 0,
    targetSceneRevisionAfter: 1,
    targetClockRefBefore: clockRef("clock-split"),
    targetClockRevisionBefore: 0,
    targetClockValueBefore: clockValue(),
    targetClockRefAfter: clockRef("clock-split", 1),
    targetClockRevisionAfter: 1,
    targetClockValueAfter: clockValue("-6"),
    sourceDisposition: "archive",
    targetKind: "existing",
    choice: "manual-confirmed",
    ...overrides,
  };
}

function threePopulatedScenes() {
  const party = structuredClone(partyBeforeSession()) as Record<string, any>;
  party.characters[2].active = true;
  party.characters[2].sceneAssignment = { status: "not-started" };
  const uninitialized = createUninitializedLiveSessionState(party),
    initialized = initializeLiveSession(
      uninitialized,
      commandBase("initialize-live-session", {
        primarySceneId: "scene-primary",
        sceneClockRef: {
          ownerId: "clock",
          generationId: "clock-generation",
          referenceId: "clock-primary",
          ownerRevision: 0,
        },
        title: "Primary",
        notes: "",
      }),
    );
  assert.equal(initialized.status, "applied");
  if (initialized.status !== "applied")
    throw new Error("initialization failed");
  const withSecond = prepare(initialized.state),
    movedSecond = moveCharacters(
      withSecond,
      commandBase("move-characters", {
        commandId: "command-move-b-to-second",
        commandDigest: "digest-move-b-to-second",
        expectedPartyRevision: 1,
        expectedFocusRevision: 1,
        sourceSceneId: "scene-primary",
        targetSceneId: "scene-prepared",
        expectedSourceRevision: 0,
        expectedTargetRevision: 0,
        characterIds: ["character-b"],
      }),
    );
  assert.equal(movedSecond.status, "applied");
  if (movedSecond.status !== "applied") throw new Error("second move failed");
  const thirdSnapshot = structuredClone(preparationSnapshot());
  thirdSnapshot.preparationId = "preparation-third";
  thirdSnapshot.source.sourceId = "plan-third";
  thirdSnapshot.title = "Third";
  const preparedThird = createPreparedRuntime(
    movedSecond.state,
    commandBase("prepare-runtime", {
      commandId: "command-prepare-third",
      commandDigest: "digest-prepare-third",
      expectedPartyRevision: 2,
      expectedFocusRevision: 1,
      liveSceneId: "scene-third",
      sceneClockRef: {
        ownerId: "clock",
        generationId: "clock-generation",
        referenceId: "clock-third",
        ownerRevision: 0,
      },
      snapshot: thirdSnapshot,
    }),
  );
  assert.equal(preparedThird.status, "applied");
  if (preparedThird.status !== "applied")
    throw new Error("third prepare failed");
  const movedThird = moveCharacters(
    preparedThird.state,
    commandBase("move-characters", {
      commandId: "command-move-c-to-third",
      commandDigest: "digest-move-c-to-third",
      expectedPartyRevision: 2,
      expectedFocusRevision: 1,
      sourceSceneId: "scene-primary",
      targetSceneId: "scene-third",
      expectedSourceRevision: 1,
      expectedTargetRevision: 0,
      characterIds: ["character-c"],
    }),
  );
  assert.equal(movedThird.status, "applied");
  if (movedThird.status !== "applied") throw new Error("third move failed");
  return movedThird.state;
}

test("explicit initialization creates one Primary, Focus and ordered membership atomically", () => {
  const before = createUninitializedLiveSessionState(partyBeforeSession()),
    result = initializeLiveSession(
      before,
      commandBase("initialize-live-session", {
        primarySceneId: "scene-primary",
        sceneClockRef: {
          ownerId: "clock",
          generationId: "clock-generation",
          referenceId: "clock-primary",
          ownerRevision: 0,
        },
        title: "Primary",
        notes: "",
      }),
    );
  assert.equal(result.status, "applied");
  if (result.status !== "applied") return;
  assert(frozenGraph(result));
  assert.equal(result.state.primarySceneId, "scene-primary");
  assert.equal(result.state.focus.status, "active");
  assert.deepEqual(result.state.scenes[0]?.source.characterIds, [
    "character-a",
    "character-b",
  ]);
  assert.equal(result.state.party.partyRevision, 1);
  assert.equal(result.state.focus.focusRevision, 1);
  assert.deepEqual(
    before.party.characters.map((entry) => entry.sceneAssignment.status),
    ["not-started", "not-started", "inactive"],
  );
});

test("cancelled or stale initialization returns unchanged semantic state", () => {
  const state = createUninitializedLiveSessionState(partyBeforeSession()),
    cancelled = initializeLiveSession(
      state,
      commandBase("initialize-live-session", {
        cancelled: true,
        primarySceneId: "scene-primary",
        sceneClockRef: {
          ownerId: "clock",
          generationId: "clock-generation",
          referenceId: "clock-primary",
          ownerRevision: 0,
        },
        title: "",
        notes: "",
      }),
    ),
    stale = initializeLiveSession(
      state,
      commandBase("initialize-live-session", {
        expectedPartyRevision: 9,
        primarySceneId: "scene-primary",
        sceneClockRef: {
          ownerId: "clock",
          generationId: "clock-generation",
          referenceId: "clock-primary",
          ownerRevision: 0,
        },
        title: "",
        notes: "",
      }),
    );
  assert.equal(cancelled.status, "cancelled");
  assert.equal(stale.status, "rejected");
  assert.deepEqual(cancelled.state, state);
  assert.deepEqual(stale.state, state);
});

test("Prepared Runtime cannot create an implicit Live Session", () => {
  const state = createUninitializedLiveSessionState(partyBeforeSession()),
    result = createPreparedRuntime(
      state,
      commandBase("prepare-runtime", {
        liveSceneId: "scene-prepared",
        sceneClockRef: {
          ownerId: "clock",
          generationId: "clock-generation",
          referenceId: "clock-prepared",
          ownerRevision: 0,
        },
        snapshot: preparationSnapshot(),
      }),
    );
  assert.equal(result.status, "rejected");
  assert.equal(
    result.status === "rejected" && result.reason,
    "not-initialized",
  );
  assert.deepEqual(result.state, state);
});

test("Prepared Runtime is an empty independent copy and cannot become Focus", () => {
  const state = prepare(),
    prepared = state.scenes.find(
      (entry) => entry.source.liveSceneId === "scene-prepared",
    );
  assert(prepared);
  assert.equal(prepared.source.lifecycle, "prepared");
  assert.equal(prepared.source.primary, false);
  assert.deepEqual(prepared.source.characterIds, []);
  assert.deepEqual(prepared.source.maskRefs, []);
  assert.equal(prepared.notes, "Keep exact notes.");
  assert.equal(prepared.source.contentPins[0]?.referenceId, "note-a");
  assert(frozenGraph(prepared));

  const focus = setFocus(
    state,
    commandBase("set-focus", {
      expectedPartyRevision: state.party.partyRevision,
      expectedFocusRevision: state.focus.focusRevision,
      targetSceneId: "scene-prepared",
      expectedTargetRevision: 0,
    }),
  );
  assert.equal(focus.status, "rejected");
  assert.equal(focus.status === "rejected" && focus.reason, "prepared-scene");
});

test("partial move activates Prepared target without moving Primary, Focus or source-wide truth", () => {
  const state = prepare(),
    result = moveCharacters(
      state,
      commandBase("move-characters", {
        expectedPartyRevision: 1,
        expectedFocusRevision: 1,
        sourceSceneId: "scene-primary",
        targetSceneId: "scene-prepared",
        expectedSourceRevision: 0,
        expectedTargetRevision: 0,
        characterIds: ["character-b"],
      }),
    );
  assert.equal(result.status, "applied");
  if (result.status !== "applied") return;
  const source = result.state.scenes.find(
      (entry) => entry.source.liveSceneId === "scene-primary",
    )!,
    target = result.state.scenes.find(
      (entry) => entry.source.liveSceneId === "scene-prepared",
    )!;
  assert.deepEqual(source.source.characterIds, ["character-a"]);
  assert.equal(source.source.lifecycle, "active");
  assert.equal(source.source.primary, true);
  assert.deepEqual(target.source.characterIds, ["character-b"]);
  assert.equal(target.source.lifecycle, "active");
  assert.equal(target.source.primary, false);
  assert.equal(result.state.primarySceneId, "scene-primary");
  assert.equal(result.state.focus.status, "active");
  assert.equal(
    result.state.focus.status === "active" && result.state.focus.liveSceneId,
    "scene-primary",
  );
  assert.equal(result.decision.sceneCleanup?.sourceLifecycleAfter, "active");
});

test("Prepared to active without a Clock fails closed with unchanged state", () => {
  const raw = structuredClone(prepare()) as Record<string, any>;
  delete raw.scenes[1].source.sceneClockRef;
  const state = parseLiveSessionAggregateState(raw),
    result = moveCharacters(
      state,
      commandBase("move-characters", {
        expectedPartyRevision: 1,
        expectedFocusRevision: 1,
        sourceSceneId: "scene-primary",
        targetSceneId: "scene-prepared",
        expectedSourceRevision: 0,
        expectedTargetRevision: 0,
        characterIds: ["character-b"],
      }),
    );
  assert.equal(result.status, "rejected");
  assert.equal(result.status === "rejected" && result.reason, "missing-clock");
  assert.deepEqual(result.state, state);
  assert.equal("decision" in result, false);
});

test("last-member move retires Source and binds Primary and Focus to populated target", () => {
  const prepared = prepare(),
    first = moveCharacters(
      prepared,
      commandBase("move-characters", {
        commandId: "command-move-b",
        commandDigest: "digest-move-b",
        expectedPartyRevision: 1,
        expectedFocusRevision: 1,
        sourceSceneId: "scene-primary",
        targetSceneId: "scene-prepared",
        expectedSourceRevision: 0,
        expectedTargetRevision: 0,
        characterIds: ["character-b"],
      }),
    );
  assert.equal(first.status, "applied");
  if (first.status !== "applied") return;
  const second = moveCharacters(
    first.state,
    commandBase("move-characters", {
      commandId: "command-move-a",
      commandDigest: "digest-move-a",
      expectedPartyRevision: 2,
      expectedFocusRevision: 1,
      sourceSceneId: "scene-primary",
      targetSceneId: "scene-prepared",
      expectedSourceRevision: 1,
      expectedTargetRevision: 1,
      characterIds: ["character-a"],
    }),
  );
  assert.equal(second.status, "applied");
  if (second.status !== "applied") return;
  const source = second.state.scenes.find(
      (entry) => entry.source.liveSceneId === "scene-primary",
    )!,
    target = second.state.scenes.find(
      (entry) => entry.source.liveSceneId === "scene-prepared",
    )!;
  assert.equal(source.source.lifecycle, "retired");
  assert.equal(source.source.primary, false);
  assert.equal(target.source.primary, true);
  assert.deepEqual(target.source.characterIds, ["character-a", "character-b"]);
  assert.equal(second.state.primarySceneId, "scene-prepared");
  assert.equal(second.state.focus.status, "active");
  assert.equal(
    second.state.focus.status === "active" && second.state.focus.liveSceneId,
    "scene-prepared",
  );
  assert.equal(second.state.focus.focusRevision, 2);
  assert.equal(second.decision.sceneCleanup?.sourceLifecycleAfter, "retired");
  assert(frozenGraph(second));
});

test("stale or duplicate move fails before changing either aggregate", () => {
  const state = prepare(),
    stale = moveCharacters(
      state,
      commandBase("move-characters", {
        expectedPartyRevision: 1,
        expectedFocusRevision: 1,
        sourceSceneId: "scene-primary",
        targetSceneId: "scene-prepared",
        expectedSourceRevision: 9,
        expectedTargetRevision: 0,
        characterIds: ["character-a"],
      }),
    );
  assert.equal(stale.status, "rejected");
  assert.equal(stale.status === "rejected" && stale.reason, "stale-scene");
  assert.deepEqual(stale.state, state);
  assert.throws(
    () =>
      moveCharacters(
        state,
        commandBase("move-characters", {
          expectedPartyRevision: 1,
          expectedFocusRevision: 1,
          sourceSceneId: "scene-primary",
          targetSceneId: "scene-prepared",
          expectedSourceRevision: 0,
          expectedTargetRevision: 0,
          characterIds: ["character-a", "character-a"],
        }),
      ),
    /doppelte/i,
  );
});

test("unavailable mask owner cannot roll back a move and receives one bound pending duty", () => {
  const raw = structuredClone(prepare()) as Record<string, any>;
  raw.scenes[0].source.maskRefs = [
    {
      maskId: "mask-a",
      kind: "encounter",
      ownerId: "encounter-owner",
      generationId: "encounter-generation",
      ownerRevision: 3,
      lifecycle: "active",
    },
  ];
  raw.scenes[0].source.maskParticipationProjections = [];
  raw.scenes[0].source.reconciliations = [
    {
      ownerId: "encounter-owner",
      generationId: "encounter-generation",
      status: "unavailable",
      ownerRevision: 3,
    },
  ];
  const state = parseLiveSessionAggregateState(raw),
    result = moveCharacters(
      state,
      commandBase("move-characters", {
        commandId: "command-move-unavailable",
        commandDigest: "digest-move-unavailable",
        expectedPartyRevision: 1,
        expectedFocusRevision: 1,
        sourceSceneId: "scene-primary",
        targetSceneId: "scene-prepared",
        expectedSourceRevision: 0,
        expectedTargetRevision: 0,
        characterIds: ["character-b"],
      }),
    );
  assert.equal(result.status, "applied");
  if (result.status !== "applied") return;
  assert.equal(result.decision.sceneCleanup?.reconciliations.length, 1);
  assert.deepEqual(result.decision.sceneCleanup?.reconciliations[0], {
    kind: "mask-owner-reconciliation",
    version: 1,
    campaignId: "campaign-a",
    commandId: "command-move-unavailable",
    commandDigest: "digest-move-unavailable",
    partyRevisionBefore: 1,
    partyRevisionAfter: 2,
    sourceSceneId: "scene-primary",
    sourceRevisionBefore: 0,
    sourceRevisionAfter: 1,
    target: {
      kind: "existing",
      liveSceneId: "scene-prepared",
      revisionBefore: 0,
      revisionAfter: 1,
    },
    affectedCharacterIds: ["character-b"],
    delivery: "pending",
    ownerIdentity: {
      ownerId: "encounter-owner",
      generationId: "encounter-generation",
    },
    expectedOwnerRevision: 3,
    sourceLifecycleBefore: "active",
    sourceLifecycleAfter: "active",
    scope: {
      kind: "owner-scope-unresolved",
      cause: "unavailable",
      knownMaskRefs: [
        {
          maskId: "mask-a",
          maskKind: "encounter",
          expectedOwnerRevision: 3,
          lifecycleBefore: "active",
        },
      ],
    },
  });
  assert.deepEqual(result.state.scenes[0]?.source.reconciliations, [
    {
      ownerId: "encounter-owner",
      generationId: "encounter-generation",
      status: "pending",
      ownerRevision: 3,
      commandId: "command-move-unavailable",
      pendingCommandIds: ["command-move-unavailable"],
    },
  ]);
  assert.equal(result.state.pendingReconciliations.length, 1);

  const second = moveCharacters(
    result.state,
    commandBase("move-characters", {
      commandId: "command-move-unavailable-2",
      commandDigest: "digest-move-unavailable-2",
      expectedPartyRevision: 2,
      expectedFocusRevision: 1,
      sourceSceneId: "scene-primary",
      targetSceneId: "scene-prepared",
      expectedSourceRevision: 1,
      expectedTargetRevision: 1,
      characterIds: ["character-a"],
    }),
  );
  assert.equal(second.status, "applied");
  if (second.status !== "applied") return;
  assert.equal(second.state.scenes[1]?.source.sceneRevision, 2);
  assert.equal(
    second.state.pendingReconciliations[0]?.target.kind !== "none" &&
      second.state.pendingReconciliations[0]?.target.revisionAfter,
    1,
  );
  assert.deepEqual(
    second.state.pendingReconciliations.map((duty) => ({
      commandId: duty.commandId,
      expectedOwnerRevision: duty.expectedOwnerRevision,
      operation:
        duty.kind === "mask-owner-reconciliation" &&
        duty.scope.kind === "complete-mask-delta"
          ? duty.scope.operation
          : duty.kind === "mask-owner-reconciliation"
            ? duty.scope.kind
            : duty.operation,
      characterIds: duty.affectedCharacterIds,
      maskIds:
        duty.kind === "mask-owner-reconciliation"
          ? (duty.scope.kind === "complete-mask-delta"
              ? duty.scope.masks
              : duty.scope.knownMaskRefs
            ).map((mask) => mask.maskId)
          : [],
    })),
    [
      {
        commandId: "command-move-unavailable",
        expectedOwnerRevision: 3,
        operation: "owner-scope-unresolved",
        characterIds: ["character-b"],
        maskIds: ["mask-a"],
      },
      {
        commandId: "command-move-unavailable-2",
        expectedOwnerRevision: 3,
        operation: "owner-scope-unresolved",
        characterIds: ["character-a"],
        maskIds: ["mask-a"],
      },
    ],
  );

  const futureBound = structuredClone(second.state) as Record<string, any>;
  futureBound.pendingReconciliations[0].target.revisionBefore = 2;
  futureBound.pendingReconciliations[0].target.revisionAfter = 3;
  assert.throws(
    () => parseLiveSessionAggregateState(futureBound),
    /stale Reconciliation-Zielbindung/,
  );
});

test("generic unavailable consumer needs and retains an exact OwnerRevision", () => {
  const unbound = structuredClone(prepare()) as Record<string, any>;
  unbound.scenes[0].source.reconciliations = [
    { ownerId: "weather-owner", status: "unavailable" },
  ];
  assert.throws(
    () => parseLiveSessionAggregateState(unbound),
    /gebundene OwnerRevision/,
  );

  unbound.scenes[0].source.reconciliations[0].ownerRevision = 7;
  const state = parseLiveSessionAggregateState(unbound),
    result = moveCharacters(
      state,
      commandBase("move-characters", {
        commandId: "command-weather-pending",
        commandDigest: "digest-weather-pending",
        expectedPartyRevision: 1,
        expectedFocusRevision: 1,
        sourceSceneId: "scene-primary",
        targetSceneId: "scene-prepared",
        expectedSourceRevision: 0,
        expectedTargetRevision: 0,
        characterIds: ["character-b"],
      }),
    );
  assert.equal(result.status, "applied");
  if (result.status !== "applied") return;
  assert.deepEqual(result.state.pendingReconciliations[0], {
    kind: "generic-scene-consumer-reconciliation",
    version: 1,
    ownerId: "weather-owner",
    campaignId: "campaign-a",
    commandId: "command-weather-pending",
    commandDigest: "digest-weather-pending",
    partyRevisionBefore: 1,
    partyRevisionAfter: 2,
    sourceSceneId: "scene-primary",
    sourceRevisionBefore: 0,
    sourceRevisionAfter: 1,
    target: {
      kind: "existing",
      liveSceneId: "scene-prepared",
      revisionBefore: 0,
      revisionAfter: 1,
    },
    expectedOwnerRevision: 7,
    sourceLifecycleBefore: "active",
    sourceLifecycleAfter: "active",
    operation: "remove-participants",
    affectedCharacterIds: ["character-b"],
    delivery: "pending",
  });
  assert.deepEqual(result.state.scenes[0]?.source.reconciliations, [
    {
      ownerId: "weather-owner",
      status: "pending",
      ownerRevision: 7,
      commandId: "command-weather-pending",
    },
  ]);
  const forged = structuredClone(result.state) as Record<string, any>;
  forged.pendingReconciliations[0].expectedOwnerRevision = 8;
  assert.throws(
    () => parseLiveSessionAggregateState(forged),
    /ungebundene Owner-Reconciliation/,
  );
});

test("assigned and pending membership cannot overlap in either Scene order", () => {
  const raw = structuredClone(prepare()) as Record<string, any>,
    source = raw.scenes[0].source,
    target = raw.scenes[1].source;
  source.characterIds = ["character-a"];
  source.pendingAssignments = [
    {
      characterId: "character-b",
      commandId: "command-pending-b",
      ownerId: "scene-owner",
    },
  ];
  target.lifecycle = "active";
  target.characterIds = ["character-b"];
  raw.party.characters[1].sceneAssignment = {
    status: "assigned",
    liveSceneId: "scene-prepared",
    sceneRevision: 0,
  };
  assert.throws(
    () => parseLiveSessionAggregateState(raw),
    /mehreren aktiven Scenes|mehrere aktuelle Scene-Zuordnungen/,
  );
  raw.scenes.reverse();
  assert.throws(
    () => parseLiveSessionAggregateState(raw),
    /mehreren aktiven Scenes|mehrere aktuelle Scene-Zuordnungen/,
  );
});

test("cleanup retains a Source that still has a pending participant", () => {
  const raw = structuredClone(prepare()) as Record<string, any>;
  raw.scenes[0].source.characterIds = ["character-a"];
  raw.scenes[0].source.pendingAssignments = [
    {
      characterId: "character-b",
      commandId: "command-pending-b",
      ownerId: "scene-owner",
    },
  ];
  raw.party.characters[1].sceneAssignment = {
    status: "pending",
    commandId: "command-pending-b",
    ownerId: "scene-owner",
  };
  const state = parseLiveSessionAggregateState(raw),
    result = moveCharacters(
      state,
      commandBase("move-characters", {
        commandId: "command-move-a-with-pending-b",
        commandDigest: "digest-move-a-with-pending-b",
        expectedPartyRevision: 1,
        expectedFocusRevision: 1,
        sourceSceneId: "scene-primary",
        targetSceneId: "scene-prepared",
        expectedSourceRevision: 0,
        expectedTargetRevision: 0,
        characterIds: ["character-a"],
      }),
    );
  assert.equal(result.status, "applied");
  if (result.status !== "applied") return;
  const source = result.state.scenes.find(
    (scene) => scene.source.liveSceneId === "scene-primary",
  )!.source;
  assert.equal(source.lifecycle, "active");
  assert.equal(source.primary, true);
  assert.deepEqual(source.characterIds, []);
  assert.deepEqual(source.pendingAssignments, [
    {
      characterId: "character-b",
      commandId: "command-pending-b",
      ownerId: "scene-owner",
    },
  ]);
  assert.equal(result.decision.sceneCleanup?.sourceLifecycleAfter, "active");
});

test("same MaskId from different owners remains owner-qualified", () => {
  const raw = structuredClone(prepare()) as Record<string, any>;
  raw.scenes[0].source.maskRefs = [
    {
      maskId: "shared-mask-id",
      kind: "encounter",
      ownerId: "owner-a",
      generationId: "generation-a",
      ownerRevision: 2,
      lifecycle: "active",
    },
    {
      maskId: "shared-mask-id",
      kind: "chase",
      ownerId: "owner-b",
      generationId: "generation-b",
      ownerRevision: 3,
      lifecycle: "active",
    },
  ];
  raw.scenes[0].source.maskParticipationProjections = [];
  raw.scenes[0].source.reconciliations = [
    {
      ownerId: "owner-a",
      generationId: "generation-a",
      status: "unavailable",
      ownerRevision: 2,
    },
    {
      ownerId: "owner-b",
      generationId: "generation-b",
      status: "unavailable",
      ownerRevision: 3,
    },
  ];
  const state = parseLiveSessionAggregateState(raw),
    result = moveCharacters(
      state,
      commandBase("move-characters", {
        commandId: "command-qualified-masks",
        commandDigest: "digest-qualified-masks",
        expectedPartyRevision: 1,
        expectedFocusRevision: 1,
        sourceSceneId: "scene-primary",
        targetSceneId: "scene-prepared",
        expectedSourceRevision: 0,
        expectedTargetRevision: 0,
        characterIds: ["character-b"],
      }),
    );
  assert.equal(result.status, "applied");
  if (result.status !== "applied") return;
  assert.deepEqual(
    result.state.pendingReconciliations.map((duty) => ({
      ownerId:
        duty.kind === "mask-owner-reconciliation"
          ? duty.ownerIdentity.ownerId
          : duty.ownerId,
      expectedOwnerRevision: duty.expectedOwnerRevision,
      maskIds:
        duty.kind === "mask-owner-reconciliation"
          ? (duty.scope.kind === "complete-mask-delta"
              ? duty.scope.masks
              : duty.scope.knownMaskRefs
            ).map((mask) => mask.maskId)
          : [],
    })),
    [
      {
        ownerId: "owner-a",
        expectedOwnerRevision: 2,
        maskIds: ["shared-mask-id"],
      },
      {
        ownerId: "owner-b",
        expectedOwnerRevision: 3,
        maskIds: ["shared-mask-id"],
      },
    ],
  );
});

test("state parser rejects active session membership gaps and mutable aliases", () => {
  const state = initialize(),
    raw = structuredClone(state) as Record<string, any>;
  raw.scenes[0].source.characterIds = [];
  assert.throws(
    () => parseLiveSessionAggregateState(raw),
    /widersprechen|keine aktuelle Scene-Zuordnung/,
  );
  const parsed = parseLiveSessionAggregateState(state);
  raw.scenes[0].title = "mutated";
  assert.equal(parsed.scenes[0]?.title, "Primary");
  assert(frozenGraph(parsed));
});

test("state parser binds Prepared provenance and pending membership exactly", () => {
  const prepared = structuredClone(prepare()) as Record<string, any>,
    withoutEncounter = structuredClone(prepared) as Record<string, any>,
    changedPins = structuredClone(prepared) as Record<string, any>,
    pendingPrepared = structuredClone(prepared) as Record<string, any>;
  delete withoutEncounter.scenes[1].encounterPlanRef;
  changedPins.scenes[1].source.contentPins[0].referenceId = "";
  assert.throws(
    () => parseLiveSessionAggregateState(withoutEncounter),
    /encounterPlanRef widerspricht/,
  );
  assert.throws(
    () => parseLiveSessionAggregateState(changedPins),
    /[Rr]eferenceId/,
  );
  pendingPrepared.scenes[1].source.pendingAssignments = [
    {
      characterId: "character-a",
      commandId: "command-hidden",
      ownerId: "scene-owner",
    },
  ];
  assert.throws(
    () => parseLiveSessionAggregateState(pendingPrepared),
    /aktive Prepared Runtime/,
  );

  const pending = structuredClone(initialize()) as Record<string, any>;
  pending.party.characters[0].sceneAssignment = {
    status: "pending",
    commandId: "command-pending",
    ownerId: "scene-owner",
  };
  pending.scenes[0].source.characterIds = ["character-b"];
  pending.scenes[0].source.pendingAssignments = [
    {
      characterId: "character-a",
      commandId: "command-pending",
      ownerId: "scene-owner",
    },
  ];
  assert.doesNotThrow(() => parseLiveSessionAggregateState(pending));
  pending.party.characters[0].sceneAssignment.commandId = "command-other";
  assert.throws(
    () => parseLiveSessionAggregateState(pending),
    /keine aktuelle Scene-Zuordnung/,
  );
});

test("membership can be activated and deactivated before a session without scene effects", () => {
  const initial = createUninitializedLiveSessionState(partyBeforeSession()),
    activated = activatePartyCharacter(
      initial,
      commandBase("activate-party-character", {
        characterId: "character-c",
      }),
    );
  assert.equal(activated.status, "applied");
  if (activated.status !== "applied") return;
  assert.equal(activated.state.party.partyRevision, 1);
  assert.deepEqual(activated.state.scenes, []);
  assert.deepEqual(activated.state.party.characters[2]?.sceneAssignment, {
    status: "not-started",
  });

  const deactivated = deactivatePartyCharacter(
    activated.state,
    commandBase("deactivate-party-character", {
      commandId: "command-deactivate-before-session",
      commandDigest: "digest-deactivate-before-session",
      expectedPartyRevision: 1,
      characterId: "character-a",
    }),
  );
  assert.equal(deactivated.status, "applied");
  if (deactivated.status !== "applied") return;
  assert.equal(deactivated.state.party.partyRevision, 2);
  assert.equal(deactivated.state.party.characters[0]?.active, false);
  assert.deepEqual(deactivated.state.party.characters[0]?.sceneAssignment, {
    status: "inactive",
  });
  assert.deepEqual(deactivated.state.scenes, []);
  assert(frozenGraph(deactivated));
});

test("session activation binds exactly to current Focus and preserves FocusRevision", () => {
  const state = initialize(),
    stale = activatePartyCharacter(
      state,
      commandBase("activate-party-character", {
        expectedPartyRevision: 1,
        expectedFocusRevision: 1,
        characterId: "character-c",
        targetSceneId: "scene-primary",
        expectedTargetRevision: 9,
      }),
    );
  assert.equal(stale.status, "rejected");
  assert.equal(stale.status === "rejected" && stale.reason, "focus-mismatch");
  assert.deepEqual(stale.state, state);

  const activated = activatePartyCharacter(
    state,
    commandBase("activate-party-character", {
      commandId: "command-activate-c",
      commandDigest: "digest-activate-c",
      expectedPartyRevision: 1,
      expectedFocusRevision: 1,
      characterId: "character-c",
      targetSceneId: "scene-primary",
      expectedTargetRevision: 0,
    }),
  );
  assert.equal(activated.status, "applied");
  if (activated.status !== "applied") return;
  assert.deepEqual(activated.state.scenes[0]?.source.characterIds, [
    "character-a",
    "character-b",
    "character-c",
  ]);
  assert.equal(activated.state.scenes[0]?.source.sceneRevision, 1);
  assert.equal(activated.state.focus.focusRevision, 1);
  assert.equal(
    activated.state.focus.status === "active" &&
      activated.state.focus.sceneRevision,
    1,
  );
  assert.deepEqual(
    activated.state.party.characters.map((entry) => entry.sceneAssignment),
    [
      { status: "assigned", liveSceneId: "scene-primary", sceneRevision: 1 },
      { status: "assigned", liveSceneId: "scene-primary", sceneRevision: 1 },
      { status: "assigned", liveSceneId: "scene-primary", sceneRevision: 1 },
    ],
  );
});

test("deactivation updates remaining membership but keeps a populated Primary", () => {
  const state = initialize(),
    result = deactivatePartyCharacter(
      state,
      commandBase("deactivate-party-character", {
        expectedPartyRevision: 1,
        expectedFocusRevision: 1,
        characterId: "character-a",
        expectedSourceRevision: 0,
      }),
    );
  assert.equal(result.status, "applied");
  if (result.status !== "applied") return;
  assert.equal(result.state.primarySceneId, "scene-primary");
  assert.equal(result.state.scenes[0]?.source.lifecycle, "active");
  assert.deepEqual(result.state.scenes[0]?.source.characterIds, [
    "character-b",
  ]);
  assert.deepEqual(result.state.party.characters[0]?.sceneAssignment, {
    status: "inactive",
  });
  assert.deepEqual(result.state.party.characters[1]?.sceneAssignment, {
    status: "assigned",
    liveSceneId: "scene-primary",
    sceneRevision: 1,
  });
  assert.equal(result.state.focus.focusRevision, 1);
  assert.equal(
    result.state.focus.status === "active" && result.state.focus.sceneRevision,
    1,
  );
});

test("deactivating the last Primary member promotes the first populated active scene", () => {
  const prepared = prepare(),
    moved = moveCharacters(
      prepared,
      commandBase("move-characters", {
        commandId: "command-move-b-for-deactivation",
        commandDigest: "digest-move-b-for-deactivation",
        expectedPartyRevision: 1,
        expectedFocusRevision: 1,
        sourceSceneId: "scene-primary",
        targetSceneId: "scene-prepared",
        expectedSourceRevision: 0,
        expectedTargetRevision: 0,
        characterIds: ["character-b"],
      }),
    );
  assert.equal(moved.status, "applied");
  if (moved.status !== "applied") return;
  const result = deactivatePartyCharacter(
    moved.state,
    commandBase("deactivate-party-character", {
      commandId: "command-deactivate-last-primary",
      commandDigest: "digest-deactivate-last-primary",
      expectedPartyRevision: 2,
      expectedFocusRevision: 1,
      characterId: "character-a",
      expectedSourceRevision: 1,
      primarySuccessorSceneId: "scene-prepared",
      expectedSuccessorRevision: 1,
    }),
  );
  assert.equal(result.status, "applied");
  if (result.status !== "applied") return;
  const source = result.state.scenes[0]!.source,
    successor = result.state.scenes[1]!.source;
  assert.equal(source.lifecycle, "retired");
  assert.equal(source.primary, false);
  assert.equal(successor.primary, true);
  assert.equal(successor.sceneRevision, 2);
  assert.equal(result.state.primarySceneId, "scene-prepared");
  assert.equal(result.state.focus.focusRevision, 2);
  assert.equal(
    result.state.focus.status === "active" && result.state.focus.liveSceneId,
    "scene-prepared",
  );
  assert.deepEqual(result.state.party.characters[1]?.sceneAssignment, {
    status: "assigned",
    liveSceneId: "scene-prepared",
    sceneRevision: 2,
  });
  assert.equal(result.decision.membership?.sourceLifecycleAfter, "retired");
  assert.deepEqual(
    {
      sourceBefore: result.decision.membership?.sourceRevisionBefore,
      sourceAfter: result.decision.membership?.sourceRevisionAfter,
      successor: result.decision.membership?.primarySuccessorSceneId,
      successorBefore: result.decision.membership?.successorRevisionBefore,
      successorAfter: result.decision.membership?.successorRevisionAfter,
    },
    {
      sourceBefore: 1,
      sourceAfter: 2,
      successor: "scene-prepared",
      successorBefore: 1,
      successorAfter: 2,
    },
  );
});

test("the sole empty Primary remains active after its last character is deactivated", () => {
  const party = structuredClone(partyBeforeSession()) as Record<string, any>;
  party.characters[1].active = false;
  party.characters[1].sceneAssignment = { status: "inactive" };
  const uninitialized = createUninitializedLiveSessionState(party),
    initialized = initializeLiveSession(
      uninitialized,
      commandBase("initialize-live-session", {
        primarySceneId: "scene-primary",
        sceneClockRef: {
          ownerId: "clock",
          generationId: "clock-generation",
          referenceId: "clock-primary",
          ownerRevision: 0,
        },
        title: "Primary",
        notes: "",
      }),
    );
  assert.equal(initialized.status, "applied");
  if (initialized.status !== "applied") return;
  const result = deactivatePartyCharacter(
    initialized.state,
    commandBase("deactivate-party-character", {
      expectedPartyRevision: 1,
      expectedFocusRevision: 1,
      characterId: "character-a",
      expectedSourceRevision: 0,
    }),
  );
  assert.equal(result.status, "applied");
  if (result.status !== "applied") return;
  assert.equal(result.state.primarySceneId, "scene-primary");
  assert.equal(result.state.scenes[0]?.source.lifecycle, "active");
  assert.equal(result.state.scenes[0]?.source.primary, true);
  assert.deepEqual(result.state.scenes[0]?.source.characterIds, []);
  assert.equal(result.state.focus.focusRevision, 1);
  assert.equal(
    result.state.focus.status === "active" && result.state.focus.liveSceneId,
    "scene-primary",
  );
});

test("unavailable consumers receive a durable source-only deactivation duty", () => {
  const raw = structuredClone(initialize()) as Record<string, any>;
  raw.scenes[0].source.reconciliations = [
    { ownerId: "music-owner", status: "unavailable", ownerRevision: 6 },
  ];
  const state = parseLiveSessionAggregateState(raw),
    result = deactivatePartyCharacter(
      state,
      commandBase("deactivate-party-character", {
        commandId: "command-deactivate-with-music",
        commandDigest: "digest-deactivate-with-music",
        expectedPartyRevision: 1,
        expectedFocusRevision: 1,
        characterId: "character-a",
        expectedSourceRevision: 0,
      }),
    );
  assert.equal(result.status, "applied");
  if (result.status !== "applied") return;
  assert.deepEqual(result.state.pendingReconciliations[0], {
    kind: "generic-scene-consumer-reconciliation",
    version: 1,
    ownerId: "music-owner",
    campaignId: "campaign-a",
    commandId: "command-deactivate-with-music",
    commandDigest: "digest-deactivate-with-music",
    partyRevisionBefore: 1,
    partyRevisionAfter: 2,
    sourceSceneId: "scene-primary",
    sourceRevisionBefore: 0,
    sourceRevisionAfter: 1,
    target: { kind: "none" },
    expectedOwnerRevision: 6,
    sourceLifecycleBefore: "active",
    sourceLifecycleAfter: "active",
    operation: "remove-participants",
    affectedCharacterIds: ["character-a"],
    delivery: "pending",
  });
  assert.deepEqual(
    result.decision.membership?.reconciliations,
    result.state.pendingReconciliations,
  );
  assert(frozenGraph(result));
});

test("a bound pending party member can be deactivated without losing cleanup duties", () => {
  const raw = structuredClone(initialize()) as Record<string, any>;
  raw.party.characters[0].sceneAssignment = {
    status: "pending",
    commandId: "command-pending-a",
    ownerId: "scene-owner",
  };
  raw.scenes[0].source.characterIds = ["character-b"];
  raw.scenes[0].source.pendingAssignments = [
    {
      characterId: "character-a",
      commandId: "command-pending-a",
      ownerId: "scene-owner",
    },
  ];
  raw.scenes[0].source.reconciliations = [
    { ownerId: "music-owner", status: "unavailable", ownerRevision: 4 },
  ];
  const state = parseLiveSessionAggregateState(raw),
    result = deactivatePartyCharacter(
      state,
      commandBase("deactivate-party-character", {
        commandId: "command-deactivate-pending-a",
        commandDigest: "digest-deactivate-pending-a",
        expectedPartyRevision: 1,
        expectedFocusRevision: 1,
        characterId: "character-a",
        expectedSourceRevision: 0,
      }),
    );
  assert.equal(result.status, "applied");
  if (result.status !== "applied") return;
  assert.equal(result.state.party.characters[0]?.active, false);
  assert.deepEqual(result.state.party.characters[0]?.sceneAssignment, {
    status: "inactive",
  });
  assert.deepEqual(result.state.scenes[0]?.source.pendingAssignments, []);
  assert.deepEqual(result.state.scenes[0]?.source.characterIds, [
    "character-b",
  ]);
  assert.equal(result.state.scenes[0]?.source.lifecycle, "active");
  assert.deepEqual(result.state.pendingReconciliations[0], {
    kind: "generic-scene-consumer-reconciliation",
    version: 1,
    ownerId: "music-owner",
    campaignId: "campaign-a",
    commandId: "command-deactivate-pending-a",
    commandDigest: "digest-deactivate-pending-a",
    partyRevisionBefore: 1,
    partyRevisionAfter: 2,
    sourceSceneId: "scene-primary",
    sourceRevisionBefore: 0,
    sourceRevisionAfter: 1,
    target: { kind: "none" },
    expectedOwnerRevision: 4,
    sourceLifecycleBefore: "active",
    sourceLifecycleAfter: "active",
    operation: "remove-participants",
    affectedCharacterIds: ["character-a"],
    delivery: "pending",
  });
});

test("Primary successor prefers populated Focus and ignores scene array order", () => {
  const state = threePopulatedScenes(),
    focused = setFocus(
      state,
      commandBase("set-focus", {
        expectedPartyRevision: 3,
        expectedFocusRevision: 1,
        targetSceneId: "scene-third",
        expectedTargetRevision: 1,
      }),
    );
  assert.equal(focused.status, "applied");
  if (focused.status !== "applied") return;
  const permuted = parseLiveSessionAggregateState({
      ...focused.state,
      scenes: [
        focused.state.scenes[0],
        focused.state.scenes[2],
        focused.state.scenes[1],
      ],
    }),
    deactivate = (input: unknown) =>
      deactivatePartyCharacter(
        input,
        commandBase("deactivate-party-character", {
          commandId: "command-deactivate-primary-with-focused-successor",
          commandDigest: "digest-deactivate-primary-with-focused-successor",
          expectedPartyRevision: 3,
          expectedFocusRevision: 2,
          characterId: "character-a",
          expectedSourceRevision: 2,
          primarySuccessorSceneId: "scene-third",
          expectedSuccessorRevision: 1,
        }),
      ),
    normalResult = deactivate(focused.state),
    permutedResult = deactivate(permuted);
  assert.equal(normalResult.status, "applied");
  assert.equal(permutedResult.status, "applied");
  if (normalResult.status !== "applied" || permutedResult.status !== "applied")
    return;
  for (const result of [normalResult, permutedResult]) {
    assert.equal(result.state.primarySceneId, "scene-third");
    assert.equal(result.state.focus.status, "active");
    assert.equal(
      result.state.focus.status === "active" && result.state.focus.liveSceneId,
      "scene-third",
    );
    assert.equal(result.state.focus.focusRevision, 2);
    assert.equal(
      result.decision.membership?.primarySuccessorSceneId,
      "scene-third",
    );
    assert.equal(result.decision.membership?.successorRevisionBefore, 1);
    assert.equal(result.decision.membership?.successorRevisionAfter, 2);
  }
});

test("Primary successor falls back to Party order and rejects a stale successor pin", () => {
  const state = threePopulatedScenes(),
    noFocus = setFocus(
      state,
      commandBase("set-focus", {
        expectedPartyRevision: 3,
        expectedFocusRevision: 1,
        targetSceneId: null,
      }),
    );
  assert.equal(noFocus.status, "applied");
  if (noFocus.status !== "applied") return;
  const stale = deactivatePartyCharacter(
    noFocus.state,
    commandBase("deactivate-party-character", {
      expectedPartyRevision: 3,
      expectedFocusRevision: 2,
      characterId: "character-a",
      expectedSourceRevision: 2,
      primarySuccessorSceneId: "scene-prepared",
      expectedSuccessorRevision: 9,
    }),
  );
  assert.equal(stale.status, "rejected");
  assert.equal(stale.status === "rejected" && stale.reason, "stale-scene");
  assert.deepEqual(stale.state, noFocus.state);

  const result = deactivatePartyCharacter(
    noFocus.state,
    commandBase("deactivate-party-character", {
      commandId: "command-deactivate-primary-by-party-order",
      commandDigest: "digest-deactivate-primary-by-party-order",
      expectedPartyRevision: 3,
      expectedFocusRevision: 2,
      characterId: "character-a",
      expectedSourceRevision: 2,
      primarySuccessorSceneId: "scene-prepared",
      expectedSuccessorRevision: 1,
    }),
  );
  assert.equal(result.status, "applied");
  if (result.status !== "applied") return;
  assert.equal(result.state.primarySceneId, "scene-prepared");
  assert.equal(result.state.focus.status, "none");
  assert.equal(result.state.focus.focusRevision, 2);
});

test("Party-order successor can be populated by an exact pending assignment", () => {
  const state = threePopulatedScenes(),
    noFocus = setFocus(
      state,
      commandBase("set-focus", {
        expectedPartyRevision: 3,
        expectedFocusRevision: 1,
        targetSceneId: null,
      }),
    );
  assert.equal(noFocus.status, "applied");
  if (noFocus.status !== "applied") return;
  const raw = structuredClone(noFocus.state) as Record<string, any>,
    second = raw.scenes.find(
      (scene: Record<string, any>) =>
        scene.source.liveSceneId === "scene-prepared",
    );
  raw.party.characters[1].sceneAssignment = {
    status: "pending",
    commandId: "command-pending-b",
    ownerId: "scene-owner",
  };
  second.source.characterIds = [];
  second.source.pendingAssignments = [
    {
      characterId: "character-b",
      commandId: "command-pending-b",
      ownerId: "scene-owner",
    },
  ];
  const pendingState = parseLiveSessionAggregateState(raw),
    result = deactivatePartyCharacter(
      pendingState,
      commandBase("deactivate-party-character", {
        commandId: "command-deactivate-primary-with-pending-successor",
        commandDigest: "digest-deactivate-primary-with-pending-successor",
        expectedPartyRevision: 3,
        expectedFocusRevision: 2,
        characterId: "character-a",
        expectedSourceRevision: 2,
        primarySuccessorSceneId: "scene-prepared",
        expectedSuccessorRevision: 1,
      }),
    );
  assert.equal(result.status, "applied");
  if (result.status !== "applied") return;
  assert.equal(result.state.primarySceneId, "scene-prepared");
  assert.equal(result.state.scenes[1]?.source.primary, true);
  assert.deepEqual(result.state.scenes[1]?.source.pendingAssignments, [
    {
      characterId: "character-b",
      commandId: "command-pending-b",
      ownerId: "scene-owner",
    },
  ]);
});

test("partial Split creates an independent active Scene in Party order and keeps Source focus", () => {
  const raw = structuredClone(initialize()) as Record<string, any>;
  raw.scenes[0].source.locationRef = {
    ownerId: "locations",
    referenceId: "harbour",
    ownerRevision: 4,
  };
  raw.scenes[0].source.contentPins = [
    { ownerId: "notes", referenceId: "secret", ownerRevision: 2 },
  ];
  raw.scenes[0].source.reconciliations = [
    { ownerId: "weather", status: "unavailable", ownerRevision: 7 },
  ];
  const state = parseLiveSessionAggregateState(raw),
    result = splitScene(
      state,
      commandBase("split-scene", {
        expectedPartyRevision: 1,
        expectedFocusRevision: 1,
        sourceSceneId: "scene-primary",
        expectedSourceRevision: 0,
        targetSceneId: "scene-split",
        targetClockRef: clockRef("clock-split"),
        characterIds: ["character-b"],
        title: "Scout group",
        clockContribution: forkContribution(),
      }),
    );
  assert.equal(result.status, "applied");
  if (result.status !== "applied") return;
  const source = result.state.scenes.find(
      (scene) => scene.source.liveSceneId === "scene-primary",
    )!,
    target = result.state.scenes.find(
      (scene) => scene.source.liveSceneId === "scene-split",
    )!;
  assert.deepEqual(source.source.characterIds, ["character-a"]);
  assert.equal(source.source.lifecycle, "active");
  assert.equal(source.source.sceneRevision, 1);
  assert.deepEqual(target.source.characterIds, ["character-b"]);
  assert.equal(target.source.sceneRevision, 0);
  assert.deepEqual(target.source.locationRef, source.source.locationRef);
  assert.deepEqual(target.source.contentPins, []);
  assert.deepEqual(target.source.maskRefs, []);
  assert.deepEqual(target.source.reconciliations, []);
  assert.equal(result.state.primarySceneId, "scene-primary");
  assert.equal(result.state.focus.focusRevision, 1);
  assert.equal(
    result.state.focus.status === "active" && result.state.focus.liveSceneId,
    "scene-primary",
  );
  assert.equal(
    result.state.focus.status === "active" && result.state.focus.sceneRevision,
    1,
  );
  assert.deepEqual(result.state.pendingReconciliations[0]?.target, {
    kind: "created",
    liveSceneId: "scene-split",
    revisionAfter: 0,
  });
  assert.equal(
    result.state.pendingReconciliations[0]?.kind ===
      "generic-scene-consumer-reconciliation" &&
      result.state.pendingReconciliations[0].operation,
    "remove-participants",
  );
  assert.equal(result.decision.kind, "scene-split");
  assert.equal(result.decision.transition?.target.kind, "created");
  assert(frozenGraph(result));
});

test("full Split retires Source, promotes Target and archives source-only consumers", () => {
  const raw = structuredClone(initialize()) as Record<string, any>;
  raw.scenes[0].source.reconciliations = [
    { ownerId: "music", status: "current", ownerRevision: 5 },
  ];
  const state = parseLiveSessionAggregateState(raw),
    result = splitScene(
      state,
      commandBase("split-scene", {
        expectedPartyRevision: 1,
        expectedFocusRevision: 1,
        sourceSceneId: "scene-primary",
        expectedSourceRevision: 0,
        targetSceneId: "scene-split",
        targetClockRef: clockRef("clock-split"),
        characterIds: ["character-b", "character-a"],
        title: "Everyone",
        clockContribution: forkContribution({ sourceDisposition: "archive" }),
      }),
    );
  assert.equal(result.status, "applied");
  if (result.status !== "applied") return;
  assert.equal(result.state.scenes[0]?.source.lifecycle, "retired");
  assert.equal(result.state.primarySceneId, "scene-split");
  assert.equal(result.state.focus.focusRevision, 2);
  assert.deepEqual(result.state.scenes[1]?.source.characterIds, [
    "character-a",
    "character-b",
  ]);
  assert.equal(
    result.decision.transition?.reconciliations[0]?.kind ===
      "generic-scene-consumer-reconciliation" &&
      result.decision.transition.reconciliations[0].operation,
    "source-retired",
  );
  assert.equal(
    result.decision.transition?.reconciliations[0]?.delivery,
    "required",
  );
});

test("created reconciliation keeps revision zero after legitimate Target progress", () => {
  const raw = structuredClone(initialize()) as Record<string, any>;
  raw.scenes[0].source.reconciliations = [
    { ownerId: "weather", status: "unavailable", ownerRevision: 7 },
  ];
  const state = parseLiveSessionAggregateState(raw),
    split = splitScene(
      state,
      commandBase("split-scene", {
        expectedPartyRevision: 1,
        expectedFocusRevision: 1,
        sourceSceneId: "scene-primary",
        expectedSourceRevision: 0,
        targetSceneId: "scene-split",
        targetClockRef: clockRef("clock-split"),
        characterIds: ["character-b"],
        title: "Scout group",
        clockContribution: forkContribution(),
      }),
    );
  assert.equal(split.status, "applied");
  if (split.status !== "applied") return;
  const progressed = moveCharacters(
    split.state,
    commandBase("move-characters", {
      commandId: "command-progress-created-target",
      commandDigest: "digest-progress-created-target",
      expectedPartyRevision: 2,
      expectedFocusRevision: 1,
      sourceSceneId: "scene-primary",
      targetSceneId: "scene-split",
      expectedSourceRevision: 1,
      expectedTargetRevision: 0,
      characterIds: ["character-a"],
    }),
  );
  assert.equal(progressed.status, "applied");
  if (progressed.status !== "applied") return;
  assert.equal(progressed.state.scenes[1]?.source.sceneRevision, 1);
  assert.deepEqual(progressed.state.pendingReconciliations[0]?.target, {
    kind: "created",
    liveSceneId: "scene-split",
    revisionAfter: 0,
  });

  const forged = structuredClone(progressed.state) as Record<string, any>;
  forged.pendingReconciliations[0].target.revisionAfter = 1;
  assert.throws(
    () => parseLiveSessionAggregateState(forged),
    /Created-Initialrevision 0/,
  );
});

test("Rejoin derives all Source members, updates target Clock and moves Source focus once", () => {
  const state = splitPrimary(),
    result = rejoinScenes(
      state,
      commandBase("rejoin-scenes", {
        expectedPartyRevision: 2,
        expectedFocusRevision: 1,
        sourceSceneId: "scene-primary",
        expectedSourceRevision: 1,
        targetSceneId: "scene-split",
        expectedTargetRevision: 0,
        clockContribution: mergeContribution(),
      }),
    );
  assert.equal(result.status, "applied");
  if (result.status !== "applied") return;
  assert.equal(result.state.scenes[0]?.source.lifecycle, "retired");
  assert.equal(result.state.primarySceneId, "scene-split");
  assert.deepEqual(result.state.scenes[1]?.source.characterIds, [
    "character-a",
    "character-b",
  ]);
  assert.deepEqual(result.state.scenes[1]?.source.sceneClockRef, {
    ownerId: "clock",
    generationId: "clock-generation",
    referenceId: "clock-split",
    ownerRevision: 1,
  });
  assert.equal(result.state.focus.focusRevision, 2);
  assert.equal(
    result.state.focus.status === "active" && result.state.focus.liveSceneId,
    "scene-split",
  );
  assert.equal(result.decision.transition?.operation, "rejoin");
  assert.deepEqual(result.decision.transition?.movedCharacterIds, [
    "character-a",
  ]);
  assert.equal(
    result.decision.transition?.clockContribution.targetClockValueAfter
      .canonicalValue,
    "-6",
  );
});

test("Rejoin keeps FocusRevision when Target was already focused", () => {
  const state = splitPrimary(),
    focused = setFocus(
      state,
      commandBase("set-focus", {
        expectedPartyRevision: 2,
        expectedFocusRevision: 1,
        targetSceneId: "scene-split",
        expectedTargetRevision: 0,
      }),
    );
  assert.equal(focused.status, "applied");
  if (focused.status !== "applied") return;
  const result = rejoinScenes(
    focused.state,
    commandBase("rejoin-scenes", {
      expectedPartyRevision: 2,
      expectedFocusRevision: 2,
      sourceSceneId: "scene-primary",
      expectedSourceRevision: 1,
      targetSceneId: "scene-split",
      expectedTargetRevision: 0,
      clockContribution: mergeContribution(),
    }),
  );
  assert.equal(result.status, "applied");
  if (result.status !== "applied") return;
  assert.equal(result.state.focus.focusRevision, 2);
  assert.equal(
    result.state.focus.status === "active" && result.state.focus.sceneRevision,
    1,
  );
});

test("Rejoin leaves an unrelated third-scene Focus and Primary unchanged", () => {
  const state = threePopulatedScenes(),
    focused = setFocus(
      state,
      commandBase("set-focus", {
        expectedPartyRevision: 3,
        expectedFocusRevision: 1,
        targetSceneId: "scene-third",
        expectedTargetRevision: 1,
      }),
    );
  assert.equal(focused.status, "applied");
  if (focused.status !== "applied") return;
  const result = rejoinScenes(
    focused.state,
    commandBase("rejoin-scenes", {
      expectedPartyRevision: 3,
      expectedFocusRevision: 2,
      sourceSceneId: "scene-prepared",
      expectedSourceRevision: 1,
      targetSceneId: "scene-primary",
      expectedTargetRevision: 2,
      clockContribution: mergeContribution({
        sourceSceneId: "scene-prepared",
        sourceSceneRevisionBefore: 1,
        sourceSceneRevisionAfter: 2,
        sourceClockRef: clockRef("clock-prepared"),
        targetSceneId: "scene-primary",
        targetSceneRevisionBefore: 2,
        targetSceneRevisionAfter: 3,
        targetClockRefBefore: clockRef("clock-primary"),
        targetClockRefAfter: clockRef("clock-primary", 1),
      }),
    }),
  );
  assert.equal(result.status, "applied");
  if (result.status !== "applied") return;
  assert.equal(result.state.primarySceneId, "scene-primary");
  assert.deepEqual(result.state.focus, focused.state.focus);
});

test("Rejoin preserves existing Target consumers and Source-owned content", () => {
  const raw = structuredClone(splitPrimary()) as Record<string, any>;
  raw.scenes[0].source.contentPins = [
    { ownerId: "notes", referenceId: "source-only", ownerRevision: 8 },
  ];
  raw.scenes[0].source.reconciliations = [
    { ownerId: "music", status: "current", ownerRevision: 5 },
  ];
  raw.scenes[1].source.locationRef = {
    ownerId: "locations",
    referenceId: "target-location",
    ownerRevision: 6,
  };
  raw.scenes[1].source.contentPins = [
    { ownerId: "notes", referenceId: "target-only", ownerRevision: 9 },
  ];
  raw.scenes[1].source.groupRefs = [
    { ownerId: "groups", referenceId: "target-group", ownerRevision: 2 },
  ];
  raw.scenes[1].source.maskRefs = [
    {
      maskId: "target-mask",
      kind: "weather",
      ownerId: "weather",
      generationId: "weather-generation",
      ownerRevision: 4,
      lifecycle: "active",
    },
  ];
  raw.scenes[1].source.maskParticipationProjections = [
    {
      kind: "mask-participation-projection",
      version: 1,
      campaignId: "campaign-a",
      liveSceneId: "scene-split",
      maskId: "target-mask",
      maskKind: "weather",
      ownerIdentity: {
        ownerId: "weather",
        generationId: "weather-generation",
      },
      ownerRevision: 4,
      participantCharacterIds: ["character-b"],
      lifecycle: "active",
    },
  ];
  raw.scenes[1].source.reconciliations = [
    {
      ownerId: "weather",
      generationId: "weather-generation",
      status: "current",
      ownerRevision: 4,
      receiptLedgerBaseRevision: 4,
    },
  ];
  const state = parseLiveSessionAggregateState(raw),
    targetBefore = state.scenes[1]!.source,
    result = rejoinScenes(
      state,
      commandBase("rejoin-scenes", {
        expectedPartyRevision: 2,
        expectedFocusRevision: 1,
        sourceSceneId: "scene-primary",
        expectedSourceRevision: 1,
        targetSceneId: "scene-split",
        expectedTargetRevision: 0,
        clockContribution: mergeContribution(),
      }),
    );
  assert.equal(result.status, "applied");
  if (result.status !== "applied") return;
  const targetAfter = result.state.scenes[1]!.source;
  assert.deepEqual(targetAfter.locationRef, targetBefore.locationRef);
  assert.deepEqual(targetAfter.contentPins, targetBefore.contentPins);
  assert.deepEqual(targetAfter.groupRefs, targetBefore.groupRefs);
  assert.deepEqual(targetAfter.maskRefs, targetBefore.maskRefs);
  assert.deepEqual(targetAfter.reconciliations, targetBefore.reconciliations);
  assert.equal(
    targetAfter.contentPins.some((pin) => pin.referenceId === "source-only"),
    false,
  );
  assert.deepEqual(result.decision.transition?.reconciliations, [
    {
      kind: "generic-scene-consumer-reconciliation",
      version: 1,
      ownerId: "music",
      campaignId: "campaign-a",
      commandId: "command-rejoin-scenes",
      commandDigest: "digest-rejoin-scenes",
      partyRevisionBefore: 2,
      partyRevisionAfter: 3,
      sourceSceneId: "scene-primary",
      sourceRevisionBefore: 1,
      sourceRevisionAfter: 2,
      target: {
        kind: "existing",
        liveSceneId: "scene-split",
        revisionBefore: 0,
        revisionAfter: 1,
      },
      expectedOwnerRevision: 5,
      sourceLifecycleBefore: "active",
      sourceLifecycleAfter: "retired",
      operation: "source-retired",
      affectedCharacterIds: ["character-a"],
      delivery: "required",
    },
  ]);
});

test("Clock contribution schemas reject missing, forbidden and exchanged pins", () => {
  assert.throws(
    () =>
      parseClockForkCreateContribution({
        ...forkContribution(),
        targetSceneRevisionBefore: 0,
      }),
    /unbekannte, berechnete oder unvollständige Daten/,
  );
  const withoutBefore = mergeContribution() as Record<string, unknown>;
  delete withoutBefore.targetClockRevisionBefore;
  assert.throws(
    () => parseClockMergeContribution(withoutBefore),
    /unbekannte, berechnete oder unvollständige Daten/,
  );
  assert.throws(
    () =>
      parseClockForkCreateContribution(
        forkContribution({ targetClockValueAfter: clockValue("3599") }),
      ),
    /Fresh-Fork/,
  );
  assert.throws(
    () =>
      parseClockMergeContribution(
        mergeContribution({
          choice: "source-confirmed",
          targetClockValueAfter: clockValue("3599"),
        }),
      ),
    /Merge-Wahl/,
  );
  assert.throws(
    () =>
      parseClockMergeContribution(
        mergeContribution({
          targetClockValueAfter: {
            codecId: "unknown",
            codecVersion: 1,
            canonicalValue: "0",
          },
        }),
      ),
    /unbekannten Codec/,
  );
  assert.throws(
    () =>
      parseClockMergeContribution(
        mergeContribution({
          targetClockRefBefore: clockRef(
            "clock-split",
            Number.MAX_SAFE_INTEGER,
          ),
          targetClockRevisionBefore: Number.MAX_SAFE_INTEGER,
          targetClockRefAfter: clockRef(
            "clock-split",
            Number.MAX_SAFE_INTEGER + 1,
          ),
          targetClockRevisionAfter: Number.MAX_SAFE_INTEGER + 1,
        }),
      ),
    /Revision/,
  );
});

test("Split and Rejoin bind campaign, command, digest, generation and pin direction", () => {
  const before = initialize(),
    foreign = splitScene(
      before,
      commandBase("split-scene", {
        campaignId: "campaign-other",
        expectedPartyRevision: 1,
        expectedFocusRevision: 1,
        sourceSceneId: "scene-primary",
        expectedSourceRevision: 0,
        targetSceneId: "scene-split",
        targetClockRef: clockRef("clock-split"),
        characterIds: ["character-b"],
        title: "Foreign",
        clockContribution: forkContribution({ campaignId: "campaign-other" }),
      }),
    );
  assert.equal(foreign.status, "rejected");
  assert.equal(
    foreign.status === "rejected" && foreign.reason,
    "foreign-campaign",
  );
  assert.deepEqual(foreign.state, before);

  const wrongDigest = splitScene(
    before,
    commandBase("split-scene", {
      expectedPartyRevision: 1,
      expectedFocusRevision: 1,
      sourceSceneId: "scene-primary",
      expectedSourceRevision: 0,
      targetSceneId: "scene-split",
      targetClockRef: clockRef("clock-split"),
      characterIds: ["character-b"],
      title: "Wrong digest",
      clockContribution: forkContribution({ commandDigest: "digest-other" }),
    }),
  );
  assert.equal(wrongDigest.status, "rejected");
  assert.deepEqual(wrongDigest.state, before);

  const wrongCommand = splitScene(
    before,
    commandBase("split-scene", {
      expectedPartyRevision: 1,
      expectedFocusRevision: 1,
      sourceSceneId: "scene-primary",
      expectedSourceRevision: 0,
      targetSceneId: "scene-split",
      targetClockRef: clockRef("clock-split"),
      characterIds: ["character-b"],
      title: "Wrong command",
      clockContribution: forkContribution({ commandId: "command-other" }),
    }),
  );
  assert.equal(wrongCommand.status, "rejected");
  assert.deepEqual(wrongCommand.state, before);

  const otherGenerationRef = {
      ...clockRef("clock-split"),
      generationId: "clock-generation-other",
    },
    wrongGeneration = splitScene(
      before,
      commandBase("split-scene", {
        expectedPartyRevision: 1,
        expectedFocusRevision: 1,
        sourceSceneId: "scene-primary",
        expectedSourceRevision: 0,
        targetSceneId: "scene-split",
        targetClockRef: clockRef("clock-split"),
        characterIds: ["character-b"],
        title: "Wrong generation",
        clockContribution: forkContribution({
          ownerIdentity: {
            ownerId: "clock",
            generationId: "clock-generation-other",
          },
          sourceClockRef: {
            ...clockRef("clock-primary"),
            generationId: "clock-generation-other",
          },
          targetClockRefAfter: otherGenerationRef,
        }),
      }),
    );
  assert.equal(wrongGeneration.status, "rejected");
  assert.deepEqual(wrongGeneration.state, before);

  const split = splitPrimary(),
    swapped = rejoinScenes(
      split,
      commandBase("rejoin-scenes", {
        expectedPartyRevision: 2,
        expectedFocusRevision: 1,
        sourceSceneId: "scene-primary",
        expectedSourceRevision: 1,
        targetSceneId: "scene-split",
        expectedTargetRevision: 0,
        clockContribution: mergeContribution({
          sourceClockRef: clockRef("clock-split"),
          targetClockRefBefore: clockRef("clock-primary"),
          targetClockRefAfter: clockRef("clock-primary", 1),
        }),
      }),
    );
  assert.equal(swapped.status, "rejected");
  assert.deepEqual(swapped.state, split);
});

test("all three backward Clock choices advance only the Target Clock once", () => {
  const choices = [
    {
      choice: "source-confirmed",
      sourceClockValue: clockValue("-6"),
      targetClockValueBefore: clockValue("3600"),
      targetClockValueAfter: clockValue("-6"),
    },
    {
      choice: "target-confirmed",
      sourceClockValue: clockValue("3600"),
      targetClockValueBefore: clockValue("-6"),
      targetClockValueAfter: clockValue("-6"),
    },
    {
      choice: "manual-confirmed",
      sourceClockValue: clockValue("3600"),
      targetClockValueBefore: clockValue("3600"),
      targetClockValueAfter: clockValue("-6"),
    },
  ] as const;
  for (const choice of choices) {
    const state = splitPrimary(),
      command = commandBase("rejoin-scenes", {
        expectedPartyRevision: 2,
        expectedFocusRevision: 1,
        sourceSceneId: "scene-primary",
        expectedSourceRevision: 1,
        targetSceneId: "scene-split",
        expectedTargetRevision: 0,
        clockContribution: mergeContribution(choice),
      }),
      first = rejoinScenes(state, command),
      second = rejoinScenes(state, command);
    assert.equal(first.status, "applied");
    assert.deepEqual(second, first);
    if (first.status !== "applied") continue;
    assert.equal(first.state.scenes[0]?.source.sceneClockRef?.ownerRevision, 0);
    assert.equal(first.state.scenes[1]?.source.sceneClockRef?.ownerRevision, 1);
    assert.equal(
      first.decision.transition?.clockContribution.targetClockValueAfter
        .canonicalValue,
      "-6",
    );
  }
});

test("Split and Rejoin overflow or cancel before any semantic state change", () => {
  const before = initialize(),
    cancelled = splitScene(
      before,
      commandBase("split-scene", {
        cancelled: true,
        expectedPartyRevision: 1,
        expectedFocusRevision: 1,
        sourceSceneId: "scene-primary",
        expectedSourceRevision: 0,
        targetSceneId: "scene-split",
        targetClockRef: clockRef("clock-split"),
        characterIds: ["character-b"],
        title: "Cancelled",
        clockContribution: forkContribution(),
      }),
    );
  assert.equal(cancelled.status, "cancelled");
  assert.deepEqual(cancelled.state, before);

  const overflowRaw = structuredClone(splitPrimary()) as Record<string, any>;
  overflowRaw.scenes[0].source.sceneRevision = Number.MAX_SAFE_INTEGER;
  overflowRaw.party.characters[0].sceneAssignment.sceneRevision =
    Number.MAX_SAFE_INTEGER;
  overflowRaw.focus.sceneRevision = Number.MAX_SAFE_INTEGER;
  const overflow = parseLiveSessionAggregateState(overflowRaw);
  assert.throws(
    () =>
      rejoinScenes(
        overflow,
        commandBase("rejoin-scenes", {
          expectedPartyRevision: 2,
          expectedFocusRevision: 1,
          sourceSceneId: "scene-primary",
          expectedSourceRevision: Number.MAX_SAFE_INTEGER,
          targetSceneId: "scene-split",
          expectedTargetRevision: 0,
          clockContribution: mergeContribution({
            sourceSceneRevisionBefore: Number.MAX_SAFE_INTEGER,
            sourceSceneRevisionAfter: Number.MAX_SAFE_INTEGER,
          }),
        }),
      ),
    /Revision/,
  );
  assert.equal(overflow.scenes[0]?.source.lifecycle, "active");
});

test("Split and Rejoin reject stale Clock receipts, aliases and Source pending membership unchanged", () => {
  const before = initialize(),
    alias = splitScene(
      before,
      commandBase("split-scene", {
        expectedPartyRevision: 1,
        expectedFocusRevision: 1,
        sourceSceneId: "scene-primary",
        expectedSourceRevision: 0,
        targetSceneId: "scene-split",
        targetClockRef: clockRef("clock-primary"),
        characterIds: ["character-b"],
        title: "Alias",
        clockContribution: forkContribution({
          targetClockRefAfter: clockRef("clock-primary"),
        }),
      }),
    );
  assert.equal(alias.status, "rejected");
  assert.equal(alias.status === "rejected" && alias.reason, "id-collision");
  assert.deepEqual(alias.state, before);

  const split = splitPrimary(),
    stale = rejoinScenes(
      split,
      commandBase("rejoin-scenes", {
        expectedPartyRevision: 2,
        expectedFocusRevision: 1,
        sourceSceneId: "scene-primary",
        expectedSourceRevision: 1,
        targetSceneId: "scene-split",
        expectedTargetRevision: 0,
        clockContribution: mergeContribution({
          sourceSceneRevisionAfter: 9,
        }),
      }),
    );
  assert.equal(stale.status, "rejected");
  assert.equal(stale.status === "rejected" && stale.reason, "stale-scene");
  assert.deepEqual(stale.state, split);

  const pendingRaw = structuredClone(split) as Record<string, any>;
  pendingRaw.party.characters[0].sceneAssignment = {
    status: "pending",
    commandId: "command-pending-a",
    ownerId: "scene-owner",
  };
  pendingRaw.scenes[0].source.characterIds = [];
  pendingRaw.scenes[0].source.pendingAssignments = [
    {
      characterId: "character-a",
      commandId: "command-pending-a",
      ownerId: "scene-owner",
    },
  ];
  const pending = parseLiveSessionAggregateState(pendingRaw),
    rejected = rejoinScenes(
      pending,
      commandBase("rejoin-scenes", {
        expectedPartyRevision: 2,
        expectedFocusRevision: 1,
        sourceSceneId: "scene-primary",
        expectedSourceRevision: 1,
        targetSceneId: "scene-split",
        expectedTargetRevision: 0,
        clockContribution: mergeContribution(),
      }),
    );
  assert.equal(rejected.status, "rejected");
  assert.equal(
    rejected.status === "rejected" && rejected.reason,
    "invalid-membership",
  );
  assert.deepEqual(rejected.state, pending);
});

test("aggregate state requires one unique Clock identity per active Scene", () => {
  const split = structuredClone(splitPrimary()) as Record<string, any>;
  delete split.scenes[0].source.sceneClockRef;
  assert.throws(
    () => parseLiveSessionAggregateState(split),
    /benötigt genau eine SceneClock/,
  );

  const duplicate = structuredClone(splitPrimary()) as Record<string, any>;
  duplicate.scenes[1].source.sceneClockRef = {
    ...duplicate.scenes[0].source.sceneClockRef,
    ownerRevision: 99,
  };
  assert.throws(
    () => parseLiveSessionAggregateState(duplicate),
    /doppelte Kennungen/,
  );
});

for (const [name, edit] of [
  ["title", (scene: Record<string, any>) => { scene.title = "Live title"; }],
  ["notes", (scene: Record<string, any>) => { scene.notes = "  New live prose.  \r\n"; }],
  ["location", (scene: Record<string, any>) => { scene.source.locationRef = { ownerId: "locations", referenceId: "forest", ownerRevision: 8 }; }],
  ["content pins", (scene: Record<string, any>) => { scene.source.contentPins = [{ ownerId: "notes", referenceId: "note-b", ownerRevision: 9 }]; }],
] as const) test(`live ${name} survives JSON reopen with intact immutable preparation provenance`, () => {
  const prepared = prepare(), moved = moveCharacters(prepared, commandBase("move-characters", {
    expectedPartyRevision: prepared.party.partyRevision, expectedFocusRevision: prepared.focus.focusRevision,
    sourceSceneId: "scene-primary", targetSceneId: "scene-prepared", expectedSourceRevision: 0, expectedTargetRevision: 0,
    characterIds: ["character-b"],
  }));
  assert.equal(moved.status, "applied");
  if (moved.status !== "applied") throw new Error("activation failed");
  const before = moved.state, origin = before.scenes[1]!.preparedFrom, raw = structuredClone(before) as Record<string, any>;
  edit(raw.scenes[1]); raw.scenes[1].source.sceneRevision++;
  raw.party.partyRevision++;
  for (const character of raw.party.characters) if (character.sceneAssignment.liveSceneId === "scene-prepared") character.sceneAssignment.sceneRevision = raw.scenes[1].source.sceneRevision;
  const parsed = parseLiveSessionAggregateState(raw), reopened = parseLiveSessionAggregateState(JSON.parse(JSON.stringify(parsed)));
  const scene = reopened.scenes[1]!;
  assert.equal(scene.title, raw.scenes[1].title); assert.equal(scene.notes, raw.scenes[1].notes);
  assert.deepEqual(scene.source.locationRef, raw.scenes[1].source.locationRef);
  assert.deepEqual(scene.source.contentPins, raw.scenes[1].source.contentPins);
  assert.deepEqual(scene.preparedFrom, origin); assert.deepEqual(scene.encounterPlanRef, before.scenes[1]!.encounterPlanRef);
  assert(frozenGraph(reopened));
  raw.scenes[1].preparedFrom.notes = "mutated input alias";
  assert.deepEqual(scene.preparedFrom, origin);
  for (const state of [prepared, reopened]) {
    const foreign = structuredClone(state) as Record<string, any>; foreign.scenes[1].preparedFrom.campaignId = "campaign-foreign";
    assert.throws(() => parseLiveSessionAggregateState(foreign), /Preparation-Provenienz/);
  }
  const invalid = structuredClone(reopened) as Record<string, any>; invalid.scenes[1].notes = 42;
  assert.throws(() => parseLiveSessionAggregateState(invalid));
});
