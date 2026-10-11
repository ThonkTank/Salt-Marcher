import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  applyPartyHistoryCommand,
  assessCharacterClosure,
  bindRetainedQuarantineSlot,
  createPreparedRuntime,
  createPartyCommandHistory,
  createUninitializedLiveSessionState,
  decidePermanentCharacterDeletion,
  decidePortability,
  decideQuarantineDiscard,
  initializeLiveSession,
  mintReboundErasureToken,
  recordPartyHistory,
  referenceOwnerSurvivorProof,
  moveCharacters,
  rejoinScenes,
  sealPartyHistoryForDeletion,
  stageMultiOwnerCommand,
  transitionMultiOwnerCommand,
  type CoordinatedCommandKind,
} from "../../src/features/live-session";

type Raw = Record<string, any>;

const CAMPAIGN_A = "00000000-0000-4000-8000-000000000001";
const CAMPAIGN_B = "00000000-0000-4000-8000-000000000002";
const digest = (canonical: string): string =>
  `sha256:${createHash("sha256").update(canonical).digest("hex")}`;
const evidence = (label: string): string =>
  digest(JSON.stringify(["live-session-lifecycle", label]));
const fact = (value: unknown): string =>
  digest(JSON.stringify(["live-session-lifecycle-fact", value]));

function profile(name: string) {
  return { name };
}

function progress(currentXp = 0) {
  return {
    currentXp,
    xpSinceLongRest: currentXp,
    xpSinceShortRest: currentXp,
  };
}

function party(
  partyRevision = 0,
  firstName = "Alex",
  active = false,
): Raw {
  return {
    kind: "party-projection",
    version: 1,
    campaignId: CAMPAIGN_A,
    partyRevision,
    characters: [
      {
        characterId: "character-a",
        active,
        profile: profile(firstName),
        progress: progress(10),
        sceneAssignment: { status: active ? "not-started" : "inactive" },
      },
      {
        characterId: "character-b",
        active,
        profile: profile("Bryn"),
        progress: progress(20),
        sceneAssignment: { status: active ? "not-started" : "inactive" },
      },
    ],
  };
}

function historyCommand(
  kind: "undo-party-history" | "redo-party-history",
  expectedPartyRevision: number,
  expectedHistoryRevision: number,
  suffix: string,
) {
  return {
    kind,
    version: 1,
    campaignId: CAMPAIGN_A,
    commandId: `command-${suffix}`,
    commandDigest: `digest-${suffix}`,
    receiptId: `receipt-${suffix}`,
    expectedPartyRevision,
    expectedHistoryRevision,
    cancelled: false,
    participantInputs: [],
  };
}

function rawRegistry(campaignId = CAMPAIGN_A): Raw {
  return {
    kind: "reference-owner-registry-projection",
    version: 1,
    status: "complete",
    campaignId,
    registryRevision: 4,
    owners: [
      {
        kind: "reference-owner-registry-entry",
        version: 1,
        ownerId: "owner-party",
        ownerRevision: 7,
        availability: "available",
        slots: [
          {
            kind: "erasure-slot-definition",
            version: 1,
            campaignId,
            ownerId: "owner-party",
            payloadClass: "party-roster",
            slotId: "slot-party",
            slotRevision: 3,
            targetScopeId: "scope-party",
          },
        ],
      },
      {
        kind: "reference-owner-registry-entry",
        version: 1,
        ownerId: "owner-scenes",
        ownerRevision: 9,
        availability: "unavailable",
        slots: [
          {
            kind: "erasure-slot-definition",
            version: 1,
            campaignId,
            ownerId: "owner-scenes",
            payloadClass: "live-scenes",
            slotId: "slot-scenes",
            slotRevision: 5,
            targetScopeId: "scope-scenes",
          },
        ],
      },
    ],
  };
}

function rawEntry(
  ownerId: string,
  ownerRevision: number,
  payloadClass: string,
  slotId: string,
  slotRevision: number,
  targetScopeId: string,
  suffix: string,
  closureStatus: "removed" | "unavailable-quarantined",
): Raw {
  const erasureUnitId = `deleted-${suffix}`,
    beforeHash = evidence(`before-${suffix}`),
    expectedSurvivors = [
      {
        kind: "expected-survivor-binding",
        version: 1,
        ownerId,
        payloadClass,
        survivorId: `survivor-${suffix}`,
        targetScopeId,
        beforeHash: evidence(`survivor-before-${suffix}`),
      },
    ],
    proof = referenceOwnerSurvivorProof(expectedSurvivors as never, digest);
  return {
    kind: "reference-owner-manifest-entry",
    version: 1,
    ownerId,
    ownerRevision,
    payloadClass,
    slotId,
    slotRevision,
    erasureUnitId,
    targetScopeId,
    beforeHash,
    survivorSetHash: proof.survivorSetHash,
    survivorRootHash: proof.survivorRootHash,
    closureStatus,
    erasureToken: {
      kind: "erasure-token",
      version: 1,
      status: "opaque-non-executable",
      tokenId: `token-${slotId}`,
      deletionCommandId: "command-delete-character-a",
      campaignId: CAMPAIGN_A,
      characterId: "character-a",
      ownerId,
      ownerRevision,
      payloadClass,
      slotId,
      slotRevision,
      erasureUnitId,
      targetScopeId,
      expectedBeforeHash: beforeHash,
      expectedSurvivorSetHash: proof.survivorSetHash,
      expectedSurvivorRootHash: proof.survivorRootHash,
    },
    expectedSurvivors,
  };
}

function rawManifest(): Raw {
  return {
    kind: "reference-owner-manifest",
    version: 1,
    status: "closed",
    manifestId: "manifest-character-a",
    deletionCommandId: "command-delete-character-a",
    campaignId: CAMPAIGN_A,
    characterId: "character-a",
    registryRevision: 4,
    entries: [
      rawEntry(
        "owner-party",
        7,
        "party-roster",
        "slot-party",
        3,
        "scope-party",
        "party",
        "removed",
      ),
      rawEntry(
        "owner-scenes",
        9,
        "live-scenes",
        "slot-scenes",
        5,
        "scope-scenes",
        "scenes",
        "unavailable-quarantined",
      ),
    ],
  };
}

function rawTombstone(): Raw {
  return {
    kind: "character-deletion-tombstone",
    version: 1,
    status: "non-reconstructive",
    tombstoneId: "tombstone-character-a",
    manifestId: "manifest-character-a",
    deletionCommandId: "command-delete-character-a",
    campaignId: CAMPAIGN_A,
    characterId: "character-a",
    registryRevision: 4,
  };
}

function rawClosureReceipt(
  entry: Raw,
  outcome: "removed" | "quarantine-erased",
): Raw {
  return {
    kind: "reference-owner-closure-receipt",
    version: 1,
    outcome,
    manifestId: "manifest-character-a",
    tombstoneId: "tombstone-character-a",
    deletionCommandId: "command-delete-character-a",
    campaignId: CAMPAIGN_A,
    characterId: "character-a",
    ownerId: entry.ownerId,
    ownerRevision: entry.ownerRevision,
    payloadClass: entry.payloadClass,
    slotId: entry.slotId,
    slotRevision: entry.slotRevision,
    targetScopeId: entry.targetScopeId,
    beforeHash: entry.beforeHash,
    afterHash: evidence(`after-${entry.slotId}`),
    survivorSetHash: entry.survivorSetHash,
    survivorRootHash: entry.survivorRootHash,
  };
}

