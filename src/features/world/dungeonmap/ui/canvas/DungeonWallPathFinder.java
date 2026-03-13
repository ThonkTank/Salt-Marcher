package features.world.dungeonmap.ui.canvas;

import features.world.dungeonmap.model.readmodel.edge.DungeonEdgeSummary;
import features.world.dungeonmap.model.domain.PassageDirection;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.PriorityQueue;

final class DungeonWallPathFinder {

    private static final int WALL_VERTEX_SEARCH_RADIUS = 1;

    private final DungeonCanvasModel model;
    private final DungeonViewport viewport;

    DungeonWallPathFinder(DungeonCanvasModel model, DungeonViewport viewport) {
        this.model = model;
        this.viewport = viewport;
    }

    // Wall painting intentionally snaps within a forgiving local search window so minor
    // pointer drift does not invalidate the intended path endpoint while dragging.
    VertexRef findPaintVertexInSearchWindow(double screenX, double screenY) {
        if (model.state() == null || model.state().map() == null) {
            return null;
        }
        double cellSize = viewport.scaledCellSize();
        double fx = (screenX - viewport.screenX(0)) / cellSize;
        double fy = (screenY - viewport.screenY(0)) / cellSize;
        int baseX = (int) Math.floor(fx);
        int baseY = (int) Math.floor(fy);
        List<VertexRef> candidates = paintVertexCandidatesNear(baseX, baseY);
        return choosePreferredPaintVertex(candidates, screenX, screenY);
    }

    List<DungeonMapPane.EdgeInteraction> findWallPaintPath(VertexRef start, VertexRef goal) {
        if (start == null || goal == null || start.equals(goal)) {
            return List.of();
        }
        PriorityQueue<VertexPathNode> openSet = new PriorityQueue<>(Comparator
                .comparingInt(VertexPathNode::priority)
                .thenComparingInt(VertexPathNode::heuristic)
                .thenComparingInt(node -> node.vertex().y())
                .thenComparingInt(node -> node.vertex().x()));
        Map<VertexRef, Integer> costByVertex = new HashMap<>();
        Map<VertexRef, VertexStep> previous = new HashMap<>();
        int initialHeuristic = heuristic(start, goal);
        openSet.add(new VertexPathNode(start, initialHeuristic, initialHeuristic));
        costByVertex.put(start, 0);

        while (!openSet.isEmpty()) {
            VertexPathNode current = openSet.poll();
            if (current.vertex().equals(goal)) {
                return rebuildPath(previous, current.vertex());
            }
            Integer knownCost = costByVertex.get(current.vertex());
            if (knownCost == null || knownCost + heuristic(current.vertex(), goal) < current.priority()) {
                continue;
            }
            for (VertexStep neighbor : neighboringPaintableEdges(current.vertex())) {
                int nextCost = knownCost + 1;
                Integer existingCost = costByVertex.get(neighbor.vertex());
                if (existingCost != null && existingCost <= nextCost) {
                    continue;
                }
                previous.put(neighbor.vertex(), neighbor);
                costByVertex.put(neighbor.vertex(), nextCost);
                int heuristic = heuristic(neighbor.vertex(), goal);
                openSet.add(new VertexPathNode(neighbor.vertex(), nextCost + heuristic, heuristic));
            }
        }
        return List.of();
    }

    private List<VertexRef> paintVertexCandidatesNear(int baseX, int baseY) {
        List<VertexRef> candidates = new ArrayList<>();
        for (int dx = -WALL_VERTEX_SEARCH_RADIUS; dx <= WALL_VERTEX_SEARCH_RADIUS + 1; dx++) {
            for (int dy = -WALL_VERTEX_SEARCH_RADIUS; dy <= WALL_VERTEX_SEARCH_RADIUS + 1; dy++) {
                VertexRef candidate = new VertexRef(baseX + dx, baseY + dy);
                if (isPaintVertex(candidate)) {
                    candidates.add(candidate);
                }
            }
        }
        return candidates;
    }

