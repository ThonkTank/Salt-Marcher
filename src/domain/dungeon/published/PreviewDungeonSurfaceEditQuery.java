package src.domain.dungeon.published;

import org.jspecify.annotations.Nullable;

public record PreviewDungeonSurfaceEditQuery(
        @Nullable DungeonMapId mapId,
        @Nullable DungeonSurfaceEdit edit
) {
}
