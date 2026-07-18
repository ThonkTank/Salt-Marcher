package features.dungeon.adapter.sqlite.repository;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;

import features.dungeon.adapter.sqlite.gateway.DungeonSqliteFixtureSeeder;
import features.dungeon.adapter.sqlite.model.DungeonGridBoundsRecord;
import features.dungeon.adapter.sqlite.model.DungeonMapRecord;
import features.dungeon.application.authored.command.CorridorChange;
import features.dungeon.application.authored.command.DungeonPatch;
import features.dungeon.application.authored.command.DungeonPatchChange;
import features.dungeon.application.authored.command.FeatureMarkerChange;
import features.dungeon.application.authored.command.RoomClusterChange;
import features.dungeon.application.authored.command.RoomRegionChange;
import features.dungeon.application.authored.command.StairChange;
import features.dungeon.application.authored.command.TransitionChange;
import features.dungeon.application.authored.port.DungeonUnitOfWorkResult;
import features.dungeon.application.authored.port.DungeonEntitySnapshot;
import features.dungeon.application.authored.port.DungeonIdentityClosureRequest;
import features.dungeon.application.authored.port.DungeonIdentityClosureResult;
import features.dungeon.application.authored.port.DungeonWindow;
import features.dungeon.application.authored.port.DungeonWindowRequest;
import features.dungeon.api.DungeonChunkKey;
import features.dungeon.domain.core.component.CorridorWaypoint;
import features.dungeon.domain.core.component.StairExit;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.Direction;
import features.dungeon.domain.core.structure.DungeonMapIdentity;
import features.dungeon.domain.core.structure.corridor.Corridor;
import features.dungeon.domain.core.structure.corridor.CorridorBindings;
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
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import platform.diagnostics.NoopDiagnostics;
import platform.persistence.SqliteDatabase;

final class SqliteDungeonUnitOfWorkTest {

    private static final long MAP_ID = 41L;
    private static final DungeonMapIdentity MAP = new DungeonMapIdentity(MAP_ID);
    private static final DungeonChunkKey LEVEL_ZERO = new DungeonChunkKey(MAP_ID, 0, 0, 0);
    private static final DungeonChunkKey LEVEL_ONE = new DungeonChunkKey(MAP_ID, 1, 0, 0);