test("party history: undo/redo are new causal commands and a new action drops the redo branch", () => {
  const before = party(0, "Alex"),
    after = party(1, "Alyx"),
    recorded = recordPartyHistory(createPartyCommandHistory(CAMPAIGN_A), {
      entryId: "history-profile-a",
      actionKind: "profile-updated",
      characterIds: ["character-a"],
      commandId: "command-profile-a",
      commandDigest: "digest-profile-a",
      receiptId: "receipt-profile-a",
      before,
      after,
    }),
    undone = applyPartyHistoryCommand(
      recorded,
      after,
      historyCommand("undo-party-history", 1, 1, "undo-a"),
    );
  assert.equal(undone.status, "applied");
  if (undone.status !== "applied") throw new Error("undo failed");
  assert.equal(undone.party.partyRevision, 2);
  assert.equal(undone.party.characters[0]?.profile.name, "Alex");
  assert.equal(undone.history.cursor, 0);

  const redone = applyPartyHistoryCommand(
    undone.history,
    undone.party,
    historyCommand("redo-party-history", 2, 2, "redo-a"),
  );
  assert.equal(redone.status, "applied");
  if (redone.status !== "applied") throw new Error("redo failed");
  assert.equal(redone.party.partyRevision, 3);
  assert.equal(redone.party.characters[0]?.profile.name, "Alyx");
  assert.notEqual(redone.operation.commandId, recorded.entries[0]?.causeCommandId);

  const secondUndo = applyPartyHistoryCommand(
    redone.history,
    redone.party,
    historyCommand("undo-party-history", 3, 3, "undo-b"),
  );
  assert.equal(secondUndo.status, "applied");
  if (secondUndo.status !== "applied") throw new Error("second undo failed");
  const branchedAfter = structuredClone(secondUndo.party) as Raw;
  branchedAfter.partyRevision = 5;
  branchedAfter.characters[1].profile.name = "Brynn";
  const branched = recordPartyHistory(secondUndo.history, {
    entryId: "history-profile-b",
    actionKind: "profile-updated",
    characterIds: ["character-b"],
    commandId: "command-profile-b",
    commandDigest: "digest-profile-b",
    receiptId: "receipt-profile-b",
    before: { ...secondUndo.party, partyRevision: 4 },
    after: branchedAfter,
  });
  assert.equal(branched.entries.length, 1);
  assert.equal(branched.entries[0]?.entryId, "history-profile-b");
  assert.equal(branched.cursor, 1);
});

test("party history: retains exactly the newest 100 actions", () => {
  let history = createPartyCommandHistory(CAMPAIGN_A),
    current = party();
  for (let index = 0; index < 105; index++) {
    const next = structuredClone(current) as Raw;
    next.partyRevision = index + 1;
    next.characters[0].progress.currentXp = index + 11;
    history = recordPartyHistory(history, {
      entryId: `history-${index}`,
      actionKind: "progress-updated",
      characterIds: ["character-a"],
      commandId: `command-${index}`,
      commandDigest: `digest-${index}`,
      receiptId: `receipt-${index}`,
      before: current,
      after: next,
    });
    current = next;
  }
  assert.equal(history.entries.length, 100);
  assert.equal(history.entries[0]?.entryId, "history-5");
  assert.equal(history.entries[99]?.entryId, "history-104");
  assert.equal(history.cursor, 100);
});

test("party history: rejects stale, duplicate and causally incompatible commands", () => {
  const before = party(0),
    after = party(1, "Alyx"),
    recorded = recordPartyHistory(createPartyCommandHistory(CAMPAIGN_A), {
      entryId: "history-causal-a",
      actionKind: "profile-updated",
      characterIds: ["character-a"],
      commandId: "command-causal-a",
      commandDigest: "digest-causal-a",
      receiptId: "receipt-causal-a",
      before,
      after,
    });
  const stale = applyPartyHistoryCommand(
    recorded,
    after,
    historyCommand("undo-party-history", 0, 1, "stale"),
  );
  assert.equal(stale.status, "rejected");
  if (stale.status === "rejected") assert.equal(stale.reason, "stale-party");
  assert.throws(() =>
    recordPartyHistory(recorded, {
      entryId: "history-causal-b",
      actionKind: "profile-updated",
      characterIds: ["character-b"],
      commandId: "command-causal-a",
      commandDigest: "digest-causal-b",
      receiptId: "receipt-causal-b",
      before: party(1, "Different"),
      after: party(2, "Different"),
    }),
  );
  const altered = structuredClone(after) as Raw;
  altered.characters[1].profile.name = "External change";
  const conflict = applyPartyHistoryCommand(
    recorded,
    altered,
    historyCommand("undo-party-history", 1, 1, "conflict"),
  );
  assert.equal(conflict.status, "rejected");
  if (conflict.status === "rejected")
    assert.equal(conflict.reason, "causal-conflict");
});

test("party history: coordinated Move undo requires exact owner revisions and an unused created Scene", () => {
  const before = party(0, "Alex", true),
    after = structuredClone(before) as Raw;
  after.partyRevision = 1;
  after.characters[0].sceneAssignment = {
    status: "assigned",
    liveSceneId: "scene-created",
    sceneRevision: 1,
  };
  const history = recordPartyHistory(createPartyCommandHistory(CAMPAIGN_A), {
      entryId: "history-move-created-scene",
      actionKind: "characters-moved",
      characterIds: ["character-a"],
      commandId: "command-move-created-scene",
      commandDigest: "digest-move-created-scene",
      receiptId: "receipt-move-created-scene",
      before,
      after,
      dependencies: [
        {
          kind: "party-history-dependency",
          version: 1,
          ownerId: "owner-scenes",
          targetId: "scene-created",
          revisionBefore: 0,
          revisionAfter: 1,
          undoDisposition: "remove-if-unchanged",
          redoDisposition: "restore",
        },
      ],
    }),
    withoutOwner = applyPartyHistoryCommand(
      history,
      after,
      historyCommand("undo-party-history", 1, 1, "undo-move-missing-owner"),
    );
  assert.equal(withoutOwner.status, "rejected");
  const usedSceneCommand = {
      ...historyCommand("undo-party-history", 1, 1, "undo-move-used-scene"),
      participantInputs: [
        {
          kind: "party-history-participant-input",
          version: 1,
          ownerId: "owner-scenes",
          targetId: "scene-created",
          currentRevision: 1,
          targetUnused: false,
        },
      ],
    },
    usedScene = applyPartyHistoryCommand(history, after, usedSceneCommand);
  assert.equal(usedScene.status, "rejected");
  const safe = applyPartyHistoryCommand(history, after, {
    ...usedSceneCommand,
    commandId: "command-undo-move-safe",
    commandDigest: "digest-undo-move-safe",
    receiptId: "receipt-undo-move-safe",
    participantInputs: [
      {
        ...usedSceneCommand.participantInputs[0],
        targetUnused: true,
      },
    ],
  });
  assert.equal(safe.status, "applied");
  if (safe.status !== "applied") throw new Error("safe coordinated undo failed");
  assert.equal(safe.operation.participantPlans.length, 1);
  assert.equal(
    safe.operation.participantPlans[0]?.disposition,
    "remove-if-unchanged",
  );
  assert.equal(safe.operation.participantPlans[0]?.revisionBefore, 1);
  assert.equal(safe.operation.participantPlans[0]?.revisionAfter, 2);
  const foreignOwnerChange = applyPartyHistoryCommand(
    safe.history,
    safe.party,
    {
      ...historyCommand(
        "redo-party-history",
        safe.party.partyRevision,
        safe.history.historyRevision,
        "redo-move-foreign-owner",
      ),
      participantInputs: [
        {
          kind: "party-history-participant-input",
          version: 1,
          ownerId: "owner-scenes",
          targetId: "scene-created",
          currentRevision: 9,
          targetUnused: true,
        },
      ],
    },
  );
  assert.equal(foreignOwnerChange.status, "rejected");
  const redone = applyPartyHistoryCommand(safe.history, safe.party, {
    ...historyCommand(
      "redo-party-history",
      safe.party.partyRevision,
      safe.history.historyRevision,
      "redo-move-safe",
    ),
    participantInputs: [
      {
        kind: "party-history-participant-input",
        version: 1,
        ownerId: "owner-scenes",
        targetId: "scene-created",
        currentRevision: 2,
        targetUnused: true,
      },
    ],
  });
  assert.equal(redone.status, "applied");
  if (redone.status !== "applied") throw new Error("redo move failed");
  assert.equal(redone.operation.participantPlans[0]?.revisionBefore, 2);
  assert.equal(redone.operation.participantPlans[0]?.revisionAfter, 3);
  const undoneAgain = applyPartyHistoryCommand(redone.history, redone.party, {
    ...historyCommand(
      "undo-party-history",
      redone.party.partyRevision,
      redone.history.historyRevision,
      "undo-move-again",
    ),
    participantInputs: [
      {
        kind: "party-history-participant-input",
        version: 1,
        ownerId: "owner-scenes",
        targetId: "scene-created",
        currentRevision: 3,
        targetUnused: true,
      },
    ],
  });
  assert.equal(undoneAgain.status, "applied");
  if (undoneAgain.status !== "applied")
    throw new Error("second monotonic undo failed");
  assert.equal(undoneAgain.operation.participantPlans[0]?.revisionBefore, 3);
  assert.equal(undoneAgain.operation.participantPlans[0]?.revisionAfter, 4);
});

