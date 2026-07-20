package features.dungeon.application.authored.port;

import features.dungeon.api.DungeonChunkKey;
import features.dungeon.domain.core.structure.DungeonMapIdentity;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

/** One generation-bound request for an exact, possibly non-rectangular chunk set. */
public record DungeonWindowRequest(
        DungeonMapIdentity mapId,
        long requestGeneration,
        List<DungeonChunkKey> chunkKeys
) {
    public static final Comparator<DungeonChunkKey> CHUNK_ORDER = Comparator
            .comparingInt(DungeonChunkKey::level)
            .thenComparingInt(DungeonChunkKey::chunkR)
            .thenComparingInt(DungeonChunkKey::chunkQ);

    public DungeonWindowRequest {
        mapId = Objects.requireNonNull(mapId, "mapId");
        if (requestGeneration < 0L) {
            throw new IllegalArgumentException("requestGeneration must not be negative");
        }
        Set<DungeonChunkKey> unique = new LinkedHashSet<>();
        for (DungeonChunkKey key : chunkKeys == null ? List.<DungeonChunkKey>of() : chunkKeys) {
            if (key == null || key.mapId() != mapId.value()) {
                throw new IllegalArgumentException("every chunk key must identify the requested map");
            }
            unique.add(key);
        }
        List<DungeonChunkKey> ordered = new ArrayList<>(unique);
        ordered.sort(CHUNK_ORDER);
        chunkKeys = List.copyOf(ordered);
    }
}
