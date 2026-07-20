package features.dungeon.adapter.sqlite.gateway;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import platform.diagnostics.NoopDiagnostics;
import platform.persistence.FeatureStoreReadiness;
import platform.persistence.FeatureStoreUnavailableException;
import platform.persistence.SqliteDatabase;
import platform.persistence.SqliteMigration;
import platform.persistence.TestFeatureStores;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.LinkedHashSet;
import java.util.Set;

final class DungeonCanonicalSchemaMigrationTest {

    @Test
    void versionSevenRejectsPopulatedOldVersionSixShapeWithoutDiscardingRows(
            @TempDir Path tempDir
    ) throws Exception {
        Path databasePath = tempDir.resolve("v6-authored-bounds.db");
        try (SqliteDatabase database = new SqliteDatabase(databasePath, NoopDiagnostics.INSTANCE);
             Connection connection = TestFeatureStores.store(database, DungeonStoreDefinition.create())
                     .openConnection()) {
            connection.createStatement().execute(
                    "INSERT INTO dungeon_maps(dungeon_map_id,name,revision) VALUES(7,'kept',1)");
            connection.createStatement().execute(
                    "INSERT INTO dungeon_chunks(dungeon_map_id,level_z,chunk_q,chunk_r,content_revision) "
                            + "VALUES(7,2,0,0,1)");
            connection.createStatement().execute(
                    "INSERT INTO dungeon_entity_chunks(dungeon_map_id,entity_kind,entity_id,level_z,"
                            + "chunk_q,chunk_r,minimum_q,minimum_r,maximum_q,maximum_r,entity_chunk_count) "
                            + "VALUES(7,'FEATURE_MARKER',11,2,0,0,3,4,8,9,1)");
        }
        try (Connection connection = open(databasePath)) {
            connection.createStatement().execute("DROP TABLE dungeon_authored_level_bounds");
            connection.createStatement().execute(
                    "UPDATE sm_schema_versions SET version=6 WHERE owner='dungeon'");
        }

        try (SqliteDatabase database = new SqliteDatabase(databasePath, NoopDiagnostics.INSTANCE)) {
            var store = database.featureStore(DungeonStoreDefinition.create());
            assertEquals(FeatureStoreReadiness.MIGRATION_FAILED,
                    database.prepareRegisteredStores().get("dungeon"));
            assertThrows(FeatureStoreUnavailableException.class, store::openConnection);
        }

        try (Connection connection = open(databasePath)) {
            assertEquals(6, scalarInt(connection,
                    "SELECT version FROM sm_schema_versions WHERE owner='dungeon'"));
            assertEquals("kept", scalarText(connection,
                    "SELECT name FROM dungeon_maps WHERE dungeon_map_id=7"));
            assertFalse(tableExists(connection, "dungeon_authored_level_bounds"));
        }
    }

    @Test
    void versionSevenRepairsAnEmptyOldVersionSixShape(@TempDir Path tempDir) throws Exception {
        Path databasePath = tempDir.resolve("empty-v6-authored-bounds.db");
        try (SqliteDatabase database = new SqliteDatabase(databasePath, NoopDiagnostics.INSTANCE);
             Connection ignored = TestFeatureStores.store(database, DungeonStoreDefinition.create())
                     .openConnection()) {
            // Establish the current empty target before simulating the released v6 signature.
        }
        try (Connection connection = open(databasePath)) {
            connection.createStatement().execute("DROP TABLE dungeon_authored_level_bounds");
            connection.createStatement().execute(
                    "UPDATE sm_schema_versions SET version=6 WHERE owner='dungeon'");
        }

        try (SqliteDatabase database = new SqliteDatabase(databasePath, NoopDiagnostics.INSTANCE);
             Connection ignored = TestFeatureStores.store(database, DungeonStoreDefinition.create())
                     .openConnection()) {
            // Opening the owner connection applies the fail-safe v7 repair.
        }

        try (Connection connection = open(databasePath)) {
            assertEquals(7, scalarInt(connection,
                    "SELECT version FROM sm_schema_versions WHERE owner='dungeon'"));
            assertTrue(tableExists(connection, "dungeon_authored_level_bounds"));
        }
    }

