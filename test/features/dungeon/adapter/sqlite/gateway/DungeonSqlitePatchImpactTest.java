package features.dungeon.adapter.sqlite.gateway;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import features.dungeon.adapter.sqlite.model.DungeonCorridorRecord;
import features.dungeon.adapter.sqlite.model.DungeonCorridorWaypointRecord;
import features.dungeon.adapter.sqlite.model.DungeonGridBoundsRecord;
import features.dungeon.adapter.sqlite.model.DungeonMapRecord;
import features.dungeon.adapter.sqlite.model.DungeonRoomCellRecord;
import features.dungeon.adapter.sqlite.model.DungeonRoomClusterRecord;
import features.dungeon.adapter.sqlite.model.DungeonRoomRecord;
import features.dungeon.adapter.sqlite.model.DungeonTopologyElementRecord;
import features.dungeon.application.authored.command.DungeonPatch;
import features.dungeon.application.authored.command.DungeonPatchEntityRef;
import features.dungeon.application.authored.command.RoomRegionChange;
import features.dungeon.api.DungeonChunkKey;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.structure.DungeonMapIdentity;
import features.dungeon.domain.core.structure.room.DungeonRoomNarration;
import features.dungeon.domain.core.structure.room.RoomRegion;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import platform.diagnostics.NoopDiagnostics;
import platform.persistence.SqliteDatabase;

final class DungeonSqlitePatchImpactTest {

    private static final long MAP_ID = 87L;
    private static final long ROOM_ID = 11L;
    private static final long CLUSTER_ID = 21L;
    private static final long CORRIDOR_ID = 31L;
    private static final DungeonMapIdentity MAP = new DungeonMapIdentity(MAP_ID);
    private static final DungeonChunkKey OLD_CHUNK = new DungeonChunkKey(MAP_ID, 0, 0, 0);
    private static final DungeonChunkKey NEW_CHUNK = new DungeonChunkKey(MAP_ID, 0, 1, 0);

    @Test
    void oneCellRoomEditReprojectsOwningClusterAndCorridorButKeepsOffChunkRowsStable(
            @TempDir Path directory
    ) throws Exception {
        Path path = directory.resolve("patch-impact.sqlite");
        try (SqliteDatabase database = new SqliteDatabase(path, NoopDiagnostics.INSTANCE)) {
            new DungeonSqliteGateway(database).saveMaps(List.of(authoredMap()));
            DungeonSqlitePatchGateway gateway = new DungeonSqlitePatchGateway(database);
            List<String> unrelatedBefore = unrelatedRows(path);
            installMutationAudit(path);

            gateway.commit(completeImpactPatch(1L, roomAt(1), roomAt(65)));

            assertEquals(List.of("0|65|1"), rows(path,
                    "SELECT level_z,cell_x,cell_y FROM dungeon_room_cells WHERE room_id=11"));
            assertEquals(List.of("CORRIDOR|31|0|1|0", "ROOM|11|0|1|0", "ROOM_CLUSTER|21|0|1|0"),
                    rows(path, "SELECT entity_kind,entity_id,level_z,chunk_q,chunk_r "
                            + "FROM dungeon_entity_chunks WHERE entity_id IN (11,21,31) "
                            + "ORDER BY entity_kind"));
            assertEquals(List.of("67|4|1", "68|4|1", "69|4|1", "70|4|1"), rows(path,
                    "SELECT cell_x,cell_y,chunk_q FROM dungeon_corridor_route_cells "
                            + "WHERE corridor_id=31 ORDER BY segment_order,cell_order"));
            assertEquals(List.of("0|2", "1|2"), rows(path,
                    "SELECT chunk_q,content_revision FROM dungeon_chunks "
                            + "WHERE dungeon_map_id=87 AND level_z=0 AND chunk_q IN (0,1) ORDER BY chunk_q"));
            assertEquals(unrelatedBefore, unrelatedRows(path));
            assertEquals(List.of("DELETE|1", "INSERT|1"), rows(path,
                    "SELECT operation,COUNT(*) FROM patch_mutation_audit "
                            + "WHERE table_name='room_cell' GROUP BY operation ORDER BY operation"));
            assertEquals(List.of(), rows(path,
                    "SELECT operation FROM patch_mutation_audit WHERE table_name='topology'"),
                    "unchanged topology bindings must not be rewritten");
            assertEquals(List.of("DELETE|3", "INSERT|3"), rows(path,
                    "SELECT operation,COUNT(*) FROM patch_mutation_audit "
                            + "WHERE table_name='membership' GROUP BY operation ORDER BY operation"));
            assertEquals(List.of("DELETE|4", "INSERT|4"), rows(path,
                    "SELECT operation,COUNT(*) FROM patch_mutation_audit "
                            + "WHERE table_name='route' GROUP BY operation ORDER BY operation"));
            assertEquals(List.of("INSERT|1", "UPDATE|1"), rows(path,
                    "SELECT operation,COUNT(*) FROM patch_mutation_audit "
                            + "WHERE table_name='chunk' GROUP BY operation ORDER BY operation"));
            assertEquals(List.of(), rows(path,
                    "SELECT table_name,operation,entity_id,chunk_q FROM patch_mutation_audit "
                            + "WHERE entity_id IN (12,22,32) OR chunk_q=4"),
                    "unrelated identities and the off-chunk inventory must receive no SQL mutation");

            List<String> affectedBeforeRejectedCommit = affectedRows(path);
            IllegalStateException failure = assertThrows(IllegalStateException.class,
                    () -> gateway.commit(missingCorridorDependencyPatch()));
            assertEquals(true, failure.getMessage().contains("result facts do not match"));
            assertEquals(2L, scalar(path,
                    "SELECT revision FROM dungeon_maps WHERE dungeon_map_id=87"));
            assertEquals(affectedBeforeRejectedCommit, affectedRows(path),
                    "dependency rejection must roll back authored and spatial rows");
            assertEquals(unrelatedBefore, unrelatedRows(path));
        }
    }

