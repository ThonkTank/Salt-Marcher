import assert from "node:assert/strict";
import test from "node:test";
import {
  createPreparedRuntime,
  createUninitializedLiveSessionState,
  initializeLiveSession,
  moveCharacters,
  parseLiveSessionAggregateState,
  parseReconciliationDuty,
} from "../../src/features/live-session";

function frozenGraph(value: unknown, seen = new Set<object>()): boolean {
  if (!value || typeof value !== "object" || seen.has(value)) return true;
  seen.add(value);
  return (
    Object.isFrozen(value) &&
    Object.values(value).every((child) => frozenGraph(child, seen))
  );
}

function party() {
  return {
    kind: "party-projection",
    version: 1,
    campaignId: "campaign-a",
    partyRevision: 0,
    characters: [
      {
        characterId: "character-a",
        active: true,
        profile: { name: "A" },
        progress: {
          currentXp: 0,
          xpSinceLongRest: 0,
          xpSinceShortRest: 0,
        },
        sceneAssignment: { status: "not-started" },
      },
      {
        characterId: "character-b",
        active: true,
        profile: { name: "B" },
        progress: {
          currentXp: 0,
          xpSinceLongRest: 0,
          xpSinceShortRest: 0,
        },
        sceneAssignment: { status: "not-started" },
      },
    ],
  };
}

