package features.dungeon.application.travel;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertTrue;

import features.dungeon.application.authored.command.DungeonPatchEntityRef;
import features.dungeon.application.authored.port.DungeonCatalogStore;
import features.dungeon.application.authored.port.DungeonEntitySnapshot;
import features.dungeon.application.authored.port.DungeonIdentityClosureRequest;
import features.dungeon.application.authored.port.DungeonIdentityClosureResult;
import features.dungeon.application.authored.port.DungeonMapHeader;
import features.dungeon.application.authored.port.DungeonTravelChunkKeysRequest;
import features.dungeon.application.authored.port.DungeonTravelChunkKeysResult;
import features.dungeon.application.authored.port.DungeonTravelStartRequest;
import features.dungeon.application.authored.port.DungeonTravelStartResult;
import features.dungeon.application.authored.port.DungeonWindow;
import features.dungeon.application.authored.port.DungeonWindowEntityFragment;
import features.dungeon.application.authored.port.DungeonWindowRequest;
import features.dungeon.application.authored.port.DungeonWindowStore;
import features.dungeon.application.travel.projection.TravelPositionFacts;
import features.dungeon.application.travel.projection.TravelTransitionTarget;
import features.dungeon.application.travel.session.TravelDungeonSessionSurface.LocationKind;
import features.dungeon.api.DungeonChunkKey;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.structure.DungeonMapIdentity;
import features.dungeon.domain.core.structure.transition.Transition;
import features.dungeon.domain.core.structure.transition.TransitionAnchor;
import features.dungeon.domain.core.structure.transition.TransitionDestination;
import features.dungeon.domain.core.structure.transition.TransitionDestinationTarget;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;

final class DungeonTravelAuthoredReaderTest {

    @Test
    void currentPositionLoadsChunkAndRingAndExactTravelClosure() {
        Fixture fixture = new Fixture(41L, 7L, new Cell(65, -1, 2));
        DungeonTravelAuthoredReadResult.Loaded loaded = assertInstanceOf(
                DungeonTravelAuthoredReadResult.Loaded.class,
                fixture.reader().readCurrentPosition(new TravelPositionFacts(
                        fixture.header().mapId().value(),
                        LocationKind.TRANSITION,
                        fixture.transition().transitionId(),
                        fixture.transition().anchorCell(),
                        null)));

        assertEquals(9, fixture.windows().lastWindowRequest.chunkKeys().size());
        assertEquals(List.of(DungeonPatchEntityRef.transition(fixture.transition().transitionId())),
                fixture.windows().lastClosureRequest.entityRefs());
        assertEquals(fixture.header().mapId().value(), loaded.surface().header().mapId());
        assertEquals(fixture.transition().transitionId(),
                loaded.surface().transition(fixture.transition().transitionId()).transitionId());
    }

    @Test
    void currentPositionLoadsTheHorizontalRingAcrossEveryDiscoveredLevel() {
        Fixture fixture = new Fixture(51L, 8L, new Cell(1, 1, 0));
        fixture.windows().travelLevels = List.of(-2, 0, 3);

        assertInstanceOf(
                DungeonTravelAuthoredReadResult.Loaded.class,
                fixture.reader().readCurrentPosition(new TravelPositionFacts(
                        fixture.header().mapId().value(),
                        LocationKind.TRANSITION,
                        fixture.transition().transitionId(),
                        fixture.transition().anchorCell(),
                        null)));

        assertEquals(27, fixture.windows().lastWindowRequest.chunkKeys().size());
        assertEquals(List.of(-2, 0, 3), fixture.windows().lastWindowRequest.chunkKeys().stream()
                .map(DungeonChunkKey::level)
                .distinct()
                .toList());
    }

    @Test
    void firstCatalogMapUsesLocatedStartWithoutInventingMapOne() {
        Fixture fixture = new Fixture(73L, 3L, new Cell(-130, 130, 0));

        DungeonTravelAuthoredReadResult.Loaded loaded = assertInstanceOf(
                DungeonTravelAuthoredReadResult.Loaded.class,
                fixture.reader().readFirstCatalogMap());

        assertEquals(73L, loaded.surface().header().mapId());
        assertEquals(1, fixture.windows().locatorCalls.get());
        assertTrue(fixture.windows().lastWindowRequest.chunkKeys().stream()
                .anyMatch(key -> key.chunkQ() == -3 && key.chunkR() == 2));
    }

    @Test
    void staleReadRestartsCatalogFirstExactlyOnce() {
        Fixture fixture = new Fixture(81L, 4L, new Cell(1, 1, 0));
        fixture.windows().staleLocatorResponses = 1;

        assertInstanceOf(
                DungeonTravelAuthoredReadResult.Loaded.class,
                fixture.reader().readSelectedMap(81L));

        assertEquals(2, fixture.catalog().searchCalls.get());
        assertEquals(2, fixture.windows().locatorCalls.get());
    }

    @Test
    void exactTransitionTargetLoadsItsClosureBeforeTargetWindow() {
        Fixture fixture = new Fixture(91L, 12L, new Cell(192, 64, 1));
        TravelTransitionTarget target = TravelTransitionTarget.dungeonMap(
                fixture.header().mapId().value(),
                TransitionDestinationTarget.fromPositiveId(fixture.transition().transitionId()));

        DungeonTravelAuthoredReadResult.Loaded loaded = assertInstanceOf(
                DungeonTravelAuthoredReadResult.Loaded.class,
                fixture.reader().readExactTransitionTarget(target));

        assertEquals(fixture.transition().anchorCell(),
                loaded.surface().transition(fixture.transition().transitionId()).anchor());
        assertTrue(fixture.windows().closureRequests.size() >= 2);
        assertEquals(List.of(DungeonPatchEntityRef.transition(fixture.transition().transitionId())),
                fixture.windows().closureRequests.getFirst().entityRefs());
    }

