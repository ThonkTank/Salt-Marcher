package src.domain.dungeon.published;

import org.jspecify.annotations.Nullable;

public record DungeonSurfaceEdit(
        @Nullable DungeonEditorOperation operation
) {
}