test("runtime lifecycle: active deletion cleans Scene, seals History and finalizes only after every owner receipt", () => {
  const beforeProfile = party(0, "Alex", true),
    afterProfile = party(1, "Alyx", true),
    history = recordPartyHistory(createPartyCommandHistory(CAMPAIGN_A), {
      entryId: "history-alex-profile",
      actionKind: "profile-updated",
      characterIds: ["character-a"],
      commandId: "command-profile-alex",
      commandDigest: "digest-profile-alex",
      receiptId: "receipt-profile-alex",
      before: beforeProfile,
      after: afterProfile,
    }),
    initialized = initializeLiveSession(
      createUninitializedLiveSessionState(afterProfile),
      {
        kind: "initialize-live-session",
        version: 1,
        campaignId: CAMPAIGN_A,
        commandId: "command-initialize",
        commandDigest: "digest-initialize",
        expectedPartyRevision: 1,
        expectedFocusRevision: 0,
        cancelled: false,
        primarySceneId: "scene-primary",
        sceneClockRef: {
          ownerId: "clock",
          generationId: "clock-generation",
          referenceId: "clock-primary",
          ownerRevision: 0,
        },
        title: "Primary",
        notes: "",
      },
    );
  assert.equal(initialized.status, "applied");
  if (initialized.status !== "applied") throw new Error("init failed");
  const source = initialized.state.scenes[0]!.source,
    deletion = decidePermanentCharacterDeletion(
      initialized.state,
      history,
      {
        kind: "permanent-character-deletion",
        version: 1,
        campaignId: CAMPAIGN_A,
        commandId: "command-delete-character-a",
        commandDigest: "digest-delete-character-a",
        expectedPartyRevision: initialized.state.party.partyRevision,
        expectedFocusRevision: initialized.state.focus.focusRevision,
        cancelled: false,
        characterId: "character-a",
        expectedSourceRevision: source.sceneRevision,
        maskOwnerContributions: [],
        historyEntryId: "history-delete-character-a",
        historyReceiptId: "receipt-delete-character-a",
        manifestId: "manifest-character-a",
        tombstoneId: "tombstone-character-a",
      },
      rawRegistry(),
      rawManifest(),
      rawTombstone(),
      digest,
    );
  assert.equal(deletion.status, "applied");
  if (deletion.status !== "applied") throw new Error("delete failed");
  const decision = deletion.decision,
    historyText = JSON.stringify(decision.history);
  assert.equal(decision.status, "logical-delete/closure-pending");
  assert.deepEqual(
    decision.state.party.characters.map((character) => character.characterId),
    ["character-b"],
  );
  assert.deepEqual(decision.state.scenes[0]?.source.characterIds, ["character-b"]);
  assert.equal(historyText.includes("Alyx"), false);
  assert.equal(historyText.includes('"before"'), false);
  assert.equal(historyText.includes('"after"'), false);
  assert.equal(
    decision.history.entries.every(
      (entry) =>
        entry.status !== "sealed-deletion" ||
        !entry.survivingCharacterIds.includes("character-a" as never),
    ),
    true,
  );
  assert.equal(decision.history.entries.at(-1)?.status, "sealed-deletion");

  const undo = applyPartyHistoryCommand(
    decision.history,
    decision.state.party,
    historyCommand(
      "undo-party-history",
      decision.state.party.partyRevision,
      decision.history.historyRevision,
      "undo-deletion",
    ),
  );
  assert.equal(undo.status, "rejected");
  if (undo.status !== "rejected") throw new Error("deletion undo unexpectedly applied");
  assert.equal(undo.reason, "irreversible-boundary");

  const manifestInput = rawManifest(),
    pending = assessCharacterClosure(
      rawRegistry(),
      manifestInput,
      rawTombstone(),
      [rawClosureReceipt(manifestInput.entries[0], "removed")],
      digest,
    ),
    closed = assessCharacterClosure(
      rawRegistry(),
      manifestInput,
      rawTombstone(),
      [
        rawClosureReceipt(manifestInput.entries[0], "removed"),
        rawClosureReceipt(manifestInput.entries[1], "quarantine-erased"),
      ],
      digest,
    );
  assert.equal(pending.status, "closure-pending");
  assert.equal(pending.purgeEligible, false);
  assert.equal(closed.status, "permanent-purge-finalized");
  assert.equal(closed.purgeEligible, true);
});

