package features.world.dungeonmap.model.structures.corridor;

import features.world.dungeonmap.model.geometry.CardinalDirection;
import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.geometry.TileShape;
import features.world.dungeonmap.model.geometry.VertexEdge;
import features.world.dungeonmap.model.objects.Door;
import features.world.dungeonmap.model.objects.Floor;
import features.world.dungeonmap.model.structures.TargetKey;
import features.world.dungeonmap.model.structures.connection.ConnectionEndpoint;
import features.world.dungeonmap.model.structures.connection.CorridorConnection;
import features.world.dungeonmap.model.structures.room.Room;

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
import java.util.Set;

/**
 * Corridors are edited and persisted as standalone structures.
 *
 * <p>The behavior to preserve here is: the graph is canonical, {@link CorridorPath} is only a read projection, room
 * attachments stay explicit, and callers must get the same corridor behavior without any second aggregate owner.
 */
public final class Corridor {

    private static final String TARGET_KEY_PREFIX = "corridor:";
    private static final int ROUTE_MARGIN = 8;

    private final Long corridorId;
    private final long mapId;
    private final int levelZ;
    private final List<CorridorNode> nodes;
    private final List<CorridorSegment> segments;
    private final CorridorPath path;
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
        this.path = projection.path();
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

    public CorridorPath path() {
        return path;
    }

    public Set<CubePoint> occupiedCells() {
        return path.cells();
    }

    public Floor floor() {
        return path.floor();
    }

    public Floor floorAtLevel(int levelZ) {
        return levelZ == this.levelZ ? path.floorAtLevel(levelZ) : new Floor(TileShape.empty());
    }

    public List<CorridorConnection> connections() {
        return connections;
    }

    public boolean connectsRoom(Long roomId) {
        return roomId != null && connectedRoomIds().contains(roomId);
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
        for (CorridorSegment segment : segments) {
            CorridorNode start = nodesById.get(segment.startNodeId());
            CorridorNode end = nodesById.get(segment.endNodeId());
            if (start == null || end == null) {
                throw new IllegalArgumentException("Corridor segment references missing node");
            }
            occupiedCells.addAll(routeCells(levelZ, start, end, nodes, resolvedRooms));
        }
        return new DerivedProjection(
                CorridorPath.fromCells(occupiedCells),
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

    private static Collection<CubePoint> routeCells(
            int levelZ,
            CorridorNode start,
            CorridorNode end,
            List<CorridorNode> allNodes,
            Map<Long, Room> roomsById
    ) {
        Point2i startPoint = new Point2i(start.gridX2(), start.gridY2());
        Point2i endPoint = new Point2i(end.gridX2(), end.gridY2());
        Set<Point2i> blockedCenters = blockedRoomCenters(levelZ, allNodes, roomsById);
        List<Point2i> doubledPath = findDoubledPath(startPoint, endPoint, blockedCenters);
        return cellsForDoubledPath(doubledPath, levelZ);
    }

    private static Set<Point2i> blockedRoomCenters(
            int levelZ,
            List<CorridorNode> nodes,
            Map<Long, Room> roomsById
    ) {
        Set<Point2i> allowedCells = new LinkedHashSet<>();
        for (CorridorNode node : nodes) {
            Point2i cell = absoluteRoomCell(node, levelZ, roomsById);
            if (cell != null) {
                allowedCells.add(cell);
            }
        }
        Set<Point2i> blocked = new LinkedHashSet<>();
        for (Room room : roomsById.values()) {
            if (room == null) {
                continue;
            }
            Floor floor = room.floorAtLevel(levelZ);
            if (floor == null || floor.shape() == null) {
                continue;
            }
            for (Point2i cell : floor.shape().absoluteCells()) {
                if (!allowedCells.contains(cell)) {
                    blocked.add(new Point2i(cell.x() * 2 + 1, cell.y() * 2 + 1));
                }
            }
        }
        return Set.copyOf(blocked);
    }

    private static List<Point2i> findDoubledPath(Point2i start, Point2i end, Set<Point2i> blockedCenters) {
        if (start.equals(end)) {
            return List.of(start);
        }
        int minX = Math.min(start.x(), end.x());
        int maxX = Math.max(start.x(), end.x());
        int minY = Math.min(start.y(), end.y());
        int maxY = Math.max(start.y(), end.y());
        for (Point2i blocked : blockedCenters) {
            minX = Math.min(minX, blocked.x());
            maxX = Math.max(maxX, blocked.x());
            minY = Math.min(minY, blocked.y());
            maxY = Math.max(maxY, blocked.y());
        }
        minX -= ROUTE_MARGIN;
        maxX += ROUTE_MARGIN;
        minY -= ROUTE_MARGIN;
        maxY += ROUTE_MARGIN;

        ArrayDeque<Point2i> queue = new ArrayDeque<>();
        Map<Point2i, Point2i> cameFrom = new HashMap<>();
        Set<Point2i> visited = new LinkedHashSet<>();
        queue.add(start);
        visited.add(start);
        while (!queue.isEmpty()) {
            Point2i current = queue.removeFirst();
            if (current.equals(end)) {
                return reconstructPath(cameFrom, end);
            }
            for (Point2i step : Point2i.CARDINAL_STEPS) {
                Point2i neighbor = current.add(step);
                if (neighbor.x() < minX || neighbor.x() > maxX || neighbor.y() < minY || neighbor.y() > maxY) {
                    continue;
                }
                if (!neighbor.equals(end) && blockedCenters.contains(neighbor)) {
                    continue;
                }
                if (!visited.add(neighbor)) {
                    continue;
                }
                cameFrom.put(neighbor, current);
                queue.addLast(neighbor);
            }
        }
        throw new IllegalArgumentException("Corridor segment could not be routed");
    }

    private static List<Point2i> reconstructPath(Map<Point2i, Point2i> cameFrom, Point2i end) {
        ArrayList<Point2i> path = new ArrayList<>();
        Point2i current = end;
        path.add(current);
        while (cameFrom.containsKey(current)) {
            current = cameFrom.get(current);
            path.add(current);
        }
        Collections.reverse(path);
        return List.copyOf(path);
    }

    private static Collection<CubePoint> cellsForDoubledPath(List<Point2i> doubledPath, int levelZ) {
        if (doubledPath == null || doubledPath.size() < 2) {
            return List.of();
        }
        LinkedHashSet<CubePoint> cells = new LinkedHashSet<>();
        for (int index = 1; index < doubledPath.size(); index++) {
            Point2i start = doubledPath.get(index - 1);
            Point2i end = doubledPath.get(index);
            if (start.x() == end.x() && (start.x() & 1) == 1) {
                int y2 = Math.min(start.y(), end.y());
                if ((y2 & 1) == 0) {
                    cells.add(new CubePoint((start.x() - 1) / 2, y2 / 2, levelZ));
                }
                continue;
            }
            if (start.y() == end.y() && (start.y() & 1) == 1) {
                int x2 = Math.min(start.x(), end.x());
                if ((x2 & 1) == 0) {
                    cells.add(new CubePoint(x2 / 2, (start.y() - 1) / 2, levelZ));
                }
            }
        }
        return List.copyOf(cells);
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
            CorridorPath path,
            List<CorridorConnection> connections
    ) {
    }
}
