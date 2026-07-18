package features.dungeon.adapter.sqlite.gateway;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertThrows;

import features.dungeon.adapter.sqlite.model.DungeonGridBoundsRecord;
import features.dungeon.adapter.sqlite.model.DungeonMapRecord;
import features.dungeon.adapter.sqlite.model.DungeonCorridorRecord;
import features.dungeon.adapter.sqlite.model.DungeonCorridorWaypointRecord;
import features.dungeon.adapter.sqlite.model.DungeonFeatureMarkerRecord;
import features.dungeon.adapter.sqlite.model.DungeonRoomCellRecord;
import features.dungeon.adapter.sqlite.model.DungeonRoomClusterRecord;
import features.dungeon.adapter.sqlite.model.DungeonRoomRecord;
import features.dungeon.adapter.sqlite.model.DungeonStairExitRecord;
import features.dungeon.adapter.sqlite.model.DungeonStairPathNodeRecord;
import features.dungeon.adapter.sqlite.model.DungeonStairRecord;
import features.dungeon.adapter.sqlite.model.DungeonTopologyElementRecord;
import features.dungeon.adapter.sqlite.model.DungeonTransitionRecord;
import features.dungeon.application.authored.command.CorridorChange;
import features.dungeon.application.authored.command.DungeonPatch;
import features.dungeon.application.authored.command.DungeonPatchChange;
import features.dungeon.application.authored.command.FeatureMarkerChange;
import features.dungeon.application.authored.command.RoomClusterChange;
import features.dungeon.application.authored.command.RoomRegionChange;
import features.dungeon.application.authored.command.StairChange;
import features.dungeon.application.authored.command.TransitionChange;
import features.dungeon.application.authored.port.DungeonUnitOfWorkResult;
import features.dungeon.api.DungeonChunkKey;
import features.dungeon.domain.core.component.CorridorWaypoint;
import features.dungeon.domain.core.component.StairExit;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.Direction;
import features.dungeon.domain.core.structure.corridor.Corridor;
import features.dungeon.domain.core.structure.corridor.CorridorBindings;
import features.dungeon.domain.core.structure.DungeonMapIdentity;
import features.dungeon.domain.core.structure.feature.FeatureMarker;
import features.dungeon.domain.core.structure.feature.FeatureMarkerKind;
import features.dungeon.domain.core.structure.room.DungeonRoomNarration;
import features.dungeon.domain.core.structure.room.RoomCluster;
import features.dungeon.domain.core.structure.room.RoomRegion;
import features.dungeon.domain.core.structure.stair.Stair;
import features.dungeon.domain.core.structure.stair.StairShape;
import features.dungeon.domain.core.structure.transition.Transition;
import features.dungeon.domain.core.structure.transition.TransitionAnchor;
import features.dungeon.domain.core.structure.transition.TransitionDestination;
import java.nio.file.Path;
import java.sql.DriverManager;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import platform.diagnostics.NoopDiagnostics;
import platform.persistence.SqliteDatabase;

final class DungeonSqlitePatchEntityValidationTest {

    private static final long MAP_ID = 81L;
    private static final long OTHER_MAP_ID = 82L;
    private static final DungeonMapIdentity MAP = new DungeonMapIdentity(MAP_ID);

    @Test
    void rejectsCrossMapMarkerIdentityCollisionBeforeCasAndPreservesEveryDungeonRow(@TempDir Path directory)
            throws Exception {
        Path path = directory.resolve("cross-map-collision.sqlite");
        try (SqliteDatabase database = database(path)) {
            seedMaps(database);
            execute(path, "INSERT INTO dungeon_feature_markers(feature_marker_id,dungeon_map_id,marker_kind,"
                    + "cell_x,cell_y,level_z,label,description) VALUES(700,82,'POI',1,2,0,'foreign','stored')");
            List<String> before = dungeonRows(path);

            FeatureMarker marker = marker("local", "candidate");
            assertThrows(IllegalStateException.class, () -> new DungeonSqlitePatchGateway(database).commit(
                    DungeonPatch.of(MAP, 1L, List.of(new FeatureMarkerChange(null, marker)))));

            assertEquals(before, dungeonRows(path));
        }
    }

