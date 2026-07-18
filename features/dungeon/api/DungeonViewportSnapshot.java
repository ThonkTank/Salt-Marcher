package features.dungeon.api;

import java.util.List;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

/** Immutable authored facts for the currently loaded sparse-map workset. */
public record DungeonViewportSnapshot(
        long mapId,
        long mapRevision,
        long requestGeneration,
        int level,
        DungeonTopologyKind topology,
        Set<DungeonChunkKey> loadedChunks,
        Map<DungeonChunkKey, Long> chunkRevisions,
        List<DungeonAreaSnapshot> areas,
        List<DungeonBoundarySnapshot> boundaries,
        List<DungeonFeatureSnapshot> features,
        List<DungeonEditorHandleSnapshot> editorHandles,
        List<DungeonViewportContinuation> continuations,
        AuthoredBounds authoredBounds
) {
    public DungeonViewportSnapshot {
        if (mapId <= 0L) {
            throw new IllegalArgumentException("mapId must be positive");
        }
        mapRevision = Math.max(0L, mapRevision);
        requestGeneration = Math.max(0L, requestGeneration);
        topology = topology == null ? DungeonTopologyKind.SQUARE : topology;
        loadedChunks = loadedChunks == null
                ? Set.of()
                : Collections.unmodifiableSet(new LinkedHashSet<>(loadedChunks));
        chunkRevisions = chunkRevisions == null
                ? Map.of()
                : Collections.unmodifiableMap(new LinkedHashMap<>(chunkRevisions));
        areas = areas == null ? List.of() : List.copyOf(areas);
        boundaries = boundaries == null ? List.of() : List.copyOf(boundaries);
        features = features == null ? List.of() : List.copyOf(features);
        editorHandles = editorHandles == null ? List.of() : List.copyOf(editorHandles);
        continuations = continuations == null ? List.of() : List.copyOf(continuations);
        authoredBounds = authoredBounds == null ? AuthoredBounds.empty() : authoredBounds;
    }

    public record AuthoredBounds(boolean present, int minimumQ, int minimumR, int maximumQ, int maximumR) {
        public AuthoredBounds {
            present = present && maximumQ >= minimumQ && maximumR >= minimumR;
        }

        public static AuthoredBounds empty() {
            return new AuthoredBounds(false, 0, 0, 0, 0);
        }
    }
}
