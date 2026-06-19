package src.features.dungeon.runtime;

import java.util.Objects;

public record DungeonEditorRuntimePublication(DungeonEditorRenderFrame frame) {
    public DungeonEditorRuntimePublication {
        frame = Objects.requireNonNull(frame, "frame");
    }

    public static DungeonEditorRuntimePublication published(DungeonEditorRenderFrame frame) {
        return new DungeonEditorRuntimePublication(frame);
    }
}
