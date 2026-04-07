package features.world.dungeonmap.corridor.model;

import features.world.dungeonmap.geometry.GridPoint;
import features.world.dungeonmap.geometry.GridSegment;
import features.world.dungeonmap.geometry.GridPath;
import features.world.dungeonmap.structure.model.Structure;
import features.world.dungeonmap.structure.model.StructureSpecification;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.PriorityQueue;
import java.util.Set;

public final class CorridorRouting {

    private CorridorRouting() {
        throw new AssertionError("No instances");
    }

    public record AnchorAttachment(GridPoint cell, List<GridPoint> anchorPath) {
        public AnchorAttachment {
            cell = Objects.requireNonNull(cell, "cell");
            anchorPath = anchorPath == null ? List.of() : List.copyOf(anchorPath);
        }

        public double anchorPathCost() {
            return Math.max(0, anchorPath.size() - 1);
        }
    }

    public record RoutedNode(Long nodeId, List<AnchorAttachment> attachments) {
        public RoutedNode {
            nodeId = Objects.requireNonNull(nodeId, "nodeId");
            attachments = attachments == null ? List.of() : List.copyOf(attachments);
        }
    }

    public record RoutedLink(Long traceId, Long startNodeId, Long endNodeId) {
        public RoutedLink {
            startNodeId = Objects.requireNonNull(startNodeId, "startNodeId");
            endNodeId = Objects.requireNonNull(endNodeId, "endNodeId");
        }
    }

    public record RoutedProjection(
            Structure structure,
            List<CorridorPathTrace> traces,
            Set<GridSegment> boundaryOpeningEdges
    ) {
        public RoutedProjection {
            structure = structure == null ? Structure.empty() : structure;
            traces = traces == null ? List.of() : List.copyOf(traces);
            boundaryOpeningEdges = boundaryOpeningEdges == null ? Set.of() : Set.copyOf(boundaryOpeningEdges);
        }
    }

