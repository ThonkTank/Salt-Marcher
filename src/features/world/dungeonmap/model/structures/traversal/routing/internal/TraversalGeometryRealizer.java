package features.world.dungeonmap.model.structures.traversal.routing.internal;

import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.GridAnchor;
import features.world.dungeonmap.model.geometry.GridRoute;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.geometry.VertexEdge;
import features.world.dungeonmap.model.objects.CorridorPath;
import features.world.dungeonmap.model.objects.Door;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.connection.ConnectionEndpoint;
import features.world.dungeonmap.model.structures.connection.CorridorConnection;
import features.world.dungeonmap.model.structures.stair.DungeonStair;
import features.world.dungeonmap.model.structures.traversal.Traversal;
import features.world.dungeonmap.model.structures.traversal.TraversalRoute;
import features.world.dungeonmap.model.structures.traversal.TraversalStairPlacement;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
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
        GridRoute route = buildRoute(topology);
        if (topology.requiredRoomPortalNodes().size() < 2) {
            return TraversalRoute.empty();
        }
        List<TraversalEdge> selectedEdges = resolvedPlan.selectedEdges();
        TraversalRoute directAdjacencyRoute = directAdjacencyRoute(traversal, topology, route, selectedEdges);
        if (directAdjacencyRoute != null) {
            return directAdjacencyRoute;
        }
        RealizationState state = new RealizationState(traversal, topology, route);
        if (!realizeSelectedEdges(topology, state, selectedEdges)) {
            return state.unroutableRoute();
        }
        return state.toRoute();
    }

    private static boolean realizeSelectedEdges(
            TraversalTopology topology,
            RealizationState state,
            List<TraversalEdge> selectedEdges
    ) {
        for (TraversalEdge selectedEdge : selectedEdges == null ? List.<TraversalEdge>of() : selectedEdges) {
            if (selectedEdge == null) {
                continue;
            }
            TraversalNode start = topology.node(selectedEdge.startNodeId());
            TraversalNode end = topology.node(selectedEdge.endNodeId());
            if (start == null || end == null) {
                return false;
            }
            if (selectedEdge instanceof VerticalCandidateEdge verticalCandidateEdge) {
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
            VerticalCandidateEdge verticalCandidateEdge
    ) {
        VerticalEdgeRealization bestRealization = null;
        VerticalRealizationScore bestScore = null;
        for (StairCandidate stairCandidate : verticalCandidateEdge.stairCandidates()) {
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
        state.recordNode(start.nodeId(), bestRealization.prefix().sourceCell());
        state.recordNode(end.nodeId(), bestRealization.suffix().targetCell());
        state.recordPortal(start, bestRealization.prefix().sourceCell());
        state.recordPortal(end, bestRealization.suffix().targetCell());
        state.addCorridorCells(bestRealization.prefix());
        state.addCorridorCells(bestRealization.suffix());
        String verticalEdgeKey = edgeKey(start, end);
        state.addStairPlacement(stairSegmentKey(verticalEdgeKey), bestRealization.stairPlacement());
        return true;
    }

    private static LocalSegmentResult routeSegment(
            LocalSegmentRequest.LocalTerminal source,
            LocalSegmentRequest.LocalTerminal target,
            java.util.Set<CubePoint> obstacles
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
        state.recordNode(start.nodeId(), segmentResult.sourceCell());
        state.recordNode(end.nodeId(), segmentResult.targetCell());
        state.recordPortal(start, segmentResult.sourceCell());
        state.recordPortal(end, segmentResult.targetCell());
        state.addCorridorCells(segmentResult);
        return true;
    }

    private static LocalSegmentRequest.LocalTerminal terminalFor(
            TraversalNode node,
            RealizationState state
    ) {
        if (node == null) {
            return LocalSegmentRequest.FixedCellsTerminal.of(List.of());
        }
        CubePoint realizedCell = state.realizedNodeCell(node.nodeId());
        if (realizedCell != null) {
            return LocalSegmentRequest.FixedCellsTerminal.of(List.of(realizedCell));
        }
        if (node.kind() == TraversalNode.TraversalNodeKind.WAYPOINT) {
            return LocalSegmentRequest.FixedCellsTerminal.of(node.anchorCells());
        }
        return new LocalSegmentRequest.RoomPortalTerminal(node);
    }

    private static GridRoute buildRoute(TraversalTopology topology) {
        if (topology == null || topology.backboneNodes().isEmpty()) {
            return GridRoute.empty();
        }
        ArrayList<GridAnchor> anchors = new ArrayList<>();
        for (TraversalNode backboneNode : topology.backboneNodes()) {
            if (backboneNode != null && backboneNode.anchor() != null) {
                anchors.add(GridAnchor.atTile(backboneNode.anchor().projectedCell()));
            }
        }
        return anchors.isEmpty() ? GridRoute.empty() : new GridRoute(anchors);
    }

    private static TraversalRoute directAdjacencyRoute(
            Traversal traversal,
            TraversalTopology topology,
            GridRoute route,
            List<TraversalEdge> selectedEdges
    ) {
        if (topology == null
                || topology.hasWaypoints()
                || topology.requiredRoomPortalNodes().size() != 2
                || selectedEdges.size() != 1
                || !(selectedEdges.getFirst() instanceof HorizontalTraversalEdge)) {
            return null;
        }
        TraversalNode first = topology.requiredRoomPortalNodes().getFirst();
        TraversalNode second = topology.requiredRoomPortalNodes().getLast();
        AdjacentRoomPair adjacentRoomPair = findAdjacentRoomPair(first, second);
        if (adjacentRoomPair == null) {
            return null;
        }
        ArrayList<CorridorConnection> connections = new ArrayList<>();
        CorridorConnection firstConnection = directAdjacencyConnection(
                null,
                topology.mapId(),
                first,
                adjacentRoomPair.firstRoomCell(),
                adjacentRoomPair.stepToSecond());
        if (firstConnection != null) {
            connections.add(firstConnection);
        }
        Point2i reverseStep = new Point2i(-adjacentRoomPair.stepToSecond().x(), -adjacentRoomPair.stepToSecond().y());
        CorridorConnection secondConnection = directAdjacencyConnection(
                null,
                topology.mapId(),
                second,
                adjacentRoomPair.secondRoomCell(),
                reverseStep);
        if (secondConnection != null) {
            connections.add(secondConnection);
        }
        if (connections.size() < 2) {
            return null;
        }
        String edgeKey = edgeKey(first, second);
        return new TraversalRoute(
                List.of(new TraversalRoute.CorridorSegment(
                        corridorSegmentKey(edgeKey, 0),
                        Corridor.planned(
                                traversal.mapId(),
                                traversal.roomIds(),
                                new CorridorPath(route, java.util.Set.of(), true, true),
                                rebindConnections(List.copyOf(connections), null)))),
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
                    return new AdjacentRoomPair(firstCell, secondCell, step);
                }
            }
        }
        return null;
    }

    private static CorridorConnection directAdjacencyConnection(
            Long corridorId,
            long mapId,
            TraversalNode portal,
            CubePoint roomCell,
            Point2i stepToCorridor
    ) {
        if (portal == null || portal.roomId() == null || roomCell == null || stepToCorridor == null) {
            return null;
        }
        VertexEdge edge = VertexEdge.betweenCellAndStep(roomCell.projectedCell(), stepToCorridor);
        return new CorridorConnection(
                corridorId,
                mapId,
                new Door(List.of(edge), Door.TraversalState.CLOSED),
                List.of(ConnectionEndpoint.room(portal.roomId()), ConnectionEndpoint.corridor(corridorId)),
                roomCell.z());
    }

    private static CorridorConnection corridorConnection(
            Long corridorId,
            long mapId,
            TraversalNode portal,
            CubePoint entryCell
    ) {
        if (portal == null || portal.roomId() == null || entryCell == null) {
            return null;
        }
        VertexEdge boundaryEdge = boundaryEdge(portal, entryCell);
        if (boundaryEdge == null) {
            return null;
        }
        return new CorridorConnection(
                corridorId,
                mapId,
                new Door(List.of(boundaryEdge), Door.TraversalState.CLOSED),
                List.of(ConnectionEndpoint.room(portal.roomId()), ConnectionEndpoint.corridor(corridorId)),
                entryCell.z());
    }

    private static VertexEdge boundaryEdge(TraversalNode portal, CubePoint entryCell) {
        if (portal == null || entryCell == null) {
            return null;
        }
        for (CubePoint occupiedCell : portal.occupiedCells()) {
            if (occupiedCell == null || occupiedCell.z() != entryCell.z()) {
                continue;
            }
            int deltaX = entryCell.x() - occupiedCell.x();
            int deltaY = entryCell.y() - occupiedCell.y();
            if (Math.abs(deltaX) + Math.abs(deltaY) == 1) {
                return VertexEdge.betweenCellAndStep(occupiedCell.projectedCell(), new Point2i(deltaX, deltaY));
            }
        }
        return null;
    }

    private record AdjacentRoomPair(
            CubePoint firstRoomCell,
            CubePoint secondRoomCell,
            Point2i stepToSecond
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
                StairCandidate stairCandidate
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
        private final GridRoute route;
        private final LinkedHashSet<CubePoint> corridorCells = new LinkedHashSet<>();
        private final List<TraversalRoute.StairSegment> stairSegments = new ArrayList<>();
        private final Map<TraversalNodeId, CubePoint> realizedNodeCellsById = new LinkedHashMap<>();
        private final Map<TraversalNodeId, CubePoint> portalEntryCellsByNodeId = new LinkedHashMap<>();

        private RealizationState(Traversal traversal, TraversalTopology topology, GridRoute route) {
            this.traversal = traversal;
            this.topology = topology == null ? TraversalTopology.empty() : topology;
            this.route = route == null ? GridRoute.empty() : route;
        }

        private CubePoint realizedNodeCell(TraversalNodeId nodeId) {
            return nodeId == null ? null : realizedNodeCellsById.get(nodeId);
        }

        private void recordNode(TraversalNodeId nodeId, CubePoint cell) {
            if (nodeId != null && cell != null) {
                realizedNodeCellsById.putIfAbsent(nodeId, cell);
            }
        }

        private void recordPortal(TraversalNode node, CubePoint entryCell) {
            if (node == null || node.kind() != TraversalNode.TraversalNodeKind.ROOM_PORTAL) {
                return;
            }
            recordPortalEntry(node.nodeId(), entryCell);
        }

        private void recordPortalEntry(TraversalNodeId portalNodeId, CubePoint entryCell) {
            if (portalNodeId != null && entryCell != null) {
                portalEntryCellsByNodeId.putIfAbsent(portalNodeId, entryCell);
            }
        }

        private TraversalRoute unroutableRoute() {
            return TraversalRoute.empty();
        }

        private void addCorridorCells(LocalSegmentResult segmentResult) {
            if (segmentResult == null) {
                return;
            }
            corridorCells.addAll(segmentResult.corridorCells());
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
                    && (!corridorCells.isEmpty() || !stairSegments.isEmpty());
            return routable
                    ? new TraversalRoute(corridorSegments(), List.copyOf(stairSegments))
                    : TraversalRoute.empty();
        }

        private List<TraversalRoute.CorridorSegment> corridorSegments() {
            List<CorridorComponent> components = corridorComponents(corridorCells);
            if (components.isEmpty()) {
                return List.of();
            }
            ArrayList<TraversalRoute.CorridorSegment> result = new ArrayList<>();
            for (int index = 0; index < components.size(); index++) {
                CorridorComponent component = components.get(index);
                result.add(new TraversalRoute.CorridorSegment(
                        corridorComponentSegmentKey(index, component.anchor()),
                        Corridor.planned(
                                traversal.mapId(),
                                traversal.roomIds(),
                                new CorridorPath(route, component.cells(), false, true),
                                corridorConnections(component.cells()))));
            }
            return result.isEmpty() ? List.of() : List.copyOf(result);
        }

        private List<CorridorConnection> corridorConnections(Set<CubePoint> componentCells) {
            if (componentCells == null || componentCells.isEmpty()) {
                return List.of();
            }
            ArrayList<CorridorConnection> result = new ArrayList<>();
            for (TraversalNode roomPortal : topology.requiredRoomPortalNodes()) {
                if (roomPortal == null || roomPortal.nodeId() == null) {
                    continue;
                }
                CubePoint entryCell = portalEntryCellsByNodeId.get(roomPortal.nodeId());
                if (entryCell == null || !componentCells.contains(entryCell)) {
                    continue;
                }
                CorridorConnection connection = corridorConnection(null, topology.mapId(), roomPortal, entryCell);
                if (connection != null) {
                    result.add(connection);
                }
            }
            return rebindConnections(result, null);
        }
    }

    private static List<CorridorConnection> rebindConnections(List<CorridorConnection> connections, Long corridorId) {
        if (connections == null || connections.isEmpty()) {
            return List.of();
        }
        ArrayList<CorridorConnection> rebound = new ArrayList<>();
        for (CorridorConnection connection : connections) {
            if (connection == null) {
                continue;
            }
            rebound.add(new CorridorConnection(
                    corridorId,
                    connection.mapId(),
                    connection.door(),
                    rebindEndpoints(connection.endpoints(), corridorId),
                    connection.levelZ()));
        }
        return rebound.isEmpty() ? List.of() : List.copyOf(rebound);
    }

    private static List<ConnectionEndpoint> rebindEndpoints(List<ConnectionEndpoint> endpoints, Long corridorId) {
        if (endpoints == null || endpoints.isEmpty()) {
            return List.of();
        }
        ArrayList<ConnectionEndpoint> rebound = new ArrayList<>();
        for (ConnectionEndpoint endpoint : endpoints) {
            if (endpoint == null) {
                continue;
            }
            rebound.add(endpoint.type() == features.world.dungeonmap.model.structures.connection.ConnectionEndpointType.CORRIDOR
                    ? ConnectionEndpoint.corridor(corridorId)
                    : endpoint);
        }
        return rebound.isEmpty() ? List.of() : List.copyOf(rebound);
    }

    private static String corridorSegmentKey(String edgeKey, int ordinal) {
        return "H:" + edgeKey + "#" + ordinal;
    }

    private static String stairSegmentKey(String edgeKey) {
        return "V:" + edgeKey + "#0";
    }

    private static String corridorComponentSegmentKey(int index, CubePoint anchor) {
        String anchorValue = anchor == null
                ? "origin"
                : anchor.z() + ":" + anchor.y() + ":" + anchor.x();
        return "H:component:" + anchorValue + "#" + Math.max(index, 0);
    }

    private static List<CorridorComponent> corridorComponents(Set<CubePoint> cells) {
        if (cells == null || cells.isEmpty()) {
            return List.of();
        }
        LinkedHashSet<CubePoint> remaining = new LinkedHashSet<>();
        for (CubePoint cell : cells) {
            if (cell != null) {
                remaining.add(cell);
            }
        }
        if (remaining.isEmpty()) {
            return List.of();
        }
        ArrayList<CorridorComponent> result = new ArrayList<>();
        while (!remaining.isEmpty()) {
            CubePoint start = remaining.stream().min(CubePoint.POINT_ORDER).orElse(null);
            if (start == null) {
                break;
            }
            ArrayDeque<CubePoint> open = new ArrayDeque<>();
            LinkedHashSet<CubePoint> component = new LinkedHashSet<>();
            open.add(start);
            remaining.remove(start);
            while (!open.isEmpty()) {
                CubePoint cell = open.removeFirst();
                component.add(cell);
                for (Point2i step : Point2i.CARDINAL_STEPS) {
                    CubePoint neighbor = CubePoint.at(cell.projectedCell().add(step), cell.z());
                    if (remaining.remove(neighbor)) {
                        open.addLast(neighbor);
                    }
                }
            }
            CubePoint anchor = component.stream().min(CubePoint.POINT_ORDER).orElse(start);
            result.add(new CorridorComponent(Set.copyOf(component), anchor));
        }
        result.sort(Comparator.comparing(CorridorComponent::anchor, CubePoint.POINT_ORDER));
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    private static String edgeKey(TraversalNode start, TraversalNode end) {
        return edgeKey(start == null ? null : start.nodeId(), end == null ? null : end.nodeId());
    }

    private static String edgeKey(TraversalNodeId startNodeId, TraversalNodeId endNodeId) {
        String start = startNodeId == null ? "" : startNodeId.value();
        String end = endNodeId == null ? "" : endNodeId.value();
        return start.compareTo(end) <= 0 ? start + "->" + end : end + "->" + start;
    }

    private record CorridorComponent(
            Set<CubePoint> cells,
            CubePoint anchor
    ) {
        private CorridorComponent {
            cells = cells == null ? Set.of() : Set.copyOf(cells);
        }
    }
}
