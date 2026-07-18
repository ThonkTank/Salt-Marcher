package features.dungeon.adapter.sqlite.gateway;

import static org.junit.jupiter.api.Assertions.assertEquals;

import features.dungeon.adapter.sqlite.model.DungeonClusterBoundaryRecord;
import features.dungeon.adapter.sqlite.model.DungeonCorridorRecord;
import features.dungeon.adapter.sqlite.model.DungeonCorridorWaypointRecord;
import features.dungeon.adapter.sqlite.model.DungeonFeatureMarkerRecord;
import features.dungeon.adapter.sqlite.model.DungeonGridBoundsRecord;
import features.dungeon.adapter.sqlite.model.DungeonMapRecord;
import features.dungeon.adapter.sqlite.model.DungeonRoomCellRecord;
import features.dungeon.adapter.sqlite.model.DungeonRoomClusterRecord;
import features.dungeon.adapter.sqlite.model.DungeonRoomRecord;
import features.dungeon.adapter.sqlite.model.DungeonStairExitRecord;
import features.dungeon.adapter.sqlite.model.DungeonStairPathNodeRecord;
import features.dungeon.adapter.sqlite.model.DungeonStairRecord;
import features.dungeon.adapter.sqlite.model.DungeonTransitionRecord;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import platform.diagnostics.NoopDiagnostics;
import platform.persistence.SqliteDatabase;

final class DungeonCanonicalSpatialIndexTest {

    @Test
    void fullMapBridgeRoundTripsCanonicalGeometryAndIndexesEveryIntersectingChunk(@TempDir Path tempDir)
            throws Exception {
        Path databasePath = tempDir.resolve("spatial-index.db");
        DungeonMapRecord authored = authoredMap();

        try (SqliteDatabase database = new SqliteDatabase(databasePath, NoopDiagnostics.INSTANCE)) {
            DungeonSqliteGateway gateway = new DungeonSqliteGateway(database);
            gateway.saveMap(authored);

            DungeonMapRecord loaded = gateway.findMap(authored.mapId()).orElseThrow();
            assertEquals(authored.rooms().getFirst().floorCells(), loaded.rooms().getFirst().floorCells());
            assertEquals(authored.roomClusters().getFirst().boundaries(),
                    loaded.roomClusters().getFirst().boundaries());
            assertEquals(authored.revision(), loaded.revision());
        }

        try (Connection connection = open(databasePath)) {
            assertEquals(List.of(
                    "-1|-1|-1|7",
                    "0|-2|-2|7",
                    "0|-1|-1|7",
                    "0|-1|0|7",
                    "0|1|0|7",
                    "0|2|0|7",
                    "1|-1|1|7",
                    "2|2|-3|7"), rows(connection,
                    "SELECT level_z, chunk_q, chunk_r, content_revision"
                            + " FROM dungeon_chunks ORDER BY level_z, chunk_r, chunk_q"));
            assertEquals(List.of(
                    "CORRIDOR|301|0|-1|-1",
                    "CORRIDOR|301|0|2|0",
                    "FEATURE_MARKER|601|0|-1|0",
                    "ROOM|101|0|-2|-2",
                    "ROOM|101|0|-1|-1",
                    "ROOM|101|0|1|0",
                    "ROOM_CLUSTER|201|0|-2|-2",
                    "ROOM_CLUSTER|201|0|1|0",
                    "STAIR|401|1|-1|1",
                    "STAIR|401|2|2|-3",
                    "TRANSITION|501|-1|-1|-1"), rows(connection,
                    "SELECT entity_kind, entity_id, level_z, chunk_q, chunk_r"
                            + " FROM dungeon_entity_chunks"
                            + " ORDER BY entity_kind, entity_id, level_z, chunk_r, chunk_q"));
            assertEquals(List.of("8"), rows(connection,
                    "SELECT COUNT(*) FROM dungeon_chunks"));
            assertEquals(List.of("11"), rows(connection,
                    "SELECT COUNT(*) FROM dungeon_entity_chunks"));
        }
    }

    private static DungeonMapRecord authoredMap() {
        long mapId = 41L;
        long roomId = 101L;
        long clusterId = 201L;
        DungeonRoomRecord room = new DungeonRoomRecord(
                roomId,
                mapId,
                clusterId,
                "Sparse room",
                "",
                List.of(
                        new DungeonRoomCellRecord(roomId, 0, -65, -65),
                        new DungeonRoomCellRecord(roomId, 0, -64, -64),
                        new DungeonRoomCellRecord(roomId, 0, -63, -63),
                        new DungeonRoomCellRecord(roomId, 0, 64, 0)),
                List.of());
        DungeonRoomClusterRecord cluster = new DungeonRoomClusterRecord(
                clusterId,
                mapId,
                "Sparse cluster",
                -65,
                -65,
                0,
                List.of(
                        new DungeonClusterBoundaryRecord(clusterId, 0, -65, -65, "NORTH", "OPEN", null),
                        new DungeonClusterBoundaryRecord(clusterId, 0, 64, 0, "SOUTH", "OPEN", null)));
        DungeonCorridorRecord corridor = new DungeonCorridorRecord(
                301L,
                mapId,
                0,
                List.of(),
                List.of(
                        new DungeonCorridorWaypointRecord(301L, clusterId, 1, 1, 0),
                        new DungeonCorridorWaypointRecord(301L, clusterId, 2, 2, 0),
                        new DungeonCorridorWaypointRecord(301L, clusterId, 194, 65, 0)),
                List.of(),
                List.of(),
                List.of());
        DungeonStairRecord stair = new DungeonStairRecord(
                401L,
                mapId,
                "Sparse stair",
                "LADDER",
                0,
                1,
                1,
                null,
                List.of(new DungeonStairPathNodeRecord(401L, -1, 64, 1)),
                List.of(new DungeonStairExitRecord(401L, 402L, 128, -129, 2, "Exit")));
        DungeonTransitionRecord transition = new DungeonTransitionRecord(
                501L,
                mapId,
                "Sparse transition",
                -1,
                -1,
                -1,
                "CELL",
                null,
                "UNLINKED_ENTRANCE",
                null,
                null,
                null,
                null,
                null);
        DungeonFeatureMarkerRecord marker = new DungeonFeatureMarkerRecord(
                601L, mapId, "NOTE", -64, 63, 0, "Sparse marker", "");
        return new DungeonMapRecord(
                mapId,
                "Canonical spatial index",
                7L,
                DungeonGridBoundsRecord.defaultGrid(),
                List.of(cluster),
                List.of(room),
                List.of(),
                List.of(corridor),
                List.of(stair),
                List.of(transition),
                List.of(marker));
    }

    private static Connection open(Path databasePath) throws SQLException {
        return DriverManager.getConnection("jdbc:sqlite:" + databasePath.toAbsolutePath());
    }

    private static List<String> rows(Connection connection, String sql) throws SQLException {
        List<String> result = new ArrayList<>();
        try (Statement statement = connection.createStatement();
             ResultSet resultSet = statement.executeQuery(sql)) {
            int columnCount = resultSet.getMetaData().getColumnCount();
            while (resultSet.next()) {
                StringBuilder row = new StringBuilder();
                for (int column = 1; column <= columnCount; column++) {
                    if (column > 1) {
                        row.append('|');
                    }
                    row.append(resultSet.getObject(column));
                }
                result.add(row.toString());
            }
        }
        return List.copyOf(result);
    }
}
