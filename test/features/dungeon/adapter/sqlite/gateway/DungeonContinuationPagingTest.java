package features.dungeon.adapter.sqlite.gateway;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import features.dungeon.api.DungeonChunkKey;
import features.dungeon.application.authored.port.DungeonContinuationPage;
import features.dungeon.application.authored.port.DungeonContinuationPageRequest;
import features.dungeon.application.authored.port.DungeonWindowRequest;
import features.dungeon.domain.core.structure.DungeonMapIdentity;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.Statement;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import platform.diagnostics.NoopDiagnostics;
import platform.persistence.SqliteDatabase;

final class DungeonContinuationPagingTest {

    @Test
    void pagesAtMost257RowsWithoutGapsAndBindsCursorToWindowIdentity(@TempDir Path tempDir) throws Exception {
        Path path = tempDir.resolve("continuations.db");
        try (SqliteDatabase database = new SqliteDatabase(path, NoopDiagnostics.INSTANCE)) {
            var fixture = DungeonSqliteFixtureSeeder.prepare(database);
            DungeonSqliteWindowGateway gateway = new DungeonSqliteWindowGateway(fixture.store());
            gateway.loadIndex(new DungeonWindowRequest(new DungeonMapIdentity(77L), 1L, List.of()));
            seed(path, 513);

            DungeonChunkKey requested = new DungeonChunkKey(77L, 0, 0, 0);
            DungeonChunkKey offWindow = new DungeonChunkKey(77L, 0, 1, 0);
            var index = gateway.loadIndex(new DungeonWindowRequest(
                    new DungeonMapIdentity(77L), 19L, List.of(requested))).orElseThrow();
            DungeonContinuationPage first = index.continuationPage();
            assertEquals(256, first.entries().size());
            assertTrue(first.nextCursor().isPresent());

            DungeonContinuationPage second = gateway.loadContinuationPage(new DungeonContinuationPageRequest(
                    new DungeonMapIdentity(77L), 7L, 19L, List.of(requested), first.nextCursor()))
                    .orElseThrow();
            assertEquals(256, second.entries().size());
            DungeonContinuationPage third = gateway.loadContinuationPage(new DungeonContinuationPageRequest(
                    new DungeonMapIdentity(77L), 7L, 19L, List.of(requested), second.nextCursor()))
                    .orElseThrow();
            assertEquals(1, third.entries().size());
            assertFalse(third.nextCursor().isPresent());

            Set<Long> ids = new LinkedHashSet<>();
            List.of(first, second, third).forEach(page -> page.entries().forEach(
                    entry -> ids.add(entry.entityRef().id())));
            assertEquals(513, ids.size());
            assertTrue(gateway.loadContinuationPage(new DungeonContinuationPageRequest(
                    new DungeonMapIdentity(77L), 6L, 19L, List.of(requested), java.util.Optional.empty())).isEmpty());
            assertThrows(IllegalArgumentException.class, () -> new DungeonContinuationPageRequest(
                    new DungeonMapIdentity(77L), 7L, 20L, List.of(offWindow), first.nextCursor()));
        }
    }

    private static void seed(Path path, int entities) throws Exception {
        try (Connection connection = DriverManager.getConnection("jdbc:sqlite:" + path.toAbsolutePath());
             Statement statement = connection.createStatement()) {
            statement.executeUpdate("INSERT INTO dungeon_maps(dungeon_map_id,name,revision) VALUES(77,'Paged',7)");
            statement.executeUpdate("INSERT INTO dungeon_chunks(dungeon_map_id,level_z,chunk_q,chunk_r,content_revision)"
                    + " VALUES(77,0,0,0,7),(77,0,1,0,7)");
            try (PreparedStatement insert = connection.prepareStatement(
                    "INSERT INTO dungeon_entity_chunks(dungeon_map_id,entity_kind,entity_id,level_z,chunk_q,chunk_r,"
                            + "minimum_q,minimum_r,maximum_q,maximum_r,entity_chunk_count) VALUES(77,'FEATURE_MARKER',?,?,?,?,?,?,?,?,2)")) {
                for (long id = 1; id <= entities; id++) {
                    insert.setLong(1, id);
                    insert.setInt(2, 0); insert.setInt(3, 0); insert.setInt(4, 0);
                    insert.setInt(5, 0); insert.setInt(6, 0); insert.setInt(7, 0); insert.setInt(8, 0);
                    insert.addBatch();
                    insert.setLong(1, id);
                    insert.setInt(2, 0); insert.setInt(3, 1); insert.setInt(4, 0);
                    insert.setInt(5, 64); insert.setInt(6, 0); insert.setInt(7, 64); insert.setInt(8, 0);
                    insert.addBatch();
                }
                insert.executeBatch();
            }
            statement.executeUpdate("INSERT INTO dungeon_authored_level_bounds"
                    + "(dungeon_map_id,level_z,minimum_q,minimum_r,maximum_q,maximum_r) VALUES(77,0,0,0,64,0)");
        }
    }
}
