package features.world.dungeonmap.model.geometry;

import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.Objects;
import java.util.Optional;
import java.util.Collection;
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

    public static GridSegment2x fromLegacyBoundaryEdge(LegacyGridSegment2x segment) {
        LegacyGridSegment2x resolvedSegment = Objects.requireNonNull(segment, "segment");
        if (resolvedSegment.manhattanLength2() != 2) {
            throw new IllegalArgumentException("Legacy boundary edge must have length2 == 2");
        }
        Set<CellCoord> touchingCells = resolvedSegment.touchingCellCoords();
        if (touchingCells.size() != 2) {
            throw new IllegalArgumentException("Legacy boundary edge must touch exactly two cells");
        }
        CellCoord baseCell = touchingCells.stream()
                .sorted(CellCoord.ORDER)
                .findFirst()
                .orElseThrow();
        CardinalDirection direction = resolvedSegment.directionFrom(baseCell);
        if (direction == null) {
            throw new IllegalArgumentException("Legacy boundary edge direction could not be resolved");
        }
        return boundaryEdge(baseCell, direction);
    }

    public static Set<GridSegment2x> fromLegacyBoundaryEdges(Collection<LegacyGridSegment2x> segments) {
        if (segments == null || segments.isEmpty()) {
            return Set.of();
        }
        LinkedHashSet<GridSegment2x> result = new LinkedHashSet<>();
        for (LegacyGridSegment2x segment : segments) {
            if (segment == null) {
                continue;
            }
            result.addAll(splitLegacyBoundaryEdges(segment));
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

    public LegacyGridSegment2x toLegacyBoundaryEdge() {
        if (!isBoundaryEdge()) {
            throw new IllegalArgumentException("Only boundary edges can be translated to legacy odd/odd segments");
        }
        CellCoord baseCell = touchingCells().stream()
                .sorted(CellCoord.ORDER)
                .findFirst()
                .orElseThrow();
        CardinalDirection direction = directionFrom(baseCell);
        if (direction == null) {
            throw new IllegalArgumentException("Boundary edge direction could not be resolved");
        }
        return LegacyGridSegment2x.betweenCellAndStep(baseCell, direction.delta());
    }

    private static Set<GridSegment2x> splitLegacyBoundaryEdges(LegacyGridSegment2x segment) {
        if (segment.manhattanLength2() == 2) {
            return Set.of(fromLegacyBoundaryEdge(segment));
        }
        LinkedHashSet<GridSegment2x> result = new LinkedHashSet<>();
        if (segment.isHorizontal()) {
            int y2 = segment.start().y2();
            for (int x2 = segment.minX2(); x2 < segment.maxX2(); x2 += 2) {
                result.add(fromLegacyBoundaryEdge(new LegacyGridSegment2x(
                        LegacyGridPoint2x.fromRaw(x2, y2),
                        LegacyGridPoint2x.fromRaw(x2 + 2, y2))));
            }
        } else {
            int x2 = segment.start().x2();
            for (int y2 = segment.minY2(); y2 < segment.maxY2(); y2 += 2) {
                result.add(fromLegacyBoundaryEdge(new LegacyGridSegment2x(
                        LegacyGridPoint2x.fromRaw(x2, y2),
                        LegacyGridPoint2x.fromRaw(x2, y2 + 2))));
            }
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }
}
