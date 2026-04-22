package src.data.dungeon.gateway.local;

import src.data.dungeon.model.DungeonPersistenceSchema;
import src.data.persistencecore.sqlite.SqliteSchemaColumnSupport;
import org.jspecify.annotations.Nullable;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.Locale;

final class DungeonSqliteSchemaManager {

    void ensureSchema(Connection connection) throws SQLException {
        boolean topologyTableExisted = SqliteSchemaColumnSupport.hasTable(
                connection,
                DungeonPersistenceSchema.TOPOLOGY_ELEMENTS_TABLE);
        try (Statement statement = connection.createStatement()) {
            for (String createTableSql : DungeonPersistenceSchema.CREATE_TABLE_SQL) {
                statement.execute(createTableSql);
            }
        }
        boolean roomClusterColumnsAdded = ensureRoomClusterCompatibilityColumns(connection);
        boolean transitionColumnsAdded = ensureTransitionCompatibilityColumns(connection);
        ensureGeneralCompatibilityColumns(connection);
        if (roomClusterColumnsAdded || hasLegacyRoomClusterStructureObjectColumn(connection)) {
            backfillLegacyRoomClusterCenters(connection);
        }
        removeLegacyRoomClusterStructureObjectColumn(connection);
        if (transitionColumnsAdded) {
            backfillLegacyTransitionAnchors(connection);
        }
        backfillTopologyElements(connection, topologyTableExisted);
        removeObsoleteSeedMaps(connection);
    }

    private static void ensureGeneralCompatibilityColumns(Connection connection) throws SQLException {
        ensureColumn(
                connection,
                DungeonPersistenceSchema.ROOMS_TABLE,
                "visual_description",
                DungeonPersistenceSchema.ADD_DUNGEON_ROOMS_VISUAL_DESCRIPTION_COLUMN_SQL);
        ensureColumn(
                connection,
                DungeonPersistenceSchema.STAIRS_TABLE,
                "shape",
                DungeonPersistenceSchema.ADD_DUNGEON_STAIRS_SHAPE_COLUMN_SQL);
        ensureColumn(
                connection,
                DungeonPersistenceSchema.STAIRS_TABLE,
                "direction",
                DungeonPersistenceSchema.ADD_DUNGEON_STAIRS_DIRECTION_COLUMN_SQL);
        ensureColumn(
                connection,
                DungeonPersistenceSchema.STAIRS_TABLE,
                "dimension1",
                DungeonPersistenceSchema.ADD_DUNGEON_STAIRS_DIMENSION1_COLUMN_SQL);
        ensureColumn(
                connection,
                DungeonPersistenceSchema.STAIRS_TABLE,
                "dimension2",
                DungeonPersistenceSchema.ADD_DUNGEON_STAIRS_DIMENSION2_COLUMN_SQL);
        ensureColumn(
                connection,
                DungeonPersistenceSchema.STAIRS_TABLE,
                "corridor_id",
                DungeonPersistenceSchema.ADD_DUNGEON_STAIRS_CORRIDOR_ID_COLUMN_SQL);
        ensureColumn(
                connection,
                DungeonPersistenceSchema.ROOM_CLUSTER_EDGES_TABLE,
                "topology_element_id",
                DungeonPersistenceSchema.ADD_DUNGEON_ROOM_CLUSTER_EDGES_TOPOLOGY_ELEMENT_ID_COLUMN_SQL);
        ensureColumn(
                connection,
                DungeonPersistenceSchema.CORRIDOR_DOOR_OVERRIDES_TABLE,
                "topology_element_id",
                DungeonPersistenceSchema.ADD_DUNGEON_CORRIDOR_DOOR_OVERRIDES_TOPOLOGY_ELEMENT_ID_COLUMN_SQL);
    }

