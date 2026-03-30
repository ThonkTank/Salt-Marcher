package features.world.dungeonmap.model.structures.traversal.routing.internal;

import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.corridor.CorridorEndpointPlan;
import features.world.dungeonmap.model.structures.corridor.CorridorTerminal;
import features.world.dungeonmap.model.structures.stair.DungeonStair;
import features.world.dungeonmap.model.structures.traversal.Traversal;
import features.world.dungeonmap.model.structures.traversal.TraversalRoute;
import features.world.dungeonmap.model.structures.traversal.TraversalStairPlacement;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.PriorityQueue;
import java.util.Set;

public final class TraversalGeometryRealizer {

    private TraversalGeometryRealizer() {
        throw new AssertionError("No instances");
    }

    public static TraversalRoute realize(Traversal traversal, TraversalStructurePlanner.StructurePlan structurePlan) {
        if (traversal == null) {
            return TraversalRoute.empty();
        }
        TraversalStructurePlanner.StructurePlan resolvedPlan = structurePlan == null
                ? TraversalStructurePlanner.StructurePlan.empty()
                : structurePlan;
        TraversalTopology topology = resolvedPlan.topology();
        if (topology.requiredRoomPortalNodes().size() < 2) {
            return TraversalRoute.empty();
        }
        List<TraversalStructurePlanner.TraversalEdge> selectedEdges = resolvedPlan.selectedEdges();
        TraversalRoute directAdjacencyRoute = directAdjacencyRoute(traversal, topology, selectedEdges);
        if (directAdjacencyRoute != null) {
            return directAdjacencyRoute;
        }
        RealizationState state = new RealizationState(traversal, topology);
        if (!realizeSelectedEdges(topology, state, selectedEdges)) {
            return state.unroutableRoute();
        }
        return state.toRoute();
    }

    private static boolean realizeSelectedEdges(
            TraversalTopology topology,
            RealizationState state,
            List<TraversalStructurePlanner.TraversalEdge> selectedEdges
    ) {
        for (TraversalStructurePlanner.TraversalEdge selectedEdge
                : selectedEdges == null ? List.<TraversalStructurePlanner.TraversalEdge>of() : selectedEdges) {
            if (selectedEdge == null) {
                continue;
            }
            TraversalNode start = topology.node(selectedEdge.startNodeKey());
            TraversalNode end = topology.node(selectedEdge.endNodeKey());
            if (start == null || end == null) {
                return false;
            }
            if (selectedEdge instanceof TraversalStructurePlanner.VerticalCandidateEdge verticalCandidateEdge) {
                if (!realizeVerticalEdge(topology, state, start, end, verticalCandidateEdge)) {
                    return false;
                }
                continue;
            }
            LocalSegmentResult segmentResult = routeSegment(
                    terminalFor(start, state),
                    terminalFor(end, state),
                    topology.obstacles());
            if (!recordSegment(state, start, end, segmentResult)) {
                return false;
            }
        }
        return true;
    }

    private static boolean realizeVerticalEdge(
            TraversalTopology topology,
            RealizationState state,
            TraversalNode start,
            TraversalNode end,
            TraversalStructurePlanner.VerticalCandidateEdge verticalCandidateEdge
    ) {
        VerticalEdgeRealization bestRealization = null;
        VerticalRealizationScore bestScore = null;
        for (TraversalStructurePlanner.StairCandidate stairCandidate : verticalCandidateEdge.stairCandidates()) {
            if (stairCandidate == null) {
                continue;
            }
            LocalSegmentResult prefix = routeSegment(
                    terminalFor(start, state),
                    LocalSegmentRequest.FixedCellsTerminal.of(List.of(stairCandidate.startCell())),
                    topology.obstacles());
            if (!prefix.routable()) {
                continue;
            }
            LocalSegmentResult suffix = routeSegment(
                    LocalSegmentRequest.FixedCellsTerminal.of(List.of(stairCandidate.endCell())),
                    terminalFor(end, state),
                    topology.obstacles());
            if (!suffix.routable()) {
                continue;
            }
            VerticalRealizationScore score = VerticalRealizationScore.of(prefix, suffix, stairCandidate);
            if (bestScore == null || score.compareTo(bestScore) < 0) {
                bestScore = score;
                bestRealization = new VerticalEdgeRealization(prefix, suffix, stairCandidate.toPlacement());
            }
        }
        if (bestRealization == null) {
            return false;
        }
        state.recordNode(start.nodeKey(), bestRealization.prefix().sourceCell());
        state.recordNode(end.nodeKey(), bestRealization.suffix().targetCell());
        state.recordPortal(start, bestRealization.prefix().sourceCell());
        state.recordPortal(end, bestRealization.suffix().targetCell());
        String verticalEdgeKey = edgeKey(start, end);
        state.addCorridorSegment(corridorSegmentKey(verticalEdgeKey, 0), start, null, bestRealization.prefix());
        state.addCorridorSegment(corridorSegmentKey(verticalEdgeKey, 1), null, end, bestRealization.suffix());
        state.addStairPlacement(stairSegmentKey(verticalEdgeKey), bestRealization.stairPlacement());
        return true;
    }