    private static DungeonPatch completeImpactPatch(
            long expectedRevision,
            RoomRegion before,
            RoomRegion after
    ) {
        return DungeonPatch.of(MAP, expectedRevision, List.of(new RoomRegionChange(before, after)))
                .withImpact(
                        Set.of(OLD_CHUNK, NEW_CHUNK),
                        List.of(
                                DungeonPatchEntityRef.roomCluster(CLUSTER_ID),
                                DungeonPatchEntityRef.corridor(CORRIDOR_ID)));
    }

    private static DungeonPatch missingCorridorDependencyPatch() {
        return DungeonPatch.of(MAP, 2L, List.of(new RoomRegionChange(roomAt(65), roomAt(1))))
                .withImpact(
                        Set.of(OLD_CHUNK, NEW_CHUNK),
                        List.of(DungeonPatchEntityRef.roomCluster(CLUSTER_ID)));
    }

    private static DungeonMapRecord authoredMap() {
        DungeonRoomRecord changedRoom = roomRecord(ROOM_ID, CLUSTER_ID, 1);
        DungeonRoomClusterRecord changedCluster = clusterRecord(CLUSTER_ID, 1);
        DungeonCorridorRecord changedCorridor = corridor(CORRIDOR_ID, ROOM_ID, CLUSTER_ID);

        long unrelatedRoomId = 12L;
        long unrelatedClusterId = 22L;
        DungeonRoomRecord unrelatedRoom = roomRecord(unrelatedRoomId, unrelatedClusterId, 257);
        DungeonRoomClusterRecord unrelatedCluster = clusterRecord(unrelatedClusterId, 257);
        DungeonCorridorRecord unrelatedCorridor = corridor(32L, unrelatedRoomId, unrelatedClusterId);
        return new DungeonMapRecord(
                MAP_ID,
                "Impact map",
                1L,
                DungeonGridBoundsRecord.defaultGrid(),
                List.of(changedCluster, unrelatedCluster),
                List.of(changedRoom, unrelatedRoom),
                List.of(
                        new DungeonTopologyElementRecord(MAP_ID, "ROOM", ROOM_ID, CLUSTER_ID, null,
                                "Room " + ROOM_ID, 0),
                        new DungeonTopologyElementRecord(MAP_ID, "CORRIDOR", CORRIDOR_ID, null, CORRIDOR_ID,
                                "Corridor " + CORRIDOR_ID, 1),
                        new DungeonTopologyElementRecord(MAP_ID, "ROOM", unrelatedRoomId, unrelatedClusterId, null,
                                "Room " + unrelatedRoomId, 2),
                        new DungeonTopologyElementRecord(MAP_ID, "CORRIDOR", 32L, null, 32L,
                                "Corridor 32", 3)),
                List.of(changedCorridor, unrelatedCorridor),
                List.of(),
                List.of(),
                List.of());
    }

