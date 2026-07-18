package features.dungeon.adapter.sqlite.gateway;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;

import features.dungeon.adapter.sqlite.model.DungeonClusterBoundaryRecord;
import features.dungeon.adapter.sqlite.model.DungeonCorridorDoorBindingRecord;
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
import features.dungeon.adapter.sqlite.mapper.DungeonMapRecordMapper;
import features.dungeon.adapter.sqlite.repository.SqliteDungeonWindowStore;
import features.dungeon.application.authored.command.DungeonPatchEntityRef;
import features.dungeon.application.authored.port.DungeonWindow;
import features.dungeon.application.authored.port.DungeonWindowEntityFragment;
import features.dungeon.application.authored.port.DungeonWindowRequest;
import features.dungeon.api.DungeonChunkKey;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.structure.DungeonMapIdentity;
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
        DungeonMapRecord authored = DungeonMapRecordMapper.toRecord(
                DungeonMapRecordMapper.toDomain(authoredMap()));

        try (SqliteDatabase database = new SqliteDatabase(databasePath, NoopDiagnostics.INSTANCE)) {
            DungeonSqliteGateway gateway = new DungeonSqliteGateway(database);
            gateway.saveMap(authored);

            DungeonMapRecord loaded = gateway.findMap(authored.mapId()).orElseThrow();
            assertEquals(authored.rooms().getFirst().floorCells(), loaded.rooms().getFirst().floorCells());
            assertEquals(authored.roomClusters().getFirst().boundaries(),
                    loaded.roomClusters().getFirst().boundaries());
            assertEquals(5, loaded.corridors().getFirst().doorBindings().getFirst().relativeCellZ());
            assertEquals(authored.revision(), loaded.revision());

            DungeonWindow window = new SqliteDungeonWindowStore(database).loadWindow(new DungeonWindowRequest(
                    new DungeonMapIdentity(authored.mapId()),
                    1L,
                    List.of(new DungeonChunkKey(authored.mapId(), 5, -1, -2))))
                    .orElseThrow();
            DungeonWindowEntityFragment.Corridor corridor = assertInstanceOf(
                    DungeonWindowEntityFragment.Corridor.class,
                    window.fragments().stream()
                            .filter(fragment -> fragment.entityRef().equals(DungeonPatchEntityRef.corridor(301L)))
                            .findFirst()
                            .orElseThrow());
            DungeonWindowEntityFragment.CorridorDoorFact door = corridor.doorBindings().getFirst();
            assertEquals(new Cell(1, 0, 5), door.relativeCell());
            assertEquals(new Cell(-64, -65, 5), door.absoluteCell());

            DungeonWindow interiorWindow = new SqliteDungeonWindowStore(database).loadWindow(
                    new DungeonWindowRequest(
                            new DungeonMapIdentity(authored.mapId()),
                            2L,
                            List.of(
                                    new DungeonChunkKey(authored.mapId(), 0, 0, -1),
                                    new DungeonChunkKey(authored.mapId(), 0, -3, 4))))
                    .orElseThrow();
            DungeonWindowEntityFragment.Corridor interior = assertInstanceOf(
                    DungeonWindowEntityFragment.Corridor.class,
                    interiorWindow.fragments().getFirst());
            assertEquals(DungeonPatchEntityRef.corridor(301L), interior.entityRef());
            assertEquals(List.of(), interior.waypoints());
            assertEquals(List.of(), interior.doorBindings());
            assertEquals(64, interior.routeCells().size());
            assertEquals(new Cell(0, -63, 0), interior.routeCells().getFirst().cell());
            assertEquals(new Cell(63, -63, 0), interior.routeCells().getLast().cell());
        }

        try (Connection connection = open(databasePath)) {
            assertEquals(List.of(
                    "-1|-1|-1|7",
                    "0|-2|-2|7",
                    "0|-1|-1|7",
                    "0|0|-1|7",
                    "0|1|-1|7",
                    "0|2|-1|7",
                    "0|-1|0|7",
                    "0|1|0|7",
                    "0|2|0|7",
                    "1|-1|1|7",
                    "2|2|-3|7",
                    "5|-1|-2|7",
                    "5|-1|-1|7"), rows(connection,
                    "SELECT level_z, chunk_q, chunk_r, content_revision"
                            + " FROM dungeon_chunks ORDER BY level_z, chunk_r, chunk_q"));
            assertEquals(List.of(
                    "CORRIDOR|301|0|-1|-1",
                    "CORRIDOR|301|0|0|-1",
                    "CORRIDOR|301|0|1|-1",
                    "CORRIDOR|301|0|2|-1",
                    "CORRIDOR|301|0|2|0",
                    "CORRIDOR|301|5|-1|-2",
                    "CORRIDOR|301|5|-1|-1",
                    "FEATURE_MARKER|601|0|-1|0",
                    "ROOM|101|0|-2|-2",
                    "ROOM|101|0|1|0",
                    "ROOM|101|5|-1|-2",
                    "ROOM_CLUSTER|201|0|-2|-2",
                    "ROOM_CLUSTER|201|0|1|0",
                    "ROOM_CLUSTER|201|5|-1|-2",
                    "STAIR|401|1|-1|1",
                    "STAIR|401|2|2|-3",
                    "TRANSITION|501|-1|-1|-1"), rows(connection,
                    "SELECT entity_kind, entity_id, level_z, chunk_q, chunk_r"
                            + " FROM dungeon_entity_chunks"
                            + " ORDER BY entity_kind, entity_id, level_z, chunk_r, chunk_q"));
            assertEquals(List.of("13"), rows(connection,
                    "SELECT COUNT(*) FROM dungeon_chunks"));
            assertEquals(List.of("17"), rows(connection,
                    "SELECT COUNT(*) FROM dungeon_entity_chunks"));
            assertEquals(List.of("261|261"), rows(connection,
                    "SELECT COUNT(*), COUNT(DISTINCT level_z || '|' || cell_x || '|' || cell_y)"
                            + " FROM dungeon_corridor_route_cells"
                            + " WHERE dungeon_map_id=41 AND corridor_id=301"));
            assertEquals(List.of("0"), rows(connection,
                    "SELECT COUNT(*) FROM dungeon_corridor_route_cells route"
                            + " LEFT JOIN dungeon_entity_chunks membership"
                            + " ON membership.dungeon_map_id=route.dungeon_map_id"
                            + " AND membership.entity_kind='CORRIDOR'"
                            + " AND membership.entity_id=route.corridor_id"
                            + " AND membership.level_z=route.level_z"
                            + " AND membership.chunk_q=route.chunk_q"
                            + " AND membership.chunk_r=route.chunk_r"
                            + " WHERE membership.entity_id IS NULL"));
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
                        new DungeonRoomCellRecord(roomId, 0, 64, 0),
                        new DungeonRoomCellRecord(roomId, 5, -64, -65)),
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
                List.of(roomId),
                List.of(
                        new DungeonCorridorWaypointRecord(301L, clusterId, 1, 1, 0),
                        new DungeonCorridorWaypointRecord(301L, clusterId, 2, 2, 0),
                        new DungeonCorridorWaypointRecord(301L, clusterId, 194, 65, 0)),
                List.of(new DungeonCorridorDoorBindingRecord(
                        301L, roomId, clusterId, 1, 0, 5, "EAST", 7002L)),
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
                601L, mapId, "OBJECT", -64, 63, 0, "Sparse marker", "");
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
