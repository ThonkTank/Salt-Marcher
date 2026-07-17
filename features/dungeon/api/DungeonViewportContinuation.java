package features.dungeon.api;

/** Stable identity evidence that authored topology continues beyond the loaded workset. */
public record DungeonViewportContinuation(
        String ownerKind,
        long ownerId,
        DungeonTopologyElementRef topologyRef,
        DungeonChunkKey offWindowChunk
) {
    public DungeonViewportContinuation {
        ownerKind = ownerKind == null || ownerKind.isBlank() ? "ELEMENT" : ownerKind.trim();
        ownerId = Math.max(1L, ownerId);
        topologyRef = topologyRef == null ? DungeonTopologyElementRef.empty() : topologyRef;
        if (offWindowChunk == null) {
            throw new IllegalArgumentException("offWindowChunk must not be null");
        }
    }
}