    private static DungeonRoomRecord roomRecord(long roomId, long clusterId, int x) {
        return new DungeonRoomRecord(
                roomId,
                MAP_ID,
                clusterId,
                "Room " + roomId,
                "",
                List.of(new DungeonRoomCellRecord(roomId, 0, x, 1)),
                List.of());
    }

    private static DungeonRoomClusterRecord clusterRecord(long clusterId, int x) {
        return new DungeonRoomClusterRecord(clusterId, MAP_ID, "Cluster " + clusterId, x, 1, 0, List.of());
    }

    private static DungeonCorridorRecord corridor(long corridorId, long roomId, long clusterId) {
        return new DungeonCorridorRecord(
                corridorId,
                MAP_ID,
                0,
                List.of(roomId),
                List.of(
                        new DungeonCorridorWaypointRecord(corridorId, clusterId, 2, 3, 0),
                        new DungeonCorridorWaypointRecord(corridorId, clusterId, 5, 3, 0)),
                List.of(),
                List.of(),
                List.of());
    }

    private static RoomRegion roomAt(int x) {
        return new RoomRegion(
                ROOM_ID,
                MAP_ID,
                CLUSTER_ID,
                "Room " + ROOM_ID,
                Set.of(new Cell(x, 1, 0)),
                DungeonRoomNarration.empty());
    }

    private static List<String> unrelatedRows(Path path) throws SQLException {
        return rows(path,
                "SELECT 'cluster',cluster_id,name FROM dungeon_room_clusters WHERE cluster_id=22 "
                        + "UNION ALL SELECT 'room',room_id,name FROM dungeon_rooms WHERE room_id=12 "
                        + "UNION ALL SELECT 'cell',room_id,level_z||':'||cell_x||':'||cell_y "
                        + "FROM dungeon_room_cells WHERE room_id=12 "
                        + "UNION ALL SELECT 'membership',entity_id,level_z||':'||chunk_q||':'||chunk_r "
                        + "FROM dungeon_entity_chunks WHERE entity_id IN (12,22,32) "
                        + "UNION ALL SELECT 'route',corridor_id,level_z||':'||cell_x||':'||cell_y||':'||chunk_q||':'||chunk_r "
                        + "FROM dungeon_corridor_route_cells WHERE corridor_id=32 "
                        + "UNION ALL SELECT 'chunk',chunk_q,chunk_r||':'||content_revision "
                        + "FROM dungeon_chunks WHERE dungeon_map_id=87 AND chunk_q=4 ORDER BY 1,2,3");
    }

    private static List<String> affectedRows(Path path) throws SQLException {
        return rows(path,
                "SELECT 'map',dungeon_map_id,revision FROM dungeon_maps WHERE dungeon_map_id=87 "
                        + "UNION ALL SELECT 'cell',room_id,level_z||':'||cell_x||':'||cell_y "
                        + "FROM dungeon_room_cells WHERE room_id=11 "
                        + "UNION ALL SELECT 'membership',entity_id,level_z||':'||chunk_q||':'||chunk_r "
                        + "FROM dungeon_entity_chunks WHERE entity_id IN (11,21,31) "
                        + "UNION ALL SELECT 'route',corridor_id,level_z||':'||cell_x||':'||cell_y||':'||chunk_q||':'||chunk_r "
                        + "FROM dungeon_corridor_route_cells WHERE corridor_id=31 "
                        + "UNION ALL SELECT 'chunk',chunk_q,chunk_r||':'||content_revision "
                        + "FROM dungeon_chunks WHERE dungeon_map_id=87 AND chunk_q IN (0,1) ORDER BY 1,2,3");
    }

