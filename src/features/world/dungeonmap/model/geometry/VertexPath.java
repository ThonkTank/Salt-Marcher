package features.world.dungeonmap.model.geometry;

import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.NavigableSet;
import java.util.TreeSet;
import java.util.Set;

public abstract class VertexPath {

    // Foundation for edge-like objects: pure vertex-edge geometry plus path topology helpers.
    // Higher-level wall/door types should delegate normalization, connectivity, chain reconstruction,
    // and cell-side geometry here. Movement semantics do not belong in this layer.
    private final Set<VertexEdge> edges;
    private final Map<Point2i, Set<VertexEdge>> adjacency;

    protected VertexPath(Collection<VertexEdge> edges) {
        this.edges = normalizeEdges(edges);
        this.adjacency = buildAdjacency(this.edges);
    }

    public final Set<VertexEdge> edges() {
        return edges;
    }

    public final Set<Point2i> vertices() {
        return adjacency.keySet();
    }

    public final Set<Point2i> endpoints() {
        Set<Point2i> result = new LinkedHashSet<>();
        for (Point2i vertex : vertices()) {
            if (degreeOf(vertex) == 1) {
                result.add(vertex);
            }
        }
        return Set.copyOf(result);
    }

    public final int degreeOf(Point2i vertex) {
        return edgesTouching(vertex).size();
    }

    public final Set<VertexEdge> edgesTouching(Point2i point) {
        if (point == null) {
            return Set.of();
        }
        return adjacency.getOrDefault(point, Set.of());
    }

    public final boolean touchesVertex(Point2i point) {
        return !edgesTouching(point).isEmpty();
    }

    public final boolean touches(Point2i point) {
        return touchesVertex(point);
    }

    public final boolean containsEdge(VertexEdge edge) {
        return edge != null && edges.contains(edge);
    }

    public final boolean touches(Tile tile) {
        if (tile == null) {
            return false;
        }
        for (VertexEdge edge : edges) {
            if (edge.boundsTile(tile)) {
                return true;
            }
        }
        return false;
    }

    public final boolean touchesCell(Point2i cell) {
        return cell != null && touches(new Tile(cell));
    }

    public final boolean touches(TileShape shape) {
        if (shape == null) {
            return false;
        }
        for (Tile tile : shape.tiles()) {
            if (touches(tile)) {
                return true;
            }
        }
        return false;
    }

    public final Set<Tile> touchingTiles() {
        Set<Tile> result = new LinkedHashSet<>();
        for (VertexEdge edge : edges) {
            result.addAll(edge.touchingTiles());
        }
        return Set.copyOf(result);
    }

    public final Set<Point2i> touchingCells() {
        return Tile.positions(touchingTiles());
    }

    public final boolean touches(VertexPath other) {
        if (other == null) {
            return false;
        }
        for (VertexEdge edge : edges) {
            for (VertexEdge otherEdge : other.edges()) {
                if (edge.touches(otherEdge)) {
                    return true;
                }
            }
        }
        return false;
    }

    public final boolean touchesEdge(VertexEdge edge) {
        if (edge == null) {
            return false;
        }
        for (VertexEdge ownEdge : edges) {
            if (ownEdge.touches(edge)) {
                return true;
            }
        }
        return false;
    }

    public final boolean isConnected() {
        if (edges.isEmpty()) {
            return true;
        }
        Set<Point2i> visited = new LinkedHashSet<>();
        List<Point2i> queue = new java.util.ArrayList<>();
        Point2i start = vertices().stream().min(Point2i.POINT_ORDER).orElse(null);
        if (start == null) {
            return true;
        }
        queue.add(start);
        for (int index = 0; index < queue.size(); index++) {
            Point2i current = queue.get(index);
            if (!visited.add(current)) {
                continue;
            }
            for (VertexEdge edge : edgesTouching(current)) {
                Point2i neighbor = edge.other(current);
                if (neighbor != null && !visited.contains(neighbor)) {
                    queue.add(neighbor);
                }
            }
        }
        return visited.equals(vertices());
    }



    public final List<List<Point2i>> orderedChains() {
        if (edges.isEmpty()) {
            return List.of();
        }
        NavigableSet<VertexEdge> remaining = new TreeSet<>(VertexEdge.EDGE_ORDER);
        remaining.addAll(edges);
        List<List<Point2i>> chains = new java.util.ArrayList<>();
        while (!remaining.isEmpty()) {
            VertexEdge seed = remaining.first();
            Point2i start = startVertexForChain(seed, remaining);
            chains.add(traceChain(start, remaining));
        }
        return List.copyOf(chains);
    }

