package features.world.dungeonmap.repository;

import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.geometry.GridPoint2x;
import features.world.dungeonmap.model.geometry.GridSegment2x;
import features.world.dungeonmap.model.objects.Door;
import features.world.dungeonmap.model.objects.StructureObject;
import features.world.dungeonmap.model.objects.Wall;
import features.world.dungeonmap.model.objects.WallKind;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Canonical storage owner for persisted {@link StructureObject} topology.
 *
 * <p>Clusters and corridors may keep their own workflow metadata, but all persisted physical structure data must flow
 * through this repository so load and save share one serial form.
 */
public final class DungeonStructureRepository {

    private final DungeonWallKindRepository wallKindRepository = new DungeonWallKindRepository();

    public record PersistedStructure(long structureObjectId, StructureObject structure) {
    }

    public PersistedStructure save(Connection conn, Long structureObjectId, StructureObject structure) throws SQLException {
        StructureObject resolvedStructure = assignPersistentIds(conn, requiredStructure(structure));
        long resolvedStructureId = structureObjectId == null || structureObjectId <= 0L
                ? insertStructureObject(conn)
                : structureObjectId;
        replaceStructure(conn, resolvedStructureId, resolvedStructure.persistenceSnapshot());
        return new PersistedStructure(resolvedStructureId, resolvedStructure);
    }

    public void delete(Connection conn, Long structureObjectId) throws SQLException {
        if (conn == null || structureObjectId == null || structureObjectId <= 0L) {
            return;
        }
        try (PreparedStatement ps = conn.prepareStatement(
                "DELETE FROM dungeon_structure_objects WHERE structure_object_id=?")) {
            ps.setLong(1, structureObjectId);
            ps.executeUpdate();
        }
    }

    public Map<Long, StructureObject> loadByIds(Connection conn, Collection<Long> structureObjectIds) throws SQLException {
        List<Long> ids = sanitizedIds(structureObjectIds);
        if (ids.isEmpty()) {
            return Map.of();
        }
        Map<Long, WallKind> wallKindsById = wallKindRepository.loadWallKinds(conn);
        Map<Long, Map<Integer, CellCoord>> anchorsByStructureId = new LinkedHashMap<>();
        Map<Long, Map<Integer, Set<CellCoord>>> surfaceCellsByStructureId = new LinkedHashMap<>();
        Map<Long, Map<Integer, Set<CellCoord>>> floorCellsByStructureId = new LinkedHashMap<>();
        Map<Long, Map<Integer, List<Door>>> doorsByStructureId = loadDoorsByStructureId(conn, ids);
        Map<Long, Map<Integer, List<Wall>>> wallsByStructureId = loadWallsByStructureId(conn, ids, wallKindsById);

        loadLevelAnchors(conn, ids, anchorsByStructureId);
        loadCells(
                conn,
                ids,
                "SELECT structure_object_id, level_z, cell_x2, cell_y2"
                        + " FROM dungeon_structure_surface_cells"
                        + " WHERE structure_object_id IN %s"
                        + " ORDER BY structure_object_id, level_z, cell_y2, cell_x2",
                surfaceCellsByStructureId);
        loadCells(
                conn,
                ids,
                "SELECT structure_object_id, level_z, cell_x2, cell_y2"
                        + " FROM dungeon_structure_floor_cells"
                        + " WHERE structure_object_id IN %s"
                        + " ORDER BY structure_object_id, level_z, cell_y2, cell_x2",
                floorCellsByStructureId);

        Map<Long, StructureObject> result = new LinkedHashMap<>();
        for (Map.Entry<Long, Map<Integer, CellCoord>> structureEntry : anchorsByStructureId.entrySet()) {
            Long structureId = structureEntry.getKey();
            Map<Integer, StructureObject.PersistenceLevel> snapshotLevels = new LinkedHashMap<>();
            for (Map.Entry<Integer, CellCoord> levelEntry : structureEntry.getValue().entrySet()) {
                int levelZ = levelEntry.getKey();
                Set<CellCoord> surfaceCells = surfaceCellsByStructureId
                        .getOrDefault(structureId, Map.of())
                        .getOrDefault(levelZ, Set.of());
                if (surfaceCells.isEmpty()) {
                    throw new IllegalStateException(
                            "StructureObject " + structureId + " hat keine persistierten Surface-Zellen auf Ebene " + levelZ);
                }
                snapshotLevels.put(levelZ, new StructureObject.PersistenceLevel(
                        levelEntry.getValue(),
                        surfaceCells,
                        floorCellsByStructureId.getOrDefault(structureId, Map.of()).getOrDefault(levelZ, Set.of()),
                        wallsByStructureId.getOrDefault(structureId, Map.of()).getOrDefault(levelZ, List.of()),
                        doorsByStructureId.getOrDefault(structureId, Map.of()).getOrDefault(levelZ, List.of())));
            }
            StructureObject persistedStructure = StructureObject.fromPersistenceSnapshot(
                    new StructureObject.PersistenceSnapshot(snapshotLevels));
            if (persistedStructure.levelStructures().isEmpty()) {
                throw new IllegalStateException("StructureObject " + structureId + " hat keine persistierte Struktur");
            }
            result.put(structureId, persistedStructure);
        }
        return result.isEmpty() ? Map.of() : Map.copyOf(result);
    }

