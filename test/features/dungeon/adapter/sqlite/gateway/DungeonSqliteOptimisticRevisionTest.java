package features.dungeon.adapter.sqlite.gateway;

import static org.junit.jupiter.api.Assertions.assertEquals;

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
    void patchCommitDoesNotRewriteUnchangedStableIdentityRows() throws Exception {
        Path databasePath = temporaryDirectory.resolve("incremental.sqlite");
        try (SqliteDatabase database = new SqliteDatabase(databasePath, NoopDiagnostics.INSTANCE)) {
            DungeonSqliteFixtureSeeder.insertHeader(database, 51L, "first", 1L);
            DungeonSqliteFixtureSeeder.commit(database, DungeonPatch.of(
                    new DungeonMapIdentity(51L),
                    1L,
                    List.of(
                            new FeatureMarkerChange(null, marker(new DungeonMapIdentity(51L), 71L, "Marker")),
                            new FeatureMarkerChange(null, new FeatureMarker(
                                    72L,
                                    new DungeonMapIdentity(51L),
                                    FeatureMarkerKind.POI,
                                    new Cell(6, 5, 0),
                                    "Untouched",
                                    "")))));
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
                    DungeonPatch.of(map, 2L, List.of(new FeatureMarkerChange(before, after))));

            assertEquals(3L, ((DungeonUnitOfWorkResult.Committed) result).committedRevision());
            assertEquals(1L, scalar(databasePath, "SELECT value FROM marker_update_count"));
            assertEquals("Untouched", text(databasePath,
                    "SELECT label FROM dungeon_feature_markers WHERE feature_marker_id=72"));
        }
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
