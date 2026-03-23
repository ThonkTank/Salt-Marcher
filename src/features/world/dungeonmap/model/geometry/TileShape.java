package features.world.dungeonmap.model.geometry;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Canonical tile-area primitive based on one truth: anchor + relative tiles.
 *
 * <p>TODO: Add shape factories such as rectangle or brush presets once editor workflows need them.</p>
 * <p>TODO: Add polygon/vertex import factories when persistence or tooling should create shapes from loops directly.</p>
 * <p>TODO: Add higher-level morph operations such as dilate/erode only when concrete editing workflows require them.</p>
 */
public final class TileShape {

    private final Point2i anchor;
    // TileShape is the canonical runtime owner of area geometry: anchor + relative tiles.
    private final Set<Tile> relativeTiles;

    public TileShape(Point2i anchor, Set<Tile> relativeTiles) {
        this.anchor = anchor == null ? new Point2i(0, 0) : anchor;
        this.relativeTiles = normalizeRelativeTiles(relativeTiles);
    }

    public static TileShape empty() {
        return new TileShape(new Point2i(0, 0), Set.of());
    }

    public static TileShape singleCell(Point2i anchor) {
        return new TileShape(anchor, Set.of(new Tile(new Point2i(0, 0))));
    }

    public static TileShape rectangle(Point2i startCell, Point2i endCell) {
        if (startCell == null && endCell == null) {
            return empty();
        }
        Point2i start = startCell == null ? endCell : startCell;
        Point2i end = endCell == null ? startCell : endCell;
        int minX = Math.min(start.x(), end.x());
        int maxX = Math.max(start.x(), end.x());
        int minY = Math.min(start.y(), end.y());
        int maxY = Math.max(start.y(), end.y());
        Set<Point2i> cells = new LinkedHashSet<>();
        for (int x = minX; x <= maxX; x++) {
            for (int y = minY; y <= maxY; y++) {
                cells.add(new Point2i(x, y));
            }
        }
        return fromAbsoluteCells(cells);
    }

    public static TileShape fromAbsoluteCells(Collection<Point2i> absoluteCells) {
        Set<Tile> normalizedTiles = normalizeAbsoluteTiles(absoluteCells);
        return fromAbsoluteTiles(Tile.bestCenterTile(normalizedTiles), normalizedTiles);
    }

    public static TileShape fromAbsoluteCells(Point2i anchor, Collection<Point2i> absoluteCells) {
        return fromAbsoluteTiles(anchor == null ? null : new Tile(anchor), normalizeAbsoluteTiles(absoluteCells));
    }

    public static TileShape fromAbsoluteTiles(Tile anchor, Collection<Tile> absoluteTiles) {
        Set<Tile> normalizedTiles = normalizeTiles(absoluteTiles);
        Tile resolvedAnchor = anchor == null ? Tile.bestCenterTile(normalizedTiles) : anchor;
        Set<Tile> relativeTiles = normalizedTiles.stream()
                .map(tile -> tile.relativeTo(resolvedAnchor.position()))
                .collect(Collectors.toCollection(LinkedHashSet::new));
        return new TileShape(resolvedAnchor.position(), relativeTiles);
    }

    public Point2i anchor() {
        return anchor;
    }

    public Set<Tile> relativeTiles() {
        return relativeTiles;
    }

    public Set<Point2i> relativeCells() {
        return relativeTiles.stream()
                .map(Tile::position)
                .collect(Collectors.toUnmodifiableSet());
    }

    public Set<Tile> tiles() {
        return relativeTiles.stream()
                .map(tile -> tile.translated(anchor))
                .collect(Collectors.toUnmodifiableSet());
    }

    public Set<Point2i> absoluteCells() {
        return Tile.positions(tiles());
    }

    public boolean contains(Point2i cell) {
        return cell != null && absoluteCells().contains(cell);
    }

