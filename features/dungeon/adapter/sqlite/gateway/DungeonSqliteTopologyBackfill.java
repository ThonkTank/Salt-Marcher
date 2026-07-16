package features.dungeon.adapter.sqlite.gateway;

import features.dungeon.adapter.sqlite.model.DungeonPersistenceSchema;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;

final class DungeonSqliteTopologyBackfill {

    private static final String SQL_FROM = " FROM ";
    private static final String INSERT_OR_IGNORE_INTO = "INSERT OR IGNORE INTO ";
    private static final String TOPOLOGY_INSERT_COLUMNS =
            "(dungeon_map_id, element_kind, element_id, cluster_id, corridor_id, label, sort_order)";
    private static final DungeonSqliteBoundaryTopologyBackfill BOUNDARY_BACKFILL =
            new DungeonSqliteBoundaryTopologyBackfill();
    private static final DungeonSqliteOpenBoundaryTopologyCleanup OPEN_BOUNDARY_TOPOLOGY_CLEANUP =
            new DungeonSqliteOpenBoundaryTopologyCleanup();
    private static final DungeonSqliteSeedMapCleanup SEED_MAP_CLEANUP =
            new DungeonSqliteSeedMapCleanup();

    void apply(Connection connection, boolean topologyTableExisted) throws SQLException {
        boolean topologyNeedsBackfill = !topologyTableExisted || topologyTableIsEmpty(connection);
        if (topologyNeedsBackfill) {
            backfillTopologyElements(connection);
        } else if (OPEN_BOUNDARY_TOPOLOGY_CLEANUP.hasStaleOpenBoundaryTopologyRefs(connection)) {
            OPEN_BOUNDARY_TOPOLOGY_CLEANUP.apply(connection);
        }
        SEED_MAP_CLEANUP.apply(connection);
    }

    private static boolean topologyTableIsEmpty(Connection connection) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT 1 FROM " + DungeonPersistenceSchema.TOPOLOGY_ELEMENTS_TABLE + " LIMIT 1");
             ResultSet resultSet = statement.executeQuery()) {
            return !resultSet.next();
        }
    }

    private static void backfillTopologyElements(Connection connection) throws SQLException {
        backfillRoomTopologyElements(connection);
        backfillCorridorTopologyElements(connection);
        backfillStairTopologyElements(connection);
        backfillTransitionTopologyElements(connection);
        BOUNDARY_BACKFILL.apply(connection);
    }

    private static void backfillRoomTopologyElements(Connection connection) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                INSERT_OR_IGNORE_INTO + DungeonPersistenceSchema.TOPOLOGY_ELEMENTS_TABLE
                        + TOPOLOGY_INSERT_COLUMNS
                        + " SELECT dungeon_map_id, 'ROOM', room_id, cluster_id, NULL, name, room_id"
                        + SQL_FROM + DungeonPersistenceSchema.ROOMS_TABLE)) {
            statement.executeUpdate();
        }
    }

    private static void backfillCorridorTopologyElements(Connection connection) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                INSERT_OR_IGNORE_INTO + DungeonPersistenceSchema.TOPOLOGY_ELEMENTS_TABLE
                        + TOPOLOGY_INSERT_COLUMNS
                        + " SELECT dungeon_map_id, 'CORRIDOR', corridor_id, NULL, corridor_id,"
                        + " 'Corridor ' || corridor_id, corridor_id"
                        + SQL_FROM + DungeonPersistenceSchema.CORRIDORS_TABLE)) {
            statement.executeUpdate();
        }
    }

    private static void backfillStairTopologyElements(Connection connection) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                INSERT_OR_IGNORE_INTO + DungeonPersistenceSchema.TOPOLOGY_ELEMENTS_TABLE
                        + TOPOLOGY_INSERT_COLUMNS
                        + " SELECT dungeon_map_id, 'STAIR', stair_id, NULL, corridor_id,"
                        + " COALESCE(name, 'Stair ' || stair_id), stair_id"
                        + SQL_FROM + DungeonPersistenceSchema.STAIRS_TABLE)) {
            statement.executeUpdate();
        }
    }

    private static void backfillTransitionTopologyElements(Connection connection) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                INSERT_OR_IGNORE_INTO + DungeonPersistenceSchema.TOPOLOGY_ELEMENTS_TABLE
                        + TOPOLOGY_INSERT_COLUMNS
                        + " SELECT dungeon_map_id, 'TRANSITION', transition_id, NULL, NULL,"
                        + " 'Uebergang ' || transition_id, transition_id"
                        + SQL_FROM + DungeonPersistenceSchema.TRANSITIONS_TABLE)) {
            statement.executeUpdate();
        }
    }

}
