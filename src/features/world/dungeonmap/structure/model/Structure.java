package features.world.dungeonmap.structure.model;

import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.GridSegment2x;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.structure.model.boundary.StructureBoundary;
import features.world.dungeonmap.structure.model.boundary.door.Door;
import features.world.dungeonmap.structure.model.boundary.door.Door.DoorState;
import features.world.dungeonmap.structure.model.boundary.wall.Wall;
import features.world.dungeonmap.structure.model.room.StructureRoomTopology;
import features.world.dungeonmap.structure.model.surface.StructureSurface;

import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/**
 * Shared topology orchestrator over shape-backed floor, wall, and door objects.
 */
public final class Structure {

    public record PersistenceSnapshot(Map<Integer, LevelStructure.PersistenceSnapshot> levelsByZ) {
        public PersistenceSnapshot {
            levelsByZ = levelsByZ == null ? Map.of() : Map.copyOf(new LinkedHashMap<>(levelsByZ));
        }
    }

    private final Map<Integer, LevelStructure> levelsByZ;
    // Derived companion over physical structure + room metadata. This is intentionally not part of persisted identity.
    private final StructureRoomTopology roomTopology;

    public static Structure empty() {
        return new Structure(Map.of(), StructureRoomTopology.empty());
    }

    public static Structure fromSpecification(StructureSpecification specification) {
        if (specification == null || specification.isEmpty()) {
            return empty();
        }
        Map<Integer, LevelStructure> levels = new LinkedHashMap<>();
        specification.levelsByZ().entrySet().stream()
                .filter(entry -> entry != null && entry.getKey() != null)
                .sorted(Map.Entry.comparingByKey())
                .forEach(entry -> {
                    LevelStructure level = LevelStructure.fromSpecification(entry.getValue());
                    if (!level.isEmpty()) {
                        levels.put(entry.getKey(), level);
                    }
                });
        return levels.isEmpty() ? empty() : fromLevels(levels);
    }

    public static Structure fromPersistenceSnapshot(PersistenceSnapshot snapshot) {
        if (snapshot == null || snapshot.levelsByZ().isEmpty()) {
            return empty();
        }
        Map<Integer, LevelStructure> levels = new LinkedHashMap<>();
        snapshot.levelsByZ().entrySet().stream()
                .filter(entry -> entry != null && entry.getKey() != null)
                .sorted(Map.Entry.comparingByKey())
                .forEach(entry -> {
                    LevelStructure level = LevelStructure.fromPersistenceSnapshot(entry.getValue());
                    if (!level.isEmpty()) {
                        levels.put(entry.getKey(), level);
                    }
                });
        return levels.isEmpty() ? empty() : fromLevels(levels);
    }

    private Structure(
            Map<Integer, LevelStructure> levelsByZ
    ) {
        this(levelsByZ, StructureRoomTopology.empty());
    }

    private Structure(
            Map<Integer, LevelStructure> levelsByZ,
            StructureRoomTopology roomTopology
    ) {
        this.levelsByZ = normalizeLevels(levelsByZ);
        this.roomTopology = roomTopology == null ? StructureRoomTopology.empty() : roomTopology;
    }

    public StructureRoomTopology roomTopology() {
        return roomTopology;
    }

    public Structure withRoomMetadata(long mapId, Long clusterId, List<Room> rooms) {
        return new Structure(levelsByZ, StructureRoomTopology.derive(mapId, clusterId, this, rooms));
    }

    private Structure reattachedWithSameRooms(Structure structure) {
        if (structure == null || structure.levels().isEmpty() || roomTopology.isEmpty()) {
            return structure;
        }
        return structure.withRoomMetadata(roomTopology.mapId(), roomTopology.clusterId(), roomTopology.rooms());
    }

    private static Structure reattachTopology(Structure structure, StructureRoomTopology topology) {
        if (structure == null || structure.levels().isEmpty()) {
            return structure;
        }
        return new Structure(structure.levelsByZ, topology);
    }

