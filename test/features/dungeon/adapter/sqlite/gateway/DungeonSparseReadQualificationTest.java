package features.dungeon.adapter.sqlite.gateway;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import features.dungeon.api.DungeonCellRef;
import features.dungeon.api.DungeonChunkKey;
import features.dungeon.application.authored.port.DungeonWindow;
import features.dungeon.application.authored.port.DungeonWindowContentRequest;
import features.dungeon.application.authored.port.DungeonWindowEntityFragment;
import features.dungeon.application.authored.port.DungeonWindowIndex;
import features.dungeon.application.authored.port.DungeonWindowRequest;
import features.dungeon.domain.core.structure.DungeonMapIdentity;
import features.dungeon.qualification.DungeonQualificationDataset;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
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
                seedSparseRoom(path, dataset);

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

    private static void seedSparseRoom(Path path, DungeonQualificationDataset dataset) throws Exception {
        List<DungeonCellRef> cells = dataset.authoredCells().toList();
        Map<DungeonChunkKey, Extent> extents = new LinkedHashMap<>();
        for (DungeonCellRef cell : cells) {
            DungeonChunkKey chunk = new DungeonChunkKey(
                    DungeonQualificationDataset.MAP_ID, cell.level(),
                    Math.floorDiv(cell.q(), DungeonChunkKey.CHUNK_SIZE),
                    Math.floorDiv(cell.r(), DungeonChunkKey.CHUNK_SIZE));
            extents.compute(chunk, (ignored, extent) -> extent == null
                    ? Extent.at(cell.q(), cell.r()) : extent.include(cell.q(), cell.r()));
        }
        int minimumQ = cells.stream().mapToInt(DungeonCellRef::q).min().orElseThrow();
        int minimumR = cells.stream().mapToInt(DungeonCellRef::r).min().orElseThrow();
        int maximumQ = cells.stream().mapToInt(DungeonCellRef::q).max().orElseThrow();
        int maximumR = cells.stream().mapToInt(DungeonCellRef::r).max().orElseThrow();

        try (Connection connection = DriverManager.getConnection("jdbc:sqlite:" + path.toAbsolutePath());
             Statement statement = connection.createStatement()) {
            connection.setAutoCommit(false);
            statement.executeUpdate("INSERT INTO dungeon_maps(dungeon_map_id,name,revision) VALUES(1,'Sparse',2)");
            statement.executeUpdate("INSERT INTO dungeon_room_clusters(cluster_id,dungeon_map_id,name)"
                    + " VALUES(11,1,'Sparse cluster')");
            statement.executeUpdate("INSERT INTO dungeon_rooms(room_id,dungeon_map_id,cluster_id,name,visual_description)"
                    + " VALUES(12,1,11,'Sparse room','')");
            try (PreparedStatement insert = connection.prepareStatement(
                    "INSERT INTO dungeon_room_cells(room_id,level_z,cell_x,cell_y) VALUES(12,?,?,?)")) {
                int pending = 0;
                for (DungeonCellRef cell : cells) {
                    insert.setInt(1, cell.level()); insert.setInt(2, cell.q()); insert.setInt(3, cell.r());
                    insert.addBatch();
                    if (++pending == 5_000) {
                        insert.executeBatch(); pending = 0;
                    }
                }
                if (pending > 0) insert.executeBatch();
            }
            try (PreparedStatement chunk = connection.prepareStatement(
                        "INSERT INTO dungeon_chunks(dungeon_map_id,level_z,chunk_q,chunk_r,content_revision)"
                                + " VALUES(1,?,?,?,2)");
                 PreparedStatement extent = connection.prepareStatement(
                        "INSERT INTO dungeon_entity_chunks(dungeon_map_id,entity_kind,entity_id,level_z,chunk_q,chunk_r,"
                                + "minimum_q,minimum_r,maximum_q,maximum_r,entity_chunk_count)"
                                + " VALUES(1,'ROOM',12,?,?,?,?,?,?,?,?)")) {
                int pending = 0;
                for (Map.Entry<DungeonChunkKey, Extent> entry : extents.entrySet()) {
                    DungeonChunkKey key = entry.getKey(); Extent value = entry.getValue();
                    chunk.setInt(1, key.level()); chunk.setInt(2, key.chunkQ()); chunk.setInt(3, key.chunkR());
                    chunk.addBatch();
                    extent.setInt(1, key.level()); extent.setInt(2, key.chunkQ()); extent.setInt(3, key.chunkR());
                    extent.setInt(4, value.minimumQ()); extent.setInt(5, value.minimumR());
                    extent.setInt(6, value.maximumQ()); extent.setInt(7, value.maximumR());
                    extent.setInt(8, extents.size()); extent.addBatch();
                    if (++pending == 5_000) {
                        chunk.executeBatch(); extent.executeBatch(); pending = 0;
                    }
                }
                if (pending > 0) { chunk.executeBatch(); extent.executeBatch(); }
            }
            try (PreparedStatement bounds = connection.prepareStatement(
                    "INSERT INTO dungeon_authored_level_bounds"
                            + "(dungeon_map_id,level_z,minimum_q,minimum_r,maximum_q,maximum_r) VALUES(1,0,?,?,?,?)")) {
                bounds.setInt(1, minimumQ); bounds.setInt(2, minimumR);
                bounds.setInt(3, maximumQ); bounds.setInt(4, maximumR); bounds.executeUpdate();
            }
            connection.commit();
        }
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

    private record Extent(int minimumQ, int minimumR, int maximumQ, int maximumR) {
        static Extent at(int q, int r) { return new Extent(q, r, q, r); }
        Extent include(int q, int r) {
            return new Extent(Math.min(minimumQ, q), Math.min(minimumR, r),
                    Math.max(maximumQ, q), Math.max(maximumR, r));
        }
    }
}
