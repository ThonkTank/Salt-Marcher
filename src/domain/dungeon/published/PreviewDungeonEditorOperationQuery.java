package src.domain.dungeon.published;

import org.jspecify.annotations.Nullable;

public record PreviewDungeonEditorOperationQuery(
        @Nullable DungeonMapId mapId,
        DungeonEditorOperation operation
) {

    public PreviewDungeonEditorOperationQuery(DungeonEditorOperation operation) {
        this(null, operation);
    }
}
