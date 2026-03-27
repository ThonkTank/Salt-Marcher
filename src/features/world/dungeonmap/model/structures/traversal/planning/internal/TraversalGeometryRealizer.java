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
        if (topology.roomPortals().size() < 2) {
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
        for (TraversalStructurePlanner.GuideSegment guideSegment : structurePlan.guideSegments()) {
            if (guideSegment == null) {
                continue;
            }
            TraversalStructurePlanner.GuideNode start = guideSegment.start();
            TraversalStructurePlanner.GuideNode end = guideSegment.end();
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
        for (Integer portalIndex : structurePlan.attachedPortalIndices()) {
            if (portalIndex == null || portalIndex < 0 || portalIndex >= topology.roomPortals().size()) {
                continue;
            }
            String portalKey = portalKey(portalIndex);
            if (state.hasAttachedPortal(portalKey)) {
                continue;
            }
            TraversalTopology.RoomPortal roomPortal = topology.roomPortals().get(portalIndex);
            LinkedHashSet<CubePoint> attachmentTargets = state.attachmentTargets(structurePlan);
            if (roomPortal == null || attachmentTargets.isEmpty()) {
                return false;
            }
            LocalSegmentResult segmentResult = LocalTraversalRoutePlanner.route(new LocalSegmentRequest(
                    new LocalSegmentRequest.RoomPortalTerminal(roomPortal),
                    LocalSegmentRequest.FixedCellsTerminal.of(attachmentTargets),
                    topology.obstacles()));
            if (!segmentResult.routable()) {
                return false;
            }
            state.recordAttachedPortal(portalKey, segmentResult.sourceCell());
            state.addSegment(segmentResult);
        }
        return true;
    }

    private static LocalSegmentRequest.LocalTerminal terminalFor(
            TraversalStructurePlanner.GuideNode guideNode,
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
        if (guideNode.kind() == TraversalStructurePlanner.GuideNodeKind.WAYPOINT) {
            return LocalSegmentRequest.FixedCellsTerminal.of(List.of(CubePoint.at(
                    guideNode.guideCell(),
                    guideNode.levelZ() == null ? 0 : guideNode.levelZ())));
        }
        TraversalTopology.RoomPortal roomPortal = roomPortalFor(guideNode, topology);
        return roomPortal == null
                ? LocalSegmentRequest.FixedCellsTerminal.of(List.of())
                : new LocalSegmentRequest.RoomPortalTerminal(roomPortal);
    }

    private static TraversalTopology.RoomPortal roomPortalFor(
            TraversalStructurePlanner.GuideNode guideNode,
            TraversalTopology topology
    ) {
        if (guideNode == null || topology == null || guideNode.kind() != TraversalStructurePlanner.GuideNodeKind.ROOM_PORTAL) {
            return null;
        }
        String nodeId = guideNode.nodeId();
        if (nodeId == null || !nodeId.startsWith("portal:")) {
            return null;
        }
        try {
            int index = Integer.parseInt(nodeId.substring("portal:".length()));
            if (index < 0 || index >= topology.roomPortals().size()) {
                return null;
            }
            return topology.roomPortals().get(index);
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private static GridRoute buildRoute(TraversalStructurePlanner.StructurePlan structurePlan) {
        if (structurePlan == null || structurePlan.guideNodes().isEmpty()) {
            return GridRoute.empty();
        }
        ArrayList<GridAnchor> anchors = new ArrayList<>();
        for (TraversalStructurePlanner.GuideNode guideNode : structurePlan.guideNodes()) {
            if (guideNode != null && guideNode.guideCell() != null) {
                anchors.add(GridAnchor.atTile(guideNode.guideCell()));
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
                || topology.roomPortals().size() != 2
                || structurePlan.guideSegments().size() != 1) {
            return null;
        }
        TraversalTopology.RoomPortal first = topology.roomPortals().getFirst();
        TraversalTopology.RoomPortal second = topology.roomPortals().getLast();
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
            TraversalTopology.RoomPortal first,
            TraversalTopology.RoomPortal second
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
            TraversalTopology.RoomPortal portal,
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
            TraversalTopology.RoomPortal portal,
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

    private static VertexEdge boundaryEdge(TraversalTopology.RoomPortal portal, CubePoint entryCell) {
        if (portal == null || portal.roomAnchor() == null || entryCell == null) {
            return null;
        }
        for (CubePoint occupiedCell : portal.roomAnchor().occupiedCells()) {
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

    private static String portalKey(int index) {
        return "portal:" + index;
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
        private final Map<String, CubePoint> realizedGuideNodeCellsById = new LinkedHashMap<>();
        private final Map<String, CubePoint> attachedPortalEntryCellsByKey = new LinkedHashMap<>();

        private RealizationState(TraversalTopology topology, GridRoute route) {
            this.topology = topology == null ? TraversalTopology.empty() : topology;
            this.route = route == null ? GridRoute.empty() : route;
        }

        private CubePoint realizedGuideNodeCell(String nodeId) {
            return nodeId == null ? null : realizedGuideNodeCellsById.get(nodeId);
        }

        private void recordGuideNode(String nodeId, CubePoint cell) {
            if (nodeId != null && cell != null) {
                realizedGuideNodeCellsById.putIfAbsent(nodeId, cell);
            }
        }

        private void recordGuideRoom(
                TraversalStructurePlanner.GuideNode guideNode,
                TraversalTopology topology,
                CubePoint entryCell
        ) {
            TraversalTopology.RoomPortal roomPortal = roomPortalFor(guideNode, topology);
            if (roomPortal == null) {
                return;
            }
            recordAttachedPortal(guideNode.nodeId(), entryCell);
        }

        private void recordAttachedPortal(String portalKey, CubePoint entryCell) {
            if (portalKey != null && entryCell != null) {
                attachedPortalEntryCellsByKey.putIfAbsent(portalKey, entryCell);
            }
        }

        private boolean hasAttachedPortal(String portalKey) {
            return portalKey != null && attachedPortalEntryCellsByKey.containsKey(portalKey);
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
            for (TraversalStructurePlanner.GuideNode guideNode : structurePlan.guideNodes()) {
                if (guideNode == null || guideNode.kind() == TraversalStructurePlanner.GuideNodeKind.ROOM_PORTAL) {
                    continue;
                }
                CubePoint realizedCell = realizedGuideNodeCell(guideNode.nodeId());
                if (realizedCell != null) {
                    result.add(realizedCell);
                    continue;
                }
                if (guideNode.guideCell() != null) {
                    result.add(CubePoint.at(guideNode.guideCell(), guideNode.levelZ() == null ? 0 : guideNode.levelZ()));
                }
            }
            return result;
        }

        private TraversalPlan unroutablePlan() {
            return planOf(topology.corridorId(), CorridorPath.unroutable(route), List.of(), List.of());
        }

        private TraversalPlan toPlan() {
            List<CorridorConnection> connections = corridorConnections();
            boolean routable = attachedPortalEntryCellsByKey.size() >= topology.roomPortals().size()
                    && (!corridorCells.isEmpty() || !connections.isEmpty());
            CorridorPath path = routable
                    ? new CorridorPath(route, java.util.Set.copyOf(corridorCells), false, true)
                    : CorridorPath.unroutable(route);
            return planOf(topology.corridorId(), path, connections, List.copyOf(stairPlacements));
        }

        private List<CorridorConnection> corridorConnections() {
            ArrayList<CorridorConnection> result = new ArrayList<>();
            for (int index = 0; index < topology.roomPortals().size(); index++) {
                TraversalTopology.RoomPortal roomPortal = topology.roomPortals().get(index);
                CorridorConnection connection = corridorConnection(
                        topology.corridorId(),
                        topology.mapId(),
                        roomPortal,
                        attachedPortalEntryCellsByKey.get(portalKey(index)));
                if (connection != null) {
                    result.add(connection);
                }
            }
            return result.isEmpty() ? List.of() : List.copyOf(result);
        }
    }
}
