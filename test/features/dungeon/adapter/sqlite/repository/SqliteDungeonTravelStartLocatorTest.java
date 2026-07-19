package features.dungeon.adapter.sqlite.repository;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertTrue;

import features.dungeon.application.authored.port.DungeonIdentityClosureResult;
import features.dungeon.application.authored.port.DungeonTravelChunkKeysRequest;
import features.dungeon.application.authored.port.DungeonTravelChunkKeysResult;
import features.dungeon.application.authored.port.DungeonTravelStartRequest;
import features.dungeon.application.authored.port.DungeonTravelStartResult;
import features.dungeon.adapter.sqlite.gateway.DungeonSqliteFixtureSeeder;
import features.dungeon.adapter.sqlite.gateway.DungeonSqliteWindowGateway;
import features.dungeon.application.authored.command.DungeonPatch;
import features.dungeon.application.authored.command.FeatureMarkerChange;
import features.dungeon.application.authored.command.TransitionChange;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.structure.DungeonMapIdentity;
import features.dungeon.domain.core.structure.feature.FeatureMarker;
import features.dungeon.domain.core.structure.feature.FeatureMarkerKind;
import features.dungeon.domain.core.structure.transition.Transition;
import features.dungeon.domain.core.structure.transition.TransitionAnchor;
import features.dungeon.domain.core.structure.transition.TransitionDestination;
import features.dungeon.api.DungeonChunkKey;
import java.nio.file.Path;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import platform.diagnostics.NoopDiagnostics;
import platform.persistence.SqliteDatabase;

final class SqliteDungeonTravelStartLocatorTest {

    @Test
    void prefersSmallestPlacedTransitionThroughSparseIdentityIndex(@TempDir Path directory) throws Exception {
        Path path = directory.resolve("travel-start.sqlite");
        try (SqliteDatabase database = new SqliteDatabase(path, NoopDiagnostics.INSTANCE)) {
            SqliteDungeonWindowStore store = initializedStore(database);
            seedTransitions(database, 17L);

            DungeonTravelStartResult.Located located = assertInstanceOf(
                    DungeonTravelStartResult.Located.class,
                    store.locateTravelStart(new DungeonTravelStartRequest(
                            new DungeonMapIdentity(17L), 5L)));

            assertEquals(300L, located.transitionId());
            assertEquals(new Cell(-1, 64, 1), located.windowAnchor());
        }
    }

    @Test
    void returnsFirstSparseChunkAndTypedStaleWithoutHydratingEntities(@TempDir Path directory) throws Exception {
        Path path = directory.resolve("travel-chunk-start.sqlite");
        try (SqliteDatabase database = new SqliteDatabase(path, NoopDiagnostics.INSTANCE)) {
            SqliteDungeonWindowStore store = initializedStore(database);
            seedSparseChunks(database, 23L);

            DungeonTravelStartResult.Located located = assertInstanceOf(
                    DungeonTravelStartResult.Located.class,
                    store.locateTravelStart(new DungeonTravelStartRequest(
                            new DungeonMapIdentity(23L), 9L)));
            assertEquals(new Cell(-128, 448, 1), located.windowAnchor());
            assertEquals(null, located.transitionId());

            DungeonTravelStartResult.Rejected stale = assertInstanceOf(
                    DungeonTravelStartResult.Rejected.class,
                    store.locateTravelStart(new DungeonTravelStartRequest(
                            new DungeonMapIdentity(23L), 8L)));
            assertEquals(DungeonIdentityClosureResult.Reason.STALE_REVISION, stale.reason());
        }
    }

