package features.world.dungeonmap.model.geometry;

import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedHashSet;
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
        CellCoord resolvedCell = cell == null ? new CellCoord(0, 0) : cell;
        return new GridPoint2x(resolvedCell.x() * 2, resolvedCell.y() * 2);
    }

    public static GridPoint2x edgeCenter(CellCoord cell, CardinalDirection dir) {
        if (dir == null) {
            throw new IllegalArgumentException("GridPoint2x.edgeCenter requires a direction");
        }
        CellCoord resolvedCell = cell == null ? new CellCoord(0, 0) : cell;
        CellCoord delta = dir.deltaCell();
        return new GridPoint2x(resolvedCell.x() * 2 + delta.x(), resolvedCell.y() * 2 + delta.y());
    }

    public static GridPoint2x vertex(CellCoord baseCell, int dx, int dy) {
        if ((dx != -1 && dx != 1) || (dy != -1 && dy != 1)) {
            throw new IllegalArgumentException("GridPoint2x.vertex requires dx/dy in {-1,+1}");
        }
        CellCoord resolvedCell = baseCell == null ? new CellCoord(0, 0) : baseCell;
        return new GridPoint2x(resolvedCell.x() * 2 + dx, resolvedCell.y() * 2 + dy);
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
            case CELL -> asCell().map(Set::of).orElse(Set.of());
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
        CellCoord resolvedDelta = delta == null ? new CellCoord(0, 0) : delta;
        if (resolvedDelta.x() == 0 && resolvedDelta.y() == 0) {
            return this;
        }
        return new GridPoint2x(x2 + resolvedDelta.x() * 2, y2 + resolvedDelta.y() * 2);
    }

    public int manhattanDistance2x(GridPoint2x other) {
        return other == null ? Integer.MAX_VALUE : Math.abs(x2 - other.x2) + Math.abs(y2 - other.y2);
    }

    public long encodedKey() {
        return (((long) x2) << 32) ^ (y2 & 0xffffffffL);
    }

    private Set<CellCoord> touchingCellsForEdge() {
        LinkedHashSet<CellCoord> cells = new LinkedHashSet<>();
        if ((x2 & 1) != 0) {
            int cellY = y2 / 2;
            cells.add(new CellCoord((x2 - 1) / 2, cellY));
            cells.add(new CellCoord((x2 + 1) / 2, cellY));
        } else {
            int cellX = x2 / 2;
            cells.add(new CellCoord(cellX, (y2 - 1) / 2));
            cells.add(new CellCoord(cellX, (y2 + 1) / 2));
        }
        return immutableCells(cells);
    }

    private Set<CellCoord> touchingCellsForVertex() {
        int westX = (x2 - 1) / 2;
        int eastX = (x2 + 1) / 2;
        int northY = (y2 - 1) / 2;
        int southY = (y2 + 1) / 2;
        LinkedHashSet<CellCoord> cells = new LinkedHashSet<>();
        cells.add(new CellCoord(westX, northY));
        cells.add(new CellCoord(eastX, northY));
        cells.add(new CellCoord(westX, southY));
        cells.add(new CellCoord(eastX, southY));
        return immutableCells(cells);
    }

    private static Set<CellCoord> immutableCells(LinkedHashSet<CellCoord> cells) {
        if (cells.isEmpty()) {
            return Set.of();
        }
        return Collections.unmodifiableSet(cells);
    }
}
