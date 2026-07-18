package features.dungeon.adapter.sqlite.gateway;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.LinkedHashSet;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import platform.diagnostics.NoopDiagnostics;
import platform.persistence.SqliteDatabase;

final class DungeonCanonicalSchemaMigrationTest {

    @Test
    void versionThreeDiscardsOnlyDungeonRowsAndInstallsTheCanonicalSchema(@TempDir Path tempDir)
            throws Exception {
        Path databasePath = tempDir.resolve("migration.db");
        createVersionTwoDatabase(databasePath);

        try (SqliteDatabase database = new SqliteDatabase(databasePath, NoopDiagnostics.INSTANCE)) {
            DungeonSqliteGateway gateway = new DungeonSqliteGateway(database);
            assertTrue(gateway.searchMapHeaders("").isEmpty(),
                    "the destructive migration must not retain pre-v3 Dungeon rows");
        }

        try (Connection connection = open(databasePath)) {
            assertEquals(3, scalarInt(connection,
                    "SELECT version FROM sm_schema_versions WHERE owner='dungeon'"));
            assertEquals("party-kept", scalarText(connection, "SELECT payload FROM party_guard"));
            assertEquals("hex-kept", scalarText(connection, "SELECT payload FROM hex_guard"));

            assertFalse(tableExists(connection, "dungeon_room_floors"));
            assertFalse(tableExists(connection, "dungeon_room_cluster_floor_cells"));
            assertFalse(tableExists(connection, "dungeon_room_cluster_vertices"));
            assertTrue(tableExists(connection, "dungeon_room_cells"));
            assertTrue(tableExists(connection, "dungeon_entity_chunks"));
            assertEquals(
                    Set.of("dungeon_map_id", "level_z", "chunk_q", "chunk_r", "content_revision"),
                    columns(connection, "dungeon_chunks"));
            assertEquals(
                    Set.of("room_id", "dungeon_map_id", "cluster_id", "name", "visual_description"),
                    columns(connection, "dungeon_rooms"));
            assertEquals(
                    Set.of("cluster_id", "dungeon_map_id", "name"),
                    columns(connection, "dungeon_room_clusters"));
            assertEquals(0, scalarInt(connection, "SELECT COUNT(*) FROM dungeon_maps"));
            assertFalse(connection.createStatement().executeQuery("PRAGMA foreign_key_check").next());
        }
    }

