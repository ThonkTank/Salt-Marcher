package features.world.dungeonmap.model.geometry;

import java.util.Comparator;
import java.util.Optional;
import java.util.Set;

/**
 * Canonical doubled-grid segment for the final parity contract.
 *
 * <p>During legacy freeze, productive callers still use {@link LegacyGridSegment2x} until those flows migrate to
 * this final contract.</p>
 */
public record GridSegment2x(GridPoint2x start, GridPoint2x end) {

    public static final Comparator<GridSegment2x> ORDER =
            Comparator.comparing(GridSegment2x::start, GridPoint2x.ORDER)
                    .thenComparing(GridSegment2x::end, GridPoint2x.ORDER);

    public GridSegment2x {
        GridPoint2x resolvedStart = start == null ? GridPoint2x.raw(0, 0) : start;
        GridPoint2x resolvedEnd = end == null ? resolvedStart : end;
        if (resolvedStart.equals(resolvedEnd)) {
            throw new IllegalArgumentException("GridSegment2x requires distinct endpoints");
        }
        if (resolvedStart.x2() != resolvedEnd.x2() && resolvedStart.y2() != resolvedEnd.y2()) {
            throw new IllegalArgumentException("GridSegment2x must be axis-aligned");
        }
        if (GridPoint2x.ORDER.compare(resolvedStart, resolvedEnd) <= 0) {
            start = resolvedStart;
            end = resolvedEnd;
        } else {
            start = resolvedEnd;
            end = resolvedStart;
        }
    }

    public static GridSegment2x boundaryEdge(CellCoord cell, CardinalDirection dir) {
        if (dir == null) {
            throw new IllegalArgumentException("GridSegment2x.boundaryEdge requires a direction");
        }
        CellCoord resolvedCell = cell == null ? new CellCoord(0, 0) : cell;
        return switch (dir) {
            case NORTH -> new GridSegment2x(
                    GridPoint2x.vertex(resolvedCell, -1, -1),
                    GridPoint2x.vertex(resolvedCell, 1, -1));
            case EAST -> new GridSegment2x(
                    GridPoint2x.vertex(resolvedCell, 1, -1),
                    GridPoint2x.vertex(resolvedCell, 1, 1));
            case SOUTH -> new GridSegment2x(
                    GridPoint2x.vertex(resolvedCell, -1, 1),
                    GridPoint2x.vertex(resolvedCell, 1, 1));
            case WEST -> new GridSegment2x(
                    GridPoint2x.vertex(resolvedCell, -1, -1),
                    GridPoint2x.vertex(resolvedCell, -1, 1));
        };
    }

    public boolean isHorizontal() {
        return start.y2() == end.y2();
    }

    public boolean isVertical() {
        return start.x2() == end.x2();
    }

    public int length2() {
        return Math.abs(end.x2() - start.x2()) + Math.abs(end.y2() - start.y2());
    }

    public boolean sharesEndpoint(GridSegment2x other) {
        return sharedEndpoint(other).isPresent();
    }

    public Optional<GridPoint2x> sharedEndpoint(GridSegment2x other) {
        if (other == null) {
            return Optional.empty();
        }
        if (start.equals(other.start) || start.equals(other.end)) {
            return Optional.of(start);
        }
        if (end.equals(other.start) || end.equals(other.end)) {
            return Optional.of(end);
        }
        return Optional.empty();
    }

    public GridPoint2x otherEndpoint(GridPoint2x point) {
        if (start.equals(point)) {
            return end;
        }
        if (end.equals(point)) {
            return start;
        }
        return null;
    }

    public GridSegment2x translatedByCells(CellCoord delta) {
        return new GridSegment2x(start.translatedByCells(delta), end.translatedByCells(delta));
    }

    public GridPoint2x midpoint() {
        return GridPoint2x.raw((start.x2() + end.x2()) / 2, (start.y2() + end.y2()) / 2);
    }

    public boolean isBoundaryEdge() {
        return start.isVertex() && end.isVertex() && length2() == 2;
    }

    public Set<CellCoord> touchingCells() {
        if (!isBoundaryEdge()) {
            return Set.of();
        }
        return midpoint().touchingCells();
    }

    public CardinalDirection directionFrom(CellCoord cell) {
        if (cell == null) {
            return null;
        }
        Set<CellCoord> touchingCells = touchingCells();
        if (!touchingCells.contains(cell)) {
            return null;
        }
        for (CellCoord touchingCell : touchingCells) {
            if (!touchingCell.equals(cell)) {
                return cell.directionTo4(touchingCell);
            }
        }
        return null;
    }
}
