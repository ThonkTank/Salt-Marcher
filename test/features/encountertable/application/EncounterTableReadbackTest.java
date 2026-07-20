package features.encountertable.application;

import features.encountertable.EncounterTableServiceAssembly;
import features.encountertable.adapter.sqlite.model.EncounterTablePersistenceSchema;
import features.encountertable.adapter.sqlite.query.SqliteEncounterTableCatalogAdapter;
import features.encountertable.api.EncounterTableApi;
import features.encountertable.api.EncounterTableCandidate;
import features.encountertable.api.EncounterTableCandidatesModel;
import features.encountertable.api.EncounterTableCandidatesResult;
import features.encountertable.api.EncounterTableCatalogModel;
import features.encountertable.api.EncounterTableCatalogResult;
import features.encountertable.api.EncounterTableReadStatus;
import features.encountertable.api.RefreshEncounterTableCandidatesCommand;
import features.encountertable.api.RefreshEncounterTableCatalogCommand;

import org.junit.jupiter.api.Test;

import platform.persistence.TestFeatureStores;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.List;
import java.util.Objects;

public final class EncounterTableReadbackTest {

    private static final long ASH_AMBUSH_ID = 201L;
    private static final long CINDER_PATROL_ID = 202L;

    @Test
    void ENCOUNTER_TABLE_001() throws Exception {
        TestRuntime runtime = setupRuntime();
        runtime.service.refreshCatalog(new RefreshEncounterTableCatalogCommand());
        assertAuthoredSummaryLookup(runtime.catalog.current());
    }

    @Test
    void ENCOUNTER_TABLE_002() throws Exception {
        TestRuntime runtime = setupRuntime();
        runtime.service.refreshCandidates(new RefreshEncounterTableCandidatesCommand(
                List.of(CINDER_PATROL_ID, ASH_AMBUSH_ID),
                300));
        assertWeightedCandidateLookup(runtime.candidates.current());
    }

    @Test
    void ENCOUNTER_TABLE_003() throws Exception {
        TestRuntime runtime = setupRuntime();
        runtime.service.refreshCandidates(new RefreshEncounterTableCandidatesCommand(List.of(), 300));
        assertEmptySelection(runtime.candidates.current());
    }

    @Test
    void ENCOUNTER_TABLE_004() throws Exception {
        TestRuntime runtime = setupRuntime();
        runtime.service.refreshCandidates(new RefreshEncounterTableCandidatesCommand(
                List.of(ASH_AMBUSH_ID, CINDER_PATROL_ID),
                50));
        assertXpCeiling(runtime.candidates.current());

        runtime.service.refreshCandidates(new RefreshEncounterTableCandidatesCommand(
                List.of(ASH_AMBUSH_ID, CINDER_PATROL_ID),
                0));
        assertUnboundedXpCeiling(runtime.candidates.current());
    }

    @Test
    void ENCOUNTER_TABLE_005() throws Exception {
        Path database = databasePath();
        seedDatabase(database);
        TestRuntime runtime = runtime();
        runtime.service.refreshCandidates(new RefreshEncounterTableCandidatesCommand(
                List.of(ASH_AMBUSH_ID, CINDER_PATROL_ID),
                0));
        assertUnboundedXpCeiling(runtime.candidates.current());
        dropCreatureTable(database);
        runtime.service.refreshCandidates(new RefreshEncounterTableCandidatesCommand(List.of(ASH_AMBUSH_ID), 300));
        assertStorageErrorPublication(runtime.candidates.current());
    }

    private static TestRuntime setupRuntime() throws Exception {
        Path database = databasePath();
        seedDatabase(database);
        return runtime();
    }

    private static TestRuntime runtime() {
        EncounterTableServiceAssembly.Component services = EncounterTableServiceAssembly.create(
                new SqliteEncounterTableCatalogAdapter(
                                TestFeatureStores.current().store(
                                        SqliteEncounterTableCatalogAdapter.storeDefinition())));
        return new TestRuntime(
                services.application(),
                services.catalog(),
                services.candidates());
    }