    @Test
    void currentVersionDiscardsOnlyPreCanonicalDungeonRowsAndInstallsTheCanonicalSchema(@TempDir Path tempDir)
            throws Exception {
        Path databasePath = tempDir.resolve("migration.db");
        createVersionTwoDatabase(databasePath);

        try (SqliteDatabase database = new SqliteDatabase(databasePath, NoopDiagnostics.INSTANCE)) {
            DungeonSqliteGateway gateway = new DungeonSqliteGateway(
                            TestFeatureStores.store(
                                    database,
                                    features.dungeon.adapter.sqlite.gateway.DungeonStoreDefinition
                                            .create()));
            assertTrue(gateway.searchMapHeaders("").isEmpty(),
                    "the destructive migration must not retain pre-v3 Dungeon rows");
        }

        try (Connection connection = open(databasePath)) {
            assertEquals(7, scalarInt(connection,
                    "SELECT version FROM sm_schema_versions WHERE owner='dungeon'"));
            assertEquals("party-kept", scalarText(connection, "SELECT payload FROM party_guard"));
            assertEquals("hex-kept", scalarText(connection, "SELECT payload FROM hex_guard"));

            assertFalse(tableExists(connection, "dungeon_room_floors"));
            assertFalse(tableExists(connection, "dungeon_room_cluster_floor_cells"));
            assertFalse(tableExists(connection, "dungeon_room_cluster_vertices"));
            assertTrue(tableExists(connection, "dungeon_room_cells"));
            assertTrue(tableExists(connection, "dungeon_entity_chunks"));
            assertTrue(tableExists(connection, "dungeon_authored_level_bounds"));
            assertTrue(indexExists(connection, "idx_dungeon_entity_chunks_continuation"));
            assertEquals(Set.of("dungeon_map_id", "entity_kind", "entity_id", "level_z", "chunk_q", "chunk_r",
                            "minimum_q", "minimum_r", "maximum_q", "maximum_r", "entity_chunk_count"),
                    columns(connection, "dungeon_entity_chunks"));
            assertTrue(tableExists(connection, "dungeon_corridor_route_cells"));
            assertTrue(tableExists(connection, "dungeon_corridor_route_dependencies"));
            assertEquals(
                    Set.of("dungeon_map_id", "level_z", "chunk_q", "chunk_r", "content_revision"),
                    columns(connection, "dungeon_chunks"));
            assertEquals(
                    Set.of("room_id", "dungeon_map_id", "cluster_id", "name", "visual_description"),
                    columns(connection, "dungeon_rooms"));
            assertEquals(
                    Set.of("cluster_id", "dungeon_map_id", "name"),
                    columns(connection, "dungeon_room_clusters"));
            assertTrue(columns(connection, "dungeon_corridor_door_overrides").contains("relative_cell_z"));
            assertEquals(0, scalarInt(connection, "SELECT COUNT(*) FROM dungeon_maps"));
            assertFalse(connection.createStatement().executeQuery("PRAGMA foreign_key_check").next());
        }
    }

    @Test
    void versionSixReplacesEarlierDungeonRowsWithTheEmptyDependencySchema(@TempDir Path tempDir)
            throws Exception {
        Path databasePath = tempDir.resolve("v3-door-level.db");
        createVersionThreeDoorTable(databasePath);

        DungeonSqliteSchemaManager schemaManager = new DungeonSqliteSchemaManager();
        try (SqliteDatabase database = new SqliteDatabase(databasePath, NoopDiagnostics.INSTANCE);
             Connection ignored =
                        TestFeatureStores.store(
                                        database,
                     "dungeon",
                     new SqliteMigration(1, schemaManager::ensureSchema),
                     new SqliteMigration(2, schemaManager::ensureSchema),
                     new SqliteMigration(3, schemaManager::replaceWithCanonicalSchema),
                     new SqliteMigration(4, schemaManager::addCorridorDoorLevel),
                     new SqliteMigration(5, schemaManager::addCorridorRouteCellIndex),
                     new SqliteMigration(6, schemaManager::addCorridorRouteDependencyIndex))
                     .openConnection()) {
            // Opening the owner connection applies the owner-approved destructive v6 migration.
        }

        try (Connection connection = open(databasePath)) {
            assertEquals(6, scalarInt(connection,
                    "SELECT version FROM sm_schema_versions WHERE owner='dungeon'"));
            assertTrue(columns(connection, "dungeon_corridor_door_overrides").contains("relative_cell_z"));
            assertEquals(0, scalarInt(connection,
                            "SELECT COUNT(*) FROM dungeon_corridor_door_overrides WHERE"
                                + " corridor_id=31"));
            assertEquals(0, scalarInt(connection,
                    "SELECT COUNT(*) FROM dungeon_maps"));
            assertTrue(tableExists(connection, "dungeon_corridor_route_cells"));
            assertTrue(indexExists(connection, "idx_dungeon_corridor_route_cells_by_chunk"));
            assertTrue(indexExists(connection, "idx_dungeon_rooms_by_cluster"));
            assertTrue(tableExists(connection, "dungeon_corridor_route_dependencies"));
            assertTrue(indexExists(connection, "idx_dungeon_corridor_route_dependencies_by_cell"));
            assertEquals(0, scalarInt(connection,
                    "SELECT COUNT(*) FROM dungeon_corridor_route_dependencies"));
        }
    }

