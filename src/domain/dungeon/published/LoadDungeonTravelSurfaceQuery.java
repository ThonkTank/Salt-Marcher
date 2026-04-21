package src.domain.dungeon.published;

import org.jspecify.annotations.Nullable;

public record LoadDungeonTravelSurfaceQuery(
        @Nullable DungeonTravelPosition position
) {
}
