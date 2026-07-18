package features.dungeon.adapter.sqlite.repository;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertThrows;

import features.dungeon.adapter.sqlite.gateway.DungeonSqliteGateway;
import features.dungeon.adapter.sqlite.gateway.DungeonSqliteWindowGateway;
import features.dungeon.adapter.sqlite.model.DungeonClusterBoundaryRecord;
import features.dungeon.adapter.sqlite.model.DungeonCorridorAnchorBindingRecord;
import features.dungeon.adapter.sqlite.model.DungeonCorridorAnchorRefRecord;
import features.dungeon.adapter.sqlite.model.DungeonCorridorRecord;
import features.dungeon.adapter.sqlite.model.DungeonCorridorWaypointRecord;
import features.dungeon.adapter.sqlite.model.DungeonFeatureMarkerRecord;
import features.dungeon.adapter.sqlite.model.DungeonGridBoundsRecord;
import features.dungeon.adapter.sqlite.model.DungeonMapRecord;
import features.dungeon.adapter.sqlite.model.DungeonPersistenceSchema;
import features.dungeon.adapter.sqlite.model.DungeonRoomCellRecord;
import features.dungeon.adapter.sqlite.model.DungeonRoomClusterRecord;
import features.dungeon.adapter.sqlite.model.DungeonRoomRecord;
import features.dungeon.adapter.sqlite.model.DungeonStairExitRecord;
import features.dungeon.adapter.sqlite.model.DungeonStairPathNodeRecord;
import features.dungeon.adapter.sqlite.model.DungeonStairRecord;
import features.dungeon.adapter.sqlite.model.DungeonTransitionRecord;
import features.dungeon.application.authored.command.DungeonPatchEntityRef;
import features.dungeon.application.authored.port.DungeonIdentityClosureRequest;
import features.dungeon.application.authored.port.DungeonIdentityClosureResult;
import features.dungeon.application.authored.port.DungeonWindow;
import features.dungeon.application.authored.port.DungeonWindowEntityFragment;
import features.dungeon.application.authored.port.DungeonWindowRequest;
import features.dungeon.api.DungeonChunkKey;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.Direction;
import features.dungeon.domain.core.structure.DungeonMapIdentity;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import platform.diagnostics.NoopDiagnostics;
import platform.persistence.SqliteDatabase;

final class SqliteDungeonWindowStoreTest {

    private static final long MAP_ID = 77L;
    private static final long REVISION = 9L;

    @Test
    void loadsExactNonRectangularWindowWithSixKindsStableHeadersAndContinuations(@TempDir Path tempDir)
            throws Exception {
        Path path = tempDir.resolve("window.db");
        try (SqliteDatabase database = savedDatabase(path)) {
            insertUnindexedMalformedTransition(path);
            SqliteDungeonWindowStore store = new SqliteDungeonWindowStore(database);
            DungeonWindow window = store.loadWindow(new DungeonWindowRequest(
                    new DungeonMapIdentity(MAP_ID),
                    42L,
                    List.of(
                            key(0, 1, 0),
                            key(0, -1, -1),
                            key(1, 0, 1),
                            key(-2, -3, 4))))
                    .orElseThrow();

            assertEquals(REVISION, window.mapHeader().revision());
            assertEquals(42L, window.requestGeneration());
            assertEquals(List.of(
                    key(-2, -3, 4) + "|0",
                    key(0, -1, -1) + "|9",
                    key(0, 1, 0) + "|9",
                    key(1, 0, 1) + "|9"), window.chunkHeaders().stream()
                    .map(header -> header.key() + "|" + header.contentRevision())
                    .toList());
            assertEquals(List.of(
                    DungeonPatchEntityRef.Kind.ROOM,
                    DungeonPatchEntityRef.Kind.ROOM_CLUSTER,
                    DungeonPatchEntityRef.Kind.FEATURE_MARKER,
                    DungeonPatchEntityRef.Kind.STAIR,
                    DungeonPatchEntityRef.Kind.TRANSITION,
                    DungeonPatchEntityRef.Kind.CORRIDOR,
                    DungeonPatchEntityRef.Kind.CORRIDOR),
                    window.fragments().stream().map(fragment -> fragment.entityRef().kind()).toList());
            assertEquals(7, window.fragments().stream().map(fragment -> fragment.entityRef()).distinct().count());
            assertTypedAuthoredSemantics(window);
            assertTrue(window.fragments().stream()
                    .flatMap(fragment -> fragmentCells(fragment).stream())
                    .allMatch(cell -> requestedFact(cell, window)));
            assertEquals(List.of(
                    key(0, 0, -1),
                    key(0, 1, -1),
                    key(0, 2, -1),
                    key(0, 2, 0)), window.continuations().stream()
                    .filter(continuation -> continuation.entityRef().equals(DungeonPatchEntityRef.corridor(302L)))
                    .findFirst()
                    .orElseThrow()
                    .offWindowChunks());
            assertFalse(window.fragments().stream()
                    .flatMap(fragment -> fragmentCells(fragment).stream())
                    .anyMatch(cell -> cell.q() == 10 && cell.r() == 10),
                    "an unrequested rectangular hole must not be overfetched");
        }

        try (Connection connection = open(path)) {
            assertEquals(1, scalarInt(connection,
                    "SELECT COUNT(*) FROM dungeon_entity_chunks"
                            + " WHERE entity_kind='ROOM_CLUSTER' AND entity_id=201"
                            + " AND level_z=0 AND chunk_q=-1 AND chunk_r=-1"));
            assertEquals(1, scalarInt(connection,
                    "SELECT COUNT(*) FROM dungeon_entity_chunks"
                            + " WHERE entity_kind='CORRIDOR' AND entity_id=302"
                            + " AND level_z=0 AND chunk_q=2 AND chunk_r=0"));
        }
    }

    @Test
    void manyEntitiesDoNotIncreaseWindowOrClosureStatementCount(@TempDir Path tempDir) throws Exception {
        int singleWindowStatements;
        int singleClosureStatements;
        try (SqliteDatabase database = savedDatabase(tempDir.resolve("single-count.db"), 1)) {
            DungeonSqliteWindowGateway gateway = new DungeonSqliteWindowGateway(database);
            gateway.loadWindow(markerWindow()).orElseThrow();
            singleWindowStatements = gateway.lastStatementCount();
            gateway.loadIdentityClosure(markerClosure(1));
            singleClosureStatements = gateway.lastStatementCount();
        }

        try (SqliteDatabase database = savedDatabase(tempDir.resolve("many-count.db"), 25)) {
            DungeonSqliteWindowGateway gateway = new DungeonSqliteWindowGateway(database);
            DungeonWindow window = gateway.loadWindow(markerWindow()).orElseThrow();
            assertEquals(25L, window.fragments().stream()
                    .filter(DungeonWindowEntityFragment.FeatureMarker.class::isInstance)
                    .count());
            assertEquals(singleWindowStatements, gateway.lastStatementCount());

            DungeonIdentityClosureResult.Complete closure = assertInstanceOf(
                    DungeonIdentityClosureResult.Complete.class,
                    gateway.loadIdentityClosure(markerClosure(25)));
            assertEquals(25, closure.entities().size());
            assertEquals(singleClosureStatements, gateway.lastStatementCount());
        }
        assertEquals(11, singleWindowStatements);
        assertEquals(2, singleClosureStatements);
    }

