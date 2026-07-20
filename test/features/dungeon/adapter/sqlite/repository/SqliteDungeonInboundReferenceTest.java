package features.dungeon.adapter.sqlite.repository;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;

import features.dungeon.adapter.sqlite.gateway.DungeonSqliteFixtureSeeder;
import features.dungeon.application.authored.command.CorridorChange;
import features.dungeon.application.authored.command.DungeonPatch;
import features.dungeon.application.authored.command.DungeonPatchEntityRef;
import features.dungeon.application.authored.command.StairChange;
import features.dungeon.application.authored.command.TransitionChange;
import features.dungeon.application.authored.port.DungeonInboundReferenceRequest;
import features.dungeon.application.authored.port.DungeonInboundReferenceResult;
import features.dungeon.application.authored.port.DungeonMapHeader;
import features.dungeon.domain.core.component.CorridorAnchor;
import features.dungeon.domain.core.component.CorridorAnchorRef;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.Direction;
import features.dungeon.domain.core.structure.corridor.Corridor;
import features.dungeon.domain.core.structure.corridor.CorridorBindings;
import features.dungeon.domain.core.structure.stair.Stair;
import features.dungeon.domain.core.structure.stair.StairShape;
import features.dungeon.domain.core.structure.transition.Transition;
import features.dungeon.domain.core.structure.transition.TransitionAnchor;
import features.dungeon.domain.core.structure.transition.TransitionDestination;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import platform.diagnostics.NoopDiagnostics;
import platform.persistence.SqliteDatabase;
import platform.persistence.TestFeatureStores;

import java.nio.file.Path;
import java.util.List;
import java.util.Set;

final class SqliteDungeonInboundReferenceTest {

    @Test
    void discoversOnlyTypedInboundCorridorAndTransitionRefsAtTheExpectedRevision(@TempDir Path directory)
            throws Exception {
        Path path = directory.resolve("inbound.sqlite");
        try (SqliteDatabase database = new SqliteDatabase(path, NoopDiagnostics.INSTANCE)) {
            var fixture = DungeonSqliteFixtureSeeder.prepare(database);
            SqliteDungeonCatalogStore catalog = new SqliteDungeonCatalogStore(fixture.store());
            DungeonMapHeader created = catalog.create("Inbound");
            insertReferences(fixture, created);
            DungeonMapHeader header = catalog.find(created.mapId()).orElseThrow();
            SqliteDungeonWindowStore store = new SqliteDungeonWindowStore(fixture.store());

            DungeonInboundReferenceResult.Complete corridor = assertInstanceOf(
                    DungeonInboundReferenceResult.Complete.class,
                    store.discoverInboundReferences(new DungeonInboundReferenceRequest(
                            header.mapId(),
                            header.revision(),
                            List.of(DungeonPatchEntityRef.corridor(10L)))));
            assertEquals(
                    List.of(DungeonPatchEntityRef.stair(20L), DungeonPatchEntityRef.corridor(11L)),
                    corridor.inboundRefs());

            DungeonInboundReferenceResult.Complete transition = assertInstanceOf(
                    DungeonInboundReferenceResult.Complete.class,
                    store.discoverInboundReferences(new DungeonInboundReferenceRequest(
                            header.mapId(),
                            header.revision(),
                            List.of(DungeonPatchEntityRef.transition(30L)))));
            assertEquals(List.of(DungeonPatchEntityRef.transition(31L)), transition.inboundRefs());

            DungeonInboundReferenceResult.Rejected stale = assertInstanceOf(
                    DungeonInboundReferenceResult.Rejected.class,
                    store.discoverInboundReferences(new DungeonInboundReferenceRequest(
                            header.mapId(),
                            header.revision() + 1L,
                            List.of(DungeonPatchEntityRef.corridor(10L)))));
            assertEquals(features.dungeon.application.authored.port.DungeonIdentityClosureResult.Reason.STALE_REVISION,
                    stale.reason());
        }
    }

    private static void insertReferences(
            DungeonSqliteFixtureSeeder.Fixture fixture, DungeonMapHeader header) {
        long mapId = header.mapId().value();
        Corridor host = new Corridor(10L, mapId, 0, List.of(), new CorridorBindings(
                List.of(), List.of(), List.of(new CorridorAnchor(100L, 10L, new Cell(0, 0, 0))), List.of()));
        Corridor referrer = new Corridor(11L, mapId, 0, List.of(), new CorridorBindings(
                List.of(), List.of(), List.of(), List.of(new CorridorAnchorRef(10L, 100L))));
        Stair stair = new Stair(
                20L,
                mapId,
                "Bound",
                StairShape.STRAIGHT,
                Direction.NORTH,
                1,
                1,
                List.of(new Cell(0, 0, 0)),
                List.of(),
                10L);
        Transition target = new Transition(
                30L, mapId, "Target", TransitionAnchor.none(), TransitionDestination.unlinkedEntrance(), null);
        Transition transitionReferrer = new Transition(
                31L, mapId, "Referrer", TransitionAnchor.none(), TransitionDestination.unlinkedEntrance(), 30L);
        fixture.commit(DungeonPatch.of(
                header.mapId(),
                header.revision(),
                List.of(
                        new CorridorChange(null, host, Set.of()),
                        new CorridorChange(null, referrer, Set.of()),
                        new StairChange(null, stair),
                        new TransitionChange(null, target),
                        new TransitionChange(null, transitionReferrer))));
    }
}