    @Test
    void versionSixReplacementIsIdempotentAndPreservesOnlyTheCanonicalEmptySchema(@TempDir Path tempDir)
            throws Exception {
        Path databasePath = tempDir.resolve("v4-route-index.db");
        createVersionFourDatabase(databasePath);

        DungeonSqliteSchemaManager schemaManager = new DungeonSqliteSchemaManager();
        try (SqliteDatabase database = new SqliteDatabase(databasePath, NoopDiagnostics.INSTANCE);
             Connection connection =
                        TestFeatureStores.store(
                                        database,
                     "dungeon",
                     new SqliteMigration(1, schemaManager::ensureSchema),
                     new SqliteMigration(2, schemaManager::ensureSchema),
                     new SqliteMigration(3, schemaManager::replaceWithCanonicalSchema),
                     new SqliteMigration(4, schemaManager::addCorridorDoorLevel),
                     new SqliteMigration(5, schemaManager::addCorridorRouteCellIndex),
                     new SqliteMigration(6, schemaManager::addCorridorRouteDependencyIndex))
                     .openConnection()) {
            schemaManager.addCorridorRouteCellIndex(connection);
            schemaManager.addCorridorRouteCellIndex(connection);
            schemaManager.addCorridorRouteDependencyIndex(connection);
            schemaManager.addCorridorRouteDependencyIndex(connection);
        }

        try (Connection connection = open(databasePath)) {
            assertEquals(6, scalarInt(connection,
                    "SELECT version FROM sm_schema_versions WHERE owner='dungeon'"));
            assertEquals(0, scalarInt(connection,
                            "SELECT COUNT(*) FROM dungeon_corridor_door_overrides WHERE"
                                + " corridor_id=31"));
            assertEquals(0, scalarInt(connection, "SELECT COUNT(*) FROM dungeon_maps"));
            assertEquals(Set.of(
                    "dungeon_map_id", "corridor_id", "segment_order", "cell_order",
                    "level_z", "cell_x", "cell_y", "chunk_q", "chunk_r"),
                    columns(connection, "dungeon_corridor_route_cells"));
            assertTrue(indexExists(connection, "idx_dungeon_corridor_route_cells_by_chunk"));
            assertEquals(Set.of("dungeon_map_id", "corridor_id", "level_z", "cell_x", "cell_y"),
                    columns(connection, "dungeon_corridor_route_dependencies"));
            assertTrue(indexExists(connection, "idx_dungeon_corridor_route_dependencies_by_cell"));
            assertEquals(0, scalarInt(connection,
                    "SELECT COUNT(*) FROM dungeon_corridor_route_dependencies"),
                    "v6 replaces nonexistent legacy Dungeon data with an internally complete empty"
                        + " schema");
        }
    }