test("runtime lifecycle golden: Preparation, Move, Rejoin, causal History and permanent Closure share one command truth", () => {
  const initialParty = party(0, "Alex", true),
    initialized = initializeLiveSession(
      createUninitializedLiveSessionState(initialParty),
      {
        kind: "initialize-live-session",
        version: 1,
        campaignId: CAMPAIGN_A,
        commandId: "command-golden-initialize",
        commandDigest: "digest-golden-initialize",
        expectedPartyRevision: 0,
        expectedFocusRevision: 0,
        cancelled: false,
        primarySceneId: "scene-primary",
        sceneClockRef: {
          ownerId: "clock",
          generationId: "clock-generation",
          referenceId: "clock-primary",
          ownerRevision: 0,
        },
        title: "Primary",
        notes: "",
      },
    );
  assert.equal(initialized.status, "applied");
  if (initialized.status !== "applied") throw new Error("golden init failed");
  const prepared = createPreparedRuntime(initialized.state, {
    kind: "prepare-runtime",
    version: 1,
    campaignId: CAMPAIGN_A,
    commandId: "command-golden-prepare",
    commandDigest: "digest-golden-prepare",
    expectedPartyRevision: initialized.state.party.partyRevision,
    expectedFocusRevision: initialized.state.focus.focusRevision,
    cancelled: false,
    liveSceneId: "scene-prepared",
    sceneClockRef: {
      ownerId: "clock",
      generationId: "clock-generation",
      referenceId: "clock-prepared",
      ownerRevision: 0,
    },
    snapshot: {
      kind: "preparation-snapshot",
      version: 1,
      campaignId: CAMPAIGN_A,
      preparationId: "preparation-golden",
      preparationRevision: 3,
      source: {
        ownerId: "planner",
        sourceId: "plan-golden",
        sourceRevision: 4,
      },
      title: "Prepared harbor",
      notes: "Exact GM preparation.",
      locationRef: {
        ownerId: "locations",
        referenceId: "harbor",
        ownerRevision: 2,
      },
      contentPins: [
        {
          ownerId: "notes",
          referenceId: "harbor-note",
          ownerRevision: 5,
        },
      ],
    },
  });
  assert.equal(prepared.status, "applied");
  if (prepared.status !== "applied") throw new Error("golden prepare failed");
  assert.equal(prepared.state.scenes[1]?.notes, "Exact GM preparation.");
  const moveBefore = prepared.state.party,
    moved = moveCharacters(prepared.state, {
      kind: "move-characters",
      version: 1,
      campaignId: CAMPAIGN_A,
      commandId: "command-golden-move",
      commandDigest: "digest-golden-move",
      expectedPartyRevision: prepared.state.party.partyRevision,
      expectedFocusRevision: prepared.state.focus.focusRevision,
      cancelled: false,
      sourceSceneId: "scene-primary",
      targetSceneId: "scene-prepared",
      expectedSourceRevision: 0,
      expectedTargetRevision: 0,
      characterIds: ["character-b"],
      maskOwnerContributions: [],
    });
  assert.equal(moved.status, "applied");
  if (moved.status !== "applied") throw new Error("golden move failed");
  let history = recordPartyHistory(createPartyCommandHistory(CAMPAIGN_A), {
    entryId: "history-golden-move",
    actionKind: "characters-moved",
    characterIds: ["character-b"],
    commandId: "command-golden-move",
    commandDigest: "digest-golden-move",
    receiptId: "receipt-golden-move",
    before: moveBefore,
    after: moved.state.party,
    dependencies: [
      {
        kind: "party-history-dependency",
        version: 1,
        ownerId: "owner-scenes",
        targetId: "scene-primary",
        revisionBefore: 0,
        revisionAfter: 1,
        undoDisposition: "restore",
        redoDisposition: "restore",
      },
      {
        kind: "party-history-dependency",
        version: 1,
        ownerId: "owner-scenes",
        targetId: "scene-prepared",
        revisionBefore: 0,
        revisionAfter: 1,
        undoDisposition: "remove-if-unchanged",
        redoDisposition: "restore",
      },
    ],
  });
  const source = moved.state.scenes.find(
      (scene) => scene.source.liveSceneId === "scene-prepared",
    )!.source,
    target = moved.state.scenes.find(
      (scene) => scene.source.liveSceneId === "scene-primary",
    )!.source,
    rejoinCommandId = "command-golden-rejoin",
    rejoinDigest = "digest-golden-rejoin",
    rejoined = rejoinScenes(moved.state, {
      kind: "rejoin-scenes",
      version: 1,
      campaignId: CAMPAIGN_A,
      commandId: rejoinCommandId,
      commandDigest: rejoinDigest,
      expectedPartyRevision: moved.state.party.partyRevision,
      expectedFocusRevision: moved.state.focus.focusRevision,
      cancelled: false,
      sourceSceneId: source.liveSceneId,
      expectedSourceRevision: source.sceneRevision,
      targetSceneId: target.liveSceneId,
      expectedTargetRevision: target.sceneRevision,
      maskOwnerContributions: [],
      clockContribution: {
        kind: "clock-merge-contribution",
        version: 1,
        status: "prepared-unpublished",
        receiptId: "receipt-golden-clock-merge",
        campaignId: CAMPAIGN_A,
        commandId: rejoinCommandId,
        commandDigest: rejoinDigest,
        ownerIdentity: {
          ownerId: "clock",
          generationId: "clock-generation",
        },
        calendarDefinitionRef: {
          ownerId: "clock",
          referenceId: "calendar-golden",
          ownerRevision: 1,
        },
        sourceSceneId: source.liveSceneId,
        sourceSceneRevisionBefore: source.sceneRevision,
        sourceSceneRevisionAfter: source.sceneRevision + 1,
        sourceClockRef: source.sceneClockRef,
        sourceClockValue: {
          codecId: "smr07.elapsed-seconds",
          codecVersion: 1,
          canonicalValue: "7200",
        },
        sourceClockRevisionAfter: source.sceneClockRef!.ownerRevision,
        targetSceneId: target.liveSceneId,
        targetSceneRevisionBefore: target.sceneRevision,
        targetSceneRevisionAfter: target.sceneRevision + 1,
        targetClockRefBefore: target.sceneClockRef,
        targetClockRevisionBefore: target.sceneClockRef!.ownerRevision,
        targetClockValueBefore: {
          codecId: "smr07.elapsed-seconds",
          codecVersion: 1,
          canonicalValue: "3600",
        },
        targetClockRefAfter: {
          ...target.sceneClockRef!,
          ownerRevision: target.sceneClockRef!.ownerRevision + 1,
        },
        targetClockRevisionAfter: target.sceneClockRef!.ownerRevision + 1,
        targetClockValueAfter: {
          codecId: "smr07.elapsed-seconds",
          codecVersion: 1,
          canonicalValue: "7200",
        },
        sourceDisposition: "archive",
        targetKind: "existing",
        choice: "source-confirmed",
      },
    });
  assert.equal(rejoined.status, "applied");
  if (rejoined.status !== "applied") throw new Error("golden rejoin failed");
  const historyBeforeRejoin = history;
  history = recordPartyHistory(history, {
    entryId: "history-golden-rejoin",
    actionKind: "scenes-rejoined",
    characterIds: ["character-b"],
    commandId: rejoinCommandId,
    commandDigest: rejoinDigest,
    receiptId: "receipt-golden-rejoin",
    before: moved.state.party,
    after: rejoined.state.party,
    dependencies: [
      {
        kind: "party-history-dependency",
        version: 1,
        ownerId: "owner-scenes",
        targetId: source.liveSceneId,
        revisionBefore: source.sceneRevision,
        revisionAfter: source.sceneRevision + 1,
        undoDisposition: "restore",
        redoDisposition: "restore",
      },
      {
        kind: "party-history-dependency",
        version: 1,
        ownerId: "owner-scenes",
        targetId: target.liveSceneId,
        revisionBefore: target.sceneRevision,
        revisionAfter: target.sceneRevision + 1,
        undoDisposition: "restore",
        redoDisposition: "restore",
      },
      {
        kind: "party-history-dependency",
        version: 1,
        ownerId: "clock",
        targetId: target.sceneClockRef!.referenceId,
        revisionBefore: target.sceneClockRef!.ownerRevision,
        revisionAfter: target.sceneClockRef!.ownerRevision + 1,
        undoDisposition: "restore",
        redoDisposition: "restore",
      },
    ],
  });
  assert.equal(history.entries.length, 2);
  assert.equal(rejoined.state.scenes[1]?.source.lifecycle, "retired");
  assert.deepEqual(rejoined.state.scenes[0]?.source.characterIds, [
    "character-a",
    "character-b",
  ]);

  const survivorRootHash = fact({
      characterIds: rejoined.state.party.characters.map(
        (character) => character.characterId,
      ),
      liveSceneIds: rejoined.state.scenes
        .filter((scene) => scene.source.lifecycle === "active")
        .map((scene) => scene.source.liveSceneId),
    }),
    rejoinEffectHash = fact({ state: rejoined.state, history }),
    coordinationInput = {
      commandId: rejoinCommandId,
      commandDigest: rejoinDigest,
      receiptId: "receipt-golden-rejoin",
      beforeTruthHash: fact({
        state: moved.state,
        history: historyBeforeRejoin,
      }),
      expectedSurvivorRootHash: survivorRootHash,
      participants: [
        {
          participantId: "participant-party",
          ownerId: "owner-party",
          expectedOwnerRevision: moved.state.party.partyRevision,
          targetId: "party-runtime",
        },
        {
          participantId: "participant-scenes",
          ownerId: "owner-scenes",
          expectedOwnerRevision: target.sceneRevision,
          targetId: target.liveSceneId,
        },
        {
          participantId: "participant-clock",
          ownerId: "clock",
          expectedOwnerRevision: target.sceneClockRef!.ownerRevision,
          targetId: target.sceneClockRef!.referenceId,
        },
      ],
    },
    cancelledCoordination = coordinator(
      "rejoin-scenes",
      coordinationInput,
    ),
    cancelled = coordinatorTransition(cancelledCoordination, {
      kind: "cancel",
    });
  assert.equal(cancelled.status, "applied");
  assert.equal(
    cancelled.model.beforeTruthHash,
    coordinationInput.beforeTruthHash,
  );
  assert.equal(cancelled.model.effectHash, undefined);

  let coordination = coordinator("rejoin-scenes", coordinationInput);
  for (const [participantId, ownerRevision, contribution] of [
    [
      "participant-party",
      moved.state.party.partyRevision,
      fact({ before: moved.state.party, after: rejoined.state.party }),
    ],
    [
      "participant-scenes",
      target.sceneRevision,
      fact({ before: moved.state.scenes, after: rejoined.state.scenes }),
    ],
    [
      "participant-clock",
      target.sceneClockRef!.ownerRevision,
      fact({
        receiptId: "receipt-golden-clock-merge",
        before: target.sceneClockRef,
        after: rejoined.state.scenes.find(
          (scene) => scene.source.liveSceneId === target.liveSceneId,
        )?.source.sceneClockRef,
      }),
    ],
  ] as const) {
    const next = coordinatorTransition(coordination, {
      kind: "prepare-participant",
      version: 1,
      expectedGeneration: coordination.generation,
      participantId,
      ownerRevision,
      contributionHash: contribution,
    });
    assert.equal(next.status, "applied");
    coordination = next.model;
  }
  for (const event of [
    {
      kind: "validate",
      version: 1,
      outcome: "valid",
    },
    {
      kind: "publish",
      version: 1,
      effectHash: rejoinEffectHash,
      survivorRootHash: coordination.expectedSurvivorRootHash,
    },
    {
      kind: "verify",
      version: 1,
      effectHash: rejoinEffectHash,
      survivorRootHash: coordination.expectedSurvivorRootHash,
    },
    { kind: "finalize", version: 1 },
  ] as const) {
    const next = coordinatorTransition(coordination, {
      ...event,
      expectedGeneration: coordination.generation,
    });
    assert.equal(next.status, "applied", event.kind);
    coordination = next.model;
  }
  assert.equal(coordination.status, "finalized");

  const primary = rejoined.state.scenes.find(
      (scene) => scene.source.liveSceneId === "scene-primary",
    )!.source,
    deletion = decidePermanentCharacterDeletion(
      rejoined.state,
      history,
      {
        kind: "permanent-character-deletion",
        version: 1,
        campaignId: CAMPAIGN_A,
        commandId: "command-delete-character-a",
        commandDigest: "digest-delete-character-a",
        expectedPartyRevision: rejoined.state.party.partyRevision,
        expectedFocusRevision: rejoined.state.focus.focusRevision,
        cancelled: false,
        characterId: "character-a",
        expectedSourceRevision: primary.sceneRevision,
        maskOwnerContributions: [],
        historyEntryId: "history-golden-delete-a",
        historyReceiptId: "receipt-golden-delete-a",
        manifestId: "manifest-character-a",
        tombstoneId: "tombstone-character-a",
      },
      rawRegistry(),
      rawManifest(),
      rawTombstone(),
      digest,
    );
  assert.equal(deletion.status, "applied");
  if (deletion.status !== "applied") throw new Error("golden delete failed");
  assert.deepEqual(
    deletion.decision.state.party.characters.map(
      (character) => character.characterId,
    ),
    ["character-b"],
  );
  assert.equal(
    JSON.stringify(deletion.decision.history).includes("Exact GM preparation."),
    false,
  );
  assert.equal(
    deletion.decision.history.entries.every(
      (entry) => entry.status === "sealed-deletion",
    ),
    true,
  );
  const manifestInput = rawManifest(),
    closure = assessCharacterClosure(
      rawRegistry(),
      manifestInput,
      rawTombstone(),
      [
        rawClosureReceipt(manifestInput.entries[0], "removed"),
        rawClosureReceipt(
          manifestInput.entries[1],
          "quarantine-erased",
        ),
      ],
      digest,
    );
  assert.equal(closure.status, "permanent-purge-finalized");
  assert.equal(closure.purgeEligible, true);
});