    private VertexRef choosePreferredPaintVertex(List<VertexRef> candidates, double screenX, double screenY) {
        VertexRef best = null;
        double bestDistance = Double.MAX_VALUE;
        for (VertexRef candidate : candidates) {
            double distance = Math.hypot(
                    screenX - viewport.screenX(candidate.x()),
                    screenY - viewport.screenY(candidate.y()));
            if (distance > bestDistance) {
                continue;
            }
            if (distance < bestDistance
                    || best == null
                    || candidate.y() < best.y()
                    || (candidate.y() == best.y() && candidate.x() < best.x())) {
                best = candidate;
                bestDistance = distance;
            }
        }
        return best;
    }

    private boolean isPaintVertex(VertexRef vertex) {
        return !neighboringPaintableEdges(vertex).isEmpty();
    }

    private List<VertexStep> neighboringPaintableEdges(VertexRef vertex) {
        List<VertexStep> neighbors = new ArrayList<>(4);
        addPaintableStep(neighbors, vertex, new VertexRef(vertex.x() - 1, vertex.y()));
        addPaintableStep(neighbors, vertex, new VertexRef(vertex.x() + 1, vertex.y()));
        addPaintableStep(neighbors, vertex, new VertexRef(vertex.x(), vertex.y() - 1));
        addPaintableStep(neighbors, vertex, new VertexRef(vertex.x(), vertex.y() + 1));
        neighbors.sort(Comparator
                .comparingInt((VertexStep step) -> step.vertex().y())
                .thenComparingInt(step -> step.vertex().x())
                .thenComparingInt(step -> step.edge().direction().ordinal())
                .thenComparingInt(step -> step.edge().y())
                .thenComparingInt(step -> step.edge().x()));
        return neighbors;
    }

    private void addPaintableStep(List<VertexStep> steps, VertexRef from, VertexRef to) {
        EdgeRef edge = edgeBetween(from, to);
        if (edge != null) {
            DungeonEdgeSummary summary = model.edgeAt(edge.direction().edgeKey(edge.x(), edge.y()));
            if (summary != null && summary.canCreateManualWall()) {
                steps.add(new VertexStep(to, edge, from));
            }
        }
    }

    private EdgeRef edgeBetween(VertexRef from, VertexRef to) {
        int dx = to.x() - from.x();
        int dy = to.y() - from.y();
        if (Math.abs(dx) + Math.abs(dy) != 1) {
            return null;
        }
        if (dx == 1) {
            return new EdgeRef(from.x(), from.y() - 1, PassageDirection.SOUTH);
        }
        if (dx == -1) {
            return new EdgeRef(to.x(), to.y() - 1, PassageDirection.SOUTH);
        }
        if (dy == 1) {
            return new EdgeRef(from.x() - 1, from.y(), PassageDirection.EAST);
        }
        return new EdgeRef(to.x() - 1, to.y(), PassageDirection.EAST);
    }

    private List<DungeonMapPane.EdgeInteraction> rebuildPath(Map<VertexRef, VertexStep> previous, VertexRef end) {
        List<DungeonMapPane.EdgeInteraction> path = new ArrayList<>();
        VertexRef current = end;
        while (previous.containsKey(current)) {
            VertexStep step = previous.get(current);
            path.add(0, toInteraction(step.edge()));
            current = step.previousVertex();
        }
        return path;
    }

    private int heuristic(VertexRef a, VertexRef b) {
        return Math.abs(a.x() - b.x()) + Math.abs(a.y() - b.y());
    }

    private DungeonMapPane.EdgeInteraction toInteraction(EdgeRef edge) {
        DungeonEdgeSummary edgeSummary = model.edgeAt(edge.direction().edgeKey(edge.x(), edge.y()));
        return edgeSummary == null ? null : new DungeonMapPane.EdgeInteraction(edgeSummary);
    }

    record VertexRef(int x, int y) {
    }

    private record EdgeRef(int x, int y, PassageDirection direction) {
    }

    private record VertexStep(VertexRef vertex, EdgeRef edge, VertexRef previousVertex) {
    }

    private record VertexPathNode(VertexRef vertex, int priority, int heuristic) {
    }
}