    @Test
    void manyCorridorGraphsDoNotIncreaseWindowOrClosureStatementCount(@TempDir Path tempDir) throws Exception {
        int singleWindowStatements;
        int singleClosureStatements;
        try (SqliteDatabase database = savedGraphDatabase(tempDir.resolve("single-graph.db"), 1)) {
            DungeonSqliteWindowGateway gateway = new DungeonSqliteWindowGateway(database);
            gateway.loadWindow(corridorWindow()).orElseThrow();
            singleWindowStatements = gateway.lastStatementCount();
            gateway.loadIdentityClosure(corridorClosure(1));
            singleClosureStatements = gateway.lastStatementCount();
        }
        try (SqliteDatabase database = savedGraphDatabase(tempDir.resolve("many-graphs.db"), 20)) {
            DungeonSqliteWindowGateway gateway = new DungeonSqliteWindowGateway(database);
            DungeonWindow window = gateway.loadWindow(corridorWindow()).orElseThrow();
            assertEquals(21L, window.fragments().stream()
                    .filter(DungeonWindowEntityFragment.Corridor.class::isInstance)
                    .count());
            assertEquals(singleWindowStatements, gateway.lastStatementCount());
            DungeonIdentityClosureResult.Complete closure = assertInstanceOf(
                    DungeonIdentityClosureResult.Complete.class,
                    gateway.loadIdentityClosure(corridorClosure(20)));
            assertEquals(20, closure.entities().size());
            assertEquals(singleClosureStatements, gateway.lastStatementCount());
        }
    }

    @Test
    void corridorWindowPublishesCanonicalInteriorRouteWithoutOmittedControlPoints(@TempDir Path tempDir) {
        try (SqliteDatabase database = savedGraphDatabase(tempDir.resolve("interior-route.db"), 2)) {
            DungeonWindow window = new SqliteDungeonWindowStore(database).loadWindow(new DungeonWindowRequest(
                    new DungeonMapIdentity(MAP_ID),
                    19L,
                    List.of(key(0, 0, -1), key(0, -3, 4))))
                    .orElseThrow();

            List<DungeonWindowEntityFragment.Corridor> corridors = window.fragments().stream()
                    .filter(DungeonWindowEntityFragment.Corridor.class::isInstance)
                    .map(DungeonWindowEntityFragment.Corridor.class::cast)
                    .toList();
            assertEquals(List.of(
                    DungeonPatchEntityRef.corridor(302L),
                    DungeonPatchEntityRef.corridor(303L)),
                    corridors.stream().map(DungeonWindowEntityFragment.Corridor::entityRef).toList());
            for (DungeonWindowEntityFragment.Corridor corridor : corridors) {
                assertTrue(corridor.waypoints().isEmpty(), "the off-window waypoint must remain omitted");
                assertTrue(corridor.doorBindings().isEmpty());
                assertTrue(corridor.anchorBindings().isEmpty());
                assertTrue(corridor.anchorRefs().isEmpty(), "off-window termini must remain omitted");
                assertFalse(corridor.routeCells().isEmpty());
                assertTrue(corridor.routeCells().stream()
                        .map(DungeonWindowEntityFragment.CorridorRouteCellFact::cell)
                        .allMatch(cell -> requestedFact(cell, window)));
            }
        }
    }

    @Test
    void versionFiveMigrationBackfillsPopulatedCorridorRoutesBeforeWindowRead(@TempDir Path tempDir)
            throws Exception {
        Path path = tempDir.resolve("populated-v4-route-upgrade.db");
        try (SqliteDatabase ignored = savedGraphDatabase(path, 1)) {
            // Persist a populated canonical graph with its pre-upgrade derived chunk inventory.
        }
        try (Connection connection = open(path); Statement statement = connection.createStatement()) {
            statement.execute("DROP TABLE dungeon_corridor_route_cells");
            statement.executeUpdate("UPDATE sm_schema_versions SET version=4 WHERE owner='dungeon'");
        }

        try (SqliteDatabase database = new SqliteDatabase(path, NoopDiagnostics.INSTANCE)) {
            DungeonWindow window = new SqliteDungeonWindowStore(database).loadWindow(new DungeonWindowRequest(
                    new DungeonMapIdentity(MAP_ID),
                    23L,
                    List.of(key(0, 0, -1))))
                    .orElseThrow();
            DungeonWindowEntityFragment.Corridor corridor = fragment(
                    window,
                    DungeonPatchEntityRef.corridor(302L),
                    DungeonWindowEntityFragment.Corridor.class);

            assertFalse(corridor.routeCells().isEmpty(),
                    "v4 to v5 migration must not leave a populated corridor route index empty");
        }
        try (Connection connection = open(path)) {
            assertEquals(5, scalarInt(connection,
                    "SELECT version FROM sm_schema_versions WHERE owner='dungeon'"));
            assertTrue(scalarInt(connection,
                    "SELECT COUNT(*) FROM dungeon_corridor_route_cells WHERE dungeon_map_id=77"
                            + " AND corridor_id=302") > 0);
        }
    }