    private static boolean ensureRoomClusterCompatibilityColumns(Connection connection) throws SQLException {
        boolean added = false;
        added |= ensureColumn(
                connection,
                DungeonPersistenceSchema.ROOM_CLUSTERS_TABLE,
                "center_x",
                DungeonPersistenceSchema.ADD_DUNGEON_ROOM_CLUSTERS_CENTER_X_COLUMN_SQL);
        added |= ensureColumn(
                connection,
                DungeonPersistenceSchema.ROOM_CLUSTERS_TABLE,
                "center_y",
                DungeonPersistenceSchema.ADD_DUNGEON_ROOM_CLUSTERS_CENTER_Y_COLUMN_SQL);
        added |= ensureColumn(
                connection,
                DungeonPersistenceSchema.ROOM_CLUSTERS_TABLE,
                "level_z",
                DungeonPersistenceSchema.ADD_DUNGEON_ROOM_CLUSTERS_LEVEL_Z_COLUMN_SQL);
        return added;
    }

    private static boolean ensureTransitionCompatibilityColumns(Connection connection) throws SQLException {
        boolean added = false;
        added |= ensureColumn(
                connection,
                DungeonPersistenceSchema.TRANSITIONS_TABLE,
                "cell_x",
                DungeonPersistenceSchema.ADD_DUNGEON_TRANSITIONS_CELL_X_COLUMN_SQL);
        added |= ensureColumn(
                connection,
                DungeonPersistenceSchema.TRANSITIONS_TABLE,
                "cell_y",
                DungeonPersistenceSchema.ADD_DUNGEON_TRANSITIONS_CELL_Y_COLUMN_SQL);
        added |= ensureColumn(
                connection,
                DungeonPersistenceSchema.TRANSITIONS_TABLE,
                "level_z",
                DungeonPersistenceSchema.ADD_DUNGEON_TRANSITIONS_LEVEL_Z_COLUMN_SQL);
        return added;
    }

    private static boolean ensureColumn(
            Connection connection,
            String tableName,
            String columnName,
            String alterTableSql
    ) throws SQLException {
        if (SqliteSchemaColumnSupport.hasColumn(connection, tableName, columnName)) {
            return false;
        }
        try (Statement statement = connection.createStatement()) {
            statement.execute(alterTableSql);
        }
        return true;
    }

    private static void backfillLegacyRoomClusterCenters(Connection connection) throws SQLException {
        if (!SqliteSchemaColumnSupport.hasTable(connection, DungeonPersistenceSchema.LEGACY_STRUCTURE_LEVELS_TABLE)
                || !hasLegacyRoomClusterStructureObjectColumn(connection)) {
            return;
        }
        String roomClusters = DungeonPersistenceSchema.ROOM_CLUSTERS_TABLE;
        String structureLevels = DungeonPersistenceSchema.LEGACY_STRUCTURE_LEVELS_TABLE;
        try (Statement statement = connection.createStatement()) {
            statement.executeUpdate(
                    "UPDATE " + roomClusters
                            + " SET center_x = COALESCE(("
                            + "SELECT CAST(anchor_x2 / 2 AS INTEGER) FROM " + structureLevels
                            + " WHERE " + structureLevels + ".structure_object_id = "
                            + roomClusters + ".structure_object_id"
                            + " ORDER BY level_z LIMIT 1), center_x),"
                            + " center_y = COALESCE(("
                            + "SELECT CAST(anchor_y2 / 2 AS INTEGER) FROM " + structureLevels
                            + " WHERE " + structureLevels + ".structure_object_id = "
                            + roomClusters + ".structure_object_id"
                            + " ORDER BY level_z LIMIT 1), center_y),"
                            + " level_z = COALESCE(("
                            + "SELECT level_z FROM " + structureLevels
                            + " WHERE " + structureLevels + ".structure_object_id = "
                            + roomClusters + ".structure_object_id"
                            + " ORDER BY level_z LIMIT 1), level_z)"
                            + " WHERE EXISTS (SELECT 1 FROM " + structureLevels
                            + " WHERE " + structureLevels + ".structure_object_id = "
                            + roomClusters + ".structure_object_id)");
        }
    }

    private static boolean hasLegacyRoomClusterStructureObjectColumn(Connection connection) throws SQLException {
        return SqliteSchemaColumnSupport.hasColumn(
                connection,
                DungeonPersistenceSchema.ROOM_CLUSTERS_TABLE,
                "structure_object_id");
    }