    static LocalSegmentResult routeSegment(
            LocalSegmentRequest.LocalTerminal source,
            LocalSegmentRequest.LocalTerminal target,
            Set<CubePoint> obstacles
    ) {
        return LocalTraversalRoutePlanner.route(new LocalSegmentRequest(source, target, obstacles));
    }

    private static boolean recordSegment(
            RealizationState state,
            TraversalNode start,
            TraversalNode end,
            LocalSegmentResult segmentResult
    ) {
        if (segmentResult == null || !segmentResult.routable()) {
            return false;
        }
        state.recordNode(start.nodeKey(), segmentResult.sourceCell());
        state.recordNode(end.nodeKey(), segmentResult.targetCell());
        state.recordPortal(start, segmentResult.sourceCell());
        state.recordPortal(end, segmentResult.targetCell());
        state.addCorridorSegment(corridorSegmentKey(edgeKey(start, end), 0), start, end, segmentResult);
        return true;
    }

    private static LocalSegmentRequest.LocalTerminal terminalFor(
            TraversalNode node,
            RealizationState state
    ) {
        if (node == null) {
            return LocalSegmentRequest.FixedCellsTerminal.of(List.of());
        }
        CubePoint realizedCell = state.realizedNodeCell(node.nodeKey());
        if (realizedCell != null) {
            return LocalSegmentRequest.FixedCellsTerminal.of(List.of(realizedCell));
        }
        if (node.kind() == TraversalNode.TraversalNodeKind.WAYPOINT) {
            return LocalSegmentRequest.FixedCellsTerminal.of(node.anchorCells());
        }
        return new LocalSegmentRequest.RoomPortalTerminal(node);
    }

    private static TraversalRoute directAdjacencyRoute(
            Traversal traversal,
            TraversalTopology topology,
            List<TraversalStructurePlanner.TraversalEdge> selectedEdges
    ) {
        if (topology == null
                || topology.hasWaypoints()
                || topology.requiredRoomPortalNodes().size() != 2
                || selectedEdges.size() != 1
                || !(selectedEdges.getFirst() instanceof TraversalStructurePlanner.HorizontalTraversalEdge)) {
            return null;
        }
        TraversalNode first = topology.requiredRoomPortalNodes().getFirst();
        TraversalNode second = topology.requiredRoomPortalNodes().getLast();
        AdjacentRoomPair adjacentRoomPair = findAdjacentRoomPair(first, second);
        if (adjacentRoomPair == null) {
            return null;
        }
        CorridorEndpointPlan firstPlan = CorridorEndpointPlan.fromOccupiedCells(
                CorridorTerminal.START,
                first == null ? null : first.roomId(),
                first == null ? Set.of() : first.occupiedCells(),
                adjacentRoomPair.secondRoomCell());
        CorridorEndpointPlan secondPlan = CorridorEndpointPlan.fromOccupiedCells(
                CorridorTerminal.END,
                second == null ? null : second.roomId(),
                second == null ? Set.of() : second.occupiedCells(),
                adjacentRoomPair.firstRoomCell());
        if (firstPlan == null || secondPlan == null) {
            return null;
        }
        String edgeKey = edgeKey(first, second);
        return new TraversalRoute(
                List.of(new TraversalRoute.CorridorSegment(
                        corridorSegmentKey(edgeKey, 0),
                        Corridor.plannedDirectAdjacency(traversal.mapId(), firstPlan, secondPlan))),
                List.of());
    }

    private static AdjacentRoomPair findAdjacentRoomPair(
            TraversalNode first,
            TraversalNode second
    ) {
        if (first == null || second == null) {
            return null;
        }
        java.util.Set<CubePoint> secondCells = second.occupiedCells();
        for (CubePoint firstCell : first.occupiedCells()) {
            if (firstCell == null) {
                continue;
            }
            for (Point2i step : Point2i.CARDINAL_STEPS) {
                CubePoint secondCell = CubePoint.at(firstCell.projectedCell().add(step), firstCell.z());
                if (secondCells.contains(secondCell)) {
                    return new AdjacentRoomPair(firstCell, secondCell);
                }
            }
        }
        return null;
    }

    private record AdjacentRoomPair(
            CubePoint firstRoomCell,
            CubePoint secondRoomCell
    ) {
    }

