package features.world.dungeonmap.model.geometry;

import java.util.Comparator;
import java.util.Optional;
import java.util.Set;

// Primitive undirected edge between two grid vertices. It owns local edge geometry, edge-to-edge relations,
// and tile-facing knowledge so path objects can stay focused on path topology.
public record VertexEdge(Point2i start, Point2i end) {

    public static final Comparator<VertexEdge> EDGE_ORDER =
            Comparator.comparing(VertexEdge::start, Point2i.POINT_ORDER).thenComparing(VertexEdge::end, Point2i.POINT_ORDER);

    public VertexEdge {
        Point2i resolvedStart = start == null ? new Point2i(0, 0) : start;
        Point2i resolvedEnd = end == null ? resolvedStart : end;
        if (Point2i.POINT_ORDER.compare(resolvedStart, resolvedEnd) <= 0) {
            start = resolvedStart;
            end = resolvedEnd;
        } else {
            start = resolvedEnd;
            end = resolvedStart;
        }
    }

    public boolean touches(Point2i point) {
        return start.equals(point) || end.equals(point);
    }

    public boolean touches(VertexEdge other) {
        return other != null && (touches(other.start) || touches(other.end));
    }

    public boolean sharesVertexWith(VertexEdge other) {
        return touches(other);
    }

    public Optional<Point2i> sharedVertex(VertexEdge other) {
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

    public Point2i other(Point2i point) {
        if (start.equals(point)) {
            return end;
        }
        if (end.equals(point)) {
            return start;
        }
        return null;
    }

    public boolean isHorizontal() {
        return start.y() == end.y();
    }

    public boolean isVertical() {
        return start.x() == end.x();
    }

    public int dx() {
        return end.x() - start.x();
    }

    public int dy() {
        return end.y() - start.y();
    }

    public int lengthManhattan() {
        return Math.abs(dx()) + Math.abs(dy());
    }

    public Point2i center() {
        return new Point2i((start.x() + end.x()) / 2, (start.y() + end.y()) / 2);
    }

    public int minX() {
        return Math.min(start.x(), end.x());
    }

    public int maxX() {
        return Math.max(start.x(), end.x());
    }

    public int minY() {
        return Math.min(start.y(), end.y());
    }

    public int maxY() {
        return Math.max(start.y(), end.y());
    }

    public boolean isCollinearWith(VertexEdge other) {
        if (other == null) {
            return false;
        }
        return (isHorizontal() && other.isHorizontal() && start.y() == other.start.y())
                || (isVertical() && other.isVertical() && start.x() == other.start.x());
    }

    public boolean canMergeWith(VertexEdge other) {
        return other != null
                && isCollinearWith(other)
                && sharedVertex(other).isPresent()
                && lengthManhattan() > 0
                && other.lengthManhattan() > 0;
    }

    public Optional<VertexEdge> mergedWith(VertexEdge other) {
        if (!canMergeWith(other)) {
            return Optional.empty();
        }
        Set<Point2i> points = Set.of(start, end, other.start, other.end);
        Point2i mergedStart = points.stream().min(Point2i.POINT_ORDER).orElse(start);
        Point2i mergedEnd = points.stream().max(Point2i.POINT_ORDER).orElse(end);
        return Optional.of(new VertexEdge(mergedStart, mergedEnd));
    }

    public boolean touches(Tile tile) {
        return tile != null && tile.vertices().contains(start) && tile.vertices().contains(end);
    }

    public boolean boundsTile(Tile tile) {
        return touches(tile);
    }

    public boolean touchesCell(Point2i cell) {
        return boundsTile(new Tile(cell));
    }

    public Set<Tile> touchingTiles() {
        if (isHorizontal()) {
            int y = start.y();
            int minX = Math.min(start.x(), end.x());
            int maxX = Math.max(start.x(), end.x());
            Set<Tile> result = new java.util.LinkedHashSet<>();
            for (int x = minX; x < maxX; x++) {
                result.add(new Tile(new Point2i(x, y - 1)));
                result.add(new Tile(new Point2i(x, y)));
            }
            return Set.copyOf(result);
        }
        if (isVertical()) {
            int x = start.x();
            int minY = Math.min(start.y(), end.y());
            int maxY = Math.max(start.y(), end.y());
            Set<Tile> result = new java.util.LinkedHashSet<>();
            for (int y = minY; y < maxY; y++) {
                result.add(new Tile(new Point2i(x - 1, y)));
                result.add(new Tile(new Point2i(x, y)));
            }
            return Set.copyOf(result);
        }
        return Set.of();
    }

    public Set<Point2i> touchingCells() {
        return Tile.positions(touchingTiles());
    }

    public Point2i directionFrom(Tile tile) {
        if (tile == null || !boundsTile(tile)) {
            return null;
        }
        if (isVertical()) {
            return tile.x() < start.x() ? new Point2i(1, 0) : new Point2i(-1, 0);
        }
        if (isHorizontal()) {
            return tile.y() < start.y() ? new Point2i(0, 1) : new Point2i(0, -1);
        }
        return null;
    }

    public Point2i directionFrom(Point2i cell) {
        return directionFrom(new Tile(cell));
    }

    public Optional<Tile> oppositeTile(Tile tile) {
        Point2i direction = directionFrom(tile);
        return direction == null ? Optional.empty() : Optional.of(tile.neighbor(direction));
    }

    public Optional<Point2i> oppositeCell(Point2i cell) {
        return oppositeTile(new Tile(cell)).map(Tile::position);
    }

    public boolean separates(Tile first, Tile second) {
        if (first == null || second == null || !first.isAdjacentTo(second)) {
            return false;
        }
        return first.sharedEdge(second).map(this::equals).orElse(false);
    }

    public boolean separates(Point2i firstCell, Point2i secondCell) {
        return separates(new Tile(firstCell), new Tile(secondCell));
    }

    public long encodedKey() {
        return Point2i.encode(start) * 31 + Point2i.encode(end);
    }

    public VertexEdge translated(Point2i delta) {
        return new VertexEdge(start.add(delta), end.add(delta));
    }

    public static VertexEdge betweenCellAndStep(Point2i fromCell, Point2i stepDelta) {
        Point2i origin = fromCell == null ? new Point2i(0, 0) : fromCell;
        Point2i delta = stepDelta == null ? new Point2i(0, 0) : stepDelta;
        return switch (delta.x() + "," + delta.y()) {
            case "0,-1" -> new VertexEdge(origin, origin.add(new Point2i(1, 0)));
            case "1,0" -> new VertexEdge(origin.add(new Point2i(1, 0)), origin.add(new Point2i(1, 1)));
            case "0,1" -> new VertexEdge(origin.add(new Point2i(0, 1)), origin.add(new Point2i(1, 1)));
            case "-1,0" -> new VertexEdge(origin, origin.add(new Point2i(0, 1)));
            default -> throw new IllegalArgumentException("Schritt ist keine Kardinalkante: " + delta);
        };
    }

    public static Optional<VertexEdge> betweenTiles(Tile first, Tile second) {
        if (first == null || second == null) {
            return Optional.empty();
        }
        return first.sharedEdge(second);
    }
}