    public PersistenceSnapshot persistenceSnapshot() {
        Map<Integer, LevelStructure.PersistenceSnapshot> snapshotLevels = new LinkedHashMap<>();
        for (Map.Entry<Integer, LevelStructure> entry : levelsByZ.entrySet()) {
            if (entry.getKey() == null || entry.getValue() == null || entry.getValue().isEmpty()) {
                continue;
            }
            snapshotLevels.put(entry.getKey(), entry.getValue().persistenceSnapshot());
        }
        return new PersistenceSnapshot(snapshotLevels);
    }

    public Structure projectedToLevel(int levelZ) {
        LevelStructure level = levelsByZ.get(levelZ);
        if (level == null) {
            return empty();
        }
        Structure projected = new Structure(Map.of(levelZ, level), StructureRoomTopology.empty());
        return roomTopology.isEmpty()
                ? projected
                : reattachTopology(projected, roomTopology.projectedToLevel(levelZ, projected));
    }

    public StructureBoundary boundaryAtLevel(int levelZ) {
        LevelStructure level = levelsByZ.get(levelZ);
        return level == null ? StructureBoundary.empty() : level.boundary();
    }

    public StructureSurface surfaceAtLevel(int levelZ) {
        LevelStructure level = levelsByZ.get(levelZ);
        return level == null ? StructureSurface.empty() : level.surface();
    }

    /**
     * Public structure mutations must converge here so the same physical change produces the same result regardless
     * of which room, corridor, or editor workflow requested it.
     */
    public Structure mutated(StructureMutation mutation) {
        if (mutation == null) {
            return this;
        }
        return switch (mutation) {
            case StructureMutation.SurfaceCellsEdit edit -> mutateSurfaceCells(edit);
            case StructureMutation.FloorCellsEdit edit -> mutateFloorCells(edit);
            case StructureMutation.WallPathEdit edit -> mutateWallPath(edit);
            case StructureMutation.DoorSegmentsEdit edit -> mutateDoorSegments(edit);
            case StructureMutation.DoorMove edit -> mutateDoorMove(edit);
            case StructureMutation.Translation edit -> translated(edit.delta(), edit.levelDelta());
        };
    }

    public Set<Integer> levels() {
        return levelsByZ.isEmpty() ? Set.of() : Set.copyOf(new LinkedHashSet<>(levelsByZ.keySet()));
    }

    public int primaryLevel() {
        return levels().stream()
                .mapToInt(Integer::intValue)
                .min()
                .orElse(0);
    }

    private Structure translated(CellCoord delta, int levelDelta) {
        CellCoord resolvedDelta = delta == null ? new CellCoord(0, 0) : delta;
        if (resolvedDelta.x() == 0 && resolvedDelta.y() == 0 && levelDelta == 0) {
            return this;
        }
        Map<Integer, LevelStructure> translatedLevels = new LinkedHashMap<>();
        for (Map.Entry<Integer, LevelStructure> entry : levelsByZ.entrySet()) {
            translatedLevels.put(entry.getKey() + levelDelta, entry.getValue().translatedByCells(resolvedDelta));
        }
        Structure moved = new Structure(translatedLevels, StructureRoomTopology.empty());
        return roomTopology.isEmpty()
                ? moved
                : reattachTopology(moved, roomTopology.translatedBy(resolvedDelta, levelDelta, moved));
    }