    @Test
    void insertsUpdatesAndRemovesEveryPatchFamilyWithoutFullMapReadback(@TempDir Path directory) throws Exception {
        Path path = directory.resolve("single-map-uow.sqlite");
        try (SqliteDatabase database = new SqliteDatabase(path, NoopDiagnostics.INSTANCE)) {
            DungeonSqliteFixtureSeeder.seed(database, List.of(
                    new DungeonMapRecord(MAP_ID, "Patch map", 1L, DungeonGridBoundsRecord.defaultGrid())));
            SqliteDungeonUnitOfWork unitOfWork = new SqliteDungeonUnitOfWork(database);
            SqliteDungeonWindowStore readStore = new SqliteDungeonWindowStore(database);

            Facts first = facts("first", false);
            DungeonUnitOfWorkResult.Committed inserted = committed(unitOfWork.commit(
                    DungeonPatch.of(MAP, 1L, insertChanges(first))));
            assertEquals(2L, inserted.committedRevision());
            assertEquals(Map.of(LEVEL_ZERO, 2L, LEVEL_ONE, 2L), inserted.chunkRevisions());
            assertEquals(1L, scalar(path, "SELECT COUNT(*) FROM dungeon_rooms"));
            assertEquals(2L, scalar(path, "SELECT COUNT(*) FROM dungeon_stair_path_nodes"));
            assertEquals(5L, scalar(path, "SELECT COUNT(*) FROM dungeon_topology_elements"));
            assertEquals(2L, scalar(path, "SELECT COUNT(*) FROM dungeon_chunks"));
            assertExactProductionRead(readStore, 2L, first);

            Facts second = facts("second", true);
            DungeonUnitOfWorkResult.Committed updated = committed(unitOfWork.commit(
                    DungeonPatch.of(MAP, 2L, updateChanges(first, second))));
            assertEquals(3L, updated.committedRevision());
            assertEquals("second room", text(path, "SELECT name FROM dungeon_rooms WHERE room_id=20"));
            assertEquals(2L, scalar(path, "SELECT COUNT(*) FROM dungeon_room_cells WHERE room_id=20"));
            assertEquals("second marker", text(path,
                    "SELECT label FROM dungeon_feature_markers WHERE feature_marker_id=60"));
            assertExactProductionRead(readStore, 3L, second);

            DungeonUnitOfWorkResult.Committed removed = committed(unitOfWork.commit(
                    DungeonPatch.of(MAP, 3L, deleteChanges(second))));
            assertEquals(4L, removed.committedRevision());
            assertEquals(0L, scalar(path, "SELECT COUNT(*) FROM dungeon_rooms"));
            assertEquals(0L, scalar(path, "SELECT COUNT(*) FROM dungeon_corridors"));
            assertEquals(0L, scalar(path, "SELECT COUNT(*) FROM dungeon_stairs"));
            assertEquals(0L, scalar(path, "SELECT COUNT(*) FROM dungeon_transitions"));
            assertEquals(0L, scalar(path, "SELECT COUNT(*) FROM dungeon_feature_markers"));
            assertEquals(0L, scalar(path, "SELECT COUNT(*) FROM dungeon_entity_chunks"));
            assertEquals(0L, scalar(path, "SELECT COUNT(*) FROM dungeon_corridor_route_cells"));
            assertEquals(2L, scalar(path, "SELECT COUNT(*) FROM dungeon_chunks"),
                    "formerly occupied chunks remain revision tombstones");
            assertEquals(0L, scalar(path, "SELECT COUNT(*) FROM dungeon_chunks WHERE content_revision<>4"));
            DungeonWindow emptyWindow = readStore.loadWindow(new DungeonWindowRequest(
                    MAP, 44L, List.of(LEVEL_ZERO, LEVEL_ONE))).orElseThrow();
            assertEquals(4L, emptyWindow.mapHeader().revision());
            assertEquals(List.of(), emptyWindow.fragments(), "removed entities must be absent from Window reads");
            DungeonIdentityClosureResult.Rejected missing = assertInstanceOf(
                    DungeonIdentityClosureResult.Rejected.class,
                    readStore.loadIdentityClosure(closureRequest(4L)));
            assertEquals(DungeonIdentityClosureResult.Reason.ENTITY_MISSING, missing.reason());
            assertEquals(allRefs(), missing.affectedEntities());

            DungeonUnitOfWorkResult.Rejected stale = assertInstanceOf(
                    DungeonUnitOfWorkResult.Rejected.class,
                    unitOfWork.commit(DungeonPatch.of(MAP, 3L, insertChanges(first))));
            assertEquals(DungeonUnitOfWorkResult.Reason.STALE_REVISION, stale.reason());
            assertEquals(4L, scalar(path, "SELECT revision FROM dungeon_maps WHERE dungeon_map_id=41"));
        }
    }

    private static DungeonUnitOfWorkResult.Committed committed(DungeonUnitOfWorkResult result) {
        return assertInstanceOf(DungeonUnitOfWorkResult.Committed.class, result);
    }