test("portability: imported quarantine stays offline, source token never executes and local rebind is target-only", () => {
  const sourceRegistry = rawRegistry(),
    sourceManifest = rawManifest(),
    sourceTombstone = rawTombstone(),
    sourceEntry = sourceManifest.entries[1],
    sourceSurvivor = sourceEntry.expectedSurvivors[0],
    targetSurvivors = [
      {
        kind: "expected-survivor-binding",
        version: 1,
        ownerId: "owner-scenes",
        payloadClass: "live-scenes",
        survivorId: "target-survivor-scenes",
        targetScopeId: "target-scope-scenes",
        beforeHash: evidence("target-survivor-before-scenes"),
      },
    ],
    targetProof = referenceOwnerSurvivorProof(
      targetSurvivors as never,
      digest,
    ),
    slotInput = {
      kind: "retained-quarantine-slot",
      version: 1,
      status: "offline-quarantined",
      coreEnvelopeId: "envelope-target-scenes",
      sourceManifestId: "manifest-character-a",
      sourceTombstoneId: "tombstone-character-a",
      sourceToken: sourceEntry.erasureToken,
      targetCampaignId: CAMPAIGN_B,
      targetCharacterId: "target-character-a",
      targetDeletionCommandId: "target-command-delete-character-a",
      targetRegistryRevision: 1,
      targetOwnerId: "owner-scenes",
      targetOwnerRevision: 11,
      payloadClass: "live-scenes",
      targetSlotId: "target-slot-scenes",
      targetSlotRevision: 2,
      targetErasureUnitId: "target-deleted-scenes",
      targetScopeId: "target-scope-scenes",
      expectedBeforeHash: evidence("target-before-scenes"),
      expectedSurvivorSetHash: targetProof.survivorSetHash,
      expectedSurvivorRootHash: targetProof.survivorRootHash,
      opaqueEnvelopeHash: evidence("opaque-envelope-scenes"),
      survivorRemap: [
        {
          kind: "quarantine-survivor-remap",
          version: 1,
          sourceOwnerId: sourceSurvivor.ownerId,
          sourcePayloadClass: sourceSurvivor.payloadClass,
          sourceSurvivorId: sourceSurvivor.survivorId,
          sourceTargetScopeId: sourceSurvivor.targetScopeId,
          sourceBeforeHash: sourceSurvivor.beforeHash,
          targetOwnerId: "owner-scenes",
          targetPayloadClass: "live-scenes",
          targetSurvivorId: "target-survivor-scenes",
          targetTargetScopeId: "target-scope-scenes",
          targetBeforeHash: evidence("target-survivor-before-scenes"),
        },
      ],
    },
    slot = bindRetainedQuarantineSlot(
      slotInput,
      sourceRegistry,
      sourceManifest,
      sourceTombstone,
      digest,
    ),
    targetRegistry = {
      kind: "reference-owner-registry-projection",
      version: 1,
      status: "complete",
      campaignId: CAMPAIGN_B,
      registryRevision: 1,
      owners: [
        {
          kind: "reference-owner-registry-entry",
          version: 1,
          ownerId: "owner-scenes",
          ownerRevision: 11,
          availability: "available",
          slots: [
            {
              kind: "erasure-slot-definition",
              version: 1,
              campaignId: CAMPAIGN_B,
              ownerId: "owner-scenes",
              payloadClass: "live-scenes",
              slotId: "target-slot-scenes",
              slotRevision: 2,
              targetScopeId: "target-scope-scenes",
            },
          ],
        },
      ],
    },
    targetToken = {
      kind: "erasure-token",
      version: 1,
      status: "opaque-non-executable",
      tokenId: "target-token-scenes",
      deletionCommandId: "target-command-delete-character-a",
      campaignId: CAMPAIGN_B,
      characterId: "target-character-a",
      ownerId: "owner-scenes",
      ownerRevision: 11,
      payloadClass: "live-scenes",
      slotId: "target-slot-scenes",
      slotRevision: 2,
      erasureUnitId: "target-deleted-scenes",
      targetScopeId: "target-scope-scenes",
      expectedBeforeHash: slot.expectedBeforeHash,
      expectedSurvivorSetHash: slot.expectedSurvivorSetHash,
      expectedSurvivorRootHash: slot.expectedSurvivorRootHash,
    };
  assert.equal(
    mintReboundErasureToken(slot, targetRegistry, "present", targetToken)
      .tokenId,
    "target-token-scenes",
  );
  assert.throws(() =>
    mintReboundErasureToken(slot, targetRegistry, "disabled", targetToken),
  );
  assert.throws(() =>
    mintReboundErasureToken(slot, targetRegistry, "present", {
      ...targetToken,
      tokenId: sourceEntry.erasureToken.tokenId,
    }),
  );
  assert.throws(() =>
    bindRetainedQuarantineSlot(
      { ...slotInput, sourceManifestId: "manifest-replayed" },
      sourceRegistry,
      sourceManifest,
      sourceTombstone,
      digest,
    ),
  );
  assert.throws(() =>
    bindRetainedQuarantineSlot(
      {
        ...slotInput,
        expectedSurvivorSetHash: sourceEntry.survivorSetHash,
        expectedSurvivorRootHash: sourceEntry.survivorRootHash,
      },
      sourceRegistry,
      sourceManifest,
      sourceTombstone,
      digest,
    ),
  );
  assert.throws(() =>
    bindRetainedQuarantineSlot(
      {
        ...slotInput,
        expectedSurvivorRootHash: evidence("forged-target-survivor-root"),
      },
      sourceRegistry,
      sourceManifest,
      sourceTombstone,
      digest,
    ),
  );
  assert.throws(() =>
    bindRetainedQuarantineSlot(
      {
        ...slotInput,
        sourceToken: sourceManifest.entries[0].erasureToken,
        expectedBeforeHash: sourceManifest.entries[0].beforeHash,
        expectedSurvivorSetHash: sourceManifest.entries[0].survivorSetHash,
        expectedSurvivorRootHash: sourceManifest.entries[0].survivorRootHash,
      },
      sourceRegistry,
      sourceManifest,
      sourceTombstone,
      digest,
    ),
  );

  const absentRegistry = structuredClone(targetRegistry) as Raw;
  absentRegistry.owners[0].availability = "unavailable";
  const absentEvidence = {
      kind: "provider-disposition-evidence",
      version: 1,
      disposition: "absent",
      targetCampaignId: CAMPAIGN_B,
      targetOwnerId: "owner-scenes",
      targetRegistryRevision: 1,
      targetOwnerRevision: 11,
      rebindAllowed: false,
    },
    discard = {
    kind: "quarantine-discard-receipt",
    version: 1,
    outcome: "local-opaque-envelope-discard",
    providerSemanticClosureClaimed: false,
    commandId: "command-discard-envelope",
    targetCampaignId: CAMPAIGN_B,
    targetCharacterId: "target-character-a",
    targetDeletionCommandId: "target-command-delete-character-a",
    targetRegistryRevision: 1,
    targetOwnerId: "owner-scenes",
    targetOwnerRevision: 11,
    providerDisposition: "absent",
    rebindAllowed: false,
    coreEnvelopeId: "envelope-target-scenes",
    sourceManifestId: "manifest-character-a",
    sourceTombstoneId: "tombstone-character-a",
    beforeHash: slot.opaqueEnvelopeHash,
    afterHash: evidence("discarded-envelope-scenes"),
    survivorSetHash: slot.expectedSurvivorSetHash,
    survivorRootHash: slot.expectedSurvivorRootHash,
  };
  const first = decideQuarantineDiscard(
      slot,
      absentRegistry,
      absentEvidence,
      discard,
    ),
    retry = decideQuarantineDiscard(
      slot,
      absentRegistry,
      absentEvidence,
      discard,
      first,
    );
  assert.deepEqual(retry, first);
  assert.equal(first.providerSemanticClosureClaimed, false);
  assert.throws(() =>
    decideQuarantineDiscard(slot, targetRegistry, absentEvidence, discard),
  );
  assert.throws(() =>
    decideQuarantineDiscard(
      slot,
      absentRegistry,
      { ...absentEvidence, targetRegistryRevision: 0 },
      discard,
    ),
  );
  assert.throws(() =>
    decideQuarantineDiscard(
      slot,
      absentRegistry,
      { ...absentEvidence, disposition: "replaced" },
      discard,
    ),
  );
  assert.throws(() =>
    decideQuarantineDiscard(
      slot,
      absentRegistry,
      { ...absentEvidence, rebindAllowed: true },
      discard,
    ),
  );
});

