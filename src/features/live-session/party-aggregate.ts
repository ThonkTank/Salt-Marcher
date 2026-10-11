import {
  parsePartyProjection,
  type PartyCharacterProfileProjection,
  type PartyCharacterProgressProjection,
  type PartyProjection,
} from "./contracts";
import {
  parseCreatePartyCharacterCommand,
  parseRestPartyCharactersCommand,
  parseSetPartyCharacterProgressCommand,
  parseUpdatePartyCharacterProfileCommand,
  type PartyCommandBinding,
} from "./commands";
import {
  revision,
  type CharacterId,
  type CommandDigest,
  type CommandId,
  type Revision,
} from "./ids";

export type PartyCommandRejectionReason =
  | "cancelled"
  | "foreign-campaign"
  | "stale-party"
  | "id-collision"
  | "unknown-character"
  | "inactive-character"
  | "no-change";

export interface PartyAppliedDecision {
  readonly campaignId: PartyProjection["campaignId"];
  readonly commandId: CommandId;
  readonly commandDigest: CommandDigest;
  readonly kind:
    | "character-created"
    | "profile-updated"
    | "progress-updated"
    | "characters-rested";
  readonly partyRevisionBefore: Revision;
  readonly partyRevisionAfter: Revision;
  readonly characterIds: readonly CharacterId[];
}

export type PartyCommandResult =
  | {
      readonly status: "applied";
      readonly party: PartyProjection;
      readonly decision: PartyAppliedDecision;
    }
  | {
      readonly status: "rejected" | "cancelled";
      readonly party: PartyProjection;
      readonly commandId: CommandId;
      readonly commandDigest: CommandDigest;
      readonly reason: PartyCommandRejectionReason;
    };

function nextRevision(value: Revision): Revision {
  return revision(value + 1, "PartyProjection.partyRevision");
}

function reject(
  party: PartyProjection,
  command: PartyCommandBinding,
  reason: PartyCommandRejectionReason,
): PartyCommandResult {
  return Object.freeze({
    status: reason === "cancelled" ? "cancelled" : "rejected",
    party,
    commandId: command.commandId,
    commandDigest: command.commandDigest,
    reason,
  });
}

function commonRejection(
  party: PartyProjection,
  command: PartyCommandBinding,
): PartyCommandResult | undefined {
  if (command.cancelled) return reject(party, command, "cancelled");
  if (command.campaignId !== party.campaignId)
    return reject(party, command, "foreign-campaign");
  if (command.expectedPartyRevision !== party.partyRevision)
    return reject(party, command, "stale-party");
  return undefined;
}

function applied(
  before: PartyProjection,
  partyValue: unknown,
  command: PartyCommandBinding,
  kind: PartyAppliedDecision["kind"],
  characterIds: readonly CharacterId[],
): PartyCommandResult {
  const party = parsePartyProjection(partyValue);
  return Object.freeze({
    status: "applied",
    party,
    decision: Object.freeze({
      campaignId: party.campaignId,
      commandId: command.commandId,
      commandDigest: command.commandDigest,
      kind,
      partyRevisionBefore: before.partyRevision,
      partyRevisionAfter: party.partyRevision,
      characterIds: Object.freeze([...characterIds]),
    }),
  });
}

function sameProfile(
  left: PartyCharacterProfileProjection,
  right: PartyCharacterProfileProjection,
): boolean {
  const scalarKeys = [
    "name",
    "playerName",
    "species",
    "characterClass",
    "level",
    "passivePerception",
    "passiveInvestigation",
    "passiveInsight",
    "armorClass",
    "movementSpeedFeet",
  ] as const;
  return (
    scalarKeys.every((key) => left[key] === right[key]) &&
    (left.languages === undefined) === (right.languages === undefined) &&
    (left.languages?.length ?? 0) === (right.languages?.length ?? 0) &&
    (left.languages ?? []).every(
      (language, index) => language === right.languages?.[index],
    )
  );
}

function sameProgress(
  left: PartyCharacterProgressProjection,
  right: PartyCharacterProgressProjection,
): boolean {
  return (
    left.currentXp === right.currentXp &&
    left.currentLevelXpFloor === right.currentLevelXpFloor &&
    left.nextLevelXpThreshold === right.nextLevelXpThreshold &&
    left.xpSinceLongRest === right.xpSinceLongRest &&
    left.xpSinceShortRest === right.xpSinceShortRest
  );
}