    private static void createVersionTwoDatabase(Path databasePath) throws Exception {
        Class.forName("org.sqlite.JDBC");
        try (Connection connection = open(databasePath);
             Statement statement = connection.createStatement()) {
            statement.execute("PRAGMA foreign_keys=ON");
            statement.execute("PRAGMA user_version=1");
            statement.execute(
                    "CREATE TABLE sm_schema_versions (owner TEXT PRIMARY KEY, version INTEGER NOT"
                        + " NULL CHECK(version >= 0))");
            statement.execute("INSERT INTO sm_schema_versions(owner, version) VALUES('dungeon', 2)");
            statement.execute("CREATE TABLE party_guard(payload TEXT NOT NULL)");
            statement.execute("INSERT INTO party_guard(payload) VALUES('party-kept')");
            statement.execute("CREATE TABLE hex_guard(payload TEXT NOT NULL)");
            statement.execute("INSERT INTO hex_guard(payload) VALUES('hex-kept')");

            statement.execute(
                    "CREATE TABLE dungeon_maps(dungeon_map_id INTEGER PRIMARY KEY, name TEXT NOT"
                        + " NULL, revision INTEGER NOT NULL)");
            statement.execute(
                    "CREATE TABLE dungeon_room_clusters(cluster_id INTEGER PRIMARY KEY,"
                        + " dungeon_map_id INTEGER NOT NULL REFERENCES dungeon_maps(dungeon_map_id)"
                        + " ON DELETE CASCADE,name TEXT NOT NULL, center_x INTEGER NOT NULL,"
                        + " center_y INTEGER NOT NULL, level_z INTEGER NOT NULL)");
            statement.execute(
                    "CREATE TABLE dungeon_rooms(room_id INTEGER PRIMARY KEY, dungeon_map_id INTEGER"
                        + " NOT NULL REFERENCES dungeon_maps(dungeon_map_id) ON DELETE"
                        + " CASCADE,cluster_id INTEGER NOT NULL REFERENCES"
                        + " dungeon_room_clusters(cluster_id) ON DELETE CASCADE,name TEXT NOT NULL,"
                        + " visual_description TEXT, component_x INTEGER NOT NULL,component_y"
                        + " INTEGER NOT NULL, level_z INTEGER NOT NULL)");
            statement.execute(
                    "CREATE TABLE dungeon_room_floors(room_id INTEGER NOT NULL REFERENCES"
                        + " dungeon_rooms(room_id) ON DELETE CASCADE,level_z INTEGER NOT NULL,"
                        + " anchor_x INTEGER NOT NULL, anchor_y INTEGER NOT NULL)");
            statement.execute(
                    "CREATE TABLE dungeon_room_cluster_floor_cells(cluster_id INTEGER NOT NULL"
                        + " REFERENCES dungeon_room_clusters(cluster_id) ON DELETE CASCADE,level_z"
                        + " INTEGER NOT NULL, cell_x INTEGER NOT NULL, cell_y INTEGER NOT NULL)");
            statement.execute(
                    "CREATE TABLE dungeon_room_cluster_vertices(cluster_id INTEGER NOT NULL"
                        + " REFERENCES dungeon_room_clusters(cluster_id) ON DELETE CASCADE,cell_x"
                        + " INTEGER NOT NULL, cell_y INTEGER NOT NULL)");

            statement.execute("INSERT INTO dungeon_maps VALUES(7, 'discarded', 4)");
            statement.execute("INSERT INTO dungeon_room_clusters VALUES(11, 7, 'legacy', 2, 2, 0)");
            statement.execute("INSERT INTO dungeon_rooms VALUES(13, 7, 11, 'legacy', '', 2, 2, 0)");
            statement.execute("INSERT INTO dungeon_room_floors VALUES(13, 1, 2, 2)");
            statement.execute("INSERT INTO dungeon_room_cluster_floor_cells VALUES(11, 0, 2, 2)");
            statement.execute("INSERT INTO dungeon_room_cluster_vertices VALUES(11, 2, 2)");
        }
    }