    public static Set<GridPoint> surfaceCellsForTraces(Collection<CorridorPathTrace> traces) {
        LinkedHashSet<GridPoint> result = new LinkedHashSet<>();
        for (CorridorPathTrace trace : traces == null ? List.<CorridorPathTrace>of() : traces) {
            if (trace == null) {
                continue;
            }
            for (GridPoint point2x : trace.points()) {
                if (point2x != null) {
                    point2x.asCell().ifPresent(result::add);
                }
            }
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    public static List<AnchorAttachment> attachmentsForPoint(GridPoint anchorPoint, Collection<GridPoint> blockedCells) {
        if (anchorPoint == null) {
            return List.of();
        }
        if (anchorPoint.isCell()) {
            return List.of(new AnchorAttachment(anchorPoint.asCell().orElseThrow(), List.of(anchorPoint)));
        }
        LinkedHashSet<GridPoint> blocked = new LinkedHashSet<>(blockedCells == null ? Set.<GridPoint>of() : blockedCells);
        Set<GridPoint> candidates = anchorPoint.touchingCells().cells();
        ArrayList<AnchorAttachment> attachments = new ArrayList<>();
        for (GridPoint candidate : candidates.stream().sorted(GridPoint.ORDER).toList()) {
            if (blocked.contains(candidate)) {
                continue;
            }
            for (List<GridPoint> path : anchorPaths(anchorPoint, candidate)) {
                attachments.add(new AnchorAttachment(candidate, path));
            }
        }
        return attachments.isEmpty() ? List.of() : List.copyOf(attachments);
    }

    public static RoutedProjection routeSurfaceProjection(
            int levelZ,
            Collection<RoutedNode> nodes,
            Collection<RoutedLink> links,
            Collection<GridPoint> blockedCells
    ) {
        Map<Long, RoutedNode> nodesById = indexRoutedNodes(nodes);
        ArrayList<CorridorPathTrace> traces = new ArrayList<>();
        for (RoutedLink link : sanitizedLinks(links)) {
            RoutedNode start = nodesById.get(link.startNodeId());
            RoutedNode end = nodesById.get(link.endNodeId());
            if (start == null || end == null) {
                throw new IllegalArgumentException("Trace link references missing node");
            }
            RoutePlan routePlan = findBestTrace(start.attachments(), end.attachments(), blockedCells);
            traces.add(new CorridorPathTrace(
                    link.traceId(),
                    link.startNodeId(),
                    link.endNodeId(),
                    GridPath.of(routePlan.path2x())));
        }
        if (traces.isEmpty()) {
            return new RoutedProjection(Structure.empty(), List.of(), Set.of());
        }
        Set<GridPoint> occupiedCells = surfaceCellsForTraces(traces);
        if (occupiedCells.isEmpty()) {
            return new RoutedProjection(Structure.empty(), List.copyOf(traces), Set.of());
        }
        Structure structure = Structure.fromSpecification(StructureSpecification.ofLevel(
                levelZ,
                StructureSpecification.LevelSpecification.of(
                        GridPoint.bestCenter(occupiedCells),
                        occupiedCells,
                        occupiedCells,
                        List.of(),
                        List.of())));
        Set<GridPoint> hydratedCells = GridPoint.normalize(structure.surfaceAtLevel(levelZ).surface().cells());
        if (!hydratedCells.equals(GridPoint.normalize(occupiedCells))) {
            throw new IllegalStateException("Corridor route projection changed the routed occupied cells");
        }
        return new RoutedProjection(structure, traces, Set.of());
    }

    private static Map<Long, RoutedNode> indexRoutedNodes(Collection<RoutedNode> nodes) {
        if (nodes == null || nodes.isEmpty()) {
            return Map.of();
        }
        Map<Long, RoutedNode> result = new LinkedHashMap<>();
        for (RoutedNode node : nodes) {
            if (node == null || node.nodeId() == null) {
                continue;
            }
            result.put(node.nodeId(), node);
        }
        return result.isEmpty() ? Map.of() : Map.copyOf(result);
    }

    private static List<RoutedLink> sanitizedLinks(Collection<RoutedLink> links) {
        if (links == null || links.isEmpty()) {
            return List.of();
        }
        return links.stream()
                .filter(Objects::nonNull)
                .sorted(Comparator
                        .comparing((RoutedLink link) -> link.traceId() == null ? Long.MAX_VALUE : link.traceId())
                        .thenComparing(link -> link.startNodeId() == null ? Long.MAX_VALUE : link.startNodeId())
                        .thenComparing(link -> link.endNodeId() == null ? Long.MAX_VALUE : link.endNodeId()))
                .toList();
    }

    private static RoutePlan findBestTrace(
            Collection<AnchorAttachment> startAttachments,
            Collection<AnchorAttachment> endAttachments,
            Collection<GridPoint> blockedCells
    ) {
        RoutePlan bestPlan = null;
        for (AnchorAttachment startAttachment : startAttachments == null ? List.<AnchorAttachment>of() : startAttachments) {
            if (startAttachment == null) {
                continue;
            }
            for (AnchorAttachment endAttachment : endAttachments == null ? List.<AnchorAttachment>of() : endAttachments) {
                if (endAttachment == null) {
                    continue;
                }
                CellRoute cellRoute = findCellRoute(
                        startAttachment.cell(),
                        endAttachment.cell(),
                        blockedCells == null ? Set.of() : Set.copyOf(blockedCells));
                if (cellRoute == null) {
                    continue;
                }
                List<GridPoint> path2x = assemblePath2x(
                        startAttachment.anchorPath(),
                        cellRoute.cells(),
                        endAttachment.anchorPath());
                double totalCost = cellRoute.cost()
                        + startAttachment.anchorPathCost()
                        + endAttachment.anchorPathCost();
                if (bestPlan == null || totalCost < bestPlan.cost()) {
                    bestPlan = new RoutePlan(path2x, totalCost);
                }
            }
        }
        if (bestPlan == null) {
            throw new IllegalArgumentException("Corridor route trace could not be resolved");
        }
        return bestPlan;
    }

    private static CellRoute findCellRoute(GridPoint start, GridPoint end, Set<GridPoint> blockedCells) {
        if (start == null || end == null) {
            return null;
        }
        if (start.equals(end)) {
            return new CellRoute(List.of(start), 0.0d);
        }
        int minX = Math.min(start.x(), end.x());
        int maxX = Math.max(start.x(), end.x());
        int minY = Math.min(start.y(), end.y());
        int maxY = Math.max(start.y(), end.y());
        for (GridPoint blocked : blockedCells == null ? List.<GridPoint>of() : blockedCells) {
            minX = Math.min(minX, blocked.x());
            maxX = Math.max(maxX, blocked.x());
            minY = Math.min(minY, blocked.y());
            maxY = Math.max(maxY, blocked.y());
        }
        minX -= 4;
        maxX += 4;
        minY -= 4;
        maxY += 4;

        double turnPenalty = turnPenalty(start, end);
        Set<GridPoint> effectiveBlocked = new LinkedHashSet<>(blockedCells == null ? Set.<GridPoint>of() : blockedCells);
        effectiveBlocked.remove(start);
        effectiveBlocked.remove(end);

        SearchState startState = new SearchState(start, null);
        PriorityQueue<QueueEntry> frontier = new PriorityQueue<>(Comparator.comparingDouble(QueueEntry::estimatedTotalCost));
        Map<SearchState, Double> bestCosts = new HashMap<>();
        Map<SearchState, SearchState> cameFrom = new HashMap<>();
        frontier.add(new QueueEntry(startState, heuristic(start, end)));
        bestCosts.put(startState, 0.0d);

        while (!frontier.isEmpty()) {
            QueueEntry currentEntry = frontier.poll();
            SearchState current = currentEntry.state();
            double currentCost = bestCosts.getOrDefault(current, Double.POSITIVE_INFINITY);
            if (currentEntry.estimatedTotalCost() - heuristic(current.cell(), end) > currentCost + 1e-9) {
                continue;
            }
            if (current.cell().equals(end)) {
                return new CellRoute(reconstructCellPath(cameFrom, current), currentCost);
            }
            for (GridPoint step : GridPoint.CARDINAL_STEPS) {
                GridPoint neighbor = current.cell().add(step);
                if (neighbor.x() < minX || neighbor.x() > maxX || neighbor.y() < minY || neighbor.y() > maxY) {
                    continue;
                }
                if (effectiveBlocked.contains(neighbor)) {
                    continue;
                }
                double nextCost = currentCost + 1.0d;
                if (current.direction() != null && !current.direction().equals(step)) {
                    nextCost += turnPenalty;
                }
                SearchState next = new SearchState(neighbor, step);
                if (nextCost + 1e-9 >= bestCosts.getOrDefault(next, Double.POSITIVE_INFINITY)) {
                    continue;
                }
                bestCosts.put(next, nextCost);
                cameFrom.put(next, current);
                frontier.add(new QueueEntry(next, nextCost + heuristic(neighbor, end)));
            }
        }
        return null;
    }

    private static List<GridPoint> reconstructCellPath(Map<SearchState, SearchState> cameFrom, SearchState endState) {
        ArrayList<GridPoint> path = new ArrayList<>();
        SearchState current = endState;
        path.add(current.cell());
        while (cameFrom.containsKey(current)) {
            current = cameFrom.get(current);
            path.add(current.cell());
        }
        Collections.reverse(path);
        return List.copyOf(path);
    }

    private static List<GridPoint> assemblePath2x(
            List<GridPoint> startAnchorPath,
            List<GridPoint> cellRoute,
            List<GridPoint> endAnchorPath
    ) {
        ArrayList<GridPoint> result = new ArrayList<>();
        appendUnique(result, startAnchorPath);
        appendUnique(result, cellRoute == null ? List.of() : cellRoute.stream().map(GridPoint::cell).toList());
        ArrayList<GridPoint> reversedEnd = new ArrayList<>(endAnchorPath == null ? List.of() : endAnchorPath);
        Collections.reverse(reversedEnd);
        appendUnique(result, reversedEnd);
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    private static void appendUnique(List<GridPoint> target, List<GridPoint> points) {
        if (target == null || points == null) {
            return;
        }
        for (GridPoint point : points) {
            if (point == null) {
                continue;
            }
            if (!target.isEmpty() && target.getLast().equals(point)) {
                continue;
            }
            target.add(point);
        }
    }

    private static List<List<GridPoint>> anchorPaths(GridPoint anchorPoint, GridPoint cell) {
        if (anchorPoint == null || cell == null) {
            return List.of();
        }
        GridPoint cellCenter = GridPoint.cell(cell);
        if (anchorPoint.equals(cellCenter)) {
            return List.of(List.of(anchorPoint));
        }
        if (anchorPoint.manhattanDistance2x(cellCenter) == 1) {
            return List.of(List.of(anchorPoint, cellCenter));
        }
        GridPoint firstMidpoint = GridPoint.raw(anchorPoint.x2(), cellCenter.y2());
        GridPoint secondMidpoint = GridPoint.raw(cellCenter.x2(), anchorPoint.y2());
        return List.of(
                List.of(anchorPoint, firstMidpoint, cellCenter),
                List.of(anchorPoint, secondMidpoint, cellCenter));
    }

    private static double heuristic(GridPoint current, GridPoint end) {
        return current == null || end == null ? 0.0d : current.manhattanDistance(end);
    }

    private static double turnPenalty(GridPoint start, GridPoint end) {
        int cellDistance = Math.max(1, start.manhattanDistance(end));
        return Math.max(0.15d, Math.min(0.75d, 0.75d / Math.sqrt(cellDistance)));
    }

    private record SearchState(GridPoint cell, GridPoint direction) {
        private SearchState {
            cell = Objects.requireNonNull(cell, "cell");
        }
    }

    private record QueueEntry(SearchState state, double estimatedTotalCost) {
        private QueueEntry {
            state = Objects.requireNonNull(state, "state");
        }
    }

    private record CellRoute(List<GridPoint> cells, double cost) {
        private CellRoute {
            cells = cells == null ? List.of() : List.copyOf(cells);
        }
    }

    private record RoutePlan(List<GridPoint> path2x, double cost) {
        private RoutePlan {
            path2x = path2x == null ? List.of() : List.copyOf(path2x);
        }
    }
}