function command(kind: string, overrides: Record<string, unknown>) {
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

function baseState() {
  const initialized = initializeLiveSession(
    createUninitializedLiveSessionState(party()),
    command("initialize-live-session", {
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
  if (initialized.status !== "applied") throw new Error("init failed");
  const prepared = createPreparedRuntime(
    initialized.state,
    command("prepare-runtime", {
      commandId: "command-prepare",
      commandDigest: "digest-prepare",
      expectedPartyRevision: 1,
      expectedFocusRevision: 1,
      liveSceneId: "scene-target",
      sceneClockRef: {
        ownerId: "clock",
        generationId: "clock-generation",
        referenceId: "clock-target",
        ownerRevision: 0,
      },
      snapshot: {
        kind: "preparation-snapshot",
        version: 1,
        campaignId: "campaign-a",
        preparationId: "preparation-a",
        preparationRevision: 1,
        source: {
          ownerId: "planner",
          sourceId: "plan-a",
          sourceRevision: 1,
        },
        title: "Target",
        notes: "",
        contentPins: [],
      },
    }),
  );
  assert.equal(prepared.status, "applied");
  if (prepared.status !== "applied") throw new Error("prepare failed");
  return prepared.state;
}

function maskState() {
  const raw = structuredClone(baseState()) as Record<string, any>,
    source = raw.scenes[0].source;
  source.maskRefs = [
    {
      maskId: "mask-shared",
      kind: "encounter",
      ownerId: "owner-a",
      generationId: "generation-a",
      ownerRevision: 5,
      lifecycle: "active",
    },
    {
      maskId: "mask-a-only",
      kind: "encounter",
      ownerId: "owner-a",
      generationId: "generation-a",
      ownerRevision: 5,
      lifecycle: "suspended",
    },
    {
      maskId: "mask-shared",
      kind: "chase",
      ownerId: "owner-b",
      generationId: "generation-b",
      ownerRevision: 7,
      lifecycle: "active",
    },
  ];
  source.maskParticipationProjections = [
    {
      kind: "mask-participation-projection",
      version: 1,
      campaignId: "campaign-a",
      liveSceneId: "scene-primary",
      maskId: "mask-shared",
      maskKind: "encounter",
      ownerIdentity: { ownerId: "owner-a", generationId: "generation-a" },
      ownerRevision: 5,
      participantCharacterIds: ["character-b", "character-a"],
      lifecycle: "active",
    },
    {
      kind: "mask-participation-projection",
      version: 1,
      campaignId: "campaign-a",
      liveSceneId: "scene-primary",
      maskId: "mask-a-only",
      maskKind: "encounter",
      ownerIdentity: { ownerId: "owner-a", generationId: "generation-a" },
      ownerRevision: 5,
      participantCharacterIds: ["character-a"],
      lifecycle: "suspended",
    },
    {
      kind: "mask-participation-projection",
      version: 1,
      campaignId: "campaign-a",
      liveSceneId: "scene-primary",
      maskId: "mask-shared",
      maskKind: "chase",
      ownerIdentity: { ownerId: "owner-b", generationId: "generation-b" },
      ownerRevision: 7,
      participantCharacterIds: ["character-b"],
      lifecycle: "active",
    },
  ];
  source.reconciliations = [
    {
      ownerId: "owner-a",
      generationId: "generation-a",
      status: "current",
      ownerRevision: 5,
    },
    {
      ownerId: "owner-b",
      generationId: "generation-b",
      status: "current",
      ownerRevision: 7,
    },
  ];
  return raw;
}

function move(state: unknown, ids: readonly string[], suffix = "mask") {
  return moveCharacters(
    state,
    command("move-characters", {
      commandId: `command-${suffix}`,
      commandDigest: `digest-${suffix}`,
      expectedPartyRevision: suffix === "mask" ? 1 : 2,
      expectedFocusRevision: 1,
      sourceSceneId: "scene-primary",
      targetSceneId: "scene-target",
      expectedSourceRevision: suffix === "mask" ? 0 : 1,
      expectedTargetRevision: suffix === "mask" ? 0 : 1,
      characterIds: ids,
    }),
  );
}

test("mask reconciliation groups by generation and preserves exact per-mask incidence", () => {
  const input = maskState(),
    state = parseLiveSessionAggregateState(input);
  input.scenes[0].source.maskParticipationProjections[0].participantCharacterIds.push(
    "mutated",
  );
  assert.deepEqual(
    state.scenes[0]?.source.maskParticipationProjections[0]
      ?.participantCharacterIds,
    ["character-b", "character-a"],
  );
  const result = move(state, ["character-b"]);
  assert.equal(result.status, "applied");
  if (result.status !== "applied") return;
  const duties = result.decision.sceneCleanup!.reconciliations;
  assert.equal(duties.length, 2);
  assert.deepEqual(
    duties.map((duty) => {
      assert.equal(duty.kind, "mask-owner-reconciliation");
      if (
        duty.kind !== "mask-owner-reconciliation" ||
        duty.scope.kind !== "complete-mask-delta"
      )
        throw new Error("expected complete mask duty");
      return {
        owner: duty.ownerIdentity,
        delivery: duty.delivery,
        affected: duty.affectedCharacterIds,
        masks: duty.scope.masks.map((mask) => ({
          id: mask.maskId,
          participants: mask.participantCharacterIds,
          before: mask.lifecycleBefore,
          after: mask.lifecycleAfter,
        })),
      };
    }),
    [
      {
        owner: { ownerId: "owner-a", generationId: "generation-a" },
        delivery: "required",
        affected: ["character-b"],
        masks: [
          {
            id: "mask-shared",
            participants: ["character-b"],
            before: "active",
            after: "active",
          },
        ],
      },
      {
        owner: { ownerId: "owner-b", generationId: "generation-b" },
        delivery: "required",
        affected: ["character-b"],
        masks: [
          {
            id: "mask-shared",
            participants: ["character-b"],
            before: "active",
            after: "active",
          },
        ],
      },
    ],
  );
  const source = result.state.scenes[0]!.source,
    target = result.state.scenes[1]!.source;
  assert.deepEqual(source.maskParticipationProjections, []);
  assert(source.reconciliations.every((entry) => entry.status === "pending"));
  assert.deepEqual(target.maskRefs, []);
  assert.deepEqual(target.maskParticipationProjections, []);
  assert.equal(result.state.pendingReconciliations.length, 2);
  assert(frozenGraph(result));
  for (const forbidden of [
    "completion",
    "transfer",
    "targetMask",
    "hitPoints",
    "initiative",
    "effects",
  ])
    assert.equal(JSON.stringify(duties).includes(forbidden), false);
});

test("source retirement names every source mask and archives with empty live participation", () => {
  const result = move(parseLiveSessionAggregateState(maskState()), [
    "character-b",
    "character-a",
  ]);
  assert.equal(result.status, "applied");
  if (result.status !== "applied") return;
  const first = result.decision.sceneCleanup!.reconciliations[0];
  assert.equal(first?.kind, "mask-owner-reconciliation");
  if (
    first?.kind !== "mask-owner-reconciliation" ||
    first.scope.kind !== "complete-mask-delta"
  )
    return;
  assert.equal(first.scope.operation, "source-retired");
  assert.deepEqual(
    first.scope.masks.map((mask) => ({
      id: mask.maskId,
      participants: mask.participantCharacterIds,
      lifecycleAfter: mask.lifecycleAfter,
    })),
    [
      {
        id: "mask-shared",
        participants: ["character-b", "character-a"],
        lifecycleAfter: "archived",
      },
      {
        id: "mask-a-only",
        participants: ["character-a"],
        lifecycleAfter: "archived",
      },
    ],
  );
  assert.equal(result.state.scenes[0]?.source.lifecycle, "retired");
  assert.deepEqual(
    result.state.scenes[1]?.source.maskParticipationProjections,
    [],
  );
});

test("mask source parser fails closed for missing generation, split revisions and foreign participants", () => {
  const missingGeneration = maskState();
  delete missingGeneration.scenes[0].source.maskRefs[0].generationId;
  assert.throws(
    () => parseLiveSessionAggregateState(missingGeneration),
    /unvollständige|generationId/,
  );

  const splitRevision = maskState();
  splitRevision.scenes[0].source.maskRefs[1].ownerRevision = 6;
  assert.throws(
    () => parseLiveSessionAggregateState(splitRevision),
    /widersprüchliche Masken-OwnerRevisionen/,
  );

  const foreignParticipant = maskState();
  foreignParticipant.scenes[0].source.maskParticipationProjections[0].participantCharacterIds =
    ["foreign-character"];
  assert.throws(
    () => parseLiveSessionAggregateState(foreignParticipant),
    /scene-fremde Maskenteilnahme/,
  );

  const archivedParticipant = maskState();
  archivedParticipant.scenes[0].source.maskRefs[0].lifecycle = "archived";
  archivedParticipant.scenes[0].source.maskParticipationProjections[0].lifecycle =
    "archived";
  assert.throws(
    () => parseLiveSessionAggregateState(archivedParticipant),
    /archivierten Zustand/,
  );
});

test("duty parser rejects forbidden fields and late generation changes", () => {
  const result = move(parseLiveSessionAggregateState(maskState()), [
    "character-b",
  ]);
  assert.equal(result.status, "applied");
  if (result.status !== "applied") return;
  const duty = structuredClone(result.state.pendingReconciliations[0]) as any;
  assert(frozenGraph(parseReconciliationDuty(duty)));
  assert.throws(
    () => parseReconciliationDuty({ ...duty, completion: true }),
    /unbekannte|unvollständige/,
  );
  const staleGeneration = structuredClone(result.state) as Record<string, any>;
  staleGeneration.pendingReconciliations[0].ownerIdentity.generationId =
    "other-generation";
  assert.throws(
    () => parseLiveSessionAggregateState(staleGeneration),
    /ungebundene Masken-Reconciliation/,
  );
});

test("a later move retains the first matrix and emits unresolved owner scopes", () => {
  const first = move(parseLiveSessionAggregateState(maskState()), [
    "character-b",
  ]);
  assert.equal(first.status, "applied");
  if (first.status !== "applied") return;
  const second = move(first.state, ["character-a"], "mask-second");
  assert.equal(second.status, "applied");
  if (second.status !== "applied") return;
  assert.equal(second.state.pendingReconciliations.length, 4);
  const later = second.decision.sceneCleanup!.reconciliations;
  assert(
    later.every(
      (duty) =>
        duty.kind === "mask-owner-reconciliation" &&
        duty.delivery === "pending" &&
        duty.scope.kind === "owner-scope-unresolved" &&
        duty.scope.cause === "pending",
    ),
  );
  assert.deepEqual(
    first.state.pendingReconciliations.slice(0, 2),
    second.state.pendingReconciliations.slice(0, 2),
  );
});