    private Structure mutateSurfaceCells(StructureMutation.SurfaceCellsEdit edit) {
        if (edit.cells().isEmpty()) {
            return this;
        }
        LevelStructure currentLevel = levelsByZ.get(edit.levelZ());
        LinkedHashSet<CellCoord> nextSurfaceCells = new LinkedHashSet<>(currentLevel == null
                ? Set.<CellCoord>of()
                : currentLevel.surface().surface().cellCoords());
        boolean changed = applyCellEdit(nextSurfaceCells, edit.cells(), edit.mode());
        if (!changed) {
            return this;
        }
        if (nextSurfaceCells.isEmpty()) {
            return withUpdatedLevel(edit.levelZ(), null);
        }
        LinkedHashSet<CellCoord> nextFloorCells = new LinkedHashSet<>(currentLevel == null
                ? Set.<CellCoord>of()
                : currentLevel.surface().floor().cellCoords());
        if (edit.floorSyncPolicy() == StructureMutation.FloorSyncPolicy.MATCH_SURFACE_EDIT) {
            applyCellEdit(nextFloorCells, edit.cells(), edit.mode());
        }
        nextFloorCells.retainAll(nextSurfaceCells);
        CellCoord anchorCell = preferredAnchor(currentLevel, edit.preferredAnchorCell(), nextSurfaceCells);
        StructureSurface nextSurface = StructureSurface.fromCells(anchorCell, nextSurfaceCells, nextFloorCells);
        LevelStructure nextLevel = currentLevel == null
                ? LevelStructure.fromSpecification(StructureSpecification.LevelSpecification.of(
                anchorCell,
                nextSurfaceCells,
                nextFloorCells,
                List.of(),
                List.of()))
                : currentLevel.withSurface(nextSurface);
        return withUpdatedLevel(edit.levelZ(), nextLevel);
    }

    private Structure mutateFloorCells(StructureMutation.FloorCellsEdit edit) {
        if (edit.cells().isEmpty()) {
            return this;
        }
        LevelStructure currentLevel = levelsByZ.get(edit.levelZ());
        if (currentLevel == null || currentLevel.surface().isEmpty()) {
            return this;
        }
        LinkedHashSet<CellCoord> nextFloorCells = new LinkedHashSet<>(currentLevel.surface().floor().cellCoords());
        boolean changed = applyCellEdit(nextFloorCells, edit.cells(), edit.mode());
        if (!changed) {
            return this;
        }
        nextFloorCells.retainAll(currentLevel.surface().surface().cellCoords());
        StructureSurface nextSurface = StructureSurface.fromCells(
                currentLevel.surface().surface().anchorCell(),
                currentLevel.surface().surface().cellCoords(),
                nextFloorCells);
        return withUpdatedLevel(edit.levelZ(), currentLevel.withSurface(nextSurface));
    }

    private Structure mutateWallPath(StructureMutation.WallPathEdit edit) {
        if (edit.segments2x().isEmpty()) {
            return this;
        }
        LevelStructure currentLevel = levelsByZ.get(edit.levelZ());
        if (currentLevel == null) {
            return this;
        }
        StructureBoundary currentBoundary = currentLevel.boundary();
        StructureBoundary nextBoundary = edit.mode() == StructureMutation.BoundaryEditMode.CREATE
                ? currentBoundary.withCreatedWallPath(edit.segments2x())
                : currentBoundary.withDeletedWallPath(edit.segments2x());
        if (Objects.equals(nextBoundary, currentBoundary)) {
            return this;
        }
        return withUpdatedLevel(edit.levelZ(), currentLevel.withBoundary(nextBoundary));
    }

    private Structure mutateDoorSegments(StructureMutation.DoorSegmentsEdit edit) {
        if (edit.segments2x().isEmpty()) {
            return this;
        }
        LevelStructure currentLevel = levelsByZ.get(edit.levelZ());
        if (currentLevel == null) {
            return this;
        }
        StructureBoundary currentBoundary = currentLevel.boundary();
        List<Door> nextDoors = edit.mode() == StructureMutation.BoundaryEditMode.CREATE
                ? createdDoors(currentBoundary, edit.segments2x())
                : deletedDoors(currentBoundary, edit.segments2x());
        if (Objects.equals(nextDoors, currentBoundary.doors())) {
            return this;
        }
        return withUpdatedLevel(edit.levelZ(), currentLevel.withBoundary(currentBoundary.withDoors(nextDoors)));
    }

