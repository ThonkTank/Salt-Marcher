package features.world.dungeonmap.model.structures.cluster;

import features.world.dungeonmap.model.geometry.BoundaryNetwork;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.geometry.TileShape;
import features.world.dungeonmap.model.interaction.InteractiveLabelHandle;
import features.world.dungeonmap.model.geometry.VertexEdge;
import features.world.dungeonmap.model.objects.Door;
import features.world.dungeonmap.model.objects.Floor;
import features.world.dungeonmap.model.objects.Wall;
import features.world.dungeonmap.model.structures.connection.LocalConnection;
import features.world.dungeonmap.model.structures.TargetKey;
import features.world.dungeonmap.model.structures.room.Room;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Supplier;

public final class RoomCluster {

    private static final String TARGET_KEY_PREFIX = "cluster:";

    private final Long clusterId;
    private final long mapId;
    private final Point2i center;
    // A cluster manages room grouping/runtime lookup, but room truth lives in the rooms.
    private final List<Room> rooms;
    private final List<LocalConnection> localConnections;
    private final Set<Point2i> cells;
    private final TileShape shape;
    private final Map<Long, Room> roomsById;
    private final Map<Point2i, Room> roomsByCell;
    // Lazy-computed on first access; safe because RoomCluster is only accessed on the FX application thread.
    private Map<Long, Set<Long>> adjacentRoomIdsByRoomId;
    private List<Set<Long>> components;
    private Map<Long, Set<Long>> componentByRoomId;
    private final boolean hasOverlappingRooms;

    public RoomCluster(
            Long clusterId,
            long mapId,
            Point2i center,
            List<Room> rooms
    ) {
        this(clusterId, mapId, center, rooms, List.of());
    }

    public RoomCluster(
            Long clusterId,
            long mapId,
            Point2i center,
            List<Room> rooms,
            List<LocalConnection> localConnections
    ) {
        List<Room> resolvedRooms = rooms == null ? List.of() : List.copyOf(rooms);
        List<LocalConnection> resolvedLocalConnections = localConnections == null ? List.of() : List.copyOf(localConnections);
        Map<Long, Room> resolvedRoomsById = indexRoomsById(resolvedRooms);
        OverlapIndex overlapIndex = indexRoomsByCell(resolvedRooms);
        Set<Point2i> resolvedCells = indexCells(resolvedRooms);

        this.clusterId = clusterId;
        this.mapId = mapId;
        this.center = center == null ? new Point2i(0, 0) : center;
        this.rooms = resolvedRooms;
        this.localConnections = resolvedLocalConnections;
        this.cells = resolvedCells;
        this.shape = TileShape.fromAbsoluteCells(resolvedCells);
        this.roomsById = resolvedRoomsById;
        this.roomsByCell = overlapIndex.roomsByCell();
        this.adjacentRoomIdsByRoomId = null;
        this.components = null;
        this.componentByRoomId = null;
        this.hasOverlappingRooms = overlapIndex.hasOverlaps();
    }

    public Long clusterId() {
        return clusterId;
    }

    public long mapId() {
        return mapId;
    }

    public Point2i center() {
        return center;
    }

    public List<Room> rooms() {
        return rooms;
    }

    public List<LocalConnection> localConnections() {
        return localConnections;
    }

    public RoomCluster withRooms(List<Room> rooms) {
        return new RoomCluster(clusterId, mapId, center, rooms, localConnections);
    }

    public RoomCluster withRoomsAndLocalConnections(List<Room> rooms, List<LocalConnection> localConnections) {
        return new RoomCluster(clusterId, mapId, center, rooms, localConnections);
    }

    public ClusterRewrite editBoundary(VertexEdge edge, InternalBoundaryType type, boolean deleteBoundary) {
        return editBoundary(edge == null ? List.<VertexEdge>of() : List.of(edge), type, deleteBoundary);
    }

    public ClusterRewrite editBoundary(Collection<VertexEdge> edges, InternalBoundaryType type, boolean deleteBoundary) {
        return ClusterRewritePlanner.editBoundary(this, edges, type, deleteBoundary);
    }

    public String targetKey() {
        return targetKey(clusterId);
    }

    public static String targetKey(Long clusterId) {
        return TargetKey.of(TARGET_KEY_PREFIX, clusterId).value();
    }

    public static boolean isTargetKey(String targetKey) {
        return TargetKey.matches(targetKey, TARGET_KEY_PREFIX);
    }

    public static Long clusterIdFromKey(String targetKey) {
        return TargetKey.parseId(targetKey, TARGET_KEY_PREFIX);
    }