    @Test
    void rollsBackExactRowSnapshotOnRealUniqueConstraintFailure(@TempDir Path directory) throws Exception {
        Path path = directory.resolve("unique-constraint.sqlite");
        try (SqliteDatabase database = database(path)) {
            seedMaps(database);
            execute(path, "INSERT INTO dungeon_stairs(stair_id,dungeon_map_id,name,shape,direction,dimension1,"
                    + "dimension2,corridor_id) VALUES(900,82,'foreign','STRAIGHT',1,2,1,NULL)");
            execute(path, "INSERT INTO dungeon_stair_exits(stair_exit_id,stair_id,cell_x,cell_y,cell_z,label) "
                    + "VALUES(777,900,10,10,0,'occupied id')");
            List<String> before = dungeonRows(path);
            Stair stair = new Stair(100L, MAP_ID, "candidate", StairShape.STRAIGHT, Direction.EAST, 2, 1,
                    List.of(new Cell(2, 2, 0), new Cell(3, 2, 0)),
                    List.of(new StairExit(777L, new Cell(2, 2, 0), "collision")), null);

            assertThrows(IllegalStateException.class, () -> new DungeonSqlitePatchGateway(database).commit(
                    DungeonPatch.of(MAP, 1L, List.of(new StairChange(null, stair)))));

            assertEquals(before, dungeonRows(path));
        }
    }

    @Test
    void rejectsPatchWhoseBeforeGraphDoesNotMatchStoredRowsBeforeCas(@TempDir Path directory) throws Exception {
        Path path = directory.resolve("before-graph-mismatch.sqlite");
        try (SqliteDatabase database = database(path)) {
            seedMaps(database);
            DungeonSqlitePatchGateway gateway = new DungeonSqlitePatchGateway(database);
            FeatureMarker stored = marker("stored", "truth");
            gateway.commit(DungeonPatch.of(MAP, 1L, List.of(new FeatureMarkerChange(null, stored))));
            List<String> before = dungeonRows(path);
            FeatureMarker falseBefore = marker("invented", "truth");
            FeatureMarker after = marker("after", "candidate");

            assertThrows(IllegalStateException.class, () -> gateway.commit(
                    DungeonPatch.of(MAP, 2L, List.of(new FeatureMarkerChange(falseBefore, after)))));

            assertEquals(before, dungeonRows(path));
        }
    }

    @Test
    void rejectsAnInexactBeforeGraphForEachOfTheSixPatchFamilies(@TempDir Path directory) throws Exception {
        Facts stored = facts("stored", false);
        Facts invented = facts("invented", true);
        Facts candidate = facts("candidate", false);
        DungeonChunkKey levelZero = new DungeonChunkKey(MAP_ID, 0, 0, 0);
        List<BeforeGraphScenario> scenarios = List.of(
                new BeforeGraphScenario("room", new RoomRegionChange(invented.room(), candidate.room())),
                new BeforeGraphScenario("room-cluster", new RoomClusterChange(
                        invented.cluster(), candidate.cluster(), Set.of(levelZero))),
                new BeforeGraphScenario("corridor", new CorridorChange(
                        invented.corridor(), candidate.corridor(), Set.of(levelZero))),
                new BeforeGraphScenario("stair", new StairChange(invented.stair(), candidate.stair())),
                new BeforeGraphScenario("transition", new TransitionChange(
                        invented.transition(), candidate.transition())),
                new BeforeGraphScenario("feature-marker", new FeatureMarkerChange(
                        invented.marker(), candidate.marker())));

        for (BeforeGraphScenario scenario : scenarios) {
            Path path = directory.resolve(scenario.name() + ".sqlite");
            try (SqliteDatabase database = database(path)) {
                DungeonSqliteFixtureSeeder.seed(database, canonicalMap(stored));
                List<String> before = dungeonRows(path);

                assertThrows(IllegalStateException.class, () -> new DungeonSqlitePatchGateway(database).commit(
                        DungeonPatch.of(MAP, 1L, List.of(scenario.change()))), scenario.name());

                assertEquals(before, dungeonRows(path), scenario.name());
            }
        }
    }

    @Test
    void staleRevisionPreservesTheCompleteCanonicalDungeonSnapshot(@TempDir Path directory) throws Exception {
        Path path = directory.resolve("stale-complete-snapshot.sqlite");
        Facts stored = facts("stored", false);
        try (SqliteDatabase database = database(path)) {
            DungeonSqliteFixtureSeeder.seed(database, canonicalMap(stored));
            List<String> before = dungeonRows(path);

            DungeonSqlitePatchGateway.CommitOutcome.Rejected rejected = assertInstanceOf(
                    DungeonSqlitePatchGateway.CommitOutcome.Rejected.class,
                    new DungeonSqlitePatchGateway(database).commit(DungeonPatch.of(
                            MAP,
                            2L,
                            List.of(new FeatureMarkerChange(stored.marker(), facts("candidate", false).marker())))));

            assertEquals(DungeonUnitOfWorkResult.Reason.STALE_REVISION, rejected.reason());
            assertEquals(before, dungeonRows(path));
        }
    }