    @Test
    void selfReferencedAnchorOnlyCorridorPublishesItsCanonicalBodyCell(@TempDir Path tempDir) throws Exception {
        Path path = tempDir.resolve("anchor-only-corridor.db");
        long corridorId = 701L;
        long topologyId = 9_701L;
        DungeonCorridorRecord corridor = new DungeonCorridorRecord(
                corridorId,
                MAP_ID,
                0,
                List.of(),
                List.of(),
                List.of(),
                List.of(new DungeonCorridorAnchorBindingRecord(
                        corridorId, 1L, corridorId, 6, 5, 0, topologyId)),
                List.of(new DungeonCorridorAnchorRefRecord(corridorId, corridorId, topologyId)));
        try (SqliteDatabase database = new SqliteDatabase(path, NoopDiagnostics.INSTANCE)) {
            new DungeonSqliteGateway(database).saveMap(new DungeonMapRecord(
                    MAP_ID,
                    "Anchor-only corridor",
                    REVISION,
                    DungeonGridBoundsRecord.defaultGrid(),
                    List.of(),
                    List.of(),
                    List.of(),
                    List.of(corridor),
                    List.of(),
                    List.of(),
                    List.of()));
            DungeonWindow window = new SqliteDungeonWindowStore(database).loadWindow(new DungeonWindowRequest(
                    new DungeonMapIdentity(MAP_ID), 20L, List.of(key(0, 0, 0))))
                    .orElseThrow();
            DungeonWindowEntityFragment.Corridor fragment = fragment(
                    window, DungeonPatchEntityRef.corridor(corridorId),
                    DungeonWindowEntityFragment.Corridor.class);

            assertEquals(List.of(new Cell(6, 5, 0)), fragment.routeCells().stream()
                    .map(DungeonWindowEntityFragment.CorridorRouteCellFact::cell)
                    .toList());
            assertEquals(new Cell(6, 5, 0), fragment.anchorRefs().getFirst().resolvedCell());
        }

        try (Connection connection = open(path)) {
            assertEquals(1, scalarInt(connection,
                    "SELECT COUNT(*) FROM dungeon_corridor_route_cells"
                            + " WHERE dungeon_map_id=77 AND corridor_id=701"
                            + " AND level_z=0 AND cell_x=6 AND cell_y=5 AND chunk_q=0 AND chunk_r=0"));
        }
    }

    @Test
    void largeOffWindowRoomPopulationDoesNotBroadenCorridorWindowQueriesOrRows(@TempDir Path tempDir)
            throws Exception {
        DungeonWindowRequest request = new DungeonWindowRequest(
                new DungeonMapIdentity(MAP_ID), 21L, List.of(key(0, 0, -1)));
        int baselineStatements;
        List<String> baselineSql;
        try (SqliteDatabase database = savedGraphDatabase(tempDir.resolve("bounded-baseline.db"), 1)) {
            DungeonSqliteWindowGateway gateway = new DungeonSqliteWindowGateway(database);
            gateway.loadWindow(request).orElseThrow();
            baselineStatements = gateway.lastStatementCount();
            baselineSql = gateway.lastStatementSql();
        }

        Path path = tempDir.resolve("bounded-large-off-window.db");
        try (SqliteDatabase database = savedGraphDatabase(path, 1)) {
            insertLargeOffWindowRoomPopulation(path, 4_096);
            DungeonSqliteWindowGateway gateway = new DungeonSqliteWindowGateway(database);
            DungeonWindow window = gateway.loadWindow(request).orElseThrow();
            DungeonWindowEntityFragment.Corridor corridor = fragment(
                    window, DungeonPatchEntityRef.corridor(302L),
                    DungeonWindowEntityFragment.Corridor.class);

            assertEquals(64, corridor.routeCells().size());
            assertEquals(baselineStatements, gateway.lastStatementCount());
            assertEquals(baselineSql, gateway.lastStatementSql());
            assertTrue(gateway.lastStatementSql().stream()
                    .filter(sql -> sql.contains(DungeonPersistenceSchema.ROOM_CELLS_TABLE))
                    .allMatch(sql -> sql.contains("scoped.corridor_id IN")),
                    "corridor control centers must be limited to loaded corridor identities");
            assertTrue(gateway.lastStatementSql().stream().anyMatch(sql ->
                    sql.contains(DungeonPersistenceSchema.CORRIDOR_ROUTE_CELLS_TABLE)
                            && sql.contains("corridor_id IN")
                            && sql.contains("chunk_q=?")
                            && sql.contains("chunk_r=?")));
        }

        try (Connection connection = open(path)) {
            assertEquals(4_096, scalarInt(connection,
                    "SELECT COUNT(*) FROM dungeon_room_cells WHERE room_id=999"));
            assertEquals(64, scalarInt(connection,
                    "SELECT COUNT(*) FROM dungeon_corridor_route_cells"
                            + " WHERE dungeon_map_id=77 AND corridor_id=302"
                            + " AND level_z=0 AND chunk_q=0 AND chunk_r=-1"));
        }
    }

    @Test
    void exactClosureCompletesAllSixFamiliesInStableOrder(@TempDir Path tempDir) throws Exception {
        Path path = tempDir.resolve("closure.db");
        try (SqliteDatabase database = savedDatabase(path)) {
            SqliteDungeonWindowStore store = new SqliteDungeonWindowStore(database);
            DungeonIdentityClosureResult.Complete complete = assertInstanceOf(
                    DungeonIdentityClosureResult.Complete.class,
                    store.loadIdentityClosure(new DungeonIdentityClosureRequest(
                            new DungeonMapIdentity(MAP_ID),
                            REVISION,
                            allSixRefs())));
            assertEquals(REVISION, complete.mapHeader().revision());
            assertEquals(allSixRefs(), complete.entities().stream().map(entity -> entity.ref()).toList());
        }
    }