    public InteractiveLabelHandle labelHandle() {
        return new InteractiveLabelHandle(
                targetKey(),
                clusterId == null ? "Cluster" : "Cluster " + clusterId,
                shape.centerAnchor());
    }

    public boolean overlaps(TileShape shape) {
        return shape != null && this.shape.overlaps(shape);
    }

    public Room singleRoom() {
        return rooms.size() == 1 ? rooms.getFirst() : null;
    }

    public RoomCluster movedBy(Point2i delta) {
        if (delta == null || (delta.x() == 0 && delta.y() == 0)) {
            return this;
        }
        return new RoomCluster(
                clusterId,
                mapId,
                center.add(delta),
                rooms.stream()
                        .map(room -> room == null ? null : room.movedBy(delta))
                        .toList(),
                localConnections.stream()
                        .map(connection -> movedConnection(connection, delta))
                        .toList());
    }

    public Set<Point2i> cells() {
        return cells;
    }

    public TileShape shape() {
        return shape;
    }

    public Room findRoom(Long roomId) {
        return roomId == null ? null : roomsById.get(roomId);
    }

    public Set<Long> roomIds() {
        return roomsById.keySet();
    }

    public boolean containsRoom(Long roomId) {
        return roomId != null && roomsById.containsKey(roomId);
    }

    public RoomCluster withAddedRoom(Room room) {
        if (room == null) {
            return this;
        }
        List<Room> updated = new ArrayList<>();
        boolean replaced = false;
        for (Room existing : rooms) {
            if (!sameRoomId(existing, room)) {
                updated.add(existing);
                continue;
            }
            updated.add(roomForCluster(room));
            replaced = true;
        }
        if (!replaced) {
            updated.add(roomForCluster(room));
        }
        return withRooms(updated);
    }

    public RoomCluster withRemovedRoom(Long roomId) {
        if (roomId == null || !containsRoom(roomId)) {
            return this;
        }
        return withRooms(rooms.stream()
                .filter(room -> room == null || !roomId.equals(room.roomId()))
                .toList());
    }

    public Room createRoom(Long roomId, String name, Floor floor) {
        return Room.create(
                roomId,
                mapId,
                clusterId == null ? 0L : clusterId,
                normalizedRoomName(roomId, name),
                floor);
    }

    public RoomCluster withCreatedRoom(Long roomId, String name, Floor floor) {
        return withAddedRoom(createRoom(roomId, name, floor));
    }

    public Room roomAt(Point2i cell) {
        return cell == null ? null : roomsByCell.get(cell);
    }

    public boolean contains(Point2i cell) {
        return cell != null && cells.contains(cell);
    }

    public List<Room> adjacentRooms(Room room) {
        if (room == null || room.roomId() == null) {
            return List.of();
        }
        return adjacentRoomIds(room.roomId()).stream()
                .map(this::findRoom)
                .filter(candidate -> candidate != null)
                .toList();
    }

    public Set<Long> adjacentRoomIds(Long roomId) {
        return roomId == null ? Set.of() : adjacency().getOrDefault(roomId, Set.of());
    }

    public List<Set<Long>> components() {
        return componentsLazy();
    }

    public Set<Long> componentContaining(Long roomId) {
        return roomId == null ? Set.of() : componentByRoomId().getOrDefault(roomId, Set.of());
    }

    public Set<Long> componentContaining(Point2i cell) {
        Room room = roomAt(cell);
        return room == null ? Set.of() : componentContaining(room.roomId());
    }

    public boolean isConnected() {
        return roomsById.isEmpty() || componentsLazy().size() <= 1;
    }

    public boolean hasOverlappingRooms() {
        return hasOverlappingRooms;
    }

    public boolean canMergeRooms(Set<Long> roomIds) {
        Set<Long> selected = normalizedRoomIds(roomIds);
        if (selected.size() < 2 || !roomsById.keySet().containsAll(selected)) {
            return false;
        }
        ArrayDeque<Long> queue = new ArrayDeque<>();
        Set<Long> visited = new LinkedHashSet<>();
        Long seed = selected.iterator().next();
        queue.add(seed);
        while (!queue.isEmpty()) {
            Long current = queue.removeFirst();
            if (!visited.add(current)) {
                continue;
            }
            for (Long neighbor : adjacentRoomIds(current)) {
                if (selected.contains(neighbor) && !visited.contains(neighbor)) {
                    queue.addLast(neighbor);
                }
            }
        }
        return visited.equals(selected);
    }

