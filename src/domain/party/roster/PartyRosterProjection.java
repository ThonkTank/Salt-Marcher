package src.domain.party.roster;

import java.util.Comparator;
import java.util.List;

public record PartyRosterProjection(
        List<PartyCharacter> activeMembers,
        List<PartyCharacter> reserveMembers,
        List<Integer> activeLevelsByComposition,
        int averageActiveLevel
) {
    public PartyRosterProjection {
        activeMembers = activeMembers == null ? List.of() : List.copyOf(activeMembers);
        reserveMembers = reserveMembers == null ? List.of() : List.copyOf(reserveMembers);
        activeLevelsByComposition = activeLevelsByComposition == null ? List.of() : List.copyOf(activeLevelsByComposition);
    }

    @Override
    public List<PartyCharacter> activeMembers() {
        return List.copyOf(activeMembers);
    }

    @Override
    public List<PartyCharacter> reserveMembers() {
        return List.copyOf(reserveMembers);
    }

    @Override
    public List<Integer> activeLevelsByComposition() {
        return List.copyOf(activeLevelsByComposition);
    }

    static PartyRosterProjection from(List<PartyCharacter> characters) {
        List<PartyCharacter> activeMembers = characters.stream()
                .filter(character -> character.membership().isActive())
                .sorted(Comparator.comparingLong(PartyCharacter::id))
                .toList();
        List<PartyCharacter> reserveMembers = characters.stream()
                .filter(character -> !character.membership().isActive())
                .sorted(Comparator.comparing((PartyCharacter character) -> character.identity().name(), String.CASE_INSENSITIVE_ORDER)
                        .thenComparingLong(PartyCharacter::id))
                .toList();
        List<Integer> activeLevels = activeMembers.stream()
                .sorted(Comparator.comparingInt((PartyCharacter character) -> character.progress().level())
                        .thenComparingLong(PartyCharacter::id))
                .map(character -> character.progress().level())
                .toList();
        int averageLevel = activeMembers.isEmpty()
                ? 1
                : (int) Math.round(activeMembers.stream()
                .mapToInt(character -> character.progress().level())
                .average()
                .orElse(1.0));
        return new PartyRosterProjection(activeMembers, reserveMembers, activeLevels, averageLevel);
    }
}
