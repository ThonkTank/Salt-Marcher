package src.domain.dungeon.published;

import org.jspecify.annotations.Nullable;

public record LoadDungeonEditorQuery(
        @Nullable DungeonMapId mapId
) {
}