    @Test
    void discoversOnlyTheFixedHorizontalRingAcrossEveryAuthoredLevel(@TempDir Path directory) throws Exception {
        Path path = directory.resolve("travel-level-window.sqlite");
        try (SqliteDatabase database = new SqliteDatabase(path, NoopDiagnostics.INSTANCE)) {
            DungeonSqliteWindowGateway gateway = new DungeonSqliteWindowGateway(database);
            gateway.discoverTravelChunkKeys(new DungeonTravelChunkKeysRequest(
                    new DungeonMapIdentity(999L), 1L, 0, 0));
            seedTravelLevels(database, 29L);

            DungeonTravelChunkKeysResult.Complete complete = assertInstanceOf(
                    DungeonTravelChunkKeysResult.Complete.class,
                    gateway.discoverTravelChunkKeys(new DungeonTravelChunkKeysRequest(
                            new DungeonMapIdentity(29L), 3L, 0, 0)));

            assertEquals(List.of(
                    new DungeonChunkKey(29L, -3, -1, -1),
                    new DungeonChunkKey(29L, 0, 0, 0),
                    new DungeonChunkKey(29L, 2, 1, 0)), complete.chunkKeys());
            assertEquals(2, gateway.lastStatementCount());
            assertTrue(gateway.lastStatementSql().get(1).contains(
                    "chunk_q IN (?,?,?) AND chunk_r IN (?,?,?)"));

            DungeonTravelChunkKeysResult.Rejected stale = assertInstanceOf(
                    DungeonTravelChunkKeysResult.Rejected.class,
                    gateway.discoverTravelChunkKeys(new DungeonTravelChunkKeysRequest(
                            new DungeonMapIdentity(29L), 2L, 0, 0)));
            assertEquals(DungeonIdentityClosureResult.Reason.STALE_REVISION, stale.reason());
            assertEquals(1, gateway.lastStatementCount());
        }
    }

    private static SqliteDungeonWindowStore initializedStore(SqliteDatabase database) {
        SqliteDungeonWindowStore store = new SqliteDungeonWindowStore(database);
        store.locateTravelStart(new DungeonTravelStartRequest(new DungeonMapIdentity(999L), 1L));
        return store;
    }

    private static void seedTransitions(SqliteDatabase database, long mapId) {
        DungeonMapIdentity map = new DungeonMapIdentity(mapId);
        DungeonSqliteFixtureSeeder.insertHeader(database, mapId, "Travel " + mapId, 4L);
        DungeonSqliteFixtureSeeder.commit(database, DungeonPatch.of(map, 4L, List.of(
                new TransitionChange(null, transition(mapId, 301L, new Cell(130, -65, 2))),
                new TransitionChange(null, transition(mapId, 300L, new Cell(-1, 64, 1))))));
    }

    private static Transition transition(long mapId, long transitionId, Cell cell) {
        return new Transition(
                transitionId,
                mapId,
                "Transition " + transitionId,
                TransitionAnchor.cell(cell),
                TransitionDestination.unlinkedEntrance(),
                null);
    }

    private static void seedSparseChunks(SqliteDatabase database, long mapId) {
        DungeonMapIdentity map = new DungeonMapIdentity(mapId);
        DungeonSqliteFixtureSeeder.insertHeader(database, mapId, "Travel " + mapId, 8L);
        DungeonSqliteFixtureSeeder.commit(database, DungeonPatch.of(map, 8L, List.of(
                new FeatureMarkerChange(null, marker(map, 401L, new Cell(4 * 64, -3 * 64, 2))),
                new FeatureMarkerChange(null, marker(map, 402L, new Cell(-2 * 64, 7 * 64, 1))))));
    }

    private static void seedTravelLevels(SqliteDatabase database, long mapId) {
        DungeonMapIdentity map = new DungeonMapIdentity(mapId);
        DungeonSqliteFixtureSeeder.insertHeader(database, mapId, "Travel " + mapId, 2L);
        DungeonSqliteFixtureSeeder.commit(database, DungeonPatch.of(map, 2L, List.of(
                new FeatureMarkerChange(null, marker(map, 501L, new Cell(-64, -64, -3))),
                new FeatureMarkerChange(null, marker(map, 502L, new Cell(1, 1, 0))),
                new FeatureMarkerChange(null, marker(map, 503L, new Cell(64, 0, 2))),
                new FeatureMarkerChange(null, marker(map, 504L, new Cell(128, 0, 5))))));
    }

    private static FeatureMarker marker(DungeonMapIdentity map, long id, Cell cell) {
        return new FeatureMarker(id, map, FeatureMarkerKind.POI, cell, "Travel seed " + id, "");
    }
}
