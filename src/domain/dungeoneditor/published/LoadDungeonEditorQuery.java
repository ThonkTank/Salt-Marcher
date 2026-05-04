package src.domain.dungeoneditor.published;

import org.jspecify.annotations.Nullable;

public record LoadDungeonEditorQuery(
        @Nullable DungeonEditorMapId mapId
) {
}