    private static void assertExactProductionRead(
            SqliteDungeonWindowStore readStore,
            long revision,
            Facts expected
    ) {
        DungeonIdentityClosureResult.Complete closure = assertInstanceOf(
                DungeonIdentityClosureResult.Complete.class,
                readStore.loadIdentityClosure(closureRequest(revision)));
        assertEquals(revision, closure.mapHeader().revision());
        assertEquals(List.of(
                new DungeonEntitySnapshot.Room(expected.room()),
                new DungeonEntitySnapshot.RoomClusterSnapshot(expected.cluster()),
                new DungeonEntitySnapshot.FeatureMarkerSnapshot(expected.marker()),
                new DungeonEntitySnapshot.StairSnapshot(expected.stair()),
                new DungeonEntitySnapshot.TransitionSnapshot(expected.transition()),
                new DungeonEntitySnapshot.CorridorSnapshot(expected.corridor())), closure.entities());

        DungeonWindow window = readStore.loadWindow(new DungeonWindowRequest(
                MAP, revision, List.of(LEVEL_ZERO, LEVEL_ONE))).orElseThrow();
        assertEquals(revision, window.mapHeader().revision());
        assertEquals(allRefs(), window.fragments().stream().map(fragment -> fragment.entityRef()).toList());
    }

    private static DungeonIdentityClosureRequest closureRequest(long revision) {
        return new DungeonIdentityClosureRequest(MAP, revision, allRefs());
    }

    private static List<features.dungeon.application.authored.command.DungeonPatchEntityRef> allRefs() {
        return List.of(
                features.dungeon.application.authored.command.DungeonPatchEntityRef.room(20L),
                features.dungeon.application.authored.command.DungeonPatchEntityRef.roomCluster(10L),
                features.dungeon.application.authored.command.DungeonPatchEntityRef.featureMarker(60L),
                features.dungeon.application.authored.command.DungeonPatchEntityRef.stair(40L),
                features.dungeon.application.authored.command.DungeonPatchEntityRef.transition(50L),
                features.dungeon.application.authored.command.DungeonPatchEntityRef.corridor(30L));
    }

    private static List<DungeonPatchChange> insertChanges(Facts facts) {
        return List.of(
                new RoomClusterChange(null, facts.cluster(), Set.of(LEVEL_ZERO)),
                new RoomRegionChange(null, facts.room()),
                new CorridorChange(null, facts.corridor(), Set.of(LEVEL_ZERO)),
                new StairChange(null, facts.stair()),
                new TransitionChange(null, facts.transition()),
                new FeatureMarkerChange(null, facts.marker()));
    }

    private static List<DungeonPatchChange> updateChanges(Facts before, Facts after) {
        return List.of(
                new RoomClusterChange(before.cluster(), after.cluster(), Set.of(LEVEL_ZERO)),
                new RoomRegionChange(before.room(), after.room()),
                new CorridorChange(before.corridor(), after.corridor(), Set.of(LEVEL_ZERO)),
                new StairChange(before.stair(), after.stair()),
                new TransitionChange(before.transition(), after.transition()),
                new FeatureMarkerChange(before.marker(), after.marker()));
    }

    private static List<DungeonPatchChange> deleteChanges(Facts facts) {
        return List.of(
                new StairChange(facts.stair(), null),
                new CorridorChange(facts.corridor(), null, Set.of(LEVEL_ZERO)),
                new RoomRegionChange(facts.room(), null),
                new RoomClusterChange(facts.cluster(), null, Set.of(LEVEL_ZERO)),
                new TransitionChange(facts.transition(), null),
                new FeatureMarkerChange(facts.marker(), null));
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

    private static long scalar(Path path, String sql) throws Exception {
        try (var connection = DriverManager.getConnection("jdbc:sqlite:" + path);
             var statement = connection.createStatement();
             var rows = statement.executeQuery(sql)) {
            return rows.getLong(1);
        }
    }

    private static String text(Path path, String sql) throws Exception {
        try (var connection = DriverManager.getConnection("jdbc:sqlite:" + path);
             var statement = connection.createStatement();
             var rows = statement.executeQuery(sql)) {
            return rows.getString(1);
        }
    }

    private record Facts(
            RoomCluster cluster,
            RoomRegion room,
            Corridor corridor,
            Stair stair,
            Transition transition,
            FeatureMarker marker
    ) { }
}
