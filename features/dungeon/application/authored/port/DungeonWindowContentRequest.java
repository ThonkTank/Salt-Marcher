package features.dungeon.application.authored.port;

import features.dungeon.domain.core.structure.DungeonMapIdentity;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;

/** Exact cache-miss content request bound to map and per-chunk revisions. */
public record DungeonWindowContentRequest(
        DungeonMapIdentity mapId,
        long expectedMapRevision,
        long requestGeneration,
        List<DungeonWindowChunkHeader> chunks
) {
    public DungeonWindowContentRequest {
        mapId = Objects.requireNonNull(mapId, "mapId");
        if (expectedMapRevision < 1L || requestGeneration < 0L) {
            throw new IllegalArgumentException("content request revisions must be valid");
        }
        long requestedMapId = mapId.value();
        List<DungeonWindowChunkHeader> ordered = new ArrayList<>(chunks == null ? List.of() : chunks);
        ordered.sort(Comparator.comparing(DungeonWindowChunkHeader::key, DungeonWindowRequest.CHUNK_ORDER));
        if (ordered.isEmpty() || ordered.stream().anyMatch(chunk -> chunk.key().mapId() != requestedMapId)) {
            throw new IllegalArgumentException("content request must name chunks of the requested map");
        }
        chunks = List.copyOf(ordered);
    }
}
