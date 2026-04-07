package features.world.dungeon.dungeonmap.structure.model;

import features.world.dungeon.geometry.GridPoint;
import features.world.dungeon.geometry.GridSegment;
import features.world.dungeon.geometry.GridTranslation;
import features.world.dungeon.model.structures.room.Room;
import features.world.dungeon.dungeonmap.structure.model.boundary.StructureBoundary;
import features.world.dungeon.dungeonmap.structure.model.room.StructureRoomTopology;
import features.world.dungeon.dungeonmap.structure.model.surface.StructureSurface;

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
public abstract class Structure {

    public record PersistenceSnapshot(Map<Integer, LevelStructure.PersistenceSnapshot> levelsByZ) {
        public PersistenceSnapshot {
            levelsByZ = levelsByZ == null ? Map.of() : Map.copyOf(new LinkedHashMap<>(levelsByZ));
        }
    }

    private final Map<Integer, LevelStructure> levelsByZ;
    // Derived companion over physical structure + room metadata. This is intentionally not part of persisted identity.
    private final StructureRoomTopology roomTopology;

    public static Structure empty() {
        return new BasicStructure(Map.of(), StructureRoomTopology.empty());
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

    protected Structure(
            Map<Integer, LevelStructure> levelsByZ
    ) {
        this(levelsByZ, StructureRoomTopology.empty());
    }

    protected Structure(
            Map<Integer, LevelStructure> levelsByZ,
            StructureRoomTopology roomTopology
    ) {
        this.levelsByZ = normalizeLevels(levelsByZ);
        this.roomTopology = roomTopology == null ? StructureRoomTopology.empty() : roomTopology;
    }

    protected Structure(Structure template) {
        this(template, template == null ? StructureRoomTopology.empty() : template.roomTopology());
    }

    protected Structure(Structure template, StructureRoomTopology roomTopology) {
        this(template == null ? Map.of() : template.levelsByZ, roomTopology);
    }

    protected abstract Structure recreate(
            Map<Integer, LevelStructure> levelsByZ,
            StructureRoomTopology roomTopology
    );

    public StructureRoomTopology roomTopology() {
        return roomTopology;
    }

    public Structure withRoomMetadata(long mapId, Long clusterId, List<Room> rooms) {
        return recreate(levelsByZ, StructureRoomTopology.derive(mapId, clusterId, this, rooms));
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
        return structure.recreate(structure.levelsByZ, topology);
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
        Structure projected = recreate(Map.of(levelZ, level), StructureRoomTopology.empty());
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
            case StructureMutation.Translation edit -> translated(edit.translation());
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

    private Structure translated(GridTranslation translation) {
        GridTranslation resolvedTranslation = translation == null ? GridTranslation.none() : translation;
        if (resolvedTranslation.isZero()) {
            return this;
        }
        Map<Integer, LevelStructure> translatedLevels = new LinkedHashMap<>();
        for (Map.Entry<Integer, LevelStructure> entry : levelsByZ.entrySet()) {
            translatedLevels.put(entry.getKey() + resolvedTranslation.dzLevels(), entry.getValue().translated(resolvedTranslation));
        }
        Structure moved = recreate(translatedLevels, StructureRoomTopology.empty());
        return roomTopology.isEmpty()
                ? moved
                : reattachTopology(moved, roomTopology.translatedBy(resolvedTranslation, moved));
    }

    private Structure mutateSurfaceCells(StructureMutation.SurfaceCellsEdit edit) {
        if (edit.cells().isEmpty()) {
            return this;
        }
        LevelStructure currentLevel = levelsByZ.get(edit.levelZ());
        StructureSurface currentSurface = currentLevel == null ? StructureSurface.empty() : currentLevel.surface();
        StructureSurface nextSurface = currentSurface.editedSurfaceCells(
                edit.cells(),
                edit.mode(),
                edit.floorSyncPolicy(),
                edit.preferredAnchorCell());
        if (Objects.equals(nextSurface, currentSurface)) {
            return this;
        }
        if (nextSurface.isEmpty()) {
            return withUpdatedLevel(edit.levelZ(), null);
        }
        LevelStructure nextLevel = currentLevel == null
                ? LevelStructure.fromSurface(nextSurface)
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
        StructureSurface nextSurface = currentLevel.surface().editedFloorCells(edit.cells(), edit.mode());
        if (Objects.equals(nextSurface, currentLevel.surface())) {
            return this;
        }
        return withUpdatedLevel(edit.levelZ(), currentLevel.withSurface(nextSurface));
    }

    private Structure mutateWallPath(StructureMutation.WallPathEdit edit) {
        if (edit.segments().isEmpty()) {
            return this;
        }
        LevelStructure currentLevel = levelsByZ.get(edit.levelZ());
        if (currentLevel == null) {
            return this;
        }
        StructureBoundary currentBoundary = currentLevel.boundary();
        StructureBoundary nextBoundary = edit.mode() == StructureMutation.BoundaryEditMode.CREATE
                ? currentBoundary.withCreatedWallPath(edit.segments())
                : currentBoundary.withDeletedWallPath(edit.segments());
        if (Objects.equals(nextBoundary, currentBoundary)) {
            return this;
        }
        return withUpdatedLevel(edit.levelZ(), currentLevel.withBoundary(nextBoundary));
    }

    private Structure mutateDoorSegments(StructureMutation.DoorSegmentsEdit edit) {
        if (edit.segments().isEmpty()) {
            return this;
        }
        LevelStructure currentLevel = levelsByZ.get(edit.levelZ());
        if (currentLevel == null) {
            return this;
        }
        StructureBoundary currentBoundary = currentLevel.boundary();
        StructureBoundary nextBoundary = edit.mode() == StructureMutation.BoundaryEditMode.CREATE
                ? currentBoundary.withCreatedDoorSegments(edit.segments())
                : currentBoundary.withDeletedDoorSegments(edit.segments());
        if (Objects.equals(nextBoundary, currentBoundary)) {
            return this;
        }
        return withUpdatedLevel(edit.levelZ(), currentLevel.withBoundary(nextBoundary));
    }

    private Structure mutateDoorMove(StructureMutation.DoorMove edit) {
        if (Objects.equals(edit.sourceBoundarySegment(), edit.targetBoundarySegment())) {
            return this;
        }
        LevelStructure currentLevel = levelsByZ.get(edit.levelZ());
        if (currentLevel == null) {
            return this;
        }
        StructureBoundary currentBoundary = currentLevel.boundary();
        StructureBoundary nextBoundary = currentBoundary.withMovedDoor(
                edit.sourceBoundarySegment(),
                edit.targetBoundarySegment());
        if (Objects.equals(nextBoundary, currentBoundary)) {
            return this;
        }
        return withUpdatedLevel(edit.levelZ(), currentLevel.withBoundary(nextBoundary));
    }

    private Structure withUpdatedLevel(int levelZ, LevelStructure nextLevel) {
        Map<Integer, LevelStructure> updatedLevels = new LinkedHashMap<>(levelsByZ);
        if (nextLevel == null || nextLevel.isEmpty()) {
            updatedLevels.remove(levelZ);
        } else {
            updatedLevels.put(levelZ, nextLevel);
        }
        Structure updated = updatedLevels.isEmpty() ? empty() : recreate(updatedLevels, StructureRoomTopology.empty());
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
                    specification.surfaceArea(),
                    specification.floorArea());
            if (surface.isEmpty()) {
                return new LevelStructure(StructureSurface.empty(), StructureBoundary.empty());
            }
            return new LevelStructure(
                    surface,
                    StructureBoundary.fromSurfaceAndFeatures(surface.surface().cells(), specification.doors(), specification.walls()));
        }

        private static LevelStructure fromSurface(StructureSurface surface) {
            StructureSurface resolvedSurface = surface == null ? StructureSurface.empty() : surface;
            if (resolvedSurface.isEmpty()) {
                return new LevelStructure(StructureSurface.empty(), StructureBoundary.empty());
            }
            return new LevelStructure(
                    resolvedSurface,
                    StructureBoundary.fromSurfaceAndFeatures(resolvedSurface.surface().cells(), List.of(), List.of()));
        }

        private LevelStructure translated(GridTranslation translation) {
            return new LevelStructure(
                    surface.translated(translation),
                    boundary.translated(translation));
        }

        private LevelStructure withBoundary(StructureBoundary boundary) {
            StructureBoundary resolvedBoundary = boundary == null
                    ? StructureBoundary.empty()
                    : StructureBoundary.fromSurfaceAndFeatures(
                    surface.surface().cells(),
                    boundary.doors(),
                    boundary.walls());
            return new LevelStructure(surface, resolvedBoundary);
        }

        private LevelStructure withSurface(StructureSurface surface) {
            StructureSurface resolvedSurface = surface == null ? StructureSurface.empty() : surface;
            StructureBoundary resolvedBoundary = resolvedSurface.isEmpty()
                    ? StructureBoundary.empty()
                    : boundary.rewrittenToSurface(features.world.dungeon.geometry.GridArea.of(resolvedSurface.surface().cells()));
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
                    StructureBoundary.fromPersistenceSnapshot(surface.surface().cells(), resolvedSnapshot.boundary()));
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
        return new BasicStructure(levelsByZ, StructureRoomTopology.empty());
    }

    private static Structure fromGridPoints(Collection<GridPoint> points) {
        if (points == null || points.isEmpty()) {
            return empty();
        }
        Map<Integer, Set<GridPoint>> cellsByLevel = new LinkedHashMap<>();
        for (GridPoint point : points) {
            if (point != null) {
                cellsByLevel.computeIfAbsent(point.z(), ignored -> new LinkedHashSet<>())
                        .addAll(point.cellFootprint().onLevel(point.z()).cells());
            }
        }
        Map<Integer, StructureSpecification.LevelSpecification> levelsByZ = new LinkedHashMap<>();
        for (Map.Entry<Integer, Set<GridPoint>> entry : cellsByLevel.entrySet()) {
            levelsByZ.put(entry.getKey(), new StructureSpecification.LevelSpecification(
                    features.world.dungeon.geometry.GridArea.of(entry.getValue()).center(),
                    features.world.dungeon.geometry.GridArea.of(entry.getValue()),
                    features.world.dungeon.geometry.GridArea.of(entry.getValue()),
                    List.of(),
                    List.of()));
        }
        return fromSpecification(new StructureSpecification(levelsByZ));
    }
}
