package features.sessiongeneration.domain.generation;

import java.math.BigDecimal;
import java.util.List;
import java.util.OptionalInt;

public record GenerationInput(
        List<GeneratedRun.PartyLevel> party,
        BigDecimal adventureDayFraction,
        OptionalInt encounterCount,
        long seed
) {

    public GenerationInput {
        party = List.copyOf(party);
    }
}
