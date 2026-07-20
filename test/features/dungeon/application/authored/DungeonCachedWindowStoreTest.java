package features.dungeon.application.authored;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import features.dungeon.api.DungeonChunkKey;
import features.dungeon.application.authored.port.DungeonIdentityClosureRequest;
import features.dungeon.application.authored.port.DungeonIdentityClosureResult;
import features.dungeon.application.authored.port.DungeonInboundReferenceRequest;
import features.dungeon.application.authored.port.DungeonInboundReferenceResult;
import features.dungeon.application.authored.port.DungeonMapHeader;
import features.dungeon.application.authored.port.DungeonTravelChunkKeysRequest;
import features.dungeon.application.authored.port.DungeonTravelChunkKeysResult;
import features.dungeon.application.authored.port.DungeonTravelStartRequest;
import features.dungeon.application.authored.port.DungeonTravelStartResult;
import features.dungeon.application.authored.port.DungeonWindow;
import features.dungeon.application.authored.port.DungeonWindowChunkHeader;
import features.dungeon.application.authored.port.DungeonWindowContentRequest;
import features.dungeon.application.authored.port.DungeonWindowContentSource;
import features.dungeon.application.authored.port.DungeonWindowIndex;
import features.dungeon.application.authored.port.DungeonWindowRequest;
import features.dungeon.domain.core.structure.DungeonMapIdentity;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;

final class DungeonCachedWindowStoreTest {
    private static final DungeonMapIdentity MAP_ID = new DungeonMapIdentity(7L);

    @Test
    void coldWarmPanAndTouchedInvalidationLoadOnlyRequiredChunkContents() {
        CountingSource source = new CountingSource();
        DungeonCachedWindowStore store = new DungeonCachedWindowStore(source);
        List<DungeonChunkKey> nine = square(-1, -1, 3);

        assertTrue(store.loadWindow(new DungeonWindowRequest(MAP_ID, 1L, nine)).isPresent());
        assertEquals(9, source.contentReads);

        assertTrue(store.loadWindow(new DungeonWindowRequest(MAP_ID, 2L, nine)).isPresent());
        assertEquals(9, source.contentReads, "map request generations do not fragment the content cache");

        List<DungeonChunkKey> panned = new ArrayList<>(nine);
        panned.remove(0);
        panned.add(chunk(9, -4));
        assertTrue(store.loadWindow(new DungeonWindowRequest(MAP_ID, 3L, panned)).isPresent());
        assertEquals(10, source.contentReads, "only the entering chunk is a miss");

        DungeonChunkKey touched = panned.get(4);
        source.revisions.put(touched, 2L);
        store.invalidateChunks(List.of(touched));
        assertTrue(store.loadWindow(new DungeonWindowRequest(MAP_ID, 4L, panned)).isPresent());
        assertEquals(11, source.contentReads, "a successful touch reloads only the touched chunk");
    }

    @Test
    void negativeChunksAndStaleTwoPhaseReadNeverPublishMixedContent() {
        CountingSource source = new CountingSource();
        DungeonCachedWindowStore store = new DungeonCachedWindowStore(source);
        DungeonChunkKey negative = chunk(-12, -8);
        source.changeRevisionDuringNextContent = negative;

        assertTrue(store.loadWindow(new DungeonWindowRequest(MAP_ID, 1L, List.of(negative))).isEmpty());
        assertEquals(1, source.contentReads);

        assertTrue(store.loadWindow(new DungeonWindowRequest(MAP_ID, 2L, List.of(negative))).isPresent());
        assertEquals(2, source.contentReads, "stale content was not inserted into the cache");
        assertEquals(negative, store.loadWindow(new DungeonWindowRequest(MAP_ID, 3L, List.of(negative)))
                .orElseThrow().chunkHeaders().get(0).key());
        assertEquals(2, source.contentReads);
    }

    private static List<DungeonChunkKey> square(int minimumQ, int minimumR, int side) {
        List<DungeonChunkKey> result = new ArrayList<>();
        for (int r = minimumR; r < minimumR + side; r++) {
            for (int q = minimumQ; q < minimumQ + side; q++) {
                result.add(chunk(q, r));
            }
        }
        return List.copyOf(result);
    }

    private static DungeonChunkKey chunk(int q, int r) {
        return new DungeonChunkKey(MAP_ID.value(), 0, q, r);
    }

    private static final class CountingSource implements DungeonWindowContentSource {
        private final Map<DungeonChunkKey, Long> revisions = new LinkedHashMap<>();
        private int contentReads;
        private DungeonChunkKey changeRevisionDuringNextContent;

        @Override
        public Optional<DungeonWindowIndex> loadIndex(DungeonWindowRequest request) {
            return Optional.of(new DungeonWindowIndex(
                    header(), request.requestGeneration(), request.chunkKeys().stream()
                            .map(key -> new DungeonWindowChunkHeader(key, revisions.getOrDefault(key, 1L)))
                            .toList()));
        }

        @Override
        public Optional<DungeonWindow> loadContent(DungeonWindowContentRequest request) {
            contentReads++;
            DungeonWindowChunkHeader expected = request.chunks().get(0);
            if (changeRevisionDuringNextContent != null
                    && changeRevisionDuringNextContent.equals(expected.key())) {
                revisions.put(expected.key(), expected.contentRevision() + 1L);
                changeRevisionDuringNextContent = null;
                return Optional.empty();
            }
            if (request.expectedMapRevision() != 1L
                    || expected.contentRevision() != revisions.getOrDefault(expected.key(), 1L)) {
                return Optional.empty();
            }
            return Optional.of(new DungeonWindow(
                    header(), request.requestGeneration(), request.chunks(), List.of(), List.of(), List.of(),
                    features.dungeon.application.authored.port.DungeonContinuationPage.empty()));
        }

        private static DungeonMapHeader header() {
            return new DungeonMapHeader(MAP_ID, "Cached", 1L);
        }

        @Override
        public DungeonIdentityClosureResult loadIdentityClosure(DungeonIdentityClosureRequest request) {
            return new DungeonIdentityClosureResult.Rejected(
                    DungeonIdentityClosureResult.Reason.ENTITY_MISSING, request.entityRefs());
        }

        @Override
        public DungeonTravelStartResult locateTravelStart(DungeonTravelStartRequest request) {
            return new DungeonTravelStartResult.Rejected(DungeonIdentityClosureResult.Reason.ENTITY_MISSING);
        }

        @Override
        public DungeonTravelChunkKeysResult discoverTravelChunkKeys(DungeonTravelChunkKeysRequest request) {
            return new DungeonTravelChunkKeysResult.Rejected(DungeonIdentityClosureResult.Reason.ENTITY_MISSING);
        }

        @Override
        public DungeonInboundReferenceResult discoverInboundReferences(DungeonInboundReferenceRequest request) {
            return new DungeonInboundReferenceResult.Rejected(
                    DungeonIdentityClosureResult.Reason.ENTITY_MISSING, request.targetRefs());
        }
    }
}
