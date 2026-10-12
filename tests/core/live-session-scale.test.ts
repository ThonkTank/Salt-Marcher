import assert from "node:assert/strict";
import test from "node:test";
import {
  activatePartyCharacter,
  createPartyCharacter,
  createPreparedRuntime,
  createUninitializedLiveSessionState,
  deactivatePartyCharacter,
  initializeLiveSession,
  moveCharacters,
  parseClockForkCreateContribution,
  parseClockMergeContribution,
  parsePartyProjection,
  parseLiveSessionAggregateState,
  parseMaskOwnerPreparedContribution,
  projectFocus,
  projectLiveScene,
  rejoinScenes,
  restPartyCharacters,
  setFocus,
  setPartyCharacterProgress,
  splitScene,
  updatePartyCharacterProfile,
  type AggregateCommandResult,
  type LiveSessionAggregateState,
  type PartyCommandResult,
  type PartyProjection,
} from "../../src/features/live-session";

const CAMPAIGN_ID = "campaign-fuzzer";

function frozenGraph(value: unknown, seen = new Set<object>()): boolean {
  if (!value || typeof value !== "object" || seen.has(value)) return true;
  seen.add(value);
  return (
    Object.isFrozen(value) &&
    Object.values(value).every((child) => frozenGraph(child, seen))
  );
}

function generator(seed: number) {
  let state = seed >>> 0;
  return (limit: number) => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) % limit;
  };
}

function aggregateCommand(
  state: LiveSessionAggregateState,
  kind: string,
  commandId: string,
  overrides: Record<string, unknown> = {},
) {
  const needsMasks = [
    "move-characters",
    "split-scene",
    "rejoin-scenes",
    "deactivate-party-character",
  ].includes(kind);
  return {
    kind,
    version: 1,
    campaignId: CAMPAIGN_ID,
    commandId,
    commandDigest: `digest-${commandId}`,
    expectedPartyRevision: state.party.partyRevision,
    expectedFocusRevision: state.focus.focusRevision,
    cancelled: false,
    ...(needsMasks ? { maskOwnerContributions: [] } : {}),
    ...overrides,
  };
}

function rawState(characterCount = 12, sceneCount = 4) {
  const activeCount = characterCount - 4,
    sceneIds = Array.from(
      { length: sceneCount },
      (_, index) => `scene-${index}`,
    ),
    memberships = sceneIds.map(() => [] as string[]);
  for (let index = 0; index < activeCount; index++)
    memberships[index % sceneCount]!.push(`character-${index}`);
  return {
    kind: "live-session-aggregate-state",
    version: 1,
    campaignId: CAMPAIGN_ID,
    party: {
      kind: "party-projection",
      version: 1,
      campaignId: CAMPAIGN_ID,
      partyRevision: 0,
      characters: Array.from({ length: characterCount }, (_, index) => {
        const active = index < activeCount,
          sceneIndex = index % sceneCount;
        return {
          characterId: `character-${index}`,
          active,
          profile: { name: `Character ${index}` },
          progress: {
            currentXp: index * 10,
            xpSinceLongRest: index,
            xpSinceShortRest: index % 2,
          },
          sceneAssignment: active
            ? {
                status: "assigned",
                liveSceneId: sceneIds[sceneIndex],
                sceneRevision: 0,
              }
            : { status: "inactive" },
        };
      }),
    },
    focus: {
      kind: "focus-source",
      version: 1,
      status: "active",
      campaignId: CAMPAIGN_ID,
      focusRevision: 0,
      liveSceneId: sceneIds[0],
      sceneRevision: 0,
    },
    primarySceneId: sceneIds[0],
    scenes: sceneIds.map((liveSceneId, index) => ({
      kind: "runtime-scene-state",
      version: 1,
      source: {
        kind: "live-scene-source",
        version: 1,
        campaignId: CAMPAIGN_ID,
        liveSceneId,
        sceneRevision: 0,
        lifecycle: "active",
        primary: index === 0,
        characterIds: memberships[index],
        pendingAssignments: [],
        sceneClockRef: {
          ownerId: "clock",
          generationId: "clock-generation",
          referenceId: `clock-${index}`,
          ownerRevision: 0,
        },
        groupRefs: [],
        maskRefs: [],
        maskParticipationProjections: [],
        reconciliations: [],
        contentPins: [],
      },
      title: `Scene ${index}`,
      notes: "",
    })),
    pendingReconciliations: [],
  };
}

function assertInvariants(
  state: LiveSessionAggregateState,
  before?: LiveSessionAggregateState,
) {
  const reparsed = parseLiveSessionAggregateState(structuredClone(state));
  assert.deepEqual(reparsed, state);
  assert(frozenGraph(state));
  assert.equal(state.party.campaignId, state.campaignId);

  const activeScenes = state.scenes.filter(
      (scene) => scene.source.lifecycle === "active",
    ),
    primaryScenes = activeScenes.filter((scene) => scene.source.primary),
    assigned = new Map<string, string>(),
    pending = new Map<string, string>();
  for (const scene of activeScenes) {
    assert(scene.source.sceneClockRef);
    for (const id of scene.source.characterIds) {
      assert.equal(assigned.has(id), false);
      assert.equal(pending.has(id), false);
      assigned.set(id, scene.source.liveSceneId);
    }
    for (const entry of scene.source.pendingAssignments) {
      assert.equal(assigned.has(entry.characterId), false);
      assert.equal(pending.has(entry.characterId), false);
      pending.set(entry.characterId, scene.source.liveSceneId);
    }
  }
  if (state.primarySceneId === null) {
    assert.equal(activeScenes.length, 0);
    assert.equal(primaryScenes.length, 0);
    assert.notEqual(state.focus.status, "active");
  } else {
    assert.equal(primaryScenes.length, 1);
    assert.equal(primaryScenes[0]?.source.liveSceneId, state.primarySceneId);
  }
  for (const character of state.party.characters) {
    if (!character.active) {
      assert.equal(character.sceneAssignment.status, "inactive");
      assert.equal(assigned.has(character.characterId), false);
      assert.equal(pending.has(character.characterId), false);
      continue;
    }
    const inAssigned = assigned.has(character.characterId),
      inPending = pending.has(character.characterId);
    if (state.primarySceneId === null) {
      assert.equal(character.sceneAssignment.status, "not-started");
      assert.equal(inAssigned, false);
      assert.equal(inPending, false);
      continue;
    }
    assert.notEqual(inAssigned, inPending);
    if (character.sceneAssignment.status === "assigned") {
      const assignment = character.sceneAssignment;
      assert.equal(assigned.get(character.characterId), assignment.liveSceneId);
      const scene = activeScenes.find(
        (entry) => entry.source.liveSceneId === assignment.liveSceneId,
      );
      assert.equal(scene?.source.sceneRevision, assignment.sceneRevision);
    } else assert.equal(character.sceneAssignment.status, "pending");
  }
  if (state.focus.status === "active") {
    const focus = state.focus;
    const focused = activeScenes.find(
      (scene) => scene.source.liveSceneId === focus.liveSceneId,
    );
    assert(focused);
    assert.equal(focused.source.sceneRevision, focus.sceneRevision);
  }
  for (const scene of state.scenes.filter(
    (entry) => entry.source.lifecycle !== "active",
  )) {
    assert.equal(scene.source.primary, false);
    assert.notEqual(
      state.focus.status === "active" && state.focus.liveSceneId,
      scene.source.liveSceneId,
    );
  }
  const receipts = state.scenes.flatMap((scene) =>
    scene.source.reconciliations.flatMap((owner) =>
      (owner.appliedContributions ?? []).map((entry) => entry.receiptId),
    ),
  );
  assert.equal(new Set(receipts).size, receipts.length);
  const duties = state.pendingReconciliations.map(
    (entry) =>
      `${entry.commandId}\u0000${entry.kind}\u0000${JSON.stringify(entry)}`,
  );
  assert.equal(new Set(duties).size, duties.length);
  if (before) {
    assert(state.party.partyRevision >= before.party.partyRevision);
    assert(state.focus.focusRevision >= before.focus.focusRevision);
    for (const scene of state.scenes) {
      const prior = before.scenes.find(
        (entry) => entry.source.liveSceneId === scene.source.liveSceneId,
      );
      if (prior)
        assert(scene.source.sceneRevision >= prior.source.sceneRevision);
    }
  }
}

