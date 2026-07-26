package features.worldplanner.adapter.sqlite.gateway.local;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import features.worldplanner.adapter.sqlite.model.WorldPlannerPersistenceSchema;
import features.worldplanner.adapter.sqlite.repository.SqliteWorldPlannerRepository;
import features.worldplanner.domain.world.WorldFaction;
import features.worldplanner.domain.world.WorldLocation;
import features.worldplanner.domain.world.WorldNpc;
import features.worldplanner.domain.world.WorldNpcLifecycleState;
import features.worldplanner.domain.world.WorldPlannerState;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import platform.diagnostics.NoopDiagnostics;
import platform.persistence.SqliteDatabase;
import platform.persistence.TestFeatureStores;

final class WorldPlannerCurrentSchemaTest {

    @TempDir
    Path temporaryDirectory;

    @Test
    void freshCurrentVersionOneRoundTripsAcrossRestart() throws Exception {
        Path path = temporaryDirectory.resolve("world-current.db");
        WorldPlannerState expected = fixture();

        try (SqliteDatabase database = new SqliteDatabase(path, NoopDiagnostics.INSTANCE)) {
            assertEquals(expected, repository(database).save(expected));
        }
        try (SqliteDatabase reopened = new SqliteDatabase(path, NoopDiagnostics.INSTANCE)) {
            assertEquals(expected, repository(reopened).load());
        }
        try (Connection connection = rawConnection(path)) {
            assertEquals(1, featureVersion(connection));
            assertTrue(schemaObjectExists(connection, "index", "idx_world_planner_npc_single_faction"));
        }
    }

    @Test
    void unversionedPartialNamespaceFailsWithoutCreatingRemainingTables() throws Exception {
        Path path = temporaryDirectory.resolve("world-unversioned-partial.db");
        try (Connection connection = rawConnection(path); Statement statement = connection.createStatement()) {
            platform.persistence.TestFeatureStores.createCurrentPlatformLedger(statement);
            statement.execute("CREATE TABLE world_planner_npcs(npc_id INTEGER PRIMARY KEY, marker TEXT NOT NULL)");
            statement.execute("INSERT INTO world_planner_npcs VALUES(7, 'kept')");
        }

        assertUnavailable(path);

        try (Connection connection = rawConnection(path)) {
            assertEquals("kept", scalarText(connection, "SELECT marker FROM world_planner_npcs WHERE npc_id=7"));
            assertEquals(2, columnCount(connection, "world_planner_npcs"));
            assertFalse(schemaObjectExists(connection, "table", WorldPlannerPersistenceSchema.FACTIONS_TABLE));
            assertFalse(ownerVersionExists(connection));
        }
    }

    @Test
    void recordedDamagedCurrentShapeFailsClosedWithoutRepair() throws Exception {
        Path path = temporaryDirectory.resolve("world-damaged-current.db");
        try (Connection connection = rawConnection(path); Statement statement = connection.createStatement()) {
            createVersionTable(statement, 1);
            for (String sql : WorldPlannerPersistenceSchema.CREATE_TABLE_SQL) {
                statement.execute(sql.replace(
                        "disposition_modifier INTEGER NOT NULL DEFAULT 0 CHECK(disposition_modifier BETWEEN -50 AND 50), ",
                        ""));
            }
            for (String sql : WorldPlannerPersistenceSchema.CREATE_INDEX_SQL) {
                statement.execute(sql);
            }
            statement.execute("INSERT INTO world_planner_npcs "
                    + "(npc_id, display_name, creature_statblock_id, appearance_notes, behavior_notes, "
                    + "history_notes, general_notes, status) VALUES(8, 'Unchanged', 11, '', '', '', '', 'ACTIVE')");
        }

        assertUnavailable(path);

        try (Connection connection = rawConnection(path)) {
            assertEquals(1, featureVersion(connection));
            assertEquals(0, scalarInt(connection,
                    "SELECT COUNT(*) FROM pragma_table_info('world_planner_npcs') "
                            + "WHERE name='disposition_modifier'"));
            assertEquals("Unchanged", scalarText(connection,
                    "SELECT display_name FROM world_planner_npcs WHERE npc_id=8"));
        }
    }