    @Test
    void exactClosureReturnsTypedMissingStaleMalformedAndIncompleteRejections(@TempDir Path tempDir)
            throws Exception {
        assertRejected(
                tempDir.resolve("missing-map.db"),
                new DungeonIdentityClosureRequest(new DungeonMapIdentity(999L), REVISION, allSixRefs()),
                DungeonIdentityClosureResult.Reason.MAP_MISSING,
                null);
        assertRejected(
                tempDir.resolve("stale.db"),
                new DungeonIdentityClosureRequest(new DungeonMapIdentity(MAP_ID), REVISION - 1L, allSixRefs()),
                DungeonIdentityClosureResult.Reason.STALE_REVISION,
                null);
        assertRejected(
                tempDir.resolve("missing-entity.db"),
                new DungeonIdentityClosureRequest(
                        new DungeonMapIdentity(MAP_ID), REVISION, List.of(DungeonPatchEntityRef.room(999L))),
                DungeonIdentityClosureResult.Reason.ENTITY_MISSING,
                null);
        assertRejected(
                tempDir.resolve("malformed.db"),
                new DungeonIdentityClosureRequest(
                        new DungeonMapIdentity(MAP_ID), REVISION, List.of(DungeonPatchEntityRef.featureMarker(601L))),
                DungeonIdentityClosureResult.Reason.MALFORMED_ENTITY,
                "UPDATE dungeon_feature_markers SET marker_kind='NOT_A_KIND' WHERE feature_marker_id=601");
        assertRejected(
                tempDir.resolve("marker-null-description.db"),
                new DungeonIdentityClosureRequest(
                        new DungeonMapIdentity(MAP_ID), REVISION, List.of(DungeonPatchEntityRef.featureMarker(601L))),
                DungeonIdentityClosureResult.Reason.INCOMPLETE_ENTITY,
                "UPDATE dungeon_feature_markers SET description=NULL WHERE feature_marker_id=601");
        assertRejected(
                tempDir.resolve("incomplete.db"),
                new DungeonIdentityClosureRequest(
                        new DungeonMapIdentity(MAP_ID), REVISION, List.of(DungeonPatchEntityRef.stair(401L))),
                DungeonIdentityClosureResult.Reason.INCOMPLETE_ENTITY,
                "DELETE FROM dungeon_stair_exits WHERE stair_id=401");
        assertRejected(
                tempDir.resolve("boundary-topology.db"),
                new DungeonIdentityClosureRequest(
                        new DungeonMapIdentity(MAP_ID), REVISION,
                        List.of(DungeonPatchEntityRef.roomCluster(201L))),
                DungeonIdentityClosureResult.Reason.INCOMPLETE_ENTITY,
                "UPDATE dungeon_room_cluster_edges SET topology_element_id=NULL WHERE cluster_id=201");
        assertRejected(
                tempDir.resolve("corridor-topology.db"),
                new DungeonIdentityClosureRequest(
                        new DungeonMapIdentity(MAP_ID), REVISION,
                        List.of(DungeonPatchEntityRef.corridor(302L))),
                DungeonIdentityClosureResult.Reason.INCOMPLETE_ENTITY,
                "UPDATE dungeon_corridor_anchors SET topology_element_id=NULL WHERE corridor_id=301");
        assertRejected(
                tempDir.resolve("room-name.db"),
                new DungeonIdentityClosureRequest(
                        new DungeonMapIdentity(MAP_ID), REVISION, List.of(DungeonPatchEntityRef.room(101L))),
                DungeonIdentityClosureResult.Reason.MALFORMED_ENTITY,
                "UPDATE dungeon_rooms SET name='' WHERE room_id=101");
        assertRejected(
                tempDir.resolve("cluster-name.db"),
                new DungeonIdentityClosureRequest(
                        new DungeonMapIdentity(MAP_ID), REVISION,
                        List.of(DungeonPatchEntityRef.roomCluster(201L))),
                DungeonIdentityClosureResult.Reason.MALFORMED_ENTITY,
                "UPDATE dungeon_room_clusters SET name='' WHERE cluster_id=201");
    }

    @Test
    void stairClosureRejectsStoredSemanticRepairMatrix(@TempDir Path tempDir) throws Exception {
        DungeonIdentityClosureRequest request = new DungeonIdentityClosureRequest(
                new DungeonMapIdentity(MAP_ID), REVISION, List.of(DungeonPatchEntityRef.stair(401L)));
        assertRejected(
                tempDir.resolve("stair-ladder.db"), request,
                DungeonIdentityClosureResult.Reason.MALFORMED_ENTITY,
                "UPDATE dungeon_stairs SET shape='LADDER' WHERE stair_id=401");
        assertRejected(
                tempDir.resolve("stair-rectangular.db"), request,
                DungeonIdentityClosureResult.Reason.MALFORMED_ENTITY,
                "UPDATE dungeon_stairs SET shape='RECTANGULAR' WHERE stair_id=401");
        assertRejected(
                tempDir.resolve("stair-dimensions.db"), request,
                DungeonIdentityClosureResult.Reason.MALFORMED_ENTITY,
                "UPDATE dungeon_stairs SET dimension2=13 WHERE stair_id=401");
        assertRejected(
                tempDir.resolve("stair-name.db"), request,
                DungeonIdentityClosureResult.Reason.MALFORMED_ENTITY,
                "UPDATE dungeon_stairs SET name='' WHERE stair_id=401");
        assertRejected(
                tempDir.resolve("stair-exit-label.db"), request,
                DungeonIdentityClosureResult.Reason.MALFORMED_ENTITY,
                "UPDATE dungeon_stair_exits SET label='' WHERE stair_id=401 AND stair_exit_id=410");
        assertRejected(
                tempDir.resolve("stair-path-missing.db"), request,
                DungeonIdentityClosureResult.Reason.INCOMPLETE_ENTITY,
                "DELETE FROM dungeon_stair_path_nodes WHERE stair_id=401");
    }

    @Test
    void stairWindowRejectsTheSameInvalidScalarAndGlobalGraphStatesAsClosure(@TempDir Path tempDir)
            throws Exception {
        DungeonWindowRequest request = stairWindow();
        assertWindowRejected(
                tempDir.resolve("window-stair-ladder.db"), request,
                "UPDATE dungeon_stairs SET shape='LADDER' WHERE stair_id=401");
        assertWindowRejected(
                tempDir.resolve("window-stair-rectangular.db"), request,
                "UPDATE dungeon_stairs SET shape='RECTANGULAR' WHERE stair_id=401");
        assertWindowRejected(
                tempDir.resolve("window-stair-dimensions.db"), request,
                "UPDATE dungeon_stairs SET dimension2=13 WHERE stair_id=401");
        assertWindowRejected(
                tempDir.resolve("window-stair-path-missing.db"), request,
                "DELETE FROM dungeon_stair_path_nodes WHERE stair_id=401");
        assertWindowRejected(
                tempDir.resolve("window-stair-exits-missing.db"), request,
                "DELETE FROM dungeon_stair_exits WHERE stair_id=401");
    }

    @Test
    void stairWindowValidatesGlobalRequiredFactsWhileKeepingOffWindowFactsClipped(@TempDir Path tempDir) {
        Path path = tempDir.resolve("window-stair-off-window-facts.db");
        try (SqliteDatabase database = savedDatabase(path)) {
            try (Connection connection = open(path); Statement statement = connection.createStatement()) {
                statement.executeUpdate("UPDATE dungeon_stairs SET corridor_id=302 WHERE stair_id=401");
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to bind valid same-map stair fixture.", exception);
            }
            SqliteDungeonWindowStore store = new SqliteDungeonWindowStore(database);
            DungeonWindowEntityFragment.Stair stair = fragment(
                    store.loadWindow(stairWindow()).orElseThrow(),
                    DungeonPatchEntityRef.stair(401L),
                    DungeonWindowEntityFragment.Stair.class);

            assertEquals(302L, stair.corridorId());
            assertEquals(List.of(DungeonPatchEntityRef.corridor(302L)), stair.dependencyHeaders());
            assertEquals(List.of(new Cell(0, 64, 1)), stair.path().stream()
                    .map(DungeonWindowEntityFragment.StairPathFact::cell)
                    .toList());
            assertEquals(List.of(new Cell(0, 64, 1)), stair.exits().stream()
                    .map(DungeonWindowEntityFragment.StairExitFact::cell)
                    .toList());
            assertTrue(stair.path().stream().noneMatch(node -> node.cell().level() == 2));
            assertTrue(stair.exits().stream().noneMatch(exit -> exit.cell().level() == 2));
            assertInstanceOf(
                    DungeonIdentityClosureResult.Complete.class,
                    store.loadIdentityClosure(stairClosure()));
        }
    }

