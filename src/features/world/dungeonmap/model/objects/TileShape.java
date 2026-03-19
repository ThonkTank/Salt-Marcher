package features.world.dungeonmap.model.objects;

import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.geometry.Tile;

import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.stream.Collectors;

public final class TileShape {

    private final Point2i anchor;
    private final Set<Tile> relativeTiles;

    public TileShape(Point2i anchor, Set<Tile> relativeTiles) {
        this.anchor = anchor == null ? new Point2i(0, 0) : anchor;
        this.relativeTiles = relativeTiles == null || relativeTiles.isEmpty()
                ? Set.of(new Tile(new Point2i(0, 0)))
                : Set.copyOf(relativeTiles);
    }

    public static TileShape singleCell(Point2i anchor) {
        return new TileShape(anchor, Set.of(new Tile(new Point2i(0, 0))));
    }

    public static TileShape fromAbsoluteCells(Collection<Point2i> absoluteCells) {
        Set<Point2i> normalizedCells = normalizeCells(absoluteCells);
        return fromAbsoluteCells(centerForCells(normalizedCells), normalizedCells);
    }

    public static TileShape fromAbsoluteCells(Point2i anchor, Collection<Point2i> absoluteCells) {
        Set<Point2i> normalizedCells = normalizeCells(absoluteCells);
        Point2i resolvedAnchor = anchor == null ? centerForCells(normalizedCells) : anchor;
        Set<Tile> relativeTiles = normalizedCells.stream()
                .map(cell -> new Tile(cell.subtract(resolvedAnchor)))
                .collect(Collectors.toCollection(LinkedHashSet::new));
        return new TileShape(resolvedAnchor, relativeTiles);
    }

    public Point2i anchor() {
        return anchor;
    }

    public Set<Tile> relativeTiles() {
        return relativeTiles;
    }

    public Set<Tile> tiles() {
        return relativeTiles.stream()
                .map(tile -> new Tile(anchor.add(tile.position())))
                .collect(Collectors.toUnmodifiableSet());
    }

    public Set<Point2i> absoluteCells() {
        return tiles().stream()
                .map(Tile::position)
                .collect(Collectors.toUnmodifiableSet());
    }

    public Point2i centerCell() {
        return centerForCells(absoluteCells());
    }

    public TileShape recentered() {
        return fromAbsoluteCells(absoluteCells());
    }

    private static Set<Point2i> normalizeCells(Collection<Point2i> absoluteCells) {
        Set<Point2i> normalizedCells = absoluteCells == null
                ? Set.of()
                : absoluteCells.stream()
                        .filter(cell -> cell != null)
                        .collect(Collectors.toCollection(LinkedHashSet::new));
        if (normalizedCells.isEmpty()) {
            return Set.of(new Point2i(0, 0));
        }
        return Set.copyOf(normalizedCells);
    }

    private static Point2i centerForCells(Set<Point2i> cells) {
        double averageX = cells.stream().mapToInt(Point2i::x).average().orElse(0.0);
        double averageY = cells.stream().mapToInt(Point2i::y).average().orElse(0.0);
        return cells.stream()
                .min(Comparator
                        .comparingDouble((Point2i cell) -> squaredDistance(cell, averageX, averageY))
                        .thenComparingInt(Point2i::y)
                        .thenComparingInt(Point2i::x))
                .orElse(new Point2i(0, 0));
    }

    private static double squaredDistance(Point2i cell, double x, double y) {
        double deltaX = cell.x() - x;
        double deltaY = cell.y() - y;
        return deltaX * deltaX + deltaY * deltaY;
    }
}