    @Test
    void newerVersionAndAdjacentOwnerObjectFailUnchanged() throws Exception {
        Path newer = temporaryDirectory.resolve("world-newer.db");
        try (Connection connection = rawConnection(newer); Statement statement = connection.createStatement()) {
            createVersionTable(statement, 2);
            statement.execute("CREATE TABLE world_planner_retired(payload TEXT NOT NULL)");
            statement.execute("INSERT INTO world_planner_retired VALUES('newer')");
        }
        assertUnavailable(newer);
        try (Connection connection = rawConnection(newer)) {
            assertEquals(2, featureVersion(connection));
            assertEquals("newer", scalarText(connection, "SELECT payload FROM world_planner_retired"));
        }

        Path adjacent = temporaryDirectory.resolve("world-adjacent.db");
        try (Connection connection = rawConnection(adjacent); Statement statement = connection.createStatement()) {
            createVersionTable(statement, 1);
            for (String sql : WorldPlannerPersistenceSchema.CREATE_TABLE_SQL) {
                statement.execute(sql);
            }
            for (String sql : WorldPlannerPersistenceSchema.CREATE_INDEX_SQL) {
                statement.execute(sql);
            }
            statement.execute("CREATE TABLE world_planner_retired(payload TEXT NOT NULL)");
            statement.execute("INSERT INTO world_planner_retired VALUES('kept')");
        }
        assertUnavailable(adjacent);
        try (Connection connection = rawConnection(adjacent)) {
            assertEquals(1, featureVersion(connection));
            assertEquals("kept", scalarText(connection, "SELECT payload FROM world_planner_retired"));
        }
    }

    @Test
    void failedCurrentSaveRollsBackWholeWorldSnapshot() throws Exception {
        Path path = temporaryDirectory.resolve("world-rollback.db");
        WorldPlannerState stable = fixture();
        try (SqliteDatabase database = new SqliteDatabase(path, NoopDiagnostics.INSTANCE)) {
            SqliteWorldPlannerRepository repository = repository(database);
            repository.save(stable);
            try (Connection connection = rawConnection(path); Statement statement = connection.createStatement()) {
                statement.execute("CREATE TRIGGER fail_world_location BEFORE INSERT ON world_planner_locations "
                        + "BEGIN SELECT RAISE(ABORT, 'forced rollback'); END");
            }
            WorldPlannerState blocked = new WorldPlannerState(
                    List.of(new WorldNpc(1L, "Changed", 11L, "", "", "", "", 5,
                            WorldNpcLifecycleState.ACTIVE)),
                    stable.factions(),
                    stable.locations(),
                    2L,
                    2L,
                    2L,
                    "");

            assertThrows(IllegalStateException.class, () -> repository.save(blocked));
            assertEquals(stable, repository.load());
        }
    }

    private static WorldPlannerState fixture() {
        return new WorldPlannerState(
                List.of(new WorldNpc(1L, "Vale", 11L, "", "", "", "", 5,
                        WorldNpcLifecycleState.ACTIVE)),
                List.of(new WorldFaction(1L, "Guard", "", 21L, -10, List.of(1L), List.of())),
                List.of(new WorldLocation(1L, "Gate", "", List.of(1L), List.of(21L))),
                2L,
                2L,
                2L,
                "");
    }

    private static SqliteWorldPlannerRepository repository(SqliteDatabase database) {
        return new SqliteWorldPlannerRepository(
                TestFeatureStores.store(database, SqliteWorldPlannerRepository.storeDefinition()));
    }

    private static void assertUnavailable(Path path) {
        try (SqliteDatabase database = new SqliteDatabase(path, NoopDiagnostics.INSTANCE)) {
            SqliteWorldPlannerRepository repository = repository(database);
            assertThrows(IllegalStateException.class, repository::load);
        }
    }

    private static Connection rawConnection(Path path) throws Exception {
        Class.forName("org.sqlite.JDBC");
        return DriverManager.getConnection("jdbc:sqlite:" + path);
    }

    private static void createVersionTable(Statement statement, int version) throws Exception {
        platform.persistence.TestFeatureStores.createCurrentPlatformLedger(statement);
        statement.execute("INSERT INTO sm_schema_versions(owner, version) "
                + "VALUES ('world-planner', " + version + ")");
    }

    private static int featureVersion(Connection connection) throws Exception {
        return scalarInt(connection,
                "SELECT version FROM sm_schema_versions WHERE owner='world-planner'");
    }

    private static boolean ownerVersionExists(Connection connection) throws Exception {
        if (!schemaObjectExists(connection, "table", "sm_schema_versions")) {
            return false;
        }
        return scalarInt(connection,
                "SELECT COUNT(*) FROM sm_schema_versions WHERE owner='world-planner'") != 0;
    }

    private static int columnCount(Connection connection, String table) throws Exception {
        return scalarInt(connection, "SELECT COUNT(*) FROM pragma_table_info('" + table + "')");
    }

    private static boolean schemaObjectExists(Connection connection, String type, String name) throws Exception {
        try (var statement = connection.prepareStatement(
                "SELECT 1 FROM sqlite_master WHERE type=? AND name=?")) {
            statement.setString(1, type);
            statement.setString(2, name);
            try (ResultSet result = statement.executeQuery()) {
                return result.next();
            }
        }
    }

    private static int scalarInt(Connection connection, String sql) throws Exception {
        try (Statement statement = connection.createStatement(); ResultSet result = statement.executeQuery(sql)) {
            return result.next() ? result.getInt(1) : 0;
        }
    }

    private static String scalarText(Connection connection, String sql) throws Exception {
        try (Statement statement = connection.createStatement(); ResultSet result = statement.executeQuery(sql)) {
            return result.next() ? result.getString(1) : "";
        }
    }
}