    @Test
    void stairWindowAndClosureRejectDanglingAndCrossMapCorridorBindings(@TempDir Path tempDir)
            throws Exception {
        assertStairBindingRejected(
                tempDir.resolve("stair-dangling-corridor.db"),
                true,
                List.of("UPDATE dungeon_stairs SET corridor_id=9999 WHERE stair_id=401"));
        assertStairBindingRejected(
                tempDir.resolve("stair-cross-map-corridor.db"),
                false,
                List.of(
                        "INSERT INTO dungeon_maps(dungeon_map_id,name,revision) VALUES(78,'Other map',1)",
                        "INSERT INTO dungeon_corridors(corridor_id,dungeon_map_id,level_z) VALUES(9999,78,0)",
                        "UPDATE dungeon_stairs SET corridor_id=9999 WHERE stair_id=401"));
    }

    @Test
    void closureRejectsOtherStoredValuesBeforeDomainDefaults(@TempDir Path tempDir) throws Exception {
        DungeonIdentityClosureRequest roomRequest = new DungeonIdentityClosureRequest(
                new DungeonMapIdentity(MAP_ID), REVISION, List.of(DungeonPatchEntityRef.room(101L)));
        DungeonIdentityClosureRequest clusterRequest = new DungeonIdentityClosureRequest(
                new DungeonMapIdentity(MAP_ID), REVISION, List.of(DungeonPatchEntityRef.roomCluster(201L)));
        DungeonIdentityClosureRequest corridorRequest = new DungeonIdentityClosureRequest(
                new DungeonMapIdentity(MAP_ID), REVISION, List.of(DungeonPatchEntityRef.corridor(302L)));
        assertRejected(
                tempDir.resolve("room-exit-direction.db"), roomRequest,
                DungeonIdentityClosureResult.Reason.MALFORMED_ENTITY,
                "INSERT INTO dungeon_room_exit_descriptions"
                        + "(room_id, level_z, cell_x, cell_y, edge_direction, description)"
                        + " VALUES(101,0,-64,-64,'UP','invalid direction')");
        assertRejected(
                tempDir.resolve("cluster-member-name.db"), clusterRequest,
                DungeonIdentityClosureResult.Reason.MALFORMED_ENTITY,
                "UPDATE dungeon_rooms SET name='' WHERE room_id=101");
        assertRejected(
                tempDir.resolve("cluster-boundary-direction.db"), clusterRequest,
                DungeonIdentityClosureResult.Reason.MALFORMED_ENTITY,
                "UPDATE dungeon_room_cluster_edges SET edge_direction='UP' WHERE cluster_id=201");
        assertRejected(
                tempDir.resolve("corridor-door-direction.db"), corridorRequest,
                DungeonIdentityClosureResult.Reason.MALFORMED_ENTITY,
                "INSERT INTO dungeon_corridor_door_overrides"
                        + "(corridor_id, room_id, cluster_id, relative_cell_x, relative_cell_y,"
                        + " edge_direction, topology_element_id) VALUES(302,101,201,0,0,'UP',7001)");
    }

    @Test
    void malformedMapHeaderReturnsTypedClosureRejection(@TempDir Path tempDir) throws Exception {
        DungeonIdentityClosureRequest request = new DungeonIdentityClosureRequest(
                new DungeonMapIdentity(MAP_ID), REVISION, List.of(DungeonPatchEntityRef.room(101L)));
        assertRejected(
                tempDir.resolve("map-header-name.db"), request,
                DungeonIdentityClosureResult.Reason.MALFORMED_ENTITY,
                "UPDATE dungeon_maps SET name='' WHERE dungeon_map_id=77");
        assertRejected(
                tempDir.resolve("map-header-revision.db"), request,
                DungeonIdentityClosureResult.Reason.MALFORMED_ENTITY,
                "UPDATE dungeon_maps SET revision=0 WHERE dungeon_map_id=77");
    }

    @Test
    void windowRejectsMissingTopologyAndBlankAuthoredNamesWithoutRepair(@TempDir Path tempDir) throws Exception {
        assertWindowRejected(
                tempDir.resolve("window-boundary-topology.db"),
                "UPDATE dungeon_room_cluster_edges SET topology_element_id=NULL WHERE cluster_id=201");
        assertWindowRejected(
                tempDir.resolve("window-corridor-topology.db"),
                "UPDATE dungeon_corridor_anchors SET topology_element_id=NULL WHERE corridor_id=301");
        assertWindowRejected(
                tempDir.resolve("window-blank-name.db"),
                "UPDATE dungeon_rooms SET name='' WHERE room_id=101");
        assertWindowRejected(
                tempDir.resolve("window-transition-partial-anchor.db"),
                "UPDATE dungeon_transitions SET cell_y=NULL WHERE transition_id=501");
        assertWindowRejected(
                tempDir.resolve("window-transition-unknown-anchor.db"),
                "UPDATE dungeon_transitions SET anchor_type='UNKNOWN' WHERE transition_id=501");
        assertWindowRejected(
                tempDir.resolve("window-marker-null-description.db"),
                markerWindow(),
                "UPDATE dungeon_feature_markers SET description=NULL WHERE feature_marker_id=601");
    }

    @Test
    void transitionWindowAndClosureRejectNonPositiveLinkedIdsBeforeDomainNormalization(@TempDir Path tempDir)
            throws Exception {
        assertTransitionLinkedIdRejected(tempDir.resolve("transition-linked-zero.db"), 0L);
        assertTransitionLinkedIdRejected(tempDir.resolve("transition-linked-negative.db"), -1L);
    }

    @Test
    void transitionWindowAndClosureAcceptNullAndPositiveLinkedIds(@TempDir Path tempDir) throws Exception {
        assertTransitionLinkedIdAccepted(tempDir.resolve("transition-linked-null.db"), null);
        assertTransitionLinkedIdAccepted(tempDir.resolve("transition-linked-positive.db"), 502L);
    }

    private static void assertWindowRejected(Path path, String mutation) throws Exception {
        assertWindowRejected(
                path,
                new DungeonWindowRequest(
                        new DungeonMapIdentity(MAP_ID), 1L, List.of(key(0, -1, -1))),
                mutation);
    }

    private static void assertWindowRejected(
            Path path,
            DungeonWindowRequest request,
            String mutation
    ) throws Exception {
        try (SqliteDatabase database = savedDatabase(path);
             Connection connection = open(path);
             Statement statement = connection.createStatement()) {
            statement.executeUpdate(mutation);
            SqliteDungeonWindowStore store = new SqliteDungeonWindowStore(database);
            assertThrows(RuntimeException.class, () -> store.loadWindow(request));
        }
    }

