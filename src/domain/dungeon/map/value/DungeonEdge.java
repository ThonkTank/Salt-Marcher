package src.domain.dungeon.map.value;

import java.util.ArrayList;
import java.util.List;

public record DungeonEdge(
        DungeonCell from,
        DungeonCell to
) {

    public static DungeonEdge sideOf(DungeonCell cell, DungeonEdgeDirection direction) {
        DungeonCell origin = cell == null ? new DungeonCell(0, 0, 0) : cell;
        DungeonEdgeDirection resolvedDirection = direction == null ? DungeonEdgeDirection.NORTH : direction;
        return switch (resolvedDirection) {
            case NORTH -> new DungeonEdge(origin, offset(origin, 1, 0));
            case EAST -> new DungeonEdge(offset(origin, 1, 0), offset(origin, 1, 1));
            case SOUTH -> new DungeonEdge(offset(origin, 0, 1), offset(origin, 1, 1));
            case WEST -> new DungeonEdge(origin, offset(origin, 0, 1));
        };
    }

    public List<DungeonCell> touchingCells() {
        if (from == null || to == null || from.level() != to.level()) {
            return List.of();
        }
        if (from.r() == to.r()) {
            return horizontalTouchingCells();
        }
        if (from.q() == to.q()) {
            return verticalTouchingCells();
        }
        return List.of();
    }

    private List<DungeonCell> horizontalTouchingCells() {
        int minQ = Math.min(from.q(), to.q());
        int maxQ = Math.max(from.q(), to.q());
        List<DungeonCell> result = new ArrayList<>();
        for (int q = minQ; q < maxQ; q++) {
            result.add(new DungeonCell(q, from.r() - 1, from.level()));
            result.add(new DungeonCell(q, from.r(), from.level()));
        }
        return List.copyOf(result);
    }

    private List<DungeonCell> verticalTouchingCells() {
        int minR = Math.min(from.r(), to.r());
        int maxR = Math.max(from.r(), to.r());
        List<DungeonCell> result = new ArrayList<>();
        for (int r = minR; r < maxR; r++) {
            result.add(new DungeonCell(from.q() - 1, r, from.level()));
            result.add(new DungeonCell(from.q(), r, from.level()));
        }
        return List.copyOf(result);
    }

    private static DungeonCell offset(DungeonCell cell, int deltaQ, int deltaR) {
        return new DungeonCell(cell.q() + deltaQ, cell.r() + deltaR, cell.level());
    }
}
