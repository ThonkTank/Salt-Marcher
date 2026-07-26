package features.party.adapter.sqlite.gateway.local;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import features.party.adapter.sqlite.model.PartyCharacterRecord;
import features.party.adapter.sqlite.model.PartyPersistenceSchema;
import features.party.adapter.sqlite.model.PartyRosterRecord;
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

final class PartyCurrentSchemaTest {

    @TempDir
    Path temporaryDirectory;

    @Test
    void freshStoreCreatesCurrentSchemaAtVersionOneAndSurvivesRestart() throws Exception {
        Path path = temporaryDirectory.resolve("party-current.db");
        PartyRosterRecord expected = new PartyRosterRecord(2L, List.of(character()));

        try (SqliteDatabase database = new SqliteDatabase(path, NoopDiagnostics.INSTANCE)) {
            gateway(database).save(expected);
        }
        try (SqliteDatabase reopened = new SqliteDatabase(path, NoopDiagnostics.INSTANCE)) {
            assertEquals(expected, gateway(reopened).load());
        }
        try (Connection connection = rawConnection(path)) {
            assertEquals(1, featureVersion(connection));
            assertEquals(1, scalarInt(connection, "SELECT COUNT(*) FROM party_roster_metadata"));
            assertEquals(22, columnCount(connection, "player_characters"));
        }
    }

    @Test
    void unversionedPartialShapeFailsWithoutRepairOrVersionClaim() throws Exception {
        Path path = temporaryDirectory.resolve("party-unversioned-partial.db");
        try (Connection connection = rawConnection(path); Statement statement = connection.createStatement()) {
            platform.persistence.TestFeatureStores.createCurrentPlatformLedger(statement);
            statement.execute("CREATE TABLE player_characters(id INTEGER PRIMARY KEY, name TEXT NOT NULL)");
            statement.execute("INSERT INTO player_characters VALUES(7, 'Unchanged')");
        }

        assertUnavailable(path);

        try (Connection connection = rawConnection(path)) {
            assertEquals(2, columnCount(connection, "player_characters"));
            assertEquals("Unchanged", scalarText(connection, "SELECT name FROM player_characters WHERE id=7"));
            assertFalse(ownerVersionExists(connection));
            assertFalse(schemaObjectExists(connection, "table", "party_roster_metadata"));
        }
    }

    @Test
    void recordedPartialVersionOneFailsClosedWithoutSameVersionRepair() throws Exception {
        Path path = temporaryDirectory.resolve("party-recorded-partial.db");
        try (Connection connection = rawConnection(path); Statement statement = connection.createStatement()) {
            createVersionTable(statement, 1);
            statement.execute("CREATE TABLE player_characters(id INTEGER PRIMARY KEY, name TEXT NOT NULL)");
            statement.execute("INSERT INTO player_characters VALUES(9, 'Kept')");
        }

        assertUnavailable(path);

        try (Connection connection = rawConnection(path)) {
            assertEquals(1, featureVersion(connection));
            assertEquals(2, columnCount(connection, "player_characters"));
            assertEquals("Kept", scalarText(connection, "SELECT name FROM player_characters WHERE id=9"));
            assertFalse(schemaObjectExists(connection, "table", "party_roster_metadata"));
        }
    }

    @Test
    void newerVersionAndAdjacentOwnerObjectBothFailUnchanged() throws Exception {
        Path newer = temporaryDirectory.resolve("party-newer.db");
        try (Connection connection = rawConnection(newer); Statement statement = connection.createStatement()) {
            createVersionTable(statement, 2);
            statement.execute("CREATE TABLE player_characters_retired(payload TEXT NOT NULL)");
            statement.execute("INSERT INTO player_characters_retired VALUES('newer')");
        }
        assertUnavailable(newer);
        try (Connection connection = rawConnection(newer)) {
            assertEquals(2, featureVersion(connection));
            assertEquals("newer", scalarText(connection, "SELECT payload FROM player_characters_retired"));
        }

        Path adjacent = temporaryDirectory.resolve("party-adjacent.db");
        try (Connection connection = rawConnection(adjacent); Statement statement = connection.createStatement()) {
            createVersionTable(statement, 1);
            for (String sql : PartyPersistenceSchema.CREATE_TABLE_SQL) {
                statement.execute(sql);
            }
            statement.execute(PartyPersistenceSchema.INITIALIZE_METADATA_SQL);
            statement.execute("CREATE TABLE party_roster_metadata_retired(payload TEXT NOT NULL)");
            statement.execute("INSERT INTO party_roster_metadata_retired VALUES('kept')");
        }
        assertUnavailable(adjacent);
        try (Connection connection = rawConnection(adjacent)) {
            assertEquals("kept", scalarText(connection, "SELECT payload FROM party_roster_metadata_retired"));
            assertEquals(1, featureVersion(connection));
        }
    }

