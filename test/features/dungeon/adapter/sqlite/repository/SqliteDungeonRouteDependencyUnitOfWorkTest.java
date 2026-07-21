package features.dungeon.adapter.sqlite.repository;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertThrows;

import features.dungeon.adapter.sqlite.gateway.DungeonSqliteFixtureSeeder;
import features.dungeon.api.DungeonChunkKey;
import features.dungeon.application.authored.command.CorridorChange;
import features.dungeon.application.authored.command.DungeonPatch;
import features.dungeon.application.authored.command.DungeonPatchEntityRef;
import features.dungeon.application.authored.command.RoomClusterChange;
import features.dungeon.application.authored.command.RoomRegionChange;
import features.dungeon.application.authored.port.DungeonUnitOfWorkResult;
import features.dungeon.domain.core.component.CorridorWaypoint;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.structure.DungeonMapIdentity;
import features.dungeon.domain.core.structure.corridor.Corridor;
import features.dungeon.domain.core.structure.corridor.CorridorBindings;
import features.dungeon.domain.core.structure.room.DungeonRoomNarration;
import features.dungeon.domain.core.structure.room.RoomCluster;
import features.dungeon.domain.core.structure.room.RoomRegion;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import platform.diagnostics.NoopDiagnostics;
import platform.persistence.SqliteDatabase;
import java.nio.file.Path;
import java.sql.DriverManager;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

final class SqliteDungeonRouteDependencyUnitOfWorkTest {

    private static final long MAP_ID = 97L;
    private static final long BLOCKER_ROOM_ID = 11L;
    private static final long BLOCKER_CLUSTER_ID = 20L;
    private static final long CORRIDOR_ID = 31L;
    private static final DungeonMapIdentity MAP = new DungeonMapIdentity(MAP_ID);
    private static final DungeonChunkKey CHUNK = new DungeonChunkKey(MAP_ID, 0, 0, 0);

    @Test
    void removedUnrelatedBlockerFindsCandidateCorridorAndReconcilesTheAlternateRoute(@TempDir Path directory)
            throws Exception {
        Path path = directory.resolve("route-dependency.sqlite");
        try (SqliteDatabase database = new SqliteDatabase(path, NoopDiagnostics.INSTANCE)) {
            var fixture = seedAuthoredMap(database);
            SqliteDungeonUnitOfWork unitOfWork = new SqliteDungeonUnitOfWork(fixture.store());
            assertEquals(verticalRoute(), routeCells(path));
            assertEquals(candidateCells(), dependencyCells(path));
            List<String> unrelatedBefore = unrelatedRows(path);

            DungeonUnitOfWorkResult.Committed committed = assertInstanceOf(
                    DungeonUnitOfWorkResult.Committed.class,
                    unitOfWork.commit(completePatch(2L, blockerAtOneZero(), emptyBlocker())));

            assertEquals(3L, committed.committedRevision());
            assertEquals(horizontalRoute(), routeCells(path));
            assertEquals(candidateCells(), dependencyCells(path));
            assertEquals(unrelatedBefore, unrelatedRows(path));

            List<String> beforeRejected = allDungeonRows(path);
            assertThrows(IllegalStateException.class, () -> unitOfWork.commit(
                    missingCorridorDeclarationPatch()));
            assertEquals(beforeRejected, allDungeonRows(path),
                    "missing derived impact must roll back authored, route, dependency, chunk, and"
                        + " revision rows");
        }
    }

    private static DungeonPatch completePatch(long revision, RoomRegion before, RoomRegion after) {
        return DungeonPatch.of(MAP, revision, List.of(new RoomRegionChange(before, after)))
                .withImpact(Set.of(CHUNK), List.of(
                        DungeonPatchEntityRef.roomCluster(BLOCKER_CLUSTER_ID),
                        DungeonPatchEntityRef.corridor(CORRIDOR_ID)));
    }

    private static DungeonPatch missingCorridorDeclarationPatch() {
        return DungeonPatch.of(MAP, 3L, List.of(new RoomRegionChange(emptyBlocker(), blockerAtOneZero())))
                .withImpact(Set.of(CHUNK), List.of(DungeonPatchEntityRef.roomCluster(BLOCKER_CLUSTER_ID)));
    }

