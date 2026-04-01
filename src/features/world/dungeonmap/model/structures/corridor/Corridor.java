package features.world.dungeonmap.model.structures.corridor;

import features.world.dungeonmap.model.geometry.CardinalDirection;
import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.geometry.TileShape;
import features.world.dungeonmap.model.geometry.VertexEdge;
import features.world.dungeonmap.model.objects.Door;
import features.world.dungeonmap.model.objects.Floor;
import features.world.dungeonmap.model.objects.StructureGeometry;
import features.world.dungeonmap.model.structures.TargetKey;
import features.world.dungeonmap.model.structures.connection.ConnectionEndpoint;
import features.world.dungeonmap.model.structures.connection.CorridorConnection;
import features.world.dungeonmap.model.structures.room.Room;

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

/**
 * Corridors are edited and persisted as standalone structures.
 *
 * <p>The behavior to preserve here is: the graph is canonical, {@link CorridorPath} is only a read projection, room
 * attachments stay explicit, and callers must get the same corridor behavior without any second aggregate owner.
 */
public final class Corridor {

    private static final String TARGET_KEY_PREFIX = "corridor:";
    private static final int ROUTE_MARGIN = 4;

    private final Long corridorId;
    private final long mapId;
    private final int levelZ;
    private final List<CorridorNode> nodes;
    private final List<CorridorSegment> segments;
    private final StructureGeometry geometry;
    private final CorridorPath path;
    private final List<CorridorRoute> routes;
    private final List<CorridorConnection> connections;

    public static Corridor resolved(
            Long corridorId,
            long mapId,
            int levelZ,
            List<CorridorNode> nodes,
            List<CorridorSegment> segments,
            Map<Long, Room> roomsById
    ) {
        return new Corridor(corridorId, mapId, levelZ, nodes, segments, roomsById);
    }

    public static Corridor planned(
            long mapId,
            int levelZ,
            List<CorridorNode> nodes,
            List<CorridorSegment> segments,
            Map<Long, Room> roomsById
    ) {
        return new Corridor(null, mapId, levelZ, nodes, segments, roomsById);
    }

    private Corridor(
            Long corridorId,
            long mapId,
            int levelZ,
            List<CorridorNode> nodes,
            List<CorridorSegment> segments,
            Map<Long, Room> roomsById
    ) {
        this.corridorId = corridorId;
        this.mapId = mapId;
        this.levelZ = levelZ;
        this.nodes = normalizeNodes(nodes);
        this.segments = normalizeSegments(segments);
        DerivedProjection projection = deriveProjection(corridorId, mapId, levelZ, this.nodes, this.segments, roomsById);
        this.geometry = projection.geometry();
        this.path = CorridorPath.fromCells(this.geometry.cubePoints());
        this.routes = projection.routes();
        this.connections = projection.connections();
    }

    public Corridor withIdentity(Long corridorId, long mapId, Map<Long, Room> roomsById) {
        return new Corridor(corridorId, mapId, levelZ, nodes, segments, roomsById);
    }

    public Long corridorId() {
        return corridorId;
    }

    public String targetKey() {
        return targetKey(corridorId);
    }

    public static String targetKey(Long corridorId) {
        return TargetKey.of(TARGET_KEY_PREFIX, corridorId).value();
    }

    public static boolean isTargetKey(String targetKey) {
        return TargetKey.matches(targetKey, TARGET_KEY_PREFIX);
    }

    public static Long corridorIdFromKey(String targetKey) {
        return TargetKey.parseId(targetKey, TARGET_KEY_PREFIX);
    }

    public long mapId() {
        return mapId;
    }

    public int levelZ() {
        return levelZ;
    }

    public List<CorridorNode> nodes() {
        return nodes;
    }

    public List<CorridorSegment> segments() {
        return segments;
    }

    public List<Long> connectedRoomIds() {
        return nodes.stream()
                .filter(CorridorNode::isRoomBound)
                .map(CorridorNode::roomId)
                .filter(Objects::nonNull)
                .distinct()
                .sorted()
                .toList();
    }

