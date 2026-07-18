package features.dungeon.adapter.sqlite.gateway;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import features.dungeon.adapter.sqlite.model.DungeonGridBoundsRecord;
import features.dungeon.adapter.sqlite.model.DungeonFeatureMarkerRecord;
import features.dungeon.adapter.sqlite.model.DungeonMapRecord;
import features.dungeon.adapter.sqlite.model.DungeonTopologyElementRecord;
import features.dungeon.adapter.sqlite.repository.SqliteDungeonUnitOfWork;
import features.dungeon.application.authored.command.DungeonPatch;
import features.dungeon.application.authored.command.FeatureMarkerChange;
import features.dungeon.application.authored.port.DungeonUnitOfWorkResult;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.structure.DungeonMapIdentity;
import features.dungeon.domain.core.structure.feature.FeatureMarker;
import features.dungeon.domain.core.structure.feature.FeatureMarkerKind;
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
            gateway.saveMaps(List.of(map(41L, "first", 1L)));

            assertThrows(
                    IllegalStateException.class,
                    () -> gateway.saveMaps(List.of(map(41L, "skipped", 3L))));

            DungeonMapRecord stored = gateway.findMap(41L).orElseThrow();
            assertEquals(1L, stored.revision());
            assertEquals("first", stored.name());

            assertEquals(2L, gateway.saveMaps(List.of(map(41L, "second", 2L))).getFirst().revision());
        }
    }

    @Test
    void patchCommitDoesNotRewriteUnchangedStableIdentityRows() throws Exception {
        Path databasePath = temporaryDirectory.resolve("incremental.sqlite");
        try (SqliteDatabase database = new SqliteDatabase(databasePath, NoopDiagnostics.INSTANCE)) {
            DungeonSqliteGateway gateway = new DungeonSqliteGateway(database);
            gateway.saveMaps(List.of(mapWithMarkers()));
            try (var connection = DriverManager.getConnection("jdbc:sqlite:" + databasePath);
                 var statement = connection.createStatement()) {
                statement.execute("CREATE TABLE marker_update_count(value INTEGER NOT NULL)");
                statement.execute("INSERT INTO marker_update_count(value) VALUES(0)");
                statement.execute("CREATE TRIGGER count_marker_updates AFTER UPDATE ON dungeon_feature_markers "
                        + "BEGIN UPDATE marker_update_count SET value=value+1; END");
            }

            DungeonMapIdentity map = new DungeonMapIdentity(51L);
            FeatureMarker before = marker(map, 71L, "Marker");
            FeatureMarker after = marker(map, 71L, "Changed");
            DungeonUnitOfWorkResult result = new SqliteDungeonUnitOfWork(database).commit(
                    DungeonPatch.of(map, 1L, List.of(new FeatureMarkerChange(before, after))));

            assertEquals(2L, ((DungeonUnitOfWorkResult.Committed) result).committedRevision());
            assertEquals(1L, scalar(databasePath, "SELECT value FROM marker_update_count"));
            assertEquals("Untouched", text(databasePath,
                    "SELECT label FROM dungeon_feature_markers WHERE feature_marker_id=72"));
        }
    }

    private static DungeonMapRecord map(long id, String name, long revision) {
        return new DungeonMapRecord(id, name, revision, DungeonGridBoundsRecord.defaultGrid());
    }

    private static DungeonMapRecord mapWithMarkers() {
        return new DungeonMapRecord(
                51L,
                "first",
                1L,
                DungeonGridBoundsRecord.defaultGrid(),
                List.of(),
                List.of(),
                List.of(
                        new DungeonTopologyElementRecord(51L, "FEATURE_MARKER", 71L, null, null,
                                "Marker", 0),
                        new DungeonTopologyElementRecord(51L, "FEATURE_MARKER", 72L, null, null,
                                "Untouched", 1)),
                List.of(),
                List.of(),
                List.of(),
                List.of(
                        new DungeonFeatureMarkerRecord(71L, 51L, "POI", 4, 5, 0, "Marker", ""),
                        new DungeonFeatureMarkerRecord(72L, 51L, "POI", 6, 5, 0, "Untouched", "")));
    }

    private static FeatureMarker marker(DungeonMapIdentity map, long id, String label) {
        return new FeatureMarker(id, map, FeatureMarkerKind.POI, new Cell(4, 5, 0), label, "");
    }

    private static long scalar(Path databasePath, String sql) throws Exception {
        try (var connection = DriverManager.getConnection("jdbc:sqlite:" + databasePath);
             var statement = connection.createStatement();
             var resultSet = statement.executeQuery(sql)) {
            return resultSet.getLong(1);
        }
    }

    private static String text(Path databasePath, String sql) throws Exception {
        try (var connection = DriverManager.getConnection("jdbc:sqlite:" + databasePath);
             var statement = connection.createStatement();
             var resultSet = statement.executeQuery(sql)) {
            return resultSet.getString(1);
        }
    }
}
