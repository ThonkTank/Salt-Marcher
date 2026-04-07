package features.world.dungeonmap.structure.model;

import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.structures.connection.DungeonConnection;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.structure.model.boundary.StructureBoundary;
import features.world.dungeonmap.structure.model.boundary.door.Door;
import features.world.dungeonmap.structure.model.boundary.wall.Wall;
import features.world.dungeonmap.structure.model.surface.StructureSurface;

import java.util.ArrayList;
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
    private final StructureRoomTopology roomTopology;

    public static Structure empty() {
        return new Structure(Map.of(), null);
    }

    public static Structure fromLevels(Map<Integer, LevelStructure> levelsByZ) {
        if (levelsByZ == null || levelsByZ.isEmpty()) {
            return empty();
        }
        return new Structure(levelsByZ, null);
    }

    public static Structure fromCubePoints(Collection<CubePoint> cubePoints) {
        if (cubePoints == null || cubePoints.isEmpty()) {
            return empty();
        }
        Map<Integer, Set<CellCoord>> cellsByLevel = new LinkedHashMap<>();
        for (CubePoint cubePoint : cubePoints) {
            if (cubePoint == null) {
                continue;
            }
            cellsByLevel.computeIfAbsent(cubePoint.z(), ignored -> new LinkedHashSet<>())
                    .add(cubePoint.projectedCell());
        }
        return fromSurfaceCellsByLevel(cellsByLevel, Map.of(), Map.of());
    }

    public static Structure fromSurfaceCellsByLevel(
            Map<Integer, ? extends Collection<CellCoord>> cellsByLevel,
            Map<Integer, ? extends Collection<CellCoord>> floorCellsByLevel,
            Map<Integer, CellCoord> anchorsByLevel
    ) {
        if (cellsByLevel == null || cellsByLevel.isEmpty()) {
            return empty();
        }
        Map<Integer, LevelStructure> levels = new LinkedHashMap<>();
        cellsByLevel.entrySet().stream()
                .filter(entry -> entry != null && entry.getKey() != null)
                .sorted(Map.Entry.comparingByKey())
                .forEach(entry -> {
                    int levelZ = entry.getKey();
                    LevelStructure level = LevelStructure.fromSurfaceCells(
                            anchorsByLevel == null ? null : anchorsByLevel.get(levelZ),
                            entry.getValue(),
                            floorCellsByLevel == null ? null : floorCellsByLevel.get(levelZ));
                    if (!level.isEmpty()) {
                        levels.put(levelZ, level);
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
        this(levelsByZ, null);
    }

    private Structure(
            Map<Integer, LevelStructure> levelsByZ,
            StructureRoomTopology roomTopology
    ) {
        this.levelsByZ = normalizeLevels(levelsByZ);
        this.roomTopology = roomTopology;
    }

    public StructureRoomTopology roomTopology() {
        return roomTopology;
    }

    public Structure withRoomMetadata(long mapId, Long clusterId, List<Room> rooms) {
        return new Structure(levelsByZ, StructureRoomTopology.derive(mapId, clusterId, this, rooms));
    }

    public List<Room> rooms() {
        return roomTopology == null ? List.of() : roomTopology.rooms();
    }

    public List<DungeonConnection> localRoomConnections() {
        return roomTopology == null ? List.of() : roomTopology.localConnections();
    }

    private Structure reattachedWithSameRooms(Structure structure) {
        if (roomTopology == null || structure == null || structure.levels().isEmpty()) {
            return structure;
        }
        return structure.withRoomMetadata(roomTopology.mapId(), roomTopology.clusterId(), roomTopology.rooms());
    }

    private static Structure reattachTopology(Structure structure, StructureRoomTopology topology) {
        if (structure == null || topology == null || structure.levels().isEmpty()) {
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
        Structure projected = new Structure(Map.of(levelZ, level), null);
        return roomTopology == null
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

    public Structure withBoundaryAtLevel(int levelZ, StructureBoundary boundary) {
        LevelStructure level = levelsByZ.get(levelZ);
        if (level == null) {
            return this;
        }
        Map<Integer, LevelStructure> updated = new LinkedHashMap<>(levelsByZ);
        updated.put(levelZ, level.withBoundary(boundary));
        return reattachedWithSameRooms(new Structure(updated, null));
    }

    public Structure withSurfaceAtLevel(int levelZ, StructureSurface surface) {
        LevelStructure level = levelsByZ.get(levelZ);
        if (level == null) {
            return this;
        }
        Map<Integer, LevelStructure> updated = new LinkedHashMap<>(levelsByZ);
        updated.put(levelZ, level.withSurface(surface));
        return reattachedWithSameRooms(new Structure(updated, null));
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

    public Structure movedBy(CellCoord delta, int levelDelta) {
        CellCoord resolvedDelta = delta == null ? new CellCoord(0, 0) : delta;
        if (resolvedDelta.x() == 0 && resolvedDelta.y() == 0 && levelDelta == 0) {
            return this;
        }
        Map<Integer, LevelStructure> translatedLevels = new LinkedHashMap<>();
        for (Map.Entry<Integer, LevelStructure> entry : levelsByZ.entrySet()) {
            translatedLevels.put(entry.getKey() + levelDelta, entry.getValue().translatedByCells(resolvedDelta));
        }
        Structure moved = new Structure(translatedLevels, null);
        return roomTopology == null
                ? moved
                : reattachTopology(moved, roomTopology.translatedBy(resolvedDelta, levelDelta, moved));
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
        return Objects.equals(levelsByZ, that.levelsByZ)
                && Objects.equals(roomTopology, that.roomTopology);
    }

    @Override
    public int hashCode() {
        return Objects.hash(levelsByZ, roomTopology);
    }

    @Override
    public String toString() {
        return "Structure[levelsByZ=" + levelsByZ
                + ", roomTopology=" + roomTopology + "]";
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

        public static LevelStructure fromSurfaceCells(
                CellCoord anchorCell,
                Collection<CellCoord> surfaceCells,
                Collection<CellCoord> floorCells
        ) {
            return fromSurfaceAndFeatures(
                    anchorCell,
                    surfaceCells,
                    List.of(),
                    List.of(),
                    floorCells);
        }

        public static LevelStructure fromSurfaceAndFeatures(
                CellCoord anchorCell,
                Collection<CellCoord> surfaceCells,
                Collection<Door> doors,
                Collection<Wall> walls,
                Collection<CellCoord> floorCells
        ) {
            StructureSurface surface = StructureSurface.fromCells(anchorCell, surfaceCells, floorCells);
            if (surface.isEmpty()) {
                return new LevelStructure(StructureSurface.empty(), StructureBoundary.empty());
            }
            return new LevelStructure(
                    surface,
                    StructureBoundary.fromSurfaceAndFeatures(surface.surface().cellCoords(), doors, walls));
        }

        public StructureSurface surface() {
            return surface;
        }

        public StructureBoundary boundary() {
            return boundary;
        }

        public LevelStructure translatedByCells(CellCoord delta) {
            return new LevelStructure(
                    surface.translatedByCells(delta),
                    boundary.translatedByCells(delta));
        }

        public LevelStructure withBoundary(StructureBoundary boundary) {
            StructureBoundary resolvedBoundary = boundary == null
                    ? StructureBoundary.empty()
                    : StructureBoundary.fromSurfaceAndFeatures(
                    surface.surface().cellCoords(),
                    boundary.doors(),
                    boundary.walls());
            return new LevelStructure(surface, resolvedBoundary);
        }

        public LevelStructure withSurface(StructureSurface surface) {
            StructureSurface resolvedSurface = surface == null ? StructureSurface.empty() : surface;
            StructureBoundary resolvedBoundary = resolvedSurface.isEmpty()
                    ? StructureBoundary.empty()
                    : boundary.rewrittenToSurface(resolvedSurface.surface().cellCoords());
            return new LevelStructure(resolvedSurface, resolvedBoundary);
        }

        public static LevelStructure fromSurfaceAndBoundary(
                StructureSurface surface,
                StructureBoundary boundary
        ) {
            StructureSurface resolvedSurface = surface == null ? StructureSurface.empty() : surface;
            if (resolvedSurface.isEmpty()) {
                return new LevelStructure(StructureSurface.empty(), StructureBoundary.empty());
            }
            StructureBoundary resolvedBoundary = boundary == null
                    ? StructureBoundary.empty()
                    : StructureBoundary.fromSurfaceAndFeatures(
                    resolvedSurface.surface().cellCoords(),
                    boundary.doors(),
                    boundary.walls());
            return new LevelStructure(resolvedSurface, resolvedBoundary);
        }

        public static LevelStructure fromPersistenceSnapshot(PersistenceSnapshot snapshot) {
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
}
