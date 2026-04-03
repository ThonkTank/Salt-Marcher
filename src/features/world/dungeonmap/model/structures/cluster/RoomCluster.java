package features.world.dungeonmap.model.structures.cluster;

import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.geometry.CardinalDirection;
import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.GridPoint2x;
import features.world.dungeonmap.model.geometry.GridSegment2x;
import features.world.dungeonmap.model.interaction.DungeonSelectionRef;
import features.world.dungeonmap.model.interaction.InteractiveLabelHandle;
import features.world.dungeonmap.model.objects.Door;
import features.world.dungeonmap.model.objects.Floor;
import features.world.dungeonmap.model.objects.StructureDescriptor;
import features.world.dungeonmap.model.objects.StructureObject;
import features.world.dungeonmap.model.structures.connection.ConnectionEndpoint;
import features.world.dungeonmap.model.structures.connection.LocalConnection;
import features.world.dungeonmap.model.structures.room.Room;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Supplier;

public final class RoomCluster {

    private final Long clusterId;
    private final long mapId;
    private final CellCoord center;
    // A cluster manages room grouping/runtime lookup, but room truth lives in the rooms.
    private final List<Room> rooms;
    private final List<LocalConnection> localConnections;
    private final Set<CellCoord> cells;
    private final Map<Long, Room> roomsById;
    private final Map<CellCoord, Room> roomsByCell;
    private final Map<CubePoint, Room> roomsByPoint;
    // Lazy-computed on first access; safe because RoomCluster is only accessed on the FX application thread.
    private Map<Long, Set<Long>> adjacentRoomIdsByRoomId;
    private List<Set<Long>> components;
    private Map<Long, Set<Long>> componentByRoomId;
    private final boolean hasOverlappingRooms;

