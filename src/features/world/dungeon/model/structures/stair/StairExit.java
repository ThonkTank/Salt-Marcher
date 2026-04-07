package features.world.dungeon.model.structures.stair;

import features.world.dungeon.geometry.GridPoint;

public record StairExit(
        GridPoint cell,
        String label
) {
    public StairExit {
        cell = cell == null ? GridPoint.cell(0, 0, 0) : cell;
        if (cell.kind() != GridPoint.Kind.CELL) {
            throw new IllegalArgumentException("Treppenausgänge müssen Zellpunkte sein");
        }
        label = label == null || label.isBlank()
                ? "Ausgang z=" + cell.z() + " (" + (cell.x2() / 2) + "," + (cell.y2() / 2) + ")"
                : label.trim();
    }
}
