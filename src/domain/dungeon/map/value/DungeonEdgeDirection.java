package src.domain.dungeon.map.value;

import java.util.Locale;

public enum DungeonEdgeDirection {
    NORTH(0, -1),
    EAST(1, 0),
    SOUTH(0, 1),
    WEST(-1, 0);

    private final int deltaQ;
    private final int deltaR;

    DungeonEdgeDirection(int deltaQ, int deltaR) {
        this.deltaQ = deltaQ;
        this.deltaR = deltaR;
    }

    public static DungeonEdgeDirection parse(String value) {
        if (value == null || value.isBlank()) {
            return NORTH;
        }
        return valueOf(value.trim().toUpperCase(Locale.ROOT));
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
}
