package src.domain.dungeon.model.map.model;

import java.util.Locale;

public final class DungeonEdgeDirection {
    public static final DungeonEdgeDirection NORTH = new DungeonEdgeDirection("NORTH", 0, -1);
    public static final DungeonEdgeDirection EAST = new DungeonEdgeDirection("EAST", 1, 0);
    public static final DungeonEdgeDirection SOUTH = new DungeonEdgeDirection("SOUTH", 0, 1);
    public static final DungeonEdgeDirection WEST = new DungeonEdgeDirection("WEST", -1, 0);
    private static final DungeonEdgeDirection[] CARDINAL = {NORTH, EAST, SOUTH, WEST};

    private final String name;
    private final int deltaQ;
    private final int deltaR;

    private DungeonEdgeDirection(String name, int deltaQ, int deltaR) {
        this.name = name;
        this.deltaQ = deltaQ;
        this.deltaR = deltaR;
    }

    public static DungeonEdgeDirection parse(String value) {
        if (value == null || value.isBlank()) {
            return NORTH;
        }
        return valueOf(value.trim().toUpperCase(Locale.ROOT));
    }

    public static DungeonEdgeDirection fromCode(int code) {
        return switch (code) {
            case 1 -> EAST;
            case 2 -> SOUTH;
            case 3 -> WEST;
            default -> NORTH;
        };
    }

    public static DungeonEdgeDirection valueOf(String name) {
        return switch (name) {
            case "EAST" -> EAST;
            case "SOUTH" -> SOUTH;
            case "WEST" -> WEST;
            default -> NORTH;
        };
    }

    public static DungeonEdgeDirection[] values() {
        return CARDINAL.clone();
    }

    public DungeonCell neighborOf(DungeonCell cell) {
        if (cell == null) {
            return new DungeonCell(deltaQ, deltaR, 0);
        }
        return new DungeonCell(cell.q() + deltaQ, cell.r() + deltaR, cell.level());
    }

    public int deltaQ() {
        return deltaQ;
    }

    public int deltaR() {
        return deltaR;
    }

    public String name() {
        return name;
    }

    @Override
    public String toString() {
        return name;
    }
}
