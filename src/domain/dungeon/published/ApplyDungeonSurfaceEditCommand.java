package src.domain.dungeon.published;

import org.jspecify.annotations.Nullable;

public record ApplyDungeonSurfaceEditCommand(
        @Nullable DungeonMapId mapId,
        @Nullable DungeonSurfaceEdit edit
) {
}
