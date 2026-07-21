package features.dungeon.adapter.sqlite.gateway;

import features.dungeon.api.DungeonCellRef;
import features.dungeon.api.DungeonChunkKey;
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
import platform.persistence.FeatureStoreHandle;
import platform.persistence.SqliteDatabase;

/** Shared fresh-schema sparse setup for read-scaling and runtime qualification routes. */
public final class DungeonSparseQualificationFixture {

    private DungeonSparseQualificationFixture() {
    }

    public static FeatureStoreHandle seed(
            SqliteDatabase database, Path path, DungeonQualificationDataset dataset)
            throws Exception {
        return seed(database, path, dataset, true);
    }

    public static FeatureStoreHandle seedRuntime(
            SqliteDatabase database, Path path, DungeonQualificationDataset dataset)
            throws Exception {
        return seed(database, path, dataset, false);
    }

    private static FeatureStoreHandle seed(
            SqliteDatabase database,
            Path path,
            DungeonQualificationDataset dataset,
            boolean spanVisibleChunk
    ) throws Exception {
        DungeonSqliteFixtureSeeder.Fixture fixture = DungeonSqliteFixtureSeeder.prepare(database);
        fixture.insertHeader(DungeonQualificationDataset.MAP_ID, "Sparse", 2L);
        List<DungeonCellRef> cells = dataset.authoredCells().toList();
        List<DungeonCellRef> visibleCells = List.of(
                new DungeonCellRef(2, 2, DungeonQualificationDataset.LEVEL));
        List<DungeonCellRef> offWindowCells = spanVisibleChunk
                ? List.copyOf(cells.subList(0, cells.size() - 1))
                : List.copyOf(cells.subList(1, cells.size()));
        List<DungeonCellRef> persistedCells = new ArrayList<>(offWindowCells);
        persistedCells.addAll(visibleCells);
        Map<DungeonChunkKey, Extent> visibleExtents = extents(visibleCells);
        Map<DungeonChunkKey, Extent> offWindowExtents = extents(offWindowCells);
        int minimumQ = persistedCells.stream().mapToInt(DungeonCellRef::q).min().orElseThrow();
        int minimumR = persistedCells.stream().mapToInt(DungeonCellRef::r).min().orElseThrow();
        int maximumQ = persistedCells.stream().mapToInt(DungeonCellRef::q).max().orElseThrow();
        int maximumR = persistedCells.stream().mapToInt(DungeonCellRef::r).max().orElseThrow();

        try (Connection connection = DriverManager.getConnection("jdbc:sqlite:" + path.toAbsolutePath());
             Statement statement = connection.createStatement()) {
            connection.setAutoCommit(false);
            statement.executeUpdate("INSERT INTO dungeon_room_clusters(cluster_id,dungeon_map_id,name)"
                    + " VALUES(11,1,'Visible cluster'),(21,1,'Off-window cluster')");
            statement.executeUpdate("INSERT INTO dungeon_rooms(room_id,dungeon_map_id,cluster_id,name,visual_description)"
                    + " VALUES(12,1,11,'Visible room',''),(22,1,21,'Off-window room','')");
            insertCells(connection, 12L, visibleCells);
            insertCells(connection, 22L, offWindowCells);
            insertChunkExtents(connection, 12L, visibleExtents);
            insertChunkExtents(connection, 22L, offWindowExtents);
            try (PreparedStatement bounds = connection.prepareStatement(
                    "INSERT INTO dungeon_authored_level_bounds"
                            + "(dungeon_map_id,level_z,minimum_q,minimum_r,maximum_q,maximum_r)"
                            + " VALUES(1,0,?,?,?,?)")) {
                bounds.setInt(1, minimumQ);
                bounds.setInt(2, minimumR);
                bounds.setInt(3, maximumQ);
                bounds.setInt(4, maximumR);
                bounds.executeUpdate();
            }
            connection.commit();
        }
        return fixture.store();
    }

    private static Map<DungeonChunkKey, Extent> extents(List<DungeonCellRef> cells) {
        Map<DungeonChunkKey, Extent> result = new LinkedHashMap<>();
        for (DungeonCellRef cell : cells) {
            DungeonChunkKey chunk = new DungeonChunkKey(
                    DungeonQualificationDataset.MAP_ID, cell.level(),
                    Math.floorDiv(cell.q(), DungeonChunkKey.CHUNK_SIZE),
                    Math.floorDiv(cell.r(), DungeonChunkKey.CHUNK_SIZE));
            result.compute(chunk, (ignored, extent) -> extent == null
                    ? Extent.at(cell.q(), cell.r()) : extent.include(cell.q(), cell.r()));
        }
        return result;
    }

    private static void insertCells(
            Connection connection,
            long roomId,
            List<DungeonCellRef> cells
    ) throws Exception {
        try (PreparedStatement insert = connection.prepareStatement(
                "INSERT INTO dungeon_room_cells(room_id,level_z,cell_x,cell_y) VALUES(?,?,?,?)")) {
            int pending = 0;
            for (DungeonCellRef cell : cells) {
                insert.setLong(1, roomId);
                insert.setInt(2, cell.level());
                insert.setInt(3, cell.q());
                insert.setInt(4, cell.r());
                insert.addBatch();
                if (++pending == 5_000) {
                    insert.executeBatch();
                    pending = 0;
                }
            }
            if (pending > 0) {
                insert.executeBatch();
            }
        }
    }

    private static void insertChunkExtents(
            Connection connection,
            long roomId,
            Map<DungeonChunkKey, Extent> extents
    ) throws Exception {
        try (PreparedStatement chunk = connection.prepareStatement(
                    "INSERT OR IGNORE INTO dungeon_chunks(dungeon_map_id,level_z,chunk_q,chunk_r,content_revision)"
                            + " VALUES(1,?,?,?,2)");
             PreparedStatement extent = connection.prepareStatement(
                    "INSERT INTO dungeon_entity_chunks(dungeon_map_id,entity_kind,entity_id,level_z,chunk_q,chunk_r,"
                            + "minimum_q,minimum_r,maximum_q,maximum_r,entity_chunk_count)"
                            + " VALUES(1,'ROOM',?,?,?,?,?,?,?,?,?)")) {
            int pending = 0;
            for (Map.Entry<DungeonChunkKey, Extent> entry : extents.entrySet()) {
                DungeonChunkKey key = entry.getKey();
                Extent value = entry.getValue();
                chunk.setInt(1, key.level());
                chunk.setInt(2, key.chunkQ());
                chunk.setInt(3, key.chunkR());
                chunk.addBatch();
                extent.setLong(1, roomId);
                extent.setInt(2, key.level());
                extent.setInt(3, key.chunkQ());
                extent.setInt(4, key.chunkR());
                extent.setInt(5, value.minimumQ());
                extent.setInt(6, value.minimumR());
                extent.setInt(7, value.maximumQ());
                extent.setInt(8, value.maximumR());
                extent.setInt(9, extents.size());
                extent.addBatch();
                if (++pending == 5_000) {
                    chunk.executeBatch();
                    extent.executeBatch();
                    pending = 0;
                }
            }
            if (pending > 0) {
                chunk.executeBatch();
                extent.executeBatch();
            }
        }
    }

    private record Extent(int minimumQ, int minimumR, int maximumQ, int maximumR) {
        static Extent at(int q, int r) {
            return new Extent(q, r, q, r);
        }

        Extent include(int q, int r) {
            return new Extent(Math.min(minimumQ, q), Math.min(minimumR, r),
                    Math.max(maximumQ, q), Math.max(maximumR, r));
        }
    }
}
