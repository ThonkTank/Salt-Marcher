package features.world.dungeon.dungeonmap.corridor.model;

import features.world.dungeon.geometry.CardinalDirection;
import features.world.dungeon.geometry.GridArea;
import features.world.dungeon.geometry.GridPath;
import features.world.dungeon.geometry.GridPoint;
import features.world.dungeon.geometry.GridSegment;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
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

    public record ResolvedNode(Long nodeId, GridPoint point, List<AnchorAttachment> attachments, boolean doorBound) {
        public ResolvedNode {
            nodeId = Objects.requireNonNull(nodeId, "nodeId");
            point = Objects.requireNonNull(point, "point");
            attachments = attachments == null ? List.of() : List.copyOf(attachments);
        }
    }

    public static GridArea surfaceAreaForTraces(Collection<CorridorPathTrace> traces) {
        LinkedHashSet<GridPoint> result = new LinkedHashSet<>();
        for (CorridorPathTrace trace : traces == null ? List.<CorridorPathTrace>of() : traces) {
            if (trace == null) {
                continue;
            }
            for (GridPoint point2x : trace.path().points()) {
                if (point2x != null && point2x.kind() == GridPoint.Kind.CELL) {
                    result.add(point2x);
                }
            }
        }
        return result.isEmpty() ? GridArea.empty() : GridArea.of(result);
    }

    public static List<AnchorAttachment> attachmentsForPoint(GridPoint anchorPoint, GridArea blockedCells) {
        if (anchorPoint == null) {
            return List.of();
        }
        if (anchorPoint.kind() == GridPoint.Kind.CELL) {
            return List.of(new AnchorAttachment(anchorPoint, List.of(anchorPoint)));
        }
        Set<GridPoint> blocked = blockedCells == null ? Set.of() : blockedCells.cells();
        Set<GridPoint> candidates = anchorPoint.cellFootprint().cells();
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

    public static CorridorPathTrace routeSegmentProjection(
            CorridorSegment.ResolvedSegmentEndpoints endpoints,
            CorridorSegment.RoutingContext context
    ) {
        CorridorSegment segment = Objects.requireNonNull(endpoints, "endpoints").segment();
        CorridorSegment.RoutingContext resolvedContext = Objects.requireNonNull(context, "context");
        LinkedHashSet<GridPoint> blocked = new LinkedHashSet<>(resolvedContext.blockedCells().cells());
        blocked.addAll(resolvedContext.reservedCells());
        blocked.removeAll(endpoints.start().point().cellFootprint().cells());
        blocked.removeAll(endpoints.end().point().cellFootprint().cells());
        RoutePlan routePlan = findBestTrace(endpoints.start().attachments(), endpoints.end().attachments(), GridArea.of(blocked));
        return new CorridorPathTrace(
                segment.segmentId(),
                segment.startNodeId(),
                segment.endNodeId(),
                GridPath.of(routePlan.path2x()));
    }

    public static CorridorPathTrace recoverSegmentTrace(
            CorridorSegment.ResolvedSegmentEndpoints endpoints,
            Set<GridPoint> surfaceCells,
            Set<GridPoint> consumedNonNodeCells,
            Set<GridPoint> fixedNodeCells
    ) {
        Set<GridPoint> resolvedSurfaceCells = surfaceCells == null ? Set.of() : surfaceCells;
        if (resolvedSurfaceCells.isEmpty()) {
            throw new IllegalArgumentException("Persisted corridor structure must contain corridor surface cells");
        }
        ResolvedNode startNode = endpoints.start();
        ResolvedNode endNode = endpoints.end();
        List<AnchorAttachment> startAttachments = recoverAttachments(startNode.attachments(), resolvedSurfaceCells);
        List<AnchorAttachment> endAttachments = recoverAttachments(endNode.attachments(), resolvedSurfaceCells);
        if (startAttachments.isEmpty() || endAttachments.isEmpty()) {
            throw new IllegalArgumentException("Persisted corridor node no longer touches corridor surface");
        }

        LinkedHashSet<GridPoint> blockedCells = new LinkedHashSet<>(consumedNonNodeCells == null ? Set.<GridPoint>of() : consumedNonNodeCells);
        blockedCells.addAll(fixedNodeCells == null ? Set.<GridPoint>of() : fixedNodeCells);
        blockedCells.removeAll(startNode.point().cellFootprint().cells());
        blockedCells.removeAll(endNode.point().cellFootprint().cells());

        RoutePlan recoveredRoute = findBestTraceWithinSurface(
                startAttachments,
                endAttachments,
                resolvedSurfaceCells,
                blockedCells);
        CorridorSegment segment = endpoints.segment();
        return new CorridorPathTrace(
                segment.segmentId(),
                segment.startNodeId(),
                segment.endNodeId(),
                GridPath.of(recoveredRoute.path2x()));
    }

    private static List<AnchorAttachment> recoverAttachments(Collection<AnchorAttachment> attachments, Set<GridPoint> surfaceCells) {
        if (attachments == null || attachments.isEmpty() || surfaceCells == null || surfaceCells.isEmpty()) {
            return List.of();
        }
        return attachments.stream()
                .filter(Objects::nonNull)
                .filter(attachment -> surfaceCells.contains(attachment.cell()))
                .sorted(Comparator
                        .comparing(AnchorAttachment::cell, GridPoint.ORDER)
                        .thenComparingInt(attachment -> attachment.anchorPath().size()))
                .toList();
    }

    private static RoutePlan findBestTrace(
            Collection<AnchorAttachment> startAttachments,
            Collection<AnchorAttachment> endAttachments,
            GridArea blockedCells
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
                        blockedCells == null ? Set.of() : blockedCells.cells());
                if (cellRoute == null) {
                    continue;
                }
                List<GridPoint> path2x = assemblePath2x(startAttachment.anchorPath(), cellRoute.cells(), endAttachment.anchorPath());
                double totalCost = cellRoute.cost() + startAttachment.anchorPathCost() + endAttachment.anchorPathCost();
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

    private static RoutePlan findBestTraceWithinSurface(
            Collection<AnchorAttachment> startAttachments,
            Collection<AnchorAttachment> endAttachments,
            Set<GridPoint> surfaceCells,
            Set<GridPoint> blockedCells
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
                CellRoute cellRoute = findCellRouteWithinSurface(
                        startAttachment.cell(),
                        endAttachment.cell(),
                        surfaceCells,
                        blockedCells);
                if (cellRoute == null) {
                    continue;
                }
                List<GridPoint> path2x = assemblePath2x(startAttachment.anchorPath(), cellRoute.cells(), endAttachment.anchorPath());
                double totalCost = cellRoute.cost() + startAttachment.anchorPathCost() + endAttachment.anchorPathCost();
                if (bestPlan == null || totalCost < bestPlan.cost()) {
                    bestPlan = new RoutePlan(path2x, totalCost);
                }
            }
        }
        if (bestPlan == null) {
            throw new IllegalArgumentException("Persisted corridor route trace could not be reconstructed");
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
        int minX = Math.min(cellX(start), cellX(end));
        int maxX = Math.max(cellX(start), cellX(end));
        int minY = Math.min(cellY(start), cellY(end));
        int maxY = Math.max(cellY(start), cellY(end));
        for (GridPoint blocked : blockedCells == null ? List.<GridPoint>of() : blockedCells) {
            minX = Math.min(minX, cellX(blocked));
            maxX = Math.max(maxX, cellX(blocked));
            minY = Math.min(minY, cellY(blocked));
            maxY = Math.max(maxY, cellY(blocked));
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
            for (CardinalDirection step : CardinalDirection.values()) {
                GridPoint neighbor = current.cell().step(step);
                if (cellX(neighbor) < minX || cellX(neighbor) > maxX || cellY(neighbor) < minY || cellY(neighbor) > maxY) {
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

    private static CellRoute findCellRouteWithinSurface(
            GridPoint start,
            GridPoint end,
            Set<GridPoint> surfaceCells,
            Set<GridPoint> blockedCells
    ) {
        if (start == null || end == null || surfaceCells == null || surfaceCells.isEmpty()) {
            return null;
        }
        if (!surfaceCells.contains(start) || !surfaceCells.contains(end)) {
            return null;
        }
        if (start.equals(end)) {
            return new CellRoute(List.of(start), 0.0d);
        }
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
            for (CardinalDirection step : CardinalDirection.values()) {
                GridPoint neighbor = current.cell().step(step);
                if (!surfaceCells.contains(neighbor) || effectiveBlocked.contains(neighbor)) {
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
            List<GridPoint> cellPath,
            List<GridPoint> endAnchorPath
    ) {
        ArrayList<GridPoint> result = new ArrayList<>();
        appendPath(result, startAnchorPath);
        appendCellPath(result, cellPath);
        appendReversedPath(result, endAnchorPath);
        return List.copyOf(result);
    }

    private static void appendPath(List<GridPoint> target, List<GridPoint> path) {
        for (GridPoint point : path == null ? List.<GridPoint>of() : path) {
            if (target.isEmpty() || !target.getLast().equals(point)) {
                target.add(point);
            }
        }
    }

    private static void appendReversedPath(List<GridPoint> target, List<GridPoint> path) {
        if (path == null || path.isEmpty()) {
            return;
        }
        for (int index = path.size() - 1; index >= 0; index--) {
            GridPoint point = path.get(index);
            if (target.isEmpty() || !target.getLast().equals(point)) {
                target.add(point);
            }
        }
    }

    private static void appendCellPath(List<GridPoint> target, List<GridPoint> cells) {
        if (cells == null || cells.isEmpty()) {
            return;
        }
        for (int index = 0; index < cells.size(); index++) {
            GridPoint cell = cells.get(index);
            if (index == 0) {
                if (target.isEmpty() || !target.getLast().equals(cell)) {
                    target.add(cell);
                }
                continue;
            }
            GridPoint previous = cells.get(index - 1);
            GridSegment edge = new GridSegment(previous, cell);
            GridPoint midpoint = edge.midpoint();
            if (target.isEmpty() || !target.getLast().equals(midpoint)) {
                target.add(midpoint);
            }
            if (target.isEmpty() || !target.getLast().equals(cell)) {
                target.add(cell);
            }
        }
    }

    private static List<List<GridPoint>> anchorPaths(GridPoint anchorPoint, GridPoint cell) {
        if (anchorPoint.equals(cell)) {
            return List.of(List.of(anchorPoint));
        }
        return List.of(List.of(anchorPoint, cell));
    }

    private static int cellX(GridPoint cell) {
        return cell.x2() / 2;
    }

    private static int cellY(GridPoint cell) {
        return cell.y2() / 2;
    }

    private static double heuristic(GridPoint start, GridPoint end) {
        return Math.abs(cellX(start) - cellX(end)) + Math.abs(cellY(start) - cellY(end));
    }

    private static double turnPenalty(GridPoint start, GridPoint end) {
        return cellX(start) != cellX(end) && cellY(start) != cellY(end) ? 0.35d : 0.15d;
    }

    private record SearchState(GridPoint cell, CardinalDirection direction) {
    }

    private record QueueEntry(SearchState state, double estimatedTotalCost) {
    }

    private record CellRoute(List<GridPoint> cells, double cost) {
    }

    private record RoutePlan(List<GridPoint> path2x, double cost) {
    }
}