    private record VerticalEdgeRealization(
            LocalSegmentResult prefix,
            LocalSegmentResult suffix,
            TraversalStairPlacement stairPlacement
    ) {
    }

    private record VerticalRealizationScore(
            long totalDistance,
            int profileSize,
            int profileArea,
            int shapePriority,
            int dimension1,
            int dimension2,
            int directionPriority,
            Point2i anchor
    ) implements Comparable<VerticalRealizationScore> {
        private static VerticalRealizationScore of(
                LocalSegmentResult prefix,
                LocalSegmentResult suffix,
                TraversalStructurePlanner.StairCandidate stairCandidate
        ) {
            return new VerticalRealizationScore(
                    (long) prefix.pathCells().size() + stairCandidate.stairPathLength() + suffix.pathCells().size(),
                    stairCandidate.profileSize(),
                    stairCandidate.profileArea(),
                    shapePriority(stairCandidate.shape()),
                    stairCandidate.dimension1(),
                    stairCandidate.dimension2(),
                    stairCandidate.direction().ordinal(),
                    stairCandidate.anchor());
        }

        @Override
        public int compareTo(VerticalRealizationScore other) {
            int totalDistanceComparison = Long.compare(totalDistance, other.totalDistance);
            if (totalDistanceComparison != 0) {
                return totalDistanceComparison;
            }
            int profileSizeComparison = Integer.compare(profileSize, other.profileSize);
            if (profileSizeComparison != 0) {
                return profileSizeComparison;
            }
            int profileAreaComparison = Integer.compare(profileArea, other.profileArea);
            if (profileAreaComparison != 0) {
                return profileAreaComparison;
            }
            int shapeComparison = Integer.compare(shapePriority, other.shapePriority);
            if (shapeComparison != 0) {
                return shapeComparison;
            }
            int dimension1Comparison = Integer.compare(dimension1, other.dimension1);
            if (dimension1Comparison != 0) {
                return dimension1Comparison;
            }
            int dimension2Comparison = Integer.compare(dimension2, other.dimension2);
            if (dimension2Comparison != 0) {
                return dimension2Comparison;
            }
            int directionComparison = Integer.compare(directionPriority, other.directionPriority);
            if (directionComparison != 0) {
                return directionComparison;
            }
            return Point2i.POINT_ORDER.compare(anchor, other.anchor);
        }

        private static int shapePriority(features.world.dungeonmap.model.structures.stair.StairShape shape) {
            return switch (shape) {
                case STRAIGHT -> 0;
                case SQUARE -> 1;
                case RECTANGULAR -> 2;
                case CIRCULAR -> 3;
                case LADDER -> 4;
            };
        }
    }

    private static final class RealizationState {

        private final Traversal traversal;
        private final TraversalTopology topology;
        private final List<TraversalRoute.CorridorSegment> corridorSegments = new ArrayList<>();
        private final List<TraversalRoute.StairSegment> stairSegments = new ArrayList<>();
        private final Map<String, CubePoint> realizedNodeCellsById = new LinkedHashMap<>();
        private final Map<String, CubePoint> portalEntryCellsByNodeId = new LinkedHashMap<>();

        private RealizationState(Traversal traversal, TraversalTopology topology) {
            this.traversal = traversal;
            this.topology = topology == null ? TraversalTopology.empty() : topology;
        }

        private CubePoint realizedNodeCell(String nodeKey) {
            return nodeKey == null || nodeKey.isBlank() ? null : realizedNodeCellsById.get(nodeKey);
        }

        private void recordNode(String nodeKey, CubePoint cell) {
            if (nodeKey != null && !nodeKey.isBlank() && cell != null) {
                realizedNodeCellsById.putIfAbsent(nodeKey, cell);
            }
        }

        private void recordPortal(TraversalNode node, CubePoint entryCell) {
            if (node == null || node.kind() != TraversalNode.TraversalNodeKind.ROOM_PORTAL) {
                return;
            }
            recordPortalEntry(node.nodeKey(), entryCell);
        }

        private void recordPortalEntry(String portalNodeKey, CubePoint entryCell) {
            if (portalNodeKey != null && !portalNodeKey.isBlank() && entryCell != null) {
                portalEntryCellsByNodeId.putIfAbsent(portalNodeKey, entryCell);
            }
        }

        private TraversalRoute unroutableRoute() {
            return TraversalRoute.empty();
        }

