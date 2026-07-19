package features.dungeon.application.authored.port;

import features.dungeon.api.DungeonChunkKey;
import features.dungeon.application.authored.command.DungeonPatchEntityRef;
import features.dungeon.domain.core.structure.DungeonMapIdentity;
import java.util.List;
import java.util.Objects;

/** Exclusive continuation cursor bound to the exact immutable window request. */
public record DungeonContinuationCursor(
        DungeonMapIdentity mapId,
        long expectedMapRevision,
        long requestGeneration,
        List<DungeonChunkKey> requestedChunks,
        DungeonPatchEntityRef entityRef,
        DungeonChunkKey offWindowChunk
) {
    public DungeonContinuationCursor {
        mapId = Objects.requireNonNull(mapId, "mapId");
        if (expectedMapRevision < 1L || requestGeneration < 0L) {
            throw new IllegalArgumentException("cursor revisions must be valid");
        }
        requestedChunks = new DungeonWindowRequest(mapId, requestGeneration, requestedChunks).chunkKeys();
        entityRef = Objects.requireNonNull(entityRef, "entityRef");
        offWindowChunk = Objects.requireNonNull(offWindowChunk, "offWindowChunk");
        if (offWindowChunk.mapId() != mapId.value()) {
            throw new IllegalArgumentException("cursor chunk must identify the requested map");
        }
    }
}