    private static void assertRejected(
            Path path,
            DungeonIdentityClosureRequest request,
            DungeonIdentityClosureResult.Reason expected,
            String mutation
    ) throws Exception {
        try (SqliteDatabase database = savedDatabase(path)) {
            if (mutation != null) {
                try (Connection connection = open(path); Statement statement = connection.createStatement()) {
                    statement.executeUpdate(mutation);
                }
            }
            DungeonIdentityClosureResult result = new SqliteDungeonWindowStore(database)
                    .loadIdentityClosure(request);
            DungeonIdentityClosureResult.Rejected rejected = assertInstanceOf(
                    DungeonIdentityClosureResult.Rejected.class,
                    result);
            assertEquals(expected, rejected.reason());
            assertFalse(result instanceof DungeonIdentityClosureResult.Complete);
        }
    }

    private static void assertStairBindingRejected(
            Path path,
            boolean removeCorridorForeignKey,
            List<String> mutations
    ) throws Exception {
        try (SqliteDatabase database = savedDatabase(path);
             Connection connection = open(path);
             Statement statement = connection.createStatement()) {
            if (removeCorridorForeignKey) {
                statement.execute("PRAGMA foreign_keys=OFF");
                statement.execute("CREATE TABLE dungeon_stairs_without_corridor_fk ("
                        + "stair_id INTEGER PRIMARY KEY AUTOINCREMENT,"
                        + "dungeon_map_id INTEGER NOT NULL REFERENCES dungeon_maps(dungeon_map_id) ON DELETE CASCADE,"
                        + "name TEXT, shape TEXT NOT NULL DEFAULT 'LADDER',"
                        + "direction INTEGER NOT NULL DEFAULT 0, dimension1 INTEGER NOT NULL DEFAULT 0,"
                        + "dimension2 INTEGER NOT NULL DEFAULT 0, corridor_id INTEGER)");
                statement.executeUpdate("INSERT INTO dungeon_stairs_without_corridor_fk"
                        + " SELECT * FROM dungeon_stairs");
                statement.execute("DROP TABLE dungeon_stairs");
                statement.execute("ALTER TABLE dungeon_stairs_without_corridor_fk RENAME TO dungeon_stairs");
                statement.execute("PRAGMA foreign_keys=ON");
            }
            for (String mutation : mutations) {
                statement.executeUpdate(mutation);
            }
            SqliteDungeonWindowStore store = new SqliteDungeonWindowStore(database);
            assertThrows(RuntimeException.class, () -> store.loadWindow(stairWindow()));
            DungeonIdentityClosureResult.Rejected rejected = assertInstanceOf(
                    DungeonIdentityClosureResult.Rejected.class,
                    store.loadIdentityClosure(stairClosure()));
            assertEquals(DungeonIdentityClosureResult.Reason.INCOMPLETE_ENTITY, rejected.reason());
        }
    }

    private static void assertTransitionLinkedIdRejected(Path path, long linkedTransitionId) throws Exception {
        try (SqliteDatabase database = savedDatabase(path);
             Connection connection = open(path);
             Statement statement = connection.createStatement()) {
            statement.execute("PRAGMA foreign_keys=OFF");
            statement.execute("CREATE TABLE dungeon_transitions_without_linked_fk ("
                    + "transition_id INTEGER PRIMARY KEY AUTOINCREMENT,"
                    + "dungeon_map_id INTEGER NOT NULL REFERENCES dungeon_maps(dungeon_map_id) ON DELETE CASCADE,"
                    + "description TEXT, cell_x INTEGER, cell_y INTEGER, level_z INTEGER,"
                    + "anchor_type TEXT, anchor_edge_direction TEXT, destination_type TEXT NOT NULL,"
                    + "target_overworld_map_id INTEGER, target_overworld_tile_id INTEGER,"
                    + "target_dungeon_map_id INTEGER, target_transition_id INTEGER, linked_transition_id INTEGER)");
            statement.executeUpdate("INSERT INTO dungeon_transitions_without_linked_fk"
                    + " SELECT * FROM dungeon_transitions");
            statement.execute("DROP TABLE dungeon_transitions");
            statement.execute("ALTER TABLE dungeon_transitions_without_linked_fk RENAME TO dungeon_transitions");
            statement.execute("PRAGMA foreign_keys=ON");
            statement.executeUpdate("UPDATE dungeon_transitions SET linked_transition_id=" + linkedTransitionId
                    + " WHERE transition_id=501");

            SqliteDungeonWindowStore store = new SqliteDungeonWindowStore(database);
            assertThrows(RuntimeException.class, () -> store.loadWindow(transitionWindow()));
            DungeonIdentityClosureResult.Rejected rejected = assertInstanceOf(
                    DungeonIdentityClosureResult.Rejected.class,
                    store.loadIdentityClosure(transitionClosure()));
            assertEquals(DungeonIdentityClosureResult.Reason.MALFORMED_ENTITY, rejected.reason());
        }
    }

    private static void assertTransitionLinkedIdAccepted(Path path, Long linkedTransitionId) throws Exception {
        try (SqliteDatabase database = savedDatabase(path)) {
            if (linkedTransitionId != null) {
                try (Connection connection = open(path); Statement statement = connection.createStatement()) {
                    statement.executeUpdate("INSERT INTO dungeon_transitions("
                            + "transition_id,dungeon_map_id,description,cell_x,cell_y,level_z,"
                            + "anchor_type,destination_type)"
                            + " VALUES(502,77,'Linked transition',1,1,0,'CELL','UNLINKED_ENTRANCE')");
                    statement.executeUpdate("UPDATE dungeon_transitions SET linked_transition_id=502"
                            + " WHERE transition_id=501");
                }
            }
            SqliteDungeonWindowStore store = new SqliteDungeonWindowStore(database);
            DungeonWindowEntityFragment.Transition transition = fragment(
                    store.loadWindow(transitionWindow()).orElseThrow(),
                    DungeonPatchEntityRef.transition(501L),
                    DungeonWindowEntityFragment.Transition.class);
            assertEquals(linkedTransitionId, transition.linkedTransitionId());
            assertInstanceOf(
                    DungeonIdentityClosureResult.Complete.class,
                    store.loadIdentityClosure(transitionClosure()));
        }
    }

    private static SqliteDatabase savedDatabase(Path path) {
        return savedDatabase(path, 1);
    }