    private static Path databasePath() throws Exception {
        String dataHome = System.getenv("XDG_DATA_HOME");
        if (dataHome == null || dataHome.isBlank()) {
            throw new IllegalStateException("XDG_DATA_HOME must be set for EncounterTableReadbackTest.");
        }
        Path database = Path.of(dataHome, "salt-marcher", EncounterTablePersistenceSchema.DATABASE_FILE_NAME)
                .toAbsolutePath()
                .normalize();
        Files.createDirectories(database.getParent());
        return database;
    }

    private static void seedDatabase(Path database) throws Exception {
        loadDriver();
        try (Connection connection = DriverManager.getConnection("jdbc:sqlite:" + database)) {
            try (Statement statement = connection.createStatement()) {
                statement.execute("PRAGMA foreign_keys = ON");
                createSchema(statement);
                clearTables(statement);
            }
            insertLootTable(connection, 901L);
            insertCreature(connection, 101L, "Ash Guard", "humanoid", "1/4", 50, 12, 2, 8, 1, 13, 2, 0);
            insertCreature(connection, 102L, "Ember Drake", "dragon", "1", 200, 33, 4, 10, 4, 15, 1, 1);
            insertCreature(connection, 103L, "Cinder Scout", "humanoid", "1/8", 10, 7, 1, 6, 0, 12, 4, 0);
            insertTable(connection, ASH_AMBUSH_ID, "Ash Ambush", 901L);
            insertTable(connection, CINDER_PATROL_ID, "Cinder Patrol", null);
            insertEntry(connection, ASH_AMBUSH_ID, 101L, 3);
            insertEntry(connection, ASH_AMBUSH_ID, 102L, 4);
            insertEntry(connection, CINDER_PATROL_ID, 101L, 7);
            insertEntry(connection, CINDER_PATROL_ID, 103L, 2);
        }
    }

    private static void createSchema(Statement statement) throws SQLException {
        statement.execute("""
                CREATE TABLE IF NOT EXISTS creatures (
                    id INTEGER PRIMARY KEY,
                    name TEXT NOT NULL,
                    creature_type TEXT,
                    cr TEXT,
                    xp INTEGER NOT NULL DEFAULT 0,
                    hp INTEGER NOT NULL DEFAULT 0,
                    hit_dice_count INTEGER,
                    hit_dice_sides INTEGER,
                    hit_dice_modifier INTEGER,
                    ac INTEGER NOT NULL DEFAULT 0,
                    initiative_bonus INTEGER NOT NULL DEFAULT 0,
                    legendary_action_count INTEGER NOT NULL DEFAULT 0
                )
                """);
        statement.execute("CREATE TABLE IF NOT EXISTS loot_tables (loot_table_id INTEGER PRIMARY KEY)");
        statement.execute(EncounterTablePersistenceSchema.CREATE_ENCOUNTER_TABLES_SQL);
        statement.execute(EncounterTablePersistenceSchema.CREATE_ENCOUNTER_TABLE_ENTRIES_SQL);
        statement.execute(EncounterTablePersistenceSchema.CREATE_ENCOUNTER_TABLE_LOOT_LINKS_SQL);
        statement.execute(EncounterTablePersistenceSchema.CREATE_ENCOUNTER_TABLE_ENTRIES_TABLE_INDEX_SQL);
        statement.execute(EncounterTablePersistenceSchema.CREATE_ENCOUNTER_TABLE_ENTRIES_CREATURE_INDEX_SQL);
    }

    private static void clearTables(Statement statement) throws SQLException {
        statement.execute("DELETE FROM " + EncounterTablePersistenceSchema.ENCOUNTER_TABLE_LOOT_LINKS_TABLE);
        statement.execute("DELETE FROM " + EncounterTablePersistenceSchema.ENCOUNTER_TABLE_ENTRIES_TABLE);
        statement.execute("DELETE FROM " + EncounterTablePersistenceSchema.ENCOUNTER_TABLES_TABLE);
        statement.execute("DELETE FROM loot_tables");
        statement.execute("DELETE FROM creatures");
    }

