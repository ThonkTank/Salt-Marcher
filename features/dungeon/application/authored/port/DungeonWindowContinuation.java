package features.dungeon.application.authored.port;

import features.dungeon.application.authored.command.DungeonPatchEntityRef;
import features.dungeon.api.DungeonChunkKey;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;

/** Stable off-window chunk references for one entity returned in a window. */
public record DungeonWindowContinuation(
        DungeonPatchEntityRef entityRef,
        List<DungeonChunkKey> offWindowChunks
) {
    public DungeonWindowContinuation {
        entityRef = Objects.requireNonNull(entityRef, "entityRef");
        List<DungeonChunkKey> ordered = new ArrayList<>(new LinkedHashSet<>(
                offWindowChunks == null ? List.of() : offWindowChunks));
        ordered.sort(DungeonWindowRequest.CHUNK_ORDER);
        if (ordered.isEmpty()) {
            throw new IllegalArgumentException("a continuation must name off-window chunks");
        }
        offWindowChunks = List.copyOf(ordered);
    }
}
