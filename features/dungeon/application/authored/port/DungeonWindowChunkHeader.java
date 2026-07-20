package features.dungeon.application.authored.port;

import features.dungeon.api.DungeonChunkKey;
import java.util.Objects;

/** Stable header for one explicitly requested chunk; revision zero means known empty. */
public record DungeonWindowChunkHeader(DungeonChunkKey key, long contentRevision) {
    public DungeonWindowChunkHeader {
        key = Objects.requireNonNull(key, "key");
        if (contentRevision < 0L) {
            throw new IllegalArgumentException("contentRevision must not be negative");
        }
    }
}
