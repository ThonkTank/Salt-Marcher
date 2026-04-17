package src.domain.party.entity;

import src.domain.party.partyAPI;
import src.domain.party.valueobject.PartyMembership;
import src.domain.party.valueobject.PartyMutationStatus;
import src.domain.party.valueobject.PartyRestType;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

public final class PartyRoster {

    private final long nextCharacterId;
    private final List<PartyCharacter> characters;
    private final PartyCharacterDraftValidator draftValidator = new PartyCharacterDraftValidator();
    private final PartyRosterMutations mutations = new PartyRosterMutations();
    private final PartyRosterXpAllocator xpAllocator = new PartyRosterXpAllocator();

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

    public PartyRosterProjection projection() {
        return PartyRosterProjection.from(characters);
    }

    public MutationResult createCharacter(partyAPI.CharacterDraft draft, PartyMembership membership) {
        if (!draftValidator.isValid(draft) || membership == null) {
            return new MutationResult(PartyMutationStatus.INVALID_INPUT, this);
        }
        List<PartyCharacter> nextCharacters = new ArrayList<>(characters);
        nextCharacters.add(new PartyCharacter(
                nextCharacterId,
                new PartyCharacterIdentity(draft.name(), draft.playerName()),
                new PartyCharacterProgress(
                        draft.level(),
                        src.domain.party.valueobject.PartyLevelProgression.minimumXpForLevel(draft.level()),
                        0,
                        0,
                        0),
                new PartyCharacterCombatProfile(draft.passivePerception(), draft.armorClass()),
                membership));
        return new MutationResult(PartyMutationStatus.SUCCESS, new PartyRoster(nextCharacterId + 1, nextCharacters));
    }

    public MutationResult updateCharacter(long id, partyAPI.CharacterDraft draft) {
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
        PartyRosterXpAllocator.Result awardResult = xpAllocator.apply(characters, ids, xpPerCharacter);
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
            nextCharacters.add(character.membership() == PartyMembership.ACTIVE ? character.afterRest(restType) : character);
        }
        return new MutationResult(PartyMutationStatus.SUCCESS, new PartyRoster(nextCharacterId, nextCharacters));
    }

    public record MutationResult(
            PartyMutationStatus status,
            PartyRoster roster
    ) {
    }
}
