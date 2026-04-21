package src.domain.dungeon.published;

import org.jspecify.annotations.Nullable;

public record ApplyDungeonEditorOperationCommand(
        @Nullable DungeonMapId mapId,
        DungeonEditorOperation operation
) {

    public ApplyDungeonEditorOperationCommand(DungeonEditorOperation operation) {
        this(null, operation);
    }
}
