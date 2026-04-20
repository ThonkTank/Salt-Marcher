package src.domain.party.roster.aggregate;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import src.domain.party.roster.entity.PartyCharacter;
import src.domain.party.roster.policy.PartyCharacterDraftValidationPolicy;
import src.domain.party.roster.policy.PartyLevelProgressionPolicy;
import src.domain.party.roster.policy.PartyRosterMutationPolicy;
import src.domain.party.roster.policy.PartyRosterXpAllocationPolicy;
import src.domain.party.roster.value.PartyCharacterCombatProfile;
import src.domain.party.roster.value.PartyCharacterDraft;
import src.domain.party.roster.value.PartyCharacterIdentity;
import src.domain.party.roster.value.PartyCharacterProgress;
import src.domain.party.roster.value.PartyMembership;
import src.domain.party.roster.value.PartyMutationStatus;
import src.domain.party.roster.value.PartyRestType;
import src.domain.party.roster.value.PartyRosterProjection;

public final class PartyRoster {

    private final long nextCharacterId;
    private final List<PartyCharacter> characters;
    private final PartyCharacterDraftValidationPolicy draftValidator = new PartyCharacterDraftValidationPolicy();
    private final PartyRosterMutationPolicy mutations = new PartyRosterMutationPolicy();
    private final PartyRosterXpAllocationPolicy xpAllocator = new PartyRosterXpAllocationPolicy();

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
                        PartyLevelProgressionPolicy.minimumXpForLevel(draft.level()),
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
        PartyRosterXpAllocationPolicy.Result awardResult = xpAllocator.apply(characters, ids, xpPerCharacter);
        if (!awardResult.validRequest()) {
            return new MutationResult(PartyMutationStatus.INVALID_INPUT, this);
        }
        if (!awardResult.updatedAny()) {
            return new MutationResult(PartyMutationStatus.NOT_FOUND, this);
        }
        return new MutationResult(PartyMutationStatus.SUCCESS, new PartyRoster(nextCharacterId, awardResult.characters()));
    }

    public MutationResult performRest(PartyRestType restType) {
        Objects.requireNonNull(restType, "restType");
        List<PartyCharacter> nextCharacters = new ArrayList<>(characters.size());
        for (PartyCharacter character : characters) {
            nextCharacters.add(character.membership().isActive() ? character.afterRest(restType) : character);
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