    @Test
    void missingMetadataRowFailsClosedInsteadOfBeingReconstructed() throws Exception {
        Path path = temporaryDirectory.resolve("party-missing-metadata.db");
        try (SqliteDatabase database = new SqliteDatabase(path, NoopDiagnostics.INSTANCE)) {
            gateway(database).load();
        }
        try (Connection connection = rawConnection(path); Statement statement = connection.createStatement()) {
            statement.execute("DELETE FROM party_roster_metadata");
        }

        try (SqliteDatabase reopened = new SqliteDatabase(path, NoopDiagnostics.INSTANCE)) {
            assertThrows(IllegalStateException.class, () -> gateway(reopened).load());
        }
        try (Connection connection = rawConnection(path)) {
            assertEquals(0, scalarInt(connection, "SELECT COUNT(*) FROM party_roster_metadata"));
        }
    }

    @Test
    void failedCurrentSaveRollsBackCharactersAndMetadataTogether() throws Exception {
        Path path = temporaryDirectory.resolve("party-rollback.db");
        PartyRosterRecord stable = new PartyRosterRecord(2L, List.of(character()));
        try (SqliteDatabase database = new SqliteDatabase(path, NoopDiagnostics.INSTANCE)) {
            SqlitePartyLocalGateway gateway = gateway(database);
            gateway.save(stable);
            try (Connection connection = rawConnection(path); Statement statement = connection.createStatement()) {
                statement.execute("CREATE TRIGGER fail_party_character BEFORE INSERT ON player_characters "
                        + "WHEN NEW.id=2 BEGIN SELECT RAISE(ABORT, 'forced rollback'); END");
            }
            PartyRosterRecord blocked = new PartyRosterRecord(3L, List.of(new PartyCharacterRecord(
                    2L,
                    new PartyCharacterRecord.Identity("Blocked", ""),
                    new PartyCharacterRecord.Progress(1, 0, 0, 0, 0),
                    new PartyCharacterRecord.Combat(10, 10),
                    "RESERVE",
                    new PartyCharacterRecord.Travel(
                            "", null, "", null, null, null, null, "", null, null, true))));

            assertThrows(IllegalStateException.class, () -> gateway.save(blocked));
            assertEquals(stable, gateway.load());
        }
    }

    private static PartyCharacterRecord character() {
        return new PartyCharacterRecord(
                1L,
                new PartyCharacterRecord.Identity("Aria", "Mira"),
                new PartyCharacterRecord.Progress(3, 900, 120, 40, 1),
                new PartyCharacterRecord.Combat(14, 16),
                "ACTIVE",
                new PartyCharacterRecord.Travel("", null, "", null, null, null, null, "", null, null, true));
    }

    private static SqlitePartyLocalGateway gateway(SqliteDatabase database) {
        return new SqlitePartyLocalGateway(
                TestFeatureStores.store(database, SqlitePartyLocalGateway.storeDefinition()));
    }

    private static void assertUnavailable(Path path) {
        try (SqliteDatabase database = new SqliteDatabase(path, NoopDiagnostics.INSTANCE)) {
            SqlitePartyLocalGateway gateway = gateway(database);
            assertThrows(IllegalStateException.class, gateway::load);
        }
    }

    private static Connection rawConnection(Path path) throws Exception {
        Class.forName("org.sqlite.JDBC");
        return DriverManager.getConnection("jdbc:sqlite:" + path);
    }

    private static void createVersionTable(Statement statement, int version) throws Exception {
        platform.persistence.TestFeatureStores.createCurrentPlatformLedger(statement);
        statement.execute("INSERT INTO sm_schema_versions(owner, version) VALUES ('party', " + version + ")");
    }

    private static int featureVersion(Connection connection) throws Exception {
        return scalarInt(connection, "SELECT version FROM sm_schema_versions WHERE owner='party'");
    }

    private static boolean ownerVersionExists(Connection connection) throws Exception {
        if (!schemaObjectExists(connection, "table", "sm_schema_versions")) {
            return false;
        }
        return scalarInt(connection, "SELECT COUNT(*) FROM sm_schema_versions WHERE owner='party'") != 0;
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
