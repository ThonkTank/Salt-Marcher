package features.world.dungeonmap.model.geometry;

import java.util.Comparator;
import java.util.Optional;

/**
 * Frozen copy of the pre-parity GridPoint2x semantics during the legacy-freeze migration.
 */
public record LegacyGridPoint2x(int x2, int y2) {

    public static final Comparator<LegacyGridPoint2x> POINT_ORDER =
            Comparator.comparingInt(LegacyGridPoint2x::y2).thenComparingInt(LegacyGridPoint2x::x2);

    public enum Kind {
        TILE_CENTER,
        VERTEX,
        EDGE_CENTER
    }

    public static LegacyGridPoint2x fromRaw(int x2, int y2) {
        return new LegacyGridPoint2x(x2, y2);
    }

    public static LegacyGridPoint2x fromTileCenter(Point2i cell) {
        return fromTileCenter(CellCoord.fromPoint(cell));
    }

    public static LegacyGridPoint2x fromTileCenter(CellCoord cell) {
        CellCoord resolvedCell = cell == null ? new CellCoord(0, 0) : cell;
        return new LegacyGridPoint2x(resolvedCell.x() * 2 + 1, resolvedCell.y() * 2 + 1);
    }

    public static LegacyGridPoint2x fromVertex(Point2i vertex) {
        Point2i resolvedVertex = vertex == null ? new Point2i(0, 0) : vertex;
        return new LegacyGridPoint2x(resolvedVertex.x() * 2, resolvedVertex.y() * 2);
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

    public Optional<Point2i> toCellCenter() {
        return toCellCoord().map(CellCoord::toPoint2i);
    }

    public Optional<CellCoord> toCellCoord() {
        if (!isTileCenter()) {
            return Optional.empty();
        }
        return Optional.of(new CellCoord((x2 - 1) / 2, (y2 - 1) / 2));
    }

    public Optional<Point2i> toVertex() {
        if (!isVertex()) {
            return Optional.empty();
        }
        return Optional.of(new Point2i(x2 / 2, y2 / 2));
    }

    public LegacyGridPoint2x offset(int dx2, int dy2) {
        if (dx2 == 0 && dy2 == 0) {
            return this;
        }
        return new LegacyGridPoint2x(x2 + dx2, y2 + dy2);
    }

    public LegacyGridPoint2x translatedByCells(Point2i delta) {
        return translatedByCells(CellCoord.fromPoint(delta));
    }

    public LegacyGridPoint2x translatedByCells(CellCoord delta) {
        CellCoord resolvedDelta = delta == null ? new CellCoord(0, 0) : delta;
        if (resolvedDelta.x() == 0 && resolvedDelta.y() == 0) {
            return this;
        }
        return new LegacyGridPoint2x(x2 + resolvedDelta.x() * 2, y2 + resolvedDelta.y() * 2);
    }

    public int distanceTo(LegacyGridPoint2x other) {
        return other == null ? Integer.MAX_VALUE : Math.abs(x2 - other.x2) + Math.abs(y2 - other.y2);
    }

    public long encodedKey() {
        return (((long) x2) << 32) ^ (y2 & 0xffffffffL);
    }
}
