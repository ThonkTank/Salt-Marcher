import assert from "node:assert/strict";
import test from "node:test";
import {
  createPreparedRuntime,
  createUninitializedLiveSessionState,
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

function commandBase(
  kind: string,
  overrides: Record<string, unknown> = {},
) {
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
  assert.deepEqual(before.party.characters.map((entry) => entry.sceneAssignment.status), [
    "not-started",
    "not-started",
    "inactive",
  ]);
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
  assert.equal(result.status === "rejected" && result.reason, "not-initialized");
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
    sourceLifecycleBefore: "active",
    sourceLifecycleAfter: "active",
    action: "remove-participants",
    characterIds: ["character-b"],
    status: "pending",
  });
  assert.deepEqual(
    result.state.scenes[0]?.source.reconciliations,
    [
      {
        ownerId: "encounter-owner",
        status: "pending",
        commandId: "command-move-unavailable",
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