    public Room mergedRoom(Set<Long> roomIds, Long mergedRoomId, String mergedName) {
        Set<Long> selected = normalizedRoomIds(roomIds);
        if (!canMergeRooms(selected)) {
            throw new IllegalArgumentException("Zu mergende Raeume muessen existieren und im Cluster zusammenhaengend sein");
        }
        TileShape mergedShape = mergedShape(selected);
        Set<VertexEdge> boundaryEdges = mergedShape.boundaryEdges();
        Set<VertexEdge> mergedWallEdges = collectWallEdges(selected, boundaryEdges);
        Long resolvedRoomId = mergedRoomId != null ? mergedRoomId : selected.iterator().next();
        String resolvedName = mergedName == null || mergedName.isBlank()
                ? findRoom(selected.iterator().next()).name()
                : mergedName.trim();
        return Room.resolved(
                resolvedRoomId,
                mapId,
                clusterId == null ? 0L : clusterId,
                resolvedName,
                new Floor(mergedShape),
                mergedWallEdges.isEmpty() ? List.of() : List.of(new Wall(mergedWallEdges)),
                findRoom(selected.iterator().next()).narration());
    }

    public RoomCluster withMergedRooms(Set<Long> roomIds, Long mergedRoomId, String mergedName) {
        Set<Long> selected = normalizedRoomIds(roomIds);
        Room mergedRoom = mergedRoom(selected, mergedRoomId, mergedName);
        List<Room> updated = new ArrayList<>();
        boolean inserted = false;
        for (Room room : rooms) {
            if (room == null || room.roomId() == null || !selected.contains(room.roomId())) {
                updated.add(room);
                continue;
            }
            if (!inserted) {
                updated.add(mergedRoom);
                inserted = true;
            }
        }
        if (!inserted) {
            updated.add(mergedRoom);
        }
        return withRooms(updated);
    }

    public Map<VertexEdge, InternalBoundaryType> internalBoundaryKinds() {
        return ClusterRewritePlanner.internalBoundaryKinds(shape, rooms, localConnections);
    }

    public ClusterRewrite applyPaint(TileShape paintShape, List<RoomCluster> overlappingClusters) {
        return ClusterRewritePlanner.applyPaint(this, paintShape, overlappingClusters);
    }

    public ClusterRewrite applyDelete(TileShape deletedShape, Supplier<String> roomNameSupplier) {
        return ClusterRewritePlanner.applyDelete(this, deletedShape, roomNameSupplier);
    }

    public List<InternalBoundaryEdge> persistedInternalBoundaries() {
        return ClusterRewritePlanner.persistedBoundaries(shape, rooms, internalBoundaryKinds());
    }

    private static Map<Long, Room> indexRoomsById(List<Room> rooms) {
        Map<Long, Room> result = new LinkedHashMap<>();
        for (Room room : rooms) {
            if (room != null && room.roomId() != null) {
                result.put(room.roomId(), room);
            }
        }
        return Map.copyOf(result);
    }

    private static OverlapIndex indexRoomsByCell(List<Room> rooms) {
        Map<Point2i, Room> result = new LinkedHashMap<>();
        boolean hasOverlaps = false;
        for (Room room : rooms) {
            if (room == null) {
                continue;
            }
            for (Point2i cell : room.cells()) {
                if (result.containsKey(cell)) {
                    hasOverlaps = true;
                }
                result.put(cell, room);
            }
        }
        return new OverlapIndex(Map.copyOf(result), hasOverlaps);
    }

    private static Set<Point2i> indexCells(List<Room> rooms) {
        Set<Point2i> result = new LinkedHashSet<>();
        for (Room room : rooms) {
            if (room != null) {
                result.addAll(room.cells());
            }
        }
        return Set.copyOf(result);
    }

    private static Map<Long, Set<Long>> indexAdjacentRoomIds(Map<Long, Room> roomsById, Map<Point2i, Room> roomsByCell) {
        Map<Long, Set<Long>> result = new LinkedHashMap<>();
        for (Long roomId : roomsById.keySet()) {
            result.put(roomId, new LinkedHashSet<>());
        }
        for (Room room : roomsById.values()) {
            for (Point2i cell : room.cells()) {
                for (Point2i step : Point2i.CARDINAL_STEPS) {
                    Room neighbor = roomsByCell.get(cell.add(step));
                    if (neighbor == null || neighbor.roomId() == null || neighbor.roomId().equals(room.roomId())) {
                        continue;
                    }
                    result.get(room.roomId()).add(neighbor.roomId());
                }
            }
        }
        return result;
    }

