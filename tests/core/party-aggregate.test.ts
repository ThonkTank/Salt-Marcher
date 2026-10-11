import assert from "node:assert/strict";
import test from "node:test";
import {
  createPartyCharacter,
  parsePartyProjection,
  restPartyCharacters,
  setPartyCharacterProgress,
  updatePartyCharacterProfile,
} from "../../src/features/live-session";

function frozenGraph(value: unknown, seen = new Set<object>()): boolean {
  if (!value || typeof value !== "object" || seen.has(value)) return true;
  seen.add(value);
  return (
    Object.isFrozen(value) &&
    Object.values(value).every((child) => frozenGraph(child, seen))
  );
}

function emptyParty() {
  return parsePartyProjection({
    kind: "party-projection",
    version: 1,
    campaignId: "campaign-a",
    partyRevision: 0,
    characters: [],
  });
}

function activeParty() {
  return parsePartyProjection({
    kind: "party-projection",
    version: 1,
    campaignId: "campaign-a",
    partyRevision: 3,
    characters: [
      {
        characterId: "character-a",
        active: true,
        profile: {
          name: "Alex",
          playerName: "Player",
          species: "Human",
          characterClass: "Wizard",
          languages: ["Common", "Elvish"],
          level: 3,
          armorClass: 12,
        },
        progress: {
          currentXp: 900,
          currentLevelXpFloor: 300,
          nextLevelXpThreshold: 2700,
          xpSinceLongRest: 200,
          xpSinceShortRest: 75,
        },
        sceneAssignment: {
          status: "assigned",
          liveSceneId: "scene-a",
          sceneRevision: 4,
        },
      },
      {
        characterId: "character-b",
        active: true,
        profile: { name: "Alex" },
        progress: {
          currentXp: 500,
          xpSinceLongRest: 20,
          xpSinceShortRest: 10,
        },
        sceneAssignment: {
          status: "assigned",
          liveSceneId: "scene-b",
          sceneRevision: 2,
        },
      },
    ],
  });
}

function commandBase(
  kind: string,
  expectedPartyRevision: number,
  overrides: Record<string, unknown> = {},
) {
  return {
    kind,
    version: 1,
    campaignId: "campaign-a",
    commandId: `command-${kind}-${expectedPartyRevision}`,
    commandDigest: `digest-${kind}-${expectedPartyRevision}`,
    expectedPartyRevision,
    cancelled: false,
    ...overrides,
  };
}

test("name-only creation keeps duplicate names as distinct inactive identities", () => {
  const first = createPartyCharacter(
    emptyParty(),
    commandBase("create-party-character", 0, {
      characterId: "character-a",
      profile: { name: "Alex" },
    }),
  );
  assert.equal(first.status, "applied");
  if (first.status !== "applied") return;
  const second = createPartyCharacter(
    first.party,
    commandBase("create-party-character", 1, {
      characterId: "character-b",
      profile: { name: "Alex" },
    }),
  );
  assert.equal(second.status, "applied");
  if (second.status !== "applied") return;
  assert.deepEqual(
    second.party.characters.map((character) => ({
      id: character.characterId,
      active: character.active,
      profile: character.profile,
      progress: character.progress,
      assignment: character.sceneAssignment,
    })),
    [
      {
        id: "character-a",
        active: false,
        profile: { name: "Alex" },
        progress: {
          currentXp: 0,
          xpSinceLongRest: 0,
          xpSinceShortRest: 0,
        },
        assignment: { status: "inactive" },
      },
      {
        id: "character-b",
        active: false,
        profile: { name: "Alex" },
        progress: {
          currentXp: 0,
          xpSinceLongRest: 0,
          xpSinceShortRest: 0,
        },
        assignment: { status: "inactive" },
      },
    ],
  );
  assert(frozenGraph(second));
});