type AggregateExecutor = (
  stateValue: unknown,
  commandValue: unknown,
) => AggregateCommandResult;
type PartyExecutor = (
  partyValue: unknown,
  commandValue: unknown,
) => PartyCommandResult;
type Coverage = Map<string, number>;
type NegativeMutator = {
  readonly dimension: string;
  readonly mutate: (command: Record<string, any>) => void;
  readonly assertInternallyValid?: (command: Record<string, any>) => void;
};

function canonical<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function changedCharacterIds(before: PartyProjection, after: PartyProjection) {
  const beforeById = new Map(
      before.characters.map((character) => [character.characterId, character]),
    ),
    afterById = new Map(
      after.characters.map((character) => [character.characterId, character]),
    );
  return [...new Set([...beforeById.keys(), ...afterById.keys()])].filter(
    (id) =>
      JSON.stringify(beforeById.get(id)) !== JSON.stringify(afterById.get(id)),
  );
}

function changedSceneIds(
  before: LiveSessionAggregateState,
  after: LiveSessionAggregateState,
) {
  const beforeById = new Map(
      before.scenes.map((scene) => [scene.source.liveSceneId, scene]),
    ),
    afterById = new Map(
      after.scenes.map((scene) => [scene.source.liveSceneId, scene]),
    );
  return [...new Set([...beforeById.keys(), ...afterById.keys()])].filter(
    (id) =>
      JSON.stringify(beforeById.get(id)) !== JSON.stringify(afterById.get(id)),
  );
}

function count(coverage: Coverage, kind: string) {
  coverage.set(kind, (coverage.get(kind) ?? 0) + 1);
}

function countDimension(coverage: Coverage, kind: string, dimension: string) {
  count(coverage, `${kind}×${dimension}`);
}

function assertRejectedPartyVariants(
  party: PartyProjection,
  command: Record<string, unknown>,
  execute: PartyExecutor,
) {
  for (const patch of [
    { cancelled: true },
    { campaignId: "foreign-campaign" },
    { expectedPartyRevision: party.partyRevision + 1 },
  ]) {
    const input = structuredClone(party),
      commandInput = { ...structuredClone(command), ...patch },
      before = structuredClone(input),
      commandBefore = structuredClone(commandInput),
      result = execute(input, commandInput),
      duplicate = execute(
        structuredClone(party),
        structuredClone(commandInput),
      );
    assert.notEqual(result.status, "applied");
    assert.deepEqual(duplicate, result);
    assert.deepEqual(result.party, party);
    assert.deepEqual(input, before);
    assert.deepEqual(commandInput, commandBefore);
  }
}

function applyPartyOracle(
  party: PartyProjection,
  command: Record<string, unknown>,
  execute: PartyExecutor,
  expected: { kind: string; characterIds: readonly string[] },
  coverage: Coverage,
) {
  const partyInput = structuredClone(party),
    commandInput = structuredClone(command),
    partyBefore = structuredClone(partyInput),
    commandBefore = structuredClone(commandInput),
    first = execute(partyInput, commandInput),
    duplicate = execute(structuredClone(party), structuredClone(command));
  assert.deepEqual(first, duplicate);
  assert.deepEqual(partyInput, partyBefore);
  assert.deepEqual(commandInput, commandBefore);
  assert.equal(first.status, "applied");
  if (first.status !== "applied") throw new Error("party command not applied");
  assert.equal(first.decision.kind, expected.kind);
  assert.equal(first.decision.commandId, command.commandId);
  assert.equal(first.decision.commandDigest, command.commandDigest);
  assert.equal(first.decision.partyRevisionBefore, party.partyRevision);
  assert.equal(first.decision.partyRevisionAfter, party.partyRevision + 1);
  assert.deepEqual(first.decision.characterIds, expected.characterIds);
  assert.deepEqual(
    changedCharacterIds(party, first.party),
    expected.characterIds,
  );
  const retry = execute(first.party, command);
  assert.notEqual(retry.status, "applied");
  assert.deepEqual(retry.party, first.party);
  assertRejectedPartyVariants(party, command, execute);
  count(coverage, String(command.kind));
  return { party: first.party, result: first };
}

function assertRejectedAggregateVariants(
  state: LiveSessionAggregateState,
  command: Record<string, unknown>,
  execute: AggregateExecutor,
  coverage: Coverage | undefined,
  negativeMutators: readonly NegativeMutator[],
) {
  const kind = String(command.kind),
    variants: NegativeMutator[] = [
      {
        dimension: "cancelled",
        mutate: (candidate) => {
          candidate.cancelled = true;
        },
      },
      {
        dimension: "foreign-campaign",
        mutate: (candidate) => {
          candidate.campaignId = "foreign-campaign";
        },
      },
      {
        dimension: "stale-party",
        mutate: (candidate) => {
          candidate.expectedPartyRevision = state.party.partyRevision + 1;
        },
      },
      {
        dimension: "stale-focus",
        mutate: (candidate) => {
          candidate.expectedFocusRevision = state.focus.focusRevision + 1;
        },
      },
      ...negativeMutators,
    ];
  for (const variant of variants) {
    const input = structuredClone(state),
      commandInput = structuredClone(command) as Record<string, any>;
    variant.mutate(commandInput);
    variant.assertInternallyValid?.(commandInput);
    const before = structuredClone(input),
      commandBefore = structuredClone(commandInput),
      duplicateInput = structuredClone(state),
      duplicateCommand = structuredClone(commandInput);
    let result: AggregateCommandResult | undefined,
      duplicate: AggregateCommandResult | undefined,
      firstThrew = false,
      duplicateThrew = false;
    try {
      result = execute(input, commandInput);
    } catch {
      firstThrew = true;
    }
    try {
      duplicate = execute(duplicateInput, duplicateCommand);
    } catch {
      duplicateThrew = true;
    }
    assert.equal(duplicateThrew, firstThrew);
    if (result && duplicate) {
      assert.notEqual(result.status, "applied");
      assert.deepEqual(duplicate, result);
      assert.deepEqual(result.state, state);
    }
    assert.deepEqual(input, before);
    assert.deepEqual(duplicateInput, before);
    assert.deepEqual(commandInput, commandBefore);
    assert.deepEqual(duplicateCommand, commandBefore);
    if (coverage) countDimension(coverage, kind, variant.dimension);
  }
}

