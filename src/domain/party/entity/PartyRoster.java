package src.domain.party.entity;

import src.domain.party.partyAPI;
import src.domain.party.valueobject.PartyMembership;
import src.domain.party.valueobject.PartyMutationStatus;
import src.domain.party.valueobject.PartyRestType;
import src.domain.party.valueobject.PartyXpTables;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

public final class PartyRoster {

    private final long nextCharacterId;
    private final List<PartyCharacter> characters;

    public PartyRoster(long nextCharacterId, List<PartyCharacter> characters) {
        this.nextCharacterId = Math.max(1L, nextCharacterId);
        this.characters = characters == null ? List.of() : List.copyOf(characters);
    }

    public static PartyRoster empty() {
        return new PartyRoster(1L, List.of());
    }

    public long nextCharacterId() {
        return nextCharacterId;
    }

    public List<PartyCharacter> characters() {
        return characters;
    }

    public List<PartyCharacter> activeMembers() {
        return characters.stream()
                .filter(PartyCharacter::isActive)
                .sorted(Comparator.comparingLong(PartyCharacter::id))
                .toList();
    }

    public List<PartyCharacter> reserveMembers() {
        return characters.stream()
                .filter(character -> !character.isActive())
                .sorted(Comparator.comparing(PartyCharacter::name, String.CASE_INSENSITIVE_ORDER)
                        .thenComparingLong(PartyCharacter::id))
                .toList();
    }

    public List<Integer> activeLevelsByComposition() {
        return activeMembers().stream()
                .sorted(Comparator.comparingInt(PartyCharacter::level).thenComparingLong(PartyCharacter::id))
                .map(PartyCharacter::level)
                .toList();
    }

    public int averageActiveLevel() {
        List<PartyCharacter> activeMembers = activeMembers();
        if (activeMembers.isEmpty()) {
            return 1;
        }
        return (int) Math.round(activeMembers.stream().mapToInt(PartyCharacter::level).average().orElse(1.0));
    }

    public MutationResult createCharacter(partyAPI.CharacterDraft draft, PartyMembership membership) {
        if (!isValidDraft(draft) || membership == null) {
            return new MutationResult(PartyMutationStatus.INVALID_INPUT, this);
        }
        List<PartyCharacter> nextCharacters = new ArrayList<>(characters);
        nextCharacters.add(new PartyCharacter(
                nextCharacterId,
                draft.name(),
                draft.playerName(),
                draft.level(),
                PartyXpTables.minimumXpForLevel(draft.level()),
                0,
                0,
                draft.passivePerception(),
                draft.armorClass(),
                membership));
        return new MutationResult(PartyMutationStatus.SUCCESS, new PartyRoster(nextCharacterId + 1, nextCharacters));
    }

    public MutationResult updateCharacter(long id, partyAPI.CharacterDraft draft) {
        if (!isValidDraft(draft)) {
            return new MutationResult(PartyMutationStatus.INVALID_INPUT, this);
        }
        int index = indexOf(id);
        if (index < 0) {
            return new MutationResult(PartyMutationStatus.NOT_FOUND, this);
        }
        List<PartyCharacter> nextCharacters = new ArrayList<>(characters);
        nextCharacters.set(index, nextCharacters.get(index).update(draft));
        return new MutationResult(PartyMutationStatus.SUCCESS, new PartyRoster(nextCharacterId, nextCharacters));
    }

    public MutationResult deleteCharacter(long id) {
        int index = indexOf(id);
        if (index < 0) {
            return new MutationResult(PartyMutationStatus.NOT_FOUND, this);
        }
        List<PartyCharacter> nextCharacters = new ArrayList<>(characters);
        nextCharacters.remove(index);
        return new MutationResult(PartyMutationStatus.SUCCESS, new PartyRoster(nextCharacterId, nextCharacters));
    }

    public MutationResult setMembership(long id, PartyMembership membership) {
        if (membership == null) {
            return new MutationResult(PartyMutationStatus.INVALID_INPUT, this);
        }
        int index = indexOf(id);
        if (index < 0) {
            return new MutationResult(PartyMutationStatus.NOT_FOUND, this);
        }
        List<PartyCharacter> nextCharacters = new ArrayList<>(characters);
        nextCharacters.set(index, nextCharacters.get(index).withMembership(membership));
        return new MutationResult(PartyMutationStatus.SUCCESS, new PartyRoster(nextCharacterId, nextCharacters));
    }

    public MutationResult awardXp(List<Long> ids, int xpPerCharacter) {
        Set<Long> requestedIds = sanitizeRequestedIds(ids, xpPerCharacter);
        if (requestedIds.isEmpty()) {
            return new MutationResult(PartyMutationStatus.INVALID_INPUT, this);
        }
        AwardXpResult awardResult = applyXpToMatchingCharacters(requestedIds, xpPerCharacter);
        if (!awardResult.updatedAny()) {
            return new MutationResult(PartyMutationStatus.NOT_FOUND, this);
        }
        return new MutationResult(PartyMutationStatus.SUCCESS, new PartyRoster(nextCharacterId, awardResult.characters()));
    }

    private Set<Long> sanitizeRequestedIds(List<Long> ids, int xpPerCharacter) {
        if (ids == null || ids.isEmpty() || xpPerCharacter <= 0) {
            return Set.of();
        }
        Set<Long> requestedIds = new LinkedHashSet<>();
        for (Long id : ids) {
            if (id != null) {
                requestedIds.add(id);
            }
        }
        return requestedIds;
    }

    private AwardXpResult applyXpToMatchingCharacters(Set<Long> requestedIds, int xpPerCharacter) {
        boolean updatedAny = false;
        List<PartyCharacter> nextCharacters = new ArrayList<>(characters.size());
        for (PartyCharacter character : characters) {
            if (requestedIds.contains(character.id())) {
                nextCharacters.add(character.awardXp(xpPerCharacter));
                updatedAny = true;
            } else {
                nextCharacters.add(character);
            }
        }
        return new AwardXpResult(nextCharacters, updatedAny);
    }

    public MutationResult performRest(PartyRestType restType) {
        Objects.requireNonNull(restType, "restType");
        List<PartyCharacter> nextCharacters = new ArrayList<>(characters.size());
        for (PartyCharacter character : characters) {
            nextCharacters.add(character.isActive() ? character.afterRest(restType) : character);
        }
        return new MutationResult(PartyMutationStatus.SUCCESS, new PartyRoster(nextCharacterId, nextCharacters));
    }

    private int indexOf(long id) {
        for (int index = 0; index < characters.size(); index++) {
            if (characters.get(index).id() == id) {
                return index;
            }
        }
        return -1;
    }

    private boolean isValidDraft(partyAPI.CharacterDraft draft) {
        return draft != null
                && draft.name() != null
                && !draft.name().trim().isEmpty()
                && draft.level() >= 1
                && draft.level() <= 20
                && draft.passivePerception() >= 1
                && draft.passivePerception() <= 99
                && draft.armorClass() >= 1
                && draft.armorClass() <= 99;
    }

    public record MutationResult(
            PartyMutationStatus status,
            PartyRoster roster
    ) {
    }

    private record AwardXpResult(
            List<PartyCharacter> characters,
            boolean updatedAny
    ) {
    }
}