    public boolean contains(Tile tile) {
        return tile != null && tiles().contains(tile);
    }

    public int size() {
        return relativeTiles.size();
    }

    public boolean overlaps(TileShape other) {
        if (other == null) {
            return false;
        }
        Set<Point2i> cells = absoluteCells();
        for (Point2i cell : other.absoluteCells()) {
            if (cells.contains(cell)) {
                return true;
            }
        }
        return false;
    }

    public boolean touches(TileShape other) {
        if (other == null) {
            return false;
        }
        Set<Point2i> otherCells = other.absoluteCells();
        for (Tile tile : tiles()) {
            for (Tile neighbor : tile.neighbors4()) {
                if (otherCells.contains(neighbor.position())) {
                    return true;
                }
            }
        }
        return false;
    }

    public TileShape union(TileShape other) {
        if (other == null) {
            return this;
        }
        Set<Tile> merged = new LinkedHashSet<>(tiles());
        merged.addAll(other.tiles());
        return fromAbsoluteTiles(null, merged);
    }

    public TileShape intersect(TileShape other) {
        if (other == null) {
            return empty();
        }
        Set<Tile> intersection = new LinkedHashSet<>();
        Set<Tile> otherTiles = other.tiles();
        for (Tile tile : tiles()) {
            if (otherTiles.contains(tile)) {
                intersection.add(tile);
            }
        }
        return fromAbsoluteTiles(null, intersection);
    }

    public TileShape subtract(TileShape other) {
        if (other == null) {
            return this;
        }
        Set<Tile> remaining = new LinkedHashSet<>(tiles());
        remaining.removeAll(other.tiles());
        return fromAbsoluteTiles(null, remaining);
    }

    public int minX() {
        return tiles().stream().mapToInt(Tile::x).min().orElse(anchor.x());
    }

    public int maxX() {
        return tiles().stream().mapToInt(Tile::maxX).max().orElse(anchor.x() + 1);
    }

    public int minY() {
        return tiles().stream().mapToInt(Tile::y).min().orElse(anchor.y());
    }

    public int maxY() {
        return tiles().stream().mapToInt(Tile::maxY).max().orElse(anchor.y() + 1);
    }

    public Point2i centerCell() {
        return Tile.bestCenterTile(tiles()).position();
    }

    public GridAnchor centerAnchor() {
        return GridAnchor.atTile(centerCell());
    }

    public boolean isConnected() {
        return connectedComponents().size() <= 1;
    }

    public List<TileShape> connectedComponents() {
        Set<Tile> unvisited = new LinkedHashSet<>(tiles());
        List<TileShape> components = new ArrayList<>();
        while (!unvisited.isEmpty()) {
            Tile seed = unvisited.iterator().next();
            ArrayDeque<Tile> queue = new ArrayDeque<>();
            Set<Tile> component = new LinkedHashSet<>();
            queue.add(seed);
            unvisited.remove(seed);
            while (!queue.isEmpty()) {
                Tile current = queue.removeFirst();
                component.add(current);
                for (Tile neighbor : current.neighbors4()) {
                    if (unvisited.remove(neighbor)) {
                        queue.addLast(neighbor);
                    }
                }
            }
            components.add(fromAbsoluteTiles(null, component));
        }
        return List.copyOf(components);
    }

    public Set<VertexEdge> boundaryEdges() {
        Set<VertexEdge> edges = new LinkedHashSet<>();
        Set<Tile> tiles = tiles();
        for (Tile tile : tiles) {
            for (Point2i step : Point2i.CARDINAL_STEPS) {
                Tile neighbor = tile.neighbor(step);
                if (!tiles.contains(neighbor)) {
                    edges.add(tile.edge(step));
                }
            }
        }
        return Set.copyOf(edges);
    }

    public List<List<Point2i>> outlineLoops() {
        return traceOutlineLoops(absoluteCells());
    }