function applyAggregateOracle(
  state: LiveSessionAggregateState,
  command: Record<string, unknown>,
  execute: AggregateExecutor,
  expected: {
    kind: string;
    characterIds: readonly string[];
    sceneIds: readonly string[];
  },
  coverage?: Coverage,
  negativeMutators: readonly NegativeMutator[] = [],
) {
  const stateInput = structuredClone(state),
    commandInput = structuredClone(command),
    stateBefore = structuredClone(stateInput),
    commandBefore = structuredClone(commandInput),
    first = execute(stateInput, commandInput),
    duplicate = execute(structuredClone(state), structuredClone(command));
  assert.deepEqual(first, duplicate);
  assert.deepEqual(stateInput, stateBefore);
  assert.deepEqual(commandInput, commandBefore);
  assert.equal(first.status, "applied");
  if (first.status !== "applied")
    throw new Error("aggregate command not applied");
  assert.equal(first.decision.kind, expected.kind);
  assert.equal(first.decision.commandId, command.commandId);
  assert.equal(first.decision.commandDigest, command.commandDigest);
  assert.equal(first.decision.partyRevisionBefore, state.party.partyRevision);
  assert.equal(
    first.decision.partyRevisionAfter,
    first.state.party.partyRevision,
  );
  assert.equal(first.decision.focusRevisionBefore, state.focus.focusRevision);
  assert.equal(
    first.decision.focusRevisionAfter,
    first.state.focus.focusRevision,
  );
  assert.deepEqual(
    changedCharacterIds(state.party, first.state.party),
    expected.characterIds,
  );
  assert.deepEqual(changedSceneIds(state, first.state), expected.sceneIds);
  const retry = execute(first.state, command);
  assert.notEqual(retry.status, "applied");
  assert.deepEqual(retry.state, first.state);
  assertRejectedAggregateVariants(
    state,
    command,
    execute,
    coverage,
    negativeMutators,
  );
  assertInvariants(first.state, state);
  if (coverage) count(coverage, String(command.kind));
  return { state: first.state, result: first };
}

function clockRef(referenceId: string, ownerRevision = 0) {
  return {
    ownerId: "clock",
    generationId: "clock-generation",
    referenceId,
    ownerRevision,
  };
}

const clockValue = {
    codecId: "smr07.elapsed-seconds",
    codecVersion: 1,
    canonicalValue: "3600",
  },
  calendarDefinitionRef = {
    ownerId: "clock",
    referenceId: "calendar-surface",
    ownerRevision: 1,
  };

function splitClockContribution(commandId: string, sourceRevision: number) {
  return {
    kind: "clock-fork-create-contribution",
    version: 1,
    status: "prepared-unpublished",
    receiptId: `receipt-${commandId}`,
    campaignId: CAMPAIGN_ID,
    commandId,
    commandDigest: `digest-${commandId}`,
    ownerIdentity: { ownerId: "clock", generationId: "clock-generation" },
    calendarDefinitionRef,
    sourceSceneId: "surface-primary",
    sourceSceneRevisionBefore: sourceRevision,
    sourceSceneRevisionAfter: sourceRevision + 1,
    sourceClockRef: clockRef("surface-clock-primary"),
    sourceClockValue: clockValue,
    sourceClockRevisionAfter: 0,
    targetSceneId: "surface-split",
    targetSceneRevisionAfter: 0,
    targetClockRefAfter: clockRef("surface-clock-split"),
    targetClockRevisionAfter: 0,
    targetClockValueAfter: clockValue,
    sourceDisposition: "retain",
    targetKind: "created",
    choice: "source-confirmed",
  };
}

function mergeClockContribution(commandId: string) {
  return {
    kind: "clock-merge-contribution",
    version: 1,
    status: "prepared-unpublished",
    receiptId: `receipt-${commandId}`,
    campaignId: CAMPAIGN_ID,
    commandId,
    commandDigest: `digest-${commandId}`,
    ownerIdentity: { ownerId: "clock", generationId: "clock-generation" },
    calendarDefinitionRef,
    sourceSceneId: "surface-split",
    sourceSceneRevisionBefore: 0,
    sourceSceneRevisionAfter: 1,
    sourceClockRef: clockRef("surface-clock-split"),
    sourceClockValue: clockValue,
    sourceClockRevisionAfter: 0,
    targetSceneId: "surface-prepared",
    targetSceneRevisionBefore: 1,
    targetSceneRevisionAfter: 2,
    targetClockRefBefore: clockRef("surface-clock-prepared"),
    targetClockRevisionBefore: 0,
    targetClockValueBefore: clockValue,
    targetClockRefAfter: clockRef("surface-clock-prepared", 1),
    targetClockRevisionAfter: 1,
    targetClockValueAfter: { ...clockValue, canonicalValue: "7200" },
    sourceDisposition: "archive",
    targetKind: "existing",
    choice: "manual-confirmed",
  };
}

function negative(
  dimension: string,
  mutate: (command: Record<string, any>) => void,
  assertInternallyValid?: (command: Record<string, any>) => void,
): NegativeMutator {
  return {
    dimension,
    mutate,
    ...(assertInternallyValid === undefined ? {} : { assertInternallyValid }),
  };
}

function splitClockNegatives(): readonly NegativeMutator[] {
  const parses = (command: Record<string, any>) => {
    parseClockForkCreateContribution(command.clockContribution);
  };
  return [
    negative("stale-scene-source", (command) => {
      command.expectedSourceRevision += 1;
    }),
    negative("clock-foreign-campaign", (command) => {
      command.clockContribution.campaignId = "foreign-campaign";
    }),
    negative("clock-foreign-generation", (command) => {
      command.clockContribution.ownerIdentity.generationId =
        "foreign-generation";
    }),
    negative("clock-wrong-command-id", (command) => {
      command.clockContribution.commandId = "wrong-command";
    }),
    negative("clock-wrong-command-digest", (command) => {
      command.clockContribution.commandDigest = "wrong-digest";
    }),
    negative("clock-stale-source-owner-revision", (command) => {
      command.clockContribution.sourceClockRef.ownerRevision += 1;
    }),
    negative("clock-stale-source-clock-revision", (command) => {
      command.clockContribution.sourceClockRevisionAfter += 1;
    }),
    negative("clock-stale-target-owner-revision", (command) => {
      command.clockContribution.targetClockRefAfter.ownerRevision += 1;
    }),
    negative("clock-stale-target-clock-revision", (command) => {
      command.clockContribution.targetClockRevisionAfter += 1;
    }),
    negative("clock-parser-target-created-scene-revision", (command) => {
      command.clockContribution.targetSceneRevisionAfter += 1;
    }),
    negative(
      "clock-authority-stale-source-clock-pair",
      (command) => {
        command.clockContribution.sourceClockRef.ownerRevision += 1;
        command.clockContribution.sourceClockRevisionAfter += 1;
      },
      parses,
    ),
    negative(
      "clock-authority-stale-source-scene-pair",
      (command) => {
        command.clockContribution.sourceSceneRevisionBefore += 1;
        command.clockContribution.sourceSceneRevisionAfter += 1;
      },
      parses,
    ),
  ];
}