    private static List<Set<Long>> components(Set<Long> roomIds, Map<Long, Set<Long>> adjacency) {
        Set<Long> unvisited = new LinkedHashSet<>(roomIds);
        List<Set<Long>> result = new ArrayList<>();
        while (!unvisited.isEmpty()) {
            Long seed = unvisited.iterator().next();
            Set<Long> component = new LinkedHashSet<>();
            ArrayDeque<Long> queue = new ArrayDeque<>();
            queue.add(seed);
            unvisited.remove(seed);
            while (!queue.isEmpty()) {
                Long current = queue.removeFirst();
                if (!component.add(current)) {
                    continue;
                }
                for (Long neighbor : adjacency.getOrDefault(current, Set.of())) {
                    if (unvisited.remove(neighbor)) {
                        queue.addLast(neighbor);
                    }
                }
            }
            result.add(Set.copyOf(component));
        }
        return List.copyOf(result);
    }

    private static Map<Long, Set<Long>> indexComponentByRoomId(List<Set<Long>> components) {
        Map<Long, Set<Long>> result = new LinkedHashMap<>();
        for (Set<Long> component : components) {
            for (Long roomId : component) {
                result.put(roomId, component);
            }
        }
        return Map.copyOf(result);
    }

    private static Map<Long, Set<Long>> immutableSetMap(Map<Long, Set<Long>> mutable) {
        Map<Long, Set<Long>> result = new LinkedHashMap<>();
        for (Map.Entry<Long, Set<Long>> entry : mutable.entrySet()) {
            result.put(entry.getKey(), Set.copyOf(entry.getValue()));
        }
        return Map.copyOf(result);
    }

    private Map<Long, Set<Long>> adjacency() {
        if (adjacentRoomIdsByRoomId == null) {
            adjacentRoomIdsByRoomId = immutableSetMap(indexAdjacentRoomIds(roomsById, roomsByCell));
        }
        return adjacentRoomIdsByRoomId;
    }

    private List<Set<Long>> componentsLazy() {
        if (components == null) {
            components = immutableComponents(components(roomsById.keySet(), adjacency()));
        }
        return components;
    }

    private Map<Long, Set<Long>> componentByRoomId() {
        if (componentByRoomId == null) {
            componentByRoomId = indexComponentByRoomId(componentsLazy());
        }
        return componentByRoomId;
    }

    private static List<Set<Long>> immutableComponents(List<Set<Long>> components) {
        return components.stream()
                .map(Set::copyOf)
                .toList();
    }

    private Room roomForCluster(Room room) {
        if (room == null) {
            return null;
        }
        return Room.resolved(
                room.roomId(),
                mapId,
                clusterId == null ? room.clusterId() : clusterId,
                room.name(),
                room.floor(),
                room.walls(),
                room.narration());
    }

    private static boolean sameRoomId(Room left, Room right) {
        return left != null
                && right != null
                && left.roomId() != null
                && left.roomId().equals(right.roomId());
    }

    private static Set<Long> normalizedRoomIds(Set<Long> roomIds) {
        Set<Long> result = new LinkedHashSet<>();
        if (roomIds == null) {
            return result;
        }
        for (Long roomId : roomIds) {
            if (roomId != null) {
                result.add(roomId);
            }
        }
        return Set.copyOf(result);
    }

    private TileShape mergedShape(Set<Long> roomIds) {
        TileShape mergedShape = null;
        for (Long roomId : roomIds) {
            Room room = findRoom(roomId);
            if (room == null) {
                continue;
            }
            mergedShape = mergedShape == null
                    ? room.floor().shape()
                    : mergedShape.union(room.floor().shape());
        }
        return mergedShape == null ? TileShape.singleCell(null) : mergedShape;
    }

    private Set<VertexEdge> collectWallEdges(Set<Long> roomIds, Set<VertexEdge> boundaryEdges) {
        Set<VertexEdge> result = new LinkedHashSet<>();
        for (Long roomId : roomIds) {
            Room room = findRoom(roomId);
            if (room == null) {
                continue;
            }
            BoundaryNetwork network = BoundaryNetwork.fromPaths(room.walls());
            for (VertexEdge edge : network.edges()) {
                if (boundaryEdges.contains(edge)) {
                    result.add(edge);
                }
            }
        }
        return result;
    }

    private static String normalizedRoomName(Long roomId, String name) {
        return name == null || name.isBlank()
                ? "Raum " + (roomId == null ? "neu" : roomId)
                : name.trim();
    }

    private static LocalConnection movedConnection(LocalConnection connection, Point2i delta) {
        if (connection == null || delta == null || connection.door() == null) {
            return connection;
        }
        return new LocalConnection(
                connection.connectionId(),
                connection.mapId(),
                connection.clusterId(),
                connection.door().movedBy(delta),
                connection.endpoints());
    }

    private static boolean disjoint(Set<Point2i> left, Set<Point2i> right) {
        for (Point2i point : left) {
            if (right.contains(point)) {
                return false;
            }
        }
        return true;
    }

    private record OverlapIndex(Map<Point2i, Room> roomsByCell, boolean hasOverlaps) {
    }
}
