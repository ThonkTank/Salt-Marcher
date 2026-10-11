import assert from "node:assert/strict";
import test from "node:test";
import {
  campaignId,
  projectFocus,
  projectLiveScene,
  projectLiveSession,
  parseLiveSceneSource,
  parsePartyProjection,
  parsePreparationSnapshot,
  revision,
} from "../../src/features/live-session";

function frozenGraph(value: unknown, seen = new Set<object>()): boolean {
  if (!value || typeof value !== "object" || seen.has(value)) return true;
  seen.add(value);
  return (
    Object.isFrozen(value) &&
    Object.values(value).every((child) => frozenGraph(child, seen))
  );
}

function partyRaw() {
  return {
    kind: "party-projection",
    version: 1,
    campaignId: "campaign-a",
    partyRevision: 7,
    characters: [
      {
        characterId: "character-a",
        active: true,
        profile: {
          name: "Alex",
          languages: ["Common", "Dwarvish"],
          level: 3,
          passivePerception: 14,
        },
        progress: {
          currentXp: 1200,
          currentLevelXpFloor: 900,
          nextLevelXpThreshold: 2700,
          xpSinceLongRest: 300,
          xpSinceShortRest: 100,
        },
        sceneAssignment: {
          status: "assigned",
          liveSceneId: "scene-a",
          sceneRevision: 4,
        },
      },
      {
        characterId: "character-b",
        active: false,
        profile: { name: "Alex" },
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

function sceneRaw(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    kind: "live-scene-source",
    version: 1,
    campaignId: "campaign-a",
    liveSceneId: "scene-a",
    sceneRevision: 4,
    lifecycle: "active",
    primary: true,
    characterIds: ["character-a"],
    pendingAssignments: [],
    locationRef: {
      ownerId: "locations",
      referenceId: "location-a",
      ownerRevision: 3,
    },
    sceneClockRef: {
      ownerId: "clock",
      referenceId: "clock-a",
      ownerRevision: 8,
    },
    groupRefs: [],
    maskRefs: [
      {
        maskId: "mask-a",
        kind: "encounter",
        ownerId: "encounters",
        ownerRevision: 2,
        lifecycle: "active",
      },
    ],
    reconciliations: [
      { ownerId: "encounters", status: "current", ownerRevision: 2 },
    ],
    contentPins: [
      { ownerId: "notes", referenceId: "note-a", ownerRevision: 5 },
    ],
    ...overrides,
  };
}

function activeFocus(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    kind: "focus-source",
    version: 1,
    status: "active",
    campaignId: "campaign-a",
    focusRevision: 9,
    liveSceneId: "scene-a",
    sceneRevision: 4,
    ...overrides,
  };
}

test("opaque ids and revisions reject whitespace, control bytes and unsafe values", () => {
  assert.equal(campaignId("campaign-a"), "campaign-a");
  assert.equal(revision(0), 0);
  for (const value of ["", " campaign", "campaign ", "campaign\n"])
    assert.throws(() => campaignId(value), /opaque Kennung/);
  for (const value of [-1, 1.2, Number.MAX_SAFE_INTEGER + 1, "1"])
    assert.throws(() => revision(value), /Revision/);
});

test("party parsing copies, validates and deeply freezes ordered namesake entries", () => {
  const raw = partyRaw(), parsed = parsePartyProjection(raw);
  assert.equal(parsed.characters.length, 2);
  assert.equal(parsed.characters[0]?.profile.name, "Alex");
  assert.equal(parsed.characters[1]?.profile.name, "Alex");
  assert.equal(parsed.characters[1]?.profile.level, undefined);
  assert.equal(parsed.characters[1]?.profile.armorClass, undefined);
  assert(frozenGraph(parsed));
  raw.characters[0]!.profile.name = "mutated";
  raw.characters[0]!.profile.languages!.push("Elvish");
  assert.equal(parsed.characters[0]?.profile.name, "Alex");
  assert.deepEqual(parsed.characters[0]?.profile.languages, ["Common", "Dwarvish"]);
});

test("party contracts reject unknown fields, duplicate ids and contradictory membership", () => {
  const unknown = partyRaw();
  Object.assign(unknown.characters[0]!.profile, { sentinel: 10 });
  assert.throws(() => parsePartyProjection(unknown), /unbekannte|unvollständige/);
  const duplicate = partyRaw();
  duplicate.characters[1]!.characterId = "character-a";
  assert.throws(() => parsePartyProjection(duplicate), /doppelte/i);
  const inactiveAssigned = partyRaw();
  inactiveAssigned.characters[1]!.sceneAssignment = {
    status: "assigned",
    liveSceneId: "scene-a",
    sceneRevision: 4,
  };
  assert.throws(
    () => parsePartyProjection(inactiveAssigned),
    /widersprüchliche Scene-Zuordnung/,
  );
  const badProgress = partyRaw();
  badProgress.characters[0]!.progress.xpSinceShortRest = 301;
  assert.throws(() => parsePartyProjection(badProgress), /Fortschrittswerte/);

  const sparse = partyRaw();
  delete sparse.characters[0];
  assert.throws(() => parsePartyProjection(sparse), /vollständige native Liste/);

  const accessor = partyRaw();
  Object.defineProperty(accessor.characters[0]!.profile, "name", {
    enumerable: true,
    get: () => "Alex",
  });
  assert.throws(() => parsePartyProjection(accessor), /berechnete/);

  const inherited = partyRaw();
  Object.setPrototypeOf(inherited.characters[0]!.profile, { hidden: true });
  assert.throws(() => parsePartyProjection(inherited), /berechnete/);
});

test("PreparationSnapshot is an independent immutable copy with exact provenance", () => {
  const raw = {
      kind: "preparation-snapshot",
      version: 1,
      campaignId: "campaign-a",
      preparationId: "preparation-a",
      preparationRevision: 2,
      source: { ownerId: "planner", sourceId: "plan-a", sourceRevision: 6 },
      title: "The next session",
      notes: "Keep the source unchanged.",
      locationRef: {
        ownerId: "locations",
        referenceId: "location-a",
        ownerRevision: 3,
      },
      contentPins: [
        { ownerId: "notes", referenceId: "note-a", ownerRevision: 4 },
      ],
      encounterPlanRef: {
        ownerId: "encounters",
        referenceId: "encounter-plan-a",
        ownerRevision: 1,
      },
    },
    parsed = parsePreparationSnapshot(raw);
  raw.notes = "mutated";
  raw.contentPins[0]!.referenceId = "mutated";
  assert.equal(parsed.notes, "Keep the source unchanged.");
  assert.equal(parsed.contentPins[0]?.referenceId, "note-a");
  assert(frozenGraph(parsed));
  assert.throws(
    () => parsePreparationSnapshot({ ...raw, importedCharacters: [] }),
    /unbekannte|unvollständige/,
  );
});

test("focus projection exposes scene data only for an exact active source", () => {
  const active = projectFocus(activeFocus(), sceneRaw());
  assert.deepEqual(active, {
    kind: "focus-projection",
    version: 1,
    status: "active",
    campaignId: "campaign-a",
    focusRevision: 9,
    liveSceneId: "scene-a",
    sceneRevision: 4,
  });
  assert(frozenGraph(active));

  const stale = projectFocus(activeFocus(), sceneRaw({ sceneRevision: 5 }));
  assert.equal(stale.status, "unavailable");
  assert.equal(stale.liveSceneId, null);
  assert(!("sceneRevision" in stale));
  assert.equal(stale.status === "unavailable" && stale.reason, "stale-scene");

  const foreign = projectFocus(activeFocus(), sceneRaw({ campaignId: "campaign-b" }));
  assert.equal(foreign.status, "unavailable");
  assert.equal(foreign.status === "unavailable" && foreign.reason, "foreign-scene");

  const retired = projectFocus(activeFocus(), sceneRaw({ lifecycle: "retired" }));
  assert.equal(retired.status, "unavailable");
  assert.equal(retired.status === "unavailable" && retired.reason, "inactive-scene");

  const damaged = projectFocus(activeFocus(), { ...sceneRaw(), unknown: true });
  assert.equal(damaged.status, "unavailable");
  assert.equal(damaged.status === "unavailable" && damaged.reason, "invalid-scene");
});

test("none, pending and unavailable focus never carry current scene truth", () => {
  const common = {
    kind: "focus-source",
    version: 1,
    campaignId: "campaign-a",
    focusRevision: 9,
  };
  const none = projectFocus({ ...common, status: "none" }, sceneRaw()),
    pending = projectFocus(
      { ...common, status: "pending", commandId: "command-a" },
      sceneRaw(),
    ),
    unavailable = projectFocus(
      { ...common, status: "unavailable", ownerId: "scenes" },
      sceneRaw(),
    );
  for (const projection of [none, pending, unavailable]) {
    assert.equal(projection.liveSceneId, null);
    assert(!("sceneRevision" in projection));
  }
  assert.equal(pending.status, "pending");
  assert.equal(unavailable.status, "unavailable");
});

test("LiveScene projection contains references only and is deeply immutable", () => {
  const raw = sceneRaw(), focus = projectFocus(activeFocus(), raw),
    result = projectLiveScene(raw, focus);
  assert.equal(result.status, "active");
  assert(frozenGraph(result));
  if (result.status !== "active") return;
  assert.deepEqual(result.projection.characterIds, ["character-a"]);
  assert.equal(result.projection.focus.status, "focused");
  assert.equal(result.projection.maskRefs[0]?.maskId, "mask-a");
  assert(!("profile" in result.projection));
  assert(!("map" in result.projection));
  (raw.maskRefs as Array<Record<string, unknown>>)[0]!.maskId = "mutated";
  assert.equal(result.projection.maskRefs[0]?.maskId, "mask-a");
});

test("LiveSession composition fails closed for mismatched Party or Scene evidence", () => {
  const focus = projectFocus(activeFocus(), sceneRaw()),
    scene = projectLiveScene(sceneRaw(), focus),
    active = projectLiveSession(partyRaw(), focus, scene);
  assert.equal(active.status, "active");
  assert(frozenGraph(active));
  if (active.status !== "active") return;
  assert.equal(active.scene.liveSceneId, "scene-a");
  assert(!("characters" in active));

  const wrongParty = partyRaw();
  wrongParty.characters[0]!.sceneAssignment.sceneRevision = 3;
  assert.equal(projectLiveSession(wrongParty, focus, scene).status, "unavailable");

  const foreignParty = partyRaw();
  foreignParty.campaignId = "campaign-b";
  const foreignResult = projectLiveSession(foreignParty, focus, scene);
  assert.equal(foreignResult.status, "unavailable");
  assert.equal(foreignResult.campaignId, "campaign-a");

  const missingSceneMember = sceneRaw({ characterIds: [] });
  const missingMemberFocus = projectFocus(activeFocus(), missingSceneMember);
  const missingMemberScene = projectLiveScene(
    missingSceneMember,
    missingMemberFocus,
  );
  assert.equal(
    projectLiveSession(partyRaw(), missingMemberFocus, missingMemberScene).status,
    "unavailable",
  );
});

test("downstream projection builders revalidate structurally forged focus evidence", () => {
  const forgedFocus = {
    kind: "focus-projection",
    version: 1,
    status: "active",
    campaignId: "campaign-a",
    focusRevision: -1,
    liveSceneId: "scene-a",
    sceneRevision: 4,
  };
  assert.throws(
    () => projectLiveScene(sceneRaw(), forgedFocus),
    /FocusProjection\.focusRevision|Revision/,
  );
  assert.throws(
    () => projectLiveSession(partyRaw(), forgedFocus),
    /FocusProjection\.focusRevision|Revision/,
  );
});

test("LiveSession reparses and detaches a structurally supplied Scene projection", () => {
  const focus = projectFocus(activeFocus(), sceneRaw()),
    projected = projectLiveScene(sceneRaw(), focus);
  assert.equal(projected.status, "active");
  if (projected.status !== "active") return;
  const mutablePins = projected.projection.contentPins.map((entry) => ({
      ...entry,
    })),
    supplied = {
      status: "active",
      projection: {
        ...projected.projection,
        focus: { ...projected.projection.focus },
        characterIds: [...projected.projection.characterIds],
        pendingAssignments: [...projected.projection.pendingAssignments],
        groupRefs: [...projected.projection.groupRefs],
        maskRefs: [...projected.projection.maskRefs],
        reconciliations: [...projected.projection.reconciliations],
        contentPins: mutablePins,
      },
    },
    session = projectLiveSession(partyRaw(), focus, supplied);
  assert.equal(session.status, "active");
  assert(frozenGraph(session));
  if (session.status !== "active") return;
  assert.notEqual(session.scene, supplied.projection);
  mutablePins[0]!.referenceId = "mutated" as never;
  supplied.projection.characterIds.push("character-z" as never);
  assert.equal(session.scene.contentPins[0]?.referenceId, "note-a");
  assert.deepEqual(session.scene.characterIds, ["character-a"]);

  const inconsistentFocus = {
    ...supplied,
    projection: {
      ...supplied.projection,
      focus: { status: "not-focused" },
    },
  };
  assert.equal(
    projectLiveSession(partyRaw(), focus, inconsistentFocus).status,
    "unavailable",
  );
});

test("strict source parsers reject duplicate and incomplete reference evidence", () => {
  const duplicate = sceneRaw();
  duplicate.contentPins = [
    { ownerId: "notes", referenceId: "note-a", ownerRevision: 1 },
    { ownerId: "notes", referenceId: "note-a", ownerRevision: 2 },
  ];
  assert.throws(() => parseLiveSceneSource(duplicate), /doppelte/i);
  const incomplete = sceneRaw();
  incomplete.reconciliations = [{ ownerId: "encounters", status: "current" }];
  assert.throws(() => parseLiveSceneSource(incomplete), /OwnerRevision/);
});
