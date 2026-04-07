package features.world.dungeon.geometry;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;

public final class GridSegment extends GridObject {

    public enum Orientation {
        HORIZONTAL,
        VERTICAL
    }

    public static final Comparator<GridSegment> ORDER = Comparator
            .comparing(GridSegment::start, GridPoint.ORDER)
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

    public static GridSegment boundaryEdge(GridPoint cell, CardinalDirection direction) {
        GridPoint resolvedCell = requireCell(cell);
        CardinalDirection resolvedDirection = Objects.requireNonNull(direction, "direction");
        GridPoint edgeCenter = GridPoint.lattice(
                resolvedCell.x2() + resolvedDirection.dxCells(),
                resolvedCell.y2() + resolvedDirection.dyCells(),
                resolvedCell.z());
        return switch (resolvedDirection) {
            case NORTH, SOUTH -> new GridSegment(
                    GridPoint.lattice(edgeCenter.x2() - 1, edgeCenter.y2(), edgeCenter.z()),
                    GridPoint.lattice(edgeCenter.x2() + 1, edgeCenter.y2(), edgeCenter.z()));
            case EAST, WEST -> new GridSegment(
                    GridPoint.lattice(edgeCenter.x2(), edgeCenter.y2() - 1, edgeCenter.z()),
                    GridPoint.lattice(edgeCenter.x2(), edgeCenter.y2() + 1, edgeCenter.z()));
        };
    }

    public GridPoint start() {
        return start;
    }

    public GridPoint end() {
        return end;
    }

    public Orientation orientation() {
        return start.y2() == end.y2() ? Orientation.HORIZONTAL : Orientation.VERTICAL;
    }

    public GridPoint midpoint() {
        return GridPoint.lattice((start.x2() + end.x2()) / 2, (start.y2() + end.y2()) / 2, start.z());
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

    public GridArea touchingCells() {
        return GridArea.of(touchingCellSet());
    }

    public GridBoundary boundarySteps() {
        return GridBoundary.of(stepSegments());
    }

    public CardinalDirection directionFrom(GridPoint cell) {
        GridPoint resolvedCell = requireCell(cell);
        Set<GridPoint> touchingCells = touchingCellSet();
        if (!touchingCells.contains(resolvedCell)) {
            return null;
        }
        return touchingCells.stream()
                .filter(candidate -> !candidate.equals(resolvedCell))
                .findFirst()
                .map(resolvedCell::cardinalDirectionTo)
                .orElse(null);
    }

    @Override
    public GridSegment translated(GridTranslation translation) {
        GridTranslation resolvedTranslation = translation == null ? GridTranslation.none() : translation;
        if (resolvedTranslation.isZero()) {
            return this;
        }
        return new GridSegment(start.translated(resolvedTranslation), end.translated(resolvedTranslation));
    }

    @Override
    public Set<Integer> levels() {
        return Set.of(start.z());
    }

    @Override
    public GridArea cellFootprint() {
        return touchingCells();
    }

    static Set<GridSegment> normalize(Collection<GridSegment> segments) {
        LinkedHashSet<GridSegment> result = new LinkedHashSet<>();
        if (segments != null) {
            segments.stream()
                    .filter(Objects::nonNull)
                    .sorted(ORDER)
                    .forEach(result::add);
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    boolean isBoundaryStep() {
        return start.kind() == GridPoint.Kind.VERTEX
                && end.kind() == GridPoint.Kind.VERTEX
                && length2() == 2;
    }

    List<GridSegment> stepSegments() {
        if (length2() == 2) {
            return List.of(this);
        }
        ArrayList<GridSegment> result = new ArrayList<>();
        if (orientation() == Orientation.HORIZONTAL) {
            for (int x2 = start.x2(); x2 < end.x2(); x2 += 2) {
                result.add(new GridSegment(
                        GridPoint.lattice(x2, start.y2(), start.z()),
                        GridPoint.lattice(x2 + 2, start.y2(), start.z())));
            }
        } else {
            for (int y2 = start.y2(); y2 < end.y2(); y2 += 2) {
                result.add(new GridSegment(
                        GridPoint.lattice(start.x2(), y2, start.z()),
                        GridPoint.lattice(start.x2(), y2 + 2, start.z())));
            }
        }
        return List.copyOf(result);
    }

    Set<GridPoint> touchingCellSet() {
        if (!isBoundaryStep()) {
            return Set.of();
        }
        return midpoint().touchingCells().cells();
    }

    private int length2() {
        return Math.abs(start.x2() - end.x2()) + Math.abs(start.y2() - end.y2());
    }

    private static GridPoint requireCell(GridPoint point) {
        GridPoint resolvedPoint = Objects.requireNonNull(point, "point");
        if (resolvedPoint.kind() != GridPoint.Kind.CELL) {
            throw new IllegalArgumentException("GridPoint must be a cell");
        }
        return resolvedPoint;
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
