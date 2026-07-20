package features.dungeon.adapter.sqlite.repository;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertThrows;

import features.dungeon.adapter.sqlite.gateway.DungeonSqliteFixtureSeeder;
import features.dungeon.adapter.sqlite.gateway.DungeonSqliteWindowGateway;
import features.dungeon.adapter.sqlite.model.DungeonPersistenceSchema;
import features.dungeon.application.authored.command.CorridorChange;
import features.dungeon.application.authored.DungeonCachedWindowStore;
import features.dungeon.application.authored.command.DungeonPatch;
import features.dungeon.application.authored.command.DungeonPatchEntityRef;
import features.dungeon.application.authored.command.DungeonPatchResultFacts;
import features.dungeon.application.authored.command.FeatureMarkerChange;
import features.dungeon.application.authored.command.RoomClusterChange;
import features.dungeon.application.authored.command.RoomRegionChange;
import features.dungeon.application.authored.command.StairChange;
import features.dungeon.application.authored.command.TransitionChange;
import features.dungeon.application.authored.port.DungeonIdentityClosureRequest;
import features.dungeon.application.authored.port.DungeonIdentityClosureResult;
import features.dungeon.application.authored.port.DungeonWindow;
import features.dungeon.application.authored.port.DungeonWindowContentRequest;
import features.dungeon.application.authored.port.DungeonWindowEntityFragment;
import features.dungeon.application.authored.port.DungeonWindowIndex;
import features.dungeon.application.authored.port.DungeonWindowRequest;
import features.dungeon.application.authored.port.DungeonWindowStore;
import features.dungeon.api.DungeonChunkKey;
import features.dungeon.domain.core.component.CorridorAnchor;
import features.dungeon.domain.core.component.CorridorAnchorRef;
import features.dungeon.domain.core.component.CorridorWaypoint;
import features.dungeon.domain.core.component.StairExit;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.Direction;
import features.dungeon.domain.core.graph.DungeonTopologyRef;
import features.dungeon.domain.core.structure.DungeonMapIdentity;
import features.dungeon.domain.core.structure.corridor.Corridor;
import features.dungeon.domain.core.structure.corridor.CorridorBindings;
import features.dungeon.domain.core.structure.feature.FeatureMarker;
import features.dungeon.domain.core.structure.feature.FeatureMarkerKind;
import features.dungeon.domain.core.component.boundary.BoundarySegment;
import features.dungeon.domain.core.structure.room.DungeonRoomNarration;
import features.dungeon.domain.core.structure.room.RoomCluster;
import features.dungeon.domain.core.component.boundary.BoundaryKind;
import features.dungeon.domain.core.structure.room.RoomRegion;
import features.dungeon.domain.core.structure.stair.Stair;
import features.dungeon.domain.core.structure.stair.StairShape;
import features.dungeon.domain.core.structure.transition.Transition;
import features.dungeon.domain.core.structure.transition.TransitionAnchor;
import features.dungeon.domain.core.structure.transition.TransitionDestination;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import platform.diagnostics.NoopDiagnostics;
import platform.persistence.SqliteDatabase;

final class SqliteDungeonWindowStoreTest {

    private static final long MAP_ID = 77L;
    private static final long REVISION = 9L;

    @Test
    void cachedSingleChunkReadsReassembleTheExactSQLiteWindow(@TempDir Path tempDir) {
        try (SqliteDatabase database = savedDatabase(tempDir.resolve("cached-window.db"))) {
            DungeonCachedWindowStore cached = new DungeonCachedWindowStore(
                    new SqliteDungeonWindowStore(database));
            DungeonWindowRequest request = new DungeonWindowRequest(
                    new DungeonMapIdentity(MAP_ID), 41L,
                    List.of(key(0, -1, -1), key(0, 0, -1), key(0, 1, 0), key(1, 0, 1)));

            DungeonWindow first = cached.loadWindow(request).orElseThrow();
            DungeonWindow warm = cached.loadWindow(new DungeonWindowRequest(
                    request.mapId(), 42L, request.chunkKeys())).orElseThrow();

            assertEquals(request.chunkKeys(), first.chunkHeaders().stream()
                    .map(header -> header.key()).toList());
            assertEquals(first.fragments().stream().map(DungeonWindowEntityFragment::entityRef).toList(),
                    warm.fragments().stream().map(DungeonWindowEntityFragment::entityRef).toList());
            assertEquals(42L, warm.requestGeneration());
            assertTypedAuthoredSemantics(warm);
            assertTrue(warm.fragments().stream()
                    .allMatch(fragment -> requestedFacts(fragment, warm)));
        }
    }