    public StructureGeometry geometry() {
        return geometry;
    }

    public CorridorPath path() {
        return path;
    }

    public List<CorridorRoute> routes() {
        return routes;
    }

    public Set<CubePoint> occupiedCells() {
        return geometry.cubePoints();
    }

    public Set<Point2i> cells() {
        return geometry.cells();
    }

    public Set<Point2i> cellsAtLevel(int levelZ) {
        return geometry.cellsAtLevel(levelZ);
    }

    public Point2i centerCellAtLevel(int levelZ) {
        return geometry.centerCellAtLevel(levelZ);
    }

    public Floor floor() {
        Floor floor = geometry.floorAtLevel(levelZ);
        return floor == null ? new Floor(TileShape.empty()) : floor;
    }

    public Floor floorAtLevel(int levelZ) {
        Floor floor = geometry.floorAtLevel(levelZ);
        return floor == null ? new Floor(TileShape.empty()) : floor;
    }

    public List<CorridorConnection> connections() {
        return connections;
    }

    public boolean connectsRoom(Long roomId) {
        return roomId != null && connectedRoomIds().contains(roomId);
    }

    public CorridorNode findNode(Long nodeId) {
        if (nodeId == null) {
            return null;
        }
        return nodes.stream()
                .filter(node -> nodeId.equals(node.nodeId()))
                .findFirst()
                .orElse(null);
    }

    public CorridorSegment findSegment(Long segmentId) {
        if (segmentId == null) {
            return null;
        }
        return segments.stream()
                .filter(segment -> segmentId.equals(segment.segmentId()))
                .findFirst()
                .orElse(null);
    }

    public List<CorridorSegment> segmentsForNode(Long nodeId) {
        if (nodeId == null) {
            return List.of();
        }
        return segments.stream()
                .filter(segment -> nodeId.equals(segment.startNodeId()) || nodeId.equals(segment.endNodeId()))
                .toList();
    }

    public List<CorridorNode> persistedManualNodes() {
        return nodes.stream()
                .filter(node -> node.nodeId() != null && !node.isRoomBound())
                .toList();
    }

    private static List<CorridorNode> normalizeNodes(List<CorridorNode> nodes) {
        if (nodes == null || nodes.isEmpty()) {
            throw new IllegalArgumentException("Corridor requires at least two nodes");
        }
        ArrayList<CorridorNode> result = new ArrayList<>();
        Set<Long> seenIds = new LinkedHashSet<>();
        Set<Long> seenCoordinates = new LinkedHashSet<>();
        for (CorridorNode node : nodes) {
            if (node == null) {
                continue;
            }
            if (node.nodeId() != null && !seenIds.add(node.nodeId())) {
                throw new IllegalArgumentException("Duplicate corridor node id " + node.nodeId());
            }
            long coordinateKey = (((long) node.gridX2()) << 32) ^ (node.gridY2() & 0xffffffffL);
            if (!seenCoordinates.add(coordinateKey)) {
                throw new IllegalArgumentException("Duplicate corridor node coordinates");
            }
            result.add(node);
        }
        if (result.size() < 2) {
            throw new IllegalArgumentException("Corridor requires at least two nodes");
        }
        result.sort(Comparator
                .comparing((CorridorNode node) -> node.nodeId() == null ? Long.MAX_VALUE : node.nodeId())
                .thenComparingInt(CorridorNode::gridY2)
                .thenComparingInt(CorridorNode::gridX2));
        return List.copyOf(result);
    }

