package features.dungeon.application.authored.port;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;

/** Revision-bound metadata for exactly the requested sparse chunks. */
public record DungeonWindowIndex(
        DungeonMapHeader mapHeader,
        long requestGeneration,
        List<DungeonWindowChunkHeader> chunkHeaders,
        List<DungeonAuthoredLevelBounds> authoredBounds,
        DungeonContinuationPage continuationPage
) {
    public DungeonWindowIndex(
            DungeonMapHeader mapHeader,
            long requestGeneration,
            List<DungeonWindowChunkHeader> chunkHeaders
    ) {
        this(mapHeader, requestGeneration, chunkHeaders, List.of(), DungeonContinuationPage.empty());
    }

    public DungeonWindowIndex {
        mapHeader = Objects.requireNonNull(mapHeader, "mapHeader");
        if (requestGeneration < 0L) {
            throw new IllegalArgumentException("requestGeneration must not be negative");
        }
        List<DungeonWindowChunkHeader> ordered = new ArrayList<>(
                chunkHeaders == null ? List.of() : chunkHeaders);
        ordered.sort(Comparator.comparing(DungeonWindowChunkHeader::key, DungeonWindowRequest.CHUNK_ORDER));
        chunkHeaders = List.copyOf(ordered);
        List<DungeonAuthoredLevelBounds> orderedBounds = new ArrayList<>(
                authoredBounds == null ? List.of() : authoredBounds);
        orderedBounds.sort(Comparator.comparingInt(DungeonAuthoredLevelBounds::level));
        authoredBounds = List.copyOf(orderedBounds);
        continuationPage = continuationPage == null ? DungeonContinuationPage.empty() : continuationPage;
    }
}
