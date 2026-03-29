package features.world.dungeonmap.model.structures.traversal.planning.internal;

import features.world.dungeonmap.model.geometry.CardinalDirection;
import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.structures.stair.StairShape;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

final class VerticalCandidateGenerator {

    private static final int HORIZONTAL_PADDING = 3;

    private VerticalCandidateGenerator() {
        throw new AssertionError("No instances");
    }

    static VerticalCandidateEdge project(
            TraversalNode start,
            TraversalNode end,
            Set<CubePoint> obstacles
    ) {
        if (start == null || end == null) {
            return new VerticalCandidateEdge(
                    start == null ? TraversalNodeId.waypoint(-1) : start.nodeId(),
                    end == null ? TraversalNodeId.waypoint(-1) : end.nodeId(),
                    List.of(),
                    Long.MAX_VALUE);
        }
        SearchVolume searchVolume = SearchVolume.enclosing(
                obstacles == null ? Set.of() : obstacles,
                terminalBounds(start),
                terminalBounds(end));
        TraversalTerminalResolver.TerminalResolution startResolution = resolveNode(start, searchVolume);
        TraversalTerminalResolver.TerminalResolution endResolution = resolveNode(end, searchVolume);
        List<StairCandidate> candidates = generateCandidates(start, end, startResolution.cells(), endResolution.cells(), searchVolume);
        long costHint = candidates.stream()
                .mapToLong(StairCandidate::costHint)
                .min()
                .orElse(Long.MAX_VALUE);
        return new VerticalCandidateEdge(start.nodeId(), end.nodeId(), candidates, costHint);
    }

    private static List<StairCandidate> generateCandidates(
            TraversalNode start,
            TraversalNode end,
            Set<CubePoint> startTerminals,
            Set<CubePoint> endTerminals,
            SearchVolume searchVolume
    ) {
        if (startTerminals.isEmpty() || endTerminals.isEmpty()) {
            return List.of();
        }
        TraversalNode lowerNode = start.levelZ() <= end.levelZ() ? start : end;
        TraversalNode upperNode = lowerNode == start ? end : start;
        Set<CubePoint> lowerTerminals = lowerNode == start ? startTerminals : endTerminals;
        Set<CubePoint> upperTerminals = lowerNode == start ? endTerminals : startTerminals;
        int minZ = lowerNode.levelZ();
        int maxZ = upperNode.levelZ();
        CandidateBounds bounds = CandidateBounds.enclosing(terminalBounds(start), terminalBounds(end));
        LinkedHashMap<StairPlacementKey, StairCandidate> candidates = new LinkedHashMap<>();
        for (CardinalDirection direction : CardinalDirection.values()) {
            List<AutomaticStairVariantCatalog.StairVariant> variants = AutomaticStairVariantCatalog.variantsFor(
                    direction,
                    minZ,
                    maxZ);
            for (AutomaticStairVariantCatalog.StairVariant variant : variants) {
                for (CubePoint lowerTerminal : lowerTerminals) {
                    addCandidate(
                            candidates,
                            start,
                            end,
                            variant.placementAnchorForLowerTerminal(lowerTerminal.projectedCell()),
                            variant,
                            lowerTerminals,
                            upperTerminals,
                            bounds,
                            searchVolume);
                }
                for (CubePoint upperTerminal : upperTerminals) {
                    addCandidate(
                            candidates,
                            start,
                            end,
                            variant.placementAnchorForUpperTerminal(upperTerminal.projectedCell()),
                            variant,
                            lowerTerminals,
                            upperTerminals,
                            bounds,
                            searchVolume);
                }
            }
        }
        if (candidates.isEmpty()) {
            return List.of();
        }
        ArrayList<StairCandidate> result = new ArrayList<>(candidates.values());
        result.sort(Comparator.comparingLong(StairCandidate::costHint));
        return List.copyOf(result);
    }