function mergeClockNegatives(): readonly NegativeMutator[] {
  const parses = (command: Record<string, any>) => {
    parseClockMergeContribution(command.clockContribution);
  };
  return [
    negative("stale-scene-source", (command) => {
      command.expectedSourceRevision += 1;
    }),
    negative("stale-scene-target", (command) => {
      command.expectedTargetRevision += 1;
    }),
    negative("clock-foreign-campaign", (command) => {
      command.clockContribution.campaignId = "foreign-campaign";
    }),
    negative("clock-foreign-generation", (command) => {
      command.clockContribution.ownerIdentity.generationId =
        "foreign-generation";
    }),
    negative("clock-wrong-command-id", (command) => {
      command.clockContribution.commandId = "wrong-command";
    }),
    negative("clock-wrong-command-digest", (command) => {
      command.clockContribution.commandDigest = "wrong-digest";
    }),
    negative("clock-stale-source-owner-revision", (command) => {
      command.clockContribution.sourceClockRef.ownerRevision += 1;
    }),
    negative("clock-stale-source-clock-revision", (command) => {
      command.clockContribution.sourceClockRevisionAfter += 1;
    }),
    negative("clock-stale-target-owner-revision-before", (command) => {
      command.clockContribution.targetClockRefBefore.ownerRevision += 1;
    }),
    negative("clock-stale-target-clock-revision-before", (command) => {
      command.clockContribution.targetClockRevisionBefore += 1;
    }),
    negative("clock-stale-target-owner-revision-after", (command) => {
      command.clockContribution.targetClockRefAfter.ownerRevision += 1;
    }),
    negative("clock-stale-target-clock-revision-after", (command) => {
      command.clockContribution.targetClockRevisionAfter += 1;
    }),
    negative(
      "clock-authority-stale-source-clock-pair",
      (command) => {
        command.clockContribution.sourceClockRef.ownerRevision += 1;
        command.clockContribution.sourceClockRevisionAfter += 1;
      },
      parses,
    ),
    negative(
      "clock-authority-stale-target-clock-transition",
      (command) => {
        command.clockContribution.targetClockRefBefore.ownerRevision += 1;
        command.clockContribution.targetClockRevisionBefore += 1;
        command.clockContribution.targetClockRefAfter.ownerRevision += 1;
        command.clockContribution.targetClockRevisionAfter += 1;
      },
      parses,
    ),
    negative(
      "clock-authority-stale-source-scene-pair",
      (command) => {
        command.clockContribution.sourceSceneRevisionBefore += 1;
        command.clockContribution.sourceSceneRevisionAfter += 1;
      },
      parses,
    ),
    negative(
      "clock-authority-stale-target-scene-pair",
      (command) => {
        command.clockContribution.targetSceneRevisionBefore += 1;
        command.clockContribution.targetSceneRevisionAfter += 1;
      },
      parses,
    ),
  ];
}

function throwReproduction(
  label: string | number,
  commands: readonly Record<string, unknown>[],
  lastCommand: Record<string, unknown> | undefined,
  cause: unknown,
): never {
  throw new Error(
    `Live-session oracle failure ${JSON.stringify({
      seed: label,
      shortestExecutedPrefix: commands,
      lastCommand,
      cause:
        cause instanceof Error
          ? { name: cause.name, message: cause.message }
          : String(cause),
    })}`,
    { cause },
  );
}