test("portability: Complete never silently downgrades and Salvage discloses every omission", () => {
  const verified = (identity: string, payloadKind: string): Raw => ({
      kind: "portability-inventory-entry",
      version: 1,
      identity,
      payloadKind,
      status: "verified",
      required: true,
      retainedMetadata: true,
    }),
    complete = decidePortability("complete", "closure-pending", [
      verified("campaign", "campaign-content"),
      verified("quarantine", "retained-quarantine"),
      verified("tombstone", "nonreconstructive-evidence"),
    ]);
  assert.equal(complete.allowed, true);
  const blocked = decidePortability("complete", "closure-pending", [
    verified("campaign", "campaign-content"),
    {
      ...verified("quarantine", "retained-quarantine"),
      status: "corrupt",
      impact: "Scene quarantine omitted",
    },
  ]);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.reason, "pending-quarantine-unverified");
  const optionalCorrupt = decidePortability("complete", "closure-clean", [
    verified("campaign", "campaign-content"),
    {
      ...verified("optional-media", "media"),
      status: "corrupt",
      required: false,
      impact: "Optional media bytes are corrupt",
    },
  ]);
  assert.equal(optionalCorrupt.allowed, false);
  assert.equal(optionalCorrupt.reason, "inventory-unverified");
  assert.deepEqual(optionalCorrupt.omittedIdentities, ["optional-media"]);
  const salvage = decidePortability("salvage", "closure-pending", [
    verified("campaign", "campaign-content"),
    {
      ...verified("quarantine", "retained-quarantine"),
      status: "missing",
      impact: "Unavailable Scene references omitted",
    },
  ]);
  assert.equal(salvage.allowed, true);
  assert.deepEqual(salvage.omittedIdentities, ["quarantine"]);
  assert.equal(
    decidePortability("evidentiary", "permanent-purge-finalized", [
      verified("receipt", "nonreconstructive-evidence"),
    ]).allowed,
    true,
  );
  assert.equal(
    decidePortability("complete", "permanent-purge-finalized", [
      verified("quarantine", "retained-quarantine"),
    ]).reason,
    "purged-payload-present",
  );
  assert.throws(() =>
    decidePortability("invalid" as never, "closure-clean", []),
  );
});

function coordinatorEvent(
  model: ReturnType<typeof stageMultiOwnerCommand>,
  event: Raw,
) {
  const participant =
    event.kind === "prepare-participant"
      ? model.participants.find(
          (candidate) => candidate.participantId === event.participantId,
        )
      : undefined;
  return {
    version: 1,
    campaignId: model.campaignId,
    commandId: model.commandId,
    commandDigest: model.commandDigest,
    receiptId: model.receiptId,
    expectedGeneration: model.generation,
    ...(participant === undefined
      ? {}
      : { ownerId: participant.ownerId, targetId: participant.targetId }),
    ...event,
  };
}

function coordinatorTransition(
  model: ReturnType<typeof stageMultiOwnerCommand>,
  event: Raw,
) {
  return transitionMultiOwnerCommand(model, coordinatorEvent(model, event));
}

function coordinator(
  kind: CoordinatedCommandKind,
  overrides: Raw = {},
) {
  return stageMultiOwnerCommand({
    campaignId: CAMPAIGN_A,
    commandId: `coordinator-${kind}`,
    commandDigest: `digest-${kind}`,
    receiptId: `receipt-${kind}`,
    commandKind: kind,
    beforeTruthHash: evidence(`before-${kind}`),
    expectedSurvivorRootHash: evidence(`survivors-${kind}`),
    participants: [
      {
        participantId: "participant-party",
        ownerId: "owner-party",
        expectedOwnerRevision: 1,
        targetId: "target-party",
      },
      {
        participantId: "participant-scenes",
        ownerId: "owner-scenes",
        expectedOwnerRevision: 2,
        targetId: "target-scenes",
      },
    ],
    ...overrides,
  });
}

function prepared(kind: CoordinatedCommandKind) {
  let model = coordinator(kind);
  for (const [participantId, ownerRevision, suffix] of [
    ["participant-party", 1, "party"],
    ["participant-scenes", 2, "scenes"],
  ] as const) {
    const transition = coordinatorTransition(model, {
      kind: "prepare-participant",
      version: 1,
      expectedGeneration: model.generation,
      participantId,
      ownerRevision,
      contributionHash: evidence(`${kind}-${suffix}`),
    });
    assert.equal(transition.status, "applied");
    model = transition.model;
  }
  const validated = coordinatorTransition(model, {
    kind: "validate",
    version: 1,
    expectedGeneration: model.generation,
    outcome: "valid",
  });
  assert.equal(validated.status, "applied");
  return validated.model;
}