        private void addCorridorSegment(
                String segmentKey,
                TraversalNode start,
                TraversalNode end,
                LocalSegmentResult segmentResult
        ) {
            if (segmentKey == null || segmentResult == null || !segmentResult.routable()) {
                return;
            }
            ArrayList<CorridorEndpointPlan> endpointPlans = new ArrayList<>();
            CorridorEndpointPlan startPlan = CorridorEndpointPlan.fromOccupiedCells(
                    CorridorTerminal.START,
                    start == null ? null : start.roomId(),
                    start == null ? Set.of() : start.occupiedCells(),
                    segmentResult.sourceCell());
            if (startPlan != null) {
                endpointPlans.add(startPlan);
            }
            CorridorEndpointPlan endPlan = CorridorEndpointPlan.fromOccupiedCells(
                    CorridorTerminal.END,
                    end == null ? null : end.roomId(),
                    end == null ? Set.of() : end.occupiedCells(),
                    segmentResult.targetCell());
            if (endPlan != null) {
                endpointPlans.add(endPlan);
            }
            Corridor corridor = Corridor.plannedFromPathCells(traversal.mapId(), segmentResult.pathCells(), endpointPlans);
            if (corridor == null) {
                return;
            }
            corridorSegments.add(new TraversalRoute.CorridorSegment(
                    segmentKey,
                    corridor));
        }

        private void addStairPlacement(String segmentKey, TraversalStairPlacement stairPlacement) {
            if (segmentKey != null && stairPlacement != null) {
                stairSegments.add(new TraversalRoute.StairSegment(
                        segmentKey,
                        DungeonStair.materialized(stairPlacement.stair(), null, traversal.mapId())));
            }
        }

        private TraversalRoute toRoute() {
            boolean routable = portalEntryCellsByNodeId.size() >= topology.requiredRoomPortalNodes().size()
                    && (!corridorSegments.isEmpty() || !stairSegments.isEmpty());
            return routable
                    ? new TraversalRoute(List.copyOf(corridorSegments), List.copyOf(stairSegments))
                    : TraversalRoute.empty();
        }
    }

    private static String corridorSegmentKey(String edgeKey, int ordinal) {
        return "H:" + edgeKey + "#" + ordinal;
    }

    private static String stairSegmentKey(String edgeKey) {
        return "V:" + edgeKey + "#0";
    }

    private static String edgeKey(TraversalNode start, TraversalNode end) {
        return edgeKey(start == null ? null : start.nodeKey(), end == null ? null : end.nodeKey());
    }

    private static String edgeKey(String startNodeKey, String endNodeKey) {
        String start = startNodeKey == null ? "" : startNodeKey;
        String end = endNodeKey == null ? "" : endNodeKey;
        return start.compareTo(end) <= 0 ? start + "->" + end : end + "->" + start;
    }

    record LocalSegmentRequest(
            LocalTerminal source,
            LocalTerminal target,
            Set<CubePoint> obstacles
    ) {
        LocalSegmentRequest {
            java.util.Objects.requireNonNull(source, "source");
            java.util.Objects.requireNonNull(target, "target");
            obstacles = normalizePoints(obstacles);
        }

        sealed interface LocalTerminal permits RoomPortalTerminal, FixedCellsTerminal {
            Set<CubePoint> boundsPoints();
        }

        record RoomPortalTerminal(
                TraversalNode portal
        ) implements LocalTerminal {
            RoomPortalTerminal {
                java.util.Objects.requireNonNull(portal, "portal");
            }

            @Override
            public Set<CubePoint> boundsPoints() {
                LinkedHashSet<CubePoint> result = new LinkedHashSet<>(portal.occupiedCells());
                if (portal.anchor() != null) {
                    result.add(portal.anchor());
                }
                return result.isEmpty() ? Set.of() : Set.copyOf(result);
            }
        }

        record FixedCellsTerminal(
                Set<CubePoint> cells
        ) implements LocalTerminal {
            FixedCellsTerminal {
                cells = normalizePoints(cells);
            }

            static FixedCellsTerminal of(Collection<CubePoint> cells) {
                return new FixedCellsTerminal(cells == null ? Set.of() : Set.copyOf(cells));
            }

            @Override
            public Set<CubePoint> boundsPoints() {
                return cells;
            }
        }

        private static Set<CubePoint> normalizePoints(Collection<CubePoint> points) {
            if (points == null || points.isEmpty()) {
                return Set.of();
            }
            LinkedHashSet<CubePoint> result = new LinkedHashSet<>();
            for (CubePoint point : points) {
                if (point != null) {
                    result.add(point);
                }
            }
            return result.isEmpty() ? Set.of() : Set.copyOf(result);
        }
    }

