package features.dungeon.api;

import java.util.List;

/** Exclusive public cursor bound to one accepted viewport identity. */
public record DungeonViewportContinuationCursor(
        long mapId,
        long mapRevision,
        long requestGeneration,
        List<DungeonChunkKey> requestedChunks,
        String ownerKind,
        long ownerId,
        DungeonChunkKey offWindowChunk
) {
    public DungeonViewportContinuationCursor {
        if (mapId < 1L || mapRevision < 1L || requestGeneration < 0L
                || ownerKind == null || ownerKind.isBlank() || ownerId < 1L
                || offWindowChunk == null || offWindowChunk.mapId() != mapId) {
            throw new IllegalArgumentException("viewport continuation cursor must be complete");
        }
        requestedChunks = requestedChunks == null ? List.of() : List.copyOf(requestedChunks);
        ownerKind = ownerKind.trim();
    }
}