    private static SqliteDatabase savedDatabase(Path path, int markerCount) {
        SqliteDatabase database = new SqliteDatabase(path, NoopDiagnostics.INSTANCE);
        new DungeonSqliteGateway(database).saveMap(authoredMap(markerCount, 1));
        return database;
    }

    private static SqliteDatabase savedGraphDatabase(Path path, int corridorCount) {
        SqliteDatabase database = new SqliteDatabase(path, NoopDiagnostics.INSTANCE);
        new DungeonSqliteGateway(database).saveMap(authoredMap(1, corridorCount));
        return database;
    }

    private static DungeonMapRecord authoredMap() {
        return authoredMap(1);
    }

    private static DungeonMapRecord authoredMap(int markerCount) {
        return authoredMap(markerCount, 1);
    }

    private static DungeonMapRecord authoredMap(int markerCount, int corridorCount) {
        DungeonRoomRecord room = new DungeonRoomRecord(
                101L,
                MAP_ID,
                201L,
                "Window room",
                "",
                List.of(
                        new DungeonRoomCellRecord(101L, 0, -64, -64),
                        new DungeonRoomCellRecord(101L, 0, 10, 10),
                        new DungeonRoomCellRecord(101L, 0, 64, 0)),
                List.of());
        DungeonRoomClusterRecord cluster = new DungeonRoomClusterRecord(
                201L,
                MAP_ID,
                "Window cluster",
                -64,
                -64,
                0,
                List.of(new DungeonClusterBoundaryRecord(201L, 0, -64, -64, "NORTH", "WALL", 7001L)));
        DungeonCorridorRecord host = new DungeonCorridorRecord(
                301L,
                MAP_ID,
                0,
                List.of(),
                List.of(),
                List.of(),
                List.of(
                        new DungeonCorridorAnchorBindingRecord(301L, 1L, 301L, -1, -1, 0, 9001L),
                        new DungeonCorridorAnchorBindingRecord(301L, 2L, 301L, 130, 0, 0, 9002L)),
                List.of());
        List<DungeonCorridorRecord> corridors = new ArrayList<>();
        corridors.add(host);
        for (int index = 0; index < corridorCount; index++) {
            long corridorId = 302L + index;
            corridors.add(new DungeonCorridorRecord(
                    corridorId,
                    MAP_ID,
                    0,
                    List.of(),
                    List.of(new DungeonCorridorWaypointRecord(corridorId, 201L, 128, 63, 0)),
                    List.of(),
                    List.of(),
                    List.of(
                            new DungeonCorridorAnchorRefRecord(corridorId, 301L, 9001L),
                            new DungeonCorridorAnchorRefRecord(corridorId, 301L, 9002L))));
        }
        DungeonStairRecord stair = new DungeonStairRecord(
                401L,
                MAP_ID,
                "Window stair",
                "STRAIGHT",
                0,
                2,
                1,
                null,
                List.of(
                        new DungeonStairPathNodeRecord(401L, 0, 64, 1),
                        new DungeonStairPathNodeRecord(401L, 0, 64, 2)),
                List.of(
                        new DungeonStairExitRecord(401L, 410L, 0, 64, 1, "Lower"),
                        new DungeonStairExitRecord(401L, 411L, 0, 64, 2, "Upper")));
        DungeonTransitionRecord transition = new DungeonTransitionRecord(
                501L, MAP_ID, "Window transition", -1, -1, 0, "CELL", null,
                "UNLINKED_ENTRANCE", null, null, null, null, null);
        List<DungeonFeatureMarkerRecord> markers = new ArrayList<>();
        for (int index = 0; index < markerCount; index++) {
            long markerId = 601L + index;
            markers.add(new DungeonFeatureMarkerRecord(
                    markerId, MAP_ID, "OBJECT", 64 + index, 0, 0,
                    "Window marker " + markerId, "Marker description " + markerId));
        }
        return new DungeonMapRecord(
                MAP_ID,
                "Window map",
                REVISION,
                DungeonGridBoundsRecord.defaultGrid(),
                List.of(cluster),
                List.of(room),
                List.of(),
                corridors,
                List.of(stair),
                List.of(transition),
                markers);
    }

    private static List<DungeonPatchEntityRef> allSixRefs() {
        return List.of(
                DungeonPatchEntityRef.room(101L),
                DungeonPatchEntityRef.roomCluster(201L),
                DungeonPatchEntityRef.featureMarker(601L),
                DungeonPatchEntityRef.stair(401L),
                DungeonPatchEntityRef.transition(501L),
                DungeonPatchEntityRef.corridor(302L));
    }

    private static DungeonChunkKey key(int level, int q, int r) {
        return new DungeonChunkKey(MAP_ID, level, q, r);
    }

    private static DungeonWindowRequest markerWindow() {
        return new DungeonWindowRequest(new DungeonMapIdentity(MAP_ID), 7L, List.of(key(0, 1, 0)));
    }

    private static DungeonWindowRequest stairWindow() {
        return new DungeonWindowRequest(new DungeonMapIdentity(MAP_ID), 9L, List.of(key(1, 0, 1)));
    }

    private static DungeonWindowRequest transitionWindow() {
        return new DungeonWindowRequest(new DungeonMapIdentity(MAP_ID), 10L, List.of(key(0, -1, -1)));
    }

    private static DungeonIdentityClosureRequest transitionClosure() {
        return new DungeonIdentityClosureRequest(
                new DungeonMapIdentity(MAP_ID),
                REVISION,
                List.of(DungeonPatchEntityRef.transition(501L)));
    }

    private static DungeonIdentityClosureRequest stairClosure() {
        return new DungeonIdentityClosureRequest(
                new DungeonMapIdentity(MAP_ID),
                REVISION,
                List.of(DungeonPatchEntityRef.stair(401L)));
    }

    private static DungeonIdentityClosureRequest markerClosure(int count) {
        List<DungeonPatchEntityRef> refs = new ArrayList<>();
        for (int index = 0; index < count; index++) {
            refs.add(DungeonPatchEntityRef.featureMarker(601L + index));
        }
        return new DungeonIdentityClosureRequest(new DungeonMapIdentity(MAP_ID), REVISION, refs);
    }

    private static DungeonWindowRequest corridorWindow() {
        return new DungeonWindowRequest(new DungeonMapIdentity(MAP_ID), 8L, List.of(key(0, -1, -1)));
    }

    private static DungeonIdentityClosureRequest corridorClosure(int count) {
        List<DungeonPatchEntityRef> refs = new ArrayList<>();
        for (int index = 0; index < count; index++) {
            refs.add(DungeonPatchEntityRef.corridor(302L + index));
        }
        return new DungeonIdentityClosureRequest(new DungeonMapIdentity(MAP_ID), REVISION, refs);
    }

