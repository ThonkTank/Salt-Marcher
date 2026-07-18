package features.dungeon.application.authored.port;

import features.dungeon.api.DungeonChunkKey;
import features.dungeon.application.authored.command.DungeonPatchResultFacts;
import features.dungeon.domain.core.structure.DungeonMapIdentity;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/** One committed patch result or a typed pre-commit rejection. */
public sealed interface DungeonUnitOfWorkResult permits DungeonUnitOfWorkResult.Committed,
        DungeonUnitOfWorkResult.Rejected {

    record Committed(
            DungeonMapIdentity mapId,
            long committedRevision,
            Map<DungeonChunkKey, Long> chunkRevisions,
            DungeonPatchResultFacts resultFacts
    ) implements DungeonUnitOfWorkResult {
        public Committed {
            mapId = Objects.requireNonNull(mapId, "mapId");
            if (committedRevision < 1L) {
                throw new IllegalArgumentException("committedRevision must be positive");
            }
            List<Map.Entry<DungeonChunkKey, Long>> ordered = new ArrayList<>(
                    chunkRevisions == null ? Map.<DungeonChunkKey, Long>of().entrySet() : chunkRevisions.entrySet());
            ordered.sort(Map.Entry.comparingByKey(DungeonWindowRequest.CHUNK_ORDER));
            Map<DungeonChunkKey, Long> revisions = new LinkedHashMap<>();
            for (Map.Entry<DungeonChunkKey, Long> entry : ordered) {
                DungeonChunkKey key = Objects.requireNonNull(entry.getKey(), "chunk revision key");
                Long revision = Objects.requireNonNull(entry.getValue(), "chunk revision");
                if (key.mapId() != mapId.value() || revision < 0L) {
                    throw new IllegalArgumentException("chunk revisions must belong to the committed map");
                }
                revisions.put(key, revision);
            }
            chunkRevisions = Collections.unmodifiableMap(revisions);
            resultFacts = Objects.requireNonNull(resultFacts, "resultFacts");
        }

        @Override
        public Map<DungeonChunkKey, Long> chunkRevisions() {
            return chunkRevisions;
        }
    }

    record Rejected(Reason reason) implements DungeonUnitOfWorkResult {
        public Rejected {
            reason = Objects.requireNonNull(reason, "reason");
        }
    }

    enum Reason {
        MAP_NOT_FOUND,
        STALE_REVISION
    }
}