    record LocalSegmentResult(
            List<CubePoint> pathCells,
            CubePoint sourceCell,
            CubePoint targetCell
    ) {
        LocalSegmentResult {
            pathCells = pathCells == null ? List.of() : List.copyOf(pathCells);
        }

        static LocalSegmentResult unroutable() {
            return new LocalSegmentResult(List.of(), null, null);
        }

        boolean routable() {
            return sourceCell != null && targetCell != null && !pathCells.isEmpty();
        }

        Set<CubePoint> corridorCells() {
            if (pathCells.isEmpty()) {
                return Set.of();
            }
            LinkedHashSet<CubePoint> result = new LinkedHashSet<>();
            for (CubePoint pathCell : pathCells) {
                if (pathCell != null) {
                    result.add(pathCell);
                }
            }
            return result.isEmpty() ? Set.of() : Set.copyOf(result);
        }
    }

    static final class LocalTraversalRoutePlanner {

        private LocalTraversalRoutePlanner() {
            throw new AssertionError("No instances");
        }

        static LocalSegmentResult route(LocalSegmentRequest request) {
            PlannerContext context = new PlannerContext(request);
            if (!context.isRoutable()) {
                return LocalSegmentResult.unroutable();
            }
            CostField.ExtractedPath extractedPath = CostField.route(context);
            if (extractedPath.isEmpty()) {
                return LocalSegmentResult.unroutable();
            }
            return new LocalSegmentResult(
                    extractedPath.cells(),
                    extractedPath.cells().getFirst(),
                    extractedPath.cells().getLast());
        }

        private static final class PlannerContext {

            private final SearchVolume searchVolume;
            private final Set<CubePoint> sourceCells;
            private final Set<CubePoint> targetCells;
            private final Map<CubePoint, Integer> sourceDirectionIndexByCell;

            private PlannerContext(LocalSegmentRequest request) {
                LocalSegmentRequest resolvedRequest = request == null
                        ? new LocalSegmentRequest(
                        LocalSegmentRequest.FixedCellsTerminal.of(Set.of()),
                        LocalSegmentRequest.FixedCellsTerminal.of(Set.of()),
                        Set.of())
                        : request;
                this.searchVolume = SearchVolume.enclosing(
                        resolvedRequest.obstacles(),
                        resolvedRequest.source().boundsPoints(),
                        resolvedRequest.target().boundsPoints());
                TerminalResolution sourceResolution = resolve(resolvedRequest.source(), searchVolume);
                TerminalResolution targetResolution = resolve(resolvedRequest.target(), searchVolume);
                this.sourceCells = sourceResolution.cells();
                this.targetCells = targetResolution.cells();
                this.sourceDirectionIndexByCell = sourceResolution.directionIndices();
            }

            private boolean isRoutable() {
                return !sourceCells.isEmpty() && !targetCells.isEmpty();
            }

            private SearchVolume searchVolume() {
                return searchVolume;
            }

            private Set<CubePoint> sourceCells() {
                return sourceCells;
            }

            private Set<CubePoint> targetCells() {
                return targetCells;
            }

            private int sourceDirectionIndex(CubePoint cell) {
                return cell == null ? -1 : sourceDirectionIndexByCell.getOrDefault(cell, -1);
            }

            private static TerminalResolution resolve(
                    LocalSegmentRequest.LocalTerminal terminal,
                    SearchVolume searchVolume
            ) {
                if (terminal instanceof LocalSegmentRequest.RoomPortalTerminal roomPortalTerminal) {
                    return resolveRoomPortal(roomPortalTerminal.portal(), searchVolume);
                }
                if (terminal instanceof LocalSegmentRequest.FixedCellsTerminal fixedCellsTerminal) {
                    return resolveFixedCells(fixedCellsTerminal.cells(), searchVolume);
                }
                return TerminalResolution.empty();
            }

            private static TerminalResolution resolveFixedCells(
                    Set<CubePoint> cells,
                    SearchVolume searchVolume
            ) {
                if (cells == null || cells.isEmpty()) {
                    return TerminalResolution.empty();
                }
                LinkedHashSet<CubePoint> result = new LinkedHashSet<>();
                for (CubePoint cell : cells) {
                    if (cell != null && searchVolume.isPassable(cell)) {
                        result.add(cell);
                    }
                }
                return result.isEmpty()
                        ? TerminalResolution.empty()
                        : new TerminalResolution(Set.copyOf(result), Map.of());
            }

