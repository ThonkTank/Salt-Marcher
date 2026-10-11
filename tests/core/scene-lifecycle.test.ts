import assert from "node:assert/strict";
import test from "node:test";
import {
  activatePartyCharacter,
  createPreparedRuntime,
  createUninitializedLiveSessionState,
  deactivatePartyCharacter,
  initializeLiveSession,
  moveCharacters,
  parseLiveSessionAggregateState,
  setFocus,
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
  return {
    kind,
    version: 1,
    campaignId: "campaign-a",
    commandId: `command-${kind}`,
    commandDigest: `digest-${kind}`,
    expectedPartyRevision: 0,
    expectedFocusRevision: 0,
    cancelled: false,
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
      ownerRevision: 3,
      lifecycle: "active",
    },
  ];
  raw.scenes[0].source.reconciliations = [
    { ownerId: "encounter-owner", status: "unavailable" },
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
    ownerId: "encounter-owner",
    campaignId: "campaign-a",
    commandId: "command-move-unavailable",
    commandDigest: "digest-move-unavailable",
    sourceSceneId: "scene-primary",
    targetSceneId: "scene-prepared",
    expectedSourceRevision: 0,
    expectedTargetRevision: 0,
    expectedOwnerRevision: 3,
    sourceLifecycleBefore: "active",
    sourceLifecycleAfter: "active",
    action: "remove-participants",
    characterIds: ["character-b"],
    maskIds: ["mask-a"],
    status: "pending",
  });
  assert.deepEqual(result.state.scenes[0]?.source.reconciliations, [
    {
      ownerId: "encounter-owner",
      status: "pending",
      commandId: "command-move-unavailable",
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
  assert.deepEqual(
    second.state.pendingReconciliations.map((duty) => ({
      commandId: duty.commandId,
      expectedOwnerRevision: duty.expectedOwnerRevision,
      action: duty.action,
      characterIds: duty.characterIds,
      maskIds: duty.maskIds,
    })),
    [
      {
        commandId: "command-move-unavailable",
        expectedOwnerRevision: 3,
        action: "remove-participants",
        characterIds: ["character-b"],
        maskIds: ["mask-a"],
      },
      {
        commandId: "command-move-unavailable-2",
        expectedOwnerRevision: 3,
        action: "archive-source",
        characterIds: ["character-a"],
        maskIds: ["mask-a"],
      },
    ],
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
    ownerId: "weather-owner",
    campaignId: "campaign-a",
    commandId: "command-weather-pending",
    commandDigest: "digest-weather-pending",
    sourceSceneId: "scene-primary",
    targetSceneId: "scene-prepared",
    expectedSourceRevision: 0,
    expectedTargetRevision: 0,
    expectedOwnerRevision: 7,
    sourceLifecycleBefore: "active",
    sourceLifecycleAfter: "active",
    action: "remove-participants",
    characterIds: ["character-b"],
    maskIds: [],
    status: "pending",
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
      ownerRevision: 2,
      lifecycle: "active",
    },
    {
      maskId: "shared-mask-id",
      kind: "chase",
      ownerId: "owner-b",
      ownerRevision: 3,
      lifecycle: "active",
    },
  ];
  raw.scenes[0].source.reconciliations = [
    { ownerId: "owner-a", status: "unavailable", ownerRevision: 2 },
    { ownerId: "owner-b", status: "unavailable", ownerRevision: 3 },
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
      ownerId: duty.ownerId,
      expectedOwnerRevision: duty.expectedOwnerRevision,
      maskIds: duty.maskIds,
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
  changedPins.scenes[1].source.contentPins = [];
  assert.throws(
    () => parseLiveSessionAggregateState(withoutEncounter),
    /encounterPlanRef widerspricht/,
  );
  assert.throws(
    () => parseLiveSessionAggregateState(changedPins),
    /contentPins widersprechen/,
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
    ownerId: "music-owner",
    campaignId: "campaign-a",
    commandId: "command-deactivate-with-music",
    commandDigest: "digest-deactivate-with-music",
    sourceSceneId: "scene-primary",
    targetSceneId: null,
    expectedSourceRevision: 0,
    expectedTargetRevision: null,
    expectedOwnerRevision: 6,
    sourceLifecycleBefore: "active",
    sourceLifecycleAfter: "active",
    action: "remove-participants",
    characterIds: ["character-a"],
    maskIds: [],
    status: "pending",
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
    ownerId: "music-owner",
    campaignId: "campaign-a",
    commandId: "command-deactivate-pending-a",
    commandDigest: "digest-deactivate-pending-a",
    sourceSceneId: "scene-primary",
    targetSceneId: null,
    expectedSourceRevision: 0,
    expectedTargetRevision: null,
    expectedOwnerRevision: 4,
    sourceLifecycleBefore: "active",
    sourceLifecycleAfter: "active",
    action: "remove-participants",
    characterIds: ["character-a"],
    maskIds: [],
    status: "pending",
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