export function createPartyCharacter(
  partyValue: unknown,
  commandValue: unknown,
): PartyCommandResult {
  const party = parsePartyProjection(partyValue),
    command = parseCreatePartyCharacterCommand(commandValue),
    blocked = commonRejection(party, command);
  if (blocked) return blocked;
  if (party.characters.some((character) => character.characterId === command.characterId))
    return reject(party, command, "id-collision");
  return applied(
    party,
    {
      ...party,
      partyRevision: nextRevision(party.partyRevision),
      characters: [
        ...party.characters,
        {
          characterId: command.characterId,
          active: false,
          profile: command.profile,
          progress: {
            currentXp: 0,
            xpSinceLongRest: 0,
            xpSinceShortRest: 0,
          },
          sceneAssignment: { status: "inactive" },
        },
      ],
    },
    command,
    "character-created",
    [command.characterId],
  );
}

export function updatePartyCharacterProfile(
  partyValue: unknown,
  commandValue: unknown,
): PartyCommandResult {
  const party = parsePartyProjection(partyValue),
    command = parseUpdatePartyCharacterProfileCommand(commandValue),
    blocked = commonRejection(party, command);
  if (blocked) return blocked;
  const index = party.characters.findIndex(
    (character) => character.characterId === command.characterId,
  );
  if (index < 0) return reject(party, command, "unknown-character");
  if (sameProfile(party.characters[index]!.profile, command.profile))
    return reject(party, command, "no-change");
  return applied(
    party,
    {
      ...party,
      partyRevision: nextRevision(party.partyRevision),
      characters: party.characters.map((character, characterIndex) =>
        characterIndex === index
          ? { ...character, profile: command.profile }
          : character,
      ),
    },
    command,
    "profile-updated",
    [command.characterId],
  );
}

export function setPartyCharacterProgress(
  partyValue: unknown,
  commandValue: unknown,
): PartyCommandResult {
  const party = parsePartyProjection(partyValue),
    command = parseSetPartyCharacterProgressCommand(commandValue),
    blocked = commonRejection(party, command);
  if (blocked) return blocked;
  const index = party.characters.findIndex(
    (character) => character.characterId === command.characterId,
  );
  if (index < 0) return reject(party, command, "unknown-character");
  if (sameProgress(party.characters[index]!.progress, command.progress))
    return reject(party, command, "no-change");
  return applied(
    party,
    {
      ...party,
      partyRevision: nextRevision(party.partyRevision),
      characters: party.characters.map((character, characterIndex) =>
        characterIndex === index
          ? { ...character, progress: command.progress }
          : character,
      ),
    },
    command,
    "progress-updated",
    [command.characterId],
  );
}

export function restPartyCharacters(
  partyValue: unknown,
  commandValue: unknown,
): PartyCommandResult {
  const party = parsePartyProjection(partyValue),
    command = parseRestPartyCharactersCommand(commandValue),
    blocked = commonRejection(party, command);
  if (blocked) return blocked;
  const selected = new Set(command.characterIds),
    characters = command.characterIds.map((id) =>
      party.characters.find((character) => character.characterId === id),
    );
  if (characters.some((character) => character === undefined))
    return reject(party, command, "unknown-character");
  if (characters.some((character) => !character!.active))
    return reject(party, command, "inactive-character");
  const changes = characters.some((character) =>
    command.rest === "long"
      ? character!.progress.xpSinceLongRest !== 0 ||
        character!.progress.xpSinceShortRest !== 0
      : character!.progress.xpSinceShortRest !== 0,
  );
  if (!changes) return reject(party, command, "no-change");
  return applied(
    party,
    {
      ...party,
      partyRevision: nextRevision(party.partyRevision),
      characters: party.characters.map((character) =>
        selected.has(character.characterId)
          ? {
              ...character,
              progress: {
                ...character.progress,
                ...(command.rest === "long" ? { xpSinceLongRest: 0 } : {}),
                xpSinceShortRest: 0,
              },
            }
          : character,
      ),
    },
    command,
    "characters-rested",
    command.characterIds,
  );
}