    private static void assertTypedAuthoredSemantics(DungeonWindow window) {
        DungeonWindowEntityFragment.Room room = fragment(window, DungeonPatchEntityRef.room(101L),
                DungeonWindowEntityFragment.Room.class);
        assertEquals("Window room", room.name());
        assertEquals(201L, room.clusterId());

        DungeonWindowEntityFragment.RoomCluster cluster = fragment(
                window, DungeonPatchEntityRef.roomCluster(201L), DungeonWindowEntityFragment.RoomCluster.class);
        assertEquals("Window cluster", cluster.name());
        assertTrue(cluster.memberCells().stream().anyMatch(member -> member.roomId() == 101L));
        assertTrue(cluster.boundaries().stream().anyMatch(boundary ->
                boundary.direction() == Direction.NORTH
                        && boundary.kind() == DungeonWindowEntityFragment.BoundaryKind.WALL
                        && boundary.topologyRef().id() == 7001L));

        DungeonWindowEntityFragment.Corridor corridor = fragment(
                window, DungeonPatchEntityRef.corridor(302L), DungeonWindowEntityFragment.Corridor.class);
        assertEquals(9001L, corridor.anchorRefs().getFirst().topologyRef().id());
        assertEquals(new Cell(-1, -1, 0), corridor.anchorRefs().getFirst().resolvedCell());

        DungeonWindowEntityFragment.Stair stair = fragment(
                window, DungeonPatchEntityRef.stair(401L), DungeonWindowEntityFragment.Stair.class);
        assertEquals("Window stair", stair.name());
        assertEquals("Lower", stair.exits().getFirst().label());

        DungeonWindowEntityFragment.Transition transition = fragment(
                window, DungeonPatchEntityRef.transition(501L), DungeonWindowEntityFragment.Transition.class);
        assertEquals("Window transition", transition.description());
        assertTrue(transition.destination().isUnlinkedEntrance());

        DungeonWindowEntityFragment.FeatureMarker marker = fragment(
                window, DungeonPatchEntityRef.featureMarker(601L), DungeonWindowEntityFragment.FeatureMarker.class);
        assertEquals("Window marker 601", marker.label());
        assertEquals("Marker description 601", marker.description());
    }

    private static <T extends DungeonWindowEntityFragment> T fragment(
            DungeonWindow window,
            DungeonPatchEntityRef ref,
            Class<T> type
    ) {
        return type.cast(window.fragments().stream()
                .filter(fragment -> fragment.entityRef().equals(ref))
                .findFirst()
                .orElseThrow());
    }

    private static boolean requestedFact(Cell cell, DungeonWindow window) {
        DungeonChunkKey key = new DungeonChunkKey(
                MAP_ID,
                cell.level(),
                Math.floorDiv(cell.q(), DungeonChunkKey.CHUNK_SIZE),
                Math.floorDiv(cell.r(), DungeonChunkKey.CHUNK_SIZE));
        return window.chunkHeaders().stream().anyMatch(header -> header.key().equals(key));
    }

    private static List<Cell> fragmentCells(DungeonWindowEntityFragment fragment) {
        List<Cell> cells = new ArrayList<>();
        if (fragment instanceof DungeonWindowEntityFragment.Room room) {
            cells.addAll(room.floorCells());
            room.exitDescriptions().forEach(exit -> cells.add(exit.cell()));
        } else if (fragment instanceof DungeonWindowEntityFragment.RoomCluster cluster) {
            cluster.memberCells().forEach(member -> cells.add(member.cell()));
            cluster.boundaries().forEach(boundary -> cells.add(boundary.cell()));
        } else if (fragment instanceof DungeonWindowEntityFragment.Corridor corridor) {
            corridor.waypoints().forEach(waypoint -> cells.add(waypoint.absoluteCell()));
            corridor.doorBindings().forEach(door -> cells.add(door.absoluteCell()));
            corridor.anchorBindings().forEach(anchor -> cells.add(anchor.cell()));
            corridor.anchorRefs().forEach(ref -> cells.add(ref.resolvedCell()));
            corridor.routeCells().forEach(route -> cells.add(route.cell()));
        } else if (fragment instanceof DungeonWindowEntityFragment.Stair stair) {
            stair.path().forEach(node -> cells.add(node.cell()));
            stair.exits().forEach(exit -> cells.add(exit.cell()));
        } else if (fragment instanceof DungeonWindowEntityFragment.Transition transition) {
            cells.add(transition.anchor().displayCell());
        } else if (fragment instanceof DungeonWindowEntityFragment.FeatureMarker marker) {
            cells.add(marker.anchor());
        }
        return List.copyOf(cells);
    }

    private static void insertUnindexedMalformedTransition(Path path) throws SQLException {
        try (Connection connection = open(path);
             PreparedStatement statement = connection.prepareStatement(
                     "INSERT INTO dungeon_transitions(transition_id, dungeon_map_id, description,"
                             + " anchor_type, destination_type) VALUES(?,?,?,?,?)")) {
            statement.setLong(1, 999L);
            statement.setLong(2, MAP_ID);
            statement.setString(3, "must not hydrate");
            statement.setString(4, "BROKEN");
            statement.setString(5, "BROKEN");
            statement.executeUpdate();
        }
    }

    private static void insertLargeOffWindowRoomPopulation(Path path, int cellCount) throws SQLException {
        try (Connection connection = open(path); Statement statement = connection.createStatement()) {
            statement.executeUpdate(
                    "INSERT INTO dungeon_room_clusters(cluster_id,dungeon_map_id,name)"
                            + " VALUES(999,77,'Off-window cluster')");
            statement.executeUpdate(
                    "INSERT INTO dungeon_rooms(room_id,dungeon_map_id,cluster_id,name,visual_description)"
                            + " VALUES(999,77,999,'Off-window room','')");
            try (PreparedStatement insert = connection.prepareStatement(
                    "INSERT INTO dungeon_room_cells(room_id,level_z,cell_x,cell_y) VALUES(999,0,?,?)")) {
                for (int index = 0; index < cellCount; index++) {
                    insert.setInt(1, 10_000 + index);
                    insert.setInt(2, 10_000);
                    insert.addBatch();
                }
                insert.executeBatch();
            }
        }
    }

    private static Connection open(Path path) throws SQLException {
        Connection connection = DriverManager.getConnection("jdbc:sqlite:" + path.toAbsolutePath());
        try (Statement statement = connection.createStatement()) {
            statement.execute("PRAGMA foreign_keys=ON");
        }
        return connection;
    }

    private static int scalarInt(Connection connection, String sql) throws SQLException {
        try (Statement statement = connection.createStatement(); ResultSet rows = statement.executeQuery(sql)) {
            return rows.next() ? rows.getInt(1) : 0;
        }
    }
}
