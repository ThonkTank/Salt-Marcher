package features.dungeon.application.authored;

import features.dungeon.api.DungeonChunkKey;
import features.dungeon.application.authored.command.DungeonPatchEntityRef;
import features.dungeon.application.authored.port.DungeonWindow;
import features.dungeon.application.authored.port.DungeonWindowRequest;
import features.dungeon.domain.core.structure.DungeonMapIdentity;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;

/** Exact revision-bound authored facts required to plan one command. */
public record DungeonCommandReadSpec(
        DungeonMapIdentity mapId,
        long expectedRevision,
        List<DungeonChunkKey> chunkKeys,
        List<DungeonPatchEntityRef> seedRefs,
        DependencyExpansion dependencyExpansion,
        long requestGeneration,
        CommandIntent intent
) {
    public DungeonCommandReadSpec {
        mapId = Objects.requireNonNull(mapId, "mapId");
        if (expectedRevision < 1L) {
            throw new IllegalArgumentException("expectedRevision must be positive");
        }
        if (requestGeneration < 0L) {
            throw new IllegalArgumentException("requestGeneration must not be negative");
        }
        long requestedMapId = mapId.value();
        List<DungeonChunkKey> orderedChunks = new ArrayList<>(new LinkedHashSet<>(
                chunkKeys == null ? List.of() : chunkKeys));
        if (orderedChunks.stream().anyMatch(key -> key == null || key.mapId() != requestedMapId)) {
            throw new IllegalArgumentException("every command chunk must identify the requested map");
        }
        orderedChunks.sort(DungeonWindowRequest.CHUNK_ORDER);
        chunkKeys = List.copyOf(orderedChunks);

        List<DungeonPatchEntityRef> orderedRefs = new ArrayList<>(new LinkedHashSet<>(
                seedRefs == null ? List.of() : seedRefs));
        orderedRefs.sort(DungeonWindow.ENTITY_ORDER);
        seedRefs = List.copyOf(orderedRefs);
        dependencyExpansion = dependencyExpansion == null
                ? DependencyExpansion.OUTBOUND
                : dependencyExpansion;
        intent = intent == null ? CommandIntent.AUTHORED_MUTATION : intent;
    }

    public enum DependencyExpansion {
        OUTBOUND,
        OUTBOUND_AND_INBOUND
    }

    public enum CommandIntent {
        AUTHORED_MUTATION,
        INSPECTOR,
        HISTORY,
        TRANSITION_LINK
    }
}
