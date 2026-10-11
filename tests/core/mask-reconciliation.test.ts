import assert from "node:assert/strict";
import test from "node:test";
import {
  createPreparedRuntime,
  createUninitializedLiveSessionState,
  deactivatePartyCharacter,
  initializeLiveSession,
  moveCharacters,
  parseLiveSceneSource,
  parseLiveSessionAggregateState,
  parseMaskOwnerPreparedContribution,
  parseReconciliationDuty,
  projectLiveScene,
  rejoinScenes,
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
      receiptLedgerBaseRevision: 5,
    },
    {
      ownerId: "owner-b",
      generationId: "generation-b",
      status: "current",
      ownerRevision: 7,
      receiptLedgerBaseRevision: 7,
    },
  ];
  return raw;
}

function threeCharacterMaskState() {
  const raw = maskState(),
    character = structuredClone(raw.party.characters[0]);
  character.characterId = "character-c";
  character.profile.name = "C";
  raw.party.characters.push(character);
  raw.scenes[0].source.characterIds.push("character-c");
  raw.scenes[0].source.maskParticipationProjections[0].participantCharacterIds.push(
    "character-c",
  );
  raw.scenes[0].source.maskParticipationProjections[2].participantCharacterIds.push(
    "character-c",
  );
  return raw;
}

function preparedMaskContributions(
  stateValue: unknown,
  ids: readonly string[],
  commandId: string,
  commandDigest: string,
) {
  const state = parseLiveSessionAggregateState(stateValue) as any,
    source = state.scenes.find(
      (scene: any) => scene.source.liveSceneId === "scene-primary",
    ).source,
    selected = new Set(ids),
    affectedCharacterIds = state.party.characters
      .filter((character: any) => selected.has(character.characterId))
      .map((character: any) => character.characterId),
    retired = source.characterIds.every((id: string) => selected.has(id)),
    byOwner = new Map<string, any[]>();
  for (const projection of source.maskParticipationProjections) {
    const key = `${projection.ownerIdentity.ownerId}\u0000${projection.ownerIdentity.generationId}`,
      group = byOwner.get(key);
    if (group) group.push(projection);
    else byOwner.set(key, [projection]);
  }
  return [...byOwner.values()].flatMap((projections) => {
    const first = projections[0],
      recordedOwner = source.reconciliations.find(
        (entry: any) =>
          entry.ownerId === first.ownerIdentity.ownerId &&
          entry.generationId === first.ownerIdentity.generationId,
      ),
      owner =
        recordedOwner ??
        ({
          ownerId: first.ownerIdentity.ownerId,
          generationId: first.ownerIdentity.generationId,
          status: "current",
          ownerRevision: first.ownerRevision,
        } as const);
    if (owner?.status !== "current") return [];
    const beforeMasks = projections.map((projection) => ({
        maskId: projection.maskId,
        maskKind: projection.maskKind,
        lifecycle: projection.lifecycle,
        participantCharacterIds: [...projection.participantCharacterIds],
      })),
      masks = beforeMasks.flatMap((mask) => {
        const participants = mask.participantCharacterIds.filter((id: string) =>
          selected.has(id),
        );
        if (!retired && participants.length === 0) return [];
        return [
          {
            maskId: mask.maskId,
            maskKind: mask.maskKind,
            expectedOwnerRevision: owner.ownerRevision,
            lifecycleBefore: mask.lifecycle,
            participantCharacterIds: participants,
            lifecycleAfter: retired ? "archived" : mask.lifecycle,
          },
        ];
      });
    if (masks.length === 0) return [];
    const targetScene = state.scenes.find((scene: any) =>
        commandId.includes("rejoin")
          ? scene.source.liveSceneId === "scene-split"
          : scene.source.liveSceneId === "scene-target",
      ),
      target = commandId.includes("deactivate")
        ? { kind: "none" as const }
        : commandId.includes("split")
          ? {
              kind: "created" as const,
              liveSceneId: "scene-split",
              revisionAfter: 0,
            }
          : {
              kind: "existing" as const,
              liveSceneId: targetScene.source.liveSceneId,
              revisionBefore: targetScene.source.sceneRevision,
              revisionAfter: targetScene.source.sceneRevision + 1,
            };
    return [
      {
        kind: "mask-owner-prepared-contribution",
        version: 1,
        status: "prepared-unpublished",
        receiptId: `receipt-${commandId}-${owner.ownerId}`,
        campaignId: state.campaignId,
        commandId,
        commandDigest,
        partyRevisionBefore: state.party.partyRevision,
        partyRevisionAfter: state.party.partyRevision + 1,
        sourceSceneId: source.liveSceneId,
        sourceSceneRevisionBefore: source.sceneRevision,
        sourceSceneRevisionAfter: source.sceneRevision + 1,
        sourceLifecycleBefore: "active",
        sourceLifecycleAfter: retired ? "retired" : "active",
        target,
        ownerIdentity: {
          ownerId: owner.ownerId,
          generationId: owner.generationId,
        },
        ownerRevisionBefore: owner.ownerRevision,
        ownerRevisionAfter: owner.ownerRevision + 1,
        affectedCharacterIds,
        scope: {
          kind: "complete-mask-delta",
          operation: retired ? "source-retired" : "remove-participants",
          masks,
        },
        beforeMasks,
        afterMasks: beforeMasks.map((mask) => ({
          ...mask,
          lifecycle: retired ? "archived" : mask.lifecycle,
          participantCharacterIds: retired
            ? []
            : mask.participantCharacterIds.filter(
                (id: string) => !selected.has(id),
              ),
        })),
      },
    ];
  });
}