    @Test
    void injectedLateFailureRestoresTheCompleteCanonicalDungeonSnapshot(@TempDir Path directory) throws Exception {
        Path path = directory.resolve("late-failure-complete-snapshot.sqlite");
        Facts stored = facts("stored", false);
        try (SqliteDatabase database = database(path)) {
            DungeonSqliteFixtureSeeder.seed(database, canonicalMap(stored));
            List<String> before = dungeonRows(path);
            DungeonSqlitePatchGateway gateway = new DungeonSqlitePatchGateway(database, phase -> {
                if (phase == DungeonSqlitePatchGateway.Phase.BEFORE_COMMIT) {
                    throw new java.sql.SQLException("injected late failure");
                }
            });

            assertThrows(IllegalStateException.class, () -> gateway.commit(DungeonPatch.of(
                    MAP,
                    1L,
                    List.of(new FeatureMarkerChange(stored.marker(), facts("candidate", false).marker())))));

            assertEquals(before, dungeonRows(path));
        }
    }

    @Test
    void unchangedTopologyBindingIsNotDeletedInsertedOrUpdated(@TempDir Path directory) throws Exception {
        Path path = directory.resolve("unchanged-topology.sqlite");
        try (SqliteDatabase database = database(path)) {
            seedMaps(database);
            DungeonSqlitePatchGateway gateway = new DungeonSqlitePatchGateway(database);
            FeatureMarker before = marker("stable label", "before");
            gateway.commit(DungeonPatch.of(MAP, 1L, List.of(new FeatureMarkerChange(null, before))));
            List<String> topologyBefore = query(path,
                    "SELECT dungeon_map_id,element_kind,element_id,cluster_id,corridor_id,label,sort_order "
                            + "FROM dungeon_topology_elements ORDER BY sort_order");
            execute(path, "CREATE TABLE topology_audit(operation TEXT NOT NULL)");
            execute(path, "CREATE TRIGGER topology_insert_audit AFTER INSERT ON dungeon_topology_elements "
                    + "BEGIN INSERT INTO topology_audit VALUES('INSERT'); END");
            execute(path, "CREATE TRIGGER topology_update_audit AFTER UPDATE ON dungeon_topology_elements "
                    + "BEGIN INSERT INTO topology_audit VALUES('UPDATE'); END");
            execute(path, "CREATE TRIGGER topology_delete_audit AFTER DELETE ON dungeon_topology_elements "
                    + "BEGIN INSERT INTO topology_audit VALUES('DELETE'); END");

            FeatureMarker after = marker("stable label", "after");
            gateway.commit(DungeonPatch.of(MAP, 2L, List.of(new FeatureMarkerChange(before, after))));

            assertEquals(topologyBefore, query(path,
                    "SELECT dungeon_map_id,element_kind,element_id,cluster_id,corridor_id,label,sort_order "
                            + "FROM dungeon_topology_elements ORDER BY sort_order"));
            assertEquals(List.of(), query(path, "SELECT operation FROM topology_audit"));
        }
    }

    private static FeatureMarker marker(String label, String description) {
        return new FeatureMarker(700L, MAP, FeatureMarkerKind.POI, new Cell(3, 4, 0), label, description);
    }

    private static DungeonMapRecord canonicalMap(Facts facts) {
        return new DungeonMapRecord(
                MAP_ID,
                "canonical",
                1L,
                DungeonGridBoundsRecord.defaultGrid(),
                List.of(new DungeonRoomClusterRecord(10L, MAP_ID, facts.cluster().name(), 1, 1, 0, List.of())),
                List.of(new DungeonRoomRecord(
                        20L,
                        MAP_ID,
                        10L,
                        facts.room().name(),
                        facts.room().narration().visualDescription(),
                        List.of(new DungeonRoomCellRecord(20L, 0, 1, 1)),
                        List.of())),
                List.of(
                        topology("ROOM", 20L, 10L, null, facts.room().name(), 0),
                        topology("CORRIDOR", 30L, null, 30L, "Corridor 30", 1),
                        topology("STAIR", 40L, null, null, facts.stair().name(), 2),
                        topology("TRANSITION", 50L, null, null, facts.transition().description(), 3),
                        topology("FEATURE_MARKER", 60L, null, null, facts.marker().label(), 4)),
                List.of(new DungeonCorridorRecord(
                        30L,
                        MAP_ID,
                        0,
                        List.of(20L),
                        List.of(
                                new DungeonCorridorWaypointRecord(30L, 10L, 2, 0, 0),
                                new DungeonCorridorWaypointRecord(30L, 10L, 4, 0, 0)),
                        List.of(),
                        List.of(),
                        List.of())),
                List.of(new DungeonStairRecord(
                        40L,
                        MAP_ID,
                        facts.stair().name(),
                        "STRAIGHT",
                        1,
                        2,
                        1,
                        null,
                        List.of(
                                new DungeonStairPathNodeRecord(40L, 7, 7, 0),
                                new DungeonStairPathNodeRecord(40L, 7, 7, 1)),
                        List.of(
                                new DungeonStairExitRecord(40L, 401L, 7, 7, 0, "stored lower"),
                                new DungeonStairExitRecord(40L, 402L, 7, 7, 1, "stored upper")))),
                List.of(new DungeonTransitionRecord(
                        50L, MAP_ID, facts.transition().description(), 8, 8, 0, "CELL", null,
                        "UNLINKED_ENTRANCE", null, null, null, null, null)),
                List.of(new DungeonFeatureMarkerRecord(
                        60L, MAP_ID, "POI", 9, 9, 0, facts.marker().label(), "stored")));
    }

