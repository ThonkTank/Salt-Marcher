package features.world.dungeonmap.model.structures.cluster;

import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.EdgeShape;
import features.world.dungeonmap.model.geometry.GridPoint2x;
import features.world.dungeonmap.model.geometry.GridSegment2x;
import features.world.dungeonmap.model.interaction.DungeonSelectionRef;
import features.world.dungeonmap.model.interaction.InteractiveLabelHandle;
import features.world.dungeonmap.structure.model.Door;
import features.world.dungeonmap.structure.model.DoorRef;
import features.world.dungeonmap.structure.model.Structure;
import features.world.dungeonmap.structure.model.StructureBoundary;
import features.world.dungeonmap.structure.model.StructureRoomTopology;
import features.world.dungeonmap.structure.model.Wall;
import features.world.dungeonmap.structure.model.WallKind;
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
    private final Long structureObjectId;
    private final long mapId;
    private final CellCoord center;
    private final Structure structure;

    public RoomCluster(
            Long clusterId,
            long mapId,
            CellCoord center,
            List<Room> rooms
    ) {
        this(clusterId, null, mapId, center, Structure.empty(), requireExplicitStructure(rooms));
    }

    public RoomCluster(
            Long clusterId,
            long mapId,
            CellCoord center,
            Structure structure,
            List<Room> rooms
    ) {
        this(clusterId, null, mapId, center, structure, rooms);
    }

    public RoomCluster(
            Long clusterId,
            Long structureObjectId,
            long mapId,
            CellCoord center,
            Structure structure,
            List<Room> rooms
    ) {
        this.clusterId = clusterId;
        this.structureObjectId = structureObjectId;
        this.mapId = mapId;
        this.center = center == null ? new CellCoord(0, 0) : center;
        this.structure = normalizeClusterStructure(structure, rooms).withRoomMetadata(mapId, clusterId, rooms);
    }

    public Long clusterId() {
        return clusterId;
    }

    public long mapId() {
        return mapId;
    }

    public Long structureObjectId() {
        return structureObjectId;
    }

    public CellCoord center() {
        return center;
    }

    public Structure structure() {
        return structure;
    }

    public Set<Integer> roomLevels(Room room) {
        return roomTopology().roomLevels(room);
    }

    public Set<Integer> roomLevels(Long roomId) {
        return roomTopology().roomLevels(roomId);
    }

    public int roomPrimaryLevel(Room room) {
        return roomTopology().roomPrimaryLevel(room);
    }

    public int roomPrimaryLevel(Long roomId) {
        return roomTopology().roomPrimaryLevel(roomId);
    }

    public List<Integer> roomRelevantLevels(Room room, CellCoord focusCell, int focusLevelZ) {
        return roomTopology().roomRelevantLevels(room, focusCell, focusLevelZ);
    }

    public CellCoord roomAnchorCellAtLevel(Room room, int levelZ) {
        return roomTopology().roomAnchorCellAtLevel(room, levelZ);
    }

    public CellCoord roomAnchorCellAtLevel(Long roomId, int levelZ) {
        return roomTopology().roomAnchorCellAtLevel(roomId, levelZ);
    }

    public CellCoord roomCenterCellAtLevel(Room room, int levelZ) {
        return roomTopology().roomCenterCellAtLevel(room, levelZ);
    }

    public CellCoord roomCenterCellAtLevel(Long roomId, int levelZ) {
        return roomTopology().roomCenterCellAtLevel(roomId, levelZ);
    }

    public CellCoord roomSurfaceCenterCellAtLevel(Room room, int levelZ) {
        return roomTopology().roomSurfaceCenterCellAtLevel(room, levelZ);
    }

    public Set<CellCoord> roomCellsAtLevel(Room room, int levelZ) {
        return roomTopology().roomCellsAtLevel(room, levelZ);
    }

    public Set<CellCoord> roomCellsAtLevel(Long roomId, int levelZ) {
        return roomTopology().roomCellsAtLevel(roomId, levelZ);
    }

    public Set<CellCoord> roomFloorCellsAtLevel(Room room, int levelZ) {
        return roomTopology().roomFloorCellsAtLevel(room, levelZ);
    }

    public Set<CellCoord> roomFloorCellsAtLevel(Long roomId, int levelZ) {
        return roomTopology().roomFloorCellsAtLevel(roomId, levelZ);
    }

    public Set<GridSegment2x> roomBoundaryEdgesAtLevel(Room room, int levelZ) {
        return roomTopology().roomBoundaryEdgesAtLevel(room, levelZ);
    }

    public Set<GridSegment2x> roomBoundaryEdgesAtLevel(Long roomId, int levelZ) {
        return roomTopology().roomBoundaryEdgesAtLevel(roomId, levelZ);
    }

    public Set<GridSegment2x> roomDoorSegmentsAtLevel(Room room, int levelZ) {
        return roomTopology().roomDoorSegmentsAtLevel(room, levelZ);
    }

    public Set<GridSegment2x> roomDoorSegmentsAtLevel(Long roomId, int levelZ) {
        return roomTopology().roomDoorSegmentsAtLevel(roomId, levelZ);
    }

    public List<Door> roomDoorsAtLevel(Room room, int levelZ) {
        return roomTopology().roomDoorsAtLevel(room, levelZ);
    }

    public List<Door> roomDoorsAtLevel(Long roomId, int levelZ) {
        return roomTopology().roomDoorsAtLevel(roomId, levelZ);
    }

    public boolean roomContainsCell(Room room, CellCoord cell, int levelZ) {
        return roomTopology().roomContainsCell(room, cell, levelZ);
    }

    public boolean roomContainsCell(Long roomId, CellCoord cell, int levelZ) {
        return roomTopology().roomContainsCell(roomId, cell, levelZ);
    }

    public boolean roomHasFloorCell(Room room, CellCoord cell, int levelZ) {
        return roomTopology().roomHasFloorCell(room, cell, levelZ);
    }

    public boolean roomHasFloorCell(Long roomId, CellCoord cell, int levelZ) {
        return roomTopology().roomHasFloorCell(roomId, cell, levelZ);
    }

    public List<Room> rooms() {
        return structure.rooms();
    }

    public List<DungeonConnection> localConnections() {
        return structure.localRoomConnections();
    }

    public RoomCluster withRooms(List<Room> rooms) {
        return new RoomCluster(clusterId, structureObjectId, mapId, center, structure, rooms);
    }

    public RoomCluster withClusterId(Long clusterId) {
        long resolvedClusterId = clusterId == null ? (this.clusterId == null ? 0L : this.clusterId) : clusterId;
        return new RoomCluster(
                clusterId,
                structureObjectId,
                mapId,
                center,
                structure,
                rooms().stream()
                        .map(room -> room == null ? null : room.withClusterId(resolvedClusterId))
                        .toList());
    }

    public RoomCluster projectedToLevel(int levelZ) {
        Structure projectedStructure = structure.projectedToLevel(levelZ);
        if (projectedStructure == null || projectedStructure.levels().isEmpty() || projectedStructure.rooms().isEmpty()) {
            return null;
        }
        return new RoomCluster(
                clusterId,
                structureObjectId,
                mapId,
                center,
                projectedStructure,
                projectedStructure.rooms());
    }

    public RoomCluster createWallPath(int levelZ, Collection<GridSegment2x> segments2x) {
        return Topology.editWallPath(this, levelZ, segments2x, false);
    }

    public RoomCluster deleteWallPath(int levelZ, Collection<GridSegment2x> segments2x) {
        return Topology.editWallPath(this, levelZ, segments2x, true);
    }

    public RoomCluster moveDoor(int levelZ, GridSegment2x sourceBoundarySegment2x, GridSegment2x targetBoundarySegment2x) {
        // Door movement stays cluster-owned so SELECT drag and write workflows reuse the same local boundary rules.
        return Topology.moveDoor(this, levelZ, sourceBoundarySegment2x, targetBoundarySegment2x);
    }

    public boolean canCreateDoor(int levelZ, GridSegment2x boundarySegment2x) {
        // Door eligibility belongs to the cluster owner so editor tools do not become the only source of boundary
        // semantics for local room-to-room connections.
        StructureBoundary boundary = structure.boundaryAtLevel(levelZ);
        if (boundarySegment2x == null
                || boundary.hasDoorAt(boundarySegment2x)) {
            return false;
        }
        if (!boundary.boundaryEdges().contains(boundarySegment2x)
                || !boundary.supportsDoorAt(boundarySegment2x)
                || !boundary.isInteriorBoundary(boundarySegment2x)) {
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
        StructureBoundary boundary = structure.boundaryAtLevel(levelZ);
        return boundarySegment2x != null
                && boundary.isInteriorBoundary(boundarySegment2x)
                && boundary.hasDoorAt(boundarySegment2x);
    }

    public boolean canCreateExteriorDoor(int levelZ, GridSegment2x boundarySegment2x) {
        StructureBoundary boundary = structure.boundaryAtLevel(levelZ);
        return boundarySegment2x != null
                && boundary.boundaryEdges().contains(boundarySegment2x)
                && !boundary.hasDoorAt(boundarySegment2x)
                && boundary.supportsDoorAt(boundarySegment2x)
                && boundary.isExteriorBoundary(boundarySegment2x);
    }

    public boolean canDeleteExteriorDoor(int levelZ, GridSegment2x boundarySegment2x) {
        StructureBoundary boundary = structure.boundaryAtLevel(levelZ);
        return boundarySegment2x != null
                && boundary.hasDoorAt(boundarySegment2x)
                && boundary.isExteriorBoundary(boundarySegment2x);
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
                GridPoint2x.cell(center));
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
        return rooms().size() == 1 ? rooms().getFirst() : null;
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
                structureObjectId,
                mapId,
                center.add(resolvedDelta),
                structure.movedBy(resolvedDelta, levelDelta),
                structure.movedBy(resolvedDelta, levelDelta).rooms());
    }

    public BoundaryPath findCreateWallPath(GridPoint2x start, GridPoint2x goal) {
        if (start == null || goal == null) {
            return BoundaryPath.empty();
        }
        int levelZ = primaryLevel();
        List<GridSegment2x> route = structure.boundaryAtLevel(levelZ).findCreatableWallPath(start, goal);
        if (route.isEmpty()) {
            return BoundaryPath.empty();
        }
        return new BoundaryPath(route, new LinkedHashSet<>(route));
    }

    public BoundaryPath findDeleteWallPath(GridPoint2x start, GridPoint2x goal) {
        if (start == null || goal == null) {
            return BoundaryPath.empty();
        }
        int levelZ = primaryLevel();
        List<GridSegment2x> route = structure.boundaryAtLevel(levelZ).findDeletableWallPath(start, goal);
        if (route.isEmpty()) {
            return BoundaryPath.empty();
        }
        return new BoundaryPath(route, new LinkedHashSet<>(route));
    }

    public boolean touchesExistingWall(GridPoint2x vertex) {
        return structure.boundaryAtLevel(primaryLevel()).touchesBoundaryVertex(vertex);
    }

    public boolean isEditableWallVertex(GridPoint2x vertex, boolean deleteMode) {
        return structure.boundaryAtLevel(primaryLevel()).isEditableWallVertex(vertex, deleteMode);
    }

    public Set<CellCoord> cells() {
        return structure.cellCoords();
    }

    public Map<Integer, Set<CellCoord>> cellsByLevel() {
        return Topology.surfaceCellsByLevel(structure);
    }

    public int primaryLevel() {
        return cellsByLevel().keySet().stream()
                .mapToInt(Integer::intValue)
                .min()
                .orElse(0);
    }

    public Set<GridSegment2x> outerBoundarySegments2x() {
        LinkedHashSet<GridSegment2x> result = new LinkedHashSet<>();
        for (Integer levelZ : structure.levels().stream().sorted().toList()) {
            result.addAll(structure.boundaryAtLevel(levelZ).exteriorBoundaryEdges());
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    public Room findRoom(Long roomId) {
        return roomTopology().findRoom(roomId);
    }

    public Set<Long> roomIds() {
        return roomTopology().roomIds();
    }

    public boolean containsRoom(Long roomId) {
        return roomTopology().containsRoom(roomId);
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
        return cell == null ? null : roomTopology().roomAt(cell, levelZ);
    }

    public Room roomAt(CubePoint point) {
        return point == null ? null : roomTopology().roomAt(point);
    }

    public boolean contains(CellCoord cell) {
        return cell != null && structure.contains(cell);
    }

    public boolean contains(CellCoord cell, int levelZ) {
        return roomAt(cell, levelZ) != null;
    }

    public Set<CubePoint> cubePoints() {
        return roomTopology().cubePoints();
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
        return roomTopology().adjacentRoomIds(roomId);
    }

    public List<Set<Long>> components() {
        return roomTopology().components();
    }

    public Set<Long> componentContaining(Long roomId) {
        return roomTopology().componentContaining(roomId);
    }

    public Set<Long> componentContaining(CellCoord cell) {
        Room room = roomAt(cell);
        return room == null ? Set.of() : componentContaining(room.roomId());
    }

    /**
     * Canonical 3D component lookup. Prefer this overload for semantic decisions.
     */
    public Set<Long> componentContaining(CellCoord cell, int levelZ) {
        return roomTopology().componentContaining(cell, levelZ);
    }

    public boolean isConnected() {
        return roomTopology().isConnected();
    }

    public boolean hasOverlappingRooms() {
        return roomTopology().hasOverlappingRooms();
    }

    public boolean canMergeRooms(Set<Long> roomIds) {
        return roomTopology().canMergeRooms(roomIds);
    }

    public RoomCluster applyPaint(Set<CellCoord> paintCells, List<RoomCluster> overlappingClusters, int paintLevel) {
        return Topology.applyPaint(this, paintCells, overlappingClusters, paintLevel);
    }

    public List<RoomCluster> applyDelete(Set<CellCoord> deletedCells, int deleteLevel) {
        return Topology.applyDelete(this, deletedCells, deleteLevel);
    }

    private Structure structureFor(Room room) {
        return roomTopology().structureFor(room);
    }

    private Structure structureFor(Long roomId) {
        return roomTopology().structureFor(roomId);
    }

    private StructureRoomTopology roomTopology() {
        return structure.roomTopology() == null ? StructureRoomTopology.empty() : structure.roomTopology();
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

    private static Structure normalizeClusterStructure(Structure structure, List<Room> rooms) {
        if (structure != null && !structure.levels().isEmpty()) {
            return structure;
        }
        if (rooms == null || rooms.isEmpty()) {
            return Structure.empty();
        }
        throw new IllegalArgumentException("RoomCluster requires explicit structure when rooms are present");
    }


    private Map<Long, Set<Long>> adjacency() {
        return roomTopology().adjacencyIndex();
    }

    private List<Set<Long>> componentsLazy() {
        return roomTopology().components();
    }

    private Map<Long, Set<Long>> componentByRoomId() {
        return roomTopology().componentByRoomIdIndex();
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
            Map<Integer, List<Door>> mergedDoorsByLevel = new LinkedHashMap<>();
            Map<Integer, List<Wall>> mergedWallsByLevel = new LinkedHashMap<>();
            List<Room> mergedMetadataRooms = new ArrayList<>();
            for (RoomCluster overlappingCluster : resolvedClusters) {
                mergeClusterCellsByLevel(mergedClusterCellsByLevel, overlappingCluster.structure());
                mergeClusterFloorCellsByLevel(mergedClusterFloorCellsByLevel, overlappingCluster.structure());
                mergeDoorsByLevel(mergedDoorsByLevel, overlappingCluster.structure());
                mergeWallsByLevel(mergedWallsByLevel, overlappingCluster.structure());
                mergedMetadataRooms.addAll(overlappingCluster.rooms());
            }
            mergedClusterCellsByLevel.computeIfAbsent(paintLevel, ignored -> new LinkedHashSet<>()).addAll(paintCells);
            mergedClusterFloorCellsByLevel.computeIfAbsent(paintLevel, ignored -> new LinkedHashSet<>()).addAll(paintCells);

            Structure mergedStructure = buildClusterStructure(
                    mergedClusterCellsByLevel,
                    mergedClusterFloorCellsByLevel,
                    mergedDoorsByLevel,
                    mergedWallsByLevel);
            return new RoomCluster(
                    cluster.clusterId(),
                    cluster.structureObjectId(),
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

            Map<Integer, Set<CellCoord>> remainingFloorCellsByLevel = mutableCellsByLevel(floorCellsByLevel(cluster.structure()));
            Set<CellCoord> remainingDeleteLevelFloorCells = new LinkedHashSet<>(remainingFloorCellsByLevel.getOrDefault(deleteLevel, Set.of()));
            remainingDeleteLevelFloorCells.removeAll(deletedCells);
            if (remainingDeleteLevelFloorCells.isEmpty()) {
                remainingFloorCellsByLevel.remove(deleteLevel);
            } else {
                remainingFloorCellsByLevel.put(deleteLevel, Set.copyOf(remainingDeleteLevelFloorCells));
            }

            Structure rewrittenStructure = buildClusterStructure(
                    remainingCellsByLevel,
                    remainingFloorCellsByLevel,
                    doorsByLevel(cluster.structure()),
                    wallsByLevel(cluster.structure()));
            List<RoomCluster> componentClusters = splitDeletedCluster(cluster, rewrittenStructure);
            if (componentClusters.isEmpty()) {
                return List.of();
            }
            ArrayList<RoomCluster> finalClusters = new ArrayList<>(componentClusters.size());
            finalClusters.add(componentClusters.getFirst().withClusterId(cluster.clusterId()));
            finalClusters.addAll(componentClusters.stream().skip(1).toList());
            return List.copyOf(finalClusters);
        }

        static RoomCluster editWallPath(
                RoomCluster cluster,
                int levelZ,
                Collection<GridSegment2x> segments2x,
                boolean deleteWall
        ) {
            if (cluster == null || segments2x == null || segments2x.isEmpty()) {
                return null;
            }
            List<GridSegment2x> editedSegments = segments2x.stream()
                    .filter(Objects::nonNull)
                    .filter(segment2x -> cluster.structure().boundaryAtLevel(levelZ).interiorAdjacencyEdges().contains(segment2x))
                    .filter(segment2x -> {
                        RoomPair roomPair = roomPairAtLevel(cluster, segment2x, levelZ);
                        return roomPair != null && !sameRoomId(roomPair.left(), roomPair.right());
                    })
                    .sorted(GridSegment2x.ORDER)
                    .toList();
            if (editedSegments.isEmpty()) {
                return null;
            }
            StructureBoundary updatedBoundary = deleteWall
                    ? cluster.structure().boundaryAtLevel(levelZ).withDeletedWallPath(editedSegments)
                    : cluster.structure().boundaryAtLevel(levelZ).withCreatedWallPath(editedSegments);
            Structure updatedStructure = cluster.structure().withBoundaryAtLevel(levelZ, updatedBoundary);
            if (Objects.equals(updatedStructure, cluster.structure())) {
                return null;
            }
            return new RoomCluster(
                    cluster.clusterId(),
                    cluster.structureObjectId(),
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
            Structure updatedStructure = cluster.structure().withBoundaryAtLevel(
                    levelZ,
                    cluster.structure().boundaryAtLevel(levelZ).withDoors(nextDoors));
            if (Objects.equals(updatedStructure, cluster.structure())) {
                return null;
            }
            return new RoomCluster(
                    cluster.clusterId(),
                    cluster.structureObjectId(),
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
            ArrayList<Door> nextDoors = new ArrayList<>(cluster.structure().boundaryAtLevel(levelZ).doors());
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
            for (Door door : cluster.structure().boundaryAtLevel(levelZ).doors()) {
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

        private static List<Wall> sortedWalls(Collection<Wall> walls) {
            return (walls == null ? List.<Wall>of() : walls).stream()
                    .filter(Objects::nonNull)
                    .sorted(Comparator.comparing(Wall::anchorSegment2x, GridSegment2x.ORDER))
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

        private static Map<Integer, Set<CellCoord>> surfaceCellsByLevel(Structure structure) {
            if (structure == null || structure.levels().isEmpty()) {
                return Map.of();
            }
            Map<Integer, Set<CellCoord>> result = new LinkedHashMap<>();
            for (Integer levelZ : structure.levels().stream().sorted().toList()) {
                Set<CellCoord> levelCells = structure.surfaceAtLevel(levelZ).cellCoords();
                if (!levelCells.isEmpty()) {
                    result.put(levelZ, levelCells);
                }
            }
            return result.isEmpty() ? Map.of() : Map.copyOf(result);
        }

        private static Map<Integer, Set<CellCoord>> floorCellsByLevel(Structure structure) {
            if (structure == null || structure.levels().isEmpty()) {
                return Map.of();
            }
            Map<Integer, Set<CellCoord>> result = new LinkedHashMap<>();
            for (Integer levelZ : structure.levels().stream().sorted().toList()) {
                Set<CellCoord> floorCells = structure.surfaceAtLevel(levelZ).floorCells();
                if (!floorCells.isEmpty()) {
                    result.put(levelZ, floorCells);
                }
            }
            return result.isEmpty() ? Map.of() : Map.copyOf(result);
        }

        private static List<Map<Integer, Set<CellCoord>>> projectedSurfaceComponents(Structure structure) {
            if (structure == null || structure.levels().isEmpty()) {
                return List.of();
            }
            Set<CellCoord> projectedCells = structure.cellCoords();
            if (projectedCells.isEmpty()) {
                return List.of();
            }
            List<Set<CellCoord>> components = connectedProjectedComponents(projectedCells);
            ArrayList<Map<Integer, Set<CellCoord>>> result = new ArrayList<>(components.size());
            for (Set<CellCoord> component : components) {
                Map<Integer, Set<CellCoord>> componentByLevel = new LinkedHashMap<>();
                for (Integer levelZ : structure.levels().stream().sorted().toList()) {
                    Set<CellCoord> levelCells = intersectCells(structure.surfaceAtLevel(levelZ).cellCoords(), component);
                    if (!levelCells.isEmpty()) {
                        componentByLevel.put(levelZ, levelCells);
                    }
                }
                if (!componentByLevel.isEmpty()) {
                    result.add(Map.copyOf(componentByLevel));
                }
            }
            return result.isEmpty() ? List.of() : List.copyOf(result);
        }

        private static List<Set<CellCoord>> connectedProjectedComponents(Collection<CellCoord> cells) {
            Set<CellCoord> remaining = CellCoord.normalize(cells);
            if (remaining.isEmpty()) {
                return List.of();
            }
            ArrayList<Set<CellCoord>> components = new ArrayList<>();
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
            return components.isEmpty() ? List.of() : List.copyOf(components);
        }

        private static void mergeClusterCellsByLevel(Map<Integer, Set<CellCoord>> result, Structure structure) {
            if (result == null || structure == null) {
                return;
            }
            for (Map.Entry<Integer, Set<CellCoord>> entry : surfaceCellsByLevel(structure).entrySet()) {
                result.computeIfAbsent(entry.getKey(), ignored -> new LinkedHashSet<>()).addAll(entry.getValue());
            }
        }

        private static void mergeClusterFloorCellsByLevel(Map<Integer, Set<CellCoord>> result, Structure structure) {
            if (result == null || structure == null) {
                return;
            }
            for (Map.Entry<Integer, Set<CellCoord>> entry : floorCellsByLevel(structure).entrySet()) {
                result.computeIfAbsent(entry.getKey(), ignored -> new LinkedHashSet<>()).addAll(entry.getValue());
            }
        }

        private static void mergeDoorsByLevel(
                Map<Integer, List<Door>> result,
                Structure structure
        ) {
            if (result == null || structure == null) {
                return;
            }
            for (Map.Entry<Integer, List<Door>> entry : doorsByLevel(structure).entrySet()) {
                result.computeIfAbsent(entry.getKey(), ignored -> new ArrayList<>()).addAll(entry.getValue());
            }
        }

        private static void mergeWallsByLevel(
                Map<Integer, List<Wall>> result,
                Structure structure
        ) {
            if (result == null || structure == null) {
                return;
            }
            for (Map.Entry<Integer, List<Wall>> entry : wallsByLevel(structure).entrySet()) {
                result.computeIfAbsent(entry.getKey(), ignored -> new ArrayList<>()).addAll(entry.getValue());
            }
        }

        private static Map<Integer, List<Door>> doorsByLevel(Structure structure) {
            if (structure == null || structure.levels().isEmpty()) {
                return Map.of();
            }
            Map<Integer, List<Door>> result = new LinkedHashMap<>();
            for (Integer levelZ : structure.levels().stream().sorted().toList()) {
                List<Door> doors = structure.boundaryAtLevel(levelZ).doors();
                if (!doors.isEmpty()) {
                    result.put(levelZ, doors);
                }
            }
            return result.isEmpty() ? Map.of() : Map.copyOf(result);
        }

        private static Map<Integer, List<Wall>> wallsByLevel(Structure structure) {
            if (structure == null || structure.levels().isEmpty()) {
                return Map.of();
            }
            Map<Integer, List<Wall>> result = new LinkedHashMap<>();
            for (Integer levelZ : structure.levels().stream().sorted().toList()) {
                List<Wall> walls = structure.boundaryAtLevel(levelZ).authoredWalls();
                if (!walls.isEmpty()) {
                    result.put(levelZ, walls);
                }
            }
            return result.isEmpty() ? Map.of() : Map.copyOf(result);
        }

        private static Structure buildClusterStructure(
                Map<Integer, Set<CellCoord>> cellsByLevel,
                Map<Integer, Set<CellCoord>> floorCellsByLevel,
                Map<Integer, List<Door>> doorsByLevel,
                Map<Integer, List<Wall>> wallsByLevel
        ) {
            Map<Integer, Set<CellCoord>> normalizedCellsByLevel = immutableCellsByLevel(cellsByLevel);
            if (normalizedCellsByLevel.isEmpty()) {
                return Structure.empty();
            }
            Map<Integer, Set<CellCoord>> normalizedFloorCellsByLevel = immutableFloorCellsByLevel(floorCellsByLevel);
            Map<Integer, Structure.LevelStructure> levelsByZ = new LinkedHashMap<>();
            for (Map.Entry<Integer, Set<CellCoord>> entry : normalizedCellsByLevel.entrySet()) {
                Integer levelZ = entry.getKey();
                Set<CellCoord> levelCells = entry.getValue();
                if (levelZ == null || levelCells == null || levelCells.isEmpty()) {
                    continue;
                }
                List<Wall> levelWalls = wallsByLevel == null ? List.of() : wallsByLevel.getOrDefault(levelZ, List.of());
                levelsByZ.put(levelZ, Structure.LevelStructure.fromSurfaceAndFeatures(
                        CellCoord.bestCenter(levelCells),
                        levelCells,
                        doorsByLevel == null ? List.of() : doorsByLevel.getOrDefault(levelZ, List.of()),
                        levelWalls,
                        normalizedFloorCellsByLevel.getOrDefault(levelZ, Set.of())));
            }
            return Structure.fromLevels(levelsByZ);
        }

        private static List<RoomCluster> splitDeletedCluster(RoomCluster originalCluster, Structure rewrittenStructure) {
            if (originalCluster == null || rewrittenStructure == null || rewrittenStructure.levels().isEmpty()) {
                return List.of();
            }
            Map<Integer, List<Door>> doorsByLevel = doorsByLevel(rewrittenStructure);
            Map<Integer, List<Wall>> wallsByLevel = wallsByLevel(rewrittenStructure);
            List<Map<Integer, Set<CellCoord>>> projectedComponents = projectedSurfaceComponents(rewrittenStructure);
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
                            floorCellsByLevel(rewrittenStructure),
                            doorsByLevel,
                            wallsByLevel))
                    .filter(Objects::nonNull)
                    .toList();
        }

        private static RoomCluster componentCluster(
                RoomCluster originalCluster,
                Map<Integer, Set<CellCoord>> componentCellsByLevel,
                Map<Integer, Set<CellCoord>> clusterFloorCellsByLevel,
                Map<Integer, List<Door>> clusterDoorsByLevel,
                Map<Integer, List<Wall>> clusterWallsByLevel
        ) {
            Map<Integer, Set<CellCoord>> componentFloorCellsByLevel = new LinkedHashMap<>();
            Map<Integer, List<Door>> componentDoorsByLevel = new LinkedHashMap<>();
            Map<Integer, List<Wall>> componentWallsByLevel = new LinkedHashMap<>();
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
                List<Wall> levelWalls = clusterWallsByLevel.getOrDefault(levelZ, List.of()).stream()
                        .filter(wall -> wall != null && wall.segments2x().stream()
                                .anyMatch(segment2x -> segment2x.touchingCells().stream().anyMatch(levelComponentCells::contains)))
                        .toList();
                if (!levelWalls.isEmpty()) {
                    componentWallsByLevel.put(levelZ, levelWalls);
                }
            }
            if (componentCellsByLevel.isEmpty()) {
                return null;
            }
            Structure componentStructure = buildClusterStructure(
                    componentCellsByLevel,
                    componentFloorCellsByLevel,
                    componentDoorsByLevel,
                    componentWallsByLevel);
            return new RoomCluster(
                    null,
                    null,
                    originalCluster.mapId(),
                    CellCoord.bestCenter(flattenCells(componentCellsByLevel)),
                    componentStructure,
                    metadataRoomsForComponent(originalCluster.rooms(), componentStructure));
        }

        private static List<Room> metadataRoomsForComponent(List<Room> rooms, Structure componentStructure) {
            if (rooms == null || rooms.isEmpty() || componentStructure == null || componentStructure.levels().isEmpty()) {
                return List.of();
            }
            return rooms.stream()
                    .filter(room -> room != null && roomAnchorsByLevel(room).entrySet().stream()
                            .anyMatch(entry -> componentStructure.surfaceAtLevel(entry.getKey()).contains(entry.getValue())))
                    .sorted(Comparator.comparing(Room::roomId, Comparator.nullsLast(Long::compareTo)))
                    .toList();
        }

        private static Map<Integer, Set<CellCoord>> mutableClusterCellsByLevel(RoomCluster cluster) {
            return mutableCellsByLevel(cluster == null ? Map.of() : surfaceCellsByLevel(cluster.structure()));
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

    public record BoundaryPath(
            List<GridSegment2x> routeEdges,
            Set<GridSegment2x> committedEdges
    ) {
        public BoundaryPath {
            routeEdges = routeEdges == null ? List.of() : List.copyOf(routeEdges);
            committedEdges = committedEdges == null ? Set.of() : Set.copyOf(committedEdges);
        }

        public static BoundaryPath empty() {
            return new BoundaryPath(List.of(), Set.of());
        }

        public boolean hasRoute() {
            return !routeEdges.isEmpty();
        }
    }
}
