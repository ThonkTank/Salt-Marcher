package features.dungeon.adapter.sqlite.gateway;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import features.dungeon.application.authored.command.DungeonPatch;
import features.dungeon.application.authored.command.FeatureMarkerChange;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.structure.DungeonMapIdentity;
import features.dungeon.domain.core.structure.feature.FeatureMarker;
import features.dungeon.domain.core.structure.feature.FeatureMarkerKind;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import platform.diagnostics.NoopDiagnostics;
import platform.persistence.SqliteDatabase;
import platform.persistence.TestFeatureStores;

import java.nio.file.Path;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.List;

final class DungeonSqlitePatchGatewayRollbackTest {

    private static final long MAP_ID = 73L;
    private static final DungeonMapIdentity MAP = new DungeonMapIdentity(MAP_ID);

    @Test
    void rollsBackRevisionAuthoredSpatialAndTopologyRowsWhenCommitFails(@TempDir Path directory) throws Exception {
        Path path = directory.resolve("rollback.sqlite");
        try (SqliteDatabase database = new SqliteDatabase(path, NoopDiagnostics.INSTANCE)) {
            var fixture = DungeonSqliteFixtureSeeder.prepare(database);
            fixture.insertHeader(MAP_ID, "Rollback map", 1L);
            DungeonSqlitePatchGateway gateway = new DungeonSqlitePatchGateway(
                            fixture.store(), phase -> {
                if (phase == DungeonSqlitePatchGateway.Phase.BEFORE_COMMIT) {
                    throw new SQLException("injected before commit");
                }
            });

            assertThrows(IllegalStateException.class, () -> gateway.commit(markerPatch()));
        }

        assertEquals(1L, scalar(path, "SELECT revision FROM dungeon_maps WHERE dungeon_map_id=73"));
        assertEquals(0L, scalar(path, "SELECT COUNT(*) FROM dungeon_feature_markers"));
        assertEquals(0L, scalar(path, "SELECT COUNT(*) FROM dungeon_topology_elements"));
        assertEquals(0L, scalar(path, "SELECT COUNT(*) FROM dungeon_entity_chunks"));
        assertEquals(0L, scalar(path, "SELECT COUNT(*) FROM dungeon_chunks"));
    }

    private static DungeonPatch markerPatch() {
        FeatureMarker marker = new FeatureMarker(
                701L,
                MAP,
                FeatureMarkerKind.POI,
                new Cell(2, 3, 0),
                "Rollback marker",
                "must disappear");
        return DungeonPatch.of(MAP, 1L, List.of(new FeatureMarkerChange(null, marker)));
    }

    private static long scalar(Path path, String sql) throws Exception {
        try (var connection = DriverManager.getConnection("jdbc:sqlite:" + path);
             var statement = connection.createStatement();
             var rows = statement.executeQuery(sql)) {
            return rows.getLong(1);
        }
    }
}