    private static DungeonTopologyElementRecord topology(
            String kind,
            long id,
            Long clusterId,
            Long corridorId,
            String label,
            int order
    ) {
        return new DungeonTopologyElementRecord(MAP_ID, kind, id, clusterId, corridorId, label, order);
    }

    private static Facts facts(String prefix, boolean expanded) {
        Cell center = new Cell(1, 1, 0);
        RoomCluster cluster = RoomCluster.authored(10L, MAP_ID, prefix + " cluster", center, Map.of());
        Set<Cell> cells = expanded ? Set.of(center, new Cell(2, 1, 0)) : Set.of(center);
        RoomRegion room = new RoomRegion(
                20L, MAP_ID, 10L, prefix + " room", cells, new DungeonRoomNarration(prefix, List.of()));
        List<CorridorWaypoint> waypoints = expanded
                ? List.of(waypoint(2), waypoint(4), waypoint(6))
                : List.of(waypoint(2), waypoint(4));
        Corridor corridor = new Corridor(
                30L, MAP_ID, 0, List.of(20L), new CorridorBindings(waypoints, List.of(), List.of(), List.of()));
        Stair stair = new Stair(
                40L, MAP_ID, prefix + " stair", StairShape.STRAIGHT, Direction.EAST, 2, 1,
                List.of(new Cell(7, 7, 0), new Cell(7, 7, 1)),
                List.of(
                        new StairExit(401L, new Cell(7, 7, 0), prefix + " lower"),
                        new StairExit(402L, new Cell(7, 7, 1), prefix + " upper")),
                null);
        Transition transition = new Transition(
                50L, MAP_ID, prefix + " transition", TransitionAnchor.cell(new Cell(8, 8, 0)),
                TransitionDestination.unlinkedEntrance(), null);
        FeatureMarker marker = new FeatureMarker(
                60L, MAP, FeatureMarkerKind.POI, new Cell(9, 9, 0), prefix + " marker", prefix);
        return new Facts(cluster, room, corridor, stair, transition, marker);
    }

    private static CorridorWaypoint waypoint(int q) {
        return new CorridorWaypoint(10L, new Cell(q, 0, 0), 0);
    }

    private static SqliteDatabase database(Path path) {
        return new SqliteDatabase(path, NoopDiagnostics.INSTANCE);
    }

    private static void seedMaps(SqliteDatabase database) {
        DungeonSqliteFixtureSeeder.seed(database, List.of(
                new DungeonMapRecord(MAP_ID, "local", 1L, DungeonGridBoundsRecord.defaultGrid()),
                new DungeonMapRecord(OTHER_MAP_ID, "other", 1L, DungeonGridBoundsRecord.defaultGrid())));
    }

    private static void execute(Path path, String sql) throws Exception {
        try (var connection = DriverManager.getConnection("jdbc:sqlite:" + path);
             var statement = connection.createStatement()) {
            statement.execute(sql);
        }
    }

    private static List<String> dungeonRows(Path path) throws Exception {
        List<String> result = new ArrayList<>();
        for (String table : query(path, "SELECT name FROM sqlite_master WHERE type='table' "
                + "AND name LIKE 'dungeon_%' ORDER BY name")) {
            result.add(table);
            result.addAll(query(path, "SELECT * FROM " + table + " ORDER BY rowid"));
        }
        return List.copyOf(result);
    }

    private static List<String> query(Path path, String sql) throws Exception {
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

    private record BeforeGraphScenario(String name, DungeonPatchChange change) { }

    private record Facts(
            RoomCluster cluster,
            RoomRegion room,
            Corridor corridor,
            Stair stair,
            Transition transition,
            FeatureMarker marker
    ) { }
}
