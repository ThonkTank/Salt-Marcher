package features.world.dungeonmap.model.geometry;

import java.util.Comparator;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;

/**
 * Canonical doubled-grid point for the final parity contract.
 *
 * <p>Cell centers live on even/even coordinates, edge centers on mixed parity coordinates, and vertices on
 * odd/odd coordinates. During legacy freeze, productive callers still use {@link LegacyGridPoint2x} until those
 * flows are migrated onto this final contract.</p>
 */
public record GridPoint2x(int x2, int y2) {

    public static final Comparator<GridPoint2x> ORDER =
            Comparator.comparingInt(GridPoint2x::y2).thenComparingInt(GridPoint2x::x2);

    public enum Kind {
        CELL,
        EDGE,
        VERTEX
    }

    public static GridPoint2x raw(int x2, int y2) {
        return new GridPoint2x(x2, y2);
    }

    public static GridPoint2x cell(CellCoord cell) {
        CellCoord resolvedCell = Objects.requireNonNull(cell, "cell");
        return new GridPoint2x(resolvedCell.x() * 2, resolvedCell.y() * 2);
    }

    public static GridPoint2x edgeCenter(CellCoord cell, CardinalDirection dir) {
        CellCoord resolvedCell = Objects.requireNonNull(cell, "cell");
        CardinalDirection resolvedDirection = Objects.requireNonNull(dir, "dir");
        CellCoord delta = resolvedDirection.deltaCell();
        return cell(resolvedCell).offset2x(delta.x(), delta.y());
    }

    public static GridPoint2x vertex(CellCoord baseCell, int dx, int dy) {
        CellCoord resolvedCell = Objects.requireNonNull(baseCell, "baseCell");
        if ((dx != -1 && dx != 1) || (dy != -1 && dy != 1)) {
            throw new IllegalArgumentException("GridPoint2x.vertex requires dx/dy in {-1,+1}");
        }
        return cell(resolvedCell).offset2x(dx, dy);
    }

    public Kind kind() {
        boolean oddX = (x2 & 1) != 0;
        boolean oddY = (y2 & 1) != 0;
        if (!oddX && !oddY) {
            return Kind.CELL;
        }
        if (oddX && oddY) {
            return Kind.VERTEX;
        }
        return Kind.EDGE;
    }

    public boolean isCell() {
        return kind() == Kind.CELL;
    }

    public boolean isEdge() {
        return kind() == Kind.EDGE;
    }

    public boolean isVertex() {
        return kind() == Kind.VERTEX;
    }

    public Optional<CellCoord> asCell() {
        if (!isCell()) {
            return Optional.empty();
        }
        return Optional.of(new CellCoord(x2 / 2, y2 / 2));
    }

    public Set<CellCoord> touchingCells() {
        return switch (kind()) {
            case CELL -> Set.of(asCell().orElseThrow());
            case EDGE -> touchingCellsForEdge();
            case VERTEX -> touchingCellsForVertex();
        };
    }

    public GridPoint2x offset2x(int dx2, int dy2) {
        if (dx2 == 0 && dy2 == 0) {
            return this;
        }
        return new GridPoint2x(x2 + dx2, y2 + dy2);
    }

    public GridPoint2x translatedByCells(CellCoord delta) {
        CellCoord resolvedDelta = Objects.requireNonNull(delta, "delta");
        if (resolvedDelta.x() == 0 && resolvedDelta.y() == 0) {
            return this;
        }
        return new GridPoint2x(x2 + resolvedDelta.x() * 2, y2 + resolvedDelta.y() * 2);
    }

    public int manhattanDistance2x(GridPoint2x other) {
        GridPoint2x resolvedOther = Objects.requireNonNull(other, "other");
        return Math.abs(x2 - resolvedOther.x2) + Math.abs(y2 - resolvedOther.y2);
    }

    public long encodedKey() {
        return (((long) x2) << 32) ^ (y2 & 0xffffffffL);
    }

    private Set<CellCoord> touchingCellsForEdge() {
        if ((x2 & 1) != 0) {
            int cellY = y2 / 2;
            return Set.of(
                    new CellCoord((x2 - 1) / 2, cellY),
                    new CellCoord((x2 + 1) / 2, cellY));
        }
        int cellX = x2 / 2;
        return Set.of(
                new CellCoord(cellX, (y2 - 1) / 2),
                new CellCoord(cellX, (y2 + 1) / 2));
    }

    private Set<CellCoord> touchingCellsForVertex() {
        int westX = (x2 - 1) / 2;
        int eastX = (x2 + 1) / 2;
        int northY = (y2 - 1) / 2;
        int southY = (y2 + 1) / 2;
        return Set.of(
                new CellCoord(westX, northY),
                new CellCoord(eastX, northY),
                new CellCoord(westX, southY),
                new CellCoord(eastX, southY));
    }
}
