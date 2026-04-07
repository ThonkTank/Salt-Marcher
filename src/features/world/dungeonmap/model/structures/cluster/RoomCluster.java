package features.world.dungeonmap.model.structures.cluster;

import features.world.dungeonmap.geometry.GridPoint;
import features.world.dungeonmap.geometry.GridPoint;
import features.world.dungeonmap.geometry.GridBoundary;
import features.world.dungeonmap.geometry.GridPoint;
import features.world.dungeonmap.geometry.GridSegment;
import features.world.dungeonmap.model.interaction.DungeonSelectionRef;
import features.world.dungeonmap.model.interaction.InteractiveLabelHandle;
import features.world.dungeonmap.structure.model.Structure;
import features.world.dungeonmap.structure.model.StructureMutation;
import features.world.dungeonmap.structure.model.StructureSpecification;
import features.world.dungeonmap.structure.model.boundary.StructureBoundary;
import features.world.dungeonmap.structure.model.boundary.door.Door;
import features.world.dungeonmap.structure.model.boundary.door.DoorRef;
import features.world.dungeonmap.structure.model.boundary.wall.Wall;
import features.world.dungeonmap.structure.model.boundary.wall.WallKind;
import features.world.dungeonmap.structure.model.room.StructureRoomTopology;
import features.world.dungeonmap.model.structures.connection.ConnectionEndpoint;
import features.world.dungeonmap.model.structures.connection.ConnectionKind;
import features.world.dungeonmap.model.structures.connection.DoorConnectionCarrier;
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
    private final GridPoint center;
    private final Structure structure;

    public RoomCluster(
            Long clusterId,
            long mapId,
            GridPoint center,
            List<Room> rooms
    ) {
        this(clusterId, null, mapId, center, Structure.empty(), requireExplicitStructure(rooms));
    }

    public RoomCluster(
            Long clusterId,
            long mapId,
            GridPoint center,
            Structure structure,
            List<Room> rooms
    ) {
        this(clusterId, null, mapId, center, structure, rooms);
    }

    public RoomCluster(
            Long clusterId,
            Long structureObjectId,
            long mapId,
            GridPoint center,
            Structure structure,
            List<Room> rooms
    ) {
        this.clusterId = clusterId;
        this.structureObjectId = structureObjectId;
        this.mapId = mapId;
        this.center = center == null ? new GridPoint(0, 0) : center;
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

    public GridPoint center() {
        return center;
    }

    public Structure structure() {
        return structure;
    }

    public RoomCluster projectedToLevel(int levelZ) {
        Structure projectedStructure = structure.projectedToLevel(levelZ);
        StructureRoomTopology projectedTopology = projectedStructure.roomTopology();
        if (projectedStructure == null || projectedStructure.levels().isEmpty() || projectedTopology.rooms().isEmpty()) {
            return null;
        }
        return new RoomCluster(
                clusterId,
                structureObjectId,
                mapId,
                center,
                projectedStructure,
                projectedTopology.rooms());
    }

    public RoomCluster createWallPath(int levelZ, Collection<GridSegment> segments2x) {
        return Topology.editWallPath(this, levelZ, segments2x, false);
    }

    public RoomCluster deleteWallPath(int levelZ, Collection<GridSegment> segments2x) {
        return Topology.editWallPath(this, levelZ, segments2x, true);
    }

    public RoomCluster moveDoor(int levelZ, GridSegment sourceBoundarySegment2x, GridSegment targetBoundarySegment2x) {
        // Door movement stays cluster-owned so SELECT drag and write workflows reuse the same local boundary rules.
        return Topology.moveDoor(this, levelZ, sourceBoundarySegment2x, targetBoundarySegment2x);
    }

    public boolean canCreateDoor(int levelZ, GridSegment boundarySegment2x) {
        // Door eligibility belongs to the cluster owner so editor tools do not become the only source of boundary
        // semantics for local room-to-room connections.
        StructureBoundary boundary = structure.boundaryAtLevel(levelZ);
        if (boundarySegment2x == null
                || boundary.doorAtBoundarySegment(boundarySegment2x) != null) {
            return false;
        }
        Wall effectiveWall = boundary.wallAtBoundarySegment(boundarySegment2x);
        if (!boundary.boundaryEdges().contains(boundarySegment2x)
                || effectiveWall == null
                || !effectiveWall.supportsDoorAttachments()
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

    public boolean canDeleteDoor(int levelZ, GridSegment boundarySegment2x) {
        StructureBoundary boundary = structure.boundaryAtLevel(levelZ);
        return boundarySegment2x != null
                && boundary.isInteriorBoundary(boundarySegment2x)
                && boundary.doorAtBoundarySegment(boundarySegment2x) != null;
    }

    public boolean canCreateExteriorDoor(int levelZ, GridSegment boundarySegment2x) {
        StructureBoundary boundary = structure.boundaryAtLevel(levelZ);
        Wall effectiveWall = boundary.wallAtBoundarySegment(boundarySegment2x);
        return boundarySegment2x != null
                && boundary.boundaryEdges().contains(boundarySegment2x)
                && boundary.doorAtBoundarySegment(boundarySegment2x) == null
                && effectiveWall != null
                && effectiveWall.supportsDoorAttachments()
                && boundary.isExteriorBoundary(boundarySegment2x);
    }

    public boolean canDeleteExteriorDoor(int levelZ, GridSegment boundarySegment2x) {
        StructureBoundary boundary = structure.boundaryAtLevel(levelZ);
        return boundarySegment2x != null
                && boundary.doorAtBoundarySegment(boundarySegment2x) != null
                && boundary.isExteriorBoundary(boundarySegment2x);
    }

    public RoomCluster withDoorSegments(int levelZ, Collection<GridSegment> segments2x, boolean deleteDoor) {
        return Topology.editDoors(this, levelZ, segments2x, deleteDoor, false);
    }

    public RoomCluster withExteriorDoors(int levelZ, Collection<GridSegment> segments2x, boolean deleteDoor) {
        return Topology.editDoors(this, levelZ, segments2x, deleteDoor, true);
    }

    public InteractiveLabelHandle labelHandle() {
        return new InteractiveLabelHandle(
                new DungeonSelectionRef.ClusterRef(clusterId),
                clusterId == null ? "Cluster" : "Cluster " + clusterId,
                GridPoint.cell(center));
    }

    public boolean overlapsCells(Collection<GridPoint> candidateCells) {
        Set<GridPoint> clusterCells = Topology.projectedSurfaceCells(structure);
        if (candidateCells == null || candidateCells.isEmpty() || clusterCells.isEmpty()) {
            return false;
        }
        for (GridPoint cell : candidateCells) {
            if (cell != null && clusterCells.contains(cell)) {
                return true;
            }
        }
        return false;
    }

    public RoomCluster movedBy(GridPoint delta) {
        return movedBy(delta, 0);
    }

    public RoomCluster movedBy(GridPoint delta, int levelDelta) {
        boolean translate = delta != null && (delta.x() != 0 || delta.y() != 0);
        if (!translate && levelDelta == 0) {
            return this;
        }
        GridPoint resolvedDelta = delta == null ? new GridPoint(0, 0) : delta;
        Structure movedStructure = structure.mutated(new StructureMutation.Translation(resolvedDelta, levelDelta));
        return new RoomCluster(
                clusterId,
                structureObjectId,
                mapId,
                center.add(resolvedDelta),
                movedStructure,
                movedStructure.roomTopology().rooms());
    }

    public BoundaryPath findCreateWallPath(GridPoint start, GridPoint goal) {
        if (start == null || goal == null) {
            return BoundaryPath.empty();
        }
        int levelZ = primaryLevel();
        List<GridSegment> route = structure.boundaryAtLevel(levelZ).findCreatableWallPath(start, goal);
        if (route.isEmpty()) {
            return BoundaryPath.empty();
        }
        return new BoundaryPath(route, new LinkedHashSet<>(route));
    }

    public BoundaryPath findDeleteWallPath(GridPoint start, GridPoint goal) {
        if (start == null || goal == null) {
            return BoundaryPath.empty();
        }
        int levelZ = primaryLevel();
        List<GridSegment> route = structure.boundaryAtLevel(levelZ).findDeletableWallPath(start, goal);
        if (route.isEmpty()) {
            return BoundaryPath.empty();
        }
        return new BoundaryPath(route, new LinkedHashSet<>(route));
    }

    public boolean touchesExistingWall(GridPoint vertex) {
        return structure.boundaryAtLevel(primaryLevel()).touchesBoundaryVertex(vertex);
    }

    public boolean isEditableWallVertex(GridPoint vertex, boolean deleteMode) {
        return structure.boundaryAtLevel(primaryLevel()).isEditableWallVertex(vertex, deleteMode);
    }

    public int primaryLevel() {
        return structure.levels().stream()
                .mapToInt(Integer::intValue)
                .min()
                .orElse(0);
    }

    public Set<GridSegment> outerBoundarySegments2x() {
        LinkedHashSet<GridSegment> result = new LinkedHashSet<>();
        for (Integer levelZ : structure.levels().stream().sorted().toList()) {
            result.addAll(structure.boundaryAtLevel(levelZ).exteriorBoundaryEdges());
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    public boolean contains(GridPoint cell, int levelZ) {
        return roomAt(cell, levelZ) != null;
    }

    private StructureRoomTopology roomTopology() {
        return structure.roomTopology();
    }

    private List<Room> rooms() {
        return roomTopology().rooms();
    }

    private Structure roomStructure(Room room) {
        return roomTopology().structureFor(room);
    }

    private Set<Integer> roomLevels(Room room) {
        return roomTopology().roomLevels(room);
    }

    private Room roomAt(GridPoint cell) {
        return cell == null ? null : roomAt(cell, primaryLevel());
    }

    private Room roomAt(GridPoint cell, int levelZ) {
        return cell == null ? null : roomTopology().roomAt(cell, levelZ);
    }

    private static List<Room> requireExplicitStructure(List<Room> rooms) {
        List<Room> resolvedRooms = rooms == null ? List.of() : List.copyOf(rooms);
        if (!resolvedRooms.isEmpty()) {
            throw new IllegalArgumentException("RoomCluster requires explicit structure when rooms are present");
        }
        return resolvedRooms;
    }

    private static RoomPair roomPairAtLevel(RoomCluster cluster, GridSegment segment2x, int levelZ) {
        if (cluster == null || segment2x == null) {
            return null;
        }
        List<GridPoint> touchingCells = segment2x.touchingCells().stream()
                .sorted(GridPoint.ORDER)
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

    private static Structure normalizeClusterStructure(Structure structure, List<Room> rooms) {
        if (structure != null && !structure.levels().isEmpty()) {
            return structure;
        }
        if (rooms == null || rooms.isEmpty()) {
            return Structure.empty();
        }
        throw new IllegalArgumentException("RoomCluster requires explicit structure when rooms are present");
    }

    private static final class Topology {

        private Topology() {
        }

        static RoomCluster applyPaint(RoomCluster cluster, Set<GridPoint> paintCells, List<RoomCluster> overlappingClusters, int paintLevel) {
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

            Map<Integer, Set<GridPoint>> mergedClusterCellsByLevel = new LinkedHashMap<>();
            Map<Integer, Set<GridPoint>> mergedClusterFloorCellsByLevel = new LinkedHashMap<>();
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
            Map<Integer, Set<GridPoint>> previousClusterCellsByLevel = immutableCellsByLevel(mergedClusterCellsByLevel);
            mergedClusterCellsByLevel.computeIfAbsent(paintLevel, ignored -> new LinkedHashSet<>()).addAll(paintCells);
            mergedClusterFloorCellsByLevel.computeIfAbsent(paintLevel, ignored -> new LinkedHashSet<>()).addAll(paintCells);

            Structure mergedStructure = buildClusterStructure(
                    mergedClusterCellsByLevel,
                    mergedClusterFloorCellsByLevel,
                    mergedDoorsByLevel,
                    mergedWallsByLevel,
                    previousClusterCellsByLevel);
            return new RoomCluster(
                    cluster.clusterId(),
                    cluster.structureObjectId(),
                    cluster.mapId(),
                    GridPoint.bestCenter(flattenCells(mergedClusterCellsByLevel)),
                    mergedStructure,
                    normalizedMetadataRooms(mergedMetadataRooms));
        }

        static List<RoomCluster> applyDelete(RoomCluster cluster, Set<GridPoint> deletedCells, int deleteLevel) {
            if (cluster == null || deletedCells == null || deletedCells.isEmpty()) {
                return null;
            }
            Map<Integer, Set<GridPoint>> remainingCellsByLevel = mutableClusterCellsByLevel(cluster);
            Set<GridPoint> remainingDeleteLevelCells = new LinkedHashSet<>(remainingCellsByLevel.getOrDefault(deleteLevel, Set.of()));
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

            Map<Integer, Set<GridPoint>> remainingFloorCellsByLevel = mutableCellsByLevel(copyStructureFloorCellsByLevel(cluster.structure()));
            Set<GridPoint> remainingDeleteLevelFloorCells = new LinkedHashSet<>(remainingFloorCellsByLevel.getOrDefault(deleteLevel, Set.of()));
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
                    wallsByLevel(cluster.structure()),
                    copyStructureSurfaceCellsByLevel(cluster.structure()));
            List<RoomCluster> componentClusters = splitDeletedCluster(cluster, rewrittenStructure);
            if (componentClusters.isEmpty()) {
                return List.of();
            }
            ArrayList<RoomCluster> finalClusters = new ArrayList<>(componentClusters.size());
            finalClusters.add(new RoomCluster(
                    cluster.clusterId(),
                    componentClusters.getFirst().structureObjectId(),
                    componentClusters.getFirst().mapId(),
                    componentClusters.getFirst().center(),
                    componentClusters.getFirst().structure(),
                    componentClusters.getFirst().structure().roomTopology().rooms().stream()
                            .map(room -> room == null ? null : room.withClusterId(cluster.clusterId() == null ? 0L : cluster.clusterId()))
                            .toList()));
            finalClusters.addAll(componentClusters.stream().skip(1).toList());
            return List.copyOf(finalClusters);
        }

        static RoomCluster editWallPath(
                RoomCluster cluster,
                int levelZ,
                Collection<GridSegment> segments2x,
                boolean deleteWall
        ) {
            if (cluster == null || segments2x == null || segments2x.isEmpty()) {
                return null;
            }
            List<GridSegment> editedSegments = segments2x.stream()
                    .filter(Objects::nonNull)
                    .filter(segment2x -> cluster.structure().boundaryAtLevel(levelZ).interiorAdjacencyEdges().contains(segment2x))
                    .filter(segment2x -> {
                        RoomPair roomPair = roomPairAtLevel(cluster, segment2x, levelZ);
                        return roomPair != null && !sameRoomId(roomPair.left(), roomPair.right());
                    })
                    .sorted(GridSegment.ORDER)
                    .toList();
            if (editedSegments.isEmpty()) {
                return null;
            }
            Structure updatedStructure = cluster.structure().mutated(new StructureMutation.WallPathEdit(
                    levelZ,
                    editedSegments,
                    deleteWall ? StructureMutation.BoundaryEditMode.DELETE : StructureMutation.BoundaryEditMode.CREATE));
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
                Collection<GridSegment> segments2x,
                boolean deleteDoor,
                boolean exteriorDoor
        ) {
            if (cluster == null || segments2x == null || segments2x.isEmpty()) {
                return null;
            }
            List<GridSegment> editableSegments = deleteDoor
                    ? deletedEditableSegments(cluster, levelZ, segments2x, exteriorDoor)
                    : createdEditableSegments(cluster, levelZ, segments2x, exteriorDoor);
            if (editableSegments.isEmpty()) {
                return null;
            }
            Structure updatedStructure = cluster.structure().mutated(new StructureMutation.DoorSegmentsEdit(
                    levelZ,
                    editableSegments,
                    deleteDoor ? StructureMutation.BoundaryEditMode.DELETE : StructureMutation.BoundaryEditMode.CREATE));
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
                GridSegment sourceBoundarySegment2x,
                GridSegment targetBoundarySegment2x
        ) {
            if (cluster == null
                    || sourceBoundarySegment2x == null
                    || targetBoundarySegment2x == null
                    || Objects.equals(sourceBoundarySegment2x, targetBoundarySegment2x)
                    || !cluster.canDeleteDoor(levelZ, sourceBoundarySegment2x)
                    || !cluster.canCreateDoor(levelZ, targetBoundarySegment2x)) {
                return null;
            }
            Structure updatedStructure = cluster.structure().mutated(new StructureMutation.DoorMove(
                    levelZ,
                    sourceBoundarySegment2x,
                    targetBoundarySegment2x));
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

        private static List<GridSegment> createdEditableSegments(
                RoomCluster cluster,
                int levelZ,
                Collection<GridSegment> segments2x,
                boolean exteriorDoor
        ) {
            return (segments2x == null ? List.<GridSegment>of() : segments2x).stream()
                    .filter(Objects::nonNull)
                    .filter(segment2x -> exteriorDoor
                            ? cluster.canCreateExteriorDoor(levelZ, segment2x)
                            : cluster.canCreateDoor(levelZ, segment2x))
                    .toList();
        }

        private static List<GridSegment> deletedEditableSegments(
                RoomCluster cluster,
                int levelZ,
                Collection<GridSegment> segments2x,
                boolean exteriorDoor
        ) {
            return (segments2x == null ? List.<GridSegment>of() : segments2x).stream()
                    .filter(Objects::nonNull)
                    .filter(segment2x -> exteriorDoor
                            ? cluster.canDeleteExteriorDoor(levelZ, segment2x)
                            : cluster.canDeleteDoor(levelZ, segment2x))
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

        private static boolean isInternalSegment(Set<GridPoint> clusterCells, GridSegment segment2x) {
            Set<GridPoint> touchingCells = segment2x == null ? Set.of() : segment2x.touchingCells();
            return touchingCells.size() == 2 && clusterCells.containsAll(touchingCells);
        }

        private static boolean sameRoomId(Room left, Room right) {
            return left != null
                    && right != null
                    && left.roomId() != null
                    && left.roomId().equals(right.roomId());
        }

        private static boolean disjoint(Set<GridPoint> left, Set<GridPoint> right) {
            for (GridPoint point : left) {
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

        private static boolean overlapsAtLevel(RoomCluster cluster, Room room, Set<GridPoint> paintCells, int levelZ) {
            if (room == null || paintCells == null || paintCells.isEmpty()) {
                return false;
            }
            return !disjoint(cluster.roomStructure(room).surfaceAtLevel(levelZ).surface().cellCoords(), paintCells);
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

        private static Map<Integer, Set<GridPoint>> copyStructureSurfaceCellsByLevel(Structure structure) {
            if (structure == null || structure.levels().isEmpty()) {
                return Map.of();
            }
            Map<Integer, Set<GridPoint>> result = new LinkedHashMap<>();
            for (Integer levelZ : structure.levels().stream().sorted().toList()) {
                Set<GridPoint> levelCells = structure.surfaceAtLevel(levelZ).surface().cellCoords();
                if (!levelCells.isEmpty()) {
                    result.put(levelZ, levelCells);
                }
            }
            return result.isEmpty() ? Map.of() : Map.copyOf(result);
        }

        private static Map<Integer, Set<GridPoint>> copyStructureFloorCellsByLevel(Structure structure) {
            if (structure == null || structure.levels().isEmpty()) {
                return Map.of();
            }
            Map<Integer, Set<GridPoint>> result = new LinkedHashMap<>();
            for (Integer levelZ : structure.levels().stream().sorted().toList()) {
                Set<GridPoint> floorCells = structure.surfaceAtLevel(levelZ).floor().cellCoords();
                if (!floorCells.isEmpty()) {
                    result.put(levelZ, floorCells);
                }
            }
            return result.isEmpty() ? Map.of() : Map.copyOf(result);
        }

        private static List<Map<Integer, Set<GridPoint>>> splitProjectedSurfaceIntoComponents(Structure structure) {
            if (structure == null || structure.levels().isEmpty()) {
                return List.of();
            }
            Set<GridPoint> projectedCells = projectedSurfaceCells(structure);
            if (projectedCells.isEmpty()) {
                return List.of();
            }
            List<Set<GridPoint>> components = connectedProjectedCellComponents(projectedCells);
            ArrayList<Map<Integer, Set<GridPoint>>> result = new ArrayList<>(components.size());
            for (Set<GridPoint> component : components) {
                Map<Integer, Set<GridPoint>> componentByLevel = new LinkedHashMap<>();
                for (Integer levelZ : structure.levels().stream().sorted().toList()) {
                    Set<GridPoint> levelCells = intersectCells(structure.surfaceAtLevel(levelZ).surface().cellCoords(), component);
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

        private static Set<GridPoint> projectedSurfaceCells(Structure structure) {
            if (structure == null || structure.levels().isEmpty()) {
                return Set.of();
            }
            LinkedHashSet<GridPoint> result = new LinkedHashSet<>();
            for (Integer levelZ : structure.levels().stream().sorted().toList()) {
                result.addAll(structure.surfaceAtLevel(levelZ).surface().cellCoords());
            }
            return result.isEmpty() ? Set.of() : Set.copyOf(result);
        }

        private static List<Set<GridPoint>> connectedProjectedCellComponents(Collection<GridPoint> cells) {
            Set<GridPoint> remaining = GridPoint.normalize(cells);
            if (remaining.isEmpty()) {
                return List.of();
            }
            ArrayList<Set<GridPoint>> components = new ArrayList<>();
            LinkedHashSet<GridPoint> unvisited = new LinkedHashSet<>(remaining);
            while (!unvisited.isEmpty()) {
                GridPoint seed = unvisited.iterator().next();
                ArrayDeque<GridPoint> queue = new ArrayDeque<>();
                LinkedHashSet<GridPoint> component = new LinkedHashSet<>();
                queue.add(seed);
                unvisited.remove(seed);
                while (!queue.isEmpty()) {
                    GridPoint current = queue.removeFirst();
                    if (!component.add(current)) {
                        continue;
                    }
                    for (GridPoint step : GridPoint.CARDINAL_STEPS) {
                        GridPoint neighbor = current.add(step);
                        if (unvisited.remove(neighbor)) {
                            queue.addLast(neighbor);
                        }
                    }
                }
                components.add(Set.copyOf(component));
            }
            return components.isEmpty() ? List.of() : List.copyOf(components);
        }

        private static void mergeClusterCellsByLevel(Map<Integer, Set<GridPoint>> result, Structure structure) {
            if (result == null || structure == null) {
                return;
            }
            for (Map.Entry<Integer, Set<GridPoint>> entry : copyStructureSurfaceCellsByLevel(structure).entrySet()) {
                result.computeIfAbsent(entry.getKey(), ignored -> new LinkedHashSet<>()).addAll(entry.getValue());
            }
        }

        private static void mergeClusterFloorCellsByLevel(Map<Integer, Set<GridPoint>> result, Structure structure) {
            if (result == null || structure == null) {
                return;
            }
            for (Map.Entry<Integer, Set<GridPoint>> entry : copyStructureFloorCellsByLevel(structure).entrySet()) {
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
                List<Wall> walls = structure.boundaryAtLevel(levelZ).walls();
                if (!walls.isEmpty()) {
                    result.put(levelZ, walls);
                }
            }
            return result.isEmpty() ? Map.of() : Map.copyOf(result);
        }

        private static Structure buildClusterStructure(
                Map<Integer, Set<GridPoint>> cellsByLevel,
                Map<Integer, Set<GridPoint>> floorCellsByLevel,
                Map<Integer, List<Door>> doorsByLevel,
                Map<Integer, List<Wall>> wallsByLevel
        ) {
            return buildClusterStructure(cellsByLevel, floorCellsByLevel, doorsByLevel, wallsByLevel, null);
        }

        private static Structure buildClusterStructure(
                Map<Integer, Set<GridPoint>> cellsByLevel,
                Map<Integer, Set<GridPoint>> floorCellsByLevel,
                Map<Integer, List<Door>> doorsByLevel,
                Map<Integer, List<Wall>> wallsByLevel,
                Map<Integer, Set<GridPoint>> previousCellsByLevel
        ) {
            Map<Integer, Set<GridPoint>> normalizedCellsByLevel = immutableCellsByLevel(cellsByLevel);
            if (normalizedCellsByLevel.isEmpty()) {
                return Structure.empty();
            }
            Map<Integer, Set<GridPoint>> normalizedFloorCellsByLevel = immutableFloorCellsByLevel(floorCellsByLevel);
            Map<Integer, StructureSpecification.LevelSpecification> levelsByZ = new LinkedHashMap<>();
            for (Map.Entry<Integer, Set<GridPoint>> entry : normalizedCellsByLevel.entrySet()) {
                Integer levelZ = entry.getKey();
                Set<GridPoint> levelCells = entry.getValue();
                if (levelZ == null || levelCells == null || levelCells.isEmpty()) {
                    continue;
                }
                List<Wall> levelWalls = wallsByLevel == null ? List.of() : wallsByLevel.getOrDefault(levelZ, List.of());
                List<Door> levelDoors = doorsByLevel == null ? List.of() : doorsByLevel.getOrDefault(levelZ, List.of());
                StructureBoundary boundary = previousCellsByLevel == null
                        ? StructureBoundary.fromSurfaceAndFeatures(levelCells, levelDoors, levelWalls)
                        : StructureBoundary.rewrittenForSurface(
                        previousCellsByLevel.getOrDefault(levelZ, Set.of()),
                        levelCells,
                        levelDoors,
                        levelWalls);
                levelsByZ.put(levelZ, StructureSpecification.LevelSpecification.of(
                        GridPoint.bestCenter(levelCells),
                        levelCells,
                        normalizedFloorCellsByLevel.getOrDefault(levelZ, Set.of()),
                        boundary.doors(),
                        boundary.walls()));
            }
            return Structure.fromSpecification(new StructureSpecification(levelsByZ));
        }

        private static List<RoomCluster> splitDeletedCluster(RoomCluster originalCluster, Structure rewrittenStructure) {
            if (originalCluster == null || rewrittenStructure == null || rewrittenStructure.levels().isEmpty()) {
                return List.of();
            }
            Map<Integer, List<Door>> doorsByLevel = doorsByLevel(rewrittenStructure);
            Map<Integer, List<Wall>> wallsByLevel = wallsByLevel(rewrittenStructure);
            List<Map<Integer, Set<GridPoint>>> projectedComponents = splitProjectedSurfaceIntoComponents(rewrittenStructure);
            if (projectedComponents.isEmpty()) {
                return List.of();
            }
            return projectedComponents.stream()
                    .sorted(Comparator
                            .comparing((Map<Integer, Set<GridPoint>> component) -> !flattenCells(component).contains(originalCluster.center()))
                            .thenComparingInt(component -> GridPoint.bestCenter(flattenCells(component)).manhattanDistance(originalCluster.center()))
                            .thenComparing(component -> GridPoint.bestCenter(flattenCells(component)), GridPoint.ORDER))
                    .map(componentCellsByLevel -> componentCluster(
                            originalCluster,
                            componentCellsByLevel,
                            copyStructureFloorCellsByLevel(rewrittenStructure),
                            doorsByLevel,
                            wallsByLevel))
                    .filter(Objects::nonNull)
                    .toList();
        }

        private static RoomCluster componentCluster(
                RoomCluster originalCluster,
                Map<Integer, Set<GridPoint>> componentCellsByLevel,
                Map<Integer, Set<GridPoint>> clusterFloorCellsByLevel,
                Map<Integer, List<Door>> clusterDoorsByLevel,
                Map<Integer, List<Wall>> clusterWallsByLevel
        ) {
            Map<Integer, Set<GridPoint>> componentFloorCellsByLevel = new LinkedHashMap<>();
            Map<Integer, List<Door>> componentDoorsByLevel = new LinkedHashMap<>();
            Map<Integer, List<Wall>> componentWallsByLevel = new LinkedHashMap<>();
            for (Map.Entry<Integer, Set<GridPoint>> entry : componentCellsByLevel.entrySet()) {
                Integer levelZ = entry.getKey();
                Set<GridPoint> levelComponentCells = entry.getValue();
                if (levelComponentCells.isEmpty()) {
                    continue;
                }
                Set<GridPoint> levelFloorCells = intersectCells(clusterFloorCellsByLevel.get(levelZ), levelComponentCells);
                componentFloorCellsByLevel.put(levelZ, levelFloorCells);
                List<Door> levelDoors = clusterDoorsByLevel.getOrDefault(levelZ, List.of()).stream()
                        .filter(door -> door != null && door.touchesAnyCell(levelComponentCells))
                        .toList();
                if (!levelDoors.isEmpty()) {
                    componentDoorsByLevel.put(levelZ, levelDoors);
                }
                List<Wall> levelWalls = clusterWallsByLevel.getOrDefault(levelZ, List.of()).stream()
                        .filter(wall -> wall != null && wall.touchesAnyCell(levelComponentCells))
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
                    GridPoint.bestCenter(flattenCells(componentCellsByLevel)),
                    componentStructure,
                    metadataRoomsForComponent(originalCluster.rooms(), componentStructure));
        }

        private static List<Room> metadataRoomsForComponent(List<Room> rooms, Structure componentStructure) {
            if (rooms == null || rooms.isEmpty() || componentStructure == null || componentStructure.levels().isEmpty()) {
                return List.of();
            }
            return rooms.stream()
                    .filter(room -> room != null && roomAnchorsByLevel(room).entrySet().stream()
                            .anyMatch(entry -> componentStructure.surfaceAtLevel(entry.getKey()).surface().contains(entry.getValue())))
                    .sorted(Comparator.comparing(Room::roomId, Comparator.nullsLast(Long::compareTo)))
                    .toList();
        }

        private static Map<Integer, Set<GridPoint>> mutableClusterCellsByLevel(RoomCluster cluster) {
            return mutableCellsByLevel(cluster == null ? Map.of() : copyStructureSurfaceCellsByLevel(cluster.structure()));
        }

        private static Set<GridPoint> flattenCells(Map<Integer, Set<GridPoint>> cellsByLevel) {
            LinkedHashSet<GridPoint> result = new LinkedHashSet<>();
            for (Set<GridPoint> cells : cellsByLevel.values()) {
                result.addAll(cells);
            }
            return result.isEmpty() ? Set.of() : Set.copyOf(result);
        }

        private static Map<Integer, GridPoint> roomAnchorsByLevel(Room room) {
            return room == null ? Map.of() : room.anchorsByLevel();
        }

        private static Map<Integer, Set<GridPoint>> mutableCellsByLevel(Map<Integer, Set<GridPoint>> source) {
            Map<Integer, Set<GridPoint>> result = new LinkedHashMap<>();
            for (Map.Entry<Integer, Set<GridPoint>> entry : source.entrySet()) {
                result.put(entry.getKey(), new LinkedHashSet<>(entry.getValue()));
            }
            return result;
        }

        private static Map<Integer, Set<GridPoint>> immutableCellsByLevel(Map<Integer, Set<GridPoint>> source) {
            if (source == null || source.isEmpty()) {
                return Map.of();
            }
            Map<Integer, Set<GridPoint>> result = new LinkedHashMap<>();
            source.entrySet().stream()
                    .filter(entry -> entry != null && entry.getKey() != null)
                    .sorted(Map.Entry.comparingByKey())
                    .forEach(entry -> {
                        Set<GridPoint> cells = normalizeCells(entry.getValue());
                        if (!cells.isEmpty()) {
                            result.put(entry.getKey(), cells);
                        }
                    });
            return result.isEmpty() ? Map.of() : Map.copyOf(result);
        }

        private static Set<GridPoint> normalizeCells(Collection<GridPoint> input) {
            return GridPoint.normalize(input);
        }

        private static GridPoint anchorCell(Set<GridPoint> roomCells, GridPoint preferredAnchor) {
            return preferredAnchor != null && roomCells.contains(preferredAnchor)
                    ? preferredAnchor
                    : GridPoint.bestCenter(roomCells);
        }

        private static Set<GridPoint> intersectCells(Set<GridPoint> left, Set<GridPoint> right) {
            if (left == null || left.isEmpty() || right == null || right.isEmpty()) {
                return Set.of();
            }
            LinkedHashSet<GridPoint> result = new LinkedHashSet<>();
            for (GridPoint cell : left) {
                if (right.contains(cell)) {
                    result.add(cell);
                }
            }
            return result.isEmpty() ? Set.of() : Set.copyOf(result);
        }

        private static boolean contains(Set<GridPoint> cells, GridPoint cell) {
            return cell != null && cells != null && cells.contains(cell);
        }

        private static Map<Integer, Set<GridPoint>> immutableFloorCellsByLevel(Map<Integer, Set<GridPoint>> source) {
            if (source == null || source.isEmpty()) {
                return Map.of();
            }
            Map<Integer, Set<GridPoint>> result = new LinkedHashMap<>();
            source.entrySet().stream()
                    .filter(entry -> entry != null && entry.getKey() != null && entry.getValue() != null)
                    .sorted(Map.Entry.comparingByKey())
                    .forEach(entry -> result.put(entry.getKey(), normalizeCells(entry.getValue())));
            return result.isEmpty() ? Map.of() : Map.copyOf(result);
        }
    }

    public record BoundaryPath(
            List<GridSegment> routeEdges,
            Set<GridSegment> committedEdges
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
