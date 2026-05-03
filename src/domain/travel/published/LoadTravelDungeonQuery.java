package src.domain.travel.published;

import org.jspecify.annotations.Nullable;

public record LoadTravelDungeonQuery(
        @Nullable TravelDungeonPosition position
) {
}