    public RoomCluster(
            Long clusterId,
            long mapId,
            CellCoord center,
            List<Room> rooms
    ) {
        List<Room> resolvedRooms = rooms == null ? List.of() : List.copyOf(rooms);
        Map<Long, Room> resolvedRoomsById = indexRoomsById(resolvedRooms);
        OverlapIndex overlapIndex = indexRoomsByCell(resolvedRooms);

        this.clusterId = clusterId;
        this.mapId = mapId;
        this.center = center == null ? new CellCoord(0, 0) : center;
        this.rooms = resolvedRooms;
        this.localConnections = deriveLocalConnections(mapId, clusterId, resolvedRooms);
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

    public CellCoord center() {
        return center;
    }

    public List<Room> rooms() {
        return rooms;
    }

    public List<LocalConnection> localConnections() {
        return localConnections;
    }

    public RoomCluster withRooms(List<Room> rooms) {
        return new RoomCluster(clusterId, mapId, center, rooms);
    }

    public RoomCluster projectedToLevel(int levelZ) {
        List<Room> projectedRooms = rooms.stream()
                .map(room -> projectRoomToLevel(room, levelZ))
                .filter(room -> room != null)
                .toList();
        if (projectedRooms.isEmpty()) {
            return null;
        }
        return new RoomCluster(clusterId, mapId, center, projectedRooms);
    }

    public ClusterRewrite editBoundary(GridSegment2x segment2x, InternalBoundaryType type, boolean deleteBoundary) {
        return editBoundary(segment2x == null ? List.<GridSegment2x>of() : List.of(segment2x), type, deleteBoundary);
    }

    public ClusterRewrite editBoundary(Collection<GridSegment2x> segments2x, InternalBoundaryType type, boolean deleteBoundary) {
        return ClusterRewritePlanner.editBoundary(this, segments2x, type, deleteBoundary);
    }

    public InteractiveLabelHandle labelHandle() {
        return new InteractiveLabelHandle(
                new DungeonSelectionRef.ClusterRef(clusterId),
                clusterId == null ? "Cluster" : "Cluster " + clusterId,
                GridPoint2x.cell(CellCoord.bestCenter(cells)));
    }

    public boolean overlapsCells(Collection<CellCoord> candidateCells) {
        if (candidateCells == null || candidateCells.isEmpty() || cells.isEmpty()) {
            return false;
        }
        for (CellCoord cell : candidateCells) {
            if (cell != null && cells.contains(cell)) {
                return true;
            }
        }
        return false;
    }

    public Room singleRoom() {
        return rooms.size() == 1 ? rooms.getFirst() : null;
    }

    public RoomCluster movedBy(CellCoord delta) {
        return movedBy(delta, 0);
    }

    public RoomCluster movedBy(CellCoord delta, int levelDelta) {
        boolean translate = delta != null && (delta.x() != 0 || delta.y() != 0);
        if (!translate && levelDelta == 0) {
            return this;
        }
        CellCoord resolvedDelta = delta == null ? new CellCoord(0, 0) : delta;
        return new RoomCluster(
                clusterId,
                mapId,
                center.add(resolvedDelta),
                rooms.stream()
                        .map(room -> room == null ? null : room.movedBy(resolvedDelta, levelDelta))
                        .toList());
    }

    public BoundaryPath findCreateBoundaryPath(GridPoint2x start, GridPoint2x goal) {
        if (start == null || goal == null) {
            return BoundaryPath.empty();
        }
        Set<GridSegment2x> traversableEdges = internalClusterEdges();
        Set<GridSegment2x> localConnectionEdges = localConnectionEdges(traversableEdges);
        List<GridSegment2x> route = shortestPath(start, goal, traversableEdges);
        if (route.isEmpty()) {
            return BoundaryPath.empty();
        }
        Set<GridSegment2x> committedEdges = new LinkedHashSet<>(route);
        committedEdges.removeAll(localConnectionEdges);
        Set<GridSegment2x> skippedConnectionEdges = new LinkedHashSet<>(route);
        skippedConnectionEdges.retainAll(localConnectionEdges);
        return new BoundaryPath(route, committedEdges, skippedConnectionEdges);
    }

    public BoundaryPath findDeleteBoundaryPath(GridPoint2x start, GridPoint2x goal) {
        if (start == null || goal == null) {
            return BoundaryPath.empty();
        }
        List<GridSegment2x> route = shortestPath(start, goal, internalWallEdges());
        if (route.isEmpty()) {
            return BoundaryPath.empty();
        }
        return new BoundaryPath(route, new LinkedHashSet<>(route), Set.of());
    }

    public boolean touchesExistingWall(GridPoint2x vertex) {
        if (vertex == null) {
            return false;
        }
        for (GridSegment2x edge : existingWallEdges()) {
            if (edge.start().equals(vertex) || edge.end().equals(vertex)) {
                return true;
            }
        }
        return false;
    }

    public boolean isEditableBoundaryVertex(GridPoint2x vertex, boolean deleteMode) {
        if (vertex == null) {
            return false;
        }
        Set<GridSegment2x> edges = deleteMode ? internalWallEdges() : internalClusterEdges();
        return edges.stream().anyMatch(edge -> edge.start().equals(vertex) || edge.end().equals(vertex));
    }

    public Set<CellCoord> cells() {
        return cells;
    }

    public Map<Integer, Set<CellCoord>> cellsByLevel() {
        Map<Integer, LinkedHashSet<CellCoord>> result = new LinkedHashMap<>();
        for (Room room : rooms) {
            if (room == null) {
                continue;
            }
            for (Integer levelZ : room.structure().levels().stream().sorted().toList()) {
                Set<CellCoord> cellsAtLevel = room.structure().cellCoordsAtLevel(levelZ);
                if (cellsAtLevel.isEmpty()) {
                    continue;
                }
                result.computeIfAbsent(levelZ, ignored -> new LinkedHashSet<>()).addAll(cellsAtLevel);
            }
        }
        Map<Integer, Set<CellCoord>> immutable = new LinkedHashMap<>();
        for (Map.Entry<Integer, LinkedHashSet<CellCoord>> entry : result.entrySet()) {
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

    public Set<GridSegment2x> outerBoundarySegments2x() {
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

    public Room roomAt(CellCoord cell) {
        return cell == null ? null : roomsByCell.get(cell);
    }

    public Room roomAt(CellCoord cell, int levelZ) {
        return cell == null ? null : roomsByPoint.get(CubePoint.at(cell, levelZ));
    }

    public Room roomAt(CubePoint point) {
        return point == null ? null : roomsByPoint.get(point);
    }

    public boolean contains(CellCoord cell) {
        return cell != null && cells.contains(cell);
    }

    public boolean contains(CellCoord cell, int levelZ) {
        return roomAt(cell, levelZ) != null;
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

    public Set<Long> componentContaining(CellCoord cell) {
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

    public Map<GridSegment2x, InternalBoundaryType> internalBoundaryKinds() {
        return ClusterRewritePlanner.internalBoundaryKinds(cells, rooms, localConnections);
    }

    public ClusterRewrite applyPaint(Set<CellCoord> paintCells, List<RoomCluster> overlappingClusters, int paintLevel) {
        return ClusterRewritePlanner.applyPaint(this, paintCells, overlappingClusters, paintLevel);
    }

    public ClusterRewrite applyDelete(Set<CellCoord> deletedCells, Supplier<String> roomNameSupplier, int deleteLevel) {
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
        Map<CellCoord, Room> result = new LinkedHashMap<>();
        boolean hasOverlaps = false;
        for (Room room : rooms) {
            if (room == null) {
                continue;
            }
            for (CellCoord cell : room.structure().cellCoords()) {
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

    private static Set<CellCoord> indexCells(List<Room> rooms) {
        LinkedHashSet<CellCoord> result = new LinkedHashSet<>();
        for (Room room : rooms) {
            if (room != null) {
                result.addAll(room.structure().cellCoords());
            }
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    private static Map<Long, Set<Long>> indexAdjacentRoomIds(Map<Long, Room> roomsById, Map<CellCoord, Room> roomsByCell) {
        Map<Long, Set<Long>> result = new LinkedHashMap<>();
        for (Long roomId : roomsById.keySet()) {
            result.put(roomId, new LinkedHashSet<>());
        }
        for (Room room : roomsById.values()) {
            for (CellCoord cell : room.structure().cellCoords()) {
                for (CellCoord step : CellCoord.CARDINAL_STEPS) {
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

    private Set<GridSegment2x> existingWallEdges() {
        Set<GridSegment2x> edges = new LinkedHashSet<>(internalWallEdges());
        edges.addAll(outerWallEdges());
        return Set.copyOf(edges);
    }

    private Set<GridSegment2x> internalClusterEdges() {
        Set<GridSegment2x> result = new LinkedHashSet<>();
        for (CellCoord cell : cells) {
            for (CellCoord step : CellCoord.CARDINAL_STEPS) {
                CellCoord neighbor = cell.add(step);
                if (!contains(neighbor) || CellCoord.ORDER.compare(cell, neighbor) >= 0) {
                    continue;
                }
                CardinalDirection direction = CardinalDirection.fromDirection(step);
                if (direction != null) {
                    result.add(GridSegment2x.boundaryEdge(cell, direction));
                }
            }
        }
        return Set.copyOf(result);
    }

    private Set<GridSegment2x> internalWallEdges() {
        return internalBoundaryKinds().entrySet().stream()
                .filter(entry -> entry.getValue() == InternalBoundaryType.WALL)
                .map(Map.Entry::getKey)
                .filter(Objects::nonNull)
                .sorted(GridSegment2x.ORDER)
                .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));
    }

    private Set<GridSegment2x> outerWallEdges() {
        Set<GridSegment2x> result = outerBoundarySegments2x().stream()
                .sorted(GridSegment2x.ORDER)
                .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));
        result.removeAll(localConnectionEdges(result));
        return Set.copyOf(result);
    }

    private Set<GridSegment2x> localConnectionEdges(Set<GridSegment2x> allowedEdges) {
        if (allowedEdges == null || allowedEdges.isEmpty()) {
            return Set.of();
        }
        return localConnections.stream()
                .filter(Objects::nonNull)
                .filter(connection -> connection.door() != null)
                .flatMap(connection -> connection.door().segments2x().stream())
                .filter(allowedEdges::contains)
                .sorted(GridSegment2x.ORDER)
                .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));
    }

    private static List<GridSegment2x> shortestPath(GridPoint2x start, GridPoint2x goal, Set<GridSegment2x> traversableEdges) {
        if (start == null || goal == null || traversableEdges == null || traversableEdges.isEmpty()) {
            return List.of();
        }
        if (Objects.equals(start, goal)) {
            return List.of();
        }
        Map<GridPoint2x, Set<GridPoint2x>> adjacency = adjacency(traversableEdges);
        if (!adjacency.containsKey(start) || !adjacency.containsKey(goal)) {
            return List.of();
        }
        ArrayDeque<GridPoint2x> queue = new ArrayDeque<>();
        Map<GridPoint2x, GridPoint2x> previous = new LinkedHashMap<>();
        queue.add(start);
        previous.put(start, null);
        while (!queue.isEmpty()) {
            GridPoint2x current = queue.removeFirst();
            if (current.equals(goal)) {
                break;
            }
            for (GridPoint2x neighbor : adjacency.getOrDefault(current, Set.of()).stream().sorted(GridPoint2x.ORDER).toList()) {
                if (previous.containsKey(neighbor)) {
                    continue;
                }
                previous.put(neighbor, current);
                queue.addLast(neighbor);
            }
        }
        if (!previous.containsKey(goal)) {
            return List.of();
        }
        ArrayList<GridSegment2x> path = new ArrayList<>();
        GridPoint2x current = goal;
        while (!Objects.equals(current, start)) {
            GridPoint2x parent = previous.get(current);
            if (parent == null) {
                return List.of();
            }
            path.add(new GridSegment2x(parent, current));
            current = parent;
        }
        java.util.Collections.reverse(path);
        return List.copyOf(path);
    }

    private static Map<GridPoint2x, Set<GridPoint2x>> adjacency(Collection<GridSegment2x> edges) {
        Map<GridPoint2x, Set<GridPoint2x>> result = new LinkedHashMap<>();
        for (GridSegment2x edge : edges == null ? List.<GridSegment2x>of() : edges) {
            if (edge == null) {
                continue;
            }
            result.computeIfAbsent(edge.start(), ignored -> new LinkedHashSet<>()).add(edge.end());
            result.computeIfAbsent(edge.end(), ignored -> new LinkedHashSet<>()).add(edge.start());
        }
        Map<GridPoint2x, Set<GridPoint2x>> immutable = new LinkedHashMap<>();
        for (Map.Entry<GridPoint2x, Set<GridPoint2x>> entry : result.entrySet()) {
            immutable.put(entry.getKey(), Set.copyOf(entry.getValue()));
        }
        return Map.copyOf(immutable);
    }

    private static Set<GridSegment2x> boundarySegments(Set<CellCoord> cells) {
        if (cells == null || cells.isEmpty()) {
            return Set.of();
        }
        LinkedHashSet<GridSegment2x> result = new LinkedHashSet<>();
        for (CellCoord cell : cells) {
            for (CellCoord step : CellCoord.CARDINAL_STEPS) {
                if (!cells.contains(cell.add(step))) {
                    result.add(GridSegment2x.boundaryEdge(cell, cell.directionTo4(cell.add(step))));
                }
            }
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    public static List<LocalConnection> deriveLocalConnections(long mapId, Long clusterId, List<Room> rooms) {
        if (rooms == null || rooms.isEmpty()) {
            return List.of();
        }
        long resolvedClusterId = clusterId == null ? 0L : clusterId;
        Map<CubePoint, Room> roomsByPoint = indexRoomsByPoint(rooms);
        Map<String, DoorComponent> doorsByKey = new LinkedHashMap<>();
        for (Room room : rooms) {
            if (room == null) {
                continue;
            }
            for (Integer levelZ : room.structure().levels()) {
                for (Door door : room.structure().doorsAtLevel(levelZ)) {
                    if (door != null) {
                        doorsByKey.putIfAbsent(doorKey(levelZ, door), new DoorComponent(levelZ, door));
                    }
                }
            }
        }
        List<LocalConnection> result = new ArrayList<>();
        for (DoorComponent doorComponent : doorsByKey.values()) {
            LocalConnection connection = localConnectionForDoor(doorComponent, mapId, resolvedClusterId, roomsByPoint);
            if (connection != null) {
                result.add(connection);
            }
        }
        return List.copyOf(result);
    }

    private static LocalConnection localConnectionForDoor(
            DoorComponent doorComponent,
            long mapId,
            long clusterId,
            Map<CubePoint, Room> roomsByPoint
    ) {
        if (doorComponent == null || doorComponent.door() == null) {
            return null;
        }
        List<Room> touchingRooms = new ArrayList<>();
        for (GridSegment2x segment2x : doorComponent.door().segments2x()) {
            for (CellCoord cell : segment2x.touchingCells().stream().sorted(CellCoord.ORDER).toList()) {
                Room room = roomsByPoint.get(CubePoint.at(cell, doorComponent.levelZ()));
                if (room != null && !touchingRooms.contains(room)) {
                    touchingRooms.add(room);
                }
            }
        }
        List<ConnectionEndpoint> endpoints = endpointsForDoor(clusterId, touchingRooms);
        if (endpoints.size() != 2) {
            return null;
        }
        return new LocalConnection(
                null,
                mapId,
                clusterId,
                doorComponent.levelZ(),
                Door.fromSegments(doorComponent.door().segments2x(), doorComponent.door().doorState()),
                endpoints);
    }

    private static List<ConnectionEndpoint> endpointsForDoor(long clusterId, List<Room> touchingRooms) {
        if (touchingRooms == null || touchingRooms.isEmpty()) {
            return List.of();
        }
        if (touchingRooms.size() >= 2) {
            Room leftRoom = touchingRooms.getFirst();
            Room rightRoom = touchingRooms.get(1);
            if (leftRoom.roomId() == null || rightRoom.roomId() == null || leftRoom.roomId().equals(rightRoom.roomId())) {
                return List.of();
            }
            return List.of(ConnectionEndpoint.room(leftRoom.roomId()), ConnectionEndpoint.room(rightRoom.roomId()));
        }
        Room room = touchingRooms.getFirst();
        if (room.roomId() == null) {
            return List.of();
        }
        return List.of(ConnectionEndpoint.room(room.roomId()), ConnectionEndpoint.cluster(clusterId));
    }

    private static String doorKey(int levelZ, Door door) {
        StringBuilder builder = new StringBuilder();
        builder.append(levelZ).append(':');
        boolean first = true;
        for (GridSegment2x segment2x : (door == null ? List.<GridSegment2x>of() : door.segments2x()).stream()
                .sorted(GridSegment2x.ORDER)
                .toList()) {
            if (!first) {
                builder.append('|');
            }
            first = false;
            builder.append(segment2x.start().x2()).append(',').append(segment2x.start().y2())
                    .append('-')
                    .append(segment2x.end().x2()).append(',').append(segment2x.end().y2());
        }
        return builder.toString();
    }

    private record DoorComponent(int levelZ, Door door) {
    }

    private record OverlapIndex(Map<CellCoord, Room> roomsByCell, boolean hasOverlaps) {
    }

    public record BoundaryPath(
            List<GridSegment2x> routeEdges,
            Set<GridSegment2x> committedEdges,
            Set<GridSegment2x> skippedConnectionEdges
    ) {
        public BoundaryPath {
            routeEdges = routeEdges == null ? List.of() : List.copyOf(routeEdges);
            committedEdges = committedEdges == null ? Set.of() : Set.copyOf(committedEdges);
            skippedConnectionEdges = skippedConnectionEdges == null ? Set.of() : Set.copyOf(skippedConnectionEdges);
        }

        public static BoundaryPath empty() {
            return new BoundaryPath(List.of(), Set.of(), Set.of());
        }

        public boolean hasRoute() {
            return !routeEdges.isEmpty();
        }
    }
}
