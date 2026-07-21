package features.dungeon.application.authored;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertTrue;

import features.dungeon.api.DungeonChunkKey;
import features.dungeon.application.authored.command.DungeonPatchEntityRef;
import features.dungeon.application.authored.port.DungeonCatalogStore;
import features.dungeon.application.authored.port.DungeonEntitySnapshot;
import features.dungeon.application.authored.port.DungeonIdentityClosureRequest;
import features.dungeon.application.authored.port.DungeonIdentityClosureResult;
import features.dungeon.application.authored.port.DungeonInboundReferenceRequest;
import features.dungeon.application.authored.port.DungeonInboundReferenceResult;
import features.dungeon.application.authored.port.DungeonMapHeader;
import features.dungeon.application.authored.port.DungeonWindow;
import features.dungeon.application.authored.port.DungeonWindowChunkHeader;
import features.dungeon.application.authored.port.DungeonWindowRequest;
import features.dungeon.application.authored.port.DungeonWindowStore;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.structure.DungeonMapIdentity;
import features.dungeon.domain.core.structure.feature.FeatureMarker;
import features.dungeon.domain.core.structure.feature.FeatureMarkerKind;
import features.dungeon.domain.core.structure.transition.Transition;
import features.dungeon.domain.core.structure.transition.TransitionAnchor;
import features.dungeon.domain.core.structure.transition.TransitionDestination;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;

final class DungeonCommandWorksetLoaderTest {
    private static final DungeonMapIdentity MAP = new DungeonMapIdentity(7L);
    private static final DungeonMapHeader HEADER = new DungeonMapHeader(MAP, "Workset", 4L);
    private static final DungeonPatchEntityRef MARKER = DungeonPatchEntityRef.featureMarker(11L);
    private static final DungeonPatchEntityRef TRANSITION = DungeonPatchEntityRef.transition(12L);
    private static final DungeonChunkKey CHUNK = new DungeonChunkKey(MAP.value(), 0, 0, 0);

    @Test
    void expandsOutboundAndInboundRefsToACompleteMarkedWorkset() {
        FakeWindowStore windows = new FakeWindowStore();
        DungeonCommandReadSpec spec = new DungeonCommandReadSpec(
                MAP,
                HEADER.revision(),
                List.of(CHUNK),
                List.of(MARKER),
                DungeonCommandReadSpec.DependencyExpansion.OUTBOUND_AND_INBOUND,
                9L,
                DungeonCommandReadSpec.CommandIntent.AUTHORED_MUTATION);

        DungeonCommandWorksetResult.Complete complete = assertInstanceOf(
                DungeonCommandWorksetResult.Complete.class,
                new DungeonCommandWorksetLoader(new HeaderCatalog(HEADER), windows).load(spec));

        assertTrue(complete.workset().containsComplete(spec));
        assertEquals(HEADER.revision(), complete.workset().aggregateFor(spec).revision());
        assertEquals(List.of(MARKER, TRANSITION),
                complete.workset().entities().stream().map(DungeonEntitySnapshot::ref).toList());
        assertEquals(List.of(List.of(MARKER), List.of(TRANSITION)), windows.closureRounds);
    }

    @Test
    void rejectsStaleCatalogBeforeReadingWindowOrClosure() {
        FakeWindowStore windows = new FakeWindowStore();
        DungeonCommandReadSpec spec = new DungeonCommandReadSpec(
                MAP,
                3L,
                List.of(CHUNK),
                List.of(MARKER),
                DungeonCommandReadSpec.DependencyExpansion.OUTBOUND,
                1L,
                DungeonCommandReadSpec.CommandIntent.HISTORY);

        DungeonCommandWorksetResult.Rejected rejected = assertInstanceOf(
                DungeonCommandWorksetResult.Rejected.class,
                new DungeonCommandWorksetLoader(new HeaderCatalog(HEADER), windows).load(spec));

        assertEquals(DungeonCommandWorksetResult.Reason.STALE_REVISION, rejected.reason());
        assertEquals(0, windows.readCount);
    }

    private static final class FakeWindowStore implements DungeonWindowStore {
        private final List<List<DungeonPatchEntityRef>> closureRounds = new ArrayList<>();
        private int readCount;

        @Override
        public Optional<DungeonWindow> loadWindow(DungeonWindowRequest request) {
            readCount++;
            return Optional.of(new DungeonWindow(
                    HEADER,
                    request.requestGeneration(),
                    List.of(new DungeonWindowChunkHeader(CHUNK, 4L)),
                    List.of(),
                    List.of(),
                    List.of(),
                    features.dungeon.application.authored.port.DungeonContinuationPage.empty()));
        }

        @Override
        public DungeonIdentityClosureResult loadIdentityClosure(DungeonIdentityClosureRequest request) {
            readCount++;
            closureRounds.add(request.entityRefs());
            List<DungeonEntitySnapshot> snapshots = request.entityRefs().stream().map(ref -> {
                if (ref.equals(MARKER)) {
                    return (DungeonEntitySnapshot) new DungeonEntitySnapshot.FeatureMarkerSnapshot(
                            new FeatureMarker(
                                    MARKER.id(), MAP, FeatureMarkerKind.POI, new Cell(1, 1, 0), "Marker", ""));
                }
                return new DungeonEntitySnapshot.TransitionSnapshot(new Transition(
                        TRANSITION.id(), MAP.value(), "Target", TransitionAnchor.cell(new Cell(2, 1, 0)),
                        TransitionDestination.unlinkedEntrance(), null));
            }).toList();
            return new DungeonIdentityClosureResult.Complete(HEADER, snapshots);
        }

        @Override
        public DungeonInboundReferenceResult discoverInboundReferences(DungeonInboundReferenceRequest request) {
            readCount++;
            return new DungeonInboundReferenceResult.Complete(
                    HEADER,
                    request.targetRefs().contains(MARKER) && !request.targetRefs().contains(TRANSITION)
                            ? List.of(TRANSITION)
                            : List.of());
        }
    }

    private record HeaderCatalog(DungeonMapHeader header) implements DungeonCatalogStore {
        @Override public List<DungeonMapHeader> search(String query) { return List.of(header); }
        @Override public DungeonMapHeader create(String mapName) { throw new UnsupportedOperationException(); }
        @Override public DungeonMapHeader rename(DungeonMapIdentity mapId, String mapName) {
            throw new UnsupportedOperationException();
        }
        @Override public void delete(DungeonMapIdentity mapId) { throw new UnsupportedOperationException(); }
    }
}
