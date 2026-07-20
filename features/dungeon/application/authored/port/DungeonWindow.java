package features.dungeon.application.authored.port;

import features.dungeon.application.authored.command.DungeonPatchEntityRef;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;

/** Immutable sparse authored readback for one explicit chunk request. */
public record DungeonWindow(
        DungeonMapHeader mapHeader,
        long requestGeneration,
        List<DungeonWindowChunkHeader> chunkHeaders,
        List<DungeonWindowEntityFragment> fragments,
        List<DungeonEntityChunkExtent> entityExtents,
        List<DungeonAuthoredLevelBounds> authoredBounds,
        DungeonContinuationPage continuationPage
) {
    public static final Comparator<DungeonPatchEntityRef> ENTITY_ORDER = Comparator
            .comparing(DungeonPatchEntityRef::kind)
            .thenComparingLong(DungeonPatchEntityRef::id);

    public DungeonWindow(
            DungeonMapHeader mapHeader,
            long requestGeneration,
            List<DungeonWindowChunkHeader> chunkHeaders,
            List<DungeonWindowEntityFragment> fragments,
            List<DungeonWindowContinuation> continuations
    ) {
        this(mapHeader, requestGeneration, chunkHeaders, fragments, List.of(), List.of(),
                new DungeonContinuationPage(continuations, java.util.Optional.empty()));
    }

    public DungeonWindow {
        mapHeader = Objects.requireNonNull(mapHeader, "mapHeader");
        if (requestGeneration < 0L) {
            throw new IllegalArgumentException("requestGeneration must not be negative");
        }
        List<DungeonWindowChunkHeader> orderedHeaders = new ArrayList<>(
                chunkHeaders == null ? List.of() : chunkHeaders);
        orderedHeaders.sort(Comparator.comparing(DungeonWindowChunkHeader::key, DungeonWindowRequest.CHUNK_ORDER));
        chunkHeaders = List.copyOf(orderedHeaders);

        List<DungeonWindowEntityFragment> orderedFragments = new ArrayList<>(
                fragments == null ? List.of() : fragments);
        orderedFragments.sort(Comparator.comparing(
                DungeonWindowEntityFragment::entityRef, ENTITY_ORDER));
        fragments = List.copyOf(orderedFragments);

        List<DungeonEntityChunkExtent> orderedExtents = new ArrayList<>(
                entityExtents == null ? List.of() : entityExtents);
        orderedExtents.sort(Comparator.comparing(DungeonEntityChunkExtent::entityRef, ENTITY_ORDER)
                .thenComparing(DungeonEntityChunkExtent::chunk, DungeonWindowRequest.CHUNK_ORDER));
        entityExtents = List.copyOf(orderedExtents);
        List<DungeonAuthoredLevelBounds> orderedBounds = new ArrayList<>(
                authoredBounds == null ? List.of() : authoredBounds);
        orderedBounds.sort(Comparator.comparingInt(DungeonAuthoredLevelBounds::level));
        authoredBounds = List.copyOf(orderedBounds);
        continuationPage = continuationPage == null ? DungeonContinuationPage.empty() : continuationPage;
    }

    /** Compatibility projection for consumers that only need the current typed page entries. */
    public List<DungeonWindowContinuation> continuations() {
        return continuationPage.entries();
    }
}