    private static List<CorridorSegment> normalizeSegments(List<CorridorSegment> segments) {
        if (segments == null || segments.isEmpty()) {
            throw new IllegalArgumentException("Corridor requires at least one segment");
        }
        ArrayList<CorridorSegment> result = new ArrayList<>();
        Set<String> seenEdges = new LinkedHashSet<>();
        for (CorridorSegment segment : segments) {
            if (segment == null) {
                continue;
            }
            String edgeKey = segment.startNodeId() + ":" + segment.endNodeId();
            if (!seenEdges.add(edgeKey)) {
                throw new IllegalArgumentException("Duplicate corridor segment " + edgeKey);
            }
            result.add(segment);
        }
        if (result.isEmpty()) {
            throw new IllegalArgumentException("Corridor requires at least one segment");
        }
        result.sort(Comparator
                .comparing((CorridorSegment segment) -> segment.segmentId() == null ? Long.MAX_VALUE : segment.segmentId())
                .thenComparing(CorridorSegment::startNodeId)
                .thenComparing(CorridorSegment::endNodeId));
        return List.copyOf(result);
    }

    private static DerivedProjection deriveProjection(
            Long corridorId,
            long mapId,
            int levelZ,
            List<CorridorNode> nodes,
            List<CorridorSegment> segments,
            Map<Long, Room> roomsById
    ) {
        // Keep routing/projection semantics centralized in the canonical corridor owner.
        Map<Long, Room> resolvedRooms = roomsById == null ? Map.of() : Map.copyOf(roomsById);
        Map<Long, CorridorNode> nodesById = indexNodes(nodes);
        LinkedHashSet<CubePoint> occupiedCells = new LinkedHashSet<>();
        ArrayList<CorridorRoute> routes = new ArrayList<>();
        for (CorridorSegment segment : segments) {
            CorridorNode start = nodesById.get(segment.startNodeId());
            CorridorNode end = nodesById.get(segment.endNodeId());
            if (start == null || end == null) {
                throw new IllegalArgumentException("Corridor segment references missing node");
            }
            RoutePlan routePlan = findRoute(levelZ, start, end, nodes, resolvedRooms);
            occupiedCells.addAll(routePlan.corridorCells().stream()
                    .map(cell -> CubePoint.at(cell, levelZ))
                    .toList());
            routes.add(new CorridorRoute(segment.segmentId(), segment.startNodeId(), segment.endNodeId(), routePlan.doubledPath()));
        }
        return new DerivedProjection(
                StructureGeometry.fromCubePoints(occupiedCells),
                routes.isEmpty() ? List.of() : List.copyOf(routes),
                materializeConnections(corridorId, mapId, levelZ, nodes, resolvedRooms));
    }

    private static Map<Long, CorridorNode> indexNodes(List<CorridorNode> nodes) {
        Map<Long, CorridorNode> result = new LinkedHashMap<>();
        long syntheticId = -1L;
        for (CorridorNode node : nodes) {
            long nodeId = node.nodeId() == null ? syntheticId-- : node.nodeId();
            result.put(nodeId, node);
        }
        return Map.copyOf(result);
    }

    private static RoutePlan findRoute(
            int levelZ,
            CorridorNode start,
            CorridorNode end,
            List<CorridorNode> allNodes,
            Map<Long, Room> roomsById
    ) {
        Set<Point2i> blockedCells = blockedRoomCells(levelZ, roomsById);
        return findAnchoredRoute(levelZ, start, end, blockedCells, roomsById);
    }

    private static Set<Point2i> blockedRoomCells(int levelZ, Map<Long, Room> roomsById) {
        Set<Point2i> blocked = new LinkedHashSet<>();
        for (Room room : roomsById.values()) {
            if (room == null) {
                continue;
            }
            Floor floor = room.floorAtLevel(levelZ);
            if (floor == null || floor.shape() == null) {
                continue;
            }
            blocked.addAll(floor.shape().absoluteCells());
        }
        return Set.copyOf(blocked);
    }

