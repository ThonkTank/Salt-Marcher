package features.world.dungeonmap.model.structures.cluster;

import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.EdgeShape;
import features.world.dungeonmap.model.geometry.GridPoint2x;
import features.world.dungeonmap.model.geometry.GridSegment2x;
import features.world.dungeonmap.model.interaction.DungeonSelectionRef;
import features.world.dungeonmap.model.interaction.InteractiveLabelHandle;
import features.world.dungeonmap.model.objects.Door;
import features.world.dungeonmap.model.objects.DoorRef;
import features.world.dungeonmap.model.objects.StructureObject;
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
    private final RoomPartition roomPartition;
    private final List<DungeonConnection> localConnections;
    // Lazy-computed on first access; safe because RoomCluster is only accessed on the FX application thread.
    private Map<Long, Set<Long>> adjacentRoomIdsByRoomId;
    private List<Set<Long>> components;
    private Map<Long, Set<Long>> componentByRoomId;

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
        RoomPartition resolvedRoomPartition = deriveRoomPartition(clusterId, mapId, resolvedStructure, rooms);
        List<Room> resolvedRooms = resolvedRoomPartition.rooms();

        this.clusterId = clusterId;
        this.mapId = mapId;
        this.center = center == null ? new CellCoord(0, 0) : center;
        this.structure = resolvedStructure;
        this.rooms = resolvedRooms;
        this.roomPartition = resolvedRoomPartition;
        this.localConnections = deriveLocalConnections(mapId, clusterId, resolvedRoomPartition);
        this.adjacentRoomIdsByRoomId = null;
        this.components = null;
        this.componentByRoomId = null;
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
        return structureFor(room).doorSegmentsAtLevel(levelZ);
    }

    public Set<GridSegment2x> roomOpeningEdgesAtLevel(Long roomId, int levelZ) {
        return structureFor(roomId).doorSegmentsAtLevel(levelZ);
    }

    public List<Door> roomDoorsAtLevel(Room room, int levelZ) {
        return structureFor(room).doorsAtLevel(levelZ);
    }

    public List<Door> roomDoorsAtLevel(Long roomId, int levelZ) {
        return structureFor(roomId).doorsAtLevel(levelZ);
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
        StructureObject projectedStructure = structure.projectedToLevel(levelZ);
        if (projectedStructure.levels().isEmpty()) {
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
                projectedStructure,
                projectedRooms);
    }

    public RoomCluster editBoundary(int levelZ, GridSegment2x segment2x, InternalBoundaryType type, boolean deleteBoundary) {
        return editBoundary(levelZ, segment2x == null ? List.<GridSegment2x>of() : List.of(segment2x), type, deleteBoundary);
    }

    public RoomCluster editBoundary(int levelZ, Collection<GridSegment2x> segments2x, InternalBoundaryType type, boolean deleteBoundary) {
        return Topology.editBoundary(this, levelZ, segments2x, type, deleteBoundary);
    }

    public RoomCluster moveDoor(int levelZ, GridSegment2x sourceBoundarySegment2x, GridSegment2x targetBoundarySegment2x) {
        // Door movement stays cluster-owned so SELECT drag and write workflows reuse the same local boundary rules.
        return Topology.moveDoor(this, levelZ, sourceBoundarySegment2x, targetBoundarySegment2x);
    }

    public boolean canCreateDoor(int levelZ, GridSegment2x boundarySegment2x) {
        // Door eligibility belongs to the cluster owner so editor tools do not become the only source of boundary
        // semantics for local room-to-room connections.
        if (boundarySegment2x == null
                || structure.doorSegmentsAtLevel(levelZ).contains(boundarySegment2x)) {
            return false;
        }
        if (!structure.interiorAdjacencyEdgesAtLevel(levelZ).contains(boundarySegment2x)) {
            return false;
        }
        RoomPair roomPair = roomPairAtLevel(this, boundarySegment2x, levelZ);
        return roomPair != null
                && roomPair.left() != null
                && roomPair.right() != null
                && roomPair.left().roomId() != null
                && roomPair.right().roomId() != null
                && !roomPair.left().roomId().equals(roomPair.right().roomId());
    }

    public boolean canDeleteDoor(int levelZ, GridSegment2x boundarySegment2x) {
        return boundarySegment2x != null
                && structure.interiorAdjacencyEdgesAtLevel(levelZ).contains(boundarySegment2x)
                && structure.doorSegmentsAtLevel(levelZ).contains(boundarySegment2x);
    }

    public boolean canCreateExteriorDoor(int levelZ, GridSegment2x boundarySegment2x) {
        return boundarySegment2x != null
                && structure.boundaryEdgesAtLevel(levelZ).contains(boundarySegment2x)
                && !structure.doorSegmentsAtLevel(levelZ).contains(boundarySegment2x)
                && isExteriorBoundarySegment(levelZ, boundarySegment2x);
    }

    public boolean canDeleteExteriorDoor(int levelZ, GridSegment2x boundarySegment2x) {
        return boundarySegment2x != null
                && structure.doorSegmentsAtLevel(levelZ).contains(boundarySegment2x)
                && isExteriorBoundarySegment(levelZ, boundarySegment2x);
    }

    public RoomCluster withDoorSegments(int levelZ, Collection<GridSegment2x> segments2x, boolean deleteDoor) {
        return Topology.editDoors(this, levelZ, segments2x, deleteDoor, false);
    }

    public RoomCluster withExteriorDoors(int levelZ, Collection<GridSegment2x> segments2x, boolean deleteDoor) {
        return Topology.editDoors(this, levelZ, segments2x, deleteDoor, true);
    }

    public InteractiveLabelHandle labelHandle() {
        return new InteractiveLabelHandle(
                new DungeonSelectionRef.ClusterRef(clusterId),
                clusterId == null ? "Cluster" : "Cluster " + clusterId,
                GridPoint2x.cell(CellCoord.bestCenter(cells())));
    }

    public boolean overlapsCells(Collection<CellCoord> candidateCells) {
        Set<CellCoord> clusterCells = cells();
        if (candidateCells == null || candidateCells.isEmpty() || clusterCells.isEmpty()) {
            return false;
        }
        for (CellCoord cell : candidateCells) {
            if (cell != null && clusterCells.contains(cell)) {
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
        List<GridSegment2x> route = StructureObject.shortestEdgePath(start, goal, traversableEdges);
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
        List<GridSegment2x> route = StructureObject.shortestEdgePath(start, goal, deletableInternalBoundaryEdges());
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
        return structure.cellCoords();
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
        return structure.surfaceCellsByLevel();
    }

    public int primaryLevel() {
        return cellsByLevel().keySet().stream()
                .mapToInt(Integer::intValue)
                .min()
                .orElse(0);
    }

    public Set<GridSegment2x> outerBoundarySegments2x() {
        return structure.exteriorBoundaryEdges();
    }

    public Room findRoom(Long roomId) {
        return roomId == null ? null : roomPartition.roomsById().get(roomId);
    }

    public Set<Long> roomIds() {
        return roomPartition.roomsById().keySet();
    }

    public boolean containsRoom(Long roomId) {
        return roomId != null && roomPartition.roomsById().containsKey(roomId);
    }

    /**
     * Convenience shortcut for UI-only callers that do not have an explicit level context.
     * This lookup only checks {@link #primaryLevel()} and must not be used for topology decisions.
     */
    public Room roomAt(CellCoord cell) {
        return cell == null ? null : roomAt(cell, primaryLevel());
    }

    /**
     * Canonical 3D room lookup used by topology-sensitive APIs.
     */
    public Room roomAt(CellCoord cell, int levelZ) {
        return cell == null ? null : roomPartition.roomsByPoint().get(CubePoint.at(cell, levelZ));
    }

    public Room roomAt(CubePoint point) {
        return point == null ? null : roomPartition.roomsByPoint().get(point);
    }

    public boolean contains(CellCoord cell) {
        return cell != null && structure.contains(cell);
    }

    public boolean contains(CellCoord cell, int levelZ) {
        return roomAt(cell, levelZ) != null;
    }

    public Set<CubePoint> cubePoints() {
        return Set.copyOf(roomPartition.roomsByPoint().keySet());
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

    /**
     * Canonical 3D component lookup. Prefer this overload for semantic decisions.
     */
    public Set<Long> componentContaining(CellCoord cell, int levelZ) {
        Room room = roomAt(cell, levelZ);
        return room == null ? Set.of() : componentContaining(room.roomId());
    }

    public boolean isConnected() {
        return roomPartition.roomsById().isEmpty() || componentsLazy().size() <= 1;
    }

    public boolean hasOverlappingRooms() {
        return roomPartition.hasOverlaps();
    }

    public boolean canMergeRooms(Set<Long> roomIds) {
        Set<Long> selected = normalizedRoomIds(roomIds);
        if (selected.size() < 2 || !roomPartition.roomsById().keySet().containsAll(selected)) {
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

    public Map<BoundaryLevelKey, InternalBoundaryType> internalBoundaryKinds() {
        return Topology.internalBoundaryKinds(this);
    }

    public RoomCluster applyPaint(Set<CellCoord> paintCells, List<RoomCluster> overlappingClusters, int paintLevel) {
        return Topology.applyPaint(this, paintCells, overlappingClusters, paintLevel);
    }

    public List<RoomCluster> applyDelete(Set<CellCoord> deletedCells, int deleteLevel) {
        return Topology.applyDelete(this, deletedCells, deleteLevel);
    }

    private StructureObject structureFor(Room room) {
        return roomPartition.structureFor(room);
    }

    private StructureObject structureFor(Long roomId) {
        return roomPartition.structureFor(roomId);
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

    private static Map<Integer, Set<CellCoord>> roomCellsByLevel(
            Room room,
            Map<Room, Map<Integer, Set<CellCoord>>> roomCellsByRoom
    ) {
        if (room == null || roomCellsByRoom == null || roomCellsByRoom.isEmpty()) {
            return Map.of();
        }
        return roomCellsByRoom.getOrDefault(room, Map.of());
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

    private static OverlapIndex indexRoomsByPoint(List<Room> rooms, Map<Room, Map<Integer, Set<CellCoord>>> roomCellsByRoom) {
        Map<CubePoint, Room> result = new LinkedHashMap<>();
        boolean hasOverlaps = false;
        for (Room room : rooms) {
            if (room == null) {
                continue;
            }
            for (Map.Entry<Integer, Set<CellCoord>> entry : roomCellsByLevel(room, roomCellsByRoom).entrySet()) {
                Integer levelZ = entry.getKey();
                if (levelZ == null) {
                    continue;
                }
                for (CellCoord cell : entry.getValue()) {
                    CubePoint point = CubePoint.at(cell, levelZ);
                    if (result.containsKey(point) && result.get(point) != room) {
                        hasOverlaps = true;
                    }
                    result.put(point, room);
                }
            }
        }
        return new OverlapIndex(Map.copyOf(result), hasOverlaps);
    }

    private static RoomPair roomPairAtLevel(RoomCluster cluster, GridSegment2x segment2x, int levelZ) {
        if (cluster == null || segment2x == null) {
            return null;
        }
        List<CellCoord> touchingCells = segment2x.touchingCells().stream()
                .sorted(CellCoord.ORDER)
                .toList();
        if (touchingCells.size() != 2) {
            return null;
        }
        Room left = cluster.roomAt(touchingCells.getFirst(), levelZ);
        Room right = cluster.roomAt(touchingCells.getLast(), levelZ);
        return left == null || right == null ? null : new RoomPair(left, right);
    }

    private record RoomPair(Room left, Room right) {
    }

    public record BoundaryLevelKey(int levelZ, GridSegment2x segment2x) {
    }

    private static Map<Room, Map<Integer, Set<CellCoord>>> immutableRoomCellsByRoom(
            Map<Room, Map<Integer, Set<CellCoord>>> mutable
    ) {
        if (mutable == null || mutable.isEmpty()) {
            return Map.of();
        }
        Map<Room, Map<Integer, Set<CellCoord>>> result = new LinkedHashMap<>();
        for (Map.Entry<Room, Map<Integer, Set<CellCoord>>> entry : mutable.entrySet()) {
            if (entry != null && entry.getKey() != null) {
                result.put(entry.getKey(), immutableCellsByLevel(entry.getValue()));
            }
        }
        return result.isEmpty() ? Map.of() : Map.copyOf(result);
    }

    private static Map<Integer, Set<CellCoord>> immutableCellsByLevel(Map<Integer, Set<CellCoord>> source) {
        if (source == null || source.isEmpty()) {
            return Map.of();
        }
        Map<Integer, Set<CellCoord>> result = new LinkedHashMap<>();
        source.entrySet().stream()
                .filter(entry -> entry != null && entry.getKey() != null)
                .sorted(Map.Entry.comparingByKey())
                .forEach(entry -> result.put(entry.getKey(), CellCoord.normalize(entry.getValue())));
        return result.isEmpty() ? Map.of() : Map.copyOf(result);
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

    private static RoomPartition deriveRoomPartition(
            Long clusterId,
            long mapId,
            StructureObject clusterStructure,
            List<Room> roomMetadata
    ) {
        if (clusterStructure == null || clusterStructure.levels().isEmpty()) {
            return RoomPartition.empty();
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
        Map<Room, Map<Integer, Set<CellCoord>>> roomCellsByRoom = new LinkedHashMap<>();
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
                Set<CellCoord> roomCells = intersectCells(clusterStructure.reachableSurfaceFrom(anchor, levelZ), remainingLevelCells);
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
            PartitionedRoom projection = resolvedDerivedRoom(
                    clusterId,
                    mapId,
                    metadataRoom,
                    roomCellsByLevel,
                    metadataRoom.narration());
            result.add(projection.room());
            roomCellsByRoom.put(projection.room(), projection.roomCellsByLevel());
        }

        for (Map.Entry<Integer, Set<CellCoord>> entry : new LinkedHashMap<>(remainingCellsByLevel).entrySet()) {
            Integer levelZ = entry.getKey();
            LinkedHashSet<CellCoord> unassigned = new LinkedHashSet<>(entry.getValue());
            while (!unassigned.isEmpty()) {
                CellCoord seed = unassigned.stream().min(CellCoord.ORDER).orElse(null);
                if (seed == null) {
                    break;
                }
                Set<CellCoord> roomCells = intersectCells(clusterStructure.reachableSurfaceFrom(seed, levelZ), unassigned);
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
                PartitionedRoom projection = resolvedDerivedRoom(
                        clusterId,
                        mapId,
                        metadataRoom,
                        Map.of(levelZ, Set.copyOf(roomCells)),
                        metadataRoom.narration());
                result.add(projection.room());
                roomCellsByRoom.put(projection.room(), projection.roomCellsByLevel());
            }
        }
        if (result.isEmpty()) {
            return RoomPartition.empty();
        }
        List<Room> partitionedRooms = List.copyOf(result);
        Map<Room, Map<Integer, Set<CellCoord>>> resolvedRoomCellsByRoom = immutableRoomCellsByRoom(roomCellsByRoom);
        Map<Long, Room> roomsById = indexRoomsById(partitionedRooms);
        OverlapIndex overlapIndex = indexRoomsByPoint(partitionedRooms, resolvedRoomCellsByRoom);
        return new RoomPartition(
                clusterStructure,
                partitionedRooms,
                resolvedRoomCellsByRoom,
                roomsById,
                overlapIndex.roomsByPoint(),
                overlapIndex.hasOverlaps());
    }

    private static PartitionedRoom resolvedDerivedRoom(
            Long clusterId,
            long mapId,
            Room metadataRoom,
            Map<Integer, Set<CellCoord>> roomCellsByLevel,
            RoomNarration narration
    ) {
        Room room = new Room(
                metadataRoom.roomId(),
                mapId,
                clusterId == null ? 0L : clusterId,
                metadataRoom.name(),
                metadataRoom.anchorsByLevel(),
                narration);
        return new PartitionedRoom(room, immutableCellsByLevel(roomCellsByLevel));
    }

    private static StructureObject structureForDerivedRoom(
            Map<Integer, Set<CellCoord>> roomCellsByLevel,
            Map<Integer, CellCoord> preferredAnchorsByLevel,
            StructureObject clusterStructure
    ) {
        Map<Integer, CellCoord> anchorsByLevel = new LinkedHashMap<>();
        for (Map.Entry<Integer, Set<CellCoord>> entry : roomCellsByLevel.entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .toList()) {
            Integer levelZ = entry.getKey();
            Set<CellCoord> roomCells = entry.getValue();
            if (levelZ == null || roomCells == null || roomCells.isEmpty()) {
                continue;
            }
            CellCoord preferredAnchor = preferredAnchorsByLevel == null ? null : preferredAnchorsByLevel.get(levelZ);
            anchorsByLevel.put(levelZ, anchorCell(roomCells, preferredAnchor));
        }
        return clusterStructure.clippedToSurface(roomCellsByLevel, anchorsByLevel);
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

    private static Map<Long, Set<Long>> indexAdjacentRoomIds(RoomPartition roomPartition) {
        Map<Long, Set<Long>> result = new LinkedHashMap<>();
        for (Long roomId : roomPartition.roomsById().keySet()) {
            result.put(roomId, new LinkedHashSet<>());
        }
        for (Map.Entry<Room, Map<Integer, Set<CellCoord>>> roomEntry : roomPartition.roomCellsByRoom().entrySet()) {
            Room room = roomEntry.getKey();
            if (room == null || room.roomId() == null) {
                continue;
            }
            for (Map.Entry<Integer, Set<CellCoord>> levelEntry : roomEntry.getValue().entrySet()) {
                int levelZ = levelEntry.getKey();
                for (CellCoord cell : levelEntry.getValue()) {
                    for (CellCoord step : CellCoord.CARDINAL_STEPS) {
                        Room neighbor = roomPartition.roomsByPoint().get(CubePoint.at(cell.add(step), levelZ));
                        if (neighbor == null || neighbor.roomId() == null || neighbor.roomId().equals(room.roomId())) {
                            continue;
                        }
                        result.get(room.roomId()).add(neighbor.roomId());
                    }
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
            adjacentRoomIdsByRoomId = immutableSetMap(indexAdjacentRoomIds(roomPartition));
        }
        return adjacentRoomIdsByRoomId;
    }

    private List<Set<Long>> componentsLazy() {
        if (components == null) {
            components = components(roomPartition.roomsById().keySet(), adjacency());
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
        return structure.interiorAdjacencyEdges();
    }

    private Set<GridSegment2x> internalWallEdges() {
        return internalBoundaryKinds().entrySet().stream()
                .filter(entry -> entry.getValue() == InternalBoundaryType.WALL)
                .map(entry -> entry.getKey() == null ? null : entry.getKey().segment2x())
                .filter(Objects::nonNull)
                .sorted(GridSegment2x.ORDER)
                .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));
    }

    private Set<GridSegment2x> deletableInternalBoundaryEdges() {
        // Wall-delete treats existing local doors as removable internal barriers so a visible door segment does not
        // make the path look inert to the editor user.
        LinkedHashSet<GridSegment2x> result = new LinkedHashSet<>(internalWallEdges());
        result.addAll(localConnectionEdges(internalClusterEdges()));
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
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
        return structure.levels().stream()
                .flatMap(levelZ -> structure.doorsAtLevel(levelZ).stream())
                .filter(Objects::nonNull)
                .flatMap(door -> door.segments2x().stream())
                .filter(allowedEdges::contains)
                .sorted(GridSegment2x.ORDER)
                .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));
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

            Map<Integer, Set<CellCoord>> mergedClusterCellsByLevel = new LinkedHashMap<>();
            Map<Integer, Set<CellCoord>> mergedClusterFloorCellsByLevel = new LinkedHashMap<>();
            Map<BoundaryLevelKey, InternalBoundaryType> mergedBoundaryKinds = new LinkedHashMap<>();
            Map<Integer, List<Door>> mergedDoorsByLevel = new LinkedHashMap<>();
            List<Room> mergedMetadataRooms = new ArrayList<>();
            for (RoomCluster overlappingCluster : resolvedClusters) {
                mergeClusterCellsByLevel(mergedClusterCellsByLevel, overlappingCluster.structure());
                mergeClusterFloorCellsByLevel(mergedClusterFloorCellsByLevel, overlappingCluster.structure());
                mergedBoundaryKinds.putAll(overlappingCluster.internalBoundaryKinds());
                mergeDoorsByLevel(mergedDoorsByLevel, overlappingCluster.structure());
                mergedMetadataRooms.addAll(overlappingCluster.rooms());
            }
            mergedClusterCellsByLevel.computeIfAbsent(paintLevel, ignored -> new LinkedHashSet<>()).addAll(paintCells);
            mergedClusterFloorCellsByLevel.computeIfAbsent(paintLevel, ignored -> new LinkedHashSet<>()).addAll(paintCells);

            StructureObject mergedStructure = buildClusterStructure(
                    mergedClusterCellsByLevel,
                    mergedClusterFloorCellsByLevel,
                    mergedBoundaryKinds,
                    mergedDoorsByLevel);
            return new RoomCluster(
                    cluster.clusterId(),
                    cluster.mapId(),
                    CellCoord.bestCenter(flattenCells(mergedClusterCellsByLevel)),
                    mergedStructure,
                    normalizedMetadataRooms(mergedMetadataRooms));
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

            Map<Integer, Set<CellCoord>> remainingFloorCellsByLevel = mutableCellsByLevel(cluster.structure().floorCellsByLevel());
            Set<CellCoord> remainingDeleteLevelFloorCells = new LinkedHashSet<>(remainingFloorCellsByLevel.getOrDefault(deleteLevel, Set.of()));
            remainingDeleteLevelFloorCells.removeAll(deletedCells);
            if (remainingDeleteLevelFloorCells.isEmpty()) {
                remainingFloorCellsByLevel.remove(deleteLevel);
            } else {
                remainingFloorCellsByLevel.put(deleteLevel, Set.copyOf(remainingDeleteLevelFloorCells));
            }

            StructureObject rewrittenStructure = buildClusterStructure(
                    remainingCellsByLevel,
                    remainingFloorCellsByLevel,
                    cluster.internalBoundaryKinds(),
                    doorsByLevel(cluster.structure()));
            List<RoomCluster> componentClusters = splitDeletedCluster(cluster, rewrittenStructure);
            if (componentClusters.isEmpty()) {
                return List.of();
            }
            ArrayList<RoomCluster> finalClusters = new ArrayList<>(componentClusters.size());
            finalClusters.add(componentClusters.getFirst().withClusterId(cluster.clusterId()));
            finalClusters.addAll(componentClusters.stream().skip(1).toList());
            return List.copyOf(finalClusters);
        }

        static RoomCluster editBoundary(
                RoomCluster cluster,
                int levelZ,
                Collection<GridSegment2x> segments2x,
                InternalBoundaryType type,
                boolean deleteBoundary
        ) {
            if (cluster == null || segments2x == null || segments2x.isEmpty()) {
                return null;
            }
            Map<BoundaryLevelKey, InternalBoundaryType> updatedBoundaryKinds = new LinkedHashMap<>(cluster.internalBoundaryKinds());
            InternalBoundaryType resolvedType = type == null ? InternalBoundaryType.WALL : type;
            if (resolvedType != InternalBoundaryType.WALL) {
                throw new IllegalArgumentException("Boundary editing only supports wall semantics");
            }
            boolean changed = false;
            for (GridSegment2x segment2x : segments2x) {
                if (segment2x == null || !cluster.structure().interiorAdjacencyEdgesAtLevel(levelZ).contains(segment2x)) {
                    continue;
                }
                RoomPair roomPair = roomPairAtLevel(cluster, segment2x, levelZ);
                boolean spansDistinctRooms = roomPair != null && !sameRoomId(roomPair.left(), roomPair.right());
                if (!spansDistinctRooms) {
                    continue;
                }
                BoundaryLevelKey boundaryKey = new BoundaryLevelKey(levelZ, segment2x);
                InternalBoundaryType currentType = updatedBoundaryKinds.get(boundaryKey);
                if (deleteBoundary) {
                    if (currentType == null) {
                        continue;
                    }
                    updatedBoundaryKinds.remove(boundaryKey);
                    changed = true;
                    continue;
                }
                if (resolvedType == currentType) {
                    continue;
                }
                updatedBoundaryKinds.put(boundaryKey, resolvedType);
                changed = true;
            }

            if (!changed) {
                return null;
            }

            StructureObject updatedStructure = buildClusterStructure(
                    cluster.structure().surfaceCellsByLevel(),
                    cluster.structure().floorCellsByLevel(),
                    updatedBoundaryKinds,
                    doorsByLevel(cluster.structure()));
            return new RoomCluster(
                    cluster.clusterId(),
                    cluster.mapId(),
                    cluster.center(),
                    updatedStructure,
                    cluster.rooms());
        }

        static RoomCluster editDoors(
                RoomCluster cluster,
                int levelZ,
                Collection<GridSegment2x> segments2x,
                boolean deleteDoor,
                boolean exteriorDoor
        ) {
            if (cluster == null || segments2x == null || segments2x.isEmpty()) {
                return null;
            }
            List<Door> nextDoors = deleteDoor
                    ? deletedDoors(cluster, levelZ, segments2x, exteriorDoor)
                    : createdDoors(cluster, levelZ, segments2x, exteriorDoor);
            if (nextDoors == null) {
                return null;
            }
            StructureObject updatedStructure = cluster.structure().withDoorsAtLevel(levelZ, nextDoors);
            if (Objects.equals(updatedStructure, cluster.structure())) {
                return null;
            }
            return new RoomCluster(
                    cluster.clusterId(),
                    cluster.mapId(),
                    cluster.center(),
                    updatedStructure,
                    cluster.rooms());
        }

        static RoomCluster moveDoor(
                RoomCluster cluster,
                int levelZ,
                GridSegment2x sourceBoundarySegment2x,
                GridSegment2x targetBoundarySegment2x
        ) {
            if (cluster == null
                    || sourceBoundarySegment2x == null
                    || targetBoundarySegment2x == null
                    || Objects.equals(sourceBoundarySegment2x, targetBoundarySegment2x)
                    || !cluster.canDeleteDoor(levelZ, sourceBoundarySegment2x)
                    || !cluster.canCreateDoor(levelZ, targetBoundarySegment2x)) {
                return null;
            }
            RoomCluster withoutSourceDoor = editDoors(cluster, levelZ, List.of(sourceBoundarySegment2x), true, false);
            if (withoutSourceDoor == null || !withoutSourceDoor.canCreateDoor(levelZ, targetBoundarySegment2x)) {
                return null;
            }
            return editDoors(withoutSourceDoor, levelZ, List.of(targetBoundarySegment2x), false, false);
        }

        static Map<BoundaryLevelKey, InternalBoundaryType> internalBoundaryKinds(RoomCluster cluster) {
            if (cluster == null) {
                return Map.of();
            }
            return computeInternalBoundaries(cluster, cluster.cellsByLevel(), cluster.rooms());
        }

        private static List<Door> createdDoors(
                RoomCluster cluster,
                int levelZ,
                Collection<GridSegment2x> segments2x,
                boolean exteriorDoor
        ) {
            List<GridSegment2x> editableSegments = (segments2x == null ? List.<GridSegment2x>of() : segments2x).stream()
                    .filter(Objects::nonNull)
                    .filter(segment2x -> exteriorDoor
                            ? cluster.canCreateExteriorDoor(levelZ, segment2x)
                            : cluster.canCreateDoor(levelZ, segment2x))
                    .toList();
            if (editableSegments.isEmpty()) {
                return null;
            }
            ArrayList<Door> nextDoors = new ArrayList<>(cluster.structure().doorsAtLevel(levelZ));
            for (EdgeShape component : EdgeShape.fromBoundarySegments(editableSegments).connectedComponents()) {
                if (!component.isEmpty()) {
                    nextDoors.add(Door.fromShape(component, component.firstSegment2x(), Door.DoorState.OPEN));
                }
            }
            return sortedDoors(nextDoors);
        }

        private static List<Door> deletedDoors(
                RoomCluster cluster,
                int levelZ,
                Collection<GridSegment2x> segments2x,
                boolean exteriorDoor
        ) {
            List<GridSegment2x> removableSegments = (segments2x == null ? List.<GridSegment2x>of() : segments2x).stream()
                    .filter(Objects::nonNull)
                    .filter(segment2x -> exteriorDoor
                            ? cluster.canDeleteExteriorDoor(levelZ, segment2x)
                            : cluster.canDeleteDoor(levelZ, segment2x))
                    .toList();
            if (removableSegments.isEmpty()) {
                return null;
            }
            boolean changed = false;
            ArrayList<Door> nextDoors = new ArrayList<>();
            for (Door door : cluster.structure().doorsAtLevel(levelZ)) {
                if (door == null || door.isEmpty()) {
                    continue;
                }
                EdgeShape remainingShape = EdgeShape.fromBoundarySegments(door.segments2x()).without(removableSegments);
                List<EdgeShape> remainingComponents = remainingShape.connectedComponents();
                if (remainingComponents.size() > 1) {
                    throw new IllegalArgumentException("Door edit would split an existing door");
                }
                if (remainingComponents.isEmpty()) {
                    changed = true;
                    continue;
                }
                EdgeShape remainingComponent = remainingComponents.getFirst();
                Door updatedDoor = Door.fromShape(
                        door.doorId(),
                        remainingComponent,
                        remainingComponent.contains(door.anchorSegment2x()) ? door.anchorSegment2x() : remainingComponent.firstSegment2x(),
                        door.doorState());
                nextDoors.add(updatedDoor);
                changed |= !updatedDoor.equals(door);
            }
            return changed ? sortedDoors(nextDoors) : null;
        }

        private static List<Door> sortedDoors(Collection<Door> doors) {
            return (doors == null ? List.<Door>of() : doors).stream()
                    .filter(Objects::nonNull)
                    .sorted(Comparator.comparing(Door::anchorSegment2x, GridSegment2x.ORDER))
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

        private static Map<BoundaryLevelKey, InternalBoundaryType> computeInternalBoundaries(
                RoomCluster cluster,
                Map<Integer, Set<CellCoord>> clusterCellsByLevel,
                List<Room> rooms
        ) {
            if (clusterCellsByLevel == null || clusterCellsByLevel.isEmpty()) {
                return Map.of();
            }
            Map<BoundaryLevelKey, InternalBoundaryType> result = new LinkedHashMap<>();
            for (Room room : rooms == null ? List.<Room>of() : rooms) {
                if (room == null) {
                    continue;
                }
                for (Integer levelZ : cluster.roomLevels(room)) {
                    Set<CellCoord> levelCells = clusterCellsByLevel.getOrDefault(levelZ, Set.of());
                    if (levelCells.isEmpty()) {
                        continue;
                    }
                    for (GridSegment2x segment2x : roomWallSegmentsAtLevel(cluster, room, levelZ)) {
                        if (isInternalSegment(levelCells, segment2x)) {
                            result.putIfAbsent(new BoundaryLevelKey(levelZ, segment2x), InternalBoundaryType.WALL);
                        }
                    }
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

        private static boolean overlapsAtLevel(RoomCluster cluster, Room room, Set<CellCoord> paintCells, int levelZ) {
            if (room == null || paintCells == null || paintCells.isEmpty()) {
                return false;
            }
            return !disjoint(cluster.roomCellsAtLevel(room, levelZ), paintCells);
        }

        private static List<Room> normalizedMetadataRooms(List<Room> rooms) {
            if (rooms == null || rooms.isEmpty()) {
                return List.of();
            }
            Map<Long, Room> persistedRoomsById = new LinkedHashMap<>();
            List<Room> transientRooms = new ArrayList<>();
            for (Room room : rooms) {
                if (room == null) {
                    continue;
                }
                if (room.roomId() == null) {
                    transientRooms.add(room);
                    continue;
                }
                persistedRoomsById.putIfAbsent(room.roomId(), room);
            }
            ArrayList<Room> result = new ArrayList<>(persistedRoomsById.values());
            result.sort(Comparator.comparing(Room::roomId));
            transientRooms.sort(Comparator
                    .comparing(Room::name, Comparator.nullsLast(String::compareTo))
                    .thenComparingInt(Room::primaryLevel));
            result.addAll(transientRooms);
            return result.isEmpty() ? List.of() : List.copyOf(result);
        }

        private static void mergeClusterCellsByLevel(Map<Integer, Set<CellCoord>> result, StructureObject structure) {
            if (result == null || structure == null) {
                return;
            }
            for (Map.Entry<Integer, Set<CellCoord>> entry : structure.surfaceCellsByLevel().entrySet()) {
                result.computeIfAbsent(entry.getKey(), ignored -> new LinkedHashSet<>()).addAll(entry.getValue());
            }
        }

        private static void mergeClusterFloorCellsByLevel(Map<Integer, Set<CellCoord>> result, StructureObject structure) {
            if (result == null || structure == null) {
                return;
            }
            for (Map.Entry<Integer, Set<CellCoord>> entry : structure.floorCellsByLevel().entrySet()) {
                result.computeIfAbsent(entry.getKey(), ignored -> new LinkedHashSet<>()).addAll(entry.getValue());
            }
        }

        private static void mergeDoorsByLevel(
                Map<Integer, List<Door>> result,
                StructureObject structure
        ) {
            if (result == null || structure == null) {
                return;
            }
            for (Map.Entry<Integer, List<Door>> entry : doorsByLevel(structure).entrySet()) {
                result.computeIfAbsent(entry.getKey(), ignored -> new ArrayList<>()).addAll(entry.getValue());
            }
        }

        private static Map<Integer, List<Door>> doorsByLevel(StructureObject structure) {
            if (structure == null || structure.levels().isEmpty()) {
                return Map.of();
            }
            Map<Integer, List<Door>> result = new LinkedHashMap<>();
            for (Integer levelZ : structure.levels().stream().sorted().toList()) {
                List<Door> doors = structure.doorsAtLevel(levelZ);
                if (!doors.isEmpty()) {
                    result.put(levelZ, doors);
                }
            }
            return result.isEmpty() ? Map.of() : Map.copyOf(result);
        }

        private static StructureObject buildClusterStructure(
                Map<Integer, Set<CellCoord>> cellsByLevel,
                Map<Integer, Set<CellCoord>> floorCellsByLevel,
                Map<BoundaryLevelKey, InternalBoundaryType> boundaryKinds,
                Map<Integer, List<Door>> doorsByLevel
        ) {
            Map<Integer, Set<CellCoord>> normalizedCellsByLevel = immutableCellsByLevel(cellsByLevel);
            if (normalizedCellsByLevel.isEmpty()) {
                return StructureObject.empty();
            }
            Map<Integer, Set<CellCoord>> normalizedFloorCellsByLevel = immutableFloorCellsByLevel(floorCellsByLevel);
            Map<Integer, Set<GridSegment2x>> boundaryEdgesByLevel = new LinkedHashMap<>();
            Map<Integer, CellCoord> anchorsByLevel = new LinkedHashMap<>();
            for (Map.Entry<Integer, Set<CellCoord>> entry : normalizedCellsByLevel.entrySet()) {
                Integer levelZ = entry.getKey();
                Set<CellCoord> levelCells = entry.getValue();
                if (levelZ == null || levelCells == null || levelCells.isEmpty()) {
                    continue;
                }
                LinkedHashSet<GridSegment2x> interiorBoundaryEdges = new LinkedHashSet<>();
                for (Map.Entry<BoundaryLevelKey, InternalBoundaryType> boundaryEntry : (boundaryKinds == null
                        ? Map.<BoundaryLevelKey, InternalBoundaryType>of()
                        : boundaryKinds).entrySet()) {
                    BoundaryLevelKey key = boundaryEntry.getKey();
                    GridSegment2x segment2x = key == null ? null : key.segment2x();
                    if (segment2x == null || key.levelZ() != levelZ || !isInternalSegment(levelCells, segment2x)) {
                        continue;
                    }
                    interiorBoundaryEdges.add(segment2x);
                }
                Set<GridSegment2x> boundaryEdges = StructureObject.boundaryEdgesForSurface(levelCells, interiorBoundaryEdges);
                anchorsByLevel.put(levelZ, CellCoord.bestCenter(levelCells));
                boundaryEdgesByLevel.put(levelZ, boundaryEdges);
            }
            return StructureObject.fromTopologyWithDoorsByLevel(
                    normalizedCellsByLevel,
                    boundaryEdgesByLevel,
                    doorsByLevel,
                    normalizedFloorCellsByLevel,
                    anchorsByLevel);
        }

        private static List<RoomCluster> splitDeletedCluster(RoomCluster originalCluster, StructureObject rewrittenStructure) {
            if (originalCluster == null || rewrittenStructure == null || rewrittenStructure.levels().isEmpty()) {
                return List.of();
            }
            Map<BoundaryLevelKey, InternalBoundaryType> boundaryKinds = originalCluster.internalBoundaryKinds();
            Map<Integer, List<Door>> doorsByLevel = doorsByLevel(rewrittenStructure);
            List<Map<Integer, Set<CellCoord>>> projectedComponents = rewrittenStructure.projectedSurfaceComponents();
            if (projectedComponents.isEmpty()) {
                return List.of();
            }
            return projectedComponents.stream()
                    .sorted(Comparator
                            .comparing((Map<Integer, Set<CellCoord>> component) -> !flattenCells(component).contains(originalCluster.center()))
                            .thenComparingInt(component -> CellCoord.bestCenter(flattenCells(component)).manhattanDistance(originalCluster.center()))
                            .thenComparing(component -> CellCoord.bestCenter(flattenCells(component)), CellCoord.ORDER))
                    .map(componentCellsByLevel -> componentCluster(
                            originalCluster,
                            componentCellsByLevel,
                            rewrittenStructure.floorCellsByLevel(),
                            boundaryKinds,
                            doorsByLevel))
                    .filter(Objects::nonNull)
                    .toList();
        }

        private static RoomCluster componentCluster(
                RoomCluster originalCluster,
                Map<Integer, Set<CellCoord>> componentCellsByLevel,
                Map<Integer, Set<CellCoord>> clusterFloorCellsByLevel,
                Map<BoundaryLevelKey, InternalBoundaryType> boundaryKinds,
                Map<Integer, List<Door>> clusterDoorsByLevel
        ) {
            Map<Integer, Set<CellCoord>> componentFloorCellsByLevel = new LinkedHashMap<>();
            Map<Integer, List<Door>> componentDoorsByLevel = new LinkedHashMap<>();
            for (Map.Entry<Integer, Set<CellCoord>> entry : componentCellsByLevel.entrySet()) {
                Integer levelZ = entry.getKey();
                Set<CellCoord> levelComponentCells = entry.getValue();
                if (levelComponentCells.isEmpty()) {
                    continue;
                }
                Set<CellCoord> levelFloorCells = intersectCells(clusterFloorCellsByLevel.get(levelZ), levelComponentCells);
                componentFloorCellsByLevel.put(levelZ, levelFloorCells);
                List<Door> levelDoors = clusterDoorsByLevel.getOrDefault(levelZ, List.of()).stream()
                        .filter(door -> door != null && door.segments2x().stream()
                                .anyMatch(segment2x -> segment2x.touchingCells().stream().anyMatch(levelComponentCells::contains)))
                        .toList();
                if (!levelDoors.isEmpty()) {
                    componentDoorsByLevel.put(levelZ, levelDoors);
                }
            }
            if (componentCellsByLevel.isEmpty()) {
                return null;
            }
            StructureObject componentStructure = buildClusterStructure(
                    componentCellsByLevel,
                    componentFloorCellsByLevel,
                    boundaryKinds,
                    componentDoorsByLevel);
            return new RoomCluster(
                    null,
                    originalCluster.mapId(),
                    CellCoord.bestCenter(flattenCells(componentCellsByLevel)),
                    componentStructure,
                    metadataRoomsForComponent(originalCluster.rooms(), componentStructure));
        }

        private static List<Room> metadataRoomsForComponent(List<Room> rooms, StructureObject componentStructure) {
            if (rooms == null || rooms.isEmpty() || componentStructure == null || componentStructure.levels().isEmpty()) {
                return List.of();
            }
            return rooms.stream()
                    .filter(room -> room != null && roomAnchorsByLevel(room).entrySet().stream()
                            .anyMatch(entry -> componentStructure.cellCoordsAtLevel(entry.getKey()).contains(entry.getValue())))
                    .sorted(Comparator.comparing(Room::roomId, Comparator.nullsLast(Long::compareTo)))
                    .toList();
        }

        private static Map<Integer, Set<CellCoord>> mutableClusterCellsByLevel(RoomCluster cluster) {
            return mutableCellsByLevel(cluster == null ? Map.of() : cluster.structure().surfaceCellsByLevel());
        }

        private static Set<CellCoord> flattenCells(Map<Integer, Set<CellCoord>> cellsByLevel) {
            LinkedHashSet<CellCoord> result = new LinkedHashSet<>();
            for (Set<CellCoord> cells : cellsByLevel.values()) {
                result.addAll(cells);
            }
            return result.isEmpty() ? Set.of() : Set.copyOf(result);
        }

        private static Map<Integer, CellCoord> roomAnchorsByLevel(Room room) {
            return room == null ? Map.of() : room.anchorsByLevel();
        }

        private static Set<GridSegment2x> roomWallSegmentsAtLevel(RoomCluster cluster, Room room, int levelZ) {
            if (room == null || cluster == null) {
                return Set.of();
            }
            StructureObject roomStructure = cluster.structureFor(room);
            Set<GridSegment2x> result = new LinkedHashSet<>(roomStructure.wallSegmentsAtLevel(levelZ));
            return result.isEmpty() ? Set.of() : Set.copyOf(result);
        }

        private static Map<Integer, Set<CellCoord>> mutableCellsByLevel(Map<Integer, Set<CellCoord>> source) {
            Map<Integer, Set<CellCoord>> result = new LinkedHashMap<>();
            for (Map.Entry<Integer, Set<CellCoord>> entry : source.entrySet()) {
                result.put(entry.getKey(), new LinkedHashSet<>(entry.getValue()));
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

        private static Set<CellCoord> normalizeCells(Collection<CellCoord> input) {
            return CellCoord.normalize(input);
        }

        private static CellCoord anchorCell(Set<CellCoord> roomCells, CellCoord preferredAnchor) {
            return preferredAnchor != null && roomCells.contains(preferredAnchor)
                    ? preferredAnchor
                    : CellCoord.bestCenter(roomCells);
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
    }

    public static List<DungeonConnection> deriveLocalConnections(
            long mapId,
            Long clusterId,
            RoomPartition roomPartition
    ) {
        if (roomPartition == null || roomPartition.rooms().isEmpty()) {
            return List.of();
        }
        long resolvedClusterId = clusterId == null ? 0L : clusterId;
        Map<String, DoorComponent> doorsByKey = new LinkedHashMap<>();
        for (Room room : roomPartition.rooms()) {
            if (room == null) {
                continue;
            }
            StructureObject roomStructure = roomPartition.structureFor(room);
            for (Integer levelZ : roomStructure.levels()) {
                for (Door door : roomStructure.doorsAtLevel(levelZ)) {
                    if (door != null && !door.isEmpty()) {
                        doorsByKey.putIfAbsent(doorKey(levelZ, door), new DoorComponent(levelZ, door));
                    }
                }
            }
        }
        List<DungeonConnection> result = new ArrayList<>();
        for (DoorComponent doorComponent : doorsByKey.values()) {
            DungeonConnection connection = localConnectionForDoor(
                    doorComponent,
                    mapId,
                    resolvedClusterId,
                    roomPartition.roomsByPoint());
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
        if (doorComponent == null || doorComponent.door() == null || doorComponent.door().isEmpty()) {
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
                new DoorConnectionCarrier(new DoorRef(doorComponent.door().doorId())),
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

    private record PartitionedRoom(Room room, Map<Integer, Set<CellCoord>> roomCellsByLevel) {
    }

    /**
     * Derived room partition over one cluster structure.
     * roomsByPoint is the only topology-binding ownership index; XY-only access is UI convenience.
     */
    private record RoomPartition(
            StructureObject clusterStructure,
            List<Room> rooms,
            Map<Room, Map<Integer, Set<CellCoord>>> roomCellsByRoom,
            Map<Long, Room> roomsById,
            Map<CubePoint, Room> roomsByPoint,
            boolean hasOverlaps
    ) {
        private RoomPartition {
            clusterStructure = clusterStructure == null ? StructureObject.empty() : clusterStructure;
            rooms = rooms == null ? List.of() : List.copyOf(rooms);
            roomCellsByRoom = roomCellsByRoom == null ? Map.of() : immutableRoomCellsByRoom(roomCellsByRoom);
            roomsById = roomsById == null ? Map.of() : Map.copyOf(roomsById);
            roomsByPoint = roomsByPoint == null ? Map.of() : Map.copyOf(roomsByPoint);
        }

        private StructureObject structureFor(Room room) {
            if (room == null) {
                return StructureObject.empty();
            }
            Map<Integer, Set<CellCoord>> roomCellsByLevel = roomCellsByRoom.get(room);
            if (roomCellsByLevel != null) {
                return structureForDerivedRoom(roomCellsByLevel, room.anchorsByLevel(), clusterStructure);
            }
            if (room.roomId() == null) {
                return StructureObject.empty();
            }
            return structureFor(room.roomId());
        }

        private StructureObject structureFor(Long roomId) {
            if (roomId == null) {
                return StructureObject.empty();
            }
            Room room = roomsById.get(roomId);
            if (room == null) {
                return StructureObject.empty();
            }
            Map<Integer, Set<CellCoord>> roomCellsByLevel = roomCellsByRoom.get(room);
            return roomCellsByLevel == null
                    ? StructureObject.empty()
                    : structureForDerivedRoom(roomCellsByLevel, room.anchorsByLevel(), clusterStructure);
        }

        private static RoomPartition empty() {
            return new RoomPartition(StructureObject.empty(), List.of(), Map.of(), Map.of(), Map.of(), false);
        }
    }

    private record OverlapIndex(Map<CubePoint, Room> roomsByPoint, boolean hasOverlaps) {
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
