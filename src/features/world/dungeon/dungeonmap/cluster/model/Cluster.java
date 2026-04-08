package features.world.dungeon.dungeonmap.cluster.model;

import features.world.dungeon.geometry.GridArea;
import features.world.dungeon.geometry.GridBoundary;
import features.world.dungeon.geometry.GridPoint;
import features.world.dungeon.geometry.GridSegment;
import features.world.dungeon.geometry.GridSegmentPath;
import features.world.dungeon.geometry.GridTranslation;
import features.world.dungeon.model.interaction.DungeonSelectionRef;
import features.world.dungeon.model.interaction.InteractiveLabelHandle;
import features.world.dungeon.dungeonmap.structure.model.Structure;
import features.world.dungeon.dungeonmap.structure.model.StructureMutation;
import features.world.dungeon.dungeonmap.structure.model.boundary.StructureBoundary;
import features.world.dungeon.dungeonmap.structure.model.boundary.door.Door;
import features.world.dungeon.dungeonmap.structure.model.boundary.wall.Wall;
import features.world.dungeon.dungeonmap.structure.model.room.StructureRoomTopology;
import features.world.dungeon.model.structures.connection.ConnectionEndpoint;
import features.world.dungeon.model.structures.connection.ConnectionKind;
import features.world.dungeon.model.structures.connection.DoorConnectionCarrier;
import features.world.dungeon.model.structures.room.Room;
import features.world.dungeon.model.structures.room.RoomNarration;

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

public final class Cluster extends Structure {

    private final Long clusterId;
    private final Long structureObjectId;
    private final long mapId;
    private final GridPoint center;

    public static Cluster fromDefinition(ClusterDefinitionRequest definition) {
        ClusterDefinitionRequest resolvedDefinition = Objects.requireNonNull(definition, "definition");
        return new Cluster(resolvedDefinition, resolveClusterBase(
                resolvedDefinition.clusterId(),
                resolvedDefinition.mapId(),
                resolvedDefinition.structure(),
                resolvedDefinition.rooms()));
    }

    private Cluster(
            ClusterDefinitionRequest definition,
            Map<Integer, Structure.LevelStructure> levelsByZ,
            StructureRoomTopology roomTopology
    ) {
        super(levelsByZ, roomTopology);
        ClusterDefinitionRequest resolvedDefinition = Objects.requireNonNull(definition, "definition");
        this.clusterId = resolvedDefinition.clusterId();
        this.structureObjectId = resolvedDefinition.structureObjectId();
        this.mapId = resolvedDefinition.mapId();
        this.center = Topology.derivedCenter(levelsByZ);
    }

    private Cluster(
            ClusterDefinitionRequest definition,
            ClusterBase base
    ) {
        super(base.structure(), base.roomTopology());
        ClusterDefinitionRequest resolvedDefinition = Objects.requireNonNull(definition, "definition");
        this.clusterId = resolvedDefinition.clusterId();
        this.structureObjectId = resolvedDefinition.structureObjectId();
        this.mapId = resolvedDefinition.mapId();
        this.center = Topology.derivedCenter(base.structure());
    }

    @Override
    protected Cluster recreate(
            Map<Integer, Structure.LevelStructure> levelsByZ,
            StructureRoomTopology roomTopology
    ) {
        return new Cluster(definitionRequest(), levelsByZ, roomTopology);
    }

