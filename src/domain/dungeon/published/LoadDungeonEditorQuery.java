package src.domain.dungeon.published;

import org.jspecify.annotations.Nullable;

public record LoadDungeonEditorQuery(
        @Nullable DungeonMapId mapId,
        int projectionLevel,
        String viewModeKey
) {

    public LoadDungeonEditorQuery {
        viewModeKey = viewModeKey == null || viewModeKey.isBlank() ? "GRID" : viewModeKey.trim();
    }
}