    public List<Point2i> outerLoop() {
        return outlineLoops().stream()
                .max(Comparator.comparingDouble(loop -> Math.abs(signedArea(loop))))
                .map(List::copyOf)
                .orElse(List.of());
    }

    public List<Point2i> absoluteVertices() {
        List<Point2i> encoded = new ArrayList<>();
        List<List<Point2i>> loops = outlineLoops();
        for (int index = 0; index < loops.size(); index++) {
            if (index > 0) {
                encoded.add(loopSeparator());
            }
            encoded.addAll(loops.get(index));
        }
        return List.copyOf(encoded);
    }

    public TileShape recentered() {
        return fromAbsoluteCells(absoluteCells());
    }

    public TileShape translated(Point2i delta) {
        return new TileShape(anchor.add(delta), relativeTiles);
    }

    private static Set<Point2i> normalizeCells(Collection<Point2i> absoluteCells) {
        Set<Point2i> normalizedCells = absoluteCells == null
                ? Set.of()
                : absoluteCells.stream()
                        .filter(cell -> cell != null)
                        .collect(Collectors.toCollection(LinkedHashSet::new));
        return Set.copyOf(normalizedCells);
    }

    private static Set<Tile> normalizeAbsoluteTiles(Collection<Point2i> absoluteCells) {
        return normalizeTiles(normalizeCells(absoluteCells).stream().map(Tile::new).toList());
    }

    private static Set<Tile> normalizeTiles(Collection<Tile> tiles) {
        Set<Tile> normalizedTiles = tiles == null
                ? Set.of()
                : tiles.stream()
                        .filter(tile -> tile != null)
                        .collect(Collectors.toCollection(LinkedHashSet::new));
        return Set.copyOf(normalizedTiles);
    }

    private static Set<Tile> normalizeRelativeTiles(Collection<Tile> relativeTiles) {
        return normalizeTiles(relativeTiles);
    }

    private static List<List<Point2i>> traceOutlineLoops(Set<Point2i> cells) {
        if (cells == null || cells.isEmpty()) {
            return List.of();
        }
        Map<Point2i, List<DirectedEdge>> edgesByStart = buildDirectedEdges(cells);
        List<List<Point2i>> loops = traceAllLoops(edgesByStart);
        if (loops.isEmpty()) {
            return List.of(List.of(
                    new Point2i(cells.stream().mapToInt(Point2i::x).min().orElse(0),
                            cells.stream().mapToInt(Point2i::y).min().orElse(0)),
                    new Point2i(cells.stream().mapToInt(Point2i::x).max().orElse(0) + 1,
                            cells.stream().mapToInt(Point2i::y).min().orElse(0)),
                    new Point2i(cells.stream().mapToInt(Point2i::x).max().orElse(0) + 1,
                            cells.stream().mapToInt(Point2i::y).max().orElse(0) + 1),
                    new Point2i(cells.stream().mapToInt(Point2i::x).min().orElse(0),
                            cells.stream().mapToInt(Point2i::y).max().orElse(0) + 1)));
        }
        return loops.stream()
                .sorted(Comparator.comparingDouble((List<Point2i> loop) -> Math.abs(signedArea(loop))).reversed())
                .toList();
    }

    private static Map<Point2i, List<DirectedEdge>> buildDirectedEdges(Set<Point2i> cells) {
        Map<VertexEdge, DirectedEdge> dedup = new HashMap<>();
        for (Point2i cell : cells) {
            Tile tile = new Tile(cell);
            maybeAddEdge(cells, dedup, tile, new Point2i(0, -1),
                    new Point2i(tile.x(), tile.y()), new Point2i(tile.x() + 1, tile.y()));
            maybeAddEdge(cells, dedup, tile, new Point2i(1, 0),
                    new Point2i(tile.x() + 1, tile.y()), new Point2i(tile.x() + 1, tile.y() + 1));
            maybeAddEdge(cells, dedup, tile, new Point2i(0, 1),
                    new Point2i(tile.x() + 1, tile.y() + 1), new Point2i(tile.x(), tile.y() + 1));
            maybeAddEdge(cells, dedup, tile, new Point2i(-1, 0),
                    new Point2i(tile.x(), tile.y() + 1), new Point2i(tile.x(), tile.y()));
        }
        Map<Point2i, List<DirectedEdge>> edgesByStart = new HashMap<>();
        for (DirectedEdge edge : dedup.values()) {
            edgesByStart.computeIfAbsent(edge.start(), ignored -> new ArrayList<>()).add(edge);
        }
        return edgesByStart;
    }