function clockValue(value = "3600") {
  return {
    codecId: "smr07.elapsed-seconds",
    codecVersion: 1,
    canonicalValue: value,
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

function forkContribution() {
  return {
    kind: "clock-fork-create-contribution",
    version: 1,
    status: "prepared-unpublished",
    receiptId: "receipt-mask-clock-fork",
    campaignId: "campaign-a",
    commandId: "command-mask-split",
    commandDigest: "digest-mask-split",
    ownerIdentity: {
      ownerId: "clock",
      generationId: "clock-generation",
    },
    calendarDefinitionRef: {
      ownerId: "clock",
      referenceId: "calendar-a",
      ownerRevision: 1,
    },
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
  };
}

function mergeContribution() {
  return {
    kind: "clock-merge-contribution",
    version: 1,
    status: "prepared-unpublished",
    receiptId: "receipt-mask-clock-merge",
    campaignId: "campaign-a",
    commandId: "command-mask-rejoin",
    commandDigest: "digest-mask-rejoin",
    ownerIdentity: {
      ownerId: "clock",
      generationId: "clock-generation",
    },
    calendarDefinitionRef: {
      ownerId: "clock",
      referenceId: "calendar-a",
      ownerRevision: 1,
    },
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
    targetClockValueAfter: clockValue(),
    sourceDisposition: "archive",
    targetKind: "existing",
    choice: "source-confirmed",
  };
}

function move(state: unknown, ids: readonly string[], suffix = "mask") {
  const commandId = `command-${suffix}`,
    commandDigest = `digest-${suffix}`;
  return moveCharacters(
    state,
    command("move-characters", {
      commandId,
      commandDigest,
      expectedPartyRevision: suffix === "mask" ? 1 : 2,
      expectedFocusRevision: 1,
      sourceSceneId: "scene-primary",
      targetSceneId: "scene-target",
      expectedSourceRevision: suffix === "mask" ? 0 : 1,
      expectedTargetRevision: suffix === "mask" ? 0 : 1,
      characterIds: ids,
      maskOwnerContributions: preparedMaskContributions(
        state,
        ids,
        commandId,
        commandDigest,
      ),
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
  assert.deepEqual(
    source.maskParticipationProjections.map((projection) => ({
      ownerRevision: projection.ownerRevision,
      maskId: projection.maskId,
      participants: projection.participantCharacterIds,
    })),
    [
      {
        ownerRevision: 6,
        maskId: "mask-shared",
        participants: ["character-a"],
      },
      {
        ownerRevision: 6,
        maskId: "mask-a-only",
        participants: ["character-a"],
      },
      { ownerRevision: 8, maskId: "mask-shared", participants: [] },
    ],
  );
  assert(source.reconciliations.every((entry) => entry.status === "current"));
  assert(
    source.reconciliations.every(
      (entry) => entry.receiptId !== undefined && entry.commandId !== undefined,
    ),
  );
  assert.deepEqual(target.maskRefs, []);
  assert.deepEqual(target.maskParticipationProjections, []);
  assert.equal(result.state.pendingReconciliations.length, 0);
  assert(
    duties.every(
      (duty) =>
        duty.kind === "mask-owner-reconciliation" &&
        duty.preparedContribution?.status === "prepared-unpublished",
    ),
  );
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
    /widersprüchliche Masken-OwnerRevisionen|ungebundene Maskenprojektion/,
  );

  const foreignParticipant = maskState();
  foreignParticipant.scenes[0].source.maskParticipationProjections[0].participantCharacterIds =
    ["foreign-character"];
  assert.throws(
    () => parseLiveSessionAggregateState(foreignParticipant),
    /ungebundene|scene-fremde Maskenteilnahme/,
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
  const duty = structuredClone(
    result.decision.sceneCleanup!.reconciliations[0],
  ) as any;
  assert(frozenGraph(parseReconciliationDuty(duty)));
  assert.throws(
    () => parseReconciliationDuty({ ...duty, completion: true }),
    /unbekannte|unvollständige/,
  );
  const bareRequired = structuredClone(duty);
  delete bareRequired.preparedContribution;
  assert.throws(() => parseReconciliationDuty(bareRequired), /Cross-Bindings/);
  const staleGeneration = structuredClone(duty);
  staleGeneration.ownerIdentity.generationId = "other-generation";
  assert.throws(
    () => parseReconciliationDuty(staleGeneration),
    /Cross-Bindings/,
  );
});

test("a later move requires fresh owner receipts without creating pending scopes", () => {
  const first = move(parseLiveSessionAggregateState(maskState()), [
    "character-b",
  ]);
  assert.equal(first.status, "applied");
  if (first.status !== "applied") return;
  const second = move(first.state, ["character-a"], "mask-second");
  assert.equal(second.status, "applied");
  if (second.status !== "applied") return;
  assert.equal(first.state.pendingReconciliations.length, 0);
  assert.equal(second.state.pendingReconciliations.length, 0);
  const later = second.decision.sceneCleanup!.reconciliations;
  assert(
    later.every(
      (duty) =>
        duty.kind === "mask-owner-reconciliation" &&
        duty.delivery === "required" &&
        duty.scope.kind === "complete-mask-delta" &&
        duty.preparedContribution?.receiptId.includes("mask-second"),
    ),
  );
  assert(
    second.state.scenes[0]!.source.reconciliations.every(
      (entry) => entry.status === "current" && entry.receiptId !== undefined,
    ),
  );
});

test("direct source and projection boundaries reject foreign or pending mask participants", () => {
  const state = parseLiveSessionAggregateState(maskState()),
    source = structuredClone(state.scenes[0]!.source) as Record<string, any>,
    focus = {
      kind: "focus-projection",
      version: 1,
      status: "active",
      campaignId: "campaign-a",
      focusRevision: 1,
      liveSceneId: "scene-primary",
      sceneRevision: 0,
    };
  source.maskParticipationProjections[0].participantCharacterIds = [
    "foreign-character",
  ];
  assert.throws(() => parseLiveSceneSource(source), /ungebundene/);
  assert.deepEqual(projectLiveScene(source, focus), {
    status: "unavailable",
    reason: "invalid-scene",
  });

  const pending = structuredClone(state.scenes[0]!.source) as Record<
    string,
    any
  >;
  pending.pendingAssignments = [
    {
      characterId: "character-a",
      commandId: "command-pending-a",
      ownerId: "party-owner",
    },
  ];
  assert.throws(() => parseLiveSceneSource(pending), /pending/);
  assert.deepEqual(projectLiveScene(pending, focus), {
    status: "unavailable",
    reason: "invalid-scene",
  });

  const assignedAndPending = structuredClone(state.scenes[0]!.source) as Record<
    string,
    any
  >;
  assignedAndPending.maskRefs = [];
  assignedAndPending.maskParticipationProjections = [];
  assignedAndPending.reconciliations = [];
  assignedAndPending.pendingAssignments = [
    {
      characterId: "character-a",
      commandId: "command-pending-a",
      ownerId: "party-owner",
    },
  ];
  assert.throws(
    () => parseLiveSceneSource(assignedAndPending),
    /zugleich zugewiesene und pending/,
  );
  assert.deepEqual(projectLiveScene(assignedAndPending, focus), {
    status: "unavailable",
    reason: "invalid-scene",
  });

  const missingMaskRef = structuredClone(state.scenes[0]!.source) as Record<
    string,
    any
  >;
  missingMaskRef.maskRefs.shift();
  assert.throws(
    () => parseLiveSceneSource(missingMaskRef),
    /ungebundene Maskenprojektion/,
  );
  assert.deepEqual(projectLiveScene(missingMaskRef, focus), {
    status: "unavailable",
    reason: "invalid-scene",
  });

  const unavailableProjection = structuredClone(
    state.scenes[0]!.source,
  ) as Record<string, any>;
  unavailableProjection.reconciliations[0].status = "unavailable";
  delete unavailableProjection.reconciliations[0].receiptLedgerBaseRevision;
  assert.throws(
    () => parseLiveSceneSource(unavailableProjection),
    /ungebundene Maskenprojektion|current Maskensnapshot/,
  );
  assert.deepEqual(projectLiveScene(unavailableProjection, focus), {
    status: "unavailable",
    reason: "invalid-scene",
  });

  const reorderedProjection = structuredClone(
    state.scenes[0]!.source,
  ) as Record<string, any>;
  [
    reorderedProjection.maskParticipationProjections[0],
    reorderedProjection.maskParticipationProjections[1],
  ] = [
    reorderedProjection.maskParticipationProjections[1],
    reorderedProjection.maskParticipationProjections[0],
  ];
  assert.throws(
    () => parseLiveSceneSource(reorderedProjection),
    /Projektionsreihenfolge/,
  );
  assert.deepEqual(projectLiveScene(reorderedProjection, focus), {
    status: "unavailable",
    reason: "invalid-scene",
  });
});

test("prepared owner contribution binds receipt, full matrix, ordering and retry", () => {
  const state = parseLiveSessionAggregateState(maskState()),
    contributions = preparedMaskContributions(
      state,
      ["character-b"],
      "command-mask",
      "digest-mask",
    ),
    contribution = contributions[0]!;
  assert(frozenGraph(parseMaskOwnerPreparedContribution(contribution)));

  const changedAfter = structuredClone(contribution) as Record<string, any>;
  changedAfter.afterMasks[0].participantCharacterIds = [];
  assert.throws(
    () => parseMaskOwnerPreparedContribution(changedAfter),
    /Prepared-Vertrag/,
  );

  const changedParty = structuredClone(contributions) as Record<string, any>[];
  changedParty[0]!.partyRevisionBefore = 2;
  changedParty[0]!.partyRevisionAfter = 3;
  assert.throws(
    () =>
      moveCharacters(
        state,
        command("move-characters", {
          commandId: "command-mask",
          commandDigest: "digest-mask",
          expectedPartyRevision: 1,
          expectedFocusRevision: 1,
          sourceSceneId: "scene-primary",
          targetSceneId: "scene-target",
          expectedSourceRevision: 0,
          expectedTargetRevision: 0,
          characterIds: ["character-b"],
          maskOwnerContributions: changedParty,
        }),
      ),
    /Maskenbeitrag/,
  );

  const changedTarget = structuredClone(contributions) as Record<string, any>[];
  changedTarget[0]!.target.liveSceneId = "scene-other";
  assert.throws(
    () =>
      moveCharacters(
        state,
        command("move-characters", {
          commandId: "command-mask",
          commandDigest: "digest-mask",
          expectedPartyRevision: 1,
          expectedFocusRevision: 1,
          sourceSceneId: "scene-primary",
          targetSceneId: "scene-target",
          expectedSourceRevision: 0,
          expectedTargetRevision: 0,
          characterIds: ["character-b"],
          maskOwnerContributions: changedTarget,
        }),
      ),
    /Maskenbeitrag/,
  );

  assert.throws(
    () =>
      moveCharacters(
        state,
        command("move-characters", {
          commandId: "command-mask",
          commandDigest: "digest-mask",
          expectedPartyRevision: 1,
          expectedFocusRevision: 1,
          sourceSceneId: "scene-primary",
          targetSceneId: "scene-target",
          expectedSourceRevision: 0,
          expectedTargetRevision: 0,
          characterIds: ["character-b"],
          maskOwnerContributions: [],
        }),
      ),
    /Maskenbeitrag/,
  );

  const reordered = structuredClone(contributions) as Record<string, any>[];
  reordered[0]!.beforeMasks.reverse();
  reordered[0]!.afterMasks.reverse();
  reordered[0]!.scope.masks.reverse();
  assert.throws(
    () =>
      moveCharacters(
        state,
        command("move-characters", {
          commandId: "command-mask",
          commandDigest: "digest-mask",
          expectedPartyRevision: 1,
          expectedFocusRevision: 1,
          sourceSceneId: "scene-primary",
          targetSceneId: "scene-target",
          expectedSourceRevision: 0,
          expectedTargetRevision: 0,
          characterIds: ["character-b"],
          maskOwnerContributions: reordered,
        }),
      ),
    /Maskenbeitrag/,
  );

  const omittedDelta = structuredClone(
    preparedMaskContributions(
      state,
      ["character-a"],
      "command-omit",
      "digest-omit",
    )[0],
  ) as Record<string, any>;
  omittedDelta.scope.masks.pop();
  assert.throws(
    () => parseMaskOwnerPreparedContribution(omittedDelta),
    /Prepared-Vertrag/,
  );

  const swappedIncidence = structuredClone(
    preparedMaskContributions(
      state,
      ["character-b", "character-a"],
      "command-swap",
      "digest-swap",
    )[0],
  ) as Record<string, any>;
  swappedIncidence.scope.masks[0].participantCharacterIds = ["character-a"];
  swappedIncidence.scope.masks[1].participantCharacterIds = [
    "character-b",
    "character-a",
  ];
  assert.throws(
    () => parseMaskOwnerPreparedContribution(swappedIncidence),
    /Prepared-Vertrag/,
  );

  const first = move(state, ["character-b"]);
  assert.equal(first.status, "applied");
  if (first.status !== "applied") return;
  const secondContributions = preparedMaskContributions(
    first.state,
    ["character-a"],
    "command-mask-second",
    "digest-mask-second",
  );
  secondContributions[0]!.receiptId = contribution.receiptId;
  assert.throws(
    () =>
      moveCharacters(
        first.state,
        command("move-characters", {
          commandId: "command-mask-second",
          commandDigest: "digest-mask-second",
          expectedPartyRevision: 2,
          expectedFocusRevision: 1,
          sourceSceneId: "scene-primary",
          targetSceneId: "scene-target",
          expectedSourceRevision: 1,
          expectedTargetRevision: 1,
          characterIds: ["character-a"],
          maskOwnerContributions: secondContributions,
        }),
      ),
    /Receipt/,
  );

  const retryA = move(state, ["character-b"]),
    retryB = move(state, ["character-b"]);
  assert.deepEqual(retryA, retryB);
});

test("an implicit current owner is materialized before its receipt can be reused", () => {
  const raw = maskState();
  raw.scenes[0].source.reconciliations = [];
  const state = parseLiveSessionAggregateState(raw),
    first = move(state, ["character-b"]);
  assert.equal(first.status, "applied");
  if (first.status !== "applied") return;

  const recordedOwners = first.state.scenes[0]!.source.reconciliations;
  assert.deepEqual(
    recordedOwners.map((entry) => ({
      ownerId: entry.ownerId,
      status: entry.status,
      ownerRevision: entry.ownerRevision,
      hasReceipt: entry.receiptId !== undefined,
    })),
    [
      {
        ownerId: "owner-a",
        status: "current",
        ownerRevision: 6,
        hasReceipt: true,
      },
      {
        ownerId: "owner-b",
        status: "current",
        ownerRevision: 8,
        hasReceipt: true,
      },
    ],
  );

  const secondContributions = preparedMaskContributions(
    first.state,
    ["character-a"],
    "command-mask-second",
    "digest-mask-second",
  );
  for (const contribution of secondContributions) {
    const recorded = recordedOwners.find(
      (entry) =>
        entry.ownerId === contribution.ownerIdentity.ownerId &&
        entry.generationId === contribution.ownerIdentity.generationId,
    );
    assert(recorded?.receiptId);
    contribution.receiptId = recorded.receiptId;
  }
  assert.throws(
    () =>
      moveCharacters(
        first.state,
        command("move-characters", {
          commandId: "command-mask-second",
          commandDigest: "digest-mask-second",
          expectedPartyRevision: 2,
          expectedFocusRevision: 1,
          sourceSceneId: "scene-primary",
          targetSceneId: "scene-target",
          expectedSourceRevision: 1,
          expectedTargetRevision: 1,
          characterIds: ["character-a"],
          maskOwnerContributions: secondContributions,
        }),
      ),
    /Receipt/,
  );
});

test("owner receipt history rejects reuse after later successful transitions", () => {
  const initial = parseLiveSessionAggregateState(threeCharacterMaskState()),
    first = move(initial, ["character-b"]);
  assert.equal(first.status, "applied");
  if (first.status !== "applied") return;

  const exactRetry = moveCharacters(
    first.state,
    command("move-characters", {
      commandId: "command-mask",
      commandDigest: "digest-mask",
      expectedPartyRevision: 1,
      expectedFocusRevision: 1,
      sourceSceneId: "scene-primary",
      targetSceneId: "scene-target",
      expectedSourceRevision: 0,
      expectedTargetRevision: 0,
      characterIds: ["character-b"],
      maskOwnerContributions: preparedMaskContributions(
        initial,
        ["character-b"],
        "command-mask",
        "digest-mask",
      ),
    }),
  );
  assert.equal(exactRetry.status, "rejected");
  assert.deepEqual(exactRetry.state, first.state);

  const duplicateAcrossScenes = structuredClone(first.state) as Record<
    string,
    any
  >;
  duplicateAcrossScenes.scenes[1].source.reconciliations = [
    structuredClone(duplicateAcrossScenes.scenes[0].source.reconciliations[0]),
  ];
  for (const contribution of duplicateAcrossScenes.scenes[1].source
    .reconciliations[0].appliedContributions)
    contribution.sourceSceneId = "scene-target";
  duplicateAcrossScenes.scenes[1].source.maskRefs =
    duplicateAcrossScenes.scenes[0].source.maskRefs
      .filter((mask: any) => mask.ownerId === "owner-a")
      .map((mask: any) => structuredClone(mask));
  duplicateAcrossScenes.scenes[1].source.maskParticipationProjections =
    duplicateAcrossScenes.scenes[0].source.maskParticipationProjections
      .filter(
        (projection: any) => projection.ownerIdentity.ownerId === "owner-a",
      )
      .map((projection: any) => ({
        ...structuredClone(projection),
        liveSceneId: "scene-target",
        participantCharacterIds: [],
      }));
  assert.throws(
    () => parseLiveSessionAggregateState(duplicateAcrossScenes),
    /mehrfach veröffentlichte Masken-ReceiptId/,
  );

  const second = move(first.state, ["character-a"], "mask-second");
  assert.equal(second.status, "applied");
  if (second.status !== "applied") return;
  const ownerA = second.state.scenes[0]!.source.reconciliations.find(
    (entry) => entry.ownerId === "owner-a",
  );
  assert.equal(ownerA?.receiptLedgerBaseRevision, 5);
  assert.equal(ownerA?.appliedContributions?.length, 2);
  assert.deepEqual(
    ownerA?.appliedContributions?.[0]?.target,
    first.decision.sceneCleanup?.reconciliations.find(
      (duty) =>
        duty.kind === "mask-owner-reconciliation" &&
        duty.ownerIdentity.ownerId === "owner-a",
    )?.target,
  );

  const deletedLedger = structuredClone(second.state) as Record<string, any>,
    deletedOwner = deletedLedger.scenes[0].source.reconciliations.find(
      (entry: any) => entry.ownerId === "owner-a",
    );
  delete deletedOwner.appliedContributions;
  assert.throws(
    () => parseLiveSessionAggregateState(deletedLedger),
    /Receipt-Ledger/,
  );

  const truncatedLedger = structuredClone(second.state) as Record<string, any>,
    truncatedOwner = truncatedLedger.scenes[0].source.reconciliations.find(
      (entry: any) => entry.ownerId === "owner-a",
    );
  truncatedOwner.appliedContributions.shift();
  assert.throws(
    () => parseLiveSessionAggregateState(truncatedLedger),
    /Receipt-Ledger/,
  );
  const firstReceipts = new Map(
      first.state.scenes[0]!.source.reconciliations.map((entry) => [
        `${entry.ownerId}\u0000${entry.generationId}`,
        entry.receiptId,
      ]),
    ),
    thirdContributions = preparedMaskContributions(
      second.state,
      ["character-c"],
      "command-mask-third",
      "digest-mask-third",
    );
  for (const contribution of thirdContributions) {
    const priorReceipt = firstReceipts.get(
      `${contribution.ownerIdentity.ownerId}\u0000${contribution.ownerIdentity.generationId}`,
    );
    assert(priorReceipt);
    contribution.receiptId = priorReceipt;
  }
  assert.throws(
    () =>
      moveCharacters(
        second.state,
        command("move-characters", {
          commandId: "command-mask-third",
          commandDigest: "digest-mask-third",
          expectedPartyRevision: 3,
          expectedFocusRevision: 1,
          sourceSceneId: "scene-primary",
          targetSceneId: "scene-target",
          expectedSourceRevision: 2,
          expectedTargetRevision: 2,
          characterIds: ["character-c"],
          maskOwnerContributions: thirdContributions,
        }),
      ),
    /Receipt/,
  );
});

test("pending duties bind lifecycle, pending owner command and unique scope", () => {
  const raw = maskState();
  raw.scenes[0].source.maskRefs = raw.scenes[0].source.maskRefs.slice(0, 1);
  raw.scenes[0].source.maskParticipationProjections = [];
  raw.scenes[0].source.reconciliations = [
    {
      ownerId: "owner-a",
      generationId: "generation-a",
      status: "unavailable",
      ownerRevision: 5,
    },
  ];
  const pendingResult = move(parseLiveSessionAggregateState(raw), [
    "character-b",
  ]);
  assert.equal(pendingResult.status, "applied");
  if (pendingResult.status !== "applied") return;

  const falseRetirement = structuredClone(pendingResult.state) as Record<
    string,
    any
  >;
  falseRetirement.pendingReconciliations[0].sourceLifecycleAfter = "retired";
  assert.throws(
    () => parseLiveSessionAggregateState(falseRetirement),
    /Lifecyclebindung/,
  );

  const duplicate = structuredClone(pendingResult.state) as Record<string, any>;
  duplicate.pendingReconciliations.push(
    structuredClone(duplicate.pendingReconciliations[0]),
  );
  assert.throws(
    () => parseLiveSessionAggregateState(duplicate),
    /doppelte Kennungen/,
  );

  const wrongCommand = structuredClone(pendingResult.state) as Record<
    string,
    any
  >;
  wrongCommand.scenes[0].source.reconciliations[0].pendingCommandIds = [
    "other-command",
  ];
  wrongCommand.scenes[0].source.reconciliations[0].commandId = "other-command";
  assert.throws(
    () => parseLiveSessionAggregateState(wrongCommand),
    /ungebundene Masken-Reconciliation|ohne eindeutige Duty/,
  );

  const mixed = maskState();
  mixed.scenes[0].source.maskParticipationProjections =
    mixed.scenes[0].source.maskParticipationProjections.filter(
      (projection: any) => projection.ownerIdentity.ownerId === "owner-b",
    );
  mixed.scenes[0].source.reconciliations[0] = {
    ownerId: "owner-a",
    generationId: "generation-a",
    status: "unavailable",
    ownerRevision: 5,
  };
  const mixedResult = move(parseLiveSessionAggregateState(mixed), [
    "character-b",
  ]);
  assert.equal(mixedResult.status, "applied");
  if (mixedResult.status !== "applied") return;
  const rehomed = structuredClone(mixedResult.state) as Record<string, any>,
    rehomedDuty = rehomed.pendingReconciliations[0],
    currentMask = rehomed.scenes[0].source.maskRefs.find(
      (mask: any) => mask.ownerId === "owner-b",
    );
  rehomedDuty.ownerIdentity = {
    ownerId: "owner-b",
    generationId: "generation-b",
  };
  rehomedDuty.expectedOwnerRevision = currentMask.ownerRevision;
  rehomedDuty.scope.knownMaskRefs = [
    {
      maskId: currentMask.maskId,
      maskKind: currentMask.kind,
      expectedOwnerRevision: currentMask.ownerRevision,
      lifecycleBefore: currentMask.lifecycle,
    },
  ];
  assert.throws(
    () => parseLiveSessionAggregateState(rehomed),
    /ungebundene Masken-Reconciliation/,
  );
});

test("deactivate, split and rejoin require the same prepared mask-owner contract", () => {
  const deactivateState = parseLiveSessionAggregateState(maskState()),
    deactivated = deactivatePartyCharacter(
      deactivateState,
      command("deactivate-party-character", {
        commandId: "command-mask-deactivate",
        commandDigest: "digest-mask-deactivate",
        expectedPartyRevision: 1,
        expectedFocusRevision: 1,
        characterId: "character-b",
        expectedSourceRevision: 0,
        maskOwnerContributions: preparedMaskContributions(
          deactivateState,
          ["character-b"],
          "command-mask-deactivate",
          "digest-mask-deactivate",
        ),
      }),
    );
  assert.equal(deactivated.status, "applied");
  if (deactivated.status !== "applied") return;
  assert.equal(deactivated.state.pendingReconciliations.length, 0);
  assert(
    deactivated.decision.membership!.reconciliations.every(
      (duty) =>
        duty.kind === "mask-owner-reconciliation" &&
        duty.preparedContribution?.status === "prepared-unpublished",
    ),
  );

  const splitState = parseLiveSessionAggregateState(maskState()),
    split = splitScene(
      splitState,
      command("split-scene", {
        commandId: "command-mask-split",
        commandDigest: "digest-mask-split",
        expectedPartyRevision: 1,
        expectedFocusRevision: 1,
        sourceSceneId: "scene-primary",
        expectedSourceRevision: 0,
        targetSceneId: "scene-split",
        targetClockRef: clockRef("clock-split"),
        characterIds: ["character-b"],
        title: "Split",
        clockContribution: forkContribution(),
        maskOwnerContributions: preparedMaskContributions(
          splitState,
          ["character-b"],
          "command-mask-split",
          "digest-mask-split",
        ),
      }),
    );
  assert.equal(split.status, "applied");
  if (split.status !== "applied") return;
  assert.equal(split.state.pendingReconciliations.length, 0);
  assert(
    split.decision.transition!.reconciliations.every(
      (duty) =>
        duty.kind === "mask-owner-reconciliation" &&
        duty.preparedContribution !== undefined,
    ),
  );

  const rejoined = rejoinScenes(
    split.state,
    command("rejoin-scenes", {
      commandId: "command-mask-rejoin",
      commandDigest: "digest-mask-rejoin",
      expectedPartyRevision: 2,
      expectedFocusRevision: 1,
      sourceSceneId: "scene-primary",
      expectedSourceRevision: 1,
      targetSceneId: "scene-split",
      expectedTargetRevision: 0,
      clockContribution: mergeContribution(),
      maskOwnerContributions: preparedMaskContributions(
        split.state,
        ["character-a"],
        "command-mask-rejoin",
        "digest-mask-rejoin",
      ),
    }),
  );
  assert.equal(rejoined.status, "applied");
  if (rejoined.status !== "applied") return;
  assert.equal(rejoined.state.pendingReconciliations.length, 0);
  assert(
    rejoined.decision.transition!.reconciliations.every(
      (duty) =>
        duty.kind === "mask-owner-reconciliation" &&
        duty.scope.kind === "complete-mask-delta" &&
        duty.scope.operation === "source-retired" &&
        duty.preparedContribution !== undefined,
    ),
  );
});
