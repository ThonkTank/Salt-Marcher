package features.sessiongeneration.adapter.sqlite.persistence;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import features.sessiongeneration.adapter.resource.TsvGenerationCatalog;
import features.sessiongeneration.domain.generation.GeneratedRun;
import features.sessiongeneration.domain.generation.GenerationInput;
import features.sessiongeneration.domain.generation.SessionGenerationEngine;
import java.math.BigDecimal;
import java.sql.DriverManager;
import java.util.List;
import java.util.OptionalInt;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import platform.diagnostics.NoopDiagnostics;
import platform.persistence.SqliteDatabase;

final class SqliteGenerationRunRepositoryTest {

    @TempDir
    java.nio.file.Path temporaryDirectory;

    @Test
    void immutableRelationalRunRoundTripsWithoutBinaryPayload() throws Exception {
        java.nio.file.Path databasePath = temporaryDirectory.resolve("roundtrip.sqlite");
        try (SqliteDatabase database = new SqliteDatabase(databasePath, NoopDiagnostics.INSTANCE)) {
            SqliteGenerationRunRepository repository = new SqliteGenerationRunRepository(database);
            GeneratedRun generated = generate(179974L);

            assertEquals(generated, repository.save(generated));
            assertEquals(generated, repository.load(generated.runId()).orElseThrow());
        }

        try (var connection = DriverManager.getConnection("jdbc:sqlite:" + databasePath);
                var statement = connection.createStatement();
                var rows = statement.executeQuery("SELECT owner, schema_version FROM session_generation_runs")) {
            assertTrue(rows.next());
            assertEquals("session-generation", rows.getString(1));
            assertEquals(1, rows.getInt(2));
        }
    }

    @Test
    void failedChildInsertRollsBackEntireImmutableRun() throws Exception {
        java.nio.file.Path databasePath = temporaryDirectory.resolve("rollback.sqlite");
        GeneratedRun first = generate(179974L);
        GeneratedRun blocked = generate(179975L);
        try (SqliteDatabase database = new SqliteDatabase(databasePath, NoopDiagnostics.INSTANCE)) {
            SqliteGenerationRunRepository repository = new SqliteGenerationRunRepository(database);
            repository.save(first);
            try (var connection = DriverManager.getConnection("jdbc:sqlite:" + databasePath);
                    var statement = connection.createStatement()) {
                statement.execute("CREATE TRIGGER fail_generation_loot BEFORE INSERT ON session_generation_loot_items "
                        + "BEGIN SELECT RAISE(ABORT, 'forced rollback'); END");
            }

            assertThrows(IllegalStateException.class, () -> repository.save(blocked));
            assertTrue(repository.load(blocked.runId()).isEmpty());
            assertTrue(repository.load(first.runId()).isPresent());
        }
    }

    @Test
    void loadRejectsCorruptedAggregateSummary() throws Exception {
        java.nio.file.Path databasePath = temporaryDirectory.resolve("corrupt.sqlite");
        GeneratedRun generated = generate(179974L);
        try (SqliteDatabase database = new SqliteDatabase(databasePath, NoopDiagnostics.INSTANCE)) {
            SqliteGenerationRunRepository repository = new SqliteGenerationRunRepository(database);
            repository.save(generated);
            try (var connection = DriverManager.getConnection("jdbc:sqlite:" + databasePath);
                    var statement = connection.createStatement()) {
                statement.executeUpdate("UPDATE session_generation_runs SET normal_actual_cp = normal_actual_cp + 1");
            }

            assertThrows(IllegalStateException.class, () -> repository.load(generated.runId()));
        }
    }

    @Test
    void loadRejectsGappedEncounterBlockOrder() throws Exception {
        assertOrderCorruptionRejected(
                "block-order.sqlite",
                "UPDATE session_generation_encounter_blocks SET block_order = 99 "
                        + "WHERE rowid = (SELECT rowid FROM session_generation_encounter_blocks LIMIT 1)");
    }

    @Test
    void loadRejectsGappedAuditOrder() throws Exception {
        assertOrderCorruptionRejected(
                "audit-order.sqlite",
                "UPDATE session_generation_audits SET audit_order = 99 "
                        + "WHERE audit_order = 0");
    }

    private void assertOrderCorruptionRejected(String fileName, String updateSql) throws Exception {
        java.nio.file.Path databasePath = temporaryDirectory.resolve(fileName);
        GeneratedRun generated = generate(179974L);
        try (SqliteDatabase database = new SqliteDatabase(databasePath, NoopDiagnostics.INSTANCE)) {
            SqliteGenerationRunRepository repository = new SqliteGenerationRunRepository(database);
            repository.save(generated);
            try (var connection = DriverManager.getConnection("jdbc:sqlite:" + databasePath);
                    var statement = connection.createStatement()) {
                statement.executeUpdate(updateSql);
            }

            assertThrows(IllegalStateException.class, () -> repository.load(generated.runId()));
        }
    }

    private static GeneratedRun generate(long seed) {
        return new SessionGenerationEngine().generate(
                new GenerationInput(
                        List.of(new GeneratedRun.PartyLevel(3, 2), new GeneratedRun.PartyLevel(4, 2)),
                        new BigDecimal("0.6"), OptionalInt.of(3), seed),
                new TsvGenerationCatalog().load());
    }
}
