package features.party.api;

import java.util.List;

public record ActivePartyComposition(
        List<Integer> activePartyLevels,
        int averageLevel
) {
    public ActivePartyComposition {
        activePartyLevels = activePartyLevels == null ? List.of() : List.copyOf(activePartyLevels);
    }
}