    private static RoutePlan findAnchoredRoute(
            int levelZ,
            CorridorNode start,
            CorridorNode end,
            Set<Point2i> blockedCells,
            Map<Long, Room> roomsById
    ) {
        List<AnchorAttachment> startAttachments = attachmentsForNode(start, levelZ, blockedCells, roomsById);
        List<AnchorAttachment> endAttachments = attachmentsForNode(end, levelZ, blockedCells, roomsById);
        RoutePlan bestPlan = null;
        for (AnchorAttachment startAttachment : startAttachments) {
            for (AnchorAttachment endAttachment : endAttachments) {
                CellRoute cellRoute = findCellRoute(startAttachment.cell(), endAttachment.cell(), blockedCells);
                if (cellRoute == null) {
                    continue;
                }
                List<Point2i> doubledPath = assembleDoubledPath(
                        startAttachment.anchorToCellPath(),
                        cellRoute.cells(),
                        endAttachment.anchorToCellPath());
                double totalCost = cellRoute.cost()
                        + startAttachment.adapterCost()
                        + endAttachment.adapterCost();
                if (bestPlan == null || totalCost < bestPlan.cost()) {
                    bestPlan = new RoutePlan(doubledPath, cellRoute.cells(), totalCost);
                }
            }
        }
        if (bestPlan == null) {
            throw new IllegalArgumentException("Corridor segment could not be routed");
        }
        return bestPlan;
    }

    private static List<AnchorAttachment> attachmentsForNode(
            CorridorNode node,
            int levelZ,
            Set<Point2i> blockedCells,
            Map<Long, Room> roomsById
    ) {
        if (node == null) {
            return List.of();
        }
        Point2i anchorPoint = new Point2i(node.gridX2(), node.gridY2());
        if (node.isRoomBound()) {
            Point2i roomCell = absoluteRoomCell(node, levelZ, roomsById);
            if (roomCell == null || node.roomBoundaryDirection() == null) {
                throw new IllegalArgumentException("Corridor room-bound node could not be resolved");
            }
            Point2i exteriorCell = roomCell.add(node.roomBoundaryDirection().delta());
            return List.of(new AnchorAttachment(
                    exteriorCell,
                    List.of(anchorPoint, doubledCellCenter(exteriorCell))));
        }
        if (isCellCenter(anchorPoint)) {
            return List.of(new AnchorAttachment(cellFromCenter(anchorPoint), List.of(anchorPoint)));
        }
        List<Point2i> touchingCells = touchingCells(anchorPoint);
        List<Point2i> preferredCells = touchingCells.stream()
                .filter(cell -> !blockedCells.contains(cell))
                .toList();
        List<Point2i> candidateCells = preferredCells.isEmpty() ? touchingCells : preferredCells;
        ArrayList<AnchorAttachment> attachments = new ArrayList<>();
        for (Point2i cell : candidateCells) {
            for (List<Point2i> adapterPath : adapterPaths(anchorPoint, cell)) {
                attachments.add(new AnchorAttachment(cell, adapterPath));
            }
        }
        return attachments.isEmpty() ? List.of() : List.copyOf(attachments);
    }

