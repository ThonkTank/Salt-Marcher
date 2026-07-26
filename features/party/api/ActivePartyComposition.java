package features.party.api;

import java.util.List;
import org.jspecify.annotations.Nullable;

public record ActivePartyComposition(
        List<Integer> activePartyLevels,
        @Nullable Integer averageLevel
) {
    public ActivePartyComposition {
        activePartyLevels = activePartyLevels == null ? List.of() : List.copyOf(activePartyLevels);
    }
}
