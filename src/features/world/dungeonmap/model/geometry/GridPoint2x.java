package features.world.dungeonmap.model.geometry;

import java.util.Comparator;
import java.util.Optional;

/**
 * Explicit coordinate on the doubled dungeon grid.
 *
 * <p>This is the shared 2x language for tile centers, edge centers, and vertices. It deliberately keeps no
 * dungeon semantics beyond parity classification.</p>
 */
public record GridPoint2x(int x2, int y2) {

    public static final Comparator<GridPoint2x> POINT_ORDER =
            Comparator.comparingInt(GridPoint2x::y2).thenComparingInt(GridPoint2x::x2);

    public enum Kind {
        TILE_CENTER,
        VERTEX,
        EDGE_CENTER
    }

    public static GridPoint2x fromRaw(int x2, int y2) {
        return new GridPoint2x(x2, y2);
    }

    public static GridPoint2x fromRaw(Point2i point) {
        Point2i resolvedPoint = point == null ? new Point2i(0, 0) : point;
        return new GridPoint2x(resolvedPoint.x(), resolvedPoint.y());
    }

    public static GridPoint2x fromTileCenter(Point2i cell) {
        Point2i resolvedCell = cell == null ? new Point2i(0, 0) : cell;
        return new GridPoint2x(resolvedCell.x() * 2 + 1, resolvedCell.y() * 2 + 1);
    }

    public static GridPoint2x fromVertex(Point2i vertex) {
        Point2i resolvedVertex = vertex == null ? new Point2i(0, 0) : vertex;
        return new GridPoint2x(resolvedVertex.x() * 2, resolvedVertex.y() * 2);
    }

    public static GridPoint2x fromEdge(VertexEdge edge) {
        VertexEdge resolvedEdge = edge == null
                ? new VertexEdge(new Point2i(0, 0), new Point2i(1, 0))
                : edge;
        return new GridPoint2x(
                resolvedEdge.start().x() + resolvedEdge.end().x(),
                resolvedEdge.start().y() + resolvedEdge.end().y());
    }

    public Kind kind() {
        boolean oddX = (x2 & 1) == 1;
        boolean oddY = (y2 & 1) == 1;
        if (oddX && oddY) {
            return Kind.TILE_CENTER;
        }
        if (!oddX && !oddY) {
            return Kind.VERTEX;
        }
        return Kind.EDGE_CENTER;
    }

    public boolean isTileCenter() {
        return kind() == Kind.TILE_CENTER;
    }

    public boolean isVertex() {
        return kind() == Kind.VERTEX;
    }

    public boolean isEdgeCenter() {
        return kind() == Kind.EDGE_CENTER;
    }

    public Point2i toRawPoint2i() {
        return new Point2i(x2, y2);
    }

    public Optional<Point2i> toCellCenter() {
        if (!isTileCenter()) {
            return Optional.empty();
        }
        return Optional.of(new Point2i((x2 - 1) / 2, (y2 - 1) / 2));
    }

    public Optional<Point2i> toVertex() {
        if (!isVertex()) {
            return Optional.empty();
        }
        return Optional.of(new Point2i(x2 / 2, y2 / 2));
    }

    public GridPoint2x offset(int dx2, int dy2) {
        if (dx2 == 0 && dy2 == 0) {
            return this;
        }
        return new GridPoint2x(x2 + dx2, y2 + dy2);
    }

    public GridPoint2x translatedByCells(Point2i delta) {
        Point2i resolvedDelta = delta == null ? new Point2i(0, 0) : delta;
        if (resolvedDelta.x() == 0 && resolvedDelta.y() == 0) {
            return this;
        }
        return new GridPoint2x(x2 + resolvedDelta.x() * 2, y2 + resolvedDelta.y() * 2);
    }

    public int distanceTo(GridPoint2x other) {
        return other == null ? Integer.MAX_VALUE : Math.abs(x2 - other.x2) + Math.abs(y2 - other.y2);
    }

    public long encodedKey() {
        return (((long) x2) << 32) ^ (y2 & 0xffffffffL);
    }
}