    private static StructureObject requiredStructure(StructureObject structure) {
        StructureObject resolvedStructure = structure == null ? StructureObject.empty() : structure;
        if (resolvedStructure.levelStructures().isEmpty()) {
            throw new IllegalArgumentException("StructureObject must not be empty");
        }
        return resolvedStructure;
    }

    private StructureObject assignPersistentIds(Connection conn, StructureObject structure) throws SQLException {
        StructureObject.PersistenceSnapshot snapshot = structure.persistenceSnapshot();
        if (snapshot.levelsByZ().isEmpty()) {
            return structure;
        }
        long nextWallId = nextId(conn, "dungeon_structure_walls", "wall_id");
        long nextDoorId = nextId(conn, "dungeon_structure_doors", "door_id");
        Map<Integer, StructureObject.PersistenceLevel> updatedLevels = new LinkedHashMap<>();
        boolean changed = false;
        for (Map.Entry<Integer, StructureObject.PersistenceLevel> entry : snapshot.levelsByZ().entrySet()) {
            StructureObject.PersistenceLevel level = entry.getValue();
            ArrayList<Wall> persistedWalls = new ArrayList<>();
            for (Wall wall : level.authoredWalls()) {
                if (wall == null || wall.isEmpty()) {
                    continue;
                }
                Wall persistedWall = wall;
                if (wall.wallId() == null || wall.wallId() <= 0L) {
                    persistedWall = wall.withWallId(nextWallId++);
                    changed = true;
                }
                persistedWalls.add(persistedWall);
            }
            ArrayList<Door> persistedDoors = new ArrayList<>();
            for (Door door : level.doors()) {
                if (door == null || door.isEmpty()) {
                    continue;
                }
                Door persistedDoor = door;
                if (door.doorId() == null || door.doorId() <= 0L) {
                    persistedDoor = door.withDoorId(nextDoorId++);
                    changed = true;
                }
                persistedDoors.add(persistedDoor);
            }
            updatedLevels.put(entry.getKey(), new StructureObject.PersistenceLevel(
                    level.anchorCell(),
                    level.surfaceCells(),
                    level.floorCells(),
                    persistedWalls,
                    persistedDoors));
        }
        return changed
                ? StructureObject.fromPersistenceSnapshot(new StructureObject.PersistenceSnapshot(updatedLevels))
                : structure;
    }