    private static void insertLootTable(Connection connection, long lootTableId) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "INSERT INTO loot_tables (loot_table_id) VALUES (?)")) {
            statement.setLong(1, lootTableId);
            statement.executeUpdate();
        }
    }

    private static void insertCreature(
            Connection connection,
            long id,
            String name,
            String type,
            String challengeRating,
            int xp,
            int hitPoints,
            int hitDiceCount,
            int hitDiceSides,
            int hitDiceModifier,
            int armorClass,
            int initiativeBonus,
            int legendaryActionCount
    ) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement("""
                INSERT INTO creatures (
                    id, name, creature_type, cr, xp, hp, hit_dice_count,
                    hit_dice_sides, hit_dice_modifier, ac, initiative_bonus,
                    legendary_action_count
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """)) {
            statement.setLong(1, id);
            statement.setString(2, name);
            statement.setString(3, type);
            statement.setString(4, challengeRating);
            statement.setInt(5, xp);
            statement.setInt(6, hitPoints);
            statement.setInt(7, hitDiceCount);
            statement.setInt(8, hitDiceSides);
            statement.setInt(9, hitDiceModifier);
            statement.setInt(10, armorClass);
            statement.setInt(11, initiativeBonus);
            statement.setInt(12, legendaryActionCount);
            statement.executeUpdate();
        }
    }

    private static void insertTable(Connection connection, long tableId, String name, Long linkedLootTableId)
            throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                        "INSERT INTO encounter_tables (table_id, name, description) VALUES (?, ?,"
                            + " ?)")) {
            statement.setLong(1, tableId);
            statement.setString(2, name);
            statement.setString(3, "Test authored table.");
            statement.executeUpdate();
        }
        if (linkedLootTableId != null) {
            try (PreparedStatement statement = connection.prepareStatement(
                            "INSERT INTO encounter_table_loot_links (table_id, loot_table_id)"
                                + " VALUES (?, ?)")) {
                statement.setLong(1, tableId);
                statement.setLong(2, linkedLootTableId);
                statement.executeUpdate();
            }
        }
    }

    private static void insertEntry(Connection connection, long tableId, long creatureId, int weight)
            throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                        "INSERT INTO encounter_table_entries (table_id, creature_id, weight) VALUES"
                            + " (?, ?, ?)")) {
            statement.setLong(1, tableId);
            statement.setLong(2, creatureId);
            statement.setInt(3, weight);
            statement.executeUpdate();
        }
    }

    private static void dropCreatureTable(Path database) throws Exception {
        try (Connection connection = DriverManager.getConnection("jdbc:sqlite:" + database);
                Statement statement = connection.createStatement()) {
            statement.execute("PRAGMA foreign_keys = OFF");
            statement.execute("DROP TABLE creatures");
        }
    }

    private static void assertAuthoredSummaryLookup(EncounterTableCatalogResult result) {
        assertEquals(EncounterTableReadStatus.SUCCESS, result.status(), "ENCOUNTER-TABLE-001 catalog status");
        assertEquals(2, result.tables().size(), "ENCOUNTER-TABLE-001 summary count");
        assertEquals(ASH_AMBUSH_ID, result.tables().get(0).tableId(), "ENCOUNTER-TABLE-001 first table id");
        assertEquals("Ash Ambush", result.tables().get(0).name(), "ENCOUNTER-TABLE-001 first table name");
        assertEquals(Long.valueOf(901L), result.tables().get(0).linkedLootTableId(),
                "ENCOUNTER-TABLE-001 first loot link");
        assertEquals(CINDER_PATROL_ID, result.tables().get(1).tableId(), "ENCOUNTER-TABLE-001 second table id");
        assertEquals("Cinder Patrol", result.tables().get(1).name(), "ENCOUNTER-TABLE-001 second table name");
        assertEquals(null, result.tables().get(1).linkedLootTableId(), "ENCOUNTER-TABLE-001 second loot link");
    }

    private static void assertWeightedCandidateLookup(EncounterTableCandidatesResult result) {
        assertEquals(EncounterTableReadStatus.SUCCESS, result.status(), "ENCOUNTER-TABLE-002 candidate status");
        assertEquals(3, result.candidates().size(), "ENCOUNTER-TABLE-002 candidate count");
        assertCandidate(
                result.candidates().get(0),
                103L,
                "Cinder Scout",
                "humanoid",
                "1/8",
                10,
                7,
                2);
        assertCandidate(
                result.candidates().get(1),
                101L,
                "Ash Guard",
                "humanoid",
                "1/4",
                50,
                12,
                7);
        assertCandidate(
                result.candidates().get(2),
                102L,
                "Ember Drake",
                "dragon",
                "1",
                200,
                33,
                4);
    }

    private static void assertEmptySelection(EncounterTableCandidatesResult result) {
        assertEquals(EncounterTableReadStatus.SUCCESS, result.status(), "ENCOUNTER-TABLE-003 empty status");
        assertEquals(0, result.candidates().size(), "ENCOUNTER-TABLE-003 empty candidates");
    }

    private static void assertXpCeiling(EncounterTableCandidatesResult result) {
        assertEquals(EncounterTableReadStatus.SUCCESS, result.status(), "ENCOUNTER-TABLE-004 ceiling status");
        assertEquals(2, result.candidates().size(), "ENCOUNTER-TABLE-004 ceiling candidate count");
        assertEquals(103L, result.candidates().get(0).creatureId(), "ENCOUNTER-TABLE-004 low-xp id");
        assertEquals(101L, result.candidates().get(1).creatureId(), "ENCOUNTER-TABLE-004 ceiling id");
    }

    private static void assertUnboundedXpCeiling(EncounterTableCandidatesResult result) {
        assertEquals(EncounterTableReadStatus.SUCCESS, result.status(), "ENCOUNTER-TABLE-004 unbounded status");
        assertEquals(3, result.candidates().size(), "ENCOUNTER-TABLE-004 unbounded candidate count");
        assertEquals(102L, result.candidates().get(2).creatureId(), "ENCOUNTER-TABLE-004 unbounded high-xp id");
    }

    private static void assertStorageErrorPublication(EncounterTableCandidatesResult result) {
        assertEquals(EncounterTableReadStatus.STORAGE_ERROR, result.status(), "ENCOUNTER-TABLE-005 storage status");
        assertEquals(0, result.candidates().size(), "ENCOUNTER-TABLE-005 storage candidates");
    }

    private static void assertCandidate(
            EncounterTableCandidate candidate,
            long creatureId,
            String name,
            String type,
            String challengeRating,
            int xp,
            int hitPoints,
            int weight
    ) {
        assertEquals(creatureId, candidate.creatureId(), "ENCOUNTER-TABLE-002 candidate id " + creatureId);
        assertEquals(name, candidate.name(), "ENCOUNTER-TABLE-002 candidate name " + creatureId);
        assertEquals(type, candidate.creatureType(), "ENCOUNTER-TABLE-002 candidate type " + creatureId);
        assertEquals(challengeRating, candidate.challengeRating(), "ENCOUNTER-TABLE-002 candidate CR " + creatureId);
        assertEquals(xp, candidate.xp(), "ENCOUNTER-TABLE-002 candidate XP " + creatureId);
        assertEquals(hitPoints, candidate.hitPoints(), "ENCOUNTER-TABLE-002 candidate HP " + creatureId);
        assertEquals(weight, candidate.weight(), "ENCOUNTER-TABLE-002 candidate weight " + creatureId);
        assertEquals("Encounter table", candidate.sourceLabel(), "ENCOUNTER-TABLE-002 source " + creatureId);
    }

    private static void assertEquals(Object expected, Object actual, String label) {
        if (!Objects.equals(expected, actual)) {
            throw new AssertionError(label + ": expected <" + expected + "> but was <" + actual + ">");
        }
    }

    private static void loadDriver() throws Exception {
        Class.forName("org.sqlite.JDBC");
    }

    private record TestRuntime(
            EncounterTableApi service,
            EncounterTableCatalogModel catalog,
            EncounterTableCandidatesModel candidates
    ) {
    }
}
