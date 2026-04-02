package features.world.dungeonmap.model.geometry;

import java.util.Comparator;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;

/**
 * Canonical doubled-grid segment for the final parity contract.
 */
public record GridSegment2x(GridPoint2x start, GridPoint2x end) {

    public static final Comparator<GridSegment2x> ORDER =
            Comparator.comparing(GridSegment2x::start, GridPoint2x.ORDER)
                    .thenComparing(GridSegment2x::end, GridPoint2x.ORDER);

    public GridSegment2x {
        GridPoint2x resolvedStart = Objects.requireNonNull(start, "start");
        GridPoint2x resolvedEnd = Objects.requireNonNull(end, "end");
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
        CellCoord resolvedCell = Objects.requireNonNull(cell, "cell");
        CardinalDirection resolvedDirection = Objects.requireNonNull(dir, "dir");
        GridPoint2x edgeCenter = GridPoint2x.edgeCenter(resolvedCell, resolvedDirection);
        return switch (resolvedDirection) {
            case NORTH, SOUTH -> new GridSegment2x(edgeCenter.offset2x(-1, 0), edgeCenter.offset2x(1, 0));
            case EAST, WEST -> new GridSegment2x(edgeCenter.offset2x(0, -1), edgeCenter.offset2x(0, 1));
        };
    }

    public static Set<GridSegment2x> boundarySteps(Collection<GridSegment2x> segments) {
        if (segments == null || segments.isEmpty()) {
            return Set.of();
        }
        LinkedHashSet<GridSegment2x> result = new LinkedHashSet<>();
        for (GridSegment2x segment : segments) {
            if (segment != null) {
                result.addAll(segment.boundarySteps());
            }
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    public boolean isHorizontal() {
        return start.y2() == end.y2();
    }

    public boolean isVertical() {
        return start.x2() == end.x2();
    }

    public int length2() {
        return start.manhattanDistance2x(end);
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
        CellCoord resolvedDelta = Objects.requireNonNull(delta, "delta");
        return new GridSegment2x(start.translatedByCells(resolvedDelta), end.translatedByCells(resolvedDelta));
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
        return touchingCells.stream()
                .filter(touchingCell -> !touchingCell.equals(cell))
                .findFirst()
                .map(cell::directionTo4)
                .orElse(null);
    }

    public Set<GridSegment2x> boundarySteps() {
        if (length2() == 2) {
            return Set.of(this);
        }
        LinkedHashSet<GridSegment2x> result = new LinkedHashSet<>();
        if (isHorizontal()) {
            int y2 = start.y2();
            for (int x2 = start.x2(); x2 < end.x2(); x2 += 2) {
                result.add(new GridSegment2x(GridPoint2x.raw(x2, y2), GridPoint2x.raw(x2 + 2, y2)));
            }
        } else {
            int x2 = start.x2();
            for (int y2 = start.y2(); y2 < end.y2(); y2 += 2) {
                result.add(new GridSegment2x(GridPoint2x.raw(x2, y2), GridPoint2x.raw(x2, y2 + 2)));
            }
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }
}