    private static void removeLegacyRoomClusterStructureObjectColumn(Connection connection) throws SQLException {
        if (!hasLegacyRoomClusterStructureObjectColumn(connection)) {
            return;
        }
        try (Statement statement = connection.createStatement()) {
            statement.execute("PRAGMA foreign_keys=OFF");
            statement.execute("PRAGMA legacy_alter_table=ON");
            statement.execute(DungeonPersistenceSchema.DROP_LEGACY_ROOM_CLUSTERS_STRUCTURE_OBJECT_TABLE_SQL);
            statement.execute(DungeonPersistenceSchema.RENAME_ROOM_CLUSTERS_TO_LEGACY_STRUCTURE_OBJECT_TABLE_SQL);
            statement.execute(DungeonPersistenceSchema.CREATE_DUNGEON_ROOM_CLUSTERS_TABLE_SQL);
            statement.executeUpdate(DungeonPersistenceSchema.COPY_LEGACY_STRUCTURE_OBJECT_CLUSTERS_TO_ROOM_CLUSTERS_SQL);
            statement.execute(DungeonPersistenceSchema.DROP_LEGACY_ROOM_CLUSTERS_STRUCTURE_OBJECT_TABLE_SQL);
            statement.execute("PRAGMA legacy_alter_table=OFF");
            statement.execute("PRAGMA foreign_keys=ON");
        } catch (SQLException exception) {
            try (Statement statement = connection.createStatement()) {
                statement.execute("PRAGMA legacy_alter_table=OFF");
                statement.execute("PRAGMA foreign_keys=ON");
            }
            throw exception;
        }
    }

    private static void backfillLegacyTransitionAnchors(Connection connection) throws SQLException {
        if (!SqliteSchemaColumnSupport.hasColumn(connection, DungeonPersistenceSchema.TRANSITIONS_TABLE, "stair_anchor_cell_x")
                || !SqliteSchemaColumnSupport.hasColumn(connection, DungeonPersistenceSchema.TRANSITIONS_TABLE, "stair_anchor_cell_y")
                || !SqliteSchemaColumnSupport.hasColumn(connection, DungeonPersistenceSchema.TRANSITIONS_TABLE, "stair_anchor_level_z")) {
            return;
        }
        try (Statement statement = connection.createStatement()) {
            statement.executeUpdate(
                    "UPDATE " + DungeonPersistenceSchema.TRANSITIONS_TABLE
                            + " SET cell_x = COALESCE(cell_x, stair_anchor_cell_x),"
                            + " cell_y = COALESCE(cell_y, stair_anchor_cell_y),"
                            + " level_z = COALESCE(level_z, stair_anchor_level_z)"
                            + " WHERE stair_anchor_cell_x IS NOT NULL");
        }
    }

    private static void backfillTopologyElements(Connection connection, boolean topologyTableExisted)
            throws SQLException {
        if (topologyTableExisted && !topologyTableIsEmpty(connection)) {
            return;
        }
        backfillRoomTopologyElements(connection);
        backfillCorridorTopologyElements(connection);
        backfillStairTopologyElements(connection);
        backfillTransitionTopologyElements(connection);
        backfillClusterBoundaryTopologyElements(connection);
        backfillCorridorDoorTopologyElements(connection);
    }

