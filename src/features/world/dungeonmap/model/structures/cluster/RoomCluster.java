package features.world.dungeonmap.model.structures.cluster;

import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.LegacyGridPoint2x;
import features.world.dungeonmap.model.geometry.LegacyGridSegment2x;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.interaction.InteractiveLabelHandle;
import features.world.dungeonmap.model.objects.Floor;
import features.world.dungeonmap.model.objects.StructureDescriptor;
import features.world.dungeonmap.model.objects.StructureObject;
import features.world.dungeonmap.model.structures.TargetKey;
import features.world.dungeonmap.model.structures.connection.LocalConnection;
import features.world.dungeonmap.model.structures.room.Room;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collection;
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
    private final Map<Long, Room> roomsById;
    private final Map<Point2i, Room> roomsByCell;
    private final Map<CubePoint, Room> roomsByPoint;
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

        this.clusterId = clusterId;
        this.mapId = mapId;
        this.center = center == null ? new Point2i(0, 0) : center;
        this.rooms = resolvedRooms;
        this.localConnections = resolvedLocalConnections;
        this.cells = indexCells(resolvedRooms);
        this.roomsById = resolvedRoomsById;
        this.roomsByCell = overlapIndex.roomsByCell();
        this.roomsByPoint = indexRoomsByPoint(resolvedRooms);
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
        List<Room> resolvedRooms = rooms == null ? List.of() : List.copyOf(rooms);
        long resolvedClusterId = clusterId == null ? 0L : clusterId;
        return new RoomCluster(
                clusterId,
                mapId,
                center,
                resolvedRooms,
                ClusterRewritePlanner.localConnections(
                        mapId,
                        resolvedClusterId,
                        resolvedRooms));
    }

    public RoomCluster withRoomsAndLocalConnections(List<Room> rooms, List<LocalConnection> localConnections) {
        return new RoomCluster(clusterId, mapId, center, rooms, localConnections);
    }

    public RoomCluster projectedToLevel(int levelZ) {
        List<Room> projectedRooms = rooms.stream()
                .map(room -> projectRoomToLevel(room, levelZ))
                .filter(room -> room != null)
                .toList();
        if (projectedRooms.isEmpty()) {
            return null;
        }
        List<LocalConnection> projectedConnections = localConnections.stream()
                .filter(connection -> connection != null && connection.levelZ() == levelZ)
                .toList();
        return new RoomCluster(clusterId, mapId, center, projectedRooms, projectedConnections);
    }

    public ClusterRewrite editBoundary(LegacyGridSegment2x segment2x, InternalBoundaryType type, boolean deleteBoundary) {
        return editBoundary(segment2x == null ? List.<LegacyGridSegment2x>of() : List.of(segment2x), type, deleteBoundary);
    }

    public ClusterRewrite editBoundary(Collection<LegacyGridSegment2x> segments2x, InternalBoundaryType type, boolean deleteBoundary) {
        return ClusterRewritePlanner.editBoundary(this, segments2x, type, deleteBoundary);
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
                LegacyGridPoint2x.fromTileCenter(CellCoord.bestPoint(cells)));
    }

    public boolean overlaps(Collection<Point2i> candidateCells) {
        if (candidateCells == null || candidateCells.isEmpty() || cells.isEmpty()) {
            return false;
        }
        for (Point2i cell : candidateCells) {
            if (cell != null && cells.contains(cell)) {
                return true;
            }
        }
        return false;
    }

    public Room singleRoom() {
        return rooms.size() == 1 ? rooms.getFirst() : null;
    }

    public RoomCluster movedBy(Point2i delta) {
        return movedBy(delta, 0);
    }

    public RoomCluster movedBy(Point2i delta, int levelDelta) {
        boolean translate = delta != null && (delta.x() != 0 || delta.y() != 0);
        if (!translate && levelDelta == 0) {
            return this;
        }
        Point2i resolvedDelta = delta == null ? new Point2i(0, 0) : delta;
        return new RoomCluster(
                clusterId,
                mapId,
                center.add(resolvedDelta),
                rooms.stream()
                        .map(room -> room == null ? null : room.movedBy(resolvedDelta, levelDelta))
                        .toList(),
                localConnections.stream()
                        .map(connection -> movedConnection(connection, resolvedDelta))
                        .toList());
    }

    public Set<Point2i> cells() {
        return cells;
    }

    public Map<Integer, Set<Point2i>> cellsByLevel() {
        Map<Integer, LinkedHashSet<Point2i>> result = new LinkedHashMap<>();
        for (Room room : rooms) {
            if (room == null) {
                continue;
            }
            for (Integer levelZ : room.structure().levels().stream().sorted().toList()) {
                Set<Point2i> cellsAtLevel = room.structure().cellsAtLevel(levelZ);
                if (cellsAtLevel.isEmpty()) {
                    continue;
                }
                result.computeIfAbsent(levelZ, ignored -> new LinkedHashSet<>()).addAll(cellsAtLevel);
            }
        }
        Map<Integer, Set<Point2i>> immutable = new LinkedHashMap<>();
        for (Map.Entry<Integer, LinkedHashSet<Point2i>> entry : result.entrySet()) {
            immutable.put(entry.getKey(), Set.copyOf(entry.getValue()));
        }
        return immutable.isEmpty() ? Map.of() : Map.copyOf(immutable);
    }

    public int primaryLevel() {
        return cellsByLevel().keySet().stream()
                .mapToInt(Integer::intValue)
                .min()
                .orElse(0);
    }

    public Set<LegacyGridSegment2x> outerBoundarySegments2x() {
        return boundarySegments(cells);
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
            if (!ClusterRewritePlanner.sameRoomId(existing, room)) {
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
        Floor resolvedFloor = floor == null ? Floor.empty() : floor;
        return Room.create(
                roomId,
                mapId,
                clusterId == null ? 0L : clusterId,
                ClusterRewritePlanner.normalizedRoomName(roomId, name),
                StructureObject.fromDescriptor(ClusterRewritePlanner.descriptorForStandaloneRoom(resolvedFloor)));
    }

    public RoomCluster withCreatedRoom(Long roomId, String name, Floor floor) {
        return withAddedRoom(createRoom(roomId, name, floor));
    }

    public Room roomAt(Point2i cell) {
        return cell == null ? null : roomsByCell.get(cell);
    }

    public Room roomAt(CellCoord cell) {
        return roomAt(cell == null ? null : cell.toPoint2i());
    }

    public Room roomAt(CubePoint point) {
        return point == null ? null : roomsByPoint.get(point);
    }

    public boolean contains(Point2i cell) {
        return cell != null && cells.contains(cell);
    }

    public boolean contains(CellCoord cell) {
        return contains(cell == null ? null : cell.toPoint2i());
    }

    public Set<CubePoint> cubePoints() {
        return Set.copyOf(roomsByPoint.keySet());
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

    public Map<LegacyGridSegment2x, InternalBoundaryType> internalBoundaryKinds() {
        return ClusterRewritePlanner.internalBoundaryKinds(cells, rooms, localConnections);
    }

    public ClusterRewrite applyPaint(Set<Point2i> paintCells, List<RoomCluster> overlappingClusters, int paintLevel) {
        return ClusterRewritePlanner.applyPaint(this, paintCells, overlappingClusters, paintLevel);
    }

    public ClusterRewrite applyDelete(Set<Point2i> deletedCells, Supplier<String> roomNameSupplier, int deleteLevel) {
        return ClusterRewritePlanner.applyDelete(this, deletedCells, roomNameSupplier, deleteLevel);
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

    private static Room projectRoomToLevel(Room room, int levelZ) {
        if (room == null || !room.structure().levels().contains(levelZ)) {
            return null;
        }
        StructureDescriptor.LevelDescriptor levelDescriptor = room.structure().descriptor().level(levelZ);
        if (levelDescriptor == null) {
            return null;
        }
        return Room.resolved(
                room.roomId(),
                room.mapId(),
                room.clusterId(),
                room.name(),
                StructureObject.fromDescriptor(new StructureDescriptor(Map.of(levelZ, levelDescriptor))),
                room.narration());
    }

    private static OverlapIndex indexRoomsByCell(List<Room> rooms) {
        Map<Point2i, Room> result = new LinkedHashMap<>();
        boolean hasOverlaps = false;
        for (Room room : rooms) {
            if (room == null) {
                continue;
            }
            for (Point2i cell : room.structure().cells()) {
                if (result.containsKey(cell)) {
                    hasOverlaps = true;
                }
                result.put(cell, room);
            }
        }
        return new OverlapIndex(Map.copyOf(result), hasOverlaps);
    }

    private static Map<CubePoint, Room> indexRoomsByPoint(List<Room> rooms) {
        Map<CubePoint, Room> result = new LinkedHashMap<>();
        for (Room room : rooms) {
            if (room == null) {
                continue;
            }
            for (CubePoint point : room.structure().cubePoints()) {
                result.putIfAbsent(point, room);
            }
        }
        return Map.copyOf(result);
    }

    private static Set<Point2i> indexCells(List<Room> rooms) {
        LinkedHashSet<Point2i> result = new LinkedHashSet<>();
        for (Room room : rooms) {
            if (room != null) {
                result.addAll(room.structure().cells());
            }
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    private static Map<Long, Set<Long>> indexAdjacentRoomIds(Map<Long, Room> roomsById, Map<Point2i, Room> roomsByCell) {
        Map<Long, Set<Long>> result = new LinkedHashMap<>();
        for (Long roomId : roomsById.keySet()) {
            result.put(roomId, new LinkedHashSet<>());
        }
        for (Room room : roomsById.values()) {
            for (Point2i cell : room.structure().cells()) {
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
            components = components(roomsById.keySet(), adjacency());
        }
        return components;
    }

    private Map<Long, Set<Long>> componentByRoomId() {
        if (componentByRoomId == null) {
            componentByRoomId = indexComponentByRoomId(componentsLazy());
        }
        return componentByRoomId;
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
                room.structure(),
                room.narration());
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

    private static Set<LegacyGridSegment2x> boundarySegments(Set<Point2i> cells) {
        if (cells == null || cells.isEmpty()) {
            return Set.of();
        }
        LinkedHashSet<LegacyGridSegment2x> result = new LinkedHashSet<>();
        for (Point2i cell : cells) {
            for (Point2i step : Point2i.CARDINAL_STEPS) {
                if (!cells.contains(cell.add(step))) {
                    result.add(LegacyGridSegment2x.betweenCellAndStep(cell, step));
                }
            }
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    private static LocalConnection movedConnection(LocalConnection connection, Point2i delta) {
        if (connection == null || delta == null || connection.door() == null) {
            return connection;
        }
        return new LocalConnection(
                connection.connectionId(),
                connection.mapId(),
                connection.clusterId(),
                connection.levelZ(),
                connection.door().movedBy(delta),
                connection.endpoints());
    }

    private record OverlapIndex(Map<Point2i, Room> roomsByCell, boolean hasOverlaps) {
    }
}