    private Structure mutateDoorMove(StructureMutation.DoorMove edit) {
        if (Objects.equals(edit.sourceBoundarySegment2x(), edit.targetBoundarySegment2x())) {
            return this;
        }
        LevelStructure currentLevel = levelsByZ.get(edit.levelZ());
        if (currentLevel == null) {
            return this;
        }
        StructureBoundary boundary = currentLevel.boundary();
        if (boundary.doorAtBoundarySegment(edit.sourceBoundarySegment2x()) == null) {
            throw new IllegalArgumentException("Door move source must already contain a door");
        }
        if (boundary.doorAtBoundarySegment(edit.targetBoundarySegment2x()) != null) {
            throw new IllegalArgumentException("Door move target is already occupied");
        }
        Wall targetWall = boundary.wallAtBoundarySegment(edit.targetBoundarySegment2x());
        if (!boundary.boundaryEdges().contains(edit.targetBoundarySegment2x())
                || targetWall == null
                || !targetWall.supportsDoorAttachments()) {
            throw new IllegalArgumentException("Door move target must be a valid boundary wall");
        }
        Structure withoutSource = mutateDoorSegments(new StructureMutation.DoorSegmentsEdit(
                edit.levelZ(),
                List.of(edit.sourceBoundarySegment2x()),
                StructureMutation.BoundaryEditMode.DELETE));
        if (withoutSource == this) {
            return this;
        }
        return withoutSource.mutated(new StructureMutation.DoorSegmentsEdit(
                edit.levelZ(),
                List.of(edit.targetBoundarySegment2x()),
                StructureMutation.BoundaryEditMode.CREATE));
    }

    private static List<Door> createdDoors(StructureBoundary boundary, Collection<GridSegment2x> requestedSegments) {
        if (boundary == null || requestedSegments == null || requestedSegments.isEmpty()) {
            return boundary == null ? List.of() : boundary.doors();
        }
        List<GridSegment2x> editableSegments = requestedSegments.stream()
                .filter(Objects::nonNull)
                .filter(boundary.boundaryEdges()::contains)
                .filter(segment2x -> boundary.doorAtBoundarySegment(segment2x) == null)
                .filter(segment2x -> {
                    Wall wall = boundary.wallAtBoundarySegment(segment2x);
                    return wall != null && wall.supportsDoorAttachments();
                })
                .sorted(GridSegment2x.ORDER)
                .toList();
        if (editableSegments.isEmpty()) {
            return boundary.doors();
        }
        LinkedHashSet<Door> nextDoors = new LinkedHashSet<>(boundary.doors());
        nextDoors.addAll(Door.fromBoundaryComponents(editableSegments, DoorState.OPEN));
        return nextDoors.stream()
                .filter(Objects::nonNull)
                .sorted(java.util.Comparator.comparing(Door::anchorSegment2x, GridSegment2x.ORDER))
                .toList();
    }

