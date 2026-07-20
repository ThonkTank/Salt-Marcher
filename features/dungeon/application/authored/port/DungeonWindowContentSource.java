package features.dungeon.application.authored.port;

import java.util.Optional;

/** Two-phase sparse source used beneath the feature-lifetime window cache. */
public interface DungeonWindowContentSource {
    Optional<DungeonWindowIndex> loadIndex(DungeonWindowRequest request);

    /** Returns empty when map or any expected revision changed between index and content reads. */
    Optional<DungeonWindow> loadContent(DungeonWindowContentRequest request);

    default Optional<DungeonContinuationPage> loadContinuationPage(DungeonContinuationPageRequest request) {
        return Optional.empty();
    }

    DungeonIdentityClosureResult loadIdentityClosure(DungeonIdentityClosureRequest request);

    DungeonTravelStartResult locateTravelStart(DungeonTravelStartRequest request);

    DungeonTravelChunkKeysResult discoverTravelChunkKeys(DungeonTravelChunkKeysRequest request);

    DungeonInboundReferenceResult discoverInboundReferences(DungeonInboundReferenceRequest request);
}
