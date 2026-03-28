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
        GridRoute route = buildRoute(resolvedPlan);
        if (topology.roomPortalNodes().size() < 2) {
            return planOf(topology.corridorId(), CorridorPath.unroutable(route), List.of(), List.of());
        }
        TraversalPlan directAdjacencyPlan = directAdjacencyPlan(resolvedPlan, topology, route);
        if (directAdjacencyPlan != null) {
            return directAdjacencyPlan;
        }
        RealizationState state = new RealizationState(topology, route);
        if (!realizeGuideSegments(resolvedPlan, topology, state)) {
            return state.unroutablePlan();
        }
        if (!realizeAttachedPortals(resolvedPlan, topology, state)) {
            return state.unroutablePlan();
        }
        return state.toPlan();
    }

    private static boolean realizeGuideSegments(
            TraversalStructurePlanner.StructurePlan structurePlan,
            TraversalTopology topology,
            RealizationState state
    ) {
        for (TraversalEdge guideEdge : structurePlan.guideEdges()) {
            if (guideEdge == null) {
                continue;
            }
            TraversalNode start = topology.node(guideEdge.startNodeId());
            TraversalNode end = topology.node(guideEdge.endNodeId());
            if (start == null || end == null) {
                return false;
            }
            LocalSegmentResult segmentResult = LocalTraversalRoutePlanner.route(new LocalSegmentRequest(
                    terminalFor(start, topology, state),
                    terminalFor(end, topology, state),
                    topology.obstacles()));
            if (!segmentResult.routable()) {
                return false;
            }
            state.recordGuideNode(start.nodeId(), segmentResult.sourceCell());
            state.recordGuideNode(end.nodeId(), segmentResult.targetCell());
            state.recordGuideRoom(start, topology, segmentResult.sourceCell());
            state.recordGuideRoom(end, topology, segmentResult.targetCell());
            state.addSegment(segmentResult);
        }
        return true;
    }

    private static boolean realizeAttachedPortals(
            TraversalStructurePlanner.StructurePlan structurePlan,
            TraversalTopology topology,
            RealizationState state
    ) {
        for (TraversalNodeId portalNodeId : structurePlan.attachedPortalNodeIds()) {
            if (portalNodeId == null) {
                continue;
            }
            if (state.hasAttachedPortal(portalNodeId)) {
                continue;
            }
            TraversalNode roomPortal = topology.node(portalNodeId);
            LinkedHashSet<CubePoint> attachmentTargets = state.attachmentTargets(structurePlan);
            if (roomPortal == null
                    || roomPortal.kind() != TraversalNode.TraversalNodeKind.ROOM_PORTAL
                    || attachmentTargets.isEmpty()) {
                return false;
            }
            LocalSegmentResult segmentResult = LocalTraversalRoutePlanner.route(new LocalSegmentRequest(
                    new LocalSegmentRequest.RoomPortalTerminal(roomPortal),
                    LocalSegmentRequest.FixedCellsTerminal.of(attachmentTargets),
                    topology.obstacles()));
            if (!segmentResult.routable()) {
                return false;
            }
            state.recordAttachedPortal(portalNodeId, segmentResult.sourceCell());
            state.addSegment(segmentResult);
        }
        return true;
    }

    private static LocalSegmentRequest.LocalTerminal terminalFor(
            TraversalNode guideNode,
            TraversalTopology topology,
            RealizationState state
    ) {
        if (guideNode == null) {
            return LocalSegmentRequest.FixedCellsTerminal.of(List.of());
        }
        CubePoint realizedCell = state.realizedGuideNodeCell(guideNode.nodeId());
        if (realizedCell != null) {
            return LocalSegmentRequest.FixedCellsTerminal.of(List.of(realizedCell));
        }
        if (guideNode.kind() == TraversalNode.TraversalNodeKind.WAYPOINT) {
            return LocalSegmentRequest.FixedCellsTerminal.of(guideNode.anchorCells());
        }
        TraversalNode roomPortal = roomPortalFor(guideNode, topology);
        return roomPortal == null
                ? LocalSegmentRequest.FixedCellsTerminal.of(List.of())
                : new LocalSegmentRequest.RoomPortalTerminal(roomPortal);
    }

    private static TraversalNode roomPortalFor(
            TraversalNode guideNode,
            TraversalTopology topology
    ) {
        if (guideNode == null
                || topology == null
                || guideNode.kind() != TraversalNode.TraversalNodeKind.ROOM_PORTAL) {
            return null;
        }
        return topology.node(guideNode.nodeId());
    }

    private static GridRoute buildRoute(TraversalStructurePlanner.StructurePlan structurePlan) {
        if (structurePlan == null || structurePlan.guideNodes().isEmpty()) {
            return GridRoute.empty();
        }
        ArrayList<GridAnchor> anchors = new ArrayList<>();
        for (TraversalNode guideNode : structurePlan.guideNodes()) {
            if (guideNode != null && guideNode.anchor() != null) {
                anchors.add(GridAnchor.atTile(guideNode.anchor().projectedCell()));
            }
        }
        return anchors.isEmpty() ? GridRoute.empty() : new GridRoute(anchors);
    }

    private static TraversalPlan directAdjacencyPlan(
            TraversalStructurePlanner.StructurePlan structurePlan,
            TraversalTopology topology,
            GridRoute route
    ) {
        if (structurePlan == null
                || topology == null
                || topology.hasWaypoints()
                || topology.roomPortalNodes().size() != 2
                || structurePlan.guideEdges().size() != 1) {
            return null;
        }
        TraversalNode first = topology.roomPortalNodes().getFirst();
        TraversalNode second = topology.roomPortalNodes().getLast();
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
        private final Map<TraversalNodeId, CubePoint> realizedGuideNodeCellsById = new LinkedHashMap<>();
        private final Map<TraversalNodeId, CubePoint> attachedPortalEntryCellsByNodeId = new LinkedHashMap<>();

        private RealizationState(TraversalTopology topology, GridRoute route) {
            this.topology = topology == null ? TraversalTopology.empty() : topology;
            this.route = route == null ? GridRoute.empty() : route;
        }

        private CubePoint realizedGuideNodeCell(TraversalNodeId nodeId) {
            return nodeId == null ? null : realizedGuideNodeCellsById.get(nodeId);
        }

        private void recordGuideNode(TraversalNodeId nodeId, CubePoint cell) {
            if (nodeId != null && cell != null) {
                realizedGuideNodeCellsById.putIfAbsent(nodeId, cell);
            }
        }

        private void recordGuideRoom(
                TraversalNode guideNode,
                TraversalTopology topology,
                CubePoint entryCell
        ) {
            TraversalNode roomPortal = roomPortalFor(guideNode, topology);
            if (roomPortal == null) {
                return;
            }
            recordAttachedPortal(guideNode.nodeId(), entryCell);
        }

        private void recordAttachedPortal(TraversalNodeId portalNodeId, CubePoint entryCell) {
            if (portalNodeId != null && entryCell != null) {
                attachedPortalEntryCellsByNodeId.putIfAbsent(portalNodeId, entryCell);
            }
        }

        private boolean hasAttachedPortal(TraversalNodeId portalNodeId) {
            return portalNodeId != null && attachedPortalEntryCellsByNodeId.containsKey(portalNodeId);
        }

        private void addSegment(LocalSegmentResult segmentResult) {
            if (segmentResult == null) {
                return;
            }
            corridorCells.addAll(segmentResult.corridorCells());
            stairPlacements.addAll(segmentResult.stairPlacements());
        }

        private LinkedHashSet<CubePoint> attachmentTargets(TraversalStructurePlanner.StructurePlan structurePlan) {
            LinkedHashSet<CubePoint> result = new LinkedHashSet<>();
            if (!corridorCells.isEmpty()) {
                result.addAll(corridorCells);
                return result;
            }
            for (TraversalNode guideNode : structurePlan.guideNodes()) {
                if (guideNode == null || guideNode.kind() == TraversalNode.TraversalNodeKind.ROOM_PORTAL) {
                    continue;
                }
                CubePoint realizedCell = realizedGuideNodeCell(guideNode.nodeId());
                if (realizedCell != null) {
                    result.add(realizedCell);
                    continue;
                }
                result.addAll(guideNode.anchorCells());
            }
            return result;
        }

        private TraversalPlan unroutablePlan() {
            return planOf(topology.corridorId(), CorridorPath.unroutable(route), List.of(), List.of());
        }

        private TraversalPlan toPlan() {
            List<CorridorConnection> connections = corridorConnections();
            boolean routable = attachedPortalEntryCellsByNodeId.size() >= topology.roomPortalNodes().size()
                    && (!corridorCells.isEmpty() || !connections.isEmpty());
            CorridorPath path = routable
                    ? new CorridorPath(route, java.util.Set.copyOf(corridorCells), false, true)
                    : CorridorPath.unroutable(route);
            return planOf(topology.corridorId(), path, connections, List.copyOf(stairPlacements));
        }

        private List<CorridorConnection> corridorConnections() {
            ArrayList<CorridorConnection> result = new ArrayList<>();
            for (TraversalNode roomPortal : topology.roomPortalNodes()) {
                CorridorConnection connection = corridorConnection(
                        topology.corridorId(),
                        topology.mapId(),
                        roomPortal,
                        attachedPortalEntryCellsByNodeId.get(roomPortal.nodeId()));
                if (connection != null) {
                    result.add(connection);
                }
            }
            return result.isEmpty() ? List.of() : List.copyOf(result);
        }
    }
}