function exerciseCommandSurface(coverage: Coverage) {
  const commands: Record<string, unknown>[] = [],
    results: unknown[] = [],
    phases: Array<{ label: string; state: unknown }> = [];
  let lastCommand: Record<string, unknown> | undefined;
  try {
    let party = parsePartyProjection({
      kind: "party-projection",
      version: 1,
      campaignId: CAMPAIGN_ID,
      partyRevision: 0,
      characters: [
        {
          characterId: "character-a",
          active: true,
          profile: { name: "A" },
          progress: {
            currentXp: 20,
            xpSinceLongRest: 10,
            xpSinceShortRest: 5,
          },
          sceneAssignment: { status: "not-started" },
        },
        {
          characterId: "character-b",
          active: true,
          profile: { name: "B" },
          progress: {
            currentXp: 10,
            xpSinceLongRest: 4,
            xpSinceShortRest: 2,
          },
          sceneAssignment: { status: "not-started" },
        },
      ],
    });
    const partySteps: Array<{
      kind: string;
      execute: PartyExecutor;
      overrides: Record<string, unknown>;
      decisionKind: string;
      characterIds: string[];
    }> = [
      {
        kind: "create-party-character",
        execute: createPartyCharacter,
        overrides: { characterId: "character-c", profile: { name: "C" } },
        decisionKind: "character-created",
        characterIds: ["character-c"],
      },
      {
        kind: "update-party-character-profile",
        execute: updatePartyCharacterProfile,
        overrides: {
          characterId: "character-a",
          profile: { name: "A revised", languages: ["Common"] },
        },
        decisionKind: "profile-updated",
        characterIds: ["character-a"],
      },
      {
        kind: "set-party-character-progress",
        execute: setPartyCharacterProgress,
        overrides: {
          characterId: "character-a",
          progress: {
            currentXp: 25,
            xpSinceLongRest: 15,
            xpSinceShortRest: 7,
          },
        },
        decisionKind: "progress-updated",
        characterIds: ["character-a"],
      },
      {
        kind: "rest-party-characters",
        execute: restPartyCharacters,
        overrides: { rest: "short", characterIds: ["character-a"] },
        decisionKind: "characters-rested",
        characterIds: ["character-a"],
      },
      {
        kind: "rest-party-characters",
        execute: restPartyCharacters,
        overrides: { rest: "long", characterIds: ["character-b"] },
        decisionKind: "characters-rested",
        characterIds: ["character-b"],
      },
    ];
    for (const step of partySteps) {
      lastCommand = {
        kind: step.kind,
        version: 1,
        campaignId: CAMPAIGN_ID,
        commandId: `surface-${step.kind}-${party.partyRevision}`,
        commandDigest: `digest-surface-${step.kind}-${party.partyRevision}`,
        expectedPartyRevision: party.partyRevision,
        cancelled: false,
        ...step.overrides,
      };
      commands.push(canonical(lastCommand));
      const applied = applyPartyOracle(
        party,
        lastCommand,
        step.execute,
        { kind: step.decisionKind, characterIds: step.characterIds },
        coverage,
      );
      party = applied.party;
      results.push(canonical(applied.result));
    }

    let state = createUninitializedLiveSessionState(party);
    phases.push({ label: "uninitialized", state: canonical(state) });
    const aggregateSteps: Array<{
      label: string;
      kind: string;
      execute: AggregateExecutor;
      build: (current: LiveSessionAggregateState) => Record<string, unknown>;
      decisionKind: string;
      characterIds: string[];
      sceneIds: string[];
      negativeMutators?: readonly NegativeMutator[];
    }> = [
      {
        label: "preinit-deactivated",
        kind: "deactivate-party-character",
        execute: deactivatePartyCharacter,
        build: (current) =>
          aggregateCommand(
            current,
            "deactivate-party-character",
            "surface-deactivate",
            {
              characterId: "character-b",
            },
          ),
        decisionKind: "character-deactivated",
        characterIds: ["character-b"],
        sceneIds: [],
      },
      {
        label: "preinit-reactivated",
        kind: "activate-party-character",
        execute: activatePartyCharacter,
        build: (current) =>
          aggregateCommand(
            current,
            "activate-party-character",
            "surface-activate",
            {
              characterId: "character-b",
            },
          ),
        decisionKind: "character-activated",
        characterIds: ["character-b"],
        sceneIds: [],
      },
      {
        label: "preinit-third-active",
        kind: "activate-party-character",
        execute: activatePartyCharacter,
        build: (current) =>
          aggregateCommand(
            current,
            "activate-party-character",
            "surface-activate-c",
            {
              characterId: "character-c",
            },
          ),
        decisionKind: "character-activated",
        characterIds: ["character-c"],
        sceneIds: [],
      },
      {
        label: "initialized",
        kind: "initialize-live-session",
        execute: initializeLiveSession,
        build: (current) =>
          aggregateCommand(
            current,
            "initialize-live-session",
            "surface-initialize",
            {
              primarySceneId: "surface-primary",
              sceneClockRef: clockRef("surface-clock-primary"),
              title: "Primary",
              notes: "",
            },
          ),
        decisionKind: "initialized",
        characterIds: ["character-a", "character-b", "character-c"],
        sceneIds: ["surface-primary"],
      },
      {
        label: "prepared",
        kind: "prepare-runtime",
        execute: createPreparedRuntime,
        build: (current) =>
          aggregateCommand(current, "prepare-runtime", "surface-prepare", {
            liveSceneId: "surface-prepared",
            sceneClockRef: clockRef("surface-clock-prepared"),
            snapshot: {
              kind: "preparation-snapshot",
              version: 1,
              campaignId: CAMPAIGN_ID,
              preparationId: "surface-preparation",
              preparationRevision: 1,
              source: {
                ownerId: "planner",
                sourceId: "surface-plan",
                sourceRevision: 1,
              },
              title: "Prepared",
              notes: "",
              contentPins: [],
            },
          }),
        decisionKind: "prepared-runtime-created",
        characterIds: [],
        sceneIds: ["surface-prepared"],
        negativeMutators: [
          negative("snapshot-foreign-campaign", (command) => {
            command.snapshot.campaignId = "foreign-campaign";
          }),
        ],
      },
      {
        label: "postinit-deactivated",
        kind: "deactivate-party-character",
        execute: deactivatePartyCharacter,
        build: (current) =>
          aggregateCommand(
            current,
            "deactivate-party-character",
            "surface-postinit-deactivate",
            {
              characterId: "character-c",
              expectedSourceRevision: 0,
            },
          ),
        decisionKind: "character-deactivated",
        characterIds: ["character-a", "character-b", "character-c"],
        sceneIds: ["surface-primary"],
        negativeMutators: [
          negative("stale-scene-source", (command) => {
            command.expectedSourceRevision += 1;
          }),
        ],
      },
      {
        label: "postinit-reactivated",
        kind: "activate-party-character",
        execute: activatePartyCharacter,
        build: (current) =>
          aggregateCommand(
            current,
            "activate-party-character",
            "surface-postinit-activate",
            {
              characterId: "character-c",
              targetSceneId: "surface-primary",
              expectedTargetRevision: 1,
            },
          ),
        decisionKind: "character-activated",
        characterIds: ["character-a", "character-b", "character-c"],
        sceneIds: ["surface-primary"],
        negativeMutators: [
          negative("stale-scene-target", (command) => {
            command.expectedTargetRevision += 1;
          }),
        ],
      },
      {
        label: "prepared-activated-by-move",
        kind: "move-characters",
        execute: moveCharacters,
        build: (current) =>
          aggregateCommand(current, "move-characters", "surface-move", {
            sourceSceneId: "surface-primary",
            targetSceneId: "surface-prepared",
            expectedSourceRevision: 2,
            expectedTargetRevision: 0,
            characterIds: ["character-b"],
          }),
        decisionKind: "characters-moved",
        characterIds: ["character-a", "character-b", "character-c"],
        sceneIds: ["surface-primary", "surface-prepared"],
        negativeMutators: [
          negative("stale-scene-source", (command) => {
            command.expectedSourceRevision += 1;
          }),
          negative("stale-scene-target", (command) => {
            command.expectedTargetRevision += 1;
          }),
        ],
      },
      {
        label: "focus-moved",
        kind: "set-focus",
        execute: setFocus,
        build: (current) => {
          const target = current.scenes.find(
            (scene) => scene.source.liveSceneId === "surface-prepared",
          )!.source;
          return aggregateCommand(current, "set-focus", "surface-focus", {
            targetSceneId: target.liveSceneId,
            expectedTargetRevision: target.sceneRevision,
          });
        },
        decisionKind: "focus-changed",
        characterIds: [],
        sceneIds: [],
        negativeMutators: [
          negative("stale-scene-target", (command) => {
            command.expectedTargetRevision += 1;
          }),
        ],
      },
      {
        label: "split",
        kind: "split-scene",
        execute: splitScene,
        build: (current) =>
          aggregateCommand(current, "split-scene", "surface-split", {
            sourceSceneId: "surface-primary",
            expectedSourceRevision: 3,
            targetSceneId: "surface-split",
            targetClockRef: clockRef("surface-clock-split"),
            characterIds: ["character-c"],
            title: "Split",
            clockContribution: splitClockContribution("surface-split", 3),
          }),
        decisionKind: "scene-split",
        characterIds: ["character-a", "character-c"],
        sceneIds: ["surface-primary", "surface-split"],
        negativeMutators: splitClockNegatives(),
      },
      {
        label: "rejoined-retired-split",
        kind: "rejoin-scenes",
        execute: rejoinScenes,
        build: (current) =>
          aggregateCommand(current, "rejoin-scenes", "surface-rejoin", {
            sourceSceneId: "surface-split",
            expectedSourceRevision: 0,
            targetSceneId: "surface-prepared",
            expectedTargetRevision: 1,
            clockContribution: mergeClockContribution("surface-rejoin"),
          }),
        decisionKind: "scenes-rejoined",
        characterIds: ["character-b", "character-c"],
        sceneIds: ["surface-prepared", "surface-split"],
        negativeMutators: mergeClockNegatives(),
      },
      {
        label: "retired-primary",
        kind: "deactivate-party-character",
        execute: deactivatePartyCharacter,
        build: (current) =>
          aggregateCommand(
            current,
            "deactivate-party-character",
            "surface-retire",
            {
              characterId: "character-a",
              expectedSourceRevision: 4,
              primarySuccessorSceneId: "surface-prepared",
              expectedSuccessorRevision: 2,
            },
          ),
        decisionKind: "character-deactivated",
        characterIds: ["character-a", "character-b", "character-c"],
        sceneIds: ["surface-primary", "surface-prepared"],
        negativeMutators: [
          negative("stale-scene-source", (command) => {
            command.expectedSourceRevision += 1;
          }),
          negative("stale-scene-successor", (command) => {
            command.expectedSuccessorRevision += 1;
          }),
        ],
      },
    ];
    for (const step of aggregateSteps) {
      lastCommand = step.build(state);
      commands.push(canonical(lastCommand));
      const applied = applyAggregateOracle(
        state,
        lastCommand,
        step.execute,
        {
          kind: step.decisionKind,
          characterIds: step.characterIds,
          sceneIds: step.sceneIds,
        },
        coverage,
        step.negativeMutators,
      );
      state = applied.state;
      results.push(canonical(applied.result));
      phases.push({ label: step.label, state: canonical(state) });
    }
    assert.equal(
      state.scenes.find((scene) => scene.source.liveSceneId === "surface-split")
        ?.source.lifecycle,
      "retired",
    );
    assert.equal(
      state.scenes.find(
        (scene) => scene.source.liveSceneId === "surface-primary",
      )?.source.lifecycle,
      "retired",
    );
    assert.equal(state.primarySceneId, "surface-prepared");
    return canonical({ commands, results, phases, endState: state });
  } catch (error) {
    throwReproduction("surface", commands, lastCommand, error);
  }
}