    private static boolean topologyTableIsEmpty(Connection connection) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT 1 FROM " + DungeonPersistenceSchema.TOPOLOGY_ELEMENTS_TABLE + " LIMIT 1");
             ResultSet resultSet = statement.executeQuery()) {
            return !resultSet.next();
        }
    }

    private static void removeObsoleteSeedMaps(Connection connection) throws SQLException {
        String maps = DungeonPersistenceSchema.MAPS_TABLE;
        String rooms = DungeonPersistenceSchema.ROOMS_TABLE;
        String clusters = DungeonPersistenceSchema.ROOM_CLUSTERS_TABLE;
        String corridors = DungeonPersistenceSchema.CORRIDORS_TABLE;
        String stairs = DungeonPersistenceSchema.STAIRS_TABLE;
        String transitions = DungeonPersistenceSchema.TRANSITIONS_TABLE;
        String exits = DungeonPersistenceSchema.ROOM_EXIT_DESCRIPTIONS_TABLE;
        try (Statement statement = connection.createStatement()) {
            statement.executeUpdate(
                    "DELETE FROM " + maps
                            + " WHERE dungeon_map_id IN ("
                            + " SELECT m.dungeon_map_id FROM " + maps + " m"
                            + " WHERE m.name IN ('Dungeon', 'Dungeon Bastion', 'Dungeon Map')"
                            + " AND (SELECT COUNT(*) FROM " + rooms
                            + " r WHERE r.dungeon_map_id=m.dungeon_map_id)=1"
                            + " AND (SELECT COUNT(*) FROM " + clusters
                            + " c WHERE c.dungeon_map_id=m.dungeon_map_id)=1"
                            + " AND EXISTS (SELECT 1 FROM " + rooms
                            + " r WHERE r.dungeon_map_id=m.dungeon_map_id"
                            + " AND r.name='Entry Hall'"
                            + " AND r.component_x=2 AND r.component_y=2 AND r.level_z=0"
                            + " AND (r.visual_description IS NULL OR TRIM(r.visual_description)=''))"
                            + " AND EXISTS (SELECT 1 FROM " + clusters
                            + " c WHERE c.dungeon_map_id=m.dungeon_map_id"
                            + " AND c.center_x=2 AND c.center_y=2 AND c.level_z=0)"
                            + " AND NOT EXISTS (SELECT 1 FROM " + corridors
                            + " c WHERE c.dungeon_map_id=m.dungeon_map_id)"
                            + " AND NOT EXISTS (SELECT 1 FROM " + stairs
                            + " s WHERE s.dungeon_map_id=m.dungeon_map_id)"
                            + " AND NOT EXISTS (SELECT 1 FROM " + transitions
                            + " t WHERE t.dungeon_map_id=m.dungeon_map_id)"
                            + " AND NOT EXISTS (SELECT 1 FROM " + exits
                            + " x JOIN " + rooms + " r ON r.room_id=x.room_id"
                            + " WHERE r.dungeon_map_id=m.dungeon_map_id"
                            + " AND x.description IS NOT NULL AND TRIM(x.description) <> '')"
                            + ")");
        }
    }

    private static void backfillRoomTopologyElements(Connection connection) throws SQLException {
        try (Statement statement = connection.createStatement()) {
            statement.executeUpdate(
                    "INSERT OR IGNORE INTO " + DungeonPersistenceSchema.TOPOLOGY_ELEMENTS_TABLE
                            + "(dungeon_map_id, element_kind, element_id, cluster_id, corridor_id, label, sort_order)"
                            + " SELECT dungeon_map_id, 'ROOM', room_id, cluster_id, NULL, name, room_id"
                            + " FROM " + DungeonPersistenceSchema.ROOMS_TABLE);
        }
    }

    private static void backfillCorridorTopologyElements(Connection connection) throws SQLException {
        try (Statement statement = connection.createStatement()) {
            statement.executeUpdate(
                    "INSERT OR IGNORE INTO " + DungeonPersistenceSchema.TOPOLOGY_ELEMENTS_TABLE
                            + "(dungeon_map_id, element_kind, element_id, cluster_id, corridor_id, label, sort_order)"
                            + " SELECT dungeon_map_id, 'CORRIDOR', corridor_id, NULL, corridor_id,"
                            + " 'Corridor ' || corridor_id, corridor_id"
                            + " FROM " + DungeonPersistenceSchema.CORRIDORS_TABLE);
        }
    }

    private static void backfillStairTopologyElements(Connection connection) throws SQLException {
        try (Statement statement = connection.createStatement()) {
            statement.executeUpdate(
                    "INSERT OR IGNORE INTO " + DungeonPersistenceSchema.TOPOLOGY_ELEMENTS_TABLE
                            + "(dungeon_map_id, element_kind, element_id, cluster_id, corridor_id, label, sort_order)"
                            + " SELECT dungeon_map_id, 'STAIR', stair_id, NULL, corridor_id,"
                            + " COALESCE(name, 'Stair ' || stair_id), stair_id"
                            + " FROM " + DungeonPersistenceSchema.STAIRS_TABLE);
        }
    }

    private static void backfillTransitionTopologyElements(Connection connection) throws SQLException {
        try (Statement statement = connection.createStatement()) {
            statement.executeUpdate(
                    "INSERT OR IGNORE INTO " + DungeonPersistenceSchema.TOPOLOGY_ELEMENTS_TABLE
                            + "(dungeon_map_id, element_kind, element_id, cluster_id, corridor_id, label, sort_order)"
                            + " SELECT dungeon_map_id, 'TRANSITION', transition_id, NULL, NULL,"
                            + " 'Uebergang ' || transition_id, transition_id"
                            + " FROM " + DungeonPersistenceSchema.TRANSITIONS_TABLE);
        }
    }

    private static void backfillClusterBoundaryTopologyElements(Connection connection) throws SQLException {
        String selectSql = "SELECT c.dungeon_map_id, e.cluster_id, c.center_x, c.center_y,"
                + " e.level_z, e.cell_x, e.cell_y, e.edge_direction, e.edge_type"
                + " FROM " + DungeonPersistenceSchema.ROOM_CLUSTER_EDGES_TABLE + " e"
                + " JOIN " + DungeonPersistenceSchema.ROOM_CLUSTERS_TABLE + " c ON c.cluster_id=e.cluster_id";
        try (PreparedStatement select = connection.prepareStatement(selectSql);
             ResultSet resultSet = select.executeQuery();
             PreparedStatement insert = topologyInsert(connection);
             PreparedStatement update = connection.prepareStatement(
                     "UPDATE " + DungeonPersistenceSchema.ROOM_CLUSTER_EDGES_TABLE
                             + " SET topology_element_id=?"
                             + " WHERE cluster_id=? AND level_z=? AND cell_x=? AND cell_y=? AND edge_direction=?")) {
            int sortOrder = 0;
            while (resultSet.next()) {
                long elementId = boundaryStableId(
                        resultSet.getInt("center_x") + resultSet.getInt("cell_x"),
                        resultSet.getInt("center_y") + resultSet.getInt("cell_y"),
                        resultSet.getInt("level_z"),
                        resultSet.getString("edge_direction"));
                String kind = boundaryKind(resultSet.getString("edge_type"));
                insertTopologyElement(
                        insert,
                        resultSet.getLong("dungeon_map_id"),
                        kind,
                        elementId,
                        resultSet.getLong("cluster_id"),
                        null,
                        labelFor(kind),
                        sortOrder++);
                update.setLong(1, elementId);
                update.setLong(2, resultSet.getLong("cluster_id"));
                update.setInt(3, resultSet.getInt("level_z"));
                update.setInt(4, resultSet.getInt("cell_x"));
                update.setInt(5, resultSet.getInt("cell_y"));
                update.setString(6, resultSet.getString("edge_direction"));
                update.addBatch();
            }
            insert.executeBatch();
            update.executeBatch();
        }
    }

    private static void backfillCorridorDoorTopologyElements(Connection connection) throws SQLException {
        String selectSql = "SELECT c.dungeon_map_id, d.corridor_id, d.room_id, d.cluster_id,"
                + " rc.center_x, rc.center_y, rc.level_z,"
                + " d.relative_cell_x, d.relative_cell_y, d.edge_direction"
                + " FROM " + DungeonPersistenceSchema.CORRIDOR_DOOR_OVERRIDES_TABLE + " d"
                + " JOIN " + DungeonPersistenceSchema.CORRIDORS_TABLE + " c ON c.corridor_id=d.corridor_id"
                + " JOIN " + DungeonPersistenceSchema.ROOM_CLUSTERS_TABLE + " rc ON rc.cluster_id=d.cluster_id";
        try (PreparedStatement select = connection.prepareStatement(selectSql);
             ResultSet resultSet = select.executeQuery();
             PreparedStatement insert = topologyInsert(connection);
             PreparedStatement update = connection.prepareStatement(
                     "UPDATE " + DungeonPersistenceSchema.CORRIDOR_DOOR_OVERRIDES_TABLE
                             + " SET topology_element_id=? WHERE corridor_id=? AND room_id=?")) {
            int sortOrder = 0;
            while (resultSet.next()) {
                long elementId = boundaryStableId(
                        resultSet.getInt("center_x") + resultSet.getInt("relative_cell_x"),
                        resultSet.getInt("center_y") + resultSet.getInt("relative_cell_y"),
                        resultSet.getInt("level_z"),
                        resultSet.getString("edge_direction"));
                insertTopologyElement(
                        insert,
                        resultSet.getLong("dungeon_map_id"),
                        "DOOR",
                        elementId,
                        resultSet.getLong("cluster_id"),
                        resultSet.getLong("corridor_id"),
                        "Door " + elementId,
                        sortOrder++);
                update.setLong(1, elementId);
                update.setLong(2, resultSet.getLong("corridor_id"));
                update.setLong(3, resultSet.getLong("room_id"));
                update.addBatch();
            }
            insert.executeBatch();
            update.executeBatch();
        }
    }

    private static PreparedStatement topologyInsert(Connection connection) throws SQLException {
        return connection.prepareStatement(
                "INSERT OR REPLACE INTO " + DungeonPersistenceSchema.TOPOLOGY_ELEMENTS_TABLE
                        + "(dungeon_map_id, element_kind, element_id, cluster_id, corridor_id, label, sort_order)"
                        + " VALUES(?,?,?,?,?,?,?)");
    }

    private static void insertTopologyElement(
            PreparedStatement statement,
            long mapId,
            String kind,
            long elementId,
            @Nullable Long clusterId,
            @Nullable Long corridorId,
            String label,
            int sortOrder
    ) throws SQLException {
        statement.setLong(1, mapId);
        statement.setString(2, kind);
        statement.setLong(3, elementId);
        DungeonSqliteStatementSupport.setNullableLong(statement, 4, clusterId);
        DungeonSqliteStatementSupport.setNullableLong(statement, 5, corridorId);
        statement.setString(6, label);
        statement.setInt(7, sortOrder);
        statement.addBatch();
    }

    private static String boundaryKind(String value) {
        return "DOOR".equalsIgnoreCase(value == null ? "" : value.trim()) ? "DOOR" : "WALL";
    }

    private static String labelFor(String kind) {
        return "DOOR".equals(kind) ? "Door" : "Wall";
    }

    private static long boundaryStableId(int q, int r, int level, String direction) {
        DirectionStep step = DirectionStep.from(direction);
        Cell first = step.start(q, r, level);
        Cell second = step.end(q, r, level);
        Cell lower = compareCells(first, second) <= 0 ? first : second;
        Cell upper = lower.equals(first) ? second : first;
        long hash = 17L;
        hash = 31L * hash + cellHash(lower);
        hash = 31L * hash + cellHash(upper);
        return Math.max(1L, Math.abs(hash));
    }

    private static int compareCells(Cell left, Cell right) {
        int levelComparison = Integer.compare(left.level(), right.level());
        if (levelComparison != 0) {
            return levelComparison;
        }
        int rComparison = Integer.compare(left.r(), right.r());
        return rComparison != 0 ? rComparison : Integer.compare(left.q(), right.q());
    }

    private static long cellHash(Cell cell) {
        long hash = 17L;
        hash = 31L * hash + cell.q();
        hash = 31L * hash + cell.r();
        hash = 31L * hash + cell.level();
        return hash;
    }

    private record Cell(int q, int r, int level) {
    }

    private record DirectionStep(int startDeltaQ, int startDeltaR, int endDeltaQ, int endDeltaR) {

        private static DirectionStep from(String direction) {
            return switch ((direction == null ? "NORTH" : direction.trim()).toUpperCase(Locale.ROOT)) {
                case "EAST" -> new DirectionStep(1, 0, 1, 1);
                case "SOUTH" -> new DirectionStep(0, 1, 1, 1);
                case "WEST" -> new DirectionStep(0, 0, 0, 1);
                default -> new DirectionStep(0, 0, 1, 0);
            };
        }

        private Cell start(int q, int r, int level) {
            return new Cell(q + startDeltaQ, r + startDeltaR, level);
        }

        private Cell end(int q, int r, int level) {
            return new Cell(q + endDeltaQ, r + endDeltaR, level);
        }
    }
}