    private static CellRoute findCellRoute(Point2i start, Point2i end, Set<Point2i> blockedCells) {
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
        for (Point2i blocked : blockedCells) {
            minX = Math.min(minX, blocked.x());
            maxX = Math.max(maxX, blocked.x());
            minY = Math.min(minY, blocked.y());
            maxY = Math.max(maxY, blocked.y());
        }
        minX -= ROUTE_MARGIN;
        maxX += ROUTE_MARGIN;
        minY -= ROUTE_MARGIN;
        maxY += ROUTE_MARGIN;

        double turnPenalty = turnPenalty(start, end);
        Set<Point2i> effectiveBlocked = new LinkedHashSet<>(blockedCells);
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
            for (Point2i step : Point2i.CARDINAL_STEPS) {
                Point2i neighbor = current.cell().add(step);
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

    private static List<Point2i> reconstructCellPath(Map<SearchState, SearchState> cameFrom, SearchState endState) {
        ArrayList<Point2i> path = new ArrayList<>();
        SearchState current = endState;
        path.add(current.cell());
        while (cameFrom.containsKey(current)) {
            current = cameFrom.get(current);
            path.add(current.cell());
        }
        Collections.reverse(path);
        return List.copyOf(path);
    }

    private static List<Point2i> assembleDoubledPath(
            List<Point2i> startAdapter,
            List<Point2i> cellRoute,
            List<Point2i> endAdapter
    ) {
        ArrayList<Point2i> result = new ArrayList<>();
        appendUnique(result, startAdapter);
        appendUnique(result, cellRoute == null ? List.of() : cellRoute.stream().map(Corridor::doubledCellCenter).toList());
        ArrayList<Point2i> reversedEnd = new ArrayList<>(endAdapter == null ? List.of() : endAdapter);
        Collections.reverse(reversedEnd);
        appendUnique(result, reversedEnd);
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    private static void appendUnique(List<Point2i> target, List<Point2i> points) {
        if (target == null || points == null) {
            return;
        }
        for (Point2i point : points) {
            if (point == null) {
                continue;
            }
            if (!target.isEmpty() && target.getLast().equals(point)) {
                continue;
            }
            target.add(point);
        }
    }

    private static Point2i doubledCellCenter(Point2i cell) {
        return new Point2i(cell.x() * 2 + 1, cell.y() * 2 + 1);
    }

    private static Point2i cellFromCenter(Point2i doubledCenter) {
        return new Point2i((doubledCenter.x() - 1) / 2, (doubledCenter.y() - 1) / 2);
    }

    private static boolean isCellCenter(Point2i point) {
        return point != null && (point.x() & 1) == 1 && (point.y() & 1) == 1;
    }

    private static List<Point2i> touchingCells(Point2i anchor) {
        if (anchor == null) {
            return List.of();
        }
        int x2 = anchor.x();
        int y2 = anchor.y();
        if ((x2 & 1) == 1 && (y2 & 1) == 1) {
            return List.of(cellFromCenter(anchor));
        }
        if ((x2 & 1) == 0 && (y2 & 1) == 1) {
            int y = (y2 - 1) / 2;
            return List.of(new Point2i(x2 / 2 - 1, y), new Point2i(x2 / 2, y));
        }
        if ((x2 & 1) == 1) {
            int x = (x2 - 1) / 2;
            return List.of(new Point2i(x, y2 / 2 - 1), new Point2i(x, y2 / 2));
        }
        return List.of(
                new Point2i(x2 / 2 - 1, y2 / 2 - 1),
                new Point2i(x2 / 2, y2 / 2 - 1),
                new Point2i(x2 / 2 - 1, y2 / 2),
                new Point2i(x2 / 2, y2 / 2));
    }

    private static List<List<Point2i>> adapterPaths(Point2i anchorPoint, Point2i cell) {
        if (anchorPoint == null || cell == null) {
            return List.of();
        }
        Point2i cellCenter = doubledCellCenter(cell);
        if (anchorPoint.equals(cellCenter)) {
            return List.of(List.of(anchorPoint));
        }
        if (anchorPoint.distanceTo(cellCenter) == 1) {
            return List.of(List.of(anchorPoint, cellCenter));
        }
        Point2i firstMidpoint = new Point2i(anchorPoint.x(), cellCenter.y());
        Point2i secondMidpoint = new Point2i(cellCenter.x(), anchorPoint.y());
        return List.of(
                List.of(anchorPoint, firstMidpoint, cellCenter),
                List.of(anchorPoint, secondMidpoint, cellCenter));
    }

    private static double heuristic(Point2i current, Point2i end) {
        return current == null || end == null ? 0.0d : current.distanceTo(end);
    }

    private static double turnPenalty(Point2i start, Point2i end) {
        int cellDistance = Math.max(1, start.distanceTo(end));
        return Math.max(0.15d, Math.min(0.75d, 0.75d / Math.sqrt(cellDistance)));
    }

    private static List<CorridorConnection> materializeConnections(
            Long corridorId,
            long mapId,
            int levelZ,
            List<CorridorNode> nodes,
            Map<Long, Room> roomsById
    ) {
        if (corridorId == null) {
            return List.of();
        }
        ArrayList<CorridorConnection> result = new ArrayList<>();
        for (CorridorNode node : nodes) {
            if (!node.isRoomBound()) {
                continue;
            }
            Point2i roomCell = absoluteRoomCell(node, levelZ, roomsById);
            CardinalDirection direction = node.roomBoundaryDirection();
            if (roomCell == null || direction == null) {
                throw new IllegalArgumentException("Corridor room-bound node could not be resolved");
            }
            VertexEdge boundaryEdge = VertexEdge.betweenCellAndStep(roomCell, direction.delta());
            result.add(new CorridorConnection(
                    corridorId,
                    mapId,
                    new Door(List.of(boundaryEdge), Door.DoorState.CLOSED),
                    List.of(ConnectionEndpoint.room(node.roomId()), ConnectionEndpoint.corridor(corridorId)),
                    levelZ));
        }
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    private static Point2i absoluteRoomCell(CorridorNode node, int levelZ, Map<Long, Room> roomsById) {
        if (node == null || !node.isRoomBound()) {
            return null;
        }
        Room room = roomsById.get(node.roomId());
        if (room == null) {
            throw new IllegalArgumentException("Corridor node references missing room " + node.roomId());
        }
        Point2i anchor = room.anchorsByLevel().get(levelZ);
        if (anchor == null) {
            throw new IllegalArgumentException("Corridor node references room without floor at level " + levelZ);
        }
        return anchor.add(node.roomRelativeCell());
    }

    private record DerivedProjection(
            StructureGeometry geometry,
            List<CorridorRoute> routes,
            List<CorridorConnection> connections
    ) {
    }

    private record AnchorAttachment(Point2i cell, List<Point2i> anchorToCellPath) {
        private AnchorAttachment {
            cell = Objects.requireNonNull(cell, "cell");
            anchorToCellPath = anchorToCellPath == null ? List.of() : List.copyOf(anchorToCellPath);
        }

        private double adapterCost() {
            return Math.max(0, anchorToCellPath.size() - 1);
        }
    }

    private record SearchState(Point2i cell, Point2i direction) {
        private SearchState {
            cell = Objects.requireNonNull(cell, "cell");
        }
    }

    private record QueueEntry(SearchState state, double estimatedTotalCost) {
        private QueueEntry {
            state = Objects.requireNonNull(state, "state");
        }
    }

    private record CellRoute(List<Point2i> cells, double cost) {
        private CellRoute {
            cells = cells == null ? List.of() : List.copyOf(cells);
        }
    }

    private record RoutePlan(List<Point2i> doubledPath, List<Point2i> corridorCells, double cost) {
        private RoutePlan {
            doubledPath = doubledPath == null ? List.of() : List.copyOf(doubledPath);
            corridorCells = corridorCells == null ? List.of() : List.copyOf(corridorCells);
        }
    }

    public record CorridorRoute(
            Long segmentId,
            Long startNodeId,
            Long endNodeId,
            List<Point2i> doubledPath
    ) {
        public CorridorRoute {
            doubledPath = doubledPath == null ? List.of() : List.copyOf(doubledPath);
        }

        public List<VertexEdge> doubledEdges() {
            if (doubledPath.size() < 2) {
                return List.of();
            }
            ArrayList<VertexEdge> result = new ArrayList<>();
            for (int index = 1; index < doubledPath.size(); index++) {
                result.add(new VertexEdge(doubledPath.get(index - 1), doubledPath.get(index)));
            }
            return List.copyOf(result);
        }

        public List<Point2i> cornerPoints() {
            if (doubledPath.size() < 3) {
                return List.of();
            }
            ArrayList<Point2i> result = new ArrayList<>();
            for (int index = 1; index < doubledPath.size() - 1; index++) {
                Point2i previous = doubledPath.get(index - 1);
                Point2i current = doubledPath.get(index);
                Point2i next = doubledPath.get(index + 1);
                Point2i incoming = current.subtract(previous);
                Point2i outgoing = next.subtract(current);
                if (incoming.x() != outgoing.x() || incoming.y() != outgoing.y()) {
                    result.add(current);
                }
            }
            return List.copyOf(result);
        }
    }
}