function runSeed(seed: number) {
  const random = generator(seed),
    commands: Record<string, unknown>[] = [],
    results: unknown[] = [];
  let state = parseLiveSessionAggregateState(rawState()),
    lastCommand: Record<string, unknown> | undefined;
  assertInvariants(state);
  for (let step = 0; step < 80; step++) {
    try {
      lastCommand = undefined;
      const activeScenes = state.scenes.filter(
          (scene) => scene.source.lifecycle === "active",
        ),
        inactive = state.party.characters.filter((entry) => !entry.active),
        movable = activeScenes.filter(
          (scene) => scene.source.characterIds.length > 1,
        ),
        op = step < 4 ? step : random(4),
        id = `fuzz-${seed.toString(16)}-${step}`;
      let execute: AggregateExecutor,
        expected: {
          kind: string;
          characterIds: string[];
          sceneIds: string[];
        };
      if (op === 0 && movable.length > 0) {
        const source = movable[random(movable.length)]!,
          targets = activeScenes.filter(
            (entry) => entry.source.liveSceneId !== source.source.liveSceneId,
          ),
          target = targets[random(targets.length)]!,
          characterId =
            source.source.characterIds[
              random(source.source.characterIds.length)
            ]!;
        lastCommand = aggregateCommand(state, "move-characters", id, {
          sourceSceneId: source.source.liveSceneId,
          targetSceneId: target.source.liveSceneId,
          expectedSourceRevision: source.source.sceneRevision,
          expectedTargetRevision: target.source.sceneRevision,
          characterIds: [characterId],
        });
        execute = moveCharacters;
        expected = {
          kind: "characters-moved",
          characterIds: state.party.characters
            .filter(
              (character) =>
                character.active &&
                character.sceneAssignment.status === "assigned" &&
                [source.source.liveSceneId, target.source.liveSceneId].includes(
                  character.sceneAssignment.liveSceneId,
                ),
            )
            .map((character) => character.characterId),
          sceneIds: state.scenes
            .filter((scene) =>
              [source.source.liveSceneId, target.source.liveSceneId].includes(
                scene.source.liveSceneId,
              ),
            )
            .map((scene) => scene.source.liveSceneId),
        };
      } else if (
        op === 1 &&
        inactive.length &&
        state.focus.status === "active"
      ) {
        const character = inactive[random(inactive.length)]!,
          focus = state.focus,
          target = activeScenes.find(
            (scene) => scene.source.liveSceneId === focus.liveSceneId,
          )!;
        lastCommand = aggregateCommand(state, "activate-party-character", id, {
          characterId: character.characterId,
          targetSceneId: target.source.liveSceneId,
          expectedTargetRevision: target.source.sceneRevision,
        });
        execute = activatePartyCharacter;
        expected = {
          kind: "character-activated",
          characterIds: [
            ...target.source.characterIds,
            character.characterId,
          ].sort(
            (left, right) =>
              state.party.characters.findIndex(
                (entry) => entry.characterId === left,
              ) -
              state.party.characters.findIndex(
                (entry) => entry.characterId === right,
              ),
          ),
          sceneIds: [target.source.liveSceneId],
        };
      } else if (op === 2) {
        const candidates = state.party.characters.filter((character) => {
          if (
            !character.active ||
            character.sceneAssignment.status !== "assigned"
          )
            return false;
          const assignment = character.sceneAssignment;
          return (
            (activeScenes.find(
              (scene) => scene.source.liveSceneId === assignment.liveSceneId,
            )?.source.characterIds.length ?? 0) > 1
          );
        });
        if (candidates.length === 0) {
          const target = activeScenes[random(activeScenes.length)]!;
          lastCommand = aggregateCommand(state, "set-focus", id, {
            targetSceneId: target.source.liveSceneId,
            expectedTargetRevision: target.source.sceneRevision,
          });
          execute = setFocus;
          expected = { kind: "focus-changed", characterIds: [], sceneIds: [] };
        } else {
          const character = candidates[random(candidates.length)]!,
            assignment = character.sceneAssignment;
          if (assignment.status !== "assigned")
            throw new Error("bad candidate");
          const source = activeScenes.find(
            (scene) => scene.source.liveSceneId === assignment.liveSceneId,
          )!;
          lastCommand = aggregateCommand(
            state,
            "deactivate-party-character",
            id,
            {
              characterId: character.characterId,
              expectedSourceRevision: source.source.sceneRevision,
            },
          );
          execute = deactivatePartyCharacter;
          expected = {
            kind: "character-deactivated",
            characterIds: [...source.source.characterIds],
            sceneIds: [source.source.liveSceneId],
          };
        }
      } else {
        const target = activeScenes[random(activeScenes.length)]!;
        lastCommand = aggregateCommand(state, "set-focus", id, {
          targetSceneId: target.source.liveSceneId,
          expectedTargetRevision: target.source.sceneRevision,
        });
        execute = setFocus;
        expected = { kind: "focus-changed", characterIds: [], sceneIds: [] };
      }
      commands.push(canonical(lastCommand));
      const applied = applyAggregateOracle(
        state,
        lastCommand,
        execute,
        expected,
      );
      state = applied.state;
      results.push(canonical(applied.result));
    } catch (error) {
      throwReproduction(seed, commands, lastCommand, error);
    }
  }
  return canonical({ seed, commands, results, endState: state });
}

test("table-driven command oracle and deterministic fuzzer preserve invariants", () => {
  const coverage: Coverage = new Map(),
    surface = exerciseCommandSurface(coverage),
    required = [
      "create-party-character",
      "update-party-character-profile",
      "set-party-character-progress",
      "rest-party-characters",
      "initialize-live-session",
      "prepare-runtime",
      "move-characters",
      "split-scene",
      "rejoin-scenes",
      "activate-party-character",
      "deactivate-party-character",
      "set-focus",
    ];
  for (const kind of required)
    assert((coverage.get(kind) ?? 0) > 0, `missing command coverage: ${kind}`);
  const aggregateKinds = [
      "initialize-live-session",
      "prepare-runtime",
      "move-characters",
      "split-scene",
      "rejoin-scenes",
      "activate-party-character",
      "deactivate-party-character",
      "set-focus",
    ],
    requiredDimensions: Record<string, readonly string[]> = {
      "prepare-runtime": ["snapshot-foreign-campaign"],
      "move-characters": ["stale-scene-source", "stale-scene-target"],
      "split-scene": [
        "stale-scene-source",
        "clock-foreign-campaign",
        "clock-foreign-generation",
        "clock-wrong-command-id",
        "clock-wrong-command-digest",
        "clock-stale-source-owner-revision",
        "clock-stale-source-clock-revision",
        "clock-stale-target-owner-revision",
        "clock-stale-target-clock-revision",
        "clock-parser-target-created-scene-revision",
        "clock-authority-stale-source-clock-pair",
        "clock-authority-stale-source-scene-pair",
      ],
      "rejoin-scenes": [
        "stale-scene-source",
        "stale-scene-target",
        "clock-foreign-campaign",
        "clock-foreign-generation",
        "clock-wrong-command-id",
        "clock-wrong-command-digest",
        "clock-stale-source-owner-revision",
        "clock-stale-source-clock-revision",
        "clock-stale-target-owner-revision-before",
        "clock-stale-target-clock-revision-before",
        "clock-stale-target-owner-revision-after",
        "clock-stale-target-clock-revision-after",
        "clock-authority-stale-source-clock-pair",
        "clock-authority-stale-target-clock-transition",
        "clock-authority-stale-source-scene-pair",
        "clock-authority-stale-target-scene-pair",
      ],
      "activate-party-character": ["stale-scene-target"],
      "deactivate-party-character": [
        "stale-scene-source",
        "stale-scene-successor",
      ],
      "set-focus": ["stale-scene-target"],
    };
  for (const kind of aggregateKinds)
    for (const dimension of [
      "cancelled",
      "foreign-campaign",
      "stale-party",
      "stale-focus",
      ...(requiredDimensions[kind] ?? []),
    ])
      assert(
        (coverage.get(`${kind}×${dimension}`) ?? 0) > 0,
        `missing aggregate negative coverage: ${kind}×${dimension}`,
      );
  assert.deepEqual(
    surface.phases.map((phase) => phase.label),
    [
      "uninitialized",
      "preinit-deactivated",
      "preinit-reactivated",
      "preinit-third-active",
      "initialized",
      "prepared",
      "postinit-deactivated",
      "postinit-reactivated",
      "prepared-activated-by-move",
      "focus-moved",
      "split",
      "rejoined-retired-split",
      "retired-primary",
    ],
  );
  assert.deepEqual(exerciseCommandSurface(new Map()), surface);
  for (const seed of [0x534d5233, 0x1a2b3c4d, 0xc0ffee42])
    assert.deepEqual(runSeed(seed), runSeed(seed));
});