    public final boolean crosses(Point2i fromCell, Point2i stepDelta) {
        if (fromCell == null || stepDelta == null) {
            return false;
        }
        return edges.contains(VertexEdge.betweenCellAndStep(fromCell, stepDelta));
    }

    public final boolean separates(Point2i firstCell, Point2i secondCell) {
        if (firstCell == null || secondCell == null || !firstCell.isAdjacent4(secondCell)) {
            return false;
        }
        Point2i step = firstCell.directionToCardinal(secondCell);
        return step != null && crosses(firstCell, step);
    }

    public final VertexPath translated(Point2i delta) {
        List<VertexEdge> translatedEdges = edges.stream()
                .map(edge -> edge.translated(delta))
                .sorted(VertexEdge.EDGE_ORDER)
                .toList();
        return recreate(translatedEdges);
    }

    public final VertexPath withAddedEdges(Collection<VertexEdge> addedEdges) {
        Set<VertexEdge> merged = new LinkedHashSet<>(edges);
        for (VertexEdge edge : normalizeEdges(addedEdges)) {
            merged.add(edge);
        }
        return recreate(merged);
    }

    public final VertexPath withRemovedEdges(Collection<VertexEdge> removedEdges) {
        Set<VertexEdge> trimmed = new LinkedHashSet<>(edges);
        trimmed.removeAll(normalizeEdges(removedEdges));
        return recreate(trimmed);
    }

    protected abstract VertexPath recreate(Collection<VertexEdge> edges);

    private static Set<VertexEdge> normalizeEdges(Collection<VertexEdge> edges) {
        Set<VertexEdge> normalized = new LinkedHashSet<>();
        if (edges == null) {
            return Set.of();
        }
        for (VertexEdge edge : edges) {
            if (edge != null && !edge.start().equals(edge.end())) {
                normalized.add(edge);
            }
        }
        return Set.copyOf(normalized);
    }

    private static Map<Point2i, Set<VertexEdge>> buildAdjacency(Set<VertexEdge> edges) {
        Map<Point2i, Set<VertexEdge>> mutable = new LinkedHashMap<>();
        for (VertexEdge edge : edges.stream().sorted(VertexEdge.EDGE_ORDER).toList()) {
            mutable.computeIfAbsent(edge.start(), ignored -> new LinkedHashSet<>()).add(edge);
            mutable.computeIfAbsent(edge.end(), ignored -> new LinkedHashSet<>()).add(edge);
        }
        Map<Point2i, Set<VertexEdge>> result = new LinkedHashMap<>();
        for (Map.Entry<Point2i, Set<VertexEdge>> entry : mutable.entrySet()) {
            result.put(entry.getKey(), Set.copyOf(entry.getValue()));
        }
        return Map.copyOf(result);
    }

    private Point2i startVertexForChain(VertexEdge seed, Set<VertexEdge> remaining) {
        Comparator<Point2i> order = Point2i.POINT_ORDER;
        List<Point2i> candidates = List.of(seed.start(), seed.end());
        for (Point2i candidate : candidates.stream().sorted(order).toList()) {
            int degree = remainingDegree(candidate, remaining);
            if (degree != 2) {
                return candidate;
            }
        }
        return candidates.stream().min(order).orElse(seed.start());
    }

    private List<Point2i> traceChain(Point2i start, Set<VertexEdge> remaining) {
        List<Point2i> chain = new java.util.ArrayList<>();
        Point2i current = start;
        VertexEdge previous = null;
        chain.add(current);
        while (true) {
            VertexEdge next = nextEdge(current, previous, remaining);
            if (next == null) {
                return List.copyOf(chain);
            }
            remaining.remove(next);
            Point2i nextVertex = next.other(current);
            if (nextVertex == null) {
                return List.copyOf(chain);
            }
            chain.add(nextVertex);
            previous = next;
            current = nextVertex;
            if (current.equals(start)) {
                return List.copyOf(chain);
            }
            if (remainingDegree(current, remaining) != 1) {
                if (degreeOf(current) != 2) {
                    return List.copyOf(chain);
                }
            }
        }
    }

    private VertexEdge nextEdge(Point2i current, VertexEdge previous, Set<VertexEdge> remaining) {
        return edgesTouching(current).stream()
                .filter(remaining::contains)
                .filter(edge -> previous == null || !edge.equals(previous))
                .sorted(VertexEdge.EDGE_ORDER)
                .findFirst()
                .orElse(null);
    }

    private int remainingDegree(Point2i vertex, Set<VertexEdge> remaining) {
        int degree = 0;
        for (VertexEdge edge : edgesTouching(vertex)) {
            if (remaining.contains(edge)) {
                degree++;
            }
        }
        return degree;
    }
}
