package src.domain.dungeon.model.map.model;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

public final class DungeonEdge {
    private final DungeonCell from;
    private final DungeonCell to;

    public DungeonEdge(
            DungeonCell from,
            DungeonCell to
    ) {
        this.from = from;
        this.to = to;
    }

    public DungeonCell from() {
        return from;
    }

    public DungeonCell to() {
        return to;
    }

    public static DungeonEdge sideOf(DungeonCell cell, DungeonEdgeDirection direction) {
        DungeonCell origin = cell == null ? new DungeonCell(0, 0, 0) : cell;
        DungeonEdgeDirection resolvedDirection = direction == null ? DungeonEdgeDirection.NORTH : direction;
        if (resolvedDirection == DungeonEdgeDirection.NORTH) {
            return new DungeonEdge(origin, offset(origin, 1, 0));
        }
        if (resolvedDirection == DungeonEdgeDirection.EAST) {
            return new DungeonEdge(offset(origin, 1, 0), offset(origin, 1, 1));
        }
        if (resolvedDirection == DungeonEdgeDirection.SOUTH) {
            return new DungeonEdge(offset(origin, 0, 1), offset(origin, 1, 1));
        }
        return new DungeonEdge(origin, offset(origin, 0, 1));
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

    @Override
    public boolean equals(Object other) {
        return other instanceof DungeonEdge that
                && Objects.equals(from, that.from)
                && Objects.equals(to, that.to);
    }

    @Override
    public int hashCode() {
        return Objects.hash(from, to);
    }

    @Override
    public String toString() {
        return "DungeonEdge[from=" + from + ", to=" + to + "]";
    }
}