    private static void createVersionTwoDatabase(Path databasePath) throws Exception {
        Class.forName("org.sqlite.JDBC");
        try (Connection connection = open(databasePath);
             Statement statement = connection.createStatement()) {
            statement.execute("PRAGMA foreign_keys=ON");
            statement.execute("PRAGMA user_version=1");
            statement.execute("CREATE TABLE sm_schema_versions ("
                    + "owner TEXT PRIMARY KEY, version INTEGER NOT NULL CHECK(version >= 0))");
            statement.execute("INSERT INTO sm_schema_versions(owner, version) VALUES('dungeon', 2)");
            statement.execute("CREATE TABLE party_guard(payload TEXT NOT NULL)");
            statement.execute("INSERT INTO party_guard(payload) VALUES('party-kept')");
            statement.execute("CREATE TABLE hex_guard(payload TEXT NOT NULL)");
            statement.execute("INSERT INTO hex_guard(payload) VALUES('hex-kept')");

            statement.execute("CREATE TABLE dungeon_maps("
                    + "dungeon_map_id INTEGER PRIMARY KEY, name TEXT NOT NULL, revision INTEGER NOT NULL)");
            statement.execute("CREATE TABLE dungeon_room_clusters("
                    + "cluster_id INTEGER PRIMARY KEY, dungeon_map_id INTEGER NOT NULL"
                    + " REFERENCES dungeon_maps(dungeon_map_id) ON DELETE CASCADE,"
                    + "name TEXT NOT NULL, center_x INTEGER NOT NULL, center_y INTEGER NOT NULL, level_z INTEGER NOT NULL)");
            statement.execute("CREATE TABLE dungeon_rooms("
                    + "room_id INTEGER PRIMARY KEY, dungeon_map_id INTEGER NOT NULL"
                    + " REFERENCES dungeon_maps(dungeon_map_id) ON DELETE CASCADE,"
                    + "cluster_id INTEGER NOT NULL REFERENCES dungeon_room_clusters(cluster_id) ON DELETE CASCADE,"
                    + "name TEXT NOT NULL, visual_description TEXT, component_x INTEGER NOT NULL,"
                    + "component_y INTEGER NOT NULL, level_z INTEGER NOT NULL)");
            statement.execute("CREATE TABLE dungeon_room_floors("
                    + "room_id INTEGER NOT NULL REFERENCES dungeon_rooms(room_id) ON DELETE CASCADE,"
                    + "level_z INTEGER NOT NULL, anchor_x INTEGER NOT NULL, anchor_y INTEGER NOT NULL)");
            statement.execute("CREATE TABLE dungeon_room_cluster_floor_cells("
                    + "cluster_id INTEGER NOT NULL REFERENCES dungeon_room_clusters(cluster_id) ON DELETE CASCADE,"
                    + "level_z INTEGER NOT NULL, cell_x INTEGER NOT NULL, cell_y INTEGER NOT NULL)");
            statement.execute("CREATE TABLE dungeon_room_cluster_vertices("
                    + "cluster_id INTEGER NOT NULL REFERENCES dungeon_room_clusters(cluster_id) ON DELETE CASCADE,"
                    + "cell_x INTEGER NOT NULL, cell_y INTEGER NOT NULL)");

            statement.execute("INSERT INTO dungeon_maps VALUES(7, 'discarded', 4)");
            statement.execute("INSERT INTO dungeon_room_clusters VALUES(11, 7, 'legacy', 2, 2, 0)");
            statement.execute("INSERT INTO dungeon_rooms VALUES(13, 7, 11, 'legacy', '', 2, 2, 0)");
            statement.execute("INSERT INTO dungeon_room_floors VALUES(13, 1, 2, 2)");
            statement.execute("INSERT INTO dungeon_room_cluster_floor_cells VALUES(11, 0, 2, 2)");
            statement.execute("INSERT INTO dungeon_room_cluster_vertices VALUES(11, 2, 2)");
        }
    }

    private static Connection open(Path databasePath) throws SQLException {
        Connection connection = DriverManager.getConnection("jdbc:sqlite:" + databasePath.toAbsolutePath());
        try (Statement statement = connection.createStatement()) {
            statement.execute("PRAGMA foreign_keys=ON");
        }
        return connection;
    }

    private static boolean tableExists(Connection connection, String table) throws SQLException {
        try (var statement = connection.prepareStatement(
                "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?")) {
            statement.setString(1, table);
            try (ResultSet resultSet = statement.executeQuery()) {
                return resultSet.next();
            }
        }
    }

    private static Set<String> columns(Connection connection, String table) throws SQLException {
        Set<String> result = new LinkedHashSet<>();
        try (Statement statement = connection.createStatement();
             ResultSet resultSet = statement.executeQuery("PRAGMA table_info(" + table + ")")) {
            while (resultSet.next()) {
                result.add(resultSet.getString("name"));
            }
        }
        return Set.copyOf(result);
    }

    private static int scalarInt(Connection connection, String sql) throws SQLException {
        try (Statement statement = connection.createStatement();
             ResultSet resultSet = statement.executeQuery(sql)) {
            return resultSet.next() ? resultSet.getInt(1) : 0;
        }
    }

    private static String scalarText(Connection connection, String sql) throws SQLException {
        try (Statement statement = connection.createStatement();
             ResultSet resultSet = statement.executeQuery(sql)) {
            return resultSet.next() ? resultSet.getString(1) : "";
        }
    }
}
