package src.domain.party.model.roster.model;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import src.domain.party.model.roster.helper.PartyCharacterDraftValidationHelper;
import src.domain.party.model.roster.helper.PartyLevelProgressionHelper;
import src.domain.party.model.roster.helper.PartyRosterMutationHelper;
import src.domain.party.model.roster.helper.PartyRosterXpAllocationHelper;
import src.domain.party.published.CharacterDraft;
import src.domain.party.published.MembershipState;
import src.domain.party.published.MutationStatus;
import src.domain.party.published.RestType;

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

    public MutationResult createCharacter(CharacterDraft draft, MembershipState membership) {
        if (!draftValidator.isValid(draft) || membership == null) {
            return new MutationResult(MutationStatus.INVALID_INPUT, this);
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
        return new MutationResult(MutationStatus.SUCCESS, new PartyRoster(nextCharacterId + 1, nextCharacters));
    }

    public MutationResult updateCharacter(long id, CharacterDraft draft) {
        if (!draftValidator.isValid(draft)) {
            return new MutationResult(MutationStatus.INVALID_INPUT, this);
        }
        List<PartyCharacter> nextCharacters = mutations.updateDraft(characters, id, draft);
        if (nextCharacters.isEmpty()) {
            return new MutationResult(MutationStatus.NOT_FOUND, this);
        }
        return new MutationResult(MutationStatus.SUCCESS, new PartyRoster(nextCharacterId, nextCharacters));
    }

    public MutationResult deleteCharacter(long id) {
        List<PartyCharacter> nextCharacters = mutations.remove(characters, id);
        if (nextCharacters.isEmpty()) {
            return new MutationResult(MutationStatus.NOT_FOUND, this);
        }
        return new MutationResult(MutationStatus.SUCCESS, new PartyRoster(nextCharacterId, nextCharacters));
    }

    public MutationResult setMembership(long id, MembershipState membership) {
        if (membership == null) {
            return new MutationResult(MutationStatus.INVALID_INPUT, this);
        }
        List<PartyCharacter> nextCharacters = mutations.updateMembership(characters, id, membership);
        if (nextCharacters.isEmpty()) {
            return new MutationResult(MutationStatus.NOT_FOUND, this);
        }
        return new MutationResult(MutationStatus.SUCCESS, new PartyRoster(nextCharacterId, nextCharacters));
    }

    public MutationResult awardXp(List<Long> ids, int xpPerCharacter) {
        return adjustXp(ids, Math.max(0, xpPerCharacter));
    }

    public MutationResult adjustXp(List<Long> ids, int xpDelta) {
        PartyRosterXpAllocationHelper.Result adjustmentResult = xpAllocator.apply(characters, ids, xpDelta);
        if (!adjustmentResult.validRequest()) {
            return new MutationResult(MutationStatus.INVALID_INPUT, this);
        }
        if (!adjustmentResult.updatedAny()) {
            return new MutationResult(MutationStatus.NOT_FOUND, this);
        }
        return new MutationResult(MutationStatus.SUCCESS, new PartyRoster(nextCharacterId, adjustmentResult.characters()));
    }

    public MutationResult performRest(RestType restType) {
        Objects.requireNonNull(restType, "restType");
        List<PartyCharacter> nextCharacters = new ArrayList<>(characters.size());
        for (PartyCharacter character : characters) {
            nextCharacters.add(character.membership().isActive() ? character.afterRest(restType) : character);
        }
        return new MutationResult(MutationStatus.SUCCESS, new PartyRoster(nextCharacterId, nextCharacters));
    }

    public MutationResult moveCharacters(List<Long> ids, PartyTravelLocation location, boolean attachToPartyToken) {
        if (location == null || ids == null || ids.isEmpty()) {
            return new MutationResult(MutationStatus.INVALID_INPUT, this);
        }
        List<PartyCharacter> nextCharacters = mutations.moveCharacters(characters, ids, location, attachToPartyToken);
        if (nextCharacters.isEmpty()) {
            return new MutationResult(MutationStatus.NOT_FOUND, this);
        }
        return new MutationResult(MutationStatus.SUCCESS, new PartyRoster(nextCharacterId, nextCharacters));
    }

    public record MutationResult(
            MutationStatus status,
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
