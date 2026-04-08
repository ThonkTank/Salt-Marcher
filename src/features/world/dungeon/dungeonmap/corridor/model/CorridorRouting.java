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

final class CorridorRouting {

    private CorridorRouting() {
        throw new AssertionError("No instances");
    }

    record AnchorAttachment(GridPoint cell, GridPath anchorPath) {
        public AnchorAttachment {
            cell = Objects.requireNonNull(cell, "cell");
            anchorPath = anchorPath == null ? GridPath.empty() : anchorPath;
        }

        public double anchorPathCost() {
            return Math.max(0, anchorPath.points().size() - 1);
        }
    }

    record ResolvedNode(Long nodeId, GridPoint point, List<AnchorAttachment> attachments, boolean doorBound) {
        public ResolvedNode {
            nodeId = Objects.requireNonNull(nodeId, "nodeId");
            point = Objects.requireNonNull(point, "point");
            attachments = attachments == null ? List.of() : List.copyOf(attachments);
        }
    }

    static GridArea surfaceAreaForTraces(Collection<CorridorPathTrace> traces) {
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

    static List<AnchorAttachment> attachmentsForPoint(GridPoint anchorPoint, GridArea blockedCells) {
        if (anchorPoint == null) {
            return List.of();
        }
        if (anchorPoint.kind() == GridPoint.Kind.CELL) {
            return List.of(new AnchorAttachment(anchorPoint, GridPath.of(List.of(anchorPoint))));
        }
        Set<GridPoint> blocked = blockedCells == null ? Set.of() : blockedCells.cells();
        Set<GridPoint> candidates = anchorPoint.cellFootprint().cells();
        ArrayList<AnchorAttachment> attachments = new ArrayList<>();
        for (GridPoint candidate : candidates.stream().sorted(GridPoint.ORDER).toList()) {
            if (blocked.contains(candidate)) {
                continue;
            }
            for (List<GridPoint> path : anchorPaths(anchorPoint, candidate)) {
                attachments.add(new AnchorAttachment(candidate, GridPath.of(path)));
            }
        }
        return attachments.isEmpty() ? List.of() : List.copyOf(attachments);
    }

    static CorridorPathTrace routeSegmentProjection(
            CorridorSegment.ResolvedSegment resolvedSegment,
            CorridorSegment.RoutingContext context
    ) {
        CorridorSegment segment = Objects.requireNonNull(resolvedSegment, "resolvedSegment").segment();
        CorridorSegment.RoutingContext resolvedContext = Objects.requireNonNull(context, "context");
        LinkedHashSet<GridPoint> blocked = new LinkedHashSet<>(resolvedContext.blockedArea().cells());
        blocked.addAll(resolvedContext.reservedArea().cells());
        blocked.removeAll(resolvedSegment.start().point().cellFootprint().cells());
        blocked.removeAll(resolvedSegment.end().point().cellFootprint().cells());
        RoutePlan routePlan = findBestTrace(resolvedSegment.start().attachments(), resolvedSegment.end().attachments(), GridArea.of(blocked));
        return new CorridorPathTrace(
                segment.segmentId(),
                segment.startNodeId(),
                segment.endNodeId(),
                routePlan.path());
    }

    static CorridorPathTrace recoverSegmentTrace(
            CorridorSegment.ResolvedSegment resolvedSegment,
            GridArea surfaceArea,
            GridArea consumedNonNodeArea,
            GridArea fixedNodeArea
    ) {
        GridArea resolvedSurfaceArea = surfaceArea == null ? GridArea.empty() : surfaceArea;
        if (resolvedSurfaceArea.isEmpty()) {
            throw new IllegalArgumentException("Persisted corridor structure must contain corridor surface cells");
        }
        ResolvedNode startNode = resolvedSegment.start();
        ResolvedNode endNode = resolvedSegment.end();
        List<AnchorAttachment> startAttachments = recoverAttachments(startNode.attachments(), resolvedSurfaceArea.cells());
        List<AnchorAttachment> endAttachments = recoverAttachments(endNode.attachments(), resolvedSurfaceArea.cells());
        if (startAttachments.isEmpty() || endAttachments.isEmpty()) {
            throw new IllegalArgumentException("Persisted corridor node no longer touches corridor surface");
        }

        LinkedHashSet<GridPoint> blockedCells = new LinkedHashSet<>(consumedNonNodeArea == null ? Set.<GridPoint>of() : consumedNonNodeArea.cells());
        blockedCells.addAll(fixedNodeArea == null ? Set.<GridPoint>of() : fixedNodeArea.cells());
        blockedCells.removeAll(startNode.point().cellFootprint().cells());
        blockedCells.removeAll(endNode.point().cellFootprint().cells());

        RoutePlan recoveredRoute = findBestTraceWithinSurface(
                startAttachments,
                endAttachments,
                resolvedSurfaceArea.cells(),
                blockedCells);
        CorridorSegment segment = resolvedSegment.segment();
        return new CorridorPathTrace(
                segment.segmentId(),
                segment.startNodeId(),
                segment.endNodeId(),
                recoveredRoute.path());
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
                        .thenComparingInt(attachment -> attachment.anchorPath().points().size()))
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
                GridPath path = assemblePath(startAttachment.anchorPath(), cellRoute.cells(), endAttachment.anchorPath());
                double totalCost = cellRoute.cost() + startAttachment.anchorPathCost() + endAttachment.anchorPathCost();
                if (bestPlan == null || totalCost < bestPlan.cost()) {
                    bestPlan = new RoutePlan(path, totalCost);
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
                GridPath path = assemblePath(startAttachment.anchorPath(), cellRoute.cells(), endAttachment.anchorPath());
                double totalCost = cellRoute.cost() + startAttachment.anchorPathCost() + endAttachment.anchorPathCost();
                if (bestPlan == null || totalCost < bestPlan.cost()) {
                    bestPlan = new RoutePlan(path, totalCost);
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

    private static GridPath assemblePath(
            GridPath startAnchorPath,
            List<GridPoint> cellPath,
            GridPath endAnchorPath
    ) {
        return GridPath.concat(
                startAnchorPath,
                cellPath == null || cellPath.isEmpty() ? GridPath.empty() : GridPath.of(cellPath),
                reversedPath(endAnchorPath));
    }

    private static GridPath reversedPath(GridPath path) {
        if (path == null || path.isEmpty()) {
            return GridPath.empty();
        }
        ArrayList<GridPoint> reversed = new ArrayList<>(path.points());
        Collections.reverse(reversed);
        return GridPath.of(reversed);
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

    private record RoutePlan(GridPath path, double cost) {
    }
}