    private static List<Door> deletedDoors(StructureBoundary boundary, Collection<GridSegment2x> requestedSegments) {
        if (boundary == null || requestedSegments == null || requestedSegments.isEmpty()) {
            return boundary == null ? List.of() : boundary.doors();
        }
        Set<GridSegment2x> removableSegments = requestedSegments.stream()
                .filter(Objects::nonNull)
                .filter(segment2x -> boundary.doorAtBoundarySegment(segment2x) != null)
                .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));
        if (removableSegments.isEmpty()) {
            return boundary.doors();
        }
        List<Door> nextDoors = boundary.doors().stream()
                .filter(Objects::nonNull)
                .map(door -> door.withoutBoundarySegments(removableSegments))
                .filter(Objects::nonNull)
                .sorted(java.util.Comparator.comparing(Door::anchorSegment2x, GridSegment2x.ORDER))
                .toList();
        return Objects.equals(nextDoors, boundary.doors()) ? boundary.doors() : nextDoors;
    }

    private static boolean applyCellEdit(Set<CellCoord> target, Collection<CellCoord> cells, StructureMutation.CellEditMode mode) {
        if (target == null || cells == null || cells.isEmpty()) {
            return false;
        }
        return mode == StructureMutation.CellEditMode.ADD
                ? target.addAll(cells)
                : target.removeAll(cells);
    }

    private CellCoord preferredAnchor(LevelStructure currentLevel, CellCoord preferredAnchorCell, Set<CellCoord> nextSurfaceCells) {
        if (preferredAnchorCell != null && nextSurfaceCells.contains(preferredAnchorCell)) {
            return preferredAnchorCell;
        }
        if (currentLevel != null) {
            CellCoord currentAnchor = currentLevel.surface().surface().anchorCell();
            if (currentAnchor != null && nextSurfaceCells.contains(currentAnchor)) {
                return currentAnchor;
            }
        }
        return CellCoord.bestCenter(nextSurfaceCells);
    }

    private Structure withUpdatedLevel(int levelZ, LevelStructure nextLevel) {
        Map<Integer, LevelStructure> updatedLevels = new LinkedHashMap<>(levelsByZ);
        if (nextLevel == null || nextLevel.isEmpty()) {
            updatedLevels.remove(levelZ);
        } else {
            updatedLevels.put(levelZ, nextLevel);
        }
        Structure updated = updatedLevels.isEmpty() ? empty() : new Structure(updatedLevels, null);
        return reattachedWithSameRooms(updated);
    }

    private static Map<Integer, LevelStructure> normalizeLevels(Map<Integer, LevelStructure> levelsByZ) {
        if (levelsByZ == null || levelsByZ.isEmpty()) {
            return Map.of();
        }
        Map<Integer, LevelStructure> result = new LinkedHashMap<>();
        levelsByZ.entrySet().stream()
                .filter(entry -> entry != null && entry.getKey() != null && entry.getValue() != null)
                .sorted(Map.Entry.comparingByKey())
                .forEach(entry -> result.put(entry.getKey(), entry.getValue()));
        return result.isEmpty() ? Map.of() : Map.copyOf(result);
    }


    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof Structure that)) {
            return false;
        }
        return Objects.equals(levelsByZ, that.levelsByZ);
    }

    @Override
    public int hashCode() {
        return Objects.hash(levelsByZ);
    }

    @Override
    public String toString() {
        return "Structure[levelsByZ=" + levelsByZ + "]";
    }

    public static final class LevelStructure {

        public record PersistenceSnapshot(
                StructureSurface.PersistenceSnapshot surface,
                StructureBoundary.PersistenceSnapshot boundary
        ) {
            public PersistenceSnapshot {
                surface = surface == null ? StructureSurface.emptySnapshot() : surface;
                boundary = boundary == null ? StructureBoundary.emptySnapshot() : boundary;
            }
        }

        private final StructureSurface surface;
        private final StructureBoundary boundary;

        private LevelStructure(
                StructureSurface surface,
                StructureBoundary boundary
        ) {
            this.surface = surface == null ? StructureSurface.empty() : surface;
            this.boundary = boundary == null ? StructureBoundary.empty() : boundary;
        }

        public StructureSurface surface() {
            return surface;
        }

        public StructureBoundary boundary() {
            return boundary;
        }

        private static LevelStructure fromSpecification(StructureSpecification.LevelSpecification specification) {
            if (specification == null || specification.isEmpty()) {
                return new LevelStructure(StructureSurface.empty(), StructureBoundary.empty());
            }
            StructureSurface surface = StructureSurface.fromCells(
                    specification.anchorCell(),
                    specification.surfaceCells(),
                    specification.floorCells());
            if (surface.isEmpty()) {
                return new LevelStructure(StructureSurface.empty(), StructureBoundary.empty());
            }
            return new LevelStructure(
                    surface,
                    StructureBoundary.fromSurfaceAndFeatures(surface.surface().cellCoords(), specification.doors(), specification.walls()));
        }

        private LevelStructure translatedByCells(CellCoord delta) {
            return new LevelStructure(
                    surface.translatedByCells(delta),
                    boundary.translatedByCells(delta));
        }

        private LevelStructure withBoundary(StructureBoundary boundary) {
            StructureBoundary resolvedBoundary = boundary == null
                    ? StructureBoundary.empty()
                    : StructureBoundary.fromSurfaceAndFeatures(
                    surface.surface().cellCoords(),
                    boundary.doors(),
                    boundary.walls());
            return new LevelStructure(surface, resolvedBoundary);
        }

        private LevelStructure withSurface(StructureSurface surface) {
            StructureSurface resolvedSurface = surface == null ? StructureSurface.empty() : surface;
            StructureBoundary resolvedBoundary = resolvedSurface.isEmpty()
                    ? StructureBoundary.empty()
                    : boundary.rewrittenToSurface(resolvedSurface.surface().cellCoords());
            return new LevelStructure(resolvedSurface, resolvedBoundary);
        }

        private static LevelStructure fromPersistenceSnapshot(PersistenceSnapshot snapshot) {
            PersistenceSnapshot resolvedSnapshot = snapshot == null
                    ? new PersistenceSnapshot(StructureSurface.emptySnapshot(), StructureBoundary.emptySnapshot())
                    : snapshot;
            StructureSurface surface = StructureSurface.fromPersistenceSnapshot(resolvedSnapshot.surface());
            if (surface.isEmpty()) {
                return new LevelStructure(StructureSurface.empty(), StructureBoundary.empty());
            }
            return new LevelStructure(
                    surface,
                    StructureBoundary.fromPersistenceSnapshot(surface.surface().cellCoords(), resolvedSnapshot.boundary()));
        }

        public boolean isEmpty() {
            return surface.isEmpty() && boundary.isEmpty();
        }

        public PersistenceSnapshot persistenceSnapshot() {
            return new PersistenceSnapshot(surface.persistenceSnapshot(), boundary.persistenceSnapshot());
        }

        @Override
        public boolean equals(Object other) {
            if (this == other) {
                return true;
            }
            if (!(other instanceof LevelStructure that)) {
                return false;
            }
            return Objects.equals(surface, that.surface)
                    && Objects.equals(boundary, that.boundary);
        }

        @Override
        public int hashCode() {
            return Objects.hash(surface, boundary);
        }

        @Override
        public String toString() {
            return "LevelStructure[surface=" + surface
                    + ", boundary=" + boundary + "]";
        }
    }

    private static Structure fromLevels(Map<Integer, LevelStructure> levelsByZ) {
        if (levelsByZ == null || levelsByZ.isEmpty()) {
            return empty();
        }
        return new Structure(levelsByZ, null);
    }

    private static Structure fromCubePoints(Collection<CubePoint> cubePoints) {
        if (cubePoints == null || cubePoints.isEmpty()) {
            return empty();
        }
        Map<Integer, Set<CellCoord>> cellsByLevel = new LinkedHashMap<>();
        for (CubePoint cubePoint : cubePoints) {
            if (cubePoint != null) {
                cellsByLevel.computeIfAbsent(cubePoint.z(), ignored -> new LinkedHashSet<>()).add(cubePoint.projectedCell());
            }
        }
        Map<Integer, StructureSpecification.LevelSpecification> levelsByZ = new LinkedHashMap<>();
        for (Map.Entry<Integer, Set<CellCoord>> entry : cellsByLevel.entrySet()) {
            levelsByZ.put(entry.getKey(), StructureSpecification.LevelSpecification.of(
                    CellCoord.bestCenter(entry.getValue()),
                    entry.getValue(),
                    entry.getValue(),
                    List.of(),
                    List.of()));
        }
        return fromSpecification(new StructureSpecification(levelsByZ));
    }
}
