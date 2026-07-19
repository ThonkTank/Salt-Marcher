package features.dungeon.application.authored.port;

import features.dungeon.domain.core.structure.DungeonMapIdentity;
import java.util.Objects;

/** Revision-bound lookup for the fixed horizontal Travel chunk ring on every authored level. */
public record DungeonTravelChunkKeysRequest(
        DungeonMapIdentity mapId,
        long expectedMapRevision,
        int centerChunkQ,
        int centerChunkR
) {
    public DungeonTravelChunkKeysRequest {
        mapId = Objects.requireNonNull(mapId, "mapId");
        if (expectedMapRevision < 1L) {
            throw new IllegalArgumentException("expectedMapRevision must be positive");
        }
    }
}
