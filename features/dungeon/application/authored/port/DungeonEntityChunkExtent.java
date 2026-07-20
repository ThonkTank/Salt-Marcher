package features.dungeon.application.authored.port;

import features.dungeon.api.DungeonChunkKey;
import features.dungeon.application.authored.command.DungeonPatchEntityRef;
import java.util.Objects;

/** Exact cell extent contributed by one stable entity inside one spatial chunk. */
public record DungeonEntityChunkExtent(
        DungeonPatchEntityRef entityRef,
        DungeonChunkKey chunk,
        int minimumQ,
        int minimumR,
        int maximumQ,
        int maximumR,
        int entityChunkCount
) {
    public DungeonEntityChunkExtent {
        entityRef = Objects.requireNonNull(entityRef, "entityRef");
        chunk = Objects.requireNonNull(chunk, "chunk");
        if (maximumQ < minimumQ || maximumR < minimumR || entityChunkCount < 1
                || minimumQ < chunk.minimumQ() || maximumQ > chunk.maximumQ()
                || minimumR < chunk.minimumR() || maximumR > chunk.maximumR()) {
            throw new IllegalArgumentException("entity extent must be non-empty and contained by its chunk");
        }
    }
}