    private long insertStructureObject(Connection conn) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO dungeon_structure_objects DEFAULT VALUES",
                Statement.RETURN_GENERATED_KEYS)) {
            ps.executeUpdate();
            try (ResultSet rs = ps.getGeneratedKeys()) {
                if (!rs.next()) {
                    throw new SQLException("No key returned for dungeon_structure_objects insert");
                }
                return rs.getLong(1);
            }
        }
    }

    private void replaceStructure(
            Connection conn,
            long structureObjectId,
            StructureObject.PersistenceSnapshot snapshot
    ) throws SQLException {
        try (PreparedStatement deleteWalls = conn.prepareStatement(
                "DELETE FROM dungeon_structure_walls WHERE structure_object_id=?");
             PreparedStatement deleteDoors = conn.prepareStatement(
                     "DELETE FROM dungeon_structure_doors WHERE structure_object_id=?");
             PreparedStatement deleteSurfaceCells = conn.prepareStatement(
                     "DELETE FROM dungeon_structure_surface_cells WHERE structure_object_id=?");
             PreparedStatement deleteFloorCells = conn.prepareStatement(
                     "DELETE FROM dungeon_structure_floor_cells WHERE structure_object_id=?");
             PreparedStatement deleteLevels = conn.prepareStatement(
                     "DELETE FROM dungeon_structure_levels WHERE structure_object_id=?")) {
            deleteWalls.setLong(1, structureObjectId);
            deleteWalls.executeUpdate();
            deleteDoors.setLong(1, structureObjectId);
            deleteDoors.executeUpdate();
            deleteSurfaceCells.setLong(1, structureObjectId);
            deleteSurfaceCells.executeUpdate();
            deleteFloorCells.setLong(1, structureObjectId);
            deleteFloorCells.executeUpdate();
            deleteLevels.setLong(1, structureObjectId);
            deleteLevels.executeUpdate();
        }
        try (PreparedStatement insertLevel = conn.prepareStatement(
                "INSERT INTO dungeon_structure_levels(structure_object_id, level_z, anchor_x2, anchor_y2) VALUES(?,?,?,?)");
             PreparedStatement insertSurfaceCell = conn.prepareStatement(
                     "INSERT INTO dungeon_structure_surface_cells(structure_object_id, level_z, cell_x2, cell_y2) VALUES(?,?,?,?)");
             PreparedStatement insertFloorCell = conn.prepareStatement(
                     "INSERT INTO dungeon_structure_floor_cells(structure_object_id, level_z, cell_x2, cell_y2) VALUES(?,?,?,?)");
             PreparedStatement insertWall = conn.prepareStatement(
                     "INSERT INTO dungeon_structure_walls(structure_object_id, wall_id, level_z, wall_kind_id,"
                             + " anchor_start_x2, anchor_start_y2, anchor_end_x2, anchor_end_y2)"
                             + " VALUES(?,?,?,?,?,?,?,?)");
             PreparedStatement insertWallSegment = conn.prepareStatement(
                     "INSERT INTO dungeon_structure_wall_segments(wall_id, start_x2, start_y2, end_x2, end_y2)"
                             + " VALUES(?,?,?,?,?)");
             PreparedStatement insertDoor = conn.prepareStatement(
                     "INSERT INTO dungeon_structure_doors(structure_object_id, door_id, level_z,"
                             + " anchor_start_x2, anchor_start_y2, anchor_end_x2, anchor_end_y2, door_state)"
                             + " VALUES(?,?,?,?,?,?,?,?)");
             PreparedStatement insertDoorSegment = conn.prepareStatement(
                     "INSERT INTO dungeon_structure_door_segments(door_id, start_x2, start_y2, end_x2, end_y2)"
                             + " VALUES(?,?,?,?,?)")) {
            for (Map.Entry<Integer, StructureObject.PersistenceLevel> entry : snapshot.levelsByZ().entrySet()) {
                int levelZ = entry.getKey();
                StructureObject.PersistenceLevel level = entry.getValue();
                insertLevel.setLong(1, structureObjectId);
                insertLevel.setInt(2, levelZ);
                insertLevel.setInt(3, persistedCellX2(level.anchorCell()));
                insertLevel.setInt(4, persistedCellY2(level.anchorCell()));
                insertLevel.addBatch();
                addCells(insertSurfaceCell, structureObjectId, levelZ, level.surfaceCells());
                addCells(insertFloorCell, structureObjectId, levelZ, level.floorCells());
                addWalls(insertWall, insertWallSegment, structureObjectId, levelZ, level.authoredWalls());
                addDoors(insertDoor, insertDoorSegment, structureObjectId, levelZ, level.doors());
            }
            insertLevel.executeBatch();
            insertSurfaceCell.executeBatch();
            insertFloorCell.executeBatch();
            insertWall.executeBatch();
            insertWallSegment.executeBatch();
            insertDoor.executeBatch();
            insertDoorSegment.executeBatch();
        }
    }

    private static void addCells(
            PreparedStatement insertCell,
            long structureObjectId,
            int levelZ,
            Collection<CellCoord> cells
    ) throws SQLException {
        for (CellCoord cell : (cells == null ? List.<CellCoord>of() : cells).stream()
                .filter(Objects::nonNull)
                .sorted(CellCoord.ORDER)
                .toList()) {
            insertCell.setLong(1, structureObjectId);
            insertCell.setInt(2, levelZ);
            insertCell.setInt(3, persistedCellX2(cell));
            insertCell.setInt(4, persistedCellY2(cell));
            insertCell.addBatch();
        }
    }

    private static void addWalls(
            PreparedStatement insertWall,
            PreparedStatement insertWallSegment,
            long structureObjectId,
            int levelZ,
            Collection<Wall> walls
    ) throws SQLException {
        for (Wall wall : walls == null ? List.<Wall>of() : walls) {
            if (wall == null || wall.isEmpty() || wall.wallId() == null || wall.wallId() <= 0L) {
                throw new IllegalArgumentException("Persisted walls require a stable positive wall id");
            }
            GridSegment2x anchorSegment2x = wall.anchorSegment2x() == null ? wall.firstSegment2x() : wall.anchorSegment2x();
            insertWall.setLong(1, structureObjectId);
            insertWall.setLong(2, wall.wallId());
            insertWall.setInt(3, levelZ);
            insertWall.setLong(4, wall.wallKind().wallKindId());
            insertWall.setInt(5, anchorSegment2x.start().x2());
            insertWall.setInt(6, anchorSegment2x.start().y2());
            insertWall.setInt(7, anchorSegment2x.end().x2());
            insertWall.setInt(8, anchorSegment2x.end().y2());
            insertWall.addBatch();
            for (GridSegment2x segment2x : wall.segments2x().stream().sorted(GridSegment2x.ORDER).toList()) {
                insertWallSegment.setLong(1, wall.wallId());
                insertWallSegment.setInt(2, segment2x.start().x2());
                insertWallSegment.setInt(3, segment2x.start().y2());
                insertWallSegment.setInt(4, segment2x.end().x2());
                insertWallSegment.setInt(5, segment2x.end().y2());
                insertWallSegment.addBatch();
            }
        }
    }

    private static void addDoors(
            PreparedStatement insertDoor,
            PreparedStatement insertDoorSegment,
            long structureObjectId,
            int levelZ,
            Collection<Door> doors
    ) throws SQLException {
        for (Door door : doors == null ? List.<Door>of() : doors) {
            if (door == null || door.isEmpty() || door.doorId() == null || door.doorId() <= 0L) {
                throw new IllegalArgumentException("Persisted doors require a stable positive door id");
            }
            GridSegment2x anchorSegment2x = door.anchorSegment2x() == null ? door.firstSegment2x() : door.anchorSegment2x();
            insertDoor.setLong(1, structureObjectId);
            insertDoor.setLong(2, door.doorId());
            insertDoor.setInt(3, levelZ);
            insertDoor.setInt(4, anchorSegment2x.start().x2());
            insertDoor.setInt(5, anchorSegment2x.start().y2());
            insertDoor.setInt(6, anchorSegment2x.end().x2());
            insertDoor.setInt(7, anchorSegment2x.end().y2());
            insertDoor.setString(8, door.doorState().name());
            insertDoor.addBatch();
            for (GridSegment2x segment2x : door.segments2x().stream().sorted(GridSegment2x.ORDER).toList()) {
                insertDoorSegment.setLong(1, door.doorId());
                insertDoorSegment.setInt(2, segment2x.start().x2());
                insertDoorSegment.setInt(3, segment2x.start().y2());
                insertDoorSegment.setInt(4, segment2x.end().x2());
                insertDoorSegment.setInt(5, segment2x.end().y2());
                insertDoorSegment.addBatch();
            }
        }
    }

    private void loadLevelAnchors(
            Connection conn,
            List<Long> ids,
            Map<Long, Map<Integer, CellCoord>> anchorsByStructureId
    ) throws SQLException {
        String sql = "SELECT structure_object_id, level_z, anchor_x2, anchor_y2"
                + " FROM dungeon_structure_levels WHERE structure_object_id IN %s ORDER BY structure_object_id, level_z";
        try (PreparedStatement ps = conn.prepareStatement(sql.formatted(placeholders(ids.size())))) {
            bindIds(ps, ids);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    anchorsByStructureId.computeIfAbsent(rs.getLong("structure_object_id"), ignored -> new LinkedHashMap<>())
                            .put(rs.getInt("level_z"), requireStoredCellCenter(
                                    rs.getInt("anchor_x2"),
                                    rs.getInt("anchor_y2"),
                                    "structure anchor",
                                    rs.getLong("structure_object_id"),
                                    rs.getInt("level_z")));
                }
            }
        }
    }

    private static void loadCells(
            Connection conn,
            List<Long> ids,
            String sqlTemplate,
            Map<Long, Map<Integer, Set<CellCoord>>> cellsByStructureId
    ) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(sqlTemplate.formatted(placeholders(ids.size())))) {
            bindIds(ps, ids);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    cellsByStructureId.computeIfAbsent(rs.getLong("structure_object_id"), ignored -> new LinkedHashMap<>())
                            .computeIfAbsent(rs.getInt("level_z"), ignored -> new LinkedHashSet<>())
                            .add(requireStoredCellCenter(
                                    rs.getInt("cell_x2"),
                                    rs.getInt("cell_y2"),
                                    "structure cell",
                                    rs.getLong("structure_object_id"),
                                    rs.getInt("level_z")));
                }
            }
        }
    }

    private Map<Long, Map<Integer, List<Door>>> loadDoorsByStructureId(Connection conn, List<Long> ids) throws SQLException {
        String sql = "SELECT d.structure_object_id, d.door_id, d.level_z, d.anchor_start_x2, d.anchor_start_y2,"
                + " d.anchor_end_x2, d.anchor_end_y2, d.door_state, s.start_x2, s.start_y2, s.end_x2, s.end_y2"
                + " FROM dungeon_structure_doors d"
                + " JOIN dungeon_structure_door_segments s ON s.door_id=d.door_id"
                + " WHERE d.structure_object_id IN %s"
                + " ORDER BY d.structure_object_id, d.level_z, d.door_id, s.start_y2, s.start_x2, s.end_y2, s.end_x2";
        Map<Long, Map<Integer, LinkedHashMap<Long, MutableDoor>>> mutable = new LinkedHashMap<>();
        try (PreparedStatement ps = conn.prepareStatement(sql.formatted(placeholders(ids.size())))) {
            bindIds(ps, ids);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    long structureObjectId = rs.getLong("structure_object_id");
                    int levelZ = rs.getInt("level_z");
                    long doorId = rs.getLong("door_id");
                    GridSegment2x anchorSegment2x = new GridSegment2x(
                            GridPoint2x.raw(rs.getInt("anchor_start_x2"), rs.getInt("anchor_start_y2")),
                            GridPoint2x.raw(rs.getInt("anchor_end_x2"), rs.getInt("anchor_end_y2")));
                    Door.DoorState doorState = Door.DoorState.valueOf(rs.getString("door_state"));
                    LinkedHashMap<Long, MutableDoor> doorsById = mutable
                            .computeIfAbsent(structureObjectId, ignored -> new LinkedHashMap<>())
                            .computeIfAbsent(levelZ, ignored -> new LinkedHashMap<>());
                    MutableDoor mutableDoor = doorsById.computeIfAbsent(
                            doorId,
                            ignored -> new MutableDoor(doorId, anchorSegment2x, doorState));
                    mutableDoor.segments().add(new GridSegment2x(
                            GridPoint2x.raw(rs.getInt("start_x2"), rs.getInt("start_y2")),
                            GridPoint2x.raw(rs.getInt("end_x2"), rs.getInt("end_y2"))));
                }
            }
        }
        return immutableDoors(mutable);
    }

    private Map<Long, Map<Integer, List<Wall>>> loadWallsByStructureId(
            Connection conn,
            List<Long> ids,
            Map<Long, WallKind> wallKindsById
    ) throws SQLException {
        String sql = "SELECT w.structure_object_id, w.wall_id, w.level_z, w.wall_kind_id,"
                + " w.anchor_start_x2, w.anchor_start_y2, w.anchor_end_x2, w.anchor_end_y2,"
                + " s.start_x2, s.start_y2, s.end_x2, s.end_y2"
                + " FROM dungeon_structure_walls w"
                + " JOIN dungeon_structure_wall_segments s ON s.wall_id=w.wall_id"
                + " WHERE w.structure_object_id IN %s"
                + " ORDER BY w.structure_object_id, w.level_z, w.wall_id, s.start_y2, s.start_x2, s.end_y2, s.end_x2";
        Map<Long, Map<Integer, LinkedHashMap<Long, MutableWall>>> mutable = new LinkedHashMap<>();
        try (PreparedStatement ps = conn.prepareStatement(sql.formatted(placeholders(ids.size())))) {
            bindIds(ps, ids);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    long structureObjectId = rs.getLong("structure_object_id");
                    int levelZ = rs.getInt("level_z");
                    long wallId = rs.getLong("wall_id");
                    WallKind wallKind = wallKindsById.getOrDefault(rs.getLong("wall_kind_id"), WallKind.solid());
                    GridSegment2x anchorSegment2x = new GridSegment2x(
                            GridPoint2x.raw(rs.getInt("anchor_start_x2"), rs.getInt("anchor_start_y2")),
                            GridPoint2x.raw(rs.getInt("anchor_end_x2"), rs.getInt("anchor_end_y2")));
                    LinkedHashMap<Long, MutableWall> wallsById = mutable
                            .computeIfAbsent(structureObjectId, ignored -> new LinkedHashMap<>())
                            .computeIfAbsent(levelZ, ignored -> new LinkedHashMap<>());
                    MutableWall mutableWall = wallsById.computeIfAbsent(
                            wallId,
                            ignored -> new MutableWall(wallId, anchorSegment2x, wallKind));
                    mutableWall.segments().add(new GridSegment2x(
                            GridPoint2x.raw(rs.getInt("start_x2"), rs.getInt("start_y2")),
                            GridPoint2x.raw(rs.getInt("end_x2"), rs.getInt("end_y2"))));
                }
            }
        }
        Map<Long, Map<Integer, List<Wall>>> result = new LinkedHashMap<>();
        for (Map.Entry<Long, Map<Integer, LinkedHashMap<Long, MutableWall>>> structureEntry : mutable.entrySet()) {
            Map<Integer, List<Wall>> levels = new LinkedHashMap<>();
            for (Map.Entry<Integer, LinkedHashMap<Long, MutableWall>> levelEntry : structureEntry.getValue().entrySet()) {
                levels.put(levelEntry.getKey(), levelEntry.getValue().values().stream()
                        .map(MutableWall::toWall)
                        .sorted(Comparator.comparing(Wall::anchorSegment2x, GridSegment2x.ORDER))
                        .toList());
            }
            result.put(structureEntry.getKey(), Map.copyOf(levels));
        }
        return result.isEmpty() ? Map.of() : Map.copyOf(result);
    }

    private static Map<Long, Map<Integer, List<Door>>> immutableDoors(
            Map<Long, Map<Integer, LinkedHashMap<Long, MutableDoor>>> mutable
    ) {
        Map<Long, Map<Integer, List<Door>>> result = new LinkedHashMap<>();
        for (Map.Entry<Long, Map<Integer, LinkedHashMap<Long, MutableDoor>>> ownerEntry : mutable.entrySet()) {
            Map<Integer, List<Door>> levels = new LinkedHashMap<>();
            for (Map.Entry<Integer, LinkedHashMap<Long, MutableDoor>> levelEntry : ownerEntry.getValue().entrySet()) {
                List<Door> doors = levelEntry.getValue().values().stream()
                        .map(MutableDoor::toDoor)
                        .sorted(Comparator.comparing(Door::anchorSegment2x, GridSegment2x.ORDER))
                        .toList();
                levels.put(levelEntry.getKey(), doors);
            }
            result.put(ownerEntry.getKey(), Map.copyOf(levels));
        }
        return result.isEmpty() ? Map.of() : Map.copyOf(result);
    }

    private static long nextId(Connection conn, String table, String column) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT COALESCE(MAX(" + column + "), 0) + 1 FROM " + table);
             ResultSet rs = ps.executeQuery()) {
            if (!rs.next()) {
                throw new SQLException("Nächste Id konnte nicht bestimmt werden: " + table + "." + column);
            }
            return rs.getLong(1);
        }
    }

    private static List<Long> sanitizedIds(Collection<Long> ids) {
        if (ids == null || ids.isEmpty()) {
            return List.of();
        }
        return ids.stream()
                .filter(Objects::nonNull)
                .filter(id -> id > 0L)
                .distinct()
                .sorted()
                .toList();
    }

    private static void bindIds(PreparedStatement ps, List<Long> ids) throws SQLException {
        for (int index = 0; index < ids.size(); index++) {
            ps.setLong(index + 1, ids.get(index));
        }
    }

    private static String placeholders(int count) {
        return "(" + java.util.stream.IntStream.range(0, count)
                .mapToObj(ignored -> "?")
                .collect(Collectors.joining(",")) + ")";
    }

    private static int persistedCellX2(CellCoord cell) {
        CellCoord resolvedCell = cell == null ? new CellCoord(0, 0) : cell;
        return GridPoint2x.cell(resolvedCell).x2();
    }

    private static int persistedCellY2(CellCoord cell) {
        CellCoord resolvedCell = cell == null ? new CellCoord(0, 0) : cell;
        return GridPoint2x.cell(resolvedCell).y2();
    }

    private static CellCoord requireStoredCellCenter(int persistedX2, int persistedY2, String label, long id, int levelZ) {
        return GridPoint2x.raw(persistedX2, persistedY2).asCell().orElseThrow(() -> new IllegalArgumentException(
                label + " must be a tile center for structure " + id + " at level " + levelZ));
    }

    private record MutableDoor(
            long doorId,
            GridSegment2x anchorSegment2x,
            Door.DoorState doorState,
            LinkedHashSet<GridSegment2x> segments
    ) {
        private MutableDoor(long doorId, GridSegment2x anchorSegment2x, Door.DoorState doorState) {
            this(doorId, anchorSegment2x, doorState, new LinkedHashSet<>());
        }

        private Door toDoor() {
            return Door.fromSegments(doorId, segments, anchorSegment2x, doorState);
        }
    }

    private record MutableWall(
            long wallId,
            GridSegment2x anchorSegment2x,
            WallKind wallKind,
            LinkedHashSet<GridSegment2x> segments
    ) {
        private MutableWall(long wallId, GridSegment2x anchorSegment2x, WallKind wallKind) {
            this(wallId, anchorSegment2x, wallKind, new LinkedHashSet<>());
        }

        private Wall toWall() {
            return Wall.fromSegments(wallId, segments, anchorSegment2x, wallKind);
        }
    }
}
