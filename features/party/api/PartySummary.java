package features.party.api;

import org.jspecify.annotations.Nullable;

public record PartySummary(
        int activeCount,
        int reserveCount,
        @Nullable Integer averageLevel
) {
}