            private static TerminalResolution resolveRoomPortal(
                    TraversalNode portal,
                    SearchVolume searchVolume
            ) {
                if (portal == null || portal.kind() != TraversalNode.TraversalNodeKind.ROOM_PORTAL) {
                    return TerminalResolution.empty();
                }
                LinkedHashSet<CubePoint> result = new LinkedHashSet<>();
                LinkedHashMap<CubePoint, Integer> directionIndices = new LinkedHashMap<>();
                TraversalNode.FixedDoorBinding binding = portal.fixedDoorBinding();
                if (portal.hasFixedDoorBinding() && binding != null) {
                    int directionIndex = directionIndex(binding.direction());
                    CubePoint boundEntry = portal.boundEntryCell();
                    if (searchVolume.isPassable(boundEntry)) {
                        result.add(boundEntry);
                        if (directionIndex >= 0) {
                            directionIndices.putIfAbsent(boundEntry, directionIndex);
                        }
                    }
                    return result.isEmpty()
                            ? TerminalResolution.empty()
                            : new TerminalResolution(Set.copyOf(result), Map.copyOf(directionIndices));
                }

                for (CubePoint occupiedCell : portal.occupiedCells()) {
                    if (occupiedCell == null) {
                        continue;
                    }
                    for (Point2i step : Point2i.CARDINAL_STEPS) {
                        CubePoint candidate = CubePoint.at(occupiedCell.projectedCell().add(step), occupiedCell.z());
                        if (portal.occupiedCells().contains(candidate) || !searchVolume.isPassable(candidate)) {
                            continue;
                        }
                        result.add(candidate);
                        int directionIndex = directionIndex(step);
                        if (directionIndex >= 0) {
                            directionIndices.putIfAbsent(candidate, directionIndex);
                        }
                    }
                }
                return result.isEmpty()
                        ? TerminalResolution.empty()
                        : new TerminalResolution(Set.copyOf(result), Map.copyOf(directionIndices));
            }

            private static int directionIndex(Point2i step) {
                features.world.dungeonmap.model.geometry.CardinalDirection direction =
                        features.world.dungeonmap.model.geometry.CardinalDirection.fromDirection(step);
                if (direction == null) {
                    return -1;
                }
                return switch (direction) {
                    case NORTH -> 0;
                    case EAST -> 1;
                    case SOUTH -> 2;
                    case WEST -> 3;
                };
            }

            private record TerminalResolution(
                    Set<CubePoint> cells,
                    Map<CubePoint, Integer> directionIndices
            ) {
                private TerminalResolution {
                    cells = cells == null ? Set.of() : Set.copyOf(cells);
                    directionIndices = directionIndices == null ? Map.of() : Map.copyOf(directionIndices);
                }

                private static TerminalResolution empty() {
                    return new TerminalResolution(Set.of(), Map.of());
                }
            }
        }
    }

    private static final class CostField {

        private static final List<CubePoint> HORIZONTAL_STEPS = List.of(
                new CubePoint(0, -1, 0),
                new CubePoint(1, 0, 0),
                new CubePoint(0, 1, 0),
                new CubePoint(-1, 0, 0));

        private CostField() {
            throw new AssertionError("No instances");
        }

        private static ExtractedPath route(LocalTraversalRoutePlanner.PlannerContext context) {
            return extractPath(flood(context));
        }

        private static FloodResult flood(LocalTraversalRoutePlanner.PlannerContext context) {
            if (context == null || !context.isRoutable()) {
                return FloodResult.empty();
            }
            PriorityQueue<PathNode> open = new PriorityQueue<>(Comparator.comparing(PathNode::score));
            Map<PathState, RouteCost> best = new HashMap<>();
            Map<PathState, PathState> predecessors = new HashMap<>();
            Map<CubePoint, PathState> bestStateByPoint = new HashMap<>();
            for (CubePoint sourceCell : context.sourceCells()) {
                PathState sourceState = new PathState(sourceCell, context.sourceDirectionIndex(sourceCell), -1);
                RouteCost sourceCost = new RouteCost(0, 0, 0);
                best.put(sourceState, sourceCost);
                bestStateByPoint.put(sourceCell, sourceState);
                open.add(new PathNode(sourceState, sourceCost));
            }
            while (!open.isEmpty()) {
                PathNode node = open.poll();
                if (!node.score().equals(best.get(node.state()))) {
                    continue;
                }
                CubePoint cell = node.state().point();
                if (context.targetCells().contains(cell)) {
                    return new FloodResult(best, predecessors, bestStateByPoint, cell);
                }
                expandHorizontalNeighbors(node, context.searchVolume(), best, predecessors, bestStateByPoint, open);
            }
            return new FloodResult(best, predecessors, bestStateByPoint, null);
        }

        private static ExtractedPath extractPath(FloodResult result) {
            if (result == null || result.reachedTarget() == null) {
                return ExtractedPath.empty();
            }
            PathState bestTargetState = result.bestStateAt(result.reachedTarget());
            if (bestTargetState == null) {
                return ExtractedPath.empty();
            }
            ArrayDeque<CubePoint> pathCells = new ArrayDeque<>();
            PathState current = bestTargetState;
            pathCells.addFirst(current.point());
            while (result.predecessors().containsKey(current)) {
                current = result.predecessors().get(current);
                pathCells.addFirst(current.point());
            }
            return new ExtractedPath(List.copyOf(pathCells));
        }

