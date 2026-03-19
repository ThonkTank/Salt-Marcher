package features.world.dungeonmap.model.objects;

import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.geometry.Tile;
import features.world.dungeonmap.model.geometry.VertexPath;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

public final class TileShape {

    private final Point2i anchor;
    private final Set<Tile> relativeTiles;

    public TileShape(Point2i anchor, Set<Tile> relativeTiles) {
        this.anchor = anchor == null ? new Point2i(0, 0) : anchor;
        this.relativeTiles = relativeTiles == null || relativeTiles.isEmpty()
                ? Set.of(new Tile(new Point2i(0, 0)))
                : Set.copyOf(relativeTiles);
    }

    public static TileShape fromRelativeVertices(Point2i anchor, List<Point2i> relativeVertices) {
        return new TileShape(anchor, deriveTiles(relativeVertices));
    }

    public static TileShape singleCell(Point2i anchor) {
        return new TileShape(anchor, Set.of(new Tile(new Point2i(0, 0))));
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
                .collect(java.util.stream.Collectors.toUnmodifiableSet());
    }

    public Set<Point2i> absoluteCells() {
        return tiles().stream().map(Tile::position).collect(java.util.stream.Collectors.toUnmodifiableSet());
    }

    private static Set<Tile> deriveTiles(List<Point2i> relativeVertices) {
        List<List<Point2i>> loops = splitLoops(relativeVertices);
        if (loops.isEmpty()) {
            return Set.of(new Tile(new Point2i(0, 0)));
        }
        int minX = loops.stream().flatMap(List::stream).mapToInt(Point2i::x).min().orElse(0);
        int maxX = loops.stream().flatMap(List::stream).mapToInt(Point2i::x).max().orElse(0);
        int minY = loops.stream().flatMap(List::stream).mapToInt(Point2i::y).min().orElse(0);
        int maxY = loops.stream().flatMap(List::stream).mapToInt(Point2i::y).max().orElse(0);

        Set<Tile> cells = new LinkedHashSet<>();
        for (int x = minX; x <= maxX; x++) {
            for (int y = minY; y <= maxY; y++) {
                if (containsCell(loops, x, y)) {
                    cells.add(new Tile(new Point2i(x, y)));
                }
            }
        }
        return cells.isEmpty() ? Set.of(new Tile(new Point2i(0, 0))) : Set.copyOf(cells);
    }

    private static List<List<Point2i>> splitLoops(List<Point2i> vertices) {
        List<List<Point2i>> loops = new ArrayList<>();
        List<Point2i> currentLoop = new ArrayList<>();
        for (Point2i vertex : vertices == null ? List.<Point2i>of() : vertices) {
            if (VertexPath.LOOP_SEPARATOR.equals(vertex)) {
                if (!currentLoop.isEmpty()) {
                    loops.add(List.copyOf(currentLoop));
                    currentLoop = new ArrayList<>();
                }
                continue;
            }
            currentLoop.add(vertex);
        }
        if (!currentLoop.isEmpty()) {
            loops.add(List.copyOf(currentLoop));
        }
        return loops.isEmpty() ? List.of() : List.copyOf(loops);
    }

    private static boolean containsCell(List<List<Point2i>> loops, int x, int y) {
        boolean inside = false;
        for (List<Point2i> loop : loops) {
            if (polygonContainsCell(loop, x, y)) {
                inside = !inside;
            }
        }
        return inside;
    }

    private static boolean polygonContainsCell(List<Point2i> polygon, int x, int y) {
        double px = x + 0.5;
        double py = y + 0.5;
        boolean inside = false;
        for (int i = 0, j = polygon.size() - 1; i < polygon.size(); j = i++) {
            Point2i pi = polygon.get(i);
            Point2i pj = polygon.get(j);
            boolean intersects = ((pi.y() > py) != (pj.y() > py))
                    && (px < (double) (pj.x() - pi.x()) * (py - pi.y()) / (double) (pj.y() - pi.y()) + pi.x());
            if (intersects) {
                inside = !inside;
            }
        }
        return inside;
    }
}