    private static void maybeAddEdge(
            Set<Point2i> cells,
            Map<VertexEdge, DirectedEdge> edges,
            Tile tile,
            Point2i direction,
            Point2i start,
            Point2i end
    ) {
        if (!cells.contains(tile.neighbor(direction).position())) {
            edges.put(new VertexEdge(start, end), new DirectedEdge(start, end));
        }
    }

    private static List<List<Point2i>> traceAllLoops(Map<Point2i, List<DirectedEdge>> edgesByStart) {
        Set<DirectedEdge> visited = new HashSet<>();
        List<List<Point2i>> loops = new ArrayList<>();
        for (List<DirectedEdge> edges : edgesByStart.values()) {
            for (DirectedEdge edge : edges) {
                if (!visited.contains(edge)) {
                    loops.add(traceLoop(edge, edgesByStart, visited));
                }
            }
        }
        return List.copyOf(loops);
    }

    private static List<Point2i> traceLoop(
            DirectedEdge startEdge,
            Map<Point2i, List<DirectedEdge>> outgoing,
            Set<DirectedEdge> visited
    ) {
        List<Point2i> loop = new ArrayList<>();
        DirectedEdge current = startEdge;
        visited.add(current);
        loop.add(current.start());
        while (true) {
            loop.add(current.end());
            if (current.end().equals(startEdge.start())) {
                loop.remove(loop.size() - 1);
                return List.copyOf(loop);
            }
            DirectedEdge next = chooseNextEdge(current, outgoing.getOrDefault(current.end(), List.of()), visited);
            if (next == null) {
                return List.copyOf(loop);
            }
            visited.add(next);
            current = next;
        }
    }

    private static DirectedEdge chooseNextEdge(
            DirectedEdge current,
            List<DirectedEdge> candidates,
            Set<DirectedEdge> visited
    ) {
        DirectedEdge best = null;
        int bestRank = Integer.MAX_VALUE;
        Point2i currentVector = current.vector();
        for (DirectedEdge candidate : candidates) {
            if (visited.contains(candidate)) {
                continue;
            }
            int rank = turnRank(currentVector, candidate.vector());
            if (rank < bestRank) {
                best = candidate;
                bestRank = rank;
            }
        }
        return best;
    }

    private static int turnRank(Point2i from, Point2i to) {
        int cross = from.x() * to.y() - from.y() * to.x();
        int dot = from.x() * to.x() + from.y() * to.y();
        if (cross > 0) {
            return 0;
        }
        if (cross == 0 && dot > 0) {
            return 1;
        }
        if (cross < 0) {
            return 2;
        }
        return 3;
    }

    private static double signedArea(List<Point2i> loop) {
        double area = 0.0;
        for (int index = 0; index < loop.size(); index++) {
            Point2i current = loop.get(index);
            Point2i next = loop.get((index + 1) % loop.size());
            area += (double) current.x() * next.y() - (double) next.x() * current.y();
        }
        return area / 2.0;
    }

    private static Point2i loopSeparator() {
        return new Point2i(Integer.MIN_VALUE, Integer.MIN_VALUE);
    }

    private record DirectedEdge(Point2i start, Point2i end) {
        private Point2i vector() {
            return end.subtract(start);
        }
    }
}
