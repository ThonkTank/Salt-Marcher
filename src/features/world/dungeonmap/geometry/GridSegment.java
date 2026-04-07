package features.world.dungeonmap.geometry;

import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;

public final class GridSegment extends GridObject {

    public static final Comparator<GridSegment> ORDER =
            Comparator.comparing(GridSegment::start, GridPoint.ORDER)
                    .thenComparing(GridSegment::end, GridPoint.ORDER);

    private final GridPoint start;
    private final GridPoint end;

    public GridSegment(GridPoint start, GridPoint end) {
        GridPoint resolvedStart = Objects.requireNonNull(start, "start");
        GridPoint resolvedEnd = Objects.requireNonNull(end, "end");
        if (resolvedStart.equals(resolvedEnd)) {
            throw new IllegalArgumentException("GridSegment requires distinct endpoints");
        }
        if (resolvedStart.z() != resolvedEnd.z()) {
            throw new IllegalArgumentException("GridSegment endpoints must lie on the same level");
        }
        if (resolvedStart.x2() != resolvedEnd.x2() && resolvedStart.y2() != resolvedEnd.y2()) {
            throw new IllegalArgumentException("GridSegment must be axis-aligned");
        }
        if (GridPoint.ORDER.compare(resolvedStart, resolvedEnd) <= 0) {
            this.start = resolvedStart;
            this.end = resolvedEnd;
        } else {
            this.start = resolvedEnd;
            this.end = resolvedStart;
        }
    }

    public static GridSegment boundaryEdge(GridPoint cell, CardinalDirection dir) {
        GridPoint resolvedCell = GridPoint.cell(Objects.requireNonNull(cell, "cell"));
        CardinalDirection resolvedDirection = Objects.requireNonNull(dir, "dir");
        GridPoint edgeCenter = GridPoint.edgeCenter(resolvedCell, resolvedDirection);
        return switch (resolvedDirection) {
            case NORTH, SOUTH -> new GridSegment(edgeCenter.offset2x(-1, 0), edgeCenter.offset2x(1, 0));
            case EAST, WEST -> new GridSegment(edgeCenter.offset2x(0, -1), edgeCenter.offset2x(0, 1));
        };
    }

    public static Set<GridSegment> boundarySteps(Collection<GridSegment> segments) {
        if (segments == null || segments.isEmpty()) {
            return Set.of();
        }
        LinkedHashSet<GridSegment> result = new LinkedHashSet<>();
        for (GridSegment segment : segments) {
            if (segment != null) {
                result.addAll(segment.boundarySteps());
            }
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    public GridPoint start() {
        return start;
    }

    public GridPoint end() {
        return end;
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

    public boolean sharesEndpoint(GridSegment other) {
        return sharedEndpoint(other).isPresent();
    }

    public Optional<GridPoint> sharedEndpoint(GridSegment other) {
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

    public GridPoint otherEndpoint(GridPoint point) {
        if (start.equals(point)) {
            return end;
        }
        if (end.equals(point)) {
            return start;
        }
        return null;
    }

    @Override
    public GridSegment translatedByCells(int dx, int dy, int dz) {
        return new GridSegment(start.translatedByCells(dx, dy, dz), end.translatedByCells(dx, dy, dz));
    }

    public GridSegment translatedByCells(GridPoint delta) {
        GridPoint resolvedDelta = delta == null ? new GridPoint(0, 0) : delta;
        return translatedByCells(resolvedDelta.x(), resolvedDelta.y(), resolvedDelta.z());
    }

    public GridPoint midpoint() {
        return GridPoint.raw((start.x2() + end.x2()) / 2, (start.y2() + end.y2()) / 2, start.z());
    }

    public boolean isBoundaryEdge() {
        return start.isVertex() && end.isVertex() && length2() == 2;
    }

    public Set<GridPoint> touchingCells() {
        if (!isBoundaryEdge()) {
            return Set.of();
        }
        return midpoint().touchingCells();
    }

    public CardinalDirection directionFrom(GridPoint cell) {
        if (cell == null) {
            return null;
        }
        Set<GridPoint> touchingCells = touchingCells();
        if (!touchingCells.contains(cell)) {
            return null;
        }
        return touchingCells.stream()
                .filter(touchingCell -> !touchingCell.equals(cell))
                .findFirst()
                .map(cell::directionTo4)
                .orElse(null);
    }

    public Set<GridSegment> boundarySteps() {
        if (length2() == 2) {
            return Set.of(this);
        }
        LinkedHashSet<GridSegment> result = new LinkedHashSet<>();
        if (isHorizontal()) {
            int y2 = start.y2();
            for (int x2 = start.x2(); x2 < end.x2(); x2 += 2) {
                result.add(new GridSegment(GridPoint.raw(x2, y2, start.z()), GridPoint.raw(x2 + 2, y2, start.z())));
            }
        } else {
            int x2 = start.x2();
            for (int y2 = start.y2(); y2 < end.y2(); y2 += 2) {
                result.add(new GridSegment(GridPoint.raw(x2, y2, start.z()), GridPoint.raw(x2, y2 + 2, start.z())));
            }
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    @Override
    public Set<Integer> levels() {
        return Set.of(start.z());
    }

    @Override
    public GridArea cellFootprint() {
        return new GridArea(touchingCells());
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof GridSegment segment)) {
            return false;
        }
        return start.equals(segment.start) && end.equals(segment.end);
    }

    @Override
    public int hashCode() {
        return Objects.hash(start, end);
    }

    @Override
    public String toString() {
        return "GridSegment[start=" + start + ", end=" + end + "]";
    }
}