function scaleState() {
  const raw = rawState(20, 4) as any,
    participantCounts = [12, 12, 12, 10, 1, 1, 1, 1],
    masksPerScene = [4, 2, 1, 1];
  const memberships = [
    Array.from({ length: 14 }, (_, index) => `character-${index}`),
    ["character-14", "character-15"],
    ["character-16", "character-17"],
    ["character-18", "character-19"],
  ];
  for (let index = 0; index < raw.party.characters.length; index++) {
    const character = raw.party.characters[index],
      sceneIndex = memberships.findIndex((ids) =>
        ids.includes(character.characterId),
      );
    character.active = true;
    character.sceneAssignment = {
      status: "assigned",
      liveSceneId: `scene-${sceneIndex}`,
      sceneRevision: 0,
    };
  }
  let maskIndex = 0;
  for (let sceneIndex = 0; sceneIndex < raw.scenes.length; sceneIndex++) {
    const source = raw.scenes[sceneIndex].source,
      sceneMembers = memberships[sceneIndex]!;
    source.characterIds = [...sceneMembers];
    source.maskRefs = [];
    source.maskParticipationProjections = [];
    source.reconciliations = [];
    for (
      let ownerIndex = 0;
      ownerIndex < masksPerScene[sceneIndex]!;
      ownerIndex++
    ) {
      const ownerId = `mask-owner-${sceneIndex}-${ownerIndex}`,
        generationId = `mask-generation-${sceneIndex}-${ownerIndex}`,
        maskId = ownerIndex === 0 ? "shared-mask-id" : `mask-${maskIndex}`,
        ownerRevision = 10 + maskIndex,
        participantCount = participantCounts[maskIndex]!,
        participants = sceneMembers.slice(0, participantCount);
      source.maskRefs.push({
        maskId,
        kind: "encounter",
        ownerId,
        generationId,
        ownerRevision,
        lifecycle: "active",
      });
      source.maskParticipationProjections.push({
        kind: "mask-participation-projection",
        version: 1,
        campaignId: CAMPAIGN_ID,
        liveSceneId: source.liveSceneId,
        maskId,
        maskKind: "encounter",
        ownerIdentity: { ownerId, generationId },
        ownerRevision,
        participantCharacterIds: participants,
        lifecycle: "active",
      });
      source.reconciliations.push({
        ownerId,
        generationId,
        status: "current",
        ownerRevision,
        receiptLedgerBaseRevision: ownerRevision,
      });
      maskIndex++;
    }
  }
  return raw;
}

function preparedScaleContributions(
  state: LiveSessionAggregateState,
  sourceSceneId: string,
  targetSceneId: string,
  characterIds: readonly string[],
  commandId: string,
  commandDigest: string,
) {
  const source = state.scenes.find(
      (scene) => scene.source.liveSceneId === sourceSceneId,
    )!.source,
    target = state.scenes.find(
      (scene) => scene.source.liveSceneId === targetSceneId,
    )!.source,
    selected = new Set(characterIds),
    affectedCharacterIds = state.party.characters
      .filter((character) => selected.has(character.characterId))
      .map((character) => character.characterId),
    byOwner = new Map<string, any[]>();
  for (const projection of source.maskParticipationProjections) {
    const key = `${projection.ownerIdentity.ownerId}\u0000${projection.ownerIdentity.generationId}`,
      group = byOwner.get(key);
    if (group) group.push(projection);
    else byOwner.set(key, [projection]);
  }
  return [...byOwner.values()].flatMap((projections) => {
    const first = projections[0]!,
      owner = source.reconciliations.find(
        (entry) =>
          entry.ownerId === first.ownerIdentity.ownerId &&
          entry.generationId === first.ownerIdentity.generationId,
      );
    if (owner?.status !== "current" || owner.ownerRevision === undefined)
      return [];
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
        return participants.length === 0
          ? []
          : [
              {
                maskId: mask.maskId,
                maskKind: mask.maskKind,
                expectedOwnerRevision: owner.ownerRevision,
                lifecycleBefore: mask.lifecycle,
                participantCharacterIds: participants,
                lifecycleAfter: mask.lifecycle,
              },
            ];
      });
    if (masks.length === 0) return [];
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
        sourceSceneId,
        sourceSceneRevisionBefore: source.sceneRevision,
        sourceSceneRevisionAfter: source.sceneRevision + 1,
        sourceLifecycleBefore: "active",
        sourceLifecycleAfter: "active",
        target: {
          kind: "existing",
          liveSceneId: targetSceneId,
          revisionBefore: target.sceneRevision,
          revisionAfter: target.sceneRevision + 1,
        },
        ownerIdentity: {
          ownerId: owner.ownerId,
          generationId: owner.generationId,
        },
        ownerRevisionBefore: owner.ownerRevision,
        ownerRevisionAfter: owner.ownerRevision + 1,
        affectedCharacterIds,
        scope: {
          kind: "complete-mask-delta",
          operation: "remove-participants",
          masks,
        },
        beforeMasks,
        afterMasks: beforeMasks.map((mask) => ({
          ...mask,
          participantCharacterIds: mask.participantCharacterIds.filter(
            (id: string) => !selected.has(id),
          ),
        })),
      },
    ];
  });
}

function scaleMoveCommand(state: LiveSessionAggregateState, commandId: string) {
  const commandDigest = `digest-${commandId}`;
  return aggregateCommand(state, "move-characters", commandId, {
    commandDigest,
    sourceSceneId: "scene-0",
    targetSceneId: "scene-1",
    expectedSourceRevision: 0,
    expectedTargetRevision: 0,
    characterIds: ["character-0"],
    maskOwnerContributions: preparedScaleContributions(
      state,
      "scene-0",
      "scene-1",
      ["character-0"],
      commandId,
      commandDigest,
    ),
  });
}

