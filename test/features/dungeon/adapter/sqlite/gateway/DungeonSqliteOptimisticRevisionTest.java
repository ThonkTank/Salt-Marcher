package features.dungeon.adapter.sqlite.gateway;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import features.dungeon.adapter.sqlite.model.DungeonGridBoundsRecord;
import features.dungeon.adapter.sqlite.model.DungeonFeatureMarkerRecord;
import features.dungeon.adapter.sqlite.model.DungeonMapRecord;
import java.nio.file.Path;
import java.sql.DriverManager;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import platform.diagnostics.NoopDiagnostics;
import platform.persistence.SqliteDatabase;

class DungeonSqliteOptimisticRevisionTest {

    @TempDir
    Path temporaryDirectory;

    @Test
    void rejectsSkippedOrStaleRevisionsWithoutChangingTheStoredMap() {
        try (SqliteDatabase database = new SqliteDatabase(
                temporaryDirectory.resolve("dungeon.sqlite"),
                NoopDiagnostics.INSTANCE)) {
            DungeonSqliteGateway gateway = new DungeonSqliteGateway(database);
            gateway.saveMap(map(41L, "first", 1L));

            assertThrows(IllegalStateException.class, () -> gateway.saveMap(map(41L, "skipped", 3L)));

            DungeonMapRecord stored = gateway.findMap(41L).orElseThrow();
            assertEquals(1L, stored.revision());
            assertEquals("first", stored.name());

            assertEquals(2L, gateway.saveMap(map(41L, "second", 2L)).revision());
        }
    }

    @Test
    void incrementalSaveDoesNotRewriteUnchangedStableIdentityRows() throws Exception {
        Path databasePath = temporaryDirectory.resolve("incremental.sqlite");
        try (SqliteDatabase database = new SqliteDatabase(databasePath, NoopDiagnostics.INSTANCE)) {
            DungeonSqliteGateway gateway = new DungeonSqliteGateway(database);
            DungeonMapRecord first = mapWithMarker(51L, "first", 1L, "Marker");
            gateway.saveMap(first);
            try (var connection = DriverManager.getConnection("jdbc:sqlite:" + databasePath);
                 var statement = connection.createStatement()) {
                statement.execute("CREATE TABLE marker_update_count(value INTEGER NOT NULL)");
                statement.execute("INSERT INTO marker_update_count(value) VALUES(0)");
                statement.execute("CREATE TRIGGER count_marker_updates AFTER UPDATE ON dungeon_feature_markers "
                        + "BEGIN UPDATE marker_update_count SET value=value+1; END");
            }

            DungeonMapRecord renamed = mapWithMarker(51L, "renamed", 2L, "Marker");
            gateway.saveChange(first, renamed);
            assertEquals(0L, scalar(databasePath, "SELECT value FROM marker_update_count"));

            DungeonMapRecord changed = mapWithMarker(51L, "renamed", 3L, "Changed");
            gateway.saveChange(renamed, changed);
            assertEquals(1L, scalar(databasePath, "SELECT value FROM marker_update_count"));
        }
    }

    private static DungeonMapRecord map(long id, String name, long revision) {
        return new DungeonMapRecord(id, name, revision, DungeonGridBoundsRecord.defaultGrid());
    }

    private static DungeonMapRecord mapWithMarker(long id, String name, long revision, String label) {
        return new DungeonMapRecord(
                id,
                name,
                revision,
                DungeonGridBoundsRecord.defaultGrid(),
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of(new DungeonFeatureMarkerRecord(71L, id, "POI", 4, 5, 0, label, "")));
    }

    private static long scalar(Path databasePath, String sql) throws Exception {
        try (var connection = DriverManager.getConnection("jdbc:sqlite:" + databasePath);
             var statement = connection.createStatement();
             var resultSet = statement.executeQuery(sql)) {
            return resultSet.getLong(1);
        }
    }
}