    private ClusterDefinitionRequest definitionRequest() {
        return new ClusterDefinitionRequest(clusterId, structureObjectId, mapId, this, roomTopology().rooms());
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

    public Cluster projectedToLevel(int levelZ) {
        Structure projectedStructure = super.projectedToLevel(levelZ);
        StructureRoomTopology projectedTopology = projectedStructure.roomTopology();
        if (projectedStructure == null || projectedStructure.levels().isEmpty() || projectedTopology.rooms().isEmpty()) {
            return null;
        }
        return fromDefinition(new ClusterDefinitionRequest(
                clusterId,
                structureObjectId,
                mapId,
                projectedStructure,
                projectedTopology.rooms()));
    }

    public ClusterRewritePlan rewritePaint(ClusterPaintRequest request) {
        return ClusterStructureEditor.applyPaint(this, request);
    }

    public ClusterRewritePlan rewriteDelete(ClusterDeleteRequest request) {
        return ClusterStructureEditor.applyDelete(this, request);
    }

    /**
     * Public cluster mutations converge here so the same room-cluster rewrite is applied consistently regardless of
     * which editor workflow requested it.
     */
    public Cluster mutated(ClusterMutationRequest mutation) {
        if (mutation == null) {
            return this;
        }
        return switch (mutation) {
            case ClusterMutationRequest.Translation edit -> translated(edit.translation());
            case ClusterMutationRequest.FloorCellsEdit edit -> mutatedFloorCells(edit);
            case ClusterMutationRequest.WallPathEdit edit -> mutatedWallPath(edit);
            case ClusterMutationRequest.DoorSegmentsEdit edit -> mutatedDoorSegments(edit);
            case ClusterMutationRequest.DoorMove edit -> movedDoor(edit);
        };
    }

    public boolean canCreateDoor(int levelZ, GridSegment boundarySegment) {
        // Door eligibility belongs to the cluster owner so editor tools do not become the only source of boundary
        // semantics for local room-to-room connections.
        StructureBoundary boundary = boundaryAtLevel(levelZ);
        if (boundarySegment == null
                || boundary.doorAtBoundarySegment(boundarySegment) != null) {
            return false;
        }
        Wall effectiveWall = boundary.wallAtBoundarySegment(boundarySegment);
        if (!boundary.boundary().contains(boundarySegment)
                || effectiveWall == null
                || !effectiveWall.supportsDoorAttachments()
                || !boundary.isInteriorBoundary(boundarySegment)) {
            return false;
        }
        RoomPair roomPair = roomPairAtLevel(this, boundarySegment, levelZ);
        return roomPair != null
                && roomPair.left() != null
                && roomPair.right() != null
                && roomPair.left().roomId() != null
                && roomPair.right().roomId() != null
                && !roomPair.left().roomId().equals(roomPair.right().roomId());
    }

    public boolean canDeleteDoor(int levelZ, GridSegment boundarySegment) {
        StructureBoundary boundary = boundaryAtLevel(levelZ);
        return boundarySegment != null
                && boundary.isInteriorBoundary(boundarySegment)
                && boundary.doorAtBoundarySegment(boundarySegment) != null;
    }

    public boolean canCreateExteriorDoor(int levelZ, GridSegment boundarySegment) {
        StructureBoundary boundary = boundaryAtLevel(levelZ);
        Wall effectiveWall = boundary.wallAtBoundarySegment(boundarySegment);
        return boundarySegment != null
                && boundary.boundary().contains(boundarySegment)
                && boundary.doorAtBoundarySegment(boundarySegment) == null
                && effectiveWall != null
                && effectiveWall.supportsDoorAttachments()
                && boundary.isExteriorBoundary(boundarySegment);
    }

    public boolean canDeleteExteriorDoor(int levelZ, GridSegment boundarySegment) {
        StructureBoundary boundary = boundaryAtLevel(levelZ);
        return boundarySegment != null
                && boundary.doorAtBoundarySegment(boundarySegment) != null
                && boundary.isExteriorBoundary(boundarySegment);
    }

    public InteractiveLabelHandle labelHandle() {
        return new InteractiveLabelHandle(
                new DungeonSelectionRef.ClusterRef(clusterId),
                clusterId == null ? "Cluster" : "Cluster " + clusterId,
                center);
    }

    public boolean overlapsCells(GridArea candidateCells) {
        Set<GridPoint> clusterCells = Topology.projectedSurfaceCells(this);
        if (candidateCells == null || candidateCells.isEmpty() || clusterCells.isEmpty()) {
            return false;
        }
        for (GridPoint cell : candidateCells.cells()) {
            if (cell != null && clusterCells.contains(cell)) {
                return true;
            }
        }
        return false;
    }

    private Cluster translated(GridTranslation translation) {
        GridTranslation resolvedTranslation = translation == null ? GridTranslation.none() : translation;
        if (resolvedTranslation.isZero()) {
            return this;
        }
        Structure movedStructure = super.mutated(new StructureMutation.Translation(resolvedTranslation));
        return fromDefinition(new ClusterDefinitionRequest(
                clusterId,
                structureObjectId,
                mapId,
                movedStructure,
                movedStructure.roomTopology().rooms()));
    }

    public GridSegmentPath findCreateWallPath(GridPoint start, GridPoint goal) {
        if (start == null || goal == null) {
            return GridSegmentPath.empty();
        }
        int levelZ = primaryLevel();
        return boundaryAtLevel(levelZ).findCreatableWallPath(start, goal);
    }

    public GridSegmentPath findDeleteWallPath(GridPoint start, GridPoint goal) {
        if (start == null || goal == null) {
            return GridSegmentPath.empty();
        }
        int levelZ = primaryLevel();
        return boundaryAtLevel(levelZ).findDeletableWallPath(start, goal);
    }

    public boolean touchesExistingWall(GridPoint vertex) {
        return boundaryAtLevel(primaryLevel()).touchesBoundaryVertex(vertex);
    }

    public boolean isEditableWallVertex(GridPoint vertex, boolean deleteMode) {
        return boundaryAtLevel(primaryLevel()).isEditableWallVertex(vertex, deleteMode);
    }

    public int primaryLevel() {
        return super.primaryLevel();
    }

    public GridBoundary outerBoundary() {
        LinkedHashSet<GridSegment> result = new LinkedHashSet<>();
        for (Integer levelZ : levels().stream().sorted().toList()) {
            result.addAll(boundaryAtLevel(levelZ).exteriorBoundary().segments());
        }
        return result.isEmpty() ? GridBoundary.empty() : GridBoundary.of(result);
    }

    public boolean contains(GridPoint cell, int levelZ) {
        return roomAt(cell, levelZ) != null;
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

    private static RoomPair roomPairAtLevel(Cluster cluster, GridSegment segment, int levelZ) {
        if (cluster == null || segment == null) {
            return null;
        }
        List<GridPoint> touchingCells = segment.cellFootprint().cells().stream()
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
        throw new IllegalArgumentException("Cluster requires explicit structure when rooms are present");
    }

    private static ClusterBase resolveClusterBase(Long clusterId, long mapId, Structure structure, List<Room> rooms) {
        Structure normalizedStructure = normalizeClusterStructure(structure, rooms);
        List<Room> normalizedRooms = rooms == null ? List.of() : List.copyOf(rooms);
        StructureRoomTopology roomTopology = normalizedStructure.levels().isEmpty()
                ? StructureRoomTopology.empty()
                : StructureRoomTopology.derive(mapId, clusterId, normalizedStructure, normalizedRooms);
        return new ClusterBase(normalizedStructure, roomTopology);
    }

    private Cluster mutatedFloorCells(ClusterMutationRequest.FloorCellsEdit edit) {
        Structure updatedStructure = super.mutated(new StructureMutation.FloorCellsEdit(
                edit.levelZ(),
                edit.cells(),
                switch (edit.mode()) {
                    case ADD -> StructureMutation.CellEditMode.ADD;
                    case REMOVE -> StructureMutation.CellEditMode.REMOVE;
                }));
        return withStructure(updatedStructure);
    }

    private Cluster mutatedWallPath(ClusterMutationRequest.WallPathEdit edit) {
        List<GridSegment> editableSegments = Topology.editableWallSegments(this, edit.levelZ(), edit.segments().segments());
        if (editableSegments.isEmpty()) {
            return this;
        }
        Structure updatedStructure = super.mutated(new StructureMutation.WallPathEdit(
                edit.levelZ(),
                GridBoundary.of(editableSegments),
                switch (edit.mode()) {
                    case CREATE -> StructureMutation.BoundaryEditMode.CREATE;
                    case DELETE -> StructureMutation.BoundaryEditMode.DELETE;
                }));
        return withStructure(updatedStructure);
    }

    private Cluster mutatedDoorSegments(ClusterMutationRequest.DoorSegmentsEdit edit) {
        List<GridSegment> editableSegments = Topology.editableDoorSegments(
                this,
                edit.levelZ(),
                edit.segments().segments(),
                edit.mode(),
                edit.scope());
        if (editableSegments.isEmpty()) {
            return this;
        }
        Structure updatedStructure = super.mutated(new StructureMutation.DoorSegmentsEdit(
                edit.levelZ(),
                GridBoundary.of(editableSegments),
                switch (edit.mode()) {
                    case CREATE -> StructureMutation.BoundaryEditMode.CREATE;
                    case DELETE -> StructureMutation.BoundaryEditMode.DELETE;
                }));
        return withStructure(updatedStructure);
    }

    private Cluster movedDoor(ClusterMutationRequest.DoorMove edit) {
        if (Objects.equals(edit.sourceBoundarySegment(), edit.targetBoundarySegment())
                || !canDeleteDoor(edit.levelZ(), edit.sourceBoundarySegment())
                || !canCreateDoor(edit.levelZ(), edit.targetBoundarySegment())) {
            return this;
        }
        Structure updatedStructure = super.mutated(new StructureMutation.DoorMove(
                edit.levelZ(),
                edit.sourceBoundarySegment(),
                edit.targetBoundarySegment()));
        return withStructure(updatedStructure);
    }

    private Cluster withStructure(Structure updatedStructure) {
        if (Objects.equals(updatedStructure, this)) {
            return this;
        }
        return fromDefinition(new ClusterDefinitionRequest(
                clusterId,
                structureObjectId,
                mapId,
                updatedStructure,
                updatedStructure == null ? roomTopology().rooms() : updatedStructure.roomTopology().rooms()));
    }

    private record ClusterBase(Structure structure, StructureRoomTopology roomTopology) {
    }

    private static final class Topology {

        private Topology() {
        }

        static List<GridSegment> editableWallSegments(
                Cluster cluster,
                int levelZ,
                Collection<GridSegment> segments2x
        ) {
            if (cluster == null || segments2x == null || segments2x.isEmpty()) {
                return List.of();
            }
            return segments2x.stream()
                    .filter(Objects::nonNull)
                    .filter(segment2x -> cluster.boundaryAtLevel(levelZ).interiorAdjacencyBoundary().contains(segment2x))
                    .filter(segment2x -> {
                        RoomPair roomPair = roomPairAtLevel(cluster, segment2x, levelZ);
                        return roomPair != null && !sameRoomId(roomPair.left(), roomPair.right());
                    })
                    .sorted(GridSegment.ORDER)
                    .toList();
        }

        static List<GridSegment> editableDoorSegments(
                Cluster cluster,
                int levelZ,
                Collection<GridSegment> segments2x,
                ClusterMutationRequest.BoundaryEditMode mode,
                ClusterMutationRequest.DoorScope scope
        ) {
            if (cluster == null || segments2x == null || segments2x.isEmpty()) {
                return List.of();
            }
            return mode == ClusterMutationRequest.BoundaryEditMode.DELETE
                    ? deletedEditableSegments(cluster, levelZ, segments2x, scope)
                    : createdEditableSegments(cluster, levelZ, segments2x, scope);
        }

        private static boolean sameRoomId(Room left, Room right) {
            return left != null
                    && right != null
                    && left.roomId() != null
                    && left.roomId().equals(right.roomId());
        }

        private static Set<GridPoint> projectedSurfaceCells(Structure structure) {
            if (structure == null || structure.levels().isEmpty()) {
                return Set.of();
            }
            LinkedHashSet<GridPoint> result = new LinkedHashSet<>();
            for (Integer levelZ : structure.levels().stream().sorted().toList()) {
                result.addAll(structure.surfaceAtLevel(levelZ).surface().cellFootprint().cells());
            }
            return result.isEmpty() ? Set.of() : Set.copyOf(result);
        }

        private static GridPoint derivedCenter(Structure structure) {
            return derivedCenter(projectedSurfaceCells(structure));
        }

        private static GridPoint derivedCenter(Map<Integer, Structure.LevelStructure> levelsByZ) {
            if (levelsByZ == null || levelsByZ.isEmpty()) {
                return GridPoint.cell(0, 0, 0);
            }
            LinkedHashSet<GridPoint> result = new LinkedHashSet<>();
            levelsByZ.entrySet().stream()
                    .filter(entry -> entry != null && entry.getKey() != null && entry.getValue() != null)
                    .sorted(Map.Entry.comparingByKey())
                    .forEach(entry -> result.addAll(entry.getValue().surface().surface().cellFootprint().cells()));
            return derivedCenter(result);
        }

        private static GridPoint derivedCenter(Collection<GridPoint> cells) {
            return cells == null || cells.isEmpty() ? GridPoint.cell(0, 0, 0) : GridArea.of(cells).center();
        }

        private static List<GridSegment> createdEditableSegments(
                Cluster cluster,
                int levelZ,
                Collection<GridSegment> segments2x,
                ClusterMutationRequest.DoorScope scope
        ) {
            return (segments2x == null ? List.<GridSegment>of() : segments2x).stream()
                    .filter(Objects::nonNull)
                    .filter(segment2x -> scope == ClusterMutationRequest.DoorScope.EXTERIOR
                            ? cluster.canCreateExteriorDoor(levelZ, segment2x)
                            : cluster.canCreateDoor(levelZ, segment2x))
                    .toList();
        }

        private static List<GridSegment> deletedEditableSegments(
                Cluster cluster,
                int levelZ,
                Collection<GridSegment> segments2x,
                ClusterMutationRequest.DoorScope scope
        ) {
            return (segments2x == null ? List.<GridSegment>of() : segments2x).stream()
                    .filter(Objects::nonNull)
                    .filter(segment2x -> scope == ClusterMutationRequest.DoorScope.EXTERIOR
                            ? cluster.canDeleteExteriorDoor(levelZ, segment2x)
                            : cluster.canDeleteDoor(levelZ, segment2x))
                    .toList();
        }
    }

}
