package features.party.adapter.sqlite.gateway.local;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import features.party.PartyServiceAssembly;
import features.party.adapter.sqlite.model.PartyCharacterRecord;
import features.party.adapter.sqlite.model.PartyPersistenceSchema;
import features.party.adapter.sqlite.model.PartyRosterRecord;
import features.party.adapter.sqlite.repository.SqlitePartyRosterRepository;
import features.party.api.CharacterDraft;
import features.party.api.CreateCharacterCommand;
import features.party.api.MutationStatus;
import features.party.api.ReadStatus;
import java.nio.file.Path;
import java.nio.file.Files;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import platform.diagnostics.NoopDiagnostics;
import platform.execution.DirectExecutionLane;
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
    void currentV1PreservesAbsentOptionalFactsAndDistinctNamesakeIdentities() throws Exception {
        Path path = temporaryDirectory.resolve("party-nullable-current.db");
        PartyCharacterRecord first = nameOnlyCharacter(1L, "Aria");
        PartyCharacterRecord second = nameOnlyCharacter(2L, "Aria");
        PartyRosterRecord expected = new PartyRosterRecord(3L, List.of(first, second));

        try (SqliteDatabase database = new SqliteDatabase(path, NoopDiagnostics.INSTANCE)) {
            SqlitePartyLocalGateway gateway = gateway(database);
            gateway.save(expected);
            assertEquals(expected, gateway.load());

            PartyCharacterRecord editedSecond = new PartyCharacterRecord(
                    2L,
                    new PartyCharacterRecord.Identity("Aria", "Mira"),
                    new PartyCharacterRecord.Progress(7, 23_000, 0, 0, 0),
                    new PartyCharacterRecord.Combat(15, 18),
                    "RESERVE",
                    second.travel());
            gateway.save(new PartyRosterRecord(3L, List.of(first, editedSecond)));
        }

        try (SqliteDatabase reopened = new SqliteDatabase(path, NoopDiagnostics.INSTANCE)) {
            PartyRosterRecord actual = gateway(reopened).load();
            assertEquals(first, actual.characters().getFirst(),
                    "editing a namesake leaves the other identity untouched");
            assertEquals(2L, actual.characters().get(1).id());
            assertEquals("Mira", actual.characters().get(1).identity().playerName());
        }
        try (Connection connection = rawConnection(path)) {
            assertEquals(1, scalarInt(connection,
                    "SELECT COUNT(*) FROM player_characters WHERE id=1 AND player_name IS NULL "
                            + "AND level IS NULL AND passive_perception IS NULL AND ac IS NULL"));
            assertEquals(0, scalarInt(connection,
                    "SELECT in_party FROM player_characters WHERE id=1"));
            assertEquals(0, scalarInt(connection,
                    "SELECT attached_to_party_token FROM player_characters WHERE id=1"));
        }
    }

    @Test
    void absentTravelRecordFailsBeforeWriteAndLeavesDurableTruthUnchanged() throws Exception {
        Path path = temporaryDirectory.resolve("party-null-travel-current.db");
        PartyRosterRecord stable = new PartyRosterRecord(2L, List.of(nameOnlyCharacter(1L, "Stable")));
        PartyCharacterRecord input = new PartyCharacterRecord(
                1L,
                new PartyCharacterRecord.Identity("Aria", null),
                new PartyCharacterRecord.Progress(null, 0, 0, 0, 0),
                new PartyCharacterRecord.Combat(null, null),
                "RESERVE",
                null);

        try (SqliteDatabase database = new SqliteDatabase(path, NoopDiagnostics.INSTANCE)) {
            SqlitePartyLocalGateway gateway = gateway(database);
            gateway.save(stable);
            assertThrows(IllegalStateException.class,
                    () -> gateway.save(new PartyRosterRecord(2L, List.of(input))));
            assertEquals(stable, gateway.load());
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

    @Test
    void currentV1WriteRejectsInvalidProgressMembershipAndIncompleteTravelWithoutChangingTruth()
            throws Exception {
        Path path = temporaryDirectory.resolve("party-invalid-write.db");
        PartyRosterRecord stable = new PartyRosterRecord(2L, List.of(character()));
        List<PartyCharacterRecord> invalidCharacters = List.of(
                withProgress(new PartyCharacterRecord.Progress(3, -1, 0, 0, 0)),
                withProgress(new PartyCharacterRecord.Progress(3, 899, 0, 0, 0)),
                withProgress(new PartyCharacterRecord.Progress(3, 900, 901, 0, 0)),
                withProgress(new PartyCharacterRecord.Progress(3, 900, 100, 101, 0)),
                withProgress(new PartyCharacterRecord.Progress(3, 900, 0, 0, 3)),
                withMembership("UNKNOWN"),
                withMembership(" ACTIVE "),
                withTravel(new PartyCharacterRecord.Travel(
                        "OVERWORLD", null, "", null, null, null, null, "", -7L, 2L, true)),
                withTravel(new PartyCharacterRecord.Travel(
                        "DUNGEON", 7L, "TILE", 9L, 1, null, 0, "NORTH", null, null, true)));

        try (SqliteDatabase database = new SqliteDatabase(path, NoopDiagnostics.INSTANCE)) {
            SqlitePartyLocalGateway gateway = gateway(database);
            gateway.save(stable);
            byte[] stableBytes = Files.readAllBytes(path);
            for (PartyCharacterRecord invalid : invalidCharacters) {
                assertThrows(IllegalStateException.class,
                        () -> gateway.save(new PartyRosterRecord(2L, List.of(invalid))));
                assertEquals(stable, gateway.load(),
                        "validation rejects the whole record before touching current-v1 truth");
                assertArrayEquals(stableBytes, Files.readAllBytes(path),
                        "validation rejects before changing any current-v1 database byte");
            }
        }
    }

    @Test
    void corruptCurrentV1ReadBecomesStorageErrorAndFailedMutationKeepsPublishedAndDurableTruth()
            throws Exception {
        Path path = temporaryDirectory.resolve("party-corrupt-read-boundary.db");
        try (SqliteDatabase database = new SqliteDatabase(path, NoopDiagnostics.INSTANCE)) {
            PartyServiceAssembly.Component party = PartyServiceAssembly.create(
                    new SqlitePartyRosterRepository(
                            TestFeatureStores.store(database, SqlitePartyLocalGateway.storeDefinition())),
                    DirectExecutionLane.INSTANCE,
                    DirectExecutionLane.INSTANCE,
                    Runnable::run,
                    NoopDiagnostics.INSTANCE);
            party.application().createCharacter(new CreateCharacterCommand(
                    new CharacterDraft("Stable", null, null, null, null)));
            var publishedBefore = party.snapshot().current();
            long publicationRevisionBefore = party.activePartyFacts().current().facts().revision();

            try (Connection connection = rawConnection(path); Statement statement = connection.createStatement()) {
                statement.execute("UPDATE player_characters SET current_xp=-1 WHERE id=1");
            }
            party.application().createCharacter(new CreateCharacterCommand(
                    new CharacterDraft("Must not persist", null, null, null, null)));

            assertEquals(MutationStatus.STORAGE_ERROR, party.mutation().current().status());
            assertEquals(ReadStatus.SUCCESS, party.snapshot().current().status());
            assertEquals(publishedBefore, party.snapshot().current(),
                    "a corrupt read cannot replace the last coherent published Roster");
            assertEquals(publicationRevisionBefore,
                    party.activePartyFacts().current().facts().revision(),
                    "a rejected mutation cannot claim a new publication revision");
            try (Connection connection = rawConnection(path)) {
                assertEquals(1, scalarInt(connection, "SELECT COUNT(*) FROM player_characters"));
                assertEquals(-1, scalarInt(connection, "SELECT current_xp FROM player_characters WHERE id=1"));
            }
        }
    }

    @Test
    void corruptBooleanAndIncompleteTravelRowsFailReadWithoutRepairingTheirBytes() throws Exception {
        List<String> corruptions = List.of(
                "UPDATE player_characters SET in_party=2 WHERE id=1",
                "UPDATE player_characters SET short_rests_taken_since_long_rest=9 WHERE id=1",
                "UPDATE player_characters SET travel_location_kind='DUNGEON',"
                        + " travel_dungeon_map_id=7, travel_dungeon_location_kind='TILE',"
                        + " travel_dungeon_owner_id=9, travel_dungeon_q=1, travel_dungeon_r=NULL,"
                        + " travel_dungeon_level=0, travel_dungeon_heading='NORTH' WHERE id=1");
        for (int index = 0; index < corruptions.size(); index++) {
            Path path = temporaryDirectory.resolve("party-corrupt-row-" + index + ".db");
            try (SqliteDatabase database = new SqliteDatabase(path, NoopDiagnostics.INSTANCE)) {
                SqlitePartyLocalGateway gateway = gateway(database);
                gateway.save(new PartyRosterRecord(2L, List.of(character())));
                try (Connection connection = rawConnection(path); Statement statement = connection.createStatement()) {
                    statement.execute(corruptions.get(index));
                }
                assertThrows(IllegalStateException.class, gateway::load);
            }
            try (Connection connection = rawConnection(path)) {
                assertEquals(1, scalarInt(connection, "SELECT COUNT(*) FROM player_characters"),
                        "failed reads do not rewrite or drop corrupt current-v1 rows");
            }
        }
    }

    private static PartyCharacterRecord withProgress(PartyCharacterRecord.Progress progress) {
        PartyCharacterRecord base = character();
        return new PartyCharacterRecord(
                base.id(), base.identity(), progress, base.combat(), base.membership(), base.travel());
    }

    private static PartyCharacterRecord withMembership(String membership) {
        PartyCharacterRecord base = character();
        return new PartyCharacterRecord(
                base.id(), base.identity(), base.progress(), base.combat(), membership, base.travel());
    }

    private static PartyCharacterRecord withTravel(PartyCharacterRecord.Travel travel) {
        PartyCharacterRecord base = character();
        return new PartyCharacterRecord(
                base.id(), base.identity(), base.progress(), base.combat(), base.membership(), travel);
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

    private static PartyCharacterRecord nameOnlyCharacter(long id, String name) {
        return new PartyCharacterRecord(
                id,
                new PartyCharacterRecord.Identity(name, null),
                new PartyCharacterRecord.Progress(null, 0, 0, 0, 0),
                new PartyCharacterRecord.Combat(null, null),
                "RESERVE",
                new PartyCharacterRecord.Travel(
                        "", null, "", null, null, null, null, "", null, null, false));
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
