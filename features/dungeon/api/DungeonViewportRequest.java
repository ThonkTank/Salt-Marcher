package features.dungeon.api;

import java.util.LinkedHashSet;
import java.util.Collections;
import java.util.Set;

/** One sparse authored-map window plus its prefetch ring. */
public record DungeonViewportRequest(
        long mapId,
        long requestGeneration,
        int level,
        int minimumQ,
        int minimumR,
        int maximumQ,
        int maximumR
) {
    public DungeonViewportRequest {
        if (mapId <= 0L) {
            throw new IllegalArgumentException("mapId must be positive");
        }
        requestGeneration = Math.max(0L, requestGeneration);
        if (maximumQ < minimumQ || maximumR < minimumR) {
            throw new IllegalArgumentException("viewport bounds must be ordered");
        }
    }

    public Set<DungeonChunkKey> visibleChunks() {
        return chunks(0);
    }

    public Set<DungeonChunkKey> loadingChunks() {
        return chunks(1);
    }

    public boolean contains(DungeonCellRef cell) {
        return cell != null
                && cell.level() == level
                && cell.q() >= minimumQ && cell.q() <= maximumQ
                && cell.r() >= minimumR && cell.r() <= maximumR;
    }

    private Set<DungeonChunkKey> chunks(int ring) {
        int minimumChunkQ = Math.floorDiv(minimumQ, DungeonChunkKey.CHUNK_SIZE) - ring;
        int minimumChunkR = Math.floorDiv(minimumR, DungeonChunkKey.CHUNK_SIZE) - ring;
        int maximumChunkQ = Math.floorDiv(maximumQ, DungeonChunkKey.CHUNK_SIZE) + ring;
        int maximumChunkR = Math.floorDiv(maximumR, DungeonChunkKey.CHUNK_SIZE) + ring;
        Set<DungeonChunkKey> chunks = new LinkedHashSet<>();
        for (int chunkR = minimumChunkR; chunkR <= maximumChunkR; chunkR++) {
            for (int chunkQ = minimumChunkQ; chunkQ <= maximumChunkQ; chunkQ++) {
                chunks.add(new DungeonChunkKey(mapId, level, chunkQ, chunkR));
            }
        }
        return Collections.unmodifiableSet(chunks);
    }
}
