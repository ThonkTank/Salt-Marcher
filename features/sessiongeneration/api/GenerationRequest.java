package features.sessiongeneration.api;

import java.math.BigDecimal;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.OptionalInt;

public record GenerationRequest(
        GenerationPreparationIdentity preparationIdentity,
        List<PartyLevel> party,
        BigDecimal adventureDayFraction,
        OptionalInt encounterCount,
        long seed
) {

    public GenerationRequest {
        preparationIdentity = Objects.requireNonNull(preparationIdentity, "preparationIdentity");
        party = List.copyOf(Objects.requireNonNull(party, "party")).stream()
                .sorted(Comparator.comparingInt(PartyLevel::level))
                .toList();
        adventureDayFraction = Objects.requireNonNull(adventureDayFraction, "adventureDayFraction");
        encounterCount = Objects.requireNonNull(encounterCount, "encounterCount");
        if (party.isEmpty()) {
            throw new IllegalArgumentException("party must not be empty");
        }
        if (party.stream().map(PartyLevel::level).distinct().count() != party.size()) {
            throw new IllegalArgumentException("party levels must be unique");
        }
        if (party.stream().mapToInt(PartyLevel::players).sum() <= 0) {
            throw new IllegalArgumentException("party must contain at least one player");
        }
        if (adventureDayFraction.compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException("adventure day fraction must not be negative");
        }
        if (encounterCount.isPresent()
                && (encounterCount.getAsInt() < 1 || encounterCount.getAsInt() > 10)) {
            throw new IllegalArgumentException("encounter count must be between 1 and 10");
        }
    }

    public record PartyLevel(int level, int players) {

        public PartyLevel {
            if (level < 1 || level > 20) {
                throw new IllegalArgumentException("party level must be between 1 and 20");
            }
            if (players < 0) {
                throw new IllegalArgumentException("player count must not be negative");
            }
        }
    }
}