    private static void installMutationAudit(Path path) throws SQLException {
        execute(path, "CREATE TABLE patch_mutation_audit("
                + "table_name TEXT NOT NULL,operation TEXT NOT NULL,entity_id INTEGER,chunk_q INTEGER)");
        execute(path, "CREATE TRIGGER audit_room_cell_insert AFTER INSERT ON dungeon_room_cells "
                + "BEGIN INSERT INTO patch_mutation_audit VALUES('room_cell','INSERT',NEW.room_id,NULL); END");
        execute(path, "CREATE TRIGGER audit_room_cell_update AFTER UPDATE ON dungeon_room_cells "
                + "BEGIN INSERT INTO patch_mutation_audit VALUES('room_cell','UPDATE',NEW.room_id,NULL); END");
        execute(path, "CREATE TRIGGER audit_room_cell_delete AFTER DELETE ON dungeon_room_cells "
                + "BEGIN INSERT INTO patch_mutation_audit VALUES('room_cell','DELETE',OLD.room_id,NULL); END");
        execute(path, "CREATE TRIGGER audit_topology_insert AFTER INSERT ON dungeon_topology_elements "
                + "BEGIN INSERT INTO patch_mutation_audit VALUES('topology','INSERT',NEW.element_id,NULL); END");
        execute(path, "CREATE TRIGGER audit_topology_update AFTER UPDATE ON dungeon_topology_elements "
                + "BEGIN INSERT INTO patch_mutation_audit VALUES('topology','UPDATE',NEW.element_id,NULL); END");
        execute(path, "CREATE TRIGGER audit_topology_delete AFTER DELETE ON dungeon_topology_elements "
                + "BEGIN INSERT INTO patch_mutation_audit VALUES('topology','DELETE',OLD.element_id,NULL); END");
        execute(path, "CREATE TRIGGER audit_membership_insert AFTER INSERT ON dungeon_entity_chunks "
                + "BEGIN INSERT INTO patch_mutation_audit VALUES('membership','INSERT',NEW.entity_id,NEW.chunk_q); END");
        execute(path, "CREATE TRIGGER audit_membership_update AFTER UPDATE ON dungeon_entity_chunks "
                + "BEGIN INSERT INTO patch_mutation_audit VALUES('membership','UPDATE',NEW.entity_id,NEW.chunk_q); END");
        execute(path, "CREATE TRIGGER audit_membership_delete AFTER DELETE ON dungeon_entity_chunks "
                + "BEGIN INSERT INTO patch_mutation_audit VALUES('membership','DELETE',OLD.entity_id,OLD.chunk_q); END");
        execute(path, "CREATE TRIGGER audit_route_insert AFTER INSERT ON dungeon_corridor_route_cells "
                + "BEGIN INSERT INTO patch_mutation_audit VALUES('route','INSERT',NEW.corridor_id,NEW.chunk_q); END");
        execute(path, "CREATE TRIGGER audit_route_update AFTER UPDATE ON dungeon_corridor_route_cells "
                + "BEGIN INSERT INTO patch_mutation_audit VALUES('route','UPDATE',NEW.corridor_id,NEW.chunk_q); END");
        execute(path, "CREATE TRIGGER audit_route_delete AFTER DELETE ON dungeon_corridor_route_cells "
                + "BEGIN INSERT INTO patch_mutation_audit VALUES('route','DELETE',OLD.corridor_id,OLD.chunk_q); END");
        execute(path, "CREATE TRIGGER audit_chunk_insert AFTER INSERT ON dungeon_chunks "
                + "BEGIN INSERT INTO patch_mutation_audit VALUES('chunk','INSERT',NULL,NEW.chunk_q); END");
        execute(path, "CREATE TRIGGER audit_chunk_update AFTER UPDATE ON dungeon_chunks "
                + "BEGIN INSERT INTO patch_mutation_audit VALUES('chunk','UPDATE',NULL,NEW.chunk_q); END");
        execute(path, "CREATE TRIGGER audit_chunk_delete AFTER DELETE ON dungeon_chunks "
                + "BEGIN INSERT INTO patch_mutation_audit VALUES('chunk','DELETE',NULL,OLD.chunk_q); END");
    }

    private static void execute(Path path, String sql) throws SQLException {
        try (Connection connection = DriverManager.getConnection("jdbc:sqlite:" + path.toAbsolutePath());
             Statement statement = connection.createStatement()) {
            statement.execute(sql);
        }
    }

    private static long scalar(Path path, String sql) throws SQLException {
        try (Connection connection = DriverManager.getConnection("jdbc:sqlite:" + path.toAbsolutePath());
             Statement statement = connection.createStatement();
             ResultSet rows = statement.executeQuery(sql)) {
            return rows.getLong(1);
        }
    }

    private static List<String> rows(Path path, String sql) throws SQLException {
        try (Connection connection = DriverManager.getConnection("jdbc:sqlite:" + path.toAbsolutePath());
             Statement statement = connection.createStatement();
             ResultSet rows = statement.executeQuery(sql)) {
            List<String> result = new ArrayList<>();
            int columns = rows.getMetaData().getColumnCount();
            while (rows.next()) {
                StringBuilder value = new StringBuilder();
                for (int column = 1; column <= columns; column++) {
                    if (column > 1) {
                        value.append('|');
                    }
                    value.append(rows.getObject(column));
                }
                result.add(value.toString());
            }
            return List.copyOf(result);
        }
    }
}
