package features.world.dungeonmap.model.geometry;

import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.Optional;
import java.util.Set;

/**
 * Orthogonal segment on the doubled dungeon grid.
 */
public record GridSegment2x(GridPoint2x start, GridPoint2x end) {

    public static final Comparator<GridSegment2x> SEGMENT_ORDER =
            Comparator.comparing(GridSegment2x::start, GridPoint2x.POINT_ORDER)
                    .thenComparing(GridSegment2x::end, GridPoint2x.POINT_ORDER);

    public GridSegment2x {
        GridPoint2x resolvedStart = start == null ? GridPoint2x.fromRaw(0, 0) : start;
        GridPoint2x resolvedEnd = end == null ? resolvedStart : end;
        if (resolvedStart.equals(resolvedEnd)) {
            throw new IllegalArgumentException("GridSegment2x requires distinct endpoints");
        }
        if (resolvedStart.x2() != resolvedEnd.x2() && resolvedStart.y2() != resolvedEnd.y2()) {
            throw new IllegalArgumentException("GridSegment2x must be axis-aligned");
        }
        if (GridPoint2x.POINT_ORDER.compare(resolvedStart, resolvedEnd) <= 0) {
            start = resolvedStart;
            end = resolvedEnd;
        } else {
            start = resolvedEnd;
            end = resolvedStart;
        }
    }

    public static GridSegment2x fromVertexEdge(VertexEdge edge) {
        VertexEdge resolvedEdge = edge == null
                ? new VertexEdge(new Point2i(0, 0), new Point2i(1, 0))
                : edge;
        return new GridSegment2x(
                GridPoint2x.fromVertex(resolvedEdge.start()),
                GridPoint2x.fromVertex(resolvedEdge.end()));
    }

    public static GridSegment2x betweenCellAndStep(Point2i fromCell, Point2i stepDelta) {
        return fromVertexEdge(VertexEdge.betweenCellAndStep(fromCell, stepDelta));
    }

    public boolean isHorizontal() {
        return start.y2() == end.y2();
    }

    public boolean isVertical() {
        return start.x2() == end.x2();
    }

    public int dx2() {
        return end.x2() - start.x2();
    }

    public int dy2() {
        return end.y2() - start.y2();
    }

    public int manhattanLength2() {
        return Math.abs(dx2()) + Math.abs(dy2());
    }

    public int minX2() {
        return Math.min(start.x2(), end.x2());
    }

    public int maxX2() {
        return Math.max(start.x2(), end.x2());
    }

    public int minY2() {
        return Math.min(start.y2(), end.y2());
    }

    public int maxY2() {
        return Math.max(start.y2(), end.y2());
    }

    public boolean touches(GridPoint2x point) {
        return point != null && (start.equals(point) || end.equals(point));
    }

    public boolean sharesEndpoint(GridSegment2x other) {
        return sharedEndpoint(other).isPresent();
    }

    public Optional<GridPoint2x> sharedEndpoint(GridSegment2x other) {
        if (other == null) {
            return Optional.empty();
        }
        if (touches(other.start)) {
            return Optional.of(other.start);
        }
        if (touches(other.end)) {
            return Optional.of(other.end);
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

    public GridSegment2x translatedByCells(Point2i delta) {
        return new GridSegment2x(start.translatedByCells(delta), end.translatedByCells(delta));
    }

    public GridPoint2x midpoint() {
        return GridPoint2x.fromRaw((start.x2() + end.x2()) / 2, (start.y2() + end.y2()) / 2);
    }

    public Set<Point2i> touchingCells() {
        if (!start.isVertex() || !end.isVertex() || manhattanLength2() != 2) {
            return Set.of();
        }
        LinkedHashSet<Point2i> cells = new LinkedHashSet<>();
        if (isHorizontal()) {
            int cellX = minX2() / 2;
            int boundaryY = start.y2() / 2;
            cells.add(new Point2i(cellX, boundaryY - 1));
            cells.add(new Point2i(cellX, boundaryY));
        } else {
            int boundaryX = start.x2() / 2;
            int cellY = minY2() / 2;
            cells.add(new Point2i(boundaryX - 1, cellY));
            cells.add(new Point2i(boundaryX, cellY));
        }
        return Set.copyOf(cells);
    }

    public Point2i directionFrom(Point2i cell) {
        if (cell == null || !touchingCells().contains(cell)) {
            return null;
        }
        if (isHorizontal()) {
            int cellBoundaryY = cell.y() * 2 + 1;
            return start.y2() < cellBoundaryY ? new Point2i(0, -1) : new Point2i(0, 1);
        }
        int cellBoundaryX = cell.x() * 2 + 1;
        return start.x2() < cellBoundaryX ? new Point2i(-1, 0) : new Point2i(1, 0);
    }

    public Optional<VertexEdge> toVertexEdge() {
        return start.toVertex()
                .flatMap(startVertex -> end.toVertex().map(endVertex -> new VertexEdge(startVertex, endVertex)));
    }
}
