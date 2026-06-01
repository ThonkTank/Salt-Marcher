package src.domain.dungeon.model.worldspace.model;

import java.util.Locale;
import src.domain.dungeon.model.core.model.geometry.Cell;
import src.domain.dungeon.model.core.model.geometry.Direction;

public enum DungeonEdgeDirection {
    NORTH(Direction.NORTH),
    EAST(Direction.EAST),
    SOUTH(Direction.SOUTH),
    WEST(Direction.WEST);

    private final Direction geometry;

    DungeonEdgeDirection(Direction geometry) {
        this.geometry = geometry;
    }

    public static DungeonEdgeDirection parse(String value) {
        if (value == null || value.isBlank()) {
            return NORTH;
        }
        return switch (value.trim().toUpperCase(Locale.ROOT)) {
            case "EAST" -> EAST;
            case "SOUTH" -> SOUTH;
            case "WEST" -> WEST;
            default -> NORTH;
        };
    }

    public static DungeonEdgeDirection fromCode(int code) {
        return switch (code) {
            case 1 -> EAST;
            case 2 -> SOUTH;
            case 3 -> WEST;
            default -> NORTH;
        };
    }

    public DungeonCell neighborOf(DungeonCell cell) {
        Cell geometryCell = cell == null ? new Cell(0, 0, 0) : cell.geometry();
        return DungeonCell.fromGeometry(geometry.neighborOf(geometryCell));
    }

    public int deltaQ() {
        return geometry.deltaQ();
    }

    public int deltaR() {
        return geometry.deltaR();
    }

    Direction geometry() {
        return geometry;
    }
}