    private static void addCandidate(
            Map<StairPlacementKey, StairCandidate> candidates,
            TraversalNode start,
            TraversalNode end,
            Point2i anchor,
            AutomaticStairVariantCatalog.StairVariant variant,
            Set<CubePoint> lowerTerminals,
            Set<CubePoint> upperTerminals,
            CandidateBounds bounds,
            SearchVolume searchVolume
    ) {
        if (anchor == null || variant == null) {
            return;
        }
        List<CubePoint> path = variant.placeAt(anchor);
        if (path.isEmpty() || !bounds.containsAll(path) || !searchVolume.isFootprintPassable(path)) {
            return;
        }
        CubePoint lowerCell = path.getFirst();
        CubePoint upperCell = path.getLast();
        long lowerAttachCost = attachCost(lowerCell, lowerTerminals);
        long upperAttachCost = attachCost(upperCell, upperTerminals);
        if (lowerAttachCost == Long.MAX_VALUE || upperAttachCost == Long.MAX_VALUE) {
            return;
        }
        LinkedHashSet<Integer> exitLevels = new LinkedHashSet<>();
        for (int level = lowerCell.z(); level <= upperCell.z(); level++) {
            exitLevels.add(level);
        }
        CubePoint startCell = start.levelZ() <= end.levelZ() ? lowerCell : upperCell;
        CubePoint endCell = start.levelZ() <= end.levelZ() ? upperCell : lowerCell;
        long baseDistance = variant.stairPathLength() + lowerAttachCost + upperAttachCost;
        long costHint = TraversalPlanningCostModel.penalizeStairs(baseDistance, 1);
        StairCandidate candidate = new StairCandidate(
                anchor,
                variant.shape(),
                variant.direction(),
                variant.dimension1(),
                variant.dimension2(),
                List.copyOf(exitLevels),
                Set.copyOf(path),
                startCell,
                endCell,
                costHint);
        candidates.putIfAbsent(
                new StairPlacementKey(
                        candidate.anchor(),
                        candidate.shape(),
                        candidate.direction(),
                        candidate.dimension1(),
                        candidate.dimension2(),
                        candidate.exitLevels()),
                candidate);
    }

    private static TraversalTerminalResolver.TerminalResolution resolveNode(
            TraversalNode node,
            SearchVolume searchVolume
    ) {
        if (node == null) {
            return TraversalTerminalResolver.TerminalResolution.empty();
        }
        LocalSegmentRequest.LocalTerminal terminal = node.kind() == TraversalNode.TraversalNodeKind.ROOM_PORTAL
                ? new LocalSegmentRequest.RoomPortalTerminal(node)
                : LocalSegmentRequest.FixedCellsTerminal.of(node.anchorCells());
        return TraversalTerminalResolver.resolve(terminal, searchVolume);
    }

    private static Set<CubePoint> terminalBounds(TraversalNode node) {
        if (node == null) {
            return Set.of();
        }
        LocalSegmentRequest.LocalTerminal terminal = node.kind() == TraversalNode.TraversalNodeKind.ROOM_PORTAL
                ? new LocalSegmentRequest.RoomPortalTerminal(node)
                : LocalSegmentRequest.FixedCellsTerminal.of(node.anchorCells());
        return terminal.boundsPoints();
    }

    private static long attachCost(CubePoint stairTerminal, Set<CubePoint> terminalCells) {
        if (stairTerminal == null || terminalCells == null || terminalCells.isEmpty()) {
            return Long.MAX_VALUE;
        }
        long best = Long.MAX_VALUE;
        for (CubePoint terminalCell : terminalCells) {
            if (terminalCell == null || terminalCell.z() != stairTerminal.z()) {
                continue;
            }
            long distance = Math.abs((long) stairTerminal.x() - terminalCell.x())
                    + Math.abs((long) stairTerminal.y() - terminalCell.y());
            best = Math.min(best, distance);
        }
        return best;
    }

    private record StairPlacementKey(
            Point2i anchor,
            StairShape shape,
            CardinalDirection direction,
            int dimension1,
            int dimension2,
            List<Integer> exitLevels
    ) {
    }

    private record CandidateBounds(
            int minX,
            int minY,
            int maxX,
            int maxY
    ) {
        private static CandidateBounds enclosing(Set<CubePoint> first, Set<CubePoint> second) {
            int minX = Integer.MAX_VALUE;
            int minY = Integer.MAX_VALUE;
            int maxX = Integer.MIN_VALUE;
            int maxY = Integer.MIN_VALUE;
            for (CubePoint point : merge(first, second)) {
                minX = Math.min(minX, point.x());
                minY = Math.min(minY, point.y());
                maxX = Math.max(maxX, point.x());
                maxY = Math.max(maxY, point.y());
            }
            if (minX == Integer.MAX_VALUE) {
                minX = 0;
                minY = 0;
                maxX = 0;
                maxY = 0;
            }
            return new CandidateBounds(
                    minX - HORIZONTAL_PADDING,
                    minY - HORIZONTAL_PADDING,
                    maxX + HORIZONTAL_PADDING,
                    maxY + HORIZONTAL_PADDING);
        }

        private boolean containsAll(List<CubePoint> points) {
            for (CubePoint point : points == null ? List.<CubePoint>of() : points) {
                if (!contains(point)) {
                    return false;
                }
            }
            return true;
        }

        private boolean contains(CubePoint point) {
            return point != null
                    && point.x() >= minX
                    && point.x() <= maxX
                    && point.y() >= minY
                    && point.y() <= maxY;
        }

        private static Set<CubePoint> merge(Set<CubePoint> first, Set<CubePoint> second) {
            LinkedHashSet<CubePoint> result = new LinkedHashSet<>();
            if (first != null) {
                result.addAll(first);
            }
            if (second != null) {
                result.addAll(second);
            }
            return result;
        }
    }
}
