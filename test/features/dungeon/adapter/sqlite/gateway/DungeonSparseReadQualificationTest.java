package features.dungeon.adapter.sqlite.gateway;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import features.dungeon.application.authored.port.DungeonWindow;
import features.dungeon.application.authored.port.DungeonWindowContentRequest;
import features.dungeon.application.authored.port.DungeonWindowEntityFragment;
import features.dungeon.application.authored.port.DungeonWindowIndex;
import features.dungeon.application.authored.port.DungeonWindowRequest;
import features.dungeon.domain.core.structure.DungeonMapIdentity;
import features.dungeon.qualification.DungeonQualificationDataset;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import platform.diagnostics.NoopDiagnostics;
import platform.persistence.SqliteDatabase;

final class DungeonSparseReadQualificationTest {

    @Test
    void sparse1k10k100kReadsKeepBoundsPagingAndContentWorkBounded(@TempDir Path tempDir) throws Exception {
        List<ReadWork> work = new ArrayList<>();
        for (DungeonQualificationDataset dataset : DungeonQualificationDataset.values()) {
            Path path = tempDir.resolve(dataset.name().toLowerCase() + ".db");
            try (SqliteDatabase database = new SqliteDatabase(path, NoopDiagnostics.INSTANCE)) {
                DungeonSqliteWindowGateway gateway = new DungeonSqliteWindowGateway(database);
                gateway.loadIndex(new DungeonWindowRequest(
                        new DungeonMapIdentity(DungeonQualificationDataset.MAP_ID), 0L, List.of()));
                DungeonSparseQualificationFixture.seed(database, path, dataset);

                var viewport = dataset.qualificationViewport(dataset.ordinal() + 1L);
                DungeonWindowRequest request = new DungeonWindowRequest(
                        new DungeonMapIdentity(DungeonQualificationDataset.MAP_ID),
                        viewport.requestGeneration(), List.copyOf(viewport.loadingChunks()));
                DungeonWindowIndex index = gateway.loadIndex(request).orElseThrow();
                int indexStatements = gateway.lastStatementCount();
                int boundsStatements = (int) gateway.lastStatementSql().stream()
                        .filter(sql -> sql.contains("dungeon_authored_level_bounds"))
                        .count();
                int continuationRows = gateway.lastContinuationRowsRead();
                int publishedContinuationRows = index.continuationPage().entries().stream()
                        .mapToInt(entry -> entry.offWindowChunks().size()).sum();

                DungeonWindow content = gateway.loadContent(new DungeonWindowContentRequest(
                        request.mapId(), index.mapHeader().revision(), request.requestGeneration(),
                        index.chunkHeaders())).orElseThrow();
                int contentStatements = gateway.lastStatementCount();
                int contentCells = content.fragments().stream()
                        .filter(DungeonWindowEntityFragment.Room.class::isInstance)
                        .map(DungeonWindowEntityFragment.Room.class::cast)
                        .mapToInt(room -> room.floorCells().size()).sum();

                assertEquals(1, boundsStatements);
                assertEquals(257, continuationRows);
                assertEquals(256, publishedContinuationRows);
                assertTrue(index.continuationPage().nextCursor().isPresent());
                assertTrue(content.fragments().size() <= request.chunkKeys().size());
                assertTrue(content.entityExtents().size() <= request.chunkKeys().size());
                assertTrue(contentCells <= request.chunkKeys().size());
                work.add(new ReadWork(indexStatements, boundsStatements, continuationRows,
                        contentStatements, content.fragments().size(), content.entityExtents().size(), contentCells));
            }
        }
        assertEquals(1L, work.stream().distinct().count(),
                "1k, 10k and 100k authored cells must perform identical requested-window work");
    }

    private record ReadWork(
            int indexStatements,
            int boundsStatements,
            int continuationRows,
            int contentStatements,
            int fragments,
            int extents,
            int cells
    ) { }

}