    @Test
    void loadsExactNonRectangularWindowWithSixKindsStableHeadersAndContinuations(@TempDir Path tempDir)
            throws Exception {
        Path path = tempDir.resolve("window.db");
        try (SqliteDatabase database = savedDatabase(path)) {
            insertUnindexedMalformedTransition(path);
            DungeonWindowStore store = cachedStore(database);
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
                    .allMatch(fragment -> requestedFacts(fragment, window)));
            assertEquals(List.of(
                    key(0, 0, -1),
                    key(0, 1, -1),
                    key(0, 2, -1),
                    key(0, 2, 0)), window.continuationPage().entries().stream()
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
            loadWindow(gateway, markerWindow()).orElseThrow();
            singleWindowStatements = gateway.lastStatementCount();
            gateway.loadIdentityClosure(markerClosure(1));
            singleClosureStatements = gateway.lastStatementCount();
        }

        try (SqliteDatabase database = savedDatabase(tempDir.resolve("many-count.db"), 25)) {
            DungeonSqliteWindowGateway gateway = new DungeonSqliteWindowGateway(database);
            DungeonWindow window = loadWindow(gateway, markerWindow()).orElseThrow();
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
            loadWindow(gateway, corridorWindow()).orElseThrow();
            singleWindowStatements = gateway.lastStatementCount();
            gateway.loadIdentityClosure(corridorClosure(1));
            singleClosureStatements = gateway.lastStatementCount();
        }
        try (SqliteDatabase database = savedGraphDatabase(tempDir.resolve("many-graphs.db"), 20)) {
            DungeonSqliteWindowGateway gateway = new DungeonSqliteWindowGateway(database);
            DungeonWindow window = loadWindow(gateway, corridorWindow()).orElseThrow();
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
            DungeonWindow window = cachedStore(database).loadWindow(new DungeonWindowRequest(
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
    void versionSixMigrationDiscardsPreDependencyDungeonRowsBeforeWindowRead(@TempDir Path tempDir)
            throws Exception {
        Path path = tempDir.resolve("populated-v4-route-upgrade.db");
        try (SqliteDatabase ignored = savedGraphDatabase(path, 1)) {
            // Persist a populated canonical graph with its pre-upgrade derived chunk inventory.
        }
        corruptPreDependencySchemaVersion(path);

        try (SqliteDatabase database = new SqliteDatabase(path, NoopDiagnostics.INSTANCE)) {
            assertTrue(cachedStore(database).loadWindow(new DungeonWindowRequest(
                    new DungeonMapIdentity(MAP_ID),
                    23L,
                    List.of(key(0, 0, -1))))
                    .isEmpty(),
                    "owner-approved v6 replacement must not publish pre-dependency Dungeon rows");
        }
        try (Connection connection = open(path)) {
            assertEquals(6, scalarInt(connection,
                    "SELECT version FROM sm_schema_versions WHERE owner='dungeon'"));
            assertEquals(0, scalarInt(connection, "SELECT COUNT(*) FROM dungeon_maps"));
            assertEquals(0, scalarInt(connection,
                    "SELECT COUNT(*) FROM dungeon_corridor_route_dependencies"));
        }
    }

    @Test
    void selfReferencedAnchorOnlyCorridorPublishesItsCanonicalBodyCell(@TempDir Path tempDir) throws Exception {
        Path path = tempDir.resolve("anchor-only-corridor.db");
        long corridorId = 701L;
        long anchorId = 9_701L;
        Corridor corridor = new Corridor(corridorId, MAP_ID, 0, List.of(), new CorridorBindings(
                List.of(), List.of(),
                List.of(new CorridorAnchor(anchorId, corridorId, new Cell(6, 5, 0))),
                List.of(new CorridorAnchorRef(corridorId, anchorId))));
        try (SqliteDatabase database = new SqliteDatabase(path, NoopDiagnostics.INSTANCE)) {
            DungeonSqliteFixtureSeeder.insertHeader(database, MAP_ID, "Anchor-only corridor", REVISION - 1L);
            DungeonSqliteFixtureSeeder.commit(database, DungeonPatch.of(
                    new DungeonMapIdentity(MAP_ID),
                    REVISION - 1L,
                    List.of(new CorridorChange(null, corridor, Set.of(key(0, 0, 0))))));
            DungeonWindow window = cachedStore(database).loadWindow(new DungeonWindowRequest(
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
            loadWindow(gateway, request).orElseThrow();
            baselineStatements = gateway.lastStatementCount();
            baselineSql = gateway.lastStatementSql();
        }

        Path path = tempDir.resolve("bounded-large-off-window.db");
        try (SqliteDatabase database = savedGraphDatabase(path, 1)) {
            insertLargeOffWindowRoomPopulation(database, 4_096);
            DungeonSqliteWindowGateway gateway = new DungeonSqliteWindowGateway(database);
            DungeonWindow window = loadWindow(gateway, request).orElseThrow();
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
            DungeonWindowStore store = cachedStore(database);
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
            DungeonSqliteFixtureSeeder.commit(database, DungeonPatch.of(
                    new DungeonMapIdentity(MAP_ID),
                    REVISION,
                    List.of(new StairChange(windowStair(null), windowStair(302L)))));
            DungeonWindowStore store = cachedStore(database);
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
                    store.loadIdentityClosure(new DungeonIdentityClosureRequest(
                            new DungeonMapIdentity(MAP_ID),
                            REVISION + 1L,
                            List.of(DungeonPatchEntityRef.stair(401L)))));
        }
    }

    @Test
    void stairWindowAndClosureRejectDanglingAndCrossMapCorridorBindings(@TempDir Path tempDir)
            throws Exception {
        assertStairBindingRejected(
                tempDir.resolve("stair-dangling-corridor.db"),
                true,
                false,
                List.of("UPDATE dungeon_stairs SET corridor_id=9999 WHERE stair_id=401"));
        assertStairBindingRejected(
                tempDir.resolve("stair-cross-map-corridor.db"),
                false,
                true,
                List.of("UPDATE dungeon_stairs SET corridor_id=9999 WHERE stair_id=401"));
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

    private static void assertWindowRejected(Path path, String corruptionSql) throws Exception {
        assertWindowRejected(
                path,
                new DungeonWindowRequest(
                        new DungeonMapIdentity(MAP_ID), 1L, List.of(key(0, -1, -1))),
                corruptionSql);
    }

    private static void assertWindowRejected(
            Path path,
            DungeonWindowRequest request,
            String corruptionSql
    ) throws Exception {
        try (SqliteDatabase database = savedDatabase(path);
             Connection connection = open(path);
             Statement statement = connection.createStatement()) {
            applyTargetedCorruption(statement, corruptionSql);
            DungeonWindowStore store = cachedStore(database);
            assertThrows(RuntimeException.class, () -> store.loadWindow(request));
        }
    }

    private static void assertRejected(
            Path path,
            DungeonIdentityClosureRequest request,
            DungeonIdentityClosureResult.Reason expected,
            String corruptionSql
    ) throws Exception {
        try (SqliteDatabase database = savedDatabase(path)) {
            if (corruptionSql != null) {
                try (Connection connection = open(path); Statement statement = connection.createStatement()) {
                    applyTargetedCorruption(statement, corruptionSql);
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
            boolean seedOtherMapCorridor,
            List<String> corruptionSql
    ) throws Exception {
        try (SqliteDatabase database = savedDatabase(path)) {
            if (seedOtherMapCorridor) {
                DungeonSqliteFixtureSeeder.insertHeader(database, 78L, "Other map", 1L);
                DungeonSqliteFixtureSeeder.commit(database, DungeonPatch.of(
                        new DungeonMapIdentity(78L),
                        1L,
                        List.of(new CorridorChange(
                                null,
                                new Corridor(9999L, 78L, 0, List.of(), CorridorBindings.empty()),
                                Set.of()))));
            }
            try (Connection connection = open(path); Statement statement = connection.createStatement()) {
                if (removeCorridorForeignKey) {
                    removeStairCorridorForeignKeyForCorruption(statement);
                }
                for (String statementSql : corruptionSql) {
                    applyTargetedCorruption(statement, statementSql);
                }
            }
            DungeonWindowStore store = cachedStore(database);
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
            removeTransitionLinkedIdForeignKeyForCorruption(statement);
            applyTargetedCorruption(statement,
                    "UPDATE dungeon_transitions SET linked_transition_id=" + linkedTransitionId
                            + " WHERE transition_id=501");

            DungeonWindowStore store = cachedStore(database);
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
                Transition target = new Transition(
                        502L, MAP_ID, "Linked transition", TransitionAnchor.cell(new Cell(1, 1, 0)),
                        TransitionDestination.unlinkedEntrance(), null);
                DungeonSqliteFixtureSeeder.commit(database, DungeonPatch.of(
                        new DungeonMapIdentity(MAP_ID),
                        REVISION,
                        List.of(new TransitionChange(null, target))));
                Transition before = windowTransition(null);
                DungeonSqliteFixtureSeeder.commit(database, DungeonPatch.of(
                        new DungeonMapIdentity(MAP_ID),
                        REVISION + 1L,
                        List.of(new TransitionChange(before, windowTransition(linkedTransitionId)))));
            }
            DungeonWindowStore store = cachedStore(database);
            DungeonWindowEntityFragment.Transition transition = fragment(
                    store.loadWindow(transitionWindow()).orElseThrow(),
                    DungeonPatchEntityRef.transition(501L),
                    DungeonWindowEntityFragment.Transition.class);
            assertEquals(linkedTransitionId, transition.linkedTransitionId());
            assertInstanceOf(
                    DungeonIdentityClosureResult.Complete.class,
                    store.loadIdentityClosure(new DungeonIdentityClosureRequest(
                            new DungeonMapIdentity(MAP_ID),
                            linkedTransitionId == null ? REVISION : REVISION + 2L,
                            List.of(DungeonPatchEntityRef.transition(501L)))));
        }
    }

    private static Transition windowTransition(Long linkedTransitionId) {
        return new Transition(
                501L,
                MAP_ID,
                "Window transition",
                TransitionAnchor.cell(new Cell(-1, -1, 0)),
                TransitionDestination.unlinkedEntrance(),
                linkedTransitionId);
    }

    private static SqliteDatabase savedDatabase(Path path) {
        return savedDatabase(path, 1);
    }

    private static DungeonWindowStore cachedStore(SqliteDatabase database) {
        return new DungeonCachedWindowStore(new SqliteDungeonWindowStore(database));
    }

    private static java.util.Optional<DungeonWindow> loadWindow(
            DungeonSqliteWindowGateway gateway,
            DungeonWindowRequest request
    ) {
        java.util.Optional<DungeonWindowIndex> indexed = gateway.loadIndex(request);
        if (indexed.isEmpty()) {
            return java.util.Optional.empty();
        }
        DungeonWindowIndex index = indexed.get();
        if (index.chunkHeaders().isEmpty()) {
            return java.util.Optional.of(new DungeonWindow(
                    index.mapHeader(), index.requestGeneration(), List.of(), List.of(), List.of(), List.of(),
                    features.dungeon.application.authored.port.DungeonContinuationPage.empty()));
        }
        return gateway.loadContent(new DungeonWindowContentRequest(
                index.mapHeader().mapId(), index.mapHeader().revision(),
                index.requestGeneration(), index.chunkHeaders()));
    }

    private static SqliteDatabase savedDatabase(Path path, int markerCount) {
        SqliteDatabase database = new SqliteDatabase(path, NoopDiagnostics.INSTANCE);
        seedAuthoredMap(database, markerCount, 1);
        return database;
    }

    private static SqliteDatabase savedGraphDatabase(Path path, int corridorCount) {
        SqliteDatabase database = new SqliteDatabase(path, NoopDiagnostics.INSTANCE);
        seedAuthoredMap(database, 1, corridorCount);
        return database;
    }

    private static void seedAuthoredMap(SqliteDatabase database, int markerCount, int corridorCount) {
        RoomRegion room = new RoomRegion(
                101L, MAP_ID, 201L, "Window room",
                Set.of(new Cell(-64, -64, 0), new Cell(10, 10, 0), new Cell(64, 0, 0)),
                DungeonRoomNarration.empty());
        RoomCluster cluster = RoomCluster.authored(
                201L, MAP_ID, "Window cluster", List.of(BoundarySegment.fromEdge(
                        Direction.NORTH.edgeOf(new Cell(-64, -64, 0)),
                        BoundaryKind.WALL,
                        DungeonTopologyRef.wall(7001L))));
        Corridor host = new Corridor(301L, MAP_ID, 0, List.of(), new CorridorBindings(
                List.of(), List.of(),
                List.of(
                        new CorridorAnchor(9001L, 301L, new Cell(-1, -1, 0)),
                        new CorridorAnchor(9002L, 301L, new Cell(130, 0, 0))),
                List.of()));
        List<Corridor> corridors = new ArrayList<>();
        corridors.add(host);
        for (int index = 0; index < corridorCount; index++) {
            long corridorId = 302L + index;
            corridors.add(new Corridor(corridorId, MAP_ID, 0, List.of(), new CorridorBindings(
                    List.of(new CorridorWaypoint(201L, new Cell(64, -1, 0))),
                    List.of(), List.of(),
                    List.of(new CorridorAnchorRef(301L, 9001L), new CorridorAnchorRef(301L, 9002L)))));
        }
        Stair stair = windowStair(null);

        Transition transition = windowTransition(null);
        List<FeatureMarker> markers = new ArrayList<>();
        for (int index = 0; index < markerCount; index++) {
            long markerId = 601L + index;
            markers.add(new FeatureMarker(
                    markerId,
                    new DungeonMapIdentity(MAP_ID),
                    FeatureMarkerKind.OBJECT,
                    new Cell(64 + index, 0, 0),
                    "Window marker " + markerId,
                    "Marker description " + markerId));
        }
        List<features.dungeon.application.authored.command.DungeonPatchChange> changes = new ArrayList<>();
        changes.add(new RoomClusterChange(null, cluster, Set.of()));
        changes.add(new RoomRegionChange(null, room));
        corridors.forEach(corridor -> changes.add(new CorridorChange(null, corridor, Set.of())));
        changes.add(new StairChange(null, stair));
        changes.add(new TransitionChange(null, transition));
        markers.forEach(marker -> changes.add(new FeatureMarkerChange(null, marker)));
        Set<DungeonChunkKey> touchedChunks = Set.of(
                key(0, -1, -2),
                key(0, -1, -1),
                key(0, 0, -1),
                key(0, 1, -1),
                key(0, 2, -1),
                key(0, 0, 0),
                key(0, 1, 0),
                key(0, 2, 0),
                key(1, 0, 1),
                key(2, 0, 1));
        DungeonSqliteFixtureSeeder.insertHeader(database, MAP_ID, "Window map", REVISION - 1L);
        DungeonPatch base = DungeonPatch.of(new DungeonMapIdentity(MAP_ID), REVISION - 1L, changes);
        DungeonSqliteFixtureSeeder.commit(database, new DungeonPatch(
                base.mapId(),
                base.expectedRevision(),
                base.changes(),
                touchedChunks,
                new DungeonPatchResultFacts(base.resultFacts().affectedEntities()),
                base.encodedBytes()));
    }

    private static Stair windowStair(Long corridorId) {
        return new Stair(401L, MAP_ID, "Window stair", StairShape.STRAIGHT, Direction.NORTH, 2, 1,
                List.of(new Cell(0, 64, 1), new Cell(0, 64, 2)),
                List.of(
                        new StairExit(410L, new Cell(0, 64, 1), "Lower"),
                        new StairExit(411L, new Cell(0, 64, 2), "Upper")),
                corridorId);
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
                boundary.direction() == Direction.SOUTH
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

    private static boolean requestedFacts(DungeonWindowEntityFragment fragment, DungeonWindow window) {
        if (fragment instanceof DungeonWindowEntityFragment.RoomCluster cluster) {
            return cluster.memberCells().stream().allMatch(member -> requestedFact(member.cell(), window))
                    && cluster.boundaries().stream().allMatch(boundary -> boundary.direction().edgeOf(boundary.cell())
                            .touchingCells().stream().anyMatch(cell -> requestedFact(cell, window)));
        }
        return fragmentCells(fragment).stream().allMatch(cell -> requestedFact(cell, window));
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

    // Raw authored writes below deliberately damage an already valid UoW-seeded fixture.
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

    private static void corruptPreDependencySchemaVersion(Path path) throws SQLException {
        try (Connection connection = open(path); Statement statement = connection.createStatement()) {
            statement.execute("DROP TABLE dungeon_corridor_route_cells");
            applyTargetedCorruption(
                    statement,
                    "UPDATE sm_schema_versions SET version=4 WHERE owner='dungeon'");
        }
    }

    private static void removeStairCorridorForeignKeyForCorruption(Statement statement) throws SQLException {
        statement.execute("PRAGMA foreign_keys=OFF");
        statement.execute("CREATE TABLE dungeon_stairs_without_corridor_fk ("
                + "stair_id INTEGER PRIMARY KEY AUTOINCREMENT,"
                + "dungeon_map_id INTEGER NOT NULL REFERENCES dungeon_maps(dungeon_map_id) ON DELETE CASCADE,"
                + "name TEXT, shape TEXT NOT NULL DEFAULT 'LADDER',"
                + "direction INTEGER NOT NULL DEFAULT 0, dimension1 INTEGER NOT NULL DEFAULT 0,"
                + "dimension2 INTEGER NOT NULL DEFAULT 0, corridor_id INTEGER)");
        statement.executeUpdate("INSERT INTO dungeon_stairs_without_corridor_fk SELECT * FROM dungeon_stairs");
        statement.execute("DROP TABLE dungeon_stairs");
        statement.execute("ALTER TABLE dungeon_stairs_without_corridor_fk RENAME TO dungeon_stairs");
        statement.execute("PRAGMA foreign_keys=ON");
    }

    private static void removeTransitionLinkedIdForeignKeyForCorruption(Statement statement) throws SQLException {
        statement.execute("PRAGMA foreign_keys=OFF");
        statement.execute("CREATE TABLE dungeon_transitions_without_linked_fk ("
                + "transition_id INTEGER PRIMARY KEY AUTOINCREMENT,"
                + "dungeon_map_id INTEGER NOT NULL REFERENCES dungeon_maps(dungeon_map_id) ON DELETE CASCADE,"
                + "description TEXT, cell_x INTEGER, cell_y INTEGER, level_z INTEGER,"
                + "anchor_type TEXT, anchor_edge_direction TEXT, destination_type TEXT NOT NULL,"
                + "target_overworld_map_id INTEGER, target_overworld_tile_id INTEGER,"
                + "target_dungeon_map_id INTEGER, target_transition_id INTEGER, linked_transition_id INTEGER)");
        statement.executeUpdate("INSERT INTO dungeon_transitions_without_linked_fk SELECT * FROM dungeon_transitions");
        statement.execute("DROP TABLE dungeon_transitions");
        statement.execute("ALTER TABLE dungeon_transitions_without_linked_fk RENAME TO dungeon_transitions");
        statement.execute("PRAGMA foreign_keys=ON");
    }

    private static void applyTargetedCorruption(Statement statement, String sql) throws SQLException {
        statement.executeUpdate(sql);
    }

    private static void insertLargeOffWindowRoomPopulation(SqliteDatabase database, int cellCount) {
        Set<Cell> cells = new java.util.LinkedHashSet<>();
        Set<DungeonChunkKey> chunks = new java.util.LinkedHashSet<>();
        for (int index = 0; index < cellCount; index++) {
            Cell cell = new Cell(10_000 + index, 10_000, 0);
            cells.add(cell);
            chunks.add(key(0,
                    Math.floorDiv(cell.q(), DungeonChunkKey.CHUNK_SIZE),
                    Math.floorDiv(cell.r(), DungeonChunkKey.CHUNK_SIZE)));
        }
        RoomCluster cluster = RoomCluster.authored(
                999L, MAP_ID, "Off-window cluster", List.of());
        RoomRegion room = new RoomRegion(
                999L, MAP_ID, 999L, "Off-window room", cells, DungeonRoomNarration.empty());
        DungeonSqliteFixtureSeeder.commit(database, DungeonPatch.of(
                new DungeonMapIdentity(MAP_ID),
                REVISION,
                List.of(
                        new RoomClusterChange(null, cluster, chunks),
                        new RoomRegionChange(null, room))));
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