        private static void expandHorizontalNeighbors(
                PathNode node,
                SearchVolume volume,
                Map<PathState, RouteCost> best,
                Map<PathState, PathState> predecessors,
                Map<CubePoint, PathState> bestStateByPoint,
                PriorityQueue<PathNode> open
        ) {
            CubePoint cell = node.state().point();
            for (int directionIndex = 0; directionIndex < HORIZONTAL_STEPS.size(); directionIndex++) {
                if (directionIndex == node.state().blockedOppositeDirectionIndex()) {
                    continue;
                }
                CubePoint next = cell.add(HORIZONTAL_STEPS.get(directionIndex));
                if (!volume.isPassable(next)) {
                    continue;
                }
                int nextCorners = node.score().corners();
                int previousDirection = node.state().directionIndex();
                if (previousDirection >= 0 && previousDirection < 4 && previousDirection != directionIndex) {
                    nextCorners++;
                }
                PathState nextState = new PathState(next, directionIndex, -1);
                RouteCost nextCost = new RouteCost(
                        node.score().distance() + 1,
                        nextCorners,
                        node.score().levelChanges());
                relaxState(node.state(), nextState, nextCost, best, predecessors, bestStateByPoint, open);
            }
        }

        private static void relaxState(
                PathState previousState,
                PathState nextState,
                RouteCost nextCost,
                Map<PathState, RouteCost> best,
                Map<PathState, PathState> predecessors,
                Map<CubePoint, PathState> bestStateByPoint,
                PriorityQueue<PathNode> open
        ) {
            RouteCost known = best.get(nextState);
            if (known != null && known.compareTo(nextCost) <= 0) {
                return;
            }
            best.put(nextState, nextCost);
            updateBestStateByPoint(bestStateByPoint, best, nextState, nextCost);
            predecessors.put(nextState, previousState);
            open.add(new PathNode(nextState, nextCost));
        }

        private static void updateBestStateByPoint(
                Map<CubePoint, PathState> bestStateByPoint,
                Map<PathState, RouteCost> best,
                PathState candidateState,
                RouteCost candidateCost
        ) {
            PathState currentBestState = bestStateByPoint.get(candidateState.point());
            if (currentBestState == null) {
                bestStateByPoint.put(candidateState.point(), candidateState);
                return;
            }
            RouteCost currentBestCost = best.get(currentBestState);
            if (currentBestCost == null || candidateCost.compareTo(currentBestCost) < 0) {
                bestStateByPoint.put(candidateState.point(), candidateState);
            }
        }

        private static int compareRoutePriority(
                int distance,
                int corners,
                int levelChanges,
                int otherDistance,
                int otherCorners,
                int otherLevelChanges
        ) {
            int valueComparison = Integer.compare(
                    routeValue(distance, corners, levelChanges),
                    routeValue(otherDistance, otherCorners, otherLevelChanges));
            if (valueComparison != 0) {
                return valueComparison;
            }
            int levelChangeComparison = Integer.compare(levelChanges, otherLevelChanges);
            if (levelChangeComparison != 0) {
                return levelChangeComparison;
            }
            int cornerComparison = Integer.compare(corners, otherCorners);
            if (cornerComparison != 0) {
                return cornerComparison;
            }
            return Integer.compare(distance, otherDistance);
        }

        private static int routeValue(int distance, int corners, int levelChanges) {
            return distance
                    + corners * cornerPenaltyTiles(distance)
                    + levelChanges * 10;
        }

        private static int cornerPenaltyTiles(int distance) {
            if (distance <= 0) {
                return 5;
            }
            int relaxedPenalty = 5 - (distance / 12);
            return Math.max(2, relaxedPenalty);
        }

        private record RouteCost(int distance, int corners, int levelChanges) implements Comparable<RouteCost> {
            @Override
            public int compareTo(RouteCost other) {
                return compareRoutePriority(
                        distance,
                        corners,
                        levelChanges,
                        other.distance,
                        other.corners,
                        other.levelChanges);
            }
        }

        private record PathState(CubePoint point, int directionIndex, int blockedOppositeDirectionIndex) {
        }

        private record PathNode(PathState state, RouteCost score) {
        }

