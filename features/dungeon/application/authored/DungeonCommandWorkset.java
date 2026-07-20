package features.dungeon.application.authored;

import features.dungeon.api.DungeonChunkKey;
import features.dungeon.application.authored.command.DungeonPatchEntityRef;
import features.dungeon.application.authored.port.DungeonEntitySnapshot;
import features.dungeon.application.authored.port.DungeonMapHeader;
import features.dungeon.application.authored.port.DungeonWindow;
import features.dungeon.application.authored.port.DungeonWindowRequest;
import features.dungeon.domain.core.structure.DungeonMap;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

/**
 * Marked command-scoped hydration. Its internal aggregate is never a general map
 * readback and is exposed only after the originating spec is proven complete.
 */
public final class DungeonCommandWorkset {
    private final DungeonMapHeader mapHeader;
    private final List<DungeonChunkKey> loadedChunkKeys;
    private final List<DungeonEntitySnapshot> entities;
    private final List<DungeonPatchEntityRef> dependencyRefs;
    private final Set<DungeonPatchEntityRef> inboundExpandedRefs;
    private final DungeonMap commandAggregate;

    DungeonCommandWorkset(
            DungeonMapHeader mapHeader,
            List<DungeonChunkKey> loadedChunkKeys,
            List<DungeonEntitySnapshot> entities,
            List<DungeonPatchEntityRef> dependencyRefs,
            Set<DungeonPatchEntityRef> inboundExpandedRefs,
            DungeonMap commandAggregate
    ) {
        this.mapHeader = Objects.requireNonNull(mapHeader, "mapHeader");
        List<DungeonChunkKey> chunks = new ArrayList<>(new LinkedHashSet<>(
                loadedChunkKeys == null ? List.of() : loadedChunkKeys));
        chunks.sort(DungeonWindowRequest.CHUNK_ORDER);
        this.loadedChunkKeys = List.copyOf(chunks);
        List<DungeonEntitySnapshot> orderedEntities = new ArrayList<>(
                entities == null ? List.of() : entities);
        orderedEntities.sort((left, right) -> DungeonWindow.ENTITY_ORDER.compare(left.ref(), right.ref()));
        this.entities = List.copyOf(orderedEntities);
        List<DungeonPatchEntityRef> dependencies = new ArrayList<>(new LinkedHashSet<>(
                dependencyRefs == null ? List.of() : dependencyRefs));
        dependencies.sort(DungeonWindow.ENTITY_ORDER);
        this.dependencyRefs = List.copyOf(dependencies);
        this.inboundExpandedRefs = Set.copyOf(inboundExpandedRefs == null ? Set.of() : inboundExpandedRefs);
        this.commandAggregate = Objects.requireNonNull(commandAggregate, "commandAggregate");
    }

    public DungeonMapHeader mapHeader() {
        return mapHeader;
    }

    public List<DungeonChunkKey> loadedChunkKeys() {
        return loadedChunkKeys;
    }

    public List<DungeonEntitySnapshot> entities() {
        return entities;
    }

    public List<DungeonPatchEntityRef> dependencyRefs() {
        return dependencyRefs;
    }

    public boolean containsComplete(DungeonCommandReadSpec spec) {
        if (spec == null
                || !mapHeader.mapId().equals(spec.mapId())
                || mapHeader.revision() != spec.expectedRevision()
                || !loadedChunkKeys.containsAll(spec.chunkKeys())) {
            return false;
        }
        Set<DungeonPatchEntityRef> loaded = new LinkedHashSet<>();
        entities.forEach(entity -> loaded.add(entity.ref()));
        if (!loaded.containsAll(spec.seedRefs()) || !loaded.containsAll(dependencyRefs)) {
            return false;
        }
        for (DungeonEntitySnapshot entity : entities) {
            if (!loaded.containsAll(entity.dependencyHeaders())) {
                return false;
            }
        }
        return spec.dependencyExpansion() != DungeonCommandReadSpec.DependencyExpansion.OUTBOUND_AND_INBOUND
                || inboundExpandedRefs.containsAll(loaded);
    }

    public DungeonMap aggregateFor(DungeonCommandReadSpec spec) {
        if (!containsComplete(spec)) {
            throw new IllegalStateException("Dungeon command workset is incomplete for the declared read spec");
        }
        return commandAggregate;
    }
}