function maskContributionNegatives(): readonly NegativeMutator[] {
  const contribution = (command: Record<string, any>) =>
      command.maskOwnerContributions[0],
    parses = (command: Record<string, any>) => {
      parseMaskOwnerPreparedContribution(contribution(command));
    };
  return [
    negative("mask-foreign-campaign", (command) => {
      contribution(command).campaignId = "foreign-campaign";
    }),
    negative("mask-foreign-generation", (command) => {
      contribution(command).ownerIdentity.generationId = "foreign-generation";
    }),
    negative("mask-wrong-command-id", (command) => {
      contribution(command).commandId = "wrong-command";
    }),
    negative("mask-wrong-command-digest", (command) => {
      contribution(command).commandDigest = "wrong-digest";
    }),
    negative("mask-stale-owner-revision-before", (command) => {
      contribution(command).ownerRevisionBefore += 1;
    }),
    negative("mask-stale-owner-revision-after", (command) => {
      contribution(command).ownerRevisionAfter += 1;
    }),
    negative("mask-stale-scope-owner-revision", (command) => {
      contribution(command).scope.masks[0].expectedOwnerRevision += 1;
    }),
    negative("mask-stale-source-revision-before", (command) => {
      contribution(command).sourceSceneRevisionBefore += 1;
    }),
    negative("mask-stale-source-revision-after", (command) => {
      contribution(command).sourceSceneRevisionAfter += 1;
    }),
    negative("mask-stale-target-revision-before", (command) => {
      contribution(command).target.revisionBefore += 1;
    }),
    negative("mask-stale-target-revision-after", (command) => {
      contribution(command).target.revisionAfter += 1;
    }),
    negative(
      "mask-authority-stale-owner-revision-transition",
      (command) => {
        const prepared = contribution(command);
        prepared.ownerRevisionBefore += 1;
        prepared.ownerRevisionAfter += 1;
        for (const mask of prepared.scope.masks)
          mask.expectedOwnerRevision += 1;
      },
      parses,
    ),
    negative(
      "mask-authority-stale-source-scene-pair",
      (command) => {
        const prepared = contribution(command);
        prepared.sourceSceneRevisionBefore += 1;
        prepared.sourceSceneRevisionAfter += 1;
      },
      parses,
    ),
    negative(
      "mask-authority-stale-target-scene-pair",
      (command) => {
        const prepared = contribution(command);
        prepared.target.revisionBefore += 1;
        prepared.target.revisionAfter += 1;
      },
      parses,
    ),
  ];
}

test("20/4/8/50 scale fixture survives strict DTO and scene projection roundtrips", (t) => {
  const started = performance.now(),
    state = parseLiveSessionAggregateState(scaleState()),
    json = JSON.stringify(state),
    roundtrip = parseLiveSessionAggregateState(JSON.parse(json)),
    focus = projectFocus(roundtrip.focus, roundtrip.scenes[0]?.source),
    projections = roundtrip.scenes.map((scene) =>
      projectLiveScene(scene.source, focus),
    );
  assert.deepEqual(roundtrip, state);
  assert(frozenGraph(roundtrip));
  assert.equal(roundtrip.party.characters.length, 20);
  assert.equal(
    roundtrip.scenes.filter((scene) => scene.source.lifecycle === "active")
      .length,
    4,
  );
  assert.deepEqual(
    roundtrip.scenes.map((scene) => scene.source.characterIds.length),
    [14, 2, 2, 2],
  );
  assert.equal(
    roundtrip.scenes.reduce(
      (sum, scene) => sum + scene.source.maskRefs.length,
      0,
    ),
    8,
  );
  assert.deepEqual(
    roundtrip.scenes.map((scene) => scene.source.maskRefs.length),
    [4, 2, 1, 1],
  );
  assert.equal(
    roundtrip.scenes.reduce(
      (sum, scene) =>
        sum +
        scene.source.maskParticipationProjections.reduce(
          (sceneSum, mask) => sceneSum + mask.participantCharacterIds.length,
          0,
        ),
      0,
    ),
    50,
  );
  assert.equal(
    projections.every((entry) => entry.status === "active"),
    true,
  );
  for (let index = 0; index < roundtrip.scenes.length; index++) {
    const result = projections[index]!;
    assert.equal(result.status, "active");
    if (result.status !== "active") continue;
    assert.deepEqual(
      result.projection.maskRefs,
      roundtrip.scenes[index]!.source.maskRefs,
    );
    assert.deepEqual(
      result.projection.maskParticipationProjections,
      roundtrip.scenes[index]!.source.maskParticipationProjections,
    );
  }
  const sharedOwners = roundtrip.scenes
    .flatMap((scene) => scene.source.maskRefs)
    .filter((mask) => mask.maskId === "shared-mask-id")
    .map((mask) => `${mask.ownerId}\u0000${mask.generationId}`);
  assert.equal(sharedOwners.length, 4);
  assert.equal(new Set(sharedOwners).size, 4);

  const transitionCommand = scaleMoveCommand(roundtrip, "scale-move"),
    maskCoverage: Coverage = new Map(),
    maskDimensions = maskContributionNegatives(),
    requiredMaskDimensions = [
      "mask-foreign-campaign",
      "mask-foreign-generation",
      "mask-wrong-command-id",
      "mask-wrong-command-digest",
      "mask-stale-owner-revision-before",
      "mask-stale-owner-revision-after",
      "mask-stale-scope-owner-revision",
      "mask-stale-source-revision-before",
      "mask-stale-source-revision-after",
      "mask-stale-target-revision-before",
      "mask-stale-target-revision-after",
      "mask-authority-stale-owner-revision-transition",
      "mask-authority-stale-source-scene-pair",
      "mask-authority-stale-target-scene-pair",
    ];
  const transitioned = applyAggregateOracle(
    roundtrip,
    transitionCommand,
    moveCharacters,
    {
      kind: "characters-moved",
      characterIds: Array.from(
        { length: 16 },
        (_, index) => `character-${index}`,
      ),
      sceneIds: ["scene-0", "scene-1"],
    },
    maskCoverage,
    maskDimensions,
  );
  for (const dimension of requiredMaskDimensions)
    assert(
      (maskCoverage.get(`move-characters×${dimension}`) ?? 0) > 0,
      `missing mask contribution coverage: move-characters×${dimension}`,
    );
  assert.equal(
    transitioned.result.status === "applied" &&
      transitioned.result.decision.sceneCleanup?.reconciliations.length,
    4,
  );
  assert.equal(transitioned.state.pendingReconciliations.length, 0);
  assert.equal(
    transitioned.state.scenes.reduce(
      (sum, scene) =>
        sum +
        scene.source.maskParticipationProjections.reduce(
          (sceneSum, mask) => sceneSum + mask.participantCharacterIds.length,
          0,
        ),
      0,
    ),
    46,
  );
  t.diagnostic(
    `scale DTO: ${new TextEncoder().encode(json).length} bytes; ${(
      performance.now() - started
    ).toFixed(2)} ms (diagnostic only)`,
  );
});

test("unavailable mask owner produces an exact pending reconciliation", () => {
  const raw = scaleState() as any,
    source = raw.scenes[0].source,
    unavailable = source.reconciliations[0],
    unavailableKey = `${unavailable.ownerId}\u0000${unavailable.generationId}`;
  unavailable.status = "unavailable";
  delete unavailable.receiptLedgerBaseRevision;
  source.maskParticipationProjections =
    source.maskParticipationProjections.filter(
      (projection: any) =>
        `${projection.ownerIdentity.ownerId}\u0000${projection.ownerIdentity.generationId}` !==
        unavailableKey,
    );
  const state = parseLiveSessionAggregateState(raw),
    command = scaleMoveCommand(state, "scale-unavailable-move"),
    applied = applyAggregateOracle(state, command, moveCharacters, {
      kind: "characters-moved",
      characterIds: Array.from(
        { length: 16 },
        (_, index) => `character-${index}`,
      ),
      sceneIds: ["scene-0", "scene-1"],
    });
  assert.equal(applied.state.pendingReconciliations.length, 1);
  const pending = applied.state.pendingReconciliations[0]!;
  assert.equal(pending.delivery, "pending");
  assert.equal(pending.kind, "mask-owner-reconciliation");
  if (pending.kind !== "mask-owner-reconciliation") return;
  assert.deepEqual(pending.ownerIdentity, {
    ownerId: unavailable.ownerId,
    generationId: unavailable.generationId,
  });
  assert.deepEqual(pending.scope, {
    kind: "owner-scope-unresolved",
    cause: "unavailable",
    knownMaskRefs: [
      {
        maskId: "shared-mask-id",
        maskKind: "encounter",
        expectedOwnerRevision: unavailable.ownerRevision,
        lifecycleBefore: "active",
      },
    ],
  });
});