    private static final class Fixture {
        private final DungeonMapHeader header;
        private final Transition transition;
        private final FakeCatalog catalog;
        private final FakeWindows windows;
        private final DungeonTravelAuthoredReader reader;

        private Fixture(long mapId, long revision, Cell anchor) {
            header = new DungeonMapHeader(new DungeonMapIdentity(mapId), "Travel " + mapId, revision);
            transition = new Transition(
                    301L,
                    mapId,
                    "Travel target",
                    TransitionAnchor.cell(anchor),
                    TransitionDestination.unlinkedEntrance(),
                    null);
            catalog = new FakeCatalog(header);
            windows = new FakeWindows(header, transition);
            reader = new DungeonTravelAuthoredReader(catalog, windows);
        }

        private DungeonMapHeader header() {
            return header;
        }

        private Transition transition() {
            return transition;
        }

        private FakeCatalog catalog() {
            return catalog;
        }

        private FakeWindows windows() {
            return windows;
        }

        private DungeonTravelAuthoredReader reader() {
            return reader;
        }
    }

    private static final class FakeCatalog implements DungeonCatalogStore {
        private final DungeonMapHeader header;
        private final AtomicInteger searchCalls = new AtomicInteger();

        private FakeCatalog(DungeonMapHeader header) {
            this.header = header;
        }

        @Override
        public List<DungeonMapHeader> search(String query) {
            searchCalls.incrementAndGet();
            return List.of(header);
        }

        @Override
        public DungeonMapHeader create(String mapName) {
            throw new UnsupportedOperationException();
        }

        @Override
        public DungeonMapHeader rename(DungeonMapIdentity mapId, String mapName) {
            throw new UnsupportedOperationException();
        }

        @Override
        public void delete(DungeonMapIdentity mapId) {
            throw new UnsupportedOperationException();
        }
    }

    private static final class FakeWindows implements DungeonWindowStore {
        private final DungeonMapHeader header;
        private final Transition transition;
        private final AtomicInteger locatorCalls = new AtomicInteger();
        private final List<DungeonIdentityClosureRequest> closureRequests = new ArrayList<>();
        private int staleLocatorResponses;
        private List<Integer> travelLevels;
        private DungeonWindowRequest lastWindowRequest;
        private DungeonIdentityClosureRequest lastClosureRequest;

        private FakeWindows(DungeonMapHeader header, Transition transition) {
            this.header = header;
            this.transition = transition;
            travelLevels = List.of(transition.anchorCell().level());
        }

        @Override
        public Optional<DungeonWindow> loadWindow(DungeonWindowRequest request) {
            lastWindowRequest = request;
            return Optional.of(new DungeonWindow(
                    header,
                    request.requestGeneration(),
                    List.of(),
                    List.of(new DungeonWindowEntityFragment.Transition(
                            DungeonPatchEntityRef.transition(transition.transitionId()),
                            transition.description(),
                            transition.anchor(),
                            transition.destination(),
                            transition.linkedTransitionId(),
                            List.of(request.chunkKeys().getFirst()),
                            List.of())),
                    List.of(),
                    List.of(),
                    new features.dungeon.application.authored.port.DungeonContinuationPage(
                            List.of(), java.util.Optional.empty())));
        }

        @Override
        public DungeonIdentityClosureResult loadIdentityClosure(DungeonIdentityClosureRequest request) {
            lastClosureRequest = request;
            closureRequests.add(request);
            List<DungeonEntitySnapshot> entities = request.entityRefs().stream()
                    .filter(ref -> ref.equals(DungeonPatchEntityRef.transition(transition.transitionId())))
                    .map(ignored -> (DungeonEntitySnapshot) new DungeonEntitySnapshot.TransitionSnapshot(transition))
                    .toList();
            return new DungeonIdentityClosureResult.Complete(header, entities);
        }

        @Override
        public DungeonTravelStartResult locateTravelStart(DungeonTravelStartRequest request) {
            locatorCalls.incrementAndGet();
            if (staleLocatorResponses > 0) {
                staleLocatorResponses--;
                return new DungeonTravelStartResult.Rejected(
                        DungeonIdentityClosureResult.Reason.STALE_REVISION);
            }
            return new DungeonTravelStartResult.Located(
                    header, transition.anchorCell(), transition.transitionId());
        }

        @Override
        public DungeonTravelChunkKeysResult discoverTravelChunkKeys(DungeonTravelChunkKeysRequest request) {
            List<DungeonChunkKey> keys = new ArrayList<>();
            for (int level : travelLevels) {
                for (int deltaR = -1; deltaR <= 1; deltaR++) {
                    for (int deltaQ = -1; deltaQ <= 1; deltaQ++) {
                        keys.add(new DungeonChunkKey(
                                request.mapId().value(),
                                level,
                                request.centerChunkQ() + deltaQ,
                                request.centerChunkR() + deltaR));
                    }
                }
            }
            return new DungeonTravelChunkKeysResult.Complete(header, keys);
        }
    }
}
