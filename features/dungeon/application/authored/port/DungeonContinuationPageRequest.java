package features.dungeon.application.authored.port;

import features.dungeon.api.DungeonChunkKey;
import features.dungeon.domain.core.structure.DungeonMapIdentity;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

/** One revision- and generation-bound continuation page request. */
public record DungeonContinuationPageRequest(
        DungeonMapIdentity mapId,
        long expectedMapRevision,
        long requestGeneration,
        List<DungeonChunkKey> requestedChunks,
        Optional<DungeonContinuationCursor> after
) {
    public static final int PAGE_SIZE = 256;

    public DungeonContinuationPageRequest {
        mapId = Objects.requireNonNull(mapId, "mapId");
        if (expectedMapRevision < 1L || requestGeneration < 0L) {
            throw new IllegalArgumentException("page request revisions must be valid");
        }
        requestedChunks = new DungeonWindowRequest(mapId, requestGeneration, requestedChunks).chunkKeys();
        after = after == null ? Optional.empty() : after;
        if (after.isPresent()) {
            DungeonContinuationCursor cursor = after.get();
            if (!mapId.equals(cursor.mapId())
                    || expectedMapRevision != cursor.expectedMapRevision()
                    || requestGeneration != cursor.requestGeneration()
                    || !requestedChunks.equals(cursor.requestedChunks())) {
                throw new IllegalArgumentException("continuation cursor does not belong to this request");
            }
        }
    }
}
