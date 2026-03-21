package features.world.dungeonmap.model.geometry;

import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

// Primitive square tile on the grid. Higher-level types should ask Tile for tile-local geometry first.
public record Tile(Point2i position) {

    public Tile {
        position = position == null ? new Point2i(0, 0) : position;
    }

    public int x() {
        return position.x();
    }

    public int y() {
        return position.y();
    }

    public Tile translated(Point2i delta) {
        return new Tile(position.add(delta));
    }

    public Tile relativeTo(Point2i anchor) {
        return new Tile(position.subtract(anchor));
    }

    public Tile neighbor(Point2i stepDelta) {
        return translated(stepDelta);
    }

    public Set<Tile> neighbors4() {
        Set<Tile> neighbors = new LinkedHashSet<>();
        for (Point2i point : position.neighbors4()) {
            neighbors.add(new Tile(point));
        }
        return Set.copyOf(neighbors);
    }

    public boolean isAdjacentTo(Tile other) {
        return other != null && position.isAdjacent4(other.position);
    }

    public Point2i directionTo(Tile other) {
        return other == null ? null : position.directionToCardinal(other.position);
    }

    public VertexEdge edge(Point2i stepDelta) {
        return VertexEdge.betweenCellAndStep(position, stepDelta);
    }

    public Optional<VertexEdge> sharedEdge(Tile other) {
        Point2i direction = directionTo(other);
        return direction == null ? Optional.empty() : Optional.of(edge(direction));
    }

    public Set<Point2i> vertices() {
        return Set.of(
                position,
                position.add(new Point2i(1, 0)),
                position.add(new Point2i(1, 1)),
                position.add(new Point2i(0, 1)));
    }

    public Point2i centerCell() {
        return position;
    }

    public int minX() {
        return x();
    }

    public int maxX() {
        return x() + 1;
    }

    public int minY() {
        return y();
    }

    public int maxY() {
        return y() + 1;
    }

    public long encodedKey() {
        return position.encodedKey();
    }

    public int distanceTo(Tile other) {
        return other == null ? Integer.MAX_VALUE : position.distanceTo(other.position);
    }

    public static Set<Tile> translateAll(Collection<Tile> tiles, Point2i delta) {
        Set<Tile> translated = new LinkedHashSet<>();
        if (tiles == null || delta == null) {
            return translated;
        }
        for (Tile tile : tiles) {
            if (tile != null) {
                translated.add(tile.translated(delta));
            }
        }
        return Set.copyOf(translated);
    }

    public static Set<Point2i> positions(Collection<Tile> tiles) {
        Set<Point2i> positions = new LinkedHashSet<>();
        if (tiles == null) {
            return positions;
        }
        for (Tile tile : tiles) {
            if (tile != null) {
                positions.add(tile.position);
            }
        }
        return Set.copyOf(positions);
    }

    public static Tile bestCenterTile(Collection<Tile> tiles) {
        Set<Point2i> positions = positions(tiles);
        if (positions.isEmpty()) {
            return new Tile(new Point2i(0, 0));
        }
        double averageX = positions.stream().mapToInt(Point2i::x).average().orElse(0.0);
        double averageY = positions.stream().mapToInt(Point2i::y).average().orElse(0.0);
        Point2i center = positions.stream()
                .min(java.util.Comparator
                        .comparingDouble((Point2i cell) -> squaredDistance(cell, averageX, averageY))
                        .thenComparingInt(Point2i::y)
                        .thenComparingInt(Point2i::x))
                .orElse(new Point2i(0, 0));
        return new Tile(center);
    }

    public static long encode(Point2i cell) {
        return Point2i.encode(cell);
    }

    private static double squaredDistance(Point2i cell, double x, double y) {
        double deltaX = cell.x() - x;
        double deltaY = cell.y() - y;
        return deltaX * deltaX + deltaY * deltaY;
    }
}