        private record FloodResult(
                Map<PathState, RouteCost> costs,
                Map<PathState, PathState> predecessors,
                Map<CubePoint, PathState> bestStateByPoint,
                CubePoint reachedTarget
        ) {
            private FloodResult {
                costs = costs == null ? Map.of() : Map.copyOf(costs);
                predecessors = predecessors == null ? Map.of() : Map.copyOf(predecessors);
                bestStateByPoint = bestStateByPoint == null ? Map.of() : Map.copyOf(bestStateByPoint);
            }

            private static FloodResult empty() {
                return new FloodResult(Map.of(), Map.of(), Map.of(), null);
            }

            private PathState bestStateAt(CubePoint point) {
                return point == null ? null : bestStateByPoint.get(point);
            }
        }

        private record ExtractedPath(
                List<CubePoint> cells
        ) {
            private ExtractedPath {
                cells = cells == null ? List.of() : List.copyOf(cells);
            }

            private static ExtractedPath empty() {
                return new ExtractedPath(List.of());
            }

            private boolean isEmpty() {
                return cells.isEmpty();
            }
        }
    }

    static final class SearchVolume {

        private static final int HORIZONTAL_PADDING = 6;
        private static final int VERTICAL_PADDING = 1;

        private final int minX;
        private final int minY;
        private final int minZ;
        private final int maxX;
        private final int maxY;
        private final int maxZ;
        private final boolean[][][] blocked;

        private SearchVolume(int minX, int minY, int minZ, int maxX, int maxY, int maxZ, boolean[][][] blocked) {
            this.minX = minX;
            this.minY = minY;
            this.minZ = minZ;
            this.maxX = maxX;
            this.maxY = maxY;
            this.maxZ = maxZ;
            this.blocked = blocked;
        }

        static SearchVolume enclosing(
                Set<CubePoint> obstacles,
                Collection<CubePoint> sourceBounds,
                Collection<CubePoint> targetBounds
        ) {
            LinkedHashSet<CubePoint> boundsPoints = new LinkedHashSet<>();
            addPoints(boundsPoints, obstacles);
            addPoints(boundsPoints, sourceBounds);
            addPoints(boundsPoints, targetBounds);
            if (boundsPoints.isEmpty()) {
                boundsPoints.add(new CubePoint(0, 0, 0));
            }
            int minX = Integer.MAX_VALUE;
            int minY = Integer.MAX_VALUE;
            int minZ = Integer.MAX_VALUE;
            int maxX = Integer.MIN_VALUE;
            int maxY = Integer.MIN_VALUE;
            int maxZ = Integer.MIN_VALUE;
            for (CubePoint point : boundsPoints) {
                minX = Math.min(minX, point.x());
                minY = Math.min(minY, point.y());
                minZ = Math.min(minZ, point.z());
                maxX = Math.max(maxX, point.x());
                maxY = Math.max(maxY, point.y());
                maxZ = Math.max(maxZ, point.z());
            }
            boolean supportsVerticalTravel = minZ != maxZ;
            minX -= HORIZONTAL_PADDING;
            minY -= HORIZONTAL_PADDING;
            maxX += HORIZONTAL_PADDING;
            maxY += HORIZONTAL_PADDING;
            if (supportsVerticalTravel) {
                minZ -= VERTICAL_PADDING;
                maxZ += VERTICAL_PADDING;
            }
            boolean[][][] blocked = new boolean[maxX - minX + 1][maxY - minY + 1][maxZ - minZ + 1];
            for (CubePoint obstacle : obstacles == null ? Set.<CubePoint>of() : obstacles) {
                int x = obstacle.x() - minX;
                int y = obstacle.y() - minY;
                int z = obstacle.z() - minZ;
                if (x >= 0 && x < blocked.length
                        && y >= 0 && y < blocked[x].length
                        && z >= 0 && z < blocked[x][y].length) {
                    blocked[x][y][z] = true;
                }
            }
            return new SearchVolume(minX, minY, minZ, maxX, maxY, maxZ, blocked);
        }

        boolean isPassable(CubePoint point) {
            return isInBounds(point) && !blocked[point.x() - minX][point.y() - minY][point.z() - minZ];
        }

        boolean isFootprintPassable(Collection<CubePoint> cells) {
            if (cells == null || cells.isEmpty()) {
                return false;
            }
            for (CubePoint cell : cells) {
                if (!isPassable(cell)) {
                    return false;
                }
            }
            return true;
        }

        boolean isInBounds(CubePoint point) {
            return point != null
                    && point.x() >= minX
                    && point.x() <= maxX
                    && point.y() >= minY
                    && point.y() <= maxY
                    && point.z() >= minZ
                    && point.z() <= maxZ;
        }

        int minZ() {
            return minZ;
        }

        int maxZ() {
            return maxZ;
        }

        private static void addPoints(Set<CubePoint> target, Collection<CubePoint> points) {
            if (target == null || points == null) {
                return;
            }
            for (CubePoint point : points) {
                if (point != null) {
                    target.add(point);
                }
            }
        }
    }
}
