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
        List<DungeonWindowContinuation> continuations
) {
    public static final Comparator<DungeonPatchEntityRef> ENTITY_ORDER = Comparator
            .comparing(DungeonPatchEntityRef::kind)
            .thenComparingLong(DungeonPatchEntityRef::id);

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

        List<DungeonWindowContinuation> orderedContinuations = new ArrayList<>(
                continuations == null ? List.of() : continuations);
        orderedContinuations.sort(Comparator.comparing(DungeonWindowContinuation::entityRef, ENTITY_ORDER));
        continuations = List.copyOf(orderedContinuations);
    }
}
