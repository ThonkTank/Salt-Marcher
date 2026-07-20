package features.dungeon.application.authored.port;

import features.dungeon.api.DungeonChunkKey;
import java.util.Collection;
import java.util.Optional;

/** Sparse authored read port for explicit chunk windows and exact identity closure. */
public interface DungeonWindowStore {

    Optional<DungeonWindow> loadWindow(DungeonWindowRequest request);

    default Optional<DungeonContinuationPage> loadContinuationPage(DungeonContinuationPageRequest request) {
        return Optional.empty();
    }

    /** Replaces cache protection with the latest accepted visible chunks. */
    default void protectVisibleChunks(Collection<DungeonChunkKey> chunks) {
    }

    /** Protects loaded workset chunks for the lifetime of one edit operation. */
    default Lease protectEditChunks(Collection<DungeonChunkKey> chunks) {
        return () -> { };
    }

    /** Invalidates exactly the identities touched by a successful commit. */
    default void invalidateChunks(Collection<DungeonChunkKey> chunks) {
    }

    /** Removes cached content only for the deleted map. */
    default void invalidateMap(long mapId) {
    }

    DungeonIdentityClosureResult loadIdentityClosure(DungeonIdentityClosureRequest request);

    /** Locates one deterministic sparse Travel entry without hydrating authored content. */
    default DungeonTravelStartResult locateTravelStart(DungeonTravelStartRequest request) {
        return new DungeonTravelStartResult.Rejected(
                DungeonIdentityClosureResult.Reason.INCOMPLETE_ENTITY);
    }

    /** Finds only existing chunks in the fixed horizontal Travel ring, across authored levels. */
    default DungeonTravelChunkKeysResult discoverTravelChunkKeys(DungeonTravelChunkKeysRequest request) {
        return new DungeonTravelChunkKeysResult.Rejected(
                DungeonIdentityClosureResult.Reason.INCOMPLETE_ENTITY);
    }

    /**
     * Discovers only rows that explicitly point at the requested identities.
     * Implementations must revision-bind this read and must not scan/hydrate a map.
     */
    default DungeonInboundReferenceResult discoverInboundReferences(DungeonInboundReferenceRequest request) {
        return new DungeonInboundReferenceResult.Rejected(
                DungeonIdentityClosureResult.Reason.INCOMPLETE_ENTITY,
                request == null ? java.util.List.of() : request.targetRefs());
    }

    @FunctionalInterface
    interface Lease extends AutoCloseable {
        @Override
        void close();
    }
}
