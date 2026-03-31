package features.world.dungeonmap.shell.editor.interaction;

import features.world.dungeonmap.model.geometry.Point2i;

import java.util.Objects;

public record DungeonEditorFloorCellHitTarget(
        Point2i cell,
        long priority
) implements DungeonEditorHitTarget {

    public DungeonEditorFloorCellHitTarget {
        cell = Objects.requireNonNull(cell, "cell");
    }

    @Override
    public String targetKey() {
        return "";
    }
}