test("coordinator: publish wins exactly once, unknown outcome rolls forward on the original receipt", () => {
  const validated = prepared("permanent-character-deletion"),
    effectHash = evidence("delete-effect"),
    survivorRootHash = validated.expectedSurvivorRootHash,
    published = coordinatorTransition(validated, {
      kind: "publish",
      version: 1,
      expectedGeneration: validated.generation,
      effectHash,
      survivorRootHash,
    });
  assert.equal(published.status, "applied");
  assert.equal(published.model.status, "published");
  const lateCancel = coordinatorTransition(published.model, {
    kind: "cancel",
    version: 1,
    expectedGeneration: published.model.generation,
  });
  assert.equal(lateCancel.status, "rejected");
  if (lateCancel.status === "rejected")
    assert.equal(lateCancel.reason, "already-published");

  const unknown = coordinatorTransition(published.model, {
      kind: "mark-outcome-unknown",
      version: 1,
      expectedGeneration: published.model.generation,
    }),
    falseCancel = coordinatorTransition(unknown.model, {
      kind: "resolve-outcome",
      version: 1,
      expectedGeneration: unknown.model.generation,
      receiptId: unknown.model.receiptId,
      outcome: "cancelled-before-publish",
    });
  assert.equal(falseCancel.status, "rejected");
  const resolved = coordinatorTransition(unknown.model, {
      kind: "resolve-outcome",
      version: 1,
      expectedGeneration: unknown.model.generation,
      receiptId: unknown.model.receiptId,
      outcome: "published",
      effectHash,
      survivorRootHash,
    }),
    verified = coordinatorTransition(resolved.model, {
      kind: "verify",
      version: 1,
      expectedGeneration: resolved.model.generation,
      effectHash,
      survivorRootHash,
    }),
    finalized = coordinatorTransition(verified.model, {
      kind: "finalize",
      version: 1,
      expectedGeneration: verified.model.generation,
    });
  assert.equal(finalized.status, "applied");
  assert.equal(finalized.model.status, "finalized");
});

test("coordinator: unknown outcomes cannot replace publish truth or bypass validation", () => {
  const validated = prepared("move-characters"),
    effectHash = evidence("unknown-original-effect"),
    published = coordinatorTransition(validated, {
      kind: "publish",
      effectHash,
      survivorRootHash: validated.expectedSurvivorRootHash,
    });
  assert.equal(published.status, "applied");
  const postPublishUnknown = coordinatorTransition(published.model, {
      kind: "mark-outcome-unknown",
    }),
    changedEffect = coordinatorTransition(postPublishUnknown.model, {
      kind: "resolve-outcome",
      outcome: "published",
      effectHash: evidence("unknown-replaced-effect"),
      survivorRootHash: validated.expectedSurvivorRootHash,
    });
  assert.equal(changedEffect.status, "rejected");
  if (changedEffect.status === "rejected")
    assert.equal(changedEffect.reason, "effect-mismatch");

  let staged = coordinator("move-characters");
  for (const [participantId, ownerRevision, suffix] of [
    ["participant-party", 1, "unknown-staged-party"],
    ["participant-scenes", 2, "unknown-staged-scenes"],
  ] as const) {
    const next = coordinatorTransition(staged, {
      kind: "prepare-participant",
      participantId,
      ownerRevision,
      contributionHash: evidence(suffix),
    });
    assert.equal(next.status, "applied");
    staged = next.model;
  }
  const stagedUnknown = coordinatorTransition(staged, {
      kind: "mark-outcome-unknown",
    }),
    bypass = coordinatorTransition(stagedUnknown.model, {
      kind: "resolve-outcome",
      outcome: "published",
      effectHash: evidence("staged-bypass-effect"),
      survivorRootHash: staged.expectedSurvivorRootHash,
    });
  assert.equal(bypass.status, "rejected");
  if (bypass.status === "rejected") assert.equal(bypass.reason, "phase-conflict");

  const validatedUnknown = coordinatorTransition(validated, {
      kind: "mark-outcome-unknown",
    }),
    beforeTruthPublish = coordinatorTransition(validatedUnknown.model, {
      kind: "resolve-outcome",
      outcome: "published",
      effectHash: validated.beforeTruthHash,
      survivorRootHash: validated.expectedSurvivorRootHash,
    });
  assert.equal(beforeTruthPublish.status, "rejected");
  if (beforeTruthPublish.status === "rejected")
    assert.equal(beforeTruthPublish.reason, "effect-mismatch");
});

test("coordinator: complete command matrix is cancel-safe and stale workers never publish", () => {
  const kinds: CoordinatedCommandKind[] = [
    "initialize-live-session",
    "split-scene",
    "rejoin-scenes",
    "move-characters",
    "deactivate-character",
    "permanent-character-deletion",
    "quarantine-discard",
    "undo-party-history",
    "redo-party-history",
  ];
  for (const kind of kinds) {
    const early = coordinator(kind),
      earlyCancel = coordinatorTransition(early, { kind: "cancel" });
    assert.equal(earlyCancel.status, "applied", `${kind}: early cancel`);
    const model = prepared(kind),
      before = model.beforeTruthHash,
      cancelled = coordinatorTransition(model, {
        kind: "cancel",
        version: 1,
        expectedGeneration: model.generation,
      });
    assert.equal(cancelled.status, "applied", kind);
    assert.equal(cancelled.model.status, "cancelled-before-publish", kind);
    assert.equal(cancelled.model.beforeTruthHash, before, kind);
    assert.equal(
      cancelled.model.participants.every(
        (participant) => participant.contributionHash === undefined,
      ),
      true,
      kind,
    );
    const stalePublish = coordinatorTransition(cancelled.model, {
      kind: "publish",
      version: 1,
      expectedGeneration: model.generation,
      effectHash: evidence(`${kind}-late-effect`),
      survivorRootHash: model.expectedSurvivorRootHash,
    });
    assert.equal(stalePublish.status, "rejected", kind);

    const publishModel = prepared(kind),
      effectHash = evidence(`${kind}-matrix-effect`),
      survivorMismatch = coordinatorTransition(publishModel, {
        kind: "publish",
        effectHash,
        survivorRootHash: evidence(`${kind}-wrong-survivors`),
      });
    assert.equal(survivorMismatch.status, "rejected", `${kind}: survivors`);
    const published = coordinatorTransition(publishModel, {
      kind: "publish",
      effectHash,
      survivorRootHash: publishModel.expectedSurvivorRootHash,
    });
    assert.equal(published.status, "applied", `${kind}: publish`);
    const late = coordinatorTransition(published.model, { kind: "cancel" });
    assert.equal(late.status, "rejected", `${kind}: late cancel`);
    const wrongVerify = coordinatorTransition(published.model, {
      kind: "verify",
      effectHash: evidence(`${kind}-wrong-effect`),
      survivorRootHash: publishModel.expectedSurvivorRootHash,
    });
    assert.equal(wrongVerify.status, "rejected", `${kind}: verify effect`);
    const unknown = coordinatorTransition(published.model, {
        kind: "mark-outcome-unknown",
      }),
      resolved = coordinatorTransition(unknown.model, {
        kind: "resolve-outcome",
        outcome: "published",
        effectHash,
        survivorRootHash: publishModel.expectedSurvivorRootHash,
      }),
      verified = coordinatorTransition(resolved.model, {
        kind: "verify",
        effectHash,
        survivorRootHash: publishModel.expectedSurvivorRootHash,
      }),
      finalized = coordinatorTransition(verified.model, { kind: "finalize" });
    assert.equal(finalized.status, "applied", `${kind}: finalize`);
    assert.equal(finalized.model.status, "finalized", `${kind}: finalized`);

    const preUnknownModel = prepared(kind),
      preUnknown = coordinatorTransition(preUnknownModel, {
        kind: "mark-outcome-unknown",
      }),
      preResolved = coordinatorTransition(preUnknown.model, {
        kind: "resolve-outcome",
        outcome: "published",
        effectHash,
        survivorRootHash: preUnknownModel.expectedSurvivorRootHash,
      }),
      preVerified = coordinatorTransition(preResolved.model, {
        kind: "verify",
        effectHash,
        survivorRootHash: preUnknownModel.expectedSurvivorRootHash,
      }),
      preFinalized = coordinatorTransition(preVerified.model, {
        kind: "finalize",
      });
    assert.equal(preFinalized.status, "applied", `${kind}: pre-unknown`);
    assert.equal(
      preFinalized.model.status,
      "finalized",
      `${kind}: pre-unknown finalized`,
    );
  }
});

