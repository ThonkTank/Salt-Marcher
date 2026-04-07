package features.world.dungeon.model.structures.stair;

import features.world.dungeon.geometry.GridPoint;

public record StairExit(
        GridPoint position,
        String label
) {
    public StairExit {
        position = position == null ? GridPoint.cell(0, 0, 0) : position;
        label = label == null || label.isBlank()
                ? "Ausgang z=" + position.z() + " (" + (position.x2() / 2) + "," + (position.y2() / 2) + ")"
                : label.trim();
    }
}
