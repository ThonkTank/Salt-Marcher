package features.dungeon.application.authored.port;

import features.dungeon.api.DungeonChunkKey;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;

/** Existing chunk keys in one fixed horizontal Travel ring, or a typed revision failure. */
public sealed interface DungeonTravelChunkKeysResult permits DungeonTravelChunkKeysResult.Complete,
        DungeonTravelChunkKeysResult.Rejected {

    record Complete(
            DungeonMapHeader mapHeader,
            List<DungeonChunkKey> chunkKeys
    ) implements DungeonTravelChunkKeysResult {
        public Complete {
            DungeonMapHeader safeHeader = Objects.requireNonNull(mapHeader, "mapHeader");
            List<DungeonChunkKey> ordered = new ArrayList<>(new LinkedHashSet<>(
                    chunkKeys == null ? List.of() : chunkKeys));
            if (ordered.stream().anyMatch(key -> key == null
                    || key.mapId() != safeHeader.mapId().value())) {
                throw new IllegalArgumentException("every chunk key must identify the result map");
            }
            ordered.sort(DungeonWindowRequest.CHUNK_ORDER);
            mapHeader = safeHeader;
            chunkKeys = List.copyOf(ordered);
        }
    }

    record Rejected(DungeonIdentityClosureResult.Reason reason) implements DungeonTravelChunkKeysResult {
        public Rejected {
            reason = Objects.requireNonNull(reason, "reason");
        }
    }
}
