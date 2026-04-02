package features.world.dungeonmap.model.geometry;

import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.Optional;
import java.util.Set;

/**
 * Frozen copy of the pre-parity GridSegment2x semantics during the legacy-freeze migration.
 */
public record LegacyGridSegment2x(LegacyGridPoint2x start, LegacyGridPoint2x end) {

    public static final Comparator<LegacyGridSegment2x> SEGMENT_ORDER =
            Comparator.comparing(LegacyGridSegment2x::start, LegacyGridPoint2x.POINT_ORDER)
                    .thenComparing(LegacyGridSegment2x::end, LegacyGridPoint2x.POINT_ORDER);

    public LegacyGridSegment2x {
        LegacyGridPoint2x resolvedStart = start == null ? LegacyGridPoint2x.fromRaw(0, 0) : start;
        LegacyGridPoint2x resolvedEnd = end == null ? resolvedStart : end;
        if (resolvedStart.equals(resolvedEnd)) {
            throw new IllegalArgumentException("LegacyGridSegment2x requires distinct endpoints");
        }
        if (resolvedStart.x2() != resolvedEnd.x2() && resolvedStart.y2() != resolvedEnd.y2()) {
            throw new IllegalArgumentException("LegacyGridSegment2x must be axis-aligned");
        }
        if (LegacyGridPoint2x.POINT_ORDER.compare(resolvedStart, resolvedEnd) <= 0) {
            start = resolvedStart;
            end = resolvedEnd;
        } else {
            start = resolvedEnd;
            end = resolvedStart;
        }
    }

    public static LegacyGridSegment2x betweenCellAndStep(Point2i fromCell, Point2i stepDelta) {
        return betweenCellAndStep(CellCoord.fromPoint(fromCell), CellCoord.fromPoint(stepDelta));
    }

    public static LegacyGridSegment2x betweenCellAndStep(CellCoord fromCell, CellCoord stepDelta) {
        CellCoord origin = fromCell == null ? new CellCoord(0, 0) : fromCell;
        CellCoord delta = stepDelta == null ? new CellCoord(0, 0) : stepDelta;
        LegacyGridPoint2x origin2x = LegacyGridPoint2x.fromRaw(origin.x() * 2, origin.y() * 2);
        return switch (delta.x() + "," + delta.y()) {
            case "0,-1" -> new LegacyGridSegment2x(origin2x, origin2x.offset(2, 0));
            case "1,0" -> new LegacyGridSegment2x(origin2x.offset(2, 0), origin2x.offset(2, 2));
            case "0,1" -> new LegacyGridSegment2x(origin2x.offset(0, 2), origin2x.offset(2, 2));
            case "-1,0" -> new LegacyGridSegment2x(origin2x, origin2x.offset(0, 2));
            default -> throw new IllegalArgumentException("Schritt ist keine Kardinalkante: " + delta);
        };
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

    public boolean touches(LegacyGridPoint2x point) {
        return point != null && (start.equals(point) || end.equals(point));
    }

    public boolean sharesEndpoint(LegacyGridSegment2x other) {
        return sharedEndpoint(other).isPresent();
    }

    public Optional<LegacyGridPoint2x> sharedEndpoint(LegacyGridSegment2x other) {
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

    public LegacyGridPoint2x otherEndpoint(LegacyGridPoint2x point) {
        if (start.equals(point)) {
            return end;
        }
        if (end.equals(point)) {
            return start;
        }
        return null;
    }

    public LegacyGridSegment2x translatedByCells(Point2i delta) {
        return translatedByCells(CellCoord.fromPoint(delta));
    }

    public LegacyGridSegment2x translatedByCells(CellCoord delta) {
        return new LegacyGridSegment2x(start.translatedByCells(delta), end.translatedByCells(delta));
    }

    public LegacyGridPoint2x midpoint() {
        return LegacyGridPoint2x.fromRaw((start.x2() + end.x2()) / 2, (start.y2() + end.y2()) / 2);
    }

    public Set<Point2i> touchingCells() {
        return CellCoord.toPoints(touchingCellCoords());
    }

    public Set<CellCoord> touchingCellCoords() {
        if (!start.isVertex() || !end.isVertex() || manhattanLength2() != 2) {
            return Set.of();
        }
        LinkedHashSet<CellCoord> cells = new LinkedHashSet<>();
        if (isHorizontal()) {
            int cellX = minX2() / 2;
            int boundaryY = start.y2() / 2;
            cells.add(new CellCoord(cellX, boundaryY - 1));
            cells.add(new CellCoord(cellX, boundaryY));
        } else {
            int boundaryX = start.x2() / 2;
            int cellY = minY2() / 2;
            cells.add(new CellCoord(boundaryX - 1, cellY));
            cells.add(new CellCoord(boundaryX, cellY));
        }
        return Set.copyOf(cells);
    }

    public CardinalDirection directionFrom(CellCoord cell) {
        if (cell == null || !touchingCellCoords().contains(cell)) {
            return null;
        }
        if (isHorizontal()) {
            int cellBoundaryY = cell.y() * 2 + 1;
            return start.y2() < cellBoundaryY ? CardinalDirection.NORTH : CardinalDirection.SOUTH;
        }
        int cellBoundaryX = cell.x() * 2 + 1;
        return start.x2() < cellBoundaryX ? CardinalDirection.WEST : CardinalDirection.EAST;
    }

    public Point2i directionFrom(Point2i cell) {
        if (cell == null) {
            return null;
        }
        CardinalDirection direction = directionFrom(CellCoord.fromPoint(cell));
        return direction == null ? null : direction.deltaPoint2i();
    }
}
