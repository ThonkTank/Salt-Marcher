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
  parseLiveSessionAggregateState,
  projectFocus,
  projectLiveScene,
  rejoinScenes,
  restPartyCharacters,
  setFocus,
  setPartyCharacterProgress,
  splitScene,
  updatePartyCharacterProfile,
  type LiveSessionAggregateState,
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
  assert.equal(primaryScenes.length, 1);
  assert.equal(primaryScenes[0]?.source.liveSceneId, state.primarySceneId);
  for (const character of state.party.characters) {
    if (!character.active) {
      assert.equal(character.sceneAssignment.status, "inactive");
      assert.equal(assigned.has(character.characterId), false);
      assert.equal(pending.has(character.characterId), false);
      continue;
    }
    const inAssigned = assigned.has(character.characterId),
      inPending = pending.has(character.characterId);
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

function applyAndCheck(
  state: LiveSessionAggregateState,
  command: Record<string, unknown>,
  execute: (
    stateValue: unknown,
    commandValue: unknown,
  ) => {
    status: string;
    state: LiveSessionAggregateState;
    decision?: { readonly commandId: string; readonly commandDigest: string };
  },
) {
  const mutable = structuredClone(state),
    snapshot = structuredClone(mutable),
    first = execute(mutable, command),
    duplicate = execute(structuredClone(state), structuredClone(command));
  assert.deepEqual(mutable, snapshot);
  assert.deepEqual(duplicate, first);
  assert.equal(first.status, "applied");
  assert.equal(first.decision?.commandId, command.commandId);
  assert.equal(first.decision?.commandDigest, command.commandDigest);
  const retry = execute(first.state, command);
  assert.notEqual(retry.status, "applied");
  assert.deepEqual(retry.state, first.state);
  assertInvariants(first.state, state);
  return first.state;
}

function exerciseCommandSurface() {
  let party: any = {
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
  };
  const partyCommand = (kind: string, overrides: Record<string, unknown>) => ({
    kind,
    version: 1,
    campaignId: CAMPAIGN_ID,
    commandId: `surface-${kind}-${party.partyRevision}`,
    commandDigest: `digest-${kind}-${party.partyRevision}`,
    expectedPartyRevision: party.partyRevision,
    cancelled: false,
    ...overrides,
  });
  const applyParty = (
    execute: (partyValue: unknown, commandValue: unknown) => any,
    kind: string,
    overrides: Record<string, unknown>,
  ) => {
    const result = execute(party, partyCommand(kind, overrides));
    assert.equal(result.status, "applied");
    if (result.status === "applied") party = result.party;
  };
  applyParty(createPartyCharacter, "create-party-character", {
    characterId: "character-c",
    profile: { name: "C" },
  });
  applyParty(updatePartyCharacterProfile, "update-party-character-profile", {
    characterId: "character-a",
    profile: { name: "A revised", languages: ["Common"] },
  });
  applyParty(setPartyCharacterProgress, "set-party-character-progress", {
    characterId: "character-a",
    progress: {
      currentXp: 25,
      xpSinceLongRest: 15,
      xpSinceShortRest: 7,
    },
  });
  applyParty(restPartyCharacters, "rest-party-characters", {
    rest: "short",
    characterIds: ["character-a"],
  });
  applyParty(restPartyCharacters, "rest-party-characters", {
    rest: "long",
    characterIds: ["character-b"],
  });
  let state = createUninitializedLiveSessionState(party),
    result = deactivatePartyCharacter(
      state,
      aggregateCommand(
        state,
        "deactivate-party-character",
        "surface-deactivate",
        {
          characterId: "character-b",
        },
      ),
    );
  assert.equal(result.status, "applied");
  if (result.status !== "applied") throw new Error("surface deactivate failed");
  state = result.state;
  result = activatePartyCharacter(
    state,
    aggregateCommand(state, "activate-party-character", "surface-activate", {
      characterId: "character-b",
    }),
  );
  assert.equal(result.status, "applied");
  if (result.status !== "applied") throw new Error("surface activate failed");
  state = result.state;
  result = activatePartyCharacter(
    state,
    aggregateCommand(state, "activate-party-character", "surface-activate-c", {
      characterId: "character-c",
    }),
  );
  assert.equal(result.status, "applied");
  if (result.status !== "applied") throw new Error("surface activate c failed");
  state = result.state;
  result = initializeLiveSession(
    state,
    aggregateCommand(state, "initialize-live-session", "surface-initialize", {
      primarySceneId: "surface-primary",
      sceneClockRef: {
        ownerId: "clock",
        generationId: "clock-generation",
        referenceId: "surface-clock-primary",
        ownerRevision: 0,
      },
      title: "Primary",
      notes: "",
    }),
  );
  assert.equal(result.status, "applied");
  if (result.status !== "applied") throw new Error("surface init failed");
  state = result.state;
  result = createPreparedRuntime(
    state,
    aggregateCommand(state, "prepare-runtime", "surface-prepare", {
      liveSceneId: "surface-prepared",
      sceneClockRef: {
        ownerId: "clock",
        generationId: "clock-generation",
        referenceId: "surface-clock-prepared",
        ownerRevision: 0,
      },
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
  );
  assert.equal(result.status, "applied");
  if (result.status !== "applied") throw new Error("surface prepare failed");
  state = result.state;
  result = moveCharacters(
    state,
    aggregateCommand(state, "move-characters", "surface-move", {
      sourceSceneId: "surface-primary",
      targetSceneId: "surface-prepared",
      expectedSourceRevision: 0,
      expectedTargetRevision: 0,
      characterIds: ["character-b"],
    }),
  );
  assert.equal(result.status, "applied");
  if (result.status !== "applied") throw new Error("surface move failed");
  state = result.state;
  const clockValue = {
      codecId: "smr07.elapsed-seconds",
      codecVersion: 1,
      canonicalValue: "3600",
    },
    calendarDefinitionRef = {
      ownerId: "clock",
      referenceId: "calendar-surface",
      ownerRevision: 1,
    },
    splitCommand = aggregateCommand(state, "split-scene", "surface-split", {
      sourceSceneId: "surface-primary",
      expectedSourceRevision: 1,
      targetSceneId: "surface-split",
      targetClockRef: {
        ownerId: "clock",
        generationId: "clock-generation",
        referenceId: "surface-clock-split",
        ownerRevision: 0,
      },
      characterIds: ["character-c"],
      title: "Split",
      clockContribution: {
        kind: "clock-fork-create-contribution",
        version: 1,
        status: "prepared-unpublished",
        receiptId: "surface-clock-fork-receipt",
        campaignId: CAMPAIGN_ID,
        commandId: "surface-split",
        commandDigest: "digest-surface-split",
        ownerIdentity: {
          ownerId: "clock",
          generationId: "clock-generation",
        },
        calendarDefinitionRef,
        sourceSceneId: "surface-primary",
        sourceSceneRevisionBefore: 1,
        sourceSceneRevisionAfter: 2,
        sourceClockRef: {
          ownerId: "clock",
          generationId: "clock-generation",
          referenceId: "surface-clock-primary",
          ownerRevision: 0,
        },
        sourceClockValue: clockValue,
        sourceClockRevisionAfter: 0,
        targetSceneId: "surface-split",
        targetSceneRevisionAfter: 0,
        targetClockRefAfter: {
          ownerId: "clock",
          generationId: "clock-generation",
          referenceId: "surface-clock-split",
          ownerRevision: 0,
        },
        targetClockRevisionAfter: 0,
        targetClockValueAfter: clockValue,
        sourceDisposition: "retain",
        targetKind: "created",
        choice: "source-confirmed",
      },
    });
  result = splitScene(state, splitCommand);
  assert.equal(result.status, "applied");
  if (result.status !== "applied") throw new Error("surface split failed");
  state = result.state;
  result = rejoinScenes(
    state,
    aggregateCommand(state, "rejoin-scenes", "surface-rejoin", {
      sourceSceneId: "surface-split",
      expectedSourceRevision: 0,
      targetSceneId: "surface-prepared",
      expectedTargetRevision: 1,
      clockContribution: {
        kind: "clock-merge-contribution",
        version: 1,
        status: "prepared-unpublished",
        receiptId: "surface-clock-merge-receipt",
        campaignId: CAMPAIGN_ID,
        commandId: "surface-rejoin",
        commandDigest: "digest-surface-rejoin",
        ownerIdentity: {
          ownerId: "clock",
          generationId: "clock-generation",
        },
        calendarDefinitionRef,
        sourceSceneId: "surface-split",
        sourceSceneRevisionBefore: 0,
        sourceSceneRevisionAfter: 1,
        sourceClockRef: {
          ownerId: "clock",
          generationId: "clock-generation",
          referenceId: "surface-clock-split",
          ownerRevision: 0,
        },
        sourceClockValue: clockValue,
        sourceClockRevisionAfter: 0,
        targetSceneId: "surface-prepared",
        targetSceneRevisionBefore: 1,
        targetSceneRevisionAfter: 2,
        targetClockRefBefore: {
          ownerId: "clock",
          generationId: "clock-generation",
          referenceId: "surface-clock-prepared",
          ownerRevision: 0,
        },
        targetClockRevisionBefore: 0,
        targetClockValueBefore: clockValue,
        targetClockRefAfter: {
          ownerId: "clock",
          generationId: "clock-generation",
          referenceId: "surface-clock-prepared",
          ownerRevision: 1,
        },
        targetClockRevisionAfter: 1,
        targetClockValueAfter: {
          ...clockValue,
          canonicalValue: "7200",
        },
        sourceDisposition: "archive",
        targetKind: "existing",
        choice: "manual-confirmed",
      },
    }),
  );
  assert.equal(result.status, "applied");
}

test("deterministic command fuzzer preserves live-session invariants", () => {
  exerciseCommandSurface();
  const seeds = [0x534d5233, 0x1a2b3c4d, 0xc0ffee42];
  for (const seed of seeds) {
    const random = generator(seed),
      prefix: string[] = [];
    let state = parseLiveSessionAggregateState(rawState());
    assertInvariants(state);
    for (let step = 0; step < 80; step++) {
      try {
        const activeScenes = state.scenes.filter(
            (scene) => scene.source.lifecycle === "active",
          ),
          inactive = state.party.characters.filter((entry) => !entry.active),
          movable = activeScenes.filter(
            (scene) => scene.source.characterIds.length > 1,
          ),
          // The fixed prefix proves every scheduler branch for every seed;
          // later choices remain pseudo-random and reproducible.
          op = step < 5 ? step : random(5),
          id = `fuzz-${seed.toString(16)}-${step}`;
        if (op === 0 && movable.length) {
          const source = movable[random(movable.length)]!,
            targets = activeScenes.filter(
              (entry) => entry.source.liveSceneId !== source.source.liveSceneId,
            ),
            target = targets[random(targets.length)]!,
            characterId =
              source.source.characterIds[
                random(source.source.characterIds.length)
              ]!,
            command = aggregateCommand(state, "move-characters", id, {
              sourceSceneId: source.source.liveSceneId,
              targetSceneId: target.source.liveSceneId,
              expectedSourceRevision: source.source.sceneRevision,
              expectedTargetRevision: target.source.sceneRevision,
              characterIds: [characterId],
            });
          prefix.push(
            `move:${characterId}:${source.source.liveSceneId}>${target.source.liveSceneId}`,
          );
          state = applyAndCheck(state, command, moveCharacters);
        } else if (
          op === 1 &&
          inactive.length &&
          state.focus.status === "active"
        ) {
          const focus = state.focus;
          const character = inactive[random(inactive.length)]!,
            target = activeScenes.find(
              (scene) => scene.source.liveSceneId === focus.liveSceneId,
            )!,
            command = aggregateCommand(state, "activate-party-character", id, {
              characterId: character.characterId,
              targetSceneId: target.source.liveSceneId,
              expectedTargetRevision: target.source.sceneRevision,
            });
          prefix.push(`activate:${character.characterId}`);
          state = applyAndCheck(state, command, activatePartyCharacter);
        } else if (op === 2) {
          const candidates = state.party.characters.filter((character) => {
              if (
                !character.active ||
                character.sceneAssignment.status !== "assigned"
              )
                return false;
              const assignment = character.sceneAssignment;
              const scene = activeScenes.find(
                (entry) => entry.source.liveSceneId === assignment.liveSceneId,
              );
              return (scene?.source.characterIds.length ?? 0) > 1;
            }),
            character = candidates[random(candidates.length)]!;
          if (!character) continue;
          const source = activeScenes.find(
              (scene) =>
                scene.source.liveSceneId ===
                (character.sceneAssignment as { liveSceneId: string })
                  .liveSceneId,
            )!,
            command = aggregateCommand(
              state,
              "deactivate-party-character",
              id,
              {
                characterId: character.characterId,
                expectedSourceRevision: source.source.sceneRevision,
              },
            );
          prefix.push(`deactivate:${character.characterId}`);
          state = applyAndCheck(state, command, deactivatePartyCharacter);
        } else if (op === 3) {
          const target = activeScenes[random(activeScenes.length)]!,
            command = aggregateCommand(state, "set-focus", id, {
              targetSceneId: target.source.liveSceneId,
              expectedTargetRevision: target.source.sceneRevision,
            });
          prefix.push(`focus:${target.source.liveSceneId}`);
          state = applyAndCheck(state, command, setFocus);
        } else {
          const target = activeScenes[random(activeScenes.length)]!,
            mode = random(3),
            command = aggregateCommand(state, "set-focus", id, {
              targetSceneId: target.source.liveSceneId,
              expectedTargetRevision: target.source.sceneRevision,
              ...(mode === 0
                ? { cancelled: true }
                : mode === 1
                  ? { campaignId: "foreign-campaign" }
                  : { expectedFocusRevision: state.focus.focusRevision + 1 }),
            }),
            before = structuredClone(state),
            result = setFocus(state, command);
          prefix.push(`negative:${mode}`);
          assert.notEqual(result.status, "applied");
          assert.deepEqual(result.state, before);
          assertInvariants(result.state, state);
        }
      } catch (error) {
        const reproduction = JSON.stringify({ seed, step, prefix });
        throw new Error(`Live-session fuzzer failure ${reproduction}`, {
          cause: error,
        });
      }
    }
  }
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
  t.diagnostic(
    `scale DTO: ${new TextEncoder().encode(json).length} bytes; ${(
      performance.now() - started
    ).toFixed(2)} ms (diagnostic only)`,
  );
});
