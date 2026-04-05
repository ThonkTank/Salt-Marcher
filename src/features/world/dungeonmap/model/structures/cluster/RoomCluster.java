package features.world.dungeonmap.model.structures.cluster;

import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.geometry.CardinalDirection;
import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.GridPoint2x;
import features.world.dungeonmap.model.geometry.GridSegment2x;
import features.world.dungeonmap.model.interaction.DungeonSelectionRef;
import features.world.dungeonmap.model.interaction.InteractiveLabelHandle;
import features.world.dungeonmap.model.objects.Door;
import features.world.dungeonmap.model.objects.StructureDescriptor;
import features.world.dungeonmap.model.objects.StructureObject;
import features.world.dungeonmap.model.objects.Wall;
import features.world.dungeonmap.model.structures.connection.ConnectionEndpoint;
import features.world.dungeonmap.model.structures.connection.ConnectionKind;
import features.world.dungeonmap.model.structures.connection.DoorConnectionCarrier;
import features.world.dungeonmap.model.structures.connection.DungeonConnection;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.model.structures.room.RoomNarration;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

public final class RoomCluster {

    private final Long clusterId;
    private final long mapId;
    private final CellCoord center;
    private final StructureObject structure;
    // A cluster owns the physical structure; rooms are derived enclosed-space projections plus metadata.
    private final List<Room> rooms;
    private final Map<Room, StructureObject> roomStructuresByRoom;
    private final Map<Long, StructureObject> roomStructuresById;
    private final List<DungeonConnection> localConnections;
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
        this(clusterId, mapId, center, StructureObject.empty(), requireExplicitStructure(rooms));
    }

    public RoomCluster(
            Long clusterId,
            long mapId,
            CellCoord center,
            StructureObject structure,
            List<Room> rooms
    ) {
        StructureObject resolvedStructure = normalizeClusterStructure(structure, rooms);
        RoomSurfaceIndex roomSurfaceIndex = deriveRoomsFromStructure(clusterId, mapId, resolvedStructure, rooms);
        List<Room> resolvedRooms = roomSurfaceIndex.rooms();
        Map<Room, StructureObject> resolvedRoomStructuresByRoom = roomSurfaceIndex.structuresByRoom();
        Map<Long, StructureObject> resolvedRoomStructuresById =
                indexRoomStructuresById(resolvedRooms, resolvedRoomStructuresByRoom);
        Map<Long, Room> resolvedRoomsById = indexRoomsById(resolvedRooms);
        OverlapIndex overlapIndex = indexRoomsByCell(resolvedRooms, resolvedRoomStructuresByRoom);

        this.clusterId = clusterId;
        this.mapId = mapId;
        this.center = center == null ? new CellCoord(0, 0) : center;
        this.structure = resolvedStructure;
        this.rooms = resolvedRooms;
        this.roomStructuresByRoom = resolvedRoomStructuresByRoom;
        this.roomStructuresById = resolvedRoomStructuresById;
        this.localConnections = deriveLocalConnections(mapId, clusterId, resolvedRooms, resolvedRoomStructuresByRoom);
        this.cells = resolvedStructure.cellCoords();
        this.roomsById = resolvedRoomsById;
        this.roomsByCell = overlapIndex.roomsByCell();
        this.roomsByPoint = indexRoomsByPoint(resolvedRooms, resolvedRoomStructuresByRoom);
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

    public StructureObject structure() {
        return structure;
    }

    public Set<Integer> roomLevels(Room room) {
        return structureFor(room).levels();
    }

    public Set<Integer> roomLevels(Long roomId) {
        return structureFor(roomId).levels();
    }

    public int roomPrimaryLevel(Room room) {
        return structureFor(room).primaryLevel();
    }

    public int roomPrimaryLevel(Long roomId) {
        return structureFor(roomId).primaryLevel();
    }

    public List<Integer> roomRelevantLevels(Room room, CellCoord focusCell, int focusLevelZ) {
        return structureFor(room).relevantLevels(focusCell, focusLevelZ);
    }

    public CellCoord roomAnchorCellAtLevel(Room room, int levelZ) {
        return structureFor(room).anchorCellCoordAtLevel(levelZ);
    }

    public CellCoord roomAnchorCellAtLevel(Long roomId, int levelZ) {
        return structureFor(roomId).anchorCellCoordAtLevel(levelZ);
    }

    public CellCoord roomCenterCellAtLevel(Room room, int levelZ) {
        return structureFor(room).centerCellCoordAtLevel(levelZ);
    }

    public CellCoord roomCenterCellAtLevel(Long roomId, int levelZ) {
        return structureFor(roomId).centerCellCoordAtLevel(levelZ);
    }

    public CellCoord roomSurfaceCenterCellAtLevel(Room room, int levelZ) {
        return structureFor(room).surfaceCenterCellCoordAtLevel(levelZ);
    }

    public Set<CellCoord> roomCellsAtLevel(Room room, int levelZ) {
        return structureFor(room).cellCoordsAtLevel(levelZ);
    }

    public Set<CellCoord> roomCellsAtLevel(Long roomId, int levelZ) {
        return structureFor(roomId).cellCoordsAtLevel(levelZ);
    }

    public Set<CellCoord> roomFloorCellsAtLevel(Room room, int levelZ) {
        return structureFor(room).floorCellCoordsAtLevel(levelZ);
    }

    public Set<CellCoord> roomFloorCellsAtLevel(Long roomId, int levelZ) {
        return structureFor(roomId).floorCellCoordsAtLevel(levelZ);
    }

    public Set<GridSegment2x> roomBoundaryEdgesAtLevel(Room room, int levelZ) {
        return structureFor(room).boundaryEdgesAtLevel(levelZ);
    }

    public Set<GridSegment2x> roomBoundaryEdgesAtLevel(Long roomId, int levelZ) {
        return structureFor(roomId).boundaryEdgesAtLevel(levelZ);
    }

    public Set<GridSegment2x> roomOpeningEdgesAtLevel(Room room, int levelZ) {
        return structureFor(room).openingEdgesAtLevel(levelZ);
    }

    public Set<GridSegment2x> roomOpeningEdgesAtLevel(Long roomId, int levelZ) {
        return structureFor(roomId).openingEdgesAtLevel(levelZ);
    }

    public boolean roomContainsCell(Room room, CellCoord cell, int levelZ) {
        return structureFor(room).contains(cell, levelZ);
    }

    public boolean roomContainsCell(Long roomId, CellCoord cell, int levelZ) {
        return structureFor(roomId).contains(cell, levelZ);
    }

    public boolean roomHasFloorCell(Room room, CellCoord cell, int levelZ) {
        return structureFor(room).hasFloorCell(cell, levelZ);
    }

    public boolean roomHasFloorCell(Long roomId, CellCoord cell, int levelZ) {
        return structureFor(roomId).hasFloorCell(cell, levelZ);
    }

    public List<Room> rooms() {
        return rooms;
    }

    public List<DungeonConnection> localConnections() {
        return localConnections;
    }

    public RoomCluster withRooms(List<Room> rooms) {
        return new RoomCluster(clusterId, mapId, center, structure, rooms);
    }

    public RoomCluster withClusterId(Long clusterId) {
        long resolvedClusterId = clusterId == null ? (this.clusterId == null ? 0L : this.clusterId) : clusterId;
        return new RoomCluster(
                clusterId,
                mapId,
                center,
                structure,
                rooms.stream()
                        .map(room -> room == null ? null : room.withClusterId(resolvedClusterId))
                        .toList());
    }

    public RoomCluster projectedToLevel(int levelZ) {
        StructureDescriptor.LevelDescriptor structureLevel = structure.descriptor().level(levelZ);
        if (structureLevel == null) {
            return null;
        }
        List<Room> projectedRooms = rooms.stream()
                .map(room -> projectRoomToLevel(room, levelZ))
                .filter(room -> room != null)
                .toList();
        if (projectedRooms.isEmpty()) {
            return null;
        }
        return new RoomCluster(
                clusterId,
                mapId,
                center,
                StructureObject.fromDescriptor(new StructureDescriptor(Map.of(levelZ, structureLevel))),
                projectedRooms);
    }

    public RoomCluster editBoundary(GridSegment2x segment2x, InternalBoundaryType type, boolean deleteBoundary) {
        return editBoundary(segment2x == null ? List.<GridSegment2x>of() : List.of(segment2x), type, deleteBoundary);
    }

    public RoomCluster editBoundary(Collection<GridSegment2x> segments2x, InternalBoundaryType type, boolean deleteBoundary) {
        return Topology.editBoundary(this, segments2x, type, deleteBoundary);
    }

    public RoomCluster moveDoor(GridSegment2x sourceBoundarySegment2x, GridSegment2x targetBoundarySegment2x) {
        // Door movement stays cluster-owned so SELECT drag and write workflows reuse the same local boundary rules.
        return Topology.moveDoor(this, sourceBoundarySegment2x, targetBoundarySegment2x);
    }

    public boolean canCreateDoor(GridSegment2x boundarySegment2x) {
        // Door eligibility belongs to the cluster owner so editor tools do not become the only source of boundary
        // semantics for local room-to-room connections.
        if (boundarySegment2x == null || internalBoundaryKinds().get(boundarySegment2x) == InternalBoundaryType.DOOR) {
            return false;
        }
        Set<CellCoord> touchingCells = boundarySegment2x.touchingCells();
        if (touchingCells.size() != 2 || !cells.containsAll(touchingCells)) {
            return false;
        }
        List<CellCoord> orderedCells = touchingCells.stream().sorted(CellCoord.ORDER).toList();
        Room left = roomAt(orderedCells.getFirst());
        Room right = roomAt(orderedCells.getLast());
        return left != null
                && right != null
                && left.roomId() != null
                && right.roomId() != null
                && !left.roomId().equals(right.roomId());
    }

    public boolean canDeleteDoor(GridSegment2x boundarySegment2x) {
        return boundarySegment2x != null && internalBoundaryKinds().get(boundarySegment2x) == InternalBoundaryType.DOOR;
    }

    public boolean canCreateExteriorOpening(int levelZ, GridSegment2x boundarySegment2x) {
        return boundarySegment2x != null
                && structure.boundaryEdgesAtLevel(levelZ).contains(boundarySegment2x)
                && !structure.openingEdgesAtLevel(levelZ).contains(boundarySegment2x)
                && isExteriorBoundarySegment(levelZ, boundarySegment2x);
    }

    public boolean canDeleteExteriorOpening(int levelZ, GridSegment2x boundarySegment2x) {
        return boundarySegment2x != null
                && structure.openingEdgesAtLevel(levelZ).contains(boundarySegment2x)
                && isExteriorBoundarySegment(levelZ, boundarySegment2x);
    }

    public RoomCluster withExteriorOpening(int levelZ, GridSegment2x boundarySegment2x) {
        return withExteriorOpenings(levelZ, boundarySegment2x == null ? List.<GridSegment2x>of() : List.of(boundarySegment2x), false);
    }

    public RoomCluster withoutExteriorOpening(int levelZ, GridSegment2x boundarySegment2x) {
        return withExteriorOpenings(levelZ, boundarySegment2x == null ? List.<GridSegment2x>of() : List.of(boundarySegment2x), true);
    }

    public RoomCluster withExteriorOpenings(int levelZ, Collection<GridSegment2x> segments2x, boolean deleteOpening) {
        if (segments2x == null || segments2x.isEmpty()) {
            return this;
        }
        LinkedHashSet<GridSegment2x> nextOpenings = new LinkedHashSet<>(structure.openingEdgesAtLevel(levelZ));
        boolean changed = false;
        for (GridSegment2x segment2x : segments2x) {
            if (segment2x == null) {
                continue;
            }
            boolean eligible = deleteOpening
                    ? canDeleteExteriorOpening(levelZ, segment2x)
                    : canCreateExteriorOpening(levelZ, segment2x);
            if (!eligible) {
                continue;
            }
            changed |= deleteOpening ? nextOpenings.remove(segment2x) : nextOpenings.add(segment2x);
        }
        if (!changed) {
            return this;
        }
        StructureDescriptor descriptor = structure.descriptor().withOpeningEdgesAtLevel(levelZ, nextOpenings);
        return new RoomCluster(clusterId, mapId, center, StructureObject.fromDescriptor(descriptor), rooms);
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
                structure.movedBy(resolvedDelta, levelDelta),
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
        List<GridSegment2x> route = shortestPath(start, goal, deletableInternalBoundaryEdges());
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
        Set<GridSegment2x> edges = deleteMode ? deletableInternalBoundaryEdges() : internalClusterEdges();
        return edges.stream().anyMatch(edge -> edge.start().equals(vertex) || edge.end().equals(vertex));
    }

    public Set<CellCoord> cells() {
        return cells;
    }

    private boolean isExteriorBoundarySegment(int levelZ, GridSegment2x boundarySegment2x) {
        if (boundarySegment2x == null || !structure.boundaryEdgesAtLevel(levelZ).contains(boundarySegment2x)) {
            return false;
        }
        long touchingClusterCells = boundarySegment2x.touchingCells().stream()
                .filter(cell -> structure.cellCoordsAtLevel(levelZ).contains(cell))
                .count();
        return touchingClusterCells == 1L;
    }

    public Map<Integer, Set<CellCoord>> cellsByLevel() {
        Map<Integer, Set<CellCoord>> result = new LinkedHashMap<>();
        for (Integer levelZ : structure.levels().stream().sorted().toList()) {
            Set<CellCoord> cellsAtLevel = structure.cellCoordsAtLevel(levelZ);
            if (!cellsAtLevel.isEmpty()) {
                result.put(levelZ, Set.copyOf(cellsAtLevel));
            }
        }
        return result.isEmpty() ? Map.of() : Map.copyOf(result);
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
        return Topology.internalBoundaryKinds(this);
    }

    public RoomCluster applyPaint(Set<CellCoord> paintCells, List<RoomCluster> overlappingClusters, int paintLevel) {
        return Topology.applyPaint(this, paintCells, overlappingClusters, paintLevel);
    }

    public List<RoomCluster> applyDelete(Set<CellCoord> deletedCells, int deleteLevel) {
        return Topology.applyDelete(this, deletedCells, deleteLevel);
    }

    private StructureObject structureFor(Room room) {
        if (room == null) {
            return StructureObject.empty();
        }
        StructureObject structure = roomStructuresByRoom.get(room);
        if (structure != null) {
            return structure;
        }
        if (room.roomId() != null) {
            return structureFor(room.roomId());
        }
        return StructureObject.empty();
    }

    private StructureObject structureFor(Long roomId) {
        if (roomId == null) {
            return StructureObject.empty();
        }
        return roomStructuresById.getOrDefault(roomId, StructureObject.empty());
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

    private static Map<Long, StructureObject> indexRoomStructuresById(
            List<Room> rooms,
            Map<Room, StructureObject> roomStructuresByRoom
    ) {
        Map<Long, StructureObject> result = new LinkedHashMap<>();
        for (Room room : rooms == null ? List.<Room>of() : rooms) {
            if (room != null && room.roomId() != null) {
                result.put(room.roomId(), structureFor(room, roomStructuresByRoom));
            }
        }
        return result.isEmpty() ? Map.of() : Map.copyOf(result);
    }

    private static StructureObject structureFor(Room room, Map<Room, StructureObject> roomStructuresByRoom) {
        if (room == null || roomStructuresByRoom == null || roomStructuresByRoom.isEmpty()) {
            return StructureObject.empty();
        }
        return roomStructuresByRoom.getOrDefault(room, StructureObject.empty());
    }

    private static List<Room> requireExplicitStructure(List<Room> rooms) {
        List<Room> resolvedRooms = rooms == null ? List.of() : List.copyOf(rooms);
        if (!resolvedRooms.isEmpty()) {
            throw new IllegalArgumentException("RoomCluster requires explicit structure when rooms are present");
        }
        return resolvedRooms;
    }

    private static Room projectRoomToLevel(Room room, int levelZ) {
        if (room == null || room.anchorAtLevel(levelZ) == null) {
            return null;
        }
        return Room.metadata(
                room.roomId(),
                room.mapId(),
                room.clusterId(),
                room.name(),
                Map.of(levelZ, room.anchorAtLevel(levelZ)),
                room.narration());
    }

    private static OverlapIndex indexRoomsByCell(List<Room> rooms, Map<Room, StructureObject> roomStructuresByRoom) {
        Map<CellCoord, Room> result = new LinkedHashMap<>();
        boolean hasOverlaps = false;
        for (Room room : rooms) {
            if (room == null) {
                continue;
            }
            for (CellCoord cell : structureFor(room, roomStructuresByRoom).cellCoords()) {
                if (result.containsKey(cell)) {
                    hasOverlaps = true;
                }
                result.put(cell, room);
            }
        }
        return new OverlapIndex(Map.copyOf(result), hasOverlaps);
    }

    private static Map<CubePoint, Room> indexRoomsByPoint(List<Room> rooms, Map<Room, StructureObject> roomStructuresByRoom) {
        Map<CubePoint, Room> result = new LinkedHashMap<>();
        for (Room room : rooms) {
            if (room == null) {
                continue;
            }
            for (CubePoint point : structureFor(room, roomStructuresByRoom).cubePoints()) {
                result.putIfAbsent(point, room);
            }
        }
        return Map.copyOf(result);
    }

    private static StructureObject normalizeClusterStructure(StructureObject structure, List<Room> rooms) {
        if (structure != null && !structure.levels().isEmpty()) {
            return structure;
        }
        if (rooms == null || rooms.isEmpty()) {
            return StructureObject.empty();
        }
        throw new IllegalArgumentException("RoomCluster requires explicit structure when rooms are present");
    }

    private static StructureObject structureForRooms(List<Room> rooms, Map<Room, StructureObject> roomStructuresByRoom) {
        List<Room> resolvedRooms = rooms == null ? List.of() : List.copyOf(rooms);
        if (resolvedRooms.isEmpty()) {
            return StructureObject.empty();
        }
        Map<Integer, Set<CellCoord>> clusterCellsByLevel = new LinkedHashMap<>();
        Map<Integer, Set<CellCoord>> clusterFloorCellsByLevel = new LinkedHashMap<>();
        Map<Integer, Set<CellCoord>> fillSeedsByLevel = new LinkedHashMap<>();
        Map<Integer, Set<GridSegment2x>> internalWallSegmentsByLevel = new LinkedHashMap<>();
        Map<Integer, Set<GridSegment2x>> openingSegmentsByLevel = new LinkedHashMap<>();

        for (Room room : resolvedRooms) {
            StructureObject roomStructure = structureFor(room, roomStructuresByRoom);
            for (Integer levelZ : roomStructure.levels()) {
                clusterCellsByLevel.computeIfAbsent(levelZ, ignored -> new LinkedHashSet<>())
                        .addAll(roomStructure.cellCoordsAtLevel(levelZ));
                clusterFloorCellsByLevel.computeIfAbsent(levelZ, ignored -> new LinkedHashSet<>())
                        .addAll(roomStructure.floorCellCoordsAtLevel(levelZ));
                StructureDescriptor.LevelDescriptor roomLevel = roomStructure.descriptor().level(levelZ);
                if (roomLevel != null) {
                    fillSeedsByLevel.computeIfAbsent(levelZ, ignored -> new LinkedHashSet<>())
                            .addAll(roomLevel.fillSeeds());
                }
                for (Door door : roomStructure.doorsAtLevel(levelZ)) {
                    openingSegmentsByLevel.computeIfAbsent(levelZ, ignored -> new LinkedHashSet<>())
                            .addAll(door.segments2x());
                }
            }
        }

        for (Room room : resolvedRooms) {
            StructureObject roomStructure = structureFor(room, roomStructuresByRoom);
            for (Integer levelZ : roomStructure.levels()) {
                Set<CellCoord> levelCells = clusterCellsByLevel.getOrDefault(levelZ, Set.of());
                for (Wall wall : roomStructure.wallsAtLevel(levelZ)) {
                    for (GridSegment2x segment2x : wall.segments2x()) {
                        if (segment2x.touchingCells().size() == 2
                                && levelCells.containsAll(segment2x.touchingCells())) {
                            internalWallSegmentsByLevel.computeIfAbsent(levelZ, ignored -> new LinkedHashSet<>())
                                    .add(segment2x);
                        }
                    }
                }
            }
        }

        Map<Integer, StructureDescriptor.LevelDescriptor> levels = new LinkedHashMap<>();
        for (Map.Entry<Integer, Set<CellCoord>> entry : clusterCellsByLevel.entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .toList()) {
            Integer levelZ = entry.getKey();
            Set<CellCoord> cellsAtLevel = entry.getValue();
            if (levelZ == null || cellsAtLevel == null || cellsAtLevel.isEmpty()) {
                continue;
            }
            StructureDescriptor.LevelDescriptor baseLevel = StructureDescriptor.fromCellCoordsByLevel(
                    Map.of(levelZ, cellsAtLevel),
                    Map.of(levelZ, clusterFloorCellsByLevel.getOrDefault(levelZ, Set.of()))).level(levelZ);
            if (baseLevel == null) {
                continue;
            }
            LinkedHashSet<GridSegment2x> boundaryEdges = new LinkedHashSet<>(baseLevel.boundaryEdges());
            boundaryEdges.addAll(internalWallSegmentsByLevel.getOrDefault(levelZ, Set.of()));
            boundaryEdges.addAll(openingSegmentsByLevel.getOrDefault(levelZ, Set.of()));
            Set<CellCoord> fillSeeds = fillSeedsByLevel.getOrDefault(levelZ, baseLevel.fillSeeds());
            levels.put(levelZ, new StructureDescriptor.LevelDescriptor(
                    baseLevel.anchorCell(),
                    fillSeeds,
                    boundaryEdges,
                    openingSegmentsByLevel.getOrDefault(levelZ, Set.of()),
                    clusterFloorCellsByLevel.getOrDefault(levelZ, Set.of())));
        }
        return levels.isEmpty() ? StructureObject.empty() : StructureObject.fromDescriptor(new StructureDescriptor(levels));
    }

    private static Map<Integer, CellCoord> anchorsByLevel(StructureObject structure) {
        StructureObject resolvedStructure = structure == null ? StructureObject.empty() : structure;
        Map<Integer, CellCoord> result = new LinkedHashMap<>();
        for (Integer levelZ : resolvedStructure.levels().stream().sorted().toList()) {
            CellCoord anchor = resolvedStructure.anchorCellCoordAtLevel(levelZ);
            if (anchor != null) {
                result.put(levelZ, anchor);
            }
        }
        return result.isEmpty() ? Map.of() : Map.copyOf(result);
    }

    private static RoomSurfaceIndex deriveRoomsFromStructure(
            Long clusterId,
            long mapId,
            StructureObject clusterStructure,
            List<Room> roomMetadata
    ) {
        if (clusterStructure == null || clusterStructure.levels().isEmpty()) {
            return RoomSurfaceIndex.empty();
        }
        List<Room> metadata = roomMetadata == null ? List.of() : roomMetadata.stream()
                .filter(Objects::nonNull)
                .sorted(Comparator.comparing(Room::roomId, Comparator.nullsLast(Long::compareTo)))
                .toList();
        Map<Integer, Set<CellCoord>> remainingCellsByLevel = new LinkedHashMap<>();
        for (Integer levelZ : clusterStructure.levels().stream().sorted().toList()) {
            remainingCellsByLevel.put(levelZ, new LinkedHashSet<>(clusterStructure.cellCoordsAtLevel(levelZ)));
        }

        List<Room> result = new ArrayList<>();
        Map<Room, StructureObject> structuresByRoom = new LinkedHashMap<>();
        for (Room metadataRoom : metadata) {
            Map<Integer, Set<CellCoord>> roomCellsByLevel = new LinkedHashMap<>();
            for (Map.Entry<Integer, CellCoord> anchorEntry : metadataRoom.anchorsByLevel().entrySet().stream()
                    .sorted(Map.Entry.comparingByKey())
                    .toList()) {
                Integer levelZ = anchorEntry.getKey();
                CellCoord anchor = anchorEntry.getValue();
                if (levelZ == null || anchor == null) {
                    continue;
                }
                Set<CellCoord> remainingLevelCells = remainingCellsByLevel.get(levelZ);
                if (remainingLevelCells == null || !remainingLevelCells.contains(anchor)) {
                    continue;
                }
                Set<CellCoord> roomCells = reachableCells(anchor, remainingLevelCells, structureBarriers(clusterStructure, levelZ));
                if (roomCells.isEmpty()) {
                    continue;
                }
                remainingLevelCells.removeAll(roomCells);
                if (remainingLevelCells.isEmpty()) {
                    remainingCellsByLevel.remove(levelZ);
                }
                roomCellsByLevel.put(levelZ, Set.copyOf(roomCells));
            }
            if (roomCellsByLevel.isEmpty()) {
                continue;
            }
            RoomSurfaceProjection projection = resolvedDerivedRoom(
                    clusterId,
                    mapId,
                    metadataRoom,
                    roomCellsByLevel,
                    metadataRoom.narration(),
                    clusterStructure);
            result.add(projection.room());
            structuresByRoom.put(projection.room(), projection.structure());
        }

        for (Map.Entry<Integer, Set<CellCoord>> entry : new LinkedHashMap<>(remainingCellsByLevel).entrySet()) {
            Integer levelZ = entry.getKey();
            LinkedHashSet<CellCoord> unassigned = new LinkedHashSet<>(entry.getValue());
            while (!unassigned.isEmpty()) {
                CellCoord seed = unassigned.stream().min(CellCoord.ORDER).orElse(null);
                if (seed == null) {
                    break;
                }
                Set<CellCoord> roomCells = reachableCells(seed, unassigned, structureBarriers(clusterStructure, levelZ));
                if (roomCells.isEmpty()) {
                    unassigned.remove(seed);
                    continue;
                }
                unassigned.removeAll(roomCells);
                Room metadataRoom = Room.metadata(
                        null,
                        mapId,
                        clusterId == null ? 0L : clusterId,
                        null,
                        Map.of(levelZ, seed),
                        RoomNarration.empty());
                RoomSurfaceProjection projection = resolvedDerivedRoom(
                        clusterId,
                        mapId,
                        metadataRoom,
                        Map.of(levelZ, Set.copyOf(roomCells)),
                        metadataRoom.narration(),
                        clusterStructure);
                result.add(projection.room());
                structuresByRoom.put(projection.room(), projection.structure());
            }
        }
        return result.isEmpty() ? RoomSurfaceIndex.empty() : new RoomSurfaceIndex(result, structuresByRoom);
    }

    private static RoomSurfaceProjection resolvedDerivedRoom(
            Long clusterId,
            long mapId,
            Room metadataRoom,
            Map<Integer, Set<CellCoord>> roomCellsByLevel,
            RoomNarration narration,
            StructureObject clusterStructure
    ) {
        StructureObject derivedStructure = structureForDerivedRoom(roomCellsByLevel, metadataRoom.anchorsByLevel(), clusterStructure);
        Room room = new Room(
                metadataRoom.roomId(),
                mapId,
                clusterId == null ? 0L : clusterId,
                metadataRoom.name(),
                metadataRoom.anchorsByLevel(),
                narration);
        return new RoomSurfaceProjection(room, derivedStructure);
    }

    private static StructureObject structureForDerivedRoom(
            Map<Integer, Set<CellCoord>> roomCellsByLevel,
            Map<Integer, CellCoord> preferredAnchorsByLevel,
            StructureObject clusterStructure
    ) {
        Map<Integer, StructureDescriptor.LevelDescriptor> levels = new LinkedHashMap<>();
        for (Map.Entry<Integer, Set<CellCoord>> entry : roomCellsByLevel.entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .toList()) {
            Integer levelZ = entry.getKey();
            Set<CellCoord> roomCells = entry.getValue();
            if (levelZ == null || roomCells == null || roomCells.isEmpty()) {
                continue;
            }
            Set<CellCoord> floorCells = intersectCells(clusterStructure.floorCellCoordsAtLevel(levelZ), roomCells);
            StructureDescriptor.LevelDescriptor baseLevel = StructureDescriptor.fromCellCoordsByLevel(
                    Map.of(levelZ, roomCells),
                    Map.of(levelZ, floorCells)).level(levelZ);
            if (baseLevel == null) {
                continue;
            }
            CellCoord preferredAnchor = preferredAnchorsByLevel == null ? null : preferredAnchorsByLevel.get(levelZ);
            Set<GridSegment2x> openings = new LinkedHashSet<>();
            for (GridSegment2x opening : clusterStructure.openingEdgesAtLevel(levelZ)) {
                if (baseLevel.boundaryEdges().contains(opening)) {
                    openings.add(opening);
                }
            }
            levels.put(levelZ, new StructureDescriptor.LevelDescriptor(
                    anchorCell(roomCells, preferredAnchor),
                    baseLevel.fillSeeds(),
                    baseLevel.boundaryEdges(),
                    openings,
                    floorCells));
        }
        return levels.isEmpty() ? StructureObject.empty() : StructureObject.fromDescriptor(new StructureDescriptor(levels));
    }

    private static Set<GridSegment2x> structureBarriers(StructureObject structure, int levelZ) {
        if (structure == null) {
            return Set.of();
        }
        LinkedHashSet<GridSegment2x> barriers = new LinkedHashSet<>(GridSegment2x.boundarySteps(structure.boundaryEdgesAtLevel(levelZ)));
        barriers.removeAll(GridSegment2x.boundarySteps(structure.openingEdgesAtLevel(levelZ)));
        return barriers.isEmpty() ? Set.of() : Set.copyOf(barriers);
    }

    private static Set<CellCoord> reachableCells(
            CellCoord startAnchor,
            Set<CellCoord> traversableCells,
            Set<GridSegment2x> barriers
    ) {
        if (startAnchor == null || traversableCells == null || traversableCells.isEmpty() || !traversableCells.contains(startAnchor)) {
            return Set.of();
        }
        LinkedHashSet<CellCoord> remaining = new LinkedHashSet<>(traversableCells);
        ArrayDeque<CellCoord> queue = new ArrayDeque<>();
        LinkedHashSet<CellCoord> result = new LinkedHashSet<>();
        queue.add(startAnchor);
        remaining.remove(startAnchor);
        while (!queue.isEmpty()) {
            CellCoord current = queue.removeFirst();
            if (!result.add(current)) {
                continue;
            }
            for (CellCoord step : CellCoord.CARDINAL_STEPS) {
                CellCoord neighbor = current.add(step);
                if (!remaining.contains(neighbor)) {
                    continue;
                }
                GridSegment2x boundaryEdge = GridSegment2x.boundaryEdge(current, current.directionTo4(neighbor));
                if (barriers.contains(boundaryEdge)) {
                    continue;
                }
                remaining.remove(neighbor);
                queue.addLast(neighbor);
            }
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    private static Set<CellCoord> intersectCells(Collection<CellCoord> left, Collection<CellCoord> right) {
        if (left == null || right == null) {
            return Set.of();
        }
        LinkedHashSet<CellCoord> result = new LinkedHashSet<>();
        Set<CellCoord> rightSet = right instanceof Set<CellCoord> set ? set : new LinkedHashSet<>(right);
        for (CellCoord cell : left) {
            if (rightSet.contains(cell)) {
                result.add(cell);
            }
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    private static CellCoord anchorCell(Set<CellCoord> roomCells, CellCoord preferredAnchor) {
        return preferredAnchor != null && roomCells.contains(preferredAnchor)
                ? preferredAnchor
                : CellCoord.bestCenter(roomCells);
    }

    private static Map<Long, Set<Long>> indexAdjacentRoomIds(
            Map<Long, Room> roomsById,
            Map<Long, StructureObject> roomStructuresById,
            Map<CellCoord, Room> roomsByCell
    ) {
        Map<Long, Set<Long>> result = new LinkedHashMap<>();
        for (Long roomId : roomsById.keySet()) {
            result.put(roomId, new LinkedHashSet<>());
        }
        for (Room room : roomsById.values()) {
            StructureObject roomStructure = room == null ? StructureObject.empty()
                    : roomStructuresById.getOrDefault(room.roomId(), StructureObject.empty());
            for (CellCoord cell : roomStructure.cellCoords()) {
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
            adjacentRoomIdsByRoomId = immutableSetMap(indexAdjacentRoomIds(roomsById, roomStructuresById, roomsByCell));
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

    private Set<GridSegment2x> deletableInternalBoundaryEdges() {
        // Wall-delete treats existing local doors as removable internal barriers so a visible door segment does not
        // make the path look inert to the editor user.
        return internalBoundaryKinds().entrySet().stream()
                .filter(entry -> entry.getValue() == InternalBoundaryType.WALL || entry.getValue() == InternalBoundaryType.DOOR)
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

    private static final class Topology {

        private Topology() {
        }

        static RoomCluster applyPaint(RoomCluster cluster, Set<CellCoord> paintCells, List<RoomCluster> overlappingClusters, int paintLevel) {
            if (cluster == null || paintCells == null || paintCells.isEmpty()) {
                return null;
            }
            List<RoomCluster> resolvedClusters = normalizedClusters(overlappingClusters);
            List<Room> touchedRooms = resolvedClusters.stream()
                    .flatMap(candidate -> candidate.rooms().stream()
                            .filter(room -> room != null
                                    && room.roomId() != null
                                    && overlapsAtLevel(candidate, room, paintCells, paintLevel)))
                    .sorted(Comparator.comparing(room -> room.roomId() == null ? Long.MAX_VALUE : room.roomId()))
                    .toList();
            if (touchedRooms.isEmpty()) {
                return null;
            }

            Room retainedRoom = touchedRooms.getFirst();
            Set<Long> mergedRoomIds = touchedRooms.stream()
                    .map(Room::roomId)
                    .filter(Objects::nonNull)
                    .collect(LinkedHashSet::new, Set::add, Set::addAll);
            Map<Integer, Set<CellCoord>> mergedRoomCellsByLevel = new LinkedHashMap<>();
            Map<Integer, Set<CellCoord>> mergedRoomFloorCellsByLevel = new LinkedHashMap<>();
            for (Room room : touchedRooms) {
                mergeRoomCells(cluster, mergedRoomCellsByLevel, room);
                mergeRoomFloorCells(cluster, mergedRoomFloorCellsByLevel, room);
            }
            mergedRoomCellsByLevel.computeIfAbsent(paintLevel, ignored -> new LinkedHashSet<>()).addAll(paintCells);
            mergedRoomFloorCellsByLevel.computeIfAbsent(paintLevel, ignored -> new LinkedHashSet<>()).addAll(paintCells);

            Set<CellCoord> mergedClusterCells = new LinkedHashSet<>(paintCells);
            Map<GridSegment2x, InternalBoundaryType> previousBoundaryKinds = new LinkedHashMap<>();
            List<RoomRewriteCandidate> candidates = new ArrayList<>();
            for (RoomCluster overlappingCluster : resolvedClusters) {
                mergedClusterCells.addAll(overlappingCluster.cells());
                previousBoundaryKinds.putAll(overlappingCluster.internalBoundaryKinds());
                for (Room room : overlappingCluster.rooms()) {
                    if (room == null || room.roomId() == null || mergedRoomIds.contains(room.roomId())) {
                        continue;
                    }
                    candidates.add(RoomRewriteCandidate.keep(
                            room.roomId(),
                            room.name(),
                            roomCellsByLevel(overlappingCluster, room),
                            roomFloorCellsByLevel(overlappingCluster, room),
                            roomAnchorsByLevel(room)));
                }
            }
            candidates.add(RoomRewriteCandidate.keep(
                    retainedRoom.roomId(),
                    retainedRoom.name(),
                    mergedRoomCellsByLevel,
                    mergedRoomFloorCellsByLevel,
                    roomAnchorsByLevel(retainedRoom)));

            RoomSurfaceIndex rewrittenRooms = reconciledRooms(cluster, candidates, previousBoundaryKinds);
            return new RoomCluster(
                    cluster.clusterId(),
                    cluster.mapId(),
                    CellCoord.bestCenter(mergedClusterCells),
                    structureForRooms(rewrittenRooms.rooms(), rewrittenRooms.structuresByRoom()),
                    rewrittenRooms.rooms());
        }

        static List<RoomCluster> applyDelete(RoomCluster cluster, Set<CellCoord> deletedCells, int deleteLevel) {
            if (cluster == null || deletedCells == null || deletedCells.isEmpty()) {
                return null;
            }
            Map<Integer, Set<CellCoord>> remainingCellsByLevel = mutableClusterCellsByLevel(cluster);
            Set<CellCoord> remainingDeleteLevelCells = new LinkedHashSet<>(remainingCellsByLevel.getOrDefault(deleteLevel, Set.of()));
            if (!remainingDeleteLevelCells.removeAll(deletedCells)) {
                return null;
            }
            if (remainingDeleteLevelCells.isEmpty()) {
                remainingCellsByLevel.remove(deleteLevel);
            } else {
                remainingCellsByLevel.put(deleteLevel, Set.copyOf(remainingDeleteLevelCells));
            }
            if (remainingCellsByLevel.isEmpty()) {
                return List.of();
            }

            Map<GridSegment2x, InternalBoundaryType> previousBoundaryKinds = cluster.internalBoundaryKinds();
            List<RoomRewriteCandidate> candidates = new ArrayList<>();
            for (Room room : cluster.rooms()) {
                if (room == null || room.roomId() == null) {
                    continue;
                }
                Map<Integer, Set<CellCoord>> remainingRoomCellsByLevel = mutableCellsByLevel(roomCellsByLevel(cluster, room));
                Map<Integer, Set<CellCoord>> remainingRoomFloorCellsByLevel = mutableCellsByLevel(roomFloorCellsByLevel(cluster, room));
                Set<CellCoord> existingDeleteLevelCells = new LinkedHashSet<>(remainingRoomCellsByLevel.getOrDefault(deleteLevel, Set.of()));
                Set<CellCoord> remainingRoomDeleteLevelCells = new LinkedHashSet<>(existingDeleteLevelCells);
                remainingRoomDeleteLevelCells.removeAll(deletedCells);
                Set<CellCoord> remainingRoomDeleteFloorCells = new LinkedHashSet<>(remainingRoomFloorCellsByLevel.getOrDefault(deleteLevel, Set.of()));
                remainingRoomDeleteFloorCells.removeAll(deletedCells);
                if (remainingRoomDeleteLevelCells.isEmpty()) {
                    remainingRoomCellsByLevel.remove(deleteLevel);
                } else {
                    remainingRoomCellsByLevel.put(deleteLevel, Set.copyOf(remainingRoomDeleteLevelCells));
                }
                if (remainingRoomDeleteFloorCells.isEmpty()) {
                    remainingRoomFloorCellsByLevel.remove(deleteLevel);
                } else {
                    remainingRoomFloorCellsByLevel.put(deleteLevel, Set.copyOf(remainingRoomDeleteFloorCells));
                }
                List<Set<CellCoord>> components = connectedComponents(remainingRoomDeleteLevelCells).stream()
                        .sorted(Comparator
                                .comparing((Set<CellCoord> component) -> !contains(component, anchorCell(existingDeleteLevelCells, roomAnchorsByLevel(room).get(deleteLevel))))
                                .thenComparing(CellCoord::bestCenter, CellCoord.ORDER))
                        .toList();
                if (remainingRoomCellsByLevel.isEmpty()) {
                    continue;
                }
                if (components.isEmpty()) {
                    candidates.add(RoomRewriteCandidate.keep(
                            room.roomId(),
                            room.name(),
                            remainingRoomCellsByLevel,
                            remainingRoomFloorCellsByLevel,
                            roomAnchorsByLevel(room)));
                    continue;
                }
                for (int index = 0; index < components.size(); index++) {
                    Set<CellCoord> component = components.get(index);
                    Map<Integer, Set<CellCoord>> fragmentCellsByLevel = index == 0
                            ? mutableCellsByLevel(remainingRoomCellsByLevel)
                            : mutableCellsByLevelWithoutLevel(remainingRoomCellsByLevel, deleteLevel);
                    Map<Integer, Set<CellCoord>> fragmentFloorCellsByLevel = index == 0
                            ? mutableCellsByLevel(remainingRoomFloorCellsByLevel)
                            : mutableCellsByLevelWithoutLevel(remainingRoomFloorCellsByLevel, deleteLevel);
                    fragmentCellsByLevel.put(deleteLevel, Set.copyOf(component));
                    Set<CellCoord> componentFloorCells = intersectCells(remainingRoomDeleteFloorCells, component);
                    if (componentFloorCells.isEmpty()) {
                        fragmentFloorCellsByLevel.remove(deleteLevel);
                    } else {
                        fragmentFloorCellsByLevel.put(deleteLevel, componentFloorCells);
                    }
                    RoomRewriteCandidate candidate = index == 0
                            ? RoomRewriteCandidate.keep(room.roomId(), room.name(), fragmentCellsByLevel, fragmentFloorCellsByLevel, roomAnchorsByLevel(room))
                            : RoomRewriteCandidate.create(null, fragmentCellsByLevel, fragmentFloorCellsByLevel, roomAnchorsByLevel(room));
                    candidates.add(candidate);
                }
            }

            Set<CellCoord> rewrittenClusterCells = flattenCells(remainingCellsByLevel);
            RoomSurfaceIndex rewrittenRooms = reconciledRooms(cluster, candidates, previousBoundaryKinds);
            List<RoomCluster> componentClusters = deleteClusters(
                    cluster,
                    rewrittenClusterCells,
                    rewrittenRooms);
            if (componentClusters.isEmpty()) {
                return List.of();
            }
            ArrayList<RoomCluster> finalClusters = new ArrayList<>(componentClusters.size());
            finalClusters.add(componentClusters.getFirst().withClusterId(cluster.clusterId()));
            finalClusters.addAll(componentClusters.stream().skip(1).toList());
            return List.copyOf(finalClusters);
        }

        static RoomCluster editBoundary(RoomCluster cluster, Collection<GridSegment2x> segments2x, InternalBoundaryType type, boolean deleteBoundary) {
            if (cluster == null || segments2x == null || segments2x.isEmpty()) {
                return null;
            }
            Map<GridSegment2x, InternalBoundaryType> updatedBoundaryKinds = new LinkedHashMap<>(cluster.internalBoundaryKinds());
            InternalBoundaryType resolvedType = type == null ? InternalBoundaryType.WALL : type;
            boolean changed = false;
            for (GridSegment2x segment2x : segments2x) {
                if (segment2x == null || !isInternalSegment(cluster.cells(), segment2x)) {
                    continue;
                }
                List<CellCoord> touchingCells = segment2x.touchingCells().stream()
                        .sorted(CellCoord.ORDER)
                        .toList();
                if (touchingCells.size() != 2) {
                    continue;
                }
                Room leftRoom = cluster.roomAt(touchingCells.getFirst());
                Room rightRoom = cluster.roomAt(touchingCells.getLast());
                if (leftRoom == null || rightRoom == null) {
                    continue;
                }
                InternalBoundaryType currentType = updatedBoundaryKinds.get(segment2x);
                if (deleteBoundary) {
                    if (currentType == null || sameRoomId(leftRoom, rightRoom)) {
                        continue;
                    }
                    updatedBoundaryKinds.remove(segment2x);
                    changed = true;
                    continue;
                }
                if (resolvedType == InternalBoundaryType.WALL && currentType == InternalBoundaryType.DOOR) {
                    continue;
                }
                if (resolvedType == currentType) {
                    continue;
                }
                updatedBoundaryKinds.put(segment2x, resolvedType);
                changed = true;
            }

            if (!changed) {
                return null;
            }

            RoomSurfaceIndex rewrittenRooms = rewriteRoomsForBoundaryKinds(cluster, updatedBoundaryKinds);
            return new RoomCluster(
                    cluster.clusterId(),
                    cluster.mapId(),
                    cluster.center(),
                    structureForRooms(rewrittenRooms.rooms(), rewrittenRooms.structuresByRoom()),
                    rewrittenRooms.rooms());
        }

        static RoomCluster moveDoor(
                RoomCluster cluster,
                GridSegment2x sourceBoundarySegment2x,
                GridSegment2x targetBoundarySegment2x
        ) {
            if (cluster == null
                    || sourceBoundarySegment2x == null
                    || targetBoundarySegment2x == null
                    || Objects.equals(sourceBoundarySegment2x, targetBoundarySegment2x)
                    || !cluster.canDeleteDoor(sourceBoundarySegment2x)
                    || !cluster.canCreateDoor(targetBoundarySegment2x)) {
                return null;
            }
            RoomCluster withoutSourceDoor = editBoundary(
                    cluster,
                    List.of(sourceBoundarySegment2x),
                    InternalBoundaryType.DOOR,
                    true);
            if (withoutSourceDoor == null || !withoutSourceDoor.canCreateDoor(targetBoundarySegment2x)) {
                return null;
            }
            return editBoundary(
                    withoutSourceDoor,
                    List.of(targetBoundarySegment2x),
                    InternalBoundaryType.DOOR,
                    false);
        }

        static Map<GridSegment2x, InternalBoundaryType> internalBoundaryKinds(RoomCluster cluster) {
            if (cluster == null) {
                return Map.of();
            }
            return computeInternalBoundaries(cluster, cluster.cells(), cluster.rooms(), boundaryKinds(cluster.localConnections()));
        }

        private static RoomSurfaceIndex reconciledRooms(
                RoomCluster cluster,
                List<RoomRewriteCandidate> candidates,
                Map<GridSegment2x, InternalBoundaryType> previousKinds
        ) {
            if (cluster == null || cluster.cells().isEmpty()) {
                return RoomSurfaceIndex.empty();
            }
            Map<GridSegment2x, InternalBoundaryType> boundaryKinds = previousKinds == null ? Map.of() : Map.copyOf(previousKinds);
            List<Room> result = new ArrayList<>();
            Map<Room, StructureObject> structuresByRoom = new LinkedHashMap<>();
            for (RoomRewriteCandidate candidate : candidates == null ? List.<RoomRewriteCandidate>of() : candidates) {
                if (candidate == null || candidate.cellsByLevel() == null || candidate.cellsByLevel().isEmpty()) {
                    continue;
                }
                Room room = cluster.findRoom(candidate.roomId());
                RoomNarration narration = room == null ? RoomNarration.empty() : room.narration();
                RoomSurfaceProjection projection = resolvedRoom(
                        cluster,
                        candidate.cellsByLevel(),
                        candidate.floorCellsByLevel(),
                        boundaryKinds,
                        candidate.preferredAnchorsByLevel(),
                        candidate.roomId(),
                        candidate.name(),
                        narration);
                result.add(projection.room());
                structuresByRoom.put(projection.room(), projection.structure());
            }
            return result.isEmpty() ? RoomSurfaceIndex.empty() : new RoomSurfaceIndex(result, structuresByRoom);
        }

        private static RoomSurfaceIndex rewriteRoomsForBoundaryKinds(
                RoomCluster cluster,
                Map<GridSegment2x, InternalBoundaryType> boundaryKinds
        ) {
            if (cluster == null || cluster.cells().isEmpty() || cluster.rooms().isEmpty()) {
                return RoomSurfaceIndex.empty();
            }
            Map<Integer, Set<CellCoord>> remainingCellsByLevel = mutableClusterCellsByLevel(cluster);
            Set<GridSegment2x> barriers = barriersForBoundaryKinds(boundaryKinds);
            List<Room> rewrittenRooms = new ArrayList<>();
            Map<Room, StructureObject> structuresByRoom = new LinkedHashMap<>();
            Set<Long> retainedRoomIds = new LinkedHashSet<>();
            for (Room room : cluster.rooms()) {
                if (room == null || room.roomId() == null) {
                    continue;
                }
                Map<Integer, Set<CellCoord>> roomCellsByLevel = rewrittenRoomCellsByLevel(room, remainingCellsByLevel, barriers);
                if (roomCellsByLevel.isEmpty()) {
                    continue;
                }
                List<Room> sourceRooms = roomsForCells(cluster, flattenCells(roomCellsByLevel));
                Room retainedRoom = retainedRoom(sourceRooms, retainedRoomIds);
                RoomSurfaceProjection projection = resolveRoomForCells(
                        cluster,
                        retainedRoom,
                        roomCellsByLevel,
                        boundaryKinds,
                        sourceRooms);
                rewrittenRooms.add(projection.room());
                structuresByRoom.put(projection.room(), projection.structure());
            }
            for (LevelSeed seed = firstRemainingSeed(remainingCellsByLevel);
                    seed != null;
                    seed = firstRemainingSeed(remainingCellsByLevel)) {
                CellCoord anchor = seed.cell();
                Set<CellCoord> levelCells = remainingCellsByLevel.getOrDefault(seed.level(), Set.of());
                Set<CellCoord> roomCells = reachableCells(anchor, levelCells, barriers);
                if (roomCells.isEmpty()) {
                    remainingCellsByLevel.computeIfPresent(seed.level(), (ignored, cells) -> {
                        cells.remove(anchor);
                        return cells;
                    });
                    continue;
                }
                levelCells.removeAll(roomCells);
                if (levelCells.isEmpty()) {
                    remainingCellsByLevel.remove(seed.level());
                }
                List<Room> sourceRooms = roomsForCells(cluster, roomCells);
                Room retainedRoom = retainedRoom(sourceRooms, retainedRoomIds);
                RoomSurfaceProjection projection = resolveRoomForCells(
                        cluster,
                        retainedRoom,
                        Map.of(seed.level(), Set.copyOf(roomCells)),
                        boundaryKinds,
                        sourceRooms);
                rewrittenRooms.add(projection.room());
                structuresByRoom.put(projection.room(), projection.structure());
            }
            return rewrittenRooms.isEmpty() ? RoomSurfaceIndex.empty() : new RoomSurfaceIndex(rewrittenRooms, structuresByRoom);
        }

        private static RoomSurfaceProjection resolvedRoom(
                RoomCluster cluster,
                Map<Integer, Set<CellCoord>> roomCellsByLevel,
                Map<Integer, Set<CellCoord>> roomFloorCellsByLevel,
                Map<GridSegment2x, InternalBoundaryType> boundaryKinds,
                Map<Integer, CellCoord> preferredAnchorsByLevel,
                Long roomId,
                String roomName,
                RoomNarration narration
        ) {
            StructureDescriptor descriptor = descriptorForRoom(
                    roomCellsByLevel,
                    roomFloorCellsByLevel,
                    boundaryKinds,
                    preferredAnchorsByLevel);
            StructureObject roomStructure = validatedStructureForRoom(roomCellsByLevel, roomFloorCellsByLevel, descriptor);
            Room room = Room.metadata(
                    roomId,
                    cluster.mapId(),
                    cluster.clusterId() == null ? 0L : cluster.clusterId(),
                    roomName,
                    anchorsByLevel(roomStructure),
                    narration);
            return new RoomSurfaceProjection(room, roomStructure);
        }

        private static List<RoomCluster> deleteClusters(
                RoomCluster cluster,
                Set<CellCoord> rewrittenClusterCells,
                RoomSurfaceIndex rewrittenRooms
        ) {
            if (cluster == null || rewrittenClusterCells == null || rewrittenClusterCells.isEmpty()) {
                return List.of();
            }
            return connectedComponents(rewrittenClusterCells).stream()
                    .sorted(Comparator
                            .comparing((Set<CellCoord> component) -> !component.contains(cluster.center()))
                    .thenComparingInt(component -> CellCoord.bestCenter(component).manhattanDistance(cluster.center()))
                    .thenComparing(CellCoord::bestCenter, CellCoord.ORDER))
                    .map(componentCells -> {
                        List<Room> componentRooms = roomsForDeleteComponent(cluster, componentCells, rewrittenRooms.rooms());
                        return new RoomCluster(
                                null,
                                cluster.mapId(),
                                CellCoord.bestCenter(componentCells),
                                structureForRooms(componentRooms, rewrittenRooms.structuresByRoom()),
                                componentRooms);
                    })
                    .toList();
        }

        private static List<Room> roomsForDeleteComponent(
                RoomCluster cluster,
                Set<CellCoord> componentCells,
                List<Room> rewrittenRooms
        ) {
            if (componentCells == null || componentCells.isEmpty()) {
                return List.of();
            }
            return rewrittenRooms.stream()
                    .filter(room -> room != null && !disjoint(cluster.structureFor(room).cellCoords(), componentCells))
                    .sorted(Comparator.comparing(Room::roomId, Comparator.nullsLast(Long::compareTo))
                            .thenComparing(room -> cluster.structureFor(room)
                                    .surfaceCenterCellCoordAtLevel(cluster.structureFor(room).primaryLevel()), CellCoord.ORDER))
                    .toList();
        }

        private static List<RoomCluster> normalizedClusters(List<RoomCluster> clusters) {
            if (clusters == null || clusters.isEmpty()) {
                return List.of();
            }
            Map<Long, RoomCluster> result = new LinkedHashMap<>();
            for (RoomCluster cluster : clusters) {
                if (cluster != null && cluster.clusterId() != null) {
                    result.put(cluster.clusterId(), cluster);
                }
            }
            return List.copyOf(result.values());
        }

        private static boolean isInternalSegment(Set<CellCoord> clusterCells, GridSegment2x segment2x) {
            Set<CellCoord> touchingCells = segment2x == null ? Set.of() : segment2x.touchingCells();
            return touchingCells.size() == 2 && clusterCells.containsAll(touchingCells);
        }

        private static Map<GridSegment2x, InternalBoundaryType> computeInternalBoundaries(
                RoomCluster cluster,
                Set<CellCoord> clusterCells,
                List<Room> rooms,
                Map<GridSegment2x, InternalBoundaryType> boundaryKinds
        ) {
            if (clusterCells == null || clusterCells.isEmpty()) {
                return Map.of();
            }
            Map<GridSegment2x, InternalBoundaryType> result = new LinkedHashMap<>();
            for (Room room : rooms == null ? List.<Room>of() : rooms) {
                if (room == null) {
                    continue;
                }
                for (GridSegment2x segment2x : roomWallSegments(cluster, room)) {
                    if (isInternalSegment(clusterCells, segment2x)) {
                        result.putIfAbsent(segment2x, InternalBoundaryType.WALL);
                    }
                }
            }
            for (Map.Entry<GridSegment2x, InternalBoundaryType> entry : (boundaryKinds == null ? Map.<GridSegment2x, InternalBoundaryType>of() : boundaryKinds).entrySet()) {
                if (isInternalSegment(clusterCells, entry.getKey()) && entry.getValue() == InternalBoundaryType.DOOR) {
                    result.put(entry.getKey(), InternalBoundaryType.DOOR);
                }
            }
            return Map.copyOf(result);
        }

        private static boolean sameRoomId(Room left, Room right) {
            return left != null
                    && right != null
                    && left.roomId() != null
                    && left.roomId().equals(right.roomId());
        }

        private static boolean disjoint(Set<CellCoord> left, Set<CellCoord> right) {
            for (CellCoord point : left) {
                if (right.contains(point)) {
                    return false;
                }
            }
            return true;
        }

        private static String normalizedRoomName(Long roomId, String name) {
            return name == null || name.isBlank()
                    ? "Raum " + (roomId == null ? "neu" : roomId)
                    : name.trim();
        }

        private static Map<GridSegment2x, InternalBoundaryType> boundaryKinds(List<DungeonConnection> localConnections) {
            Map<GridSegment2x, InternalBoundaryType> result = new LinkedHashMap<>();
            for (DungeonConnection connection : localConnections == null ? List.<DungeonConnection>of() : localConnections) {
                if (connection == null || connection.door() == null) {
                    continue;
                }
                for (GridSegment2x segment2x : connection.door().segments2x()) {
                    result.put(segment2x, InternalBoundaryType.DOOR);
                }
            }
            return Map.copyOf(result);
        }

        private static boolean overlapsAtLevel(RoomCluster cluster, Room room, Set<CellCoord> paintCells, int levelZ) {
            if (room == null || paintCells == null || paintCells.isEmpty()) {
                return false;
            }
            return !disjoint(cluster.roomCellsAtLevel(room, levelZ), paintCells);
        }

        private static void mergeRoomCells(RoomCluster cluster, Map<Integer, Set<CellCoord>> result, Room room) {
            if (result == null || room == null) {
                return;
            }
            for (Map.Entry<Integer, Set<CellCoord>> entry : roomCellsByLevel(cluster, room).entrySet()) {
                if (entry == null || entry.getKey() == null || entry.getValue() == null || entry.getValue().isEmpty()) {
                    continue;
                }
                result.computeIfAbsent(entry.getKey(), ignored -> new LinkedHashSet<>()).addAll(entry.getValue());
            }
        }

        private static void mergeRoomFloorCells(RoomCluster cluster, Map<Integer, Set<CellCoord>> result, Room room) {
            if (result == null || room == null) {
                return;
            }
            for (Map.Entry<Integer, Set<CellCoord>> entry : roomFloorCellsByLevel(cluster, room).entrySet()) {
                if (entry == null || entry.getKey() == null || entry.getValue() == null) {
                    continue;
                }
                result.computeIfAbsent(entry.getKey(), ignored -> new LinkedHashSet<>()).addAll(entry.getValue());
            }
        }

        private static Map<Integer, Set<CellCoord>> mutableClusterCellsByLevel(RoomCluster cluster) {
            return mutableCellsByLevel(cluster == null ? Map.of() : cluster.cellsByLevel());
        }

        private static Map<Integer, Set<CellCoord>> rewrittenRoomCellsByLevel(
                Room room,
                Map<Integer, Set<CellCoord>> remainingCellsByLevel,
                Set<GridSegment2x> barriers
        ) {
            Map<Integer, Set<CellCoord>> result = new LinkedHashMap<>();
            if (room == null || remainingCellsByLevel == null || remainingCellsByLevel.isEmpty()) {
                return Map.of();
            }
            for (Map.Entry<Integer, CellCoord> entry : roomAnchorsByLevel(room).entrySet().stream()
                    .sorted(Map.Entry.comparingByKey())
                    .toList()) {
                Integer level = entry.getKey();
                CellCoord anchor = entry.getValue();
                if (level == null || anchor == null) {
                    continue;
                }
                Set<CellCoord> remainingCells = remainingCellsByLevel.get(level);
                if (remainingCells == null || !remainingCells.contains(anchor)) {
                    continue;
                }
                Set<CellCoord> roomCells = reachableCells(anchor, remainingCells, barriers);
                if (roomCells.isEmpty()) {
                    continue;
                }
                remainingCells.removeAll(roomCells);
                if (remainingCells.isEmpty()) {
                    remainingCellsByLevel.remove(level);
                }
                result.put(level, Set.copyOf(roomCells));
            }
            return result.isEmpty() ? Map.of() : Map.copyOf(result);
        }

        private static LevelSeed firstRemainingSeed(Map<Integer, Set<CellCoord>> remainingCellsByLevel) {
            if (remainingCellsByLevel == null || remainingCellsByLevel.isEmpty()) {
                return null;
            }
            return remainingCellsByLevel.entrySet().stream()
                    .filter(entry -> entry.getValue() != null && !entry.getValue().isEmpty())
                    .sorted(Map.Entry.comparingByKey())
                    .map(entry -> new LevelSeed(
                            entry.getKey(),
                            entry.getValue().stream().min(CellCoord.ORDER).orElse(null)))
                    .filter(seed -> seed.cell() != null)
                    .findFirst()
                    .orElse(null);
        }

        private static Set<CellCoord> flattenCells(Map<Integer, Set<CellCoord>> cellsByLevel) {
            LinkedHashSet<CellCoord> result = new LinkedHashSet<>();
            for (Set<CellCoord> cells : cellsByLevel.values()) {
                result.addAll(cells);
            }
            return result.isEmpty() ? Set.of() : Set.copyOf(result);
        }

        private static StructureDescriptor descriptorForRoom(
                Map<Integer, Set<CellCoord>> roomCellsByLevel,
                Map<Integer, Set<CellCoord>> roomFloorCellsByLevel,
                Map<GridSegment2x, InternalBoundaryType> boundaryKinds,
                Map<Integer, CellCoord> preferredAnchorsByLevel
        ) {
            StructureDescriptor baseDescriptor = StructureDescriptor.fromCellCoordsByLevel(roomCellsByLevel, roomFloorCellsByLevel);
            Map<Integer, StructureDescriptor.LevelDescriptor> levels = new LinkedHashMap<>();
            for (Map.Entry<Integer, Set<CellCoord>> entry : (roomCellsByLevel == null ? Map.<Integer, Set<CellCoord>>of() : roomCellsByLevel).entrySet().stream()
                    .sorted(Map.Entry.comparingByKey())
                    .toList()) {
                Integer levelZ = entry.getKey();
                Set<CellCoord> roomCells = normalizeCells(entry.getValue());
                if (levelZ == null || roomCells.isEmpty()) {
                    continue;
                }
                StructureDescriptor.LevelDescriptor baseLevel = baseDescriptor.level(levelZ);
                if (baseLevel == null || baseLevel.boundaryEdges().isEmpty()) {
                    continue;
                }
                CellCoord preferredAnchor = preferredAnchorsByLevel == null ? null : preferredAnchorsByLevel.get(levelZ);
                // Room rewrites must stay on the same canonical cell -> descriptor path as ordinary room creation.
                // Only opening segments are layered on afterward so rewrites cannot persist a floor shape that
                // hydrates differently from the authored room cells.
                levels.put(levelZ, new StructureDescriptor.LevelDescriptor(
                        anchorCell(roomCells, preferredAnchor),
                        baseLevel.fillSeeds(),
                        baseLevel.boundaryEdges(),
                        openingEdgesForRoom(baseLevel.boundaryEdges(), boundaryKinds),
                        baseLevel.floorCells()));
            }
            return new StructureDescriptor(levels);
        }

        private static StructureObject validatedStructureForRoom(
                Map<Integer, Set<CellCoord>> intendedRoomCellsByLevel,
                Map<Integer, Set<CellCoord>> intendedRoomFloorCellsByLevel,
                StructureDescriptor descriptor
        ) {
            StructureObject structure = StructureObject.fromDescriptor(descriptor);
            Map<Integer, Set<CellCoord>> expected = immutableCellsByLevel(intendedRoomCellsByLevel);
            Map<Integer, Set<CellCoord>> hydrated = structureCellsByLevel(structure);
            if (!hydrated.equals(expected)) {
                throw new IllegalStateException("Room rewrite descriptor changed the authored room cells");
            }
            Map<Integer, Set<CellCoord>> expectedFloor = immutableCellsByLevel(intendedRoomFloorCellsByLevel);
            Map<Integer, Set<CellCoord>> hydratedFloor = structureFloorCellsByLevel(structure);
            if (!hydratedFloor.equals(expectedFloor)) {
                throw new IllegalStateException("Room rewrite descriptor changed the authored floor cells");
            }
            return structure;
        }

        private static Map<Integer, CellCoord> preferredAnchors(List<Room> sourceRooms) {
            if (sourceRooms == null || sourceRooms.isEmpty()) {
                return Map.of();
            }
            for (Room room : sourceRooms) {
                if (room != null && !roomAnchorsByLevel(room).isEmpty()) {
                    return roomAnchorsByLevel(room);
                }
            }
            return Map.of();
        }

        private static Map<Integer, Set<CellCoord>> roomCellsByLevel(RoomCluster cluster, Room room) {
            if (room == null) {
                return Map.of();
            }
            Map<Integer, Set<CellCoord>> result = new LinkedHashMap<>();
            for (Integer levelZ : cluster.roomLevels(room).stream().sorted().toList()) {
                Set<CellCoord> cellsAtLevel = cluster.roomCellsAtLevel(room, levelZ);
                if (!cellsAtLevel.isEmpty()) {
                    result.put(levelZ, Set.copyOf(cellsAtLevel));
                }
            }
            return result.isEmpty() ? Map.of() : Map.copyOf(result);
        }

        private static Map<Integer, Set<CellCoord>> roomFloorCellsByLevel(RoomCluster cluster, Room room) {
            if (room == null) {
                return Map.of();
            }
            Map<Integer, Set<CellCoord>> result = new LinkedHashMap<>();
            for (Integer levelZ : cluster.roomLevels(room).stream().sorted().toList()) {
                Set<CellCoord> cellsAtLevel = cluster.roomFloorCellsAtLevel(room, levelZ);
                result.put(levelZ, Set.copyOf(cellsAtLevel));
            }
            return Map.copyOf(result);
        }

        private static Map<Integer, CellCoord> roomAnchorsByLevel(Room room) {
            return room == null ? Map.of() : room.anchorsByLevel();
        }

        private static Set<GridSegment2x> roomWallSegments(RoomCluster cluster, Room room) {
            if (room == null) {
                return Set.of();
            }
            Set<GridSegment2x> result = new LinkedHashSet<>();
            for (Integer levelZ : cluster.roomLevels(room)) {
                StructureObject roomStructure = cluster.structureFor(room);
                for (Wall wall : roomStructure.wallsAtLevel(levelZ)) {
                    result.addAll(wall.segments2x());
                }
            }
            return result.isEmpty() ? Set.of() : Set.copyOf(result);
        }

        private static List<Set<CellCoord>> connectedComponents(Collection<CellCoord> cells) {
            Set<CellCoord> remaining = normalizeCells(cells);
            if (remaining.isEmpty()) {
                return List.of();
            }
            List<Set<CellCoord>> components = new ArrayList<>();
            LinkedHashSet<CellCoord> unvisited = new LinkedHashSet<>(remaining);
            while (!unvisited.isEmpty()) {
                CellCoord seed = unvisited.iterator().next();
                ArrayDeque<CellCoord> queue = new ArrayDeque<>();
                LinkedHashSet<CellCoord> component = new LinkedHashSet<>();
                queue.add(seed);
                unvisited.remove(seed);
                while (!queue.isEmpty()) {
                    CellCoord current = queue.removeFirst();
                    if (!component.add(current)) {
                        continue;
                    }
                    for (CellCoord step : CellCoord.CARDINAL_STEPS) {
                        CellCoord neighbor = current.add(step);
                        if (unvisited.remove(neighbor)) {
                            queue.addLast(neighbor);
                        }
                    }
                }
                components.add(Set.copyOf(component));
            }
            return List.copyOf(components);
        }

        private static Map<Integer, Set<CellCoord>> mutableCellsByLevel(Map<Integer, Set<CellCoord>> source) {
            Map<Integer, Set<CellCoord>> result = new LinkedHashMap<>();
            for (Map.Entry<Integer, Set<CellCoord>> entry : source.entrySet()) {
                result.put(entry.getKey(), new LinkedHashSet<>(entry.getValue()));
            }
            return result;
        }

        private static Map<Integer, Set<CellCoord>> mutableCellsByLevelWithoutLevel(Map<Integer, Set<CellCoord>> source, int excludedLevel) {
            Map<Integer, Set<CellCoord>> result = new LinkedHashMap<>();
            for (Map.Entry<Integer, Set<CellCoord>> entry : source.entrySet()) {
                if (entry.getKey() != excludedLevel) {
                    result.put(entry.getKey(), new LinkedHashSet<>(entry.getValue()));
                }
            }
            return result;
        }

        private static Map<Integer, Set<CellCoord>> immutableCellsByLevel(Map<Integer, Set<CellCoord>> source) {
            if (source == null || source.isEmpty()) {
                return Map.of();
            }
            Map<Integer, Set<CellCoord>> result = new LinkedHashMap<>();
            source.entrySet().stream()
                    .filter(entry -> entry != null && entry.getKey() != null)
                    .sorted(Map.Entry.comparingByKey())
                    .forEach(entry -> {
                        Set<CellCoord> cells = normalizeCells(entry.getValue());
                        if (!cells.isEmpty()) {
                            result.put(entry.getKey(), cells);
                        }
                    });
            return result.isEmpty() ? Map.of() : Map.copyOf(result);
        }

        private static Map<Integer, CellCoord> immutableAnchors(Map<Integer, CellCoord> source) {
            if (source == null || source.isEmpty()) {
                return Map.of();
            }
            Map<Integer, CellCoord> result = new LinkedHashMap<>();
            source.entrySet().stream()
                    .filter(entry -> entry != null && entry.getKey() != null && entry.getValue() != null)
                    .sorted(Map.Entry.comparingByKey())
                    .forEach(entry -> result.put(entry.getKey(), entry.getValue()));
            return result.isEmpty() ? Map.of() : Map.copyOf(result);
        }

        private static Set<CellCoord> normalizeCells(Collection<CellCoord> input) {
            return CellCoord.normalize(input);
        }

        private static CellCoord anchorCell(Set<CellCoord> roomCells, CellCoord preferredAnchor) {
            return preferredAnchor != null && roomCells.contains(preferredAnchor)
                    ? preferredAnchor
                    : CellCoord.bestCenter(roomCells);
        }

        private static Map<Integer, Set<CellCoord>> structureCellsByLevel(StructureObject structure) {
            if (structure == null || structure.levels().isEmpty()) {
                return Map.of();
            }
            Map<Integer, Set<CellCoord>> result = new LinkedHashMap<>();
            for (Integer levelZ : structure.levels().stream().sorted().toList()) {
                Set<CellCoord> cells = normalizeCells(structure.cellCoordsAtLevel(levelZ));
                if (!cells.isEmpty()) {
                    result.put(levelZ, cells);
                }
            }
            return result.isEmpty() ? Map.of() : Map.copyOf(result);
        }

        private static Map<Integer, Set<CellCoord>> structureFloorCellsByLevel(StructureObject structure) {
            if (structure == null || structure.levels().isEmpty()) {
                return Map.of();
            }
            Map<Integer, Set<CellCoord>> result = new LinkedHashMap<>();
            for (Integer levelZ : structure.levels().stream().sorted().toList()) {
                Set<CellCoord> cells = normalizeCells(structure.floorCellCoordsAtLevel(levelZ));
                result.put(levelZ, cells);
            }
            return Map.copyOf(result);
        }

        private static Set<CellCoord> intersectCells(Set<CellCoord> left, Set<CellCoord> right) {
            if (left == null || left.isEmpty() || right == null || right.isEmpty()) {
                return Set.of();
            }
            LinkedHashSet<CellCoord> result = new LinkedHashSet<>();
            for (CellCoord cell : left) {
                if (right.contains(cell)) {
                    result.add(cell);
                }
            }
            return result.isEmpty() ? Set.of() : Set.copyOf(result);
        }

        private static boolean contains(Set<CellCoord> cells, CellCoord cell) {
            return cell != null && cells != null && cells.contains(cell);
        }

        private static Set<GridSegment2x> barriersForBoundaryKinds(Map<GridSegment2x, InternalBoundaryType> boundaryKinds) {
            if (boundaryKinds == null || boundaryKinds.isEmpty()) {
                return Set.of();
            }
            return boundaryKinds.keySet().stream()
                    .filter(Objects::nonNull)
                    .sorted(GridSegment2x.ORDER)
                    .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));
        }

        private static Set<CellCoord> reachableCells(CellCoord startAnchor, Set<CellCoord> traversableCells, Set<GridSegment2x> barriers) {
            if (startAnchor == null || traversableCells == null || traversableCells.isEmpty() || !traversableCells.contains(startAnchor)) {
                return Set.of();
            }
            Set<CellCoord> visited = new LinkedHashSet<>();
            Set<CellCoord> frontier = new LinkedHashSet<>(traversableCells);
            ArrayDeque<CellCoord> queue = new ArrayDeque<>();
            queue.add(startAnchor);
            frontier.remove(startAnchor);
            while (!queue.isEmpty()) {
                CellCoord current = queue.removeFirst();
                visited.add(current);
                for (CellCoord step : CellCoord.CARDINAL_STEPS) {
                    CellCoord neighbor = current.add(step);
                    if (!frontier.contains(neighbor) || isBlocked(barriers, current, step)) {
                        continue;
                    }
                    frontier.remove(neighbor);
                    queue.addLast(neighbor);
                }
            }
            return Set.copyOf(visited);
        }

        private static List<Room> roomsForCells(RoomCluster cluster, Set<CellCoord> roomCells) {
            if (cluster == null) {
                return List.of();
            }
            return cluster.rooms().stream()
                    .filter(room -> room != null && room.roomId() != null && !disjoint(cluster.structureFor(room).cellCoords(), roomCells))
                    .sorted(Comparator.comparing(Room::roomId, Comparator.nullsLast(Long::compareTo)))
                    .toList();
        }

        private static Room retainedRoom(List<Room> sourceRooms, Set<Long> retainedRoomIds) {
            if (sourceRooms == null || sourceRooms.isEmpty()) {
                return null;
            }
            for (Room sourceRoom : sourceRooms) {
                if (sourceRoom == null || sourceRoom.roomId() == null) {
                    continue;
                }
                if (retainedRoomIds == null || retainedRoomIds.add(sourceRoom.roomId())) {
                    return sourceRoom;
                }
            }
            return null;
        }

        private static RoomSurfaceProjection resolveRoomForCells(
                RoomCluster cluster,
                Room retainedRoom,
                Map<Integer, Set<CellCoord>> roomCellsByLevel,
                Map<GridSegment2x, InternalBoundaryType> boundaryKinds,
                List<Room> sourceRooms
        ) {
            Long roomId = retainedRoom == null ? null : retainedRoom.roomId();
            String roomName = retainedRoom == null ? derivedSplitRoomName(sourceRooms) : retainedRoom.name();
            RoomNarration narration = retainedRoom == null
                    ? (sourceRooms == null || sourceRooms.isEmpty() ? RoomNarration.empty() : sourceRooms.getFirst().narration())
                    : retainedRoom.narration();
            Map<Integer, CellCoord> preferredAnchorsByLevel = retainedRoom == null
                    ? preferredAnchors(sourceRooms)
                    : roomAnchorsByLevel(retainedRoom);
            return resolvedRoom(
                    cluster,
                    roomCellsByLevel,
                    restrictedFloorCellsByLevel(cluster, roomCellsByLevel, sourceRooms),
                    boundaryKinds,
                    preferredAnchorsByLevel,
                    roomId,
                    roomName,
                    narration);
        }

        private static String derivedSplitRoomName(List<Room> sourceRooms) {
            if (sourceRooms != null && !sourceRooms.isEmpty()) {
                Room sourceRoom = sourceRooms.getFirst();
                if (sourceRoom != null && sourceRoom.name() != null && !sourceRoom.name().isBlank()) {
                    return sourceRoom.name().trim() + " Teil";
                }
            }
            return normalizedRoomName(null, null);
        }

        private static Map<Integer, Set<CellCoord>> restrictedFloorCellsByLevel(
                RoomCluster cluster,
                Map<Integer, Set<CellCoord>> roomCellsByLevel,
                List<Room> sourceRooms
        ) {
            if (roomCellsByLevel == null || roomCellsByLevel.isEmpty()) {
                return Map.of();
            }
            Map<Integer, Set<CellCoord>> sourceFloorCells = new LinkedHashMap<>();
            for (Room sourceRoom : sourceRooms == null ? List.<Room>of() : sourceRooms) {
                mergeRoomFloorCells(cluster, sourceFloorCells, sourceRoom);
            }
            Map<Integer, Set<CellCoord>> result = new LinkedHashMap<>();
            for (Map.Entry<Integer, Set<CellCoord>> entry : roomCellsByLevel.entrySet()) {
                if (entry == null || entry.getKey() == null || entry.getValue() == null || entry.getValue().isEmpty()) {
                    continue;
                }
                Set<CellCoord> floorCells = intersectCells(sourceFloorCells.get(entry.getKey()), entry.getValue());
                result.put(entry.getKey(), floorCells);
            }
            return Map.copyOf(result);
        }

        private static Set<GridSegment2x> openingEdgesForRoom(
                Set<GridSegment2x> boundaryEdges,
                Map<GridSegment2x, InternalBoundaryType> boundaryKinds
        ) {
            if (boundaryEdges == null || boundaryEdges.isEmpty() || boundaryKinds == null || boundaryKinds.isEmpty()) {
                return Set.of();
            }
            return boundaryEdges.stream()
                    .filter(segment2x -> boundaryKinds.get(segment2x) == InternalBoundaryType.DOOR)
                    .sorted(GridSegment2x.ORDER)
                    .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));
        }

        private static boolean isBlocked(Set<GridSegment2x> barriers, CellCoord cell, CellCoord step) {
            return barriers != null && barriers.contains(GridSegment2x.boundaryEdge(cell, cell.directionTo4(cell.add(step))));
        }

        private record RoomRewriteCandidate(
                Long roomId,
                String name,
                Map<Integer, Set<CellCoord>> cellsByLevel,
                Map<Integer, Set<CellCoord>> floorCellsByLevel,
                Map<Integer, CellCoord> preferredAnchorsByLevel
        ) {
            private static RoomRewriteCandidate keep(
                    Long roomId,
                    String name,
                    Map<Integer, Set<CellCoord>> cellsByLevel,
                    Map<Integer, Set<CellCoord>> floorCellsByLevel,
                    Map<Integer, CellCoord> preferredAnchorsByLevel
            ) {
                return new RoomRewriteCandidate(
                        roomId,
                        name,
                        immutableCellsByLevel(cellsByLevel),
                        immutableFloorCellsByLevel(floorCellsByLevel),
                        immutableAnchors(preferredAnchorsByLevel));
            }

            private static RoomRewriteCandidate create(
                    String name,
                    Map<Integer, Set<CellCoord>> cellsByLevel,
                    Map<Integer, Set<CellCoord>> floorCellsByLevel,
                    Map<Integer, CellCoord> preferredAnchorsByLevel
            ) {
                return new RoomRewriteCandidate(
                        null,
                        name,
                        immutableCellsByLevel(cellsByLevel),
                        immutableFloorCellsByLevel(floorCellsByLevel),
                        immutableAnchors(preferredAnchorsByLevel));
            }
        }

        private static Map<Integer, Set<CellCoord>> immutableFloorCellsByLevel(Map<Integer, Set<CellCoord>> source) {
            if (source == null || source.isEmpty()) {
                return Map.of();
            }
            Map<Integer, Set<CellCoord>> result = new LinkedHashMap<>();
            source.entrySet().stream()
                    .filter(entry -> entry != null && entry.getKey() != null && entry.getValue() != null)
                    .sorted(Map.Entry.comparingByKey())
                    .forEach(entry -> result.put(entry.getKey(), normalizeCells(entry.getValue())));
            return result.isEmpty() ? Map.of() : Map.copyOf(result);
        }

        private record LevelSeed(int level, CellCoord cell) {
        }
    }

    public static List<DungeonConnection> deriveLocalConnections(
            long mapId,
            Long clusterId,
            List<Room> rooms,
            Map<Room, StructureObject> roomStructuresByRoom
    ) {
        if (rooms == null || rooms.isEmpty()) {
            return List.of();
        }
        long resolvedClusterId = clusterId == null ? 0L : clusterId;
        Map<CubePoint, Room> roomsByPoint = indexRoomsByPoint(rooms, roomStructuresByRoom);
        Map<String, DoorComponent> doorsByKey = new LinkedHashMap<>();
        for (Room room : rooms) {
            if (room == null) {
                continue;
            }
            StructureObject roomStructure = structureFor(room, roomStructuresByRoom);
            for (Integer levelZ : roomStructure.levels()) {
                for (Door door : roomStructure.doorsAtLevel(levelZ)) {
                    if (door != null) {
                        doorsByKey.putIfAbsent(doorKey(levelZ, door), new DoorComponent(levelZ, door));
                    }
                }
            }
        }
        List<DungeonConnection> result = new ArrayList<>();
        for (DoorComponent doorComponent : doorsByKey.values()) {
            DungeonConnection connection = localConnectionForDoor(doorComponent, mapId, resolvedClusterId, roomsByPoint);
            if (connection != null) {
                result.add(connection);
            }
        }
        return List.copyOf(result);
    }

    private static DungeonConnection localConnectionForDoor(
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
        List<ConnectionEndpoint> endpoints = endpointsForDoor(touchingRooms);
        if (endpoints.size() != 2) {
            return null;
        }
        return new DungeonConnection(
                ConnectionKind.LOCAL,
                clusterId,
                mapId,
                doorComponent.levelZ(),
                new DoorConnectionCarrier(
                        Door.fromSegments(doorComponent.door().segments2x(), doorComponent.door().doorState()),
                        doorComponent.door().segments2x().stream().sorted(GridSegment2x.ORDER).findFirst().orElse(null)),
                endpoints);
    }

    private static List<ConnectionEndpoint> endpointsForDoor(List<Room> touchingRooms) {
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
        return List.of();
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

    private record RoomSurfaceProjection(Room room, StructureObject structure) {
    }

    private record RoomSurfaceIndex(List<Room> rooms, Map<Room, StructureObject> structuresByRoom) {
        private RoomSurfaceIndex {
            rooms = rooms == null ? List.of() : List.copyOf(rooms);
            structuresByRoom = structuresByRoom == null ? Map.of() : Map.copyOf(structuresByRoom);
        }

        private static RoomSurfaceIndex empty() {
            return new RoomSurfaceIndex(List.of(), Map.of());
        }
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
