package features.world.dungeonmap.model.geometry;

import java.util.Objects;

/**
 * Ordered corridor routes need anchor points that can live on tiles, vertices, or edges.
 *
 * <p>This stays geometry-only: it describes where a guide point sits on the grid, not what that point means
 * for rooms, corridors, rendering, or persistence.</p>
 */
public sealed interface GridAnchor permits GridAnchor.TileCenter, GridAnchor.VertexPoint, GridAnchor.EdgeCenter {

    Kind kind();

    /**
     * Returns the anchor position on a doubled integer grid so tile centers, edge centers, and vertices
     * can all be compared without floating-point math.
     */
    Point2i doubledGridPoint();

    GridAnchor translated(Point2i delta);

    static TileCenter atTile(Point2i cell) {
        return new TileCenter(new Tile(cell));
    }

    static TileCenter atTile(Tile tile) {
        return new TileCenter(tile);
    }

    static VertexPoint atVertex(Point2i vertex) {
        return new VertexPoint(vertex);
    }

    static EdgeCenter atEdge(VertexEdge edge) {
        return new EdgeCenter(edge);
    }

    enum Kind {
        TILE_CENTER,
        VERTEX,
        EDGE_CENTER
    }

    record TileCenter(Tile tile) implements GridAnchor {
        public TileCenter {
            tile = tile == null ? new Tile(new Point2i(0, 0)) : tile;
        }

        @Override
        public Kind kind() {
            return Kind.TILE_CENTER;
        }

        @Override
        public Point2i doubledGridPoint() {
            return new Point2i(tile.x() * 2 + 1, tile.y() * 2 + 1);
        }

        @Override
        public GridAnchor translated(Point2i delta) {
            return new TileCenter(tile.translated(delta));
        }
    }

    record VertexPoint(Point2i vertex) implements GridAnchor {
        public VertexPoint {
            vertex = vertex == null ? new Point2i(0, 0) : vertex;
        }

        @Override
        public Kind kind() {
            return Kind.VERTEX;
        }

        @Override
        public Point2i doubledGridPoint() {
            return new Point2i(vertex.x() * 2, vertex.y() * 2);
        }

        @Override
        public GridAnchor translated(Point2i delta) {
            return new VertexPoint(vertex.add(delta));
        }
    }

    record EdgeCenter(VertexEdge edge) implements GridAnchor {
        public EdgeCenter {
            edge = Objects.requireNonNullElse(edge, new VertexEdge(new Point2i(0, 0), new Point2i(1, 0)));
        }

        @Override
        public Kind kind() {
            return Kind.EDGE_CENTER;
        }

        @Override
        public Point2i doubledGridPoint() {
            return new Point2i(edge.start().x() + edge.end().x(), edge.start().y() + edge.end().y());
        }

        @Override
        public GridAnchor translated(Point2i delta) {
            return new EdgeCenter(edge.translated(delta));
        }
    }
}