test("profile replacement clears optional fields without changing identity or Scene", () => {
  const before = activeParty(),
    assignments = before.characters.map((character) => character.sceneAssignment),
    result = updatePartyCharacterProfile(
      before,
      commandBase("update-party-character-profile", 3, {
        characterId: "character-a",
        profile: { name: "Alex renamed" },
      }),
    );
  assert.equal(result.status, "applied");
  if (result.status !== "applied") return;
  assert.deepEqual(result.party.characters[0]?.profile, { name: "Alex renamed" });
  assert.equal(result.party.characters[0]?.characterId, "character-a");
  assert.deepEqual(
    result.party.characters.map((character) => character.sceneAssignment),
    assignments,
  );
  assert.deepEqual(before.characters[0]?.profile.languages, ["Common", "Elvish"]);
});

test("progress correction and selected rests never change Scene membership", () => {
  const before = activeParty(),
    assignments = before.characters.map((character) => character.sceneAssignment),
    progress = setPartyCharacterProgress(
      before,
      commandBase("set-party-character-progress", 3, {
        characterId: "character-a",
        progress: {
          currentXp: 1000,
          currentLevelXpFloor: 300,
          nextLevelXpThreshold: 2700,
          xpSinceLongRest: 300,
          xpSinceShortRest: 175,
        },
      }),
    );
  assert.equal(progress.status, "applied");
  if (progress.status !== "applied") return;
  const shortRest = restPartyCharacters(
    progress.party,
    commandBase("rest-party-characters", 4, {
      rest: "short",
      characterIds: ["character-a"],
    }),
  );
  assert.equal(shortRest.status, "applied");
  if (shortRest.status !== "applied") return;
  assert.equal(shortRest.party.characters[0]?.progress.xpSinceShortRest, 0);
  assert.equal(shortRest.party.characters[0]?.progress.xpSinceLongRest, 300);
  assert.equal(shortRest.party.characters[1]?.progress.xpSinceShortRest, 10);

  const longRest = restPartyCharacters(
    shortRest.party,
    commandBase("rest-party-characters", 5, {
      rest: "long",
      characterIds: ["character-a", "character-b"],
    }),
  );
  assert.equal(longRest.status, "applied");
  if (longRest.status !== "applied") return;
  assert.deepEqual(
    longRest.party.characters.map((character) => character.sceneAssignment),
    assignments,
  );
  assert.deepEqual(
    longRest.party.characters.map((character) => [
      character.progress.xpSinceLongRest,
      character.progress.xpSinceShortRest,
    ]),
    [
      [0, 0],
      [0, 0],
    ],
  );
  assert.deepEqual(
    longRest.party.characters.map((character) => character.progress.currentXp),
    [1000, 500],
  );
});

test("party commands fail closed on cancel, stale revisions, collisions and bad rest sets", () => {
  const party = activeParty(),
    cancelled = updatePartyCharacterProfile(
      party,
      commandBase("update-party-character-profile", 3, {
        cancelled: true,
        characterId: "character-a",
        profile: { name: "Changed" },
      }),
    ),
    stale = setPartyCharacterProgress(
      party,
      commandBase("set-party-character-progress", 2, {
        characterId: "character-a",
        progress: party.characters[0]?.progress,
      }),
    ),
    collision = createPartyCharacter(
      party,
      commandBase("create-party-character", 3, {
        characterId: "character-a",
        profile: { name: "Other" },
      }),
    );
  assert.equal(cancelled.status, "cancelled");
  assert.equal(stale.status, "rejected");
  assert.equal(collision.status, "rejected");
  assert.deepEqual(cancelled.party, party);
  assert.deepEqual(stale.party, party);
  assert.deepEqual(collision.party, party);
  assert.throws(
    () =>
      restPartyCharacters(
        party,
        commandBase("rest-party-characters", 3, {
          rest: "short",
          characterIds: ["character-a", "character-a"],
        }),
      ),
    /doppelte/,
  );
});
