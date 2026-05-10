package src.domain.party.model.roster.model;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import src.domain.party.model.roster.helper.PartyCharacterDraftValidationHelper;
import src.domain.party.model.roster.helper.PartyLevelProgressionHelper;
import src.domain.party.model.roster.helper.PartyRosterMutationHelper;
import src.domain.party.model.roster.helper.PartyRosterXpAllocationHelper;

public final class PartyRoster {

    private final long nextCharacterId;
    private final List<PartyCharacter> characters;
    private final PartyCharacterDraftValidationHelper draftValidator = new PartyCharacterDraftValidationHelper();
    private final PartyRosterMutationHelper mutations = new PartyRosterMutationHelper();
    private final PartyRosterXpAllocationHelper xpAllocator = new PartyRosterXpAllocationHelper();

    public PartyRoster(long nextCharacterId, List<PartyCharacter> characters) {
        this.nextCharacterId = Math.max(1L, nextCharacterId);
        this.characters = characters == null ? List.of() : List.copyOf(characters);
    }

    public long nextCharacterId() {
        return nextCharacterId;
    }

    public List<PartyCharacter> characters() {
        return characters;
    }

    PartyRoster copy() {
        return new PartyRoster(nextCharacterId, characters);
    }

    public PartyRosterProjection projection() {
        return PartyRosterProjection.from(characters);
    }

    public MutationResult createCharacter(PartyCharacterDraft draft, PartyMembership membership) {
        if (!draftValidator.isValid(draft) || membership == null) {
            return new MutationResult(PartyMutationStatus.INVALID_INPUT, this);
        }
        List<PartyCharacter> nextCharacters = new ArrayList<>(characters);
        nextCharacters.add(new PartyCharacter(
                nextCharacterId,
                new PartyCharacterIdentity(draft.name(), draft.playerName()),
                new PartyCharacterProgress(
                        draft.level(),
                        PartyLevelProgressionHelper.minimumXpForLevel(draft.level()),
                        0,
                        0,
                        0),
                new PartyCharacterCombatProfile(draft.passivePerception(), draft.armorClass()),
                membership));
        return new MutationResult(PartyMutationStatus.SUCCESS, new PartyRoster(nextCharacterId + 1, nextCharacters));
    }

    public MutationResult updateCharacter(long id, PartyCharacterDraft draft) {
        if (!draftValidator.isValid(draft)) {
            return new MutationResult(PartyMutationStatus.INVALID_INPUT, this);
        }
        List<PartyCharacter> nextCharacters = mutations.replace(characters, id, character -> character.update(draft));
        if (nextCharacters.isEmpty()) {
            return new MutationResult(PartyMutationStatus.NOT_FOUND, this);
        }
        return new MutationResult(PartyMutationStatus.SUCCESS, new PartyRoster(nextCharacterId, nextCharacters));
    }

    public MutationResult deleteCharacter(long id) {
        List<PartyCharacter> nextCharacters = mutations.remove(characters, id);
        if (nextCharacters.isEmpty()) {
            return new MutationResult(PartyMutationStatus.NOT_FOUND, this);
        }
        return new MutationResult(PartyMutationStatus.SUCCESS, new PartyRoster(nextCharacterId, nextCharacters));
    }

    public MutationResult setMembership(long id, PartyMembership membership) {
        if (membership == null) {
            return new MutationResult(PartyMutationStatus.INVALID_INPUT, this);
        }
        List<PartyCharacter> nextCharacters = mutations.replace(characters, id, character -> character.withMembership(membership));
        if (nextCharacters.isEmpty()) {
            return new MutationResult(PartyMutationStatus.NOT_FOUND, this);
        }
        return new MutationResult(PartyMutationStatus.SUCCESS, new PartyRoster(nextCharacterId, nextCharacters));
    }

    public MutationResult awardXp(List<Long> ids, int xpPerCharacter) {
        return adjustXp(ids, Math.max(0, xpPerCharacter));
    }

    public MutationResult adjustXp(List<Long> ids, int xpDelta) {
        PartyRosterXpAllocationHelper.Result adjustmentResult = xpAllocator.apply(characters, ids, xpDelta);
        if (!adjustmentResult.validRequest()) {
            return new MutationResult(PartyMutationStatus.INVALID_INPUT, this);
        }
        if (!adjustmentResult.updatedAny()) {
            return new MutationResult(PartyMutationStatus.NOT_FOUND, this);
        }
        return new MutationResult(PartyMutationStatus.SUCCESS, new PartyRoster(nextCharacterId, adjustmentResult.characters()));
    }

    public MutationResult performRest(PartyRestType restType) {
        Objects.requireNonNull(restType, "restType");
        List<PartyCharacter> nextCharacters = new ArrayList<>(characters.size());
        for (PartyCharacter character : characters) {
            nextCharacters.add(character.membership().isActive() ? character.afterRest(restType) : character);
        }
        return new MutationResult(PartyMutationStatus.SUCCESS, new PartyRoster(nextCharacterId, nextCharacters));
    }

    public MutationResult moveCharacters(List<Long> ids, PartyTravelLocation location, boolean attachToPartyToken) {
        if (location == null || ids == null || ids.isEmpty()) {
            return new MutationResult(PartyMutationStatus.INVALID_INPUT, this);
        }
        List<PartyCharacter> nextCharacters = mutations.replace(
                characters,
                ids,
                character -> character.moveTo(location, attachToPartyToken));
        if (nextCharacters.isEmpty()) {
            return new MutationResult(PartyMutationStatus.NOT_FOUND, this);
        }
        return new MutationResult(PartyMutationStatus.SUCCESS, new PartyRoster(nextCharacterId, nextCharacters));
    }

    public record MutationResult(
            PartyMutationStatus status,
            PartyRoster roster
    ) {
        public MutationResult {
            Objects.requireNonNull(status, "status");
            roster = Objects.requireNonNull(roster, "roster").copy();
        }

        @Override
        public PartyRoster roster() {
            return roster.copy();
        }
    }
}
