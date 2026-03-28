package features.world.dungeonmap.model.structures.traversal.planning.internal;

import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.GridAnchor;
import features.world.dungeonmap.model.geometry.GridRoute;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.geometry.VertexEdge;
import features.world.dungeonmap.model.objects.CorridorPath;
import features.world.dungeonmap.model.objects.Door;
import features.world.dungeonmap.model.structures.connection.ConnectionEndpoint;
import features.world.dungeonmap.model.structures.connection.CorridorConnection;
import features.world.dungeonmap.model.structures.corridor.planning.StairPlacement;
import features.world.dungeonmap.model.structures.traversal.CorridorTraversalSlice;
import features.world.dungeonmap.model.structures.traversal.TraversalPlan;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;

public final class TraversalGeometryRealizer {

    private TraversalGeometryRealizer() {
        throw new AssertionError("No instances");
    }

    public static TraversalPlan realize(TraversalStructurePlanner.StructurePlan structurePlan) {
        TraversalStructurePlanner.StructurePlan resolvedPlan = structurePlan == null
                ? TraversalStructurePlanner.StructurePlan.empty()
                : structurePlan;
        TraversalTopology topology = resolvedPlan.topology();
        GridRoute route = buildRoute(topology);
        if (topology.requiredRoomPortalNodes().size() < 2) {
            return planOf(topology.corridorId(), CorridorPath.unroutable(route), List.of(), List.of());
        }
        List<TraversalEdge> selectedEdges = resolveSelectedEdges(resolvedPlan);
        if (selectedEdges == null) {
            return planOf(topology.corridorId(), CorridorPath.unroutable(route), List.of(), List.of());
        }
        TraversalPlan directAdjacencyPlan = directAdjacencyPlan(topology, route, selectedEdges);
        if (directAdjacencyPlan != null) {
            return directAdjacencyPlan;
        }
        RealizationState state = new RealizationState(topology, route);
        if (!realizeSelectedEdges(topology, state, selectedEdges)) {
            return state.unroutablePlan();
        }
        return state.toPlan();
    }

    private static List<TraversalEdge> resolveSelectedEdges(
            TraversalStructurePlanner.StructurePlan structurePlan
    ) {
        if (structurePlan == null || structurePlan.selectedEdgeIds().isEmpty()) {
            return List.of();
        }
        ArrayList<TraversalEdge> result = new ArrayList<>();
        for (TraversalEdgeId edgeId : structurePlan.selectedEdgeIds()) {
            TraversalEdge selectedEdge = structurePlan.candidateGraph().edge(edgeId);
            if (selectedEdge == null) {
                return null;
            }
            result.add(selectedEdge);
        }
        return List.copyOf(result);
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
            LocalSegmentResult segmentResult = LocalTraversalRoutePlanner.route(new LocalSegmentRequest(
                    terminalFor(start, state),
                    terminalFor(end, state),
                    topology.obstacles(),
                    stairCandidates(selectedEdge)));
            if (!segmentResult.routable()) {
                return false;
            }
            state.recordNode(start.nodeId(), segmentResult.sourceCell());
            state.recordNode(end.nodeId(), segmentResult.targetCell());
            state.recordPortal(start, segmentResult.sourceCell());
            state.recordPortal(end, segmentResult.targetCell());
            state.addSegment(segmentResult);
        }
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

    private static List<StairCandidate> stairCandidates(TraversalEdge guideEdge) {
        if (guideEdge instanceof VerticalCandidateEdge verticalCandidateEdge) {
            return verticalCandidateEdge.stairCandidates();
        }
        return List.of();
    }

    private static TraversalPlan directAdjacencyPlan(
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
                topology.corridorId(),
                topology.mapId(),
                first,
                adjacentRoomPair.firstRoomCell(),
                adjacentRoomPair.stepToSecond());
        if (firstConnection != null) {
            connections.add(firstConnection);
        }
        Point2i reverseStep = new Point2i(-adjacentRoomPair.stepToSecond().x(), -adjacentRoomPair.stepToSecond().y());
        CorridorConnection secondConnection = directAdjacencyConnection(
                topology.corridorId(),
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
        return planOf(
                topology.corridorId(),
                new CorridorPath(route, java.util.Set.of(), true, true),
                List.copyOf(connections),
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

    private static TraversalPlan planOf(
            Long corridorId,
            CorridorPath path,
            List<CorridorConnection> connections,
            List<StairPlacement> stairPlacements
    ) {
        return new TraversalPlan(
                List.of(new CorridorTraversalSlice(corridorId, path, connections)),
                stairPlacements);
    }

    private record AdjacentRoomPair(
            CubePoint firstRoomCell,
            CubePoint secondRoomCell,
            Point2i stepToSecond
    ) {
    }

    private static final class RealizationState {

        private final TraversalTopology topology;
        private final GridRoute route;
        private final LinkedHashSet<CubePoint> corridorCells = new LinkedHashSet<>();
        private final LinkedHashSet<StairPlacement> stairPlacements = new LinkedHashSet<>();
        private final Map<TraversalNodeId, CubePoint> realizedNodeCellsById = new LinkedHashMap<>();
        private final Map<TraversalNodeId, CubePoint> portalEntryCellsByNodeId = new LinkedHashMap<>();

        private RealizationState(TraversalTopology topology, GridRoute route) {
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

        private TraversalPlan unroutablePlan() {
            return planOf(topology.corridorId(), CorridorPath.unroutable(route), List.of(), List.of());
        }

        private void addSegment(LocalSegmentResult segmentResult) {
            if (segmentResult == null) {
                return;
            }
            corridorCells.addAll(segmentResult.corridorCells());
            stairPlacements.addAll(segmentResult.stairPlacements());
        }

        private TraversalPlan toPlan() {
            List<CorridorConnection> connections = corridorConnections();
            boolean routable = portalEntryCellsByNodeId.size() >= topology.requiredRoomPortalNodes().size()
                    && (!corridorCells.isEmpty() || !connections.isEmpty());
            CorridorPath path = routable
                    ? new CorridorPath(route, java.util.Set.copyOf(corridorCells), false, true)
                    : CorridorPath.unroutable(route);
            return planOf(topology.corridorId(), path, connections, List.copyOf(stairPlacements));
        }

        private List<CorridorConnection> corridorConnections() {
            ArrayList<CorridorConnection> result = new ArrayList<>();
            for (TraversalNode roomPortal : topology.requiredRoomPortalNodes()) {
                CorridorConnection connection = corridorConnection(
                        topology.corridorId(),
                        topology.mapId(),
                        roomPortal,
                        portalEntryCellsByNodeId.get(roomPortal.nodeId()));
                if (connection != null) {
                    result.add(connection);
                }
            }
            return result.isEmpty() ? List.of() : List.copyOf(result);
        }
    }
}