test("coordinator: callback bindings reject other commands, campaigns, targets and cancelled generations", () => {
  const commandA = coordinator("move-characters"),
    commandB = coordinator("split-scene"),
    callbackA = coordinatorEvent(commandA, {
      kind: "prepare-participant",
      participantId: "participant-party",
      ownerRevision: 1,
      contributionHash: evidence("callback-command-a"),
    }),
    crossed = transitionMultiOwnerCommand(commandB, callbackA);
  assert.equal(crossed.status, "rejected");
  if (crossed.status === "rejected")
    assert.equal(crossed.reason, "command-mismatch");
  const foreignCampaign = coordinatorTransition(commandA, {
    kind: "prepare-participant",
    participantId: "participant-party",
    ownerRevision: 1,
    contributionHash: evidence("callback-foreign-campaign"),
    campaignId: CAMPAIGN_B,
  });
  assert.equal(foreignCampaign.status, "rejected");
  const wrongTarget = coordinatorTransition(commandA, {
    kind: "prepare-participant",
    participantId: "participant-party",
    ownerRevision: 1,
    targetId: "target-other",
    contributionHash: evidence("callback-wrong-target"),
  });
  assert.equal(wrongTarget.status, "rejected");
  if (wrongTarget.status === "rejected")
    assert.equal(wrongTarget.reason, "participant-mismatch");
  const cancelled = coordinatorTransition(commandA, { kind: "cancel" }),
    late = transitionMultiOwnerCommand(cancelled.model, callbackA);
  assert.equal(late.status, "rejected");
  if (late.status === "rejected") assert.equal(late.reason, "stale-generation");
});

test("coordinator: pre-publish unknown, validation failure and stale participant replies stay rollback-only", () => {
  let staged = coordinator("move-characters");
  const firstPrepare = coordinatorTransition(staged, {
    kind: "prepare-participant",
    version: 1,
    expectedGeneration: staged.generation,
    participantId: "participant-party",
    ownerRevision: 1,
    contributionHash: evidence("move-party"),
  });
  assert.equal(firstPrepare.status, "applied");
  staged = firstPrepare.model;
  const idempotent = coordinatorTransition(staged, {
    kind: "prepare-participant",
    version: 1,
    expectedGeneration: staged.generation,
    participantId: "participant-party",
    ownerRevision: 1,
    contributionHash: evidence("move-party"),
  });
  assert.equal(idempotent.status, "applied");
  assert.equal(idempotent.model.generation, staged.generation);
  const staleWorker = coordinatorTransition(staged, {
    kind: "prepare-participant",
    version: 1,
    expectedGeneration: 0,
    participantId: "participant-scenes",
    ownerRevision: 2,
    contributionHash: evidence("move-scenes"),
  });
  assert.equal(staleWorker.status, "rejected");
  if (staleWorker.status === "rejected")
    assert.equal(staleWorker.reason, "stale-generation");

  const unknown = coordinatorTransition(staged, {
      kind: "mark-outcome-unknown",
      version: 1,
      expectedGeneration: staged.generation,
    }),
    resolvedCancel = coordinatorTransition(unknown.model, {
      kind: "resolve-outcome",
      version: 1,
      expectedGeneration: unknown.model.generation,
      receiptId: unknown.model.receiptId,
      outcome: "cancelled-before-publish",
    });
  assert.equal(resolvedCancel.status, "applied");
  assert.equal(resolvedCancel.model.status, "cancelled-before-publish");
  assert.equal(
    resolvedCancel.model.participants.every(
      (participant) => participant.contributionHash === undefined,
    ),
    true,
  );

  let fullyPrepared = coordinator("move-characters");
  for (const [participantId, ownerRevision, suffix] of [
    ["participant-party", 1, "party-conflict"],
    ["participant-scenes", 2, "scenes-conflict"],
  ] as const) {
    const transition = coordinatorTransition(fullyPrepared, {
      kind: "prepare-participant",
      version: 1,
      expectedGeneration: fullyPrepared.generation,
      participantId,
      ownerRevision,
      contributionHash: evidence(suffix),
    });
    assert.equal(transition.status, "applied");
    fullyPrepared = transition.model;
  }
  const conflict = coordinatorTransition(fullyPrepared, {
      kind: "validate",
      version: 1,
      expectedGeneration: fullyPrepared.generation,
      outcome: "conflict",
    });
  assert.equal(conflict.status, "applied");
  assert.equal(conflict.model.status, "conflict");
  assert.equal(
    conflict.model.participants.every(
      (participant) => participant.contributionHash === undefined,
    ),
    true,
  );
});

test("party history: deletion seal removes reconstructive facts even without a live aggregate", () => {
  const before = party(0, "Secret Name"),
    afterProfile = party(1, "Changed Secret"),
    history = recordPartyHistory(createPartyCommandHistory(CAMPAIGN_A), {
      entryId: "history-secret",
      actionKind: "profile-updated",
      characterIds: ["character-a"],
      commandId: "command-secret",
      commandDigest: "digest-secret",
      receiptId: "receipt-secret",
      before,
      after: afterProfile,
    }),
    afterDeletion = structuredClone(afterProfile) as Raw;
  afterDeletion.partyRevision = 2;
  afterDeletion.characters = afterDeletion.characters.slice(1);
  const sealed = sealPartyHistoryForDeletion(
    history,
    {
      entryId: "history-delete-secret",
      commandId: "command-delete-secret",
      commandDigest: "digest-delete-secret",
      receiptId: "receipt-delete-secret",
      tombstoneId: "tombstone-secret",
      deletedCharacterId: "character-a",
      before: afterProfile,
      after: afterDeletion,
    },
    digest,
  );
  const encoded = JSON.stringify(sealed);
  assert.equal(encoded.includes("Secret Name"), false);
  assert.equal(encoded.includes("Changed Secret"), false);
  assert.equal(encoded.includes("character-a"), false);
  assert.equal(encoded.includes("[UNKNOWN]"), true);
});

test("party history: deleting one character seals unrelated snapshots that could reconstruct it", () => {
  const before = party(0, "Private A"),
    afterB = structuredClone(before) as Raw;
  afterB.partyRevision = 1;
  afterB.characters[1].profile.name = "Updated B";
  const history = recordPartyHistory(createPartyCommandHistory(CAMPAIGN_A), {
      entryId: "history-only-b",
      actionKind: "profile-updated",
      characterIds: ["character-b"],
      commandId: "command-only-b",
      commandDigest: "digest-only-b",
      receiptId: "receipt-only-b",
      before,
      after: afterB,
    }),
    afterDelete = structuredClone(afterB) as Raw;
  afterDelete.partyRevision = 2;
  afterDelete.characters = afterDelete.characters.slice(1);
  const sealed = sealPartyHistoryForDeletion(
      history,
      {
        entryId: "history-delete-a-from-b",
        commandId: "command-delete-a-from-b",
        commandDigest: "digest-delete-a-from-b",
        receiptId: "receipt-delete-a-from-b",
        tombstoneId: "tombstone-a-from-b",
        deletedCharacterId: "character-a",
        before: afterB,
        after: afterDelete,
      },
      digest,
    ),
    encoded = JSON.stringify(sealed);
  assert.equal(sealed.entries[0]?.status, "sealed-deletion");
  assert.equal(encoded.includes("Private A"), false);
  assert.equal(encoded.includes('"before"'), false);
  assert.equal(encoded.includes('"after"'), false);
});
