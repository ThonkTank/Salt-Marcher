package src.domain.party.entity;

import src.domain.party.valueobject.PartyMembership;

import java.util.Comparator;
import java.util.List;

public record PartyRosterProjection(
        List<PartyCharacter> activeMembers,
        List<PartyCharacter> reserveMembers,
        List<Integer> activeLevelsByComposition,
        int averageActiveLevel
) {
    static PartyRosterProjection from(List<PartyCharacter> characters) {
        List<PartyCharacter> activeMembers = characters.stream()
                .filter(character -> character.membership() == PartyMembership.ACTIVE)
                .sorted(Comparator.comparingLong(PartyCharacter::id))
                .toList();
        List<PartyCharacter> reserveMembers = characters.stream()
                .filter(character -> character.membership() != PartyMembership.ACTIVE)
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
