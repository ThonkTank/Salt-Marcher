package features.dungeon.adapter.sqlite.repository;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;

import features.dungeon.application.authored.command.DungeonCompoundPatch;
import features.dungeon.application.authored.command.DungeonPatch;
import features.dungeon.application.authored.command.FeatureMarkerChange;
import features.dungeon.application.authored.port.DungeonCompoundUnitOfWorkResult;
import features.dungeon.application.authored.port.DungeonMapHeader;
import features.dungeon.application.authored.port.DungeonUnitOfWorkResult;
import features.dungeon.api.DungeonChunkKey;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.structure.DungeonMapIdentity;
import features.dungeon.domain.core.structure.feature.FeatureMarker;
import features.dungeon.domain.core.structure.feature.FeatureMarkerKind;
import java.nio.file.Path;
import java.sql.DriverManager;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import platform.diagnostics.NoopDiagnostics;
import platform.persistence.SqliteDatabase;

final class SqliteDungeonCompoundUnitOfWorkTest {

    @Test
    void commitsEveryMapOnceAndReturnsExactResultsInMapOrder(@TempDir Path directory) throws Exception {
        Path path = directory.resolve("compound-uow.sqlite");
        try (SqliteDatabase database = new SqliteDatabase(path, NoopDiagnostics.INSTANCE)) {
            SqliteDungeonMapRepository catalog = new SqliteDungeonMapRepository(database);
            DungeonMapHeader first = catalog.create("First compound map");
            DungeonMapHeader second = catalog.create("Second compound map");
            DungeonPatch firstPatch = markerPatch(first.mapId(), 1L, 1101L, 3);
            DungeonPatch secondPatch = markerPatch(second.mapId(), 1L, 2201L, 67);

            DungeonCompoundUnitOfWorkResult.Committed committed = assertInstanceOf(
                    DungeonCompoundUnitOfWorkResult.Committed.class,
                    new SqliteDungeonUnitOfWork(database).commit(
                            DungeonCompoundPatch.of(List.of(secondPatch, firstPatch))));

            assertEquals(List.of(first.mapId(), second.mapId()), committed.committedMaps().stream()
                    .map(DungeonUnitOfWorkResult.Committed::mapId).toList());
            assertEquals(List.of(2L, 2L), committed.committedMaps().stream()
                    .map(DungeonUnitOfWorkResult.Committed::committedRevision).toList());
            assertEquals(firstPatch.resultFacts(), committed.committedMaps().get(0).resultFacts());
            assertEquals(secondPatch.resultFacts(), committed.committedMaps().get(1).resultFacts());
            assertEquals(Map.of(chunk(first.mapId(), 3), 2L), committed.committedMaps().get(0).chunkRevisions());
            assertEquals(Map.of(chunk(second.mapId(), 67), 2L), committed.committedMaps().get(1).chunkRevisions());
            assertEquals(2L, scalar(path, "SELECT COUNT(*) FROM dungeon_feature_markers"));
            assertEquals(2L, scalar(path, "SELECT MIN(revision) FROM dungeon_maps"));
            assertEquals(2L, scalar(path, "SELECT MAX(revision) FROM dungeon_maps"));

            DungeonPatch currentFirst = markerPatch(first.mapId(), 2L, 1102L, 4);
            DungeonPatch staleSecond = markerPatch(second.mapId(), 1L, 2202L, 68);
            DungeonCompoundUnitOfWorkResult.Rejected rejected = assertInstanceOf(
                    DungeonCompoundUnitOfWorkResult.Rejected.class,
                    new SqliteDungeonUnitOfWork(database).commit(
                            DungeonCompoundPatch.of(List.of(currentFirst, staleSecond))));

            assertEquals(second.mapId(), rejected.mapId());
            assertEquals(DungeonUnitOfWorkResult.Reason.STALE_REVISION, rejected.reason());
            assertEquals(2L, scalar(path, "SELECT COUNT(*) FROM dungeon_feature_markers"));
            assertEquals(2L, scalar(path, "SELECT MIN(revision) FROM dungeon_maps"));
            assertEquals(2L, scalar(path, "SELECT MAX(revision) FROM dungeon_maps"));
        }
    }

    private static DungeonPatch markerPatch(
            DungeonMapIdentity mapId,
            long revision,
            long markerId,
            int x
    ) {
        FeatureMarker marker = new FeatureMarker(
                markerId,
                mapId,
                FeatureMarkerKind.POI,
                new Cell(x, 3, 0),
                "Compound marker " + markerId,
                "compound transaction proof");
        return DungeonPatch.of(mapId, revision, List.of(new FeatureMarkerChange(null, marker)));
    }

    private static DungeonChunkKey chunk(DungeonMapIdentity mapId, int x) {
        return new DungeonChunkKey(mapId.value(), 0, Math.floorDiv(x, DungeonChunkKey.CHUNK_SIZE), 0);
    }

    private static long scalar(Path path, String sql) throws Exception {
        try (var connection = DriverManager.getConnection("jdbc:sqlite:" + path);
             var statement = connection.createStatement();
             var rows = statement.executeQuery(sql)) {
            return rows.getLong(1);
        }
    }
}
