package features.dungeon.adapter.sqlite.gateway;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import features.dungeon.adapter.sqlite.repository.SqliteDungeonMapRepository;
import features.dungeon.application.authored.command.DungeonCompoundPatch;
import features.dungeon.application.authored.command.DungeonPatch;
import features.dungeon.application.authored.command.FeatureMarkerChange;
import features.dungeon.application.authored.port.DungeonMapHeader;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.structure.DungeonMapIdentity;
import features.dungeon.domain.core.structure.feature.FeatureMarker;
import features.dungeon.domain.core.structure.feature.FeatureMarkerKind;
import java.nio.file.Path;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import platform.diagnostics.NoopDiagnostics;
import platform.persistence.SqliteDatabase;

final class DungeonSqliteCompoundPatchGatewayRollbackTest {

    @Test
    void failureAfterIntermediateMapCasRollsBackBothMapsAndAllRows(@TempDir Path directory) throws Exception {
        assertRollback(directory.resolve("compound-cas-rollback.sqlite"),
                DungeonSqlitePatchGateway.Phase.MAP_REVISION_CAS, 2);
    }

    @Test
    void failuresAtEveryCompoundTransactionBoundaryRollBackBothMapsAndAllRows(@TempDir Path directory)
            throws Exception {
        for (DungeonSqlitePatchGateway.Phase phase : List.of(
                DungeonSqlitePatchGateway.Phase.PREFLIGHT,
                DungeonSqlitePatchGateway.Phase.AUTHORED_ROWS,
                DungeonSqlitePatchGateway.Phase.SPATIAL_ROWS,
                DungeonSqlitePatchGateway.Phase.BEFORE_COMMIT)) {
            assertRollback(directory.resolve("compound-" + phase.name() + "-rollback.sqlite"), phase, 1);
        }
    }

    private static void assertRollback(
            Path path,
            DungeonSqlitePatchGateway.Phase failurePhase,
            int failureOccurrence
    ) throws Exception {
        try (SqliteDatabase database = new SqliteDatabase(path, NoopDiagnostics.INSTANCE)) {
            SqliteDungeonMapRepository catalog = new SqliteDungeonMapRepository(database);
            DungeonMapHeader first = catalog.create("First rollback map");
            DungeonMapHeader second = catalog.create("Second rollback map");
            AtomicInteger phaseCount = new AtomicInteger();
            DungeonSqlitePatchGateway gateway = new DungeonSqlitePatchGateway(database, phase -> {
                if (phase == failurePhase && phaseCount.incrementAndGet() == failureOccurrence) {
                    throw new SQLException("injected at " + failurePhase);
                }
            });

            assertThrows(IllegalStateException.class, () -> gateway.commit(DungeonCompoundPatch.of(List.of(
                    markerPatch(second.mapId(), 2201L),
                    markerPatch(first.mapId(), 1101L)))));

            assertEquals(failureOccurrence, phaseCount.get());
            assertEquals(1L, scalar(path, "SELECT MIN(revision) FROM dungeon_maps"));
            assertEquals(1L, scalar(path, "SELECT MAX(revision) FROM dungeon_maps"));
            assertEquals(0L, scalar(path, "SELECT COUNT(*) FROM dungeon_feature_markers"));
            assertEquals(0L, scalar(path, "SELECT COUNT(*) FROM dungeon_topology_elements"));
            assertEquals(0L, scalar(path, "SELECT COUNT(*) FROM dungeon_entity_chunks"));
            assertEquals(0L, scalar(path, "SELECT COUNT(*) FROM dungeon_chunks"));
        }
    }

    private static DungeonPatch markerPatch(DungeonMapIdentity mapId, long markerId) {
        FeatureMarker marker = new FeatureMarker(
                markerId,
                mapId,
                FeatureMarkerKind.POI,
                new Cell(2, 3, 0),
                "Rollback marker " + markerId,
                "must disappear");
        return DungeonPatch.of(mapId, 1L, List.of(new FeatureMarkerChange(null, marker)));
    }

    private static long scalar(Path path, String sql) throws Exception {
        try (var connection = DriverManager.getConnection("jdbc:sqlite:" + path);
             var statement = connection.createStatement();
             var rows = statement.executeQuery(sql)) {
            return rows.getLong(1);
        }
    }
}