    private static void createVersionThreeDoorTable(Path databasePath) throws Exception {
        Class.forName("org.sqlite.JDBC");
        try (Connection connection = open(databasePath);
             Statement statement = connection.createStatement()) {
            statement.execute("PRAGMA user_version=1");
            statement.execute(
                    "CREATE TABLE sm_schema_versions (owner TEXT PRIMARY KEY, version INTEGER NOT"
                        + " NULL CHECK(version >= 0))");
            statement.execute("INSERT INTO sm_schema_versions(owner, version) VALUES('dungeon', 3)");
            statement.execute(
                    "CREATE TABLE dungeon_maps(dungeon_map_id INTEGER PRIMARY KEY, name TEXT NOT"
                        + " NULL, revision INTEGER NOT NULL)");
            statement.execute(
                    "CREATE TABLE dungeon_chunks(dungeon_map_id INTEGER NOT NULL, level_z INTEGER"
                        + " NOT NULL, chunk_q INTEGER NOT NULL,chunk_r INTEGER NOT NULL,"
                        + " content_revision INTEGER NOT NULL DEFAULT 0,PRIMARY"
                        + " KEY(dungeon_map_id,level_z,chunk_q,chunk_r))");
            statement.execute(
                    "CREATE TABLE dungeon_rooms(room_id INTEGER PRIMARY KEY, dungeon_map_id INTEGER"
                        + " NOT NULL, cluster_id INTEGER NOT NULL,name TEXT NOT NULL,"
                        + " visual_description TEXT)");
            statement.execute(
                    "CREATE TABLE dungeon_corridor_door_overrides (corridor_id INTEGER NOT NULL,"
                        + " room_id INTEGER NOT NULL, cluster_id INTEGER NOT NULL,relative_cell_x"
                        + " INTEGER NOT NULL, relative_cell_y INTEGER NOT NULL,edge_direction TEXT"
                        + " NOT NULL, topology_element_id INTEGER,sort_order INTEGER NOT NULL"
                        + " DEFAULT 0, PRIMARY KEY(corridor_id, room_id))");
            statement.execute(
                    "INSERT INTO dungeon_corridor_door_overrides(corridor_id, room_id, cluster_id,"
                        + " relative_cell_x, relative_cell_y, edge_direction, topology_element_id)"
                        + " VALUES(31,11,21,4,5,'EAST',41)");
        }
    }

    private static void createVersionFourDatabase(Path databasePath) throws Exception {
        Class.forName("org.sqlite.JDBC");
        try (Connection connection = open(databasePath);
             Statement statement = connection.createStatement()) {
            statement.execute("PRAGMA user_version=1");
            statement.execute(
                    "CREATE TABLE sm_schema_versions (owner TEXT PRIMARY KEY, version INTEGER NOT"
                        + " NULL CHECK(version >= 0))");
            statement.execute("INSERT INTO sm_schema_versions(owner, version) VALUES('dungeon', 4)");
            statement.execute(
                    "CREATE TABLE dungeon_maps(dungeon_map_id INTEGER PRIMARY KEY, name TEXT NOT"
                        + " NULL, revision INTEGER NOT NULL)");
            statement.execute(
                    "CREATE TABLE dungeon_chunks(dungeon_map_id INTEGER NOT NULL, level_z INTEGER"
                        + " NOT NULL, chunk_q INTEGER NOT NULL,chunk_r INTEGER NOT NULL,"
                        + " content_revision INTEGER NOT NULL DEFAULT 0,PRIMARY"
                        + " KEY(dungeon_map_id,level_z,chunk_q,chunk_r))");
            statement.execute(
                    "CREATE TABLE dungeon_rooms(room_id INTEGER PRIMARY KEY, dungeon_map_id INTEGER"
                        + " NOT NULL, cluster_id INTEGER NOT NULL,name TEXT NOT NULL,"
                        + " visual_description TEXT)");
            statement.execute(
                    "CREATE TABLE dungeon_corridor_door_overrides (corridor_id INTEGER NOT NULL,"
                        + " room_id INTEGER NOT NULL, cluster_id INTEGER NOT NULL,relative_cell_x"
                        + " INTEGER NOT NULL, relative_cell_y INTEGER NOT NULL,relative_cell_z"
                        + " INTEGER NOT NULL DEFAULT 0, edge_direction TEXT NOT"
                        + " NULL,topology_element_id INTEGER, sort_order INTEGER NOT NULL DEFAULT"
                        + " 0,PRIMARY KEY(corridor_id, room_id))");
            statement.execute(
                    "INSERT INTO dungeon_corridor_door_overrides(corridor_id, room_id, cluster_id,"
                            + " relative_cell_x, relative_cell_y, relative_cell_z, edge_direction,"
                            + " topology_element_id) VALUES(31,11,21,4,5,7,'EAST',41)");
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

    private static boolean indexExists(Connection connection, String index) throws SQLException {
        try (var statement = connection.prepareStatement(
                "SELECT 1 FROM sqlite_master WHERE type='index' AND name=?")) {
            statement.setString(1, index);
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