    private static DungeonSqliteFixtureSeeder.Fixture seedAuthoredMap(SqliteDatabase database) {
        var fixture = DungeonSqliteFixtureSeeder.prepare(database);
        RoomCluster blockerCluster = RoomCluster.authored(
                BLOCKER_CLUSTER_ID, MAP_ID, "Blocker cluster", List.of());
        RoomRegion blocker = blockerAtOneZero();
        long anchorClusterId = 21L;
        long anchorRoomId = 12L;
        RoomCluster anchorCluster = RoomCluster.authored(
                anchorClusterId, MAP_ID, "Stable cluster", List.of());
        RoomRegion anchorRoom = new RoomRegion(
                anchorRoomId, MAP_ID, anchorClusterId, "Stable room",
                Set.of(new Cell(-10, -10, 0)), DungeonRoomNarration.empty());
        Corridor corridor = new Corridor(CORRIDOR_ID, MAP_ID, 0, List.of(), new CorridorBindings(
                List.of(
                        new CorridorWaypoint(anchorClusterId, new Cell(0, 0, 0)),
                        new CorridorWaypoint(anchorClusterId, new Cell(2, 2, 0))),
                List.of(), List.of(), List.of()));
        fixture.insertHeader(MAP_ID, "Route dependency", 1L);
        fixture.commit(DungeonPatch.of(MAP, 1L, List.of(
                new RoomClusterChange(null, blockerCluster, Set.of(CHUNK)),
                new RoomRegionChange(null, blocker),
                new RoomClusterChange(null, anchorCluster, Set.of(CHUNK)),
                new RoomRegionChange(null, anchorRoom),
                new CorridorChange(null, corridor, Set.of(CHUNK)))));
        return fixture;
    }

    private static RoomRegion blockerAtOneZero() {
        return new RoomRegion(BLOCKER_ROOM_ID, MAP_ID, BLOCKER_CLUSTER_ID, "Blocker",
                Set.of(new Cell(1, 0, 0)), DungeonRoomNarration.empty());
    }

    private static RoomRegion emptyBlocker() {
        return new RoomRegion(BLOCKER_ROOM_ID, MAP_ID, BLOCKER_CLUSTER_ID, "Blocker",
                Set.of(), DungeonRoomNarration.empty());
    }

    private static List<String> verticalRoute() {
        return List.of("0:0", "0:1", "0:2", "1:2", "2:2");
    }

    private static List<String> horizontalRoute() {
        return List.of("0:0", "1:0", "2:0", "2:1", "2:2");
    }

    private static List<String> candidateCells() {
        return List.of("0:0", "1:0", "2:0", "0:1", "2:1", "0:2", "1:2", "2:2");
    }

    private static List<String> routeCells(Path path) throws Exception {
        return rows(path, "SELECT cell_x||':'||cell_y FROM dungeon_corridor_route_cells "
                + "WHERE corridor_id=31 ORDER BY segment_order,cell_order");
    }

    private static List<String> dependencyCells(Path path) throws Exception {
        return rows(path, "SELECT cell_x||':'||cell_y FROM dungeon_corridor_route_dependencies "
                + "WHERE corridor_id=31 ORDER BY level_z,cell_y,cell_x");
    }

    private static List<String> unrelatedRows(Path path) throws Exception {
        return rows(path,
                "SELECT 'cluster',cluster_id,name FROM dungeon_room_clusters WHERE cluster_id=21"
                    + " UNION ALL SELECT 'room',room_id,name FROM dungeon_rooms WHERE room_id=12"
                    + " UNION ALL SELECT 'cell',room_id,level_z||':'||cell_x||':'||cell_y FROM"
                    + " dungeon_room_cells WHERE room_id=12 UNION ALL SELECT"
                    + " 'topology',element_id,label FROM dungeon_topology_elements WHERE"
                    + " element_id=12 ORDER BY 1,2,3");
    }

    private static List<String> allDungeonRows(Path path) throws Exception {
        List<String> result = new ArrayList<>();
        for (String table : rows(path, "SELECT name FROM sqlite_master WHERE type='table' "
                + "AND name LIKE 'dungeon_%' ORDER BY name")) {
            result.add(table);
            result.addAll(rows(path, "SELECT * FROM " + table + " ORDER BY rowid"));
        }
        return List.copyOf(result);
    }

    private static List<String> rows(Path path, String sql) throws Exception {
        List<String> result = new ArrayList<>();
        try (var connection = DriverManager.getConnection("jdbc:sqlite:" + path);
             var statement = connection.createStatement();
             var rows = statement.executeQuery(sql)) {
            int columns = rows.getMetaData().getColumnCount();
            while (rows.next()) {
                List<String> values = new ArrayList<>();
                for (int column = 1; column <= columns; column++) {
                    values.add(String.valueOf(rows.getObject(column)));
                }
                result.add(String.join("|", values));
            }
        }
        return List.copyOf(result);
    }
}
